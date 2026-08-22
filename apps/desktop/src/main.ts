import { app, BrowserWindow, Tray, Menu, nativeImage, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { getFreePort } from './get-free-port';
import { waitForHttp } from './wait-for-http';

const APP_NAME = 'LeadHunter AI';
// package.json's name is the scoped "@leadhunter/desktop" - override before
// anything reads app.getPath('userData') or the window title bar falls back
// to it, otherwise Windows gets a "@leadhunter" folder/appdata path.
app.setName(APP_NAME);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

// PyInstaller has `sys.frozen` / `sys._MEIPASS`; app.isPackaged /
// process.resourcesPath are the Electron equivalents. In dev, backend and
// web are plain sibling workspace packages; once packaged, build_windows.bat
// copies their built output (with a flattened, non-symlinked node_modules -
// see that script for why pnpm needs an extra step here) into extraResources.
function resourceDir(name: 'backend' | 'web'): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, name)
    : path.join(__dirname, '..', '..', name);
}

function iconPath(): string {
  const file = process.platform === 'win32' ? 'icon.ico' : 'icon.png';
  return app.isPackaged
    ? path.join(process.resourcesPath, 'build', file)
    : path.join(__dirname, '..', 'build', file);
}

// The backend needs a stable JWT secret across restarts (otherwise every
// relaunch invalidates existing sessions) but this is a single-user local
// install with no server to keep a real secret on - a random value
// generated once and persisted next to the user's data is enough.
function ensureSecrets(dataDir: string): { jwtSecret: string; jwtRefreshSecret: string } {
  const secretsPath = path.join(dataDir, '.secrets.json');
  try {
    const existing = JSON.parse(fs.readFileSync(secretsPath, 'utf-8'));
    if (existing.jwtSecret && existing.jwtRefreshSecret) return existing;
  } catch {
    // first run, or file missing/corrupt - generate fresh below
  }
  const secrets = {
    jwtSecret: crypto.randomBytes(32).toString('hex'),
    jwtRefreshSecret: crypto.randomBytes(32).toString('hex'),
  };
  fs.writeFileSync(secretsPath, JSON.stringify(secrets), { mode: 0o600 });
  return secrets;
}

async function startBackend(dataDir: string, backendPort: number): Promise<void> {
  fs.mkdirSync(dataDir, { recursive: true });
  const { jwtSecret, jwtRefreshSecret } = ensureSecrets(dataDir);

  process.env.NODE_ENV = 'production';
  process.env.LEADHUNTER_DATA_DIR = dataDir;
  process.env.DATABASE_URL = `file:${path.join(dataDir, 'leadhunter.db')}`;
  process.env.PORT = String(backendPort);
  process.env.JWT_SECRET = jwtSecret;
  process.env.JWT_REFRESH_SECRET = jwtRefreshSecret;

  // A user can drop extra keys (GOOGLE_PLACES_API_KEY, OPENAI_API_KEY, ...)
  // into <dataDir>/.env to enable the optional integrations; everything
  // degrades gracefully without them (see FoursquareService/YelpService/
  // EnrichmentService fallbacks).
  const userEnvPath = path.join(dataDir, '.env');
  if (fs.existsSync(userEnvPath)) {
    for (const line of fs.readFileSync(userEnvPath, 'utf-8').split('\n')) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (match) process.env[match[1]!] = match[2];
    }
  }

  const backendDir = resourceDir('backend');
  // `prisma migrate deploy` is the non-interactive, production-safe
  // counterpart to `migrate dev` - it just applies whatever migrations
  // ship in prisma/migrations without prompting or generating new ones.
  // Calling node_modules/prisma's JS entry directly (not the .bin shim)
  // sidesteps the shim being a .CMD file on Windows instead of a script
  // we can hand straight to node. A packaged Electron app has no separate
  // `node` binary though - process.execPath *is* Electron - so the child
  // needs ELECTRON_RUN_AS_NODE=1 or Electron tries to launch the script
  // path as another Electron app instead of running it as plain Node.
  const { execFileSync } = require('child_process');
  execFileSync(process.execPath, [path.join(backendDir, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy'], {
    cwd: backendDir,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
    stdio: 'inherit',
  });

  require(path.join(backendDir, 'dist', 'src', 'main.js'));
  await waitForHttp(`http://127.0.0.1:${backendPort}/api/docs`);
}

async function startWeb(webPort: number, backendPort: number): Promise<void> {
  process.env.INTERNAL_API_URL = `http://127.0.0.1:${backendPort}/api`;
  process.env.NEXT_PUBLIC_API_URL = '/api';
  process.env.PORT = String(webPort);

  const webDir = resourceDir('web');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const next = require(path.join(webDir, 'node_modules', 'next'));
  const nextApp = next({ dev: false, dir: webDir, hostname: '127.0.0.1', port: webPort });
  const handler = nextApp.getRequestHandler();
  await nextApp.prepare();

  const http = require('http');
  const server = http.createServer((req: any, res: any) => handler(req, res));
  await new Promise<void>((resolve) => server.listen(webPort, '127.0.0.1', resolve));

  await waitForHttp(`http://127.0.0.1:${webPort}/`);
}

function createWindow(webPort: number) {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: APP_NAME,
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${webPort}/dashboard`);

  // Keep background work (running searches, exports) alive - close hides
  // to the tray instead of quitting, same as the tray menu's own "Sair".
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

function createTray() {
  const image = nativeImage.createFromPath(iconPath());
  tray = new Tray(image.isEmpty() ? image : image.resize({ width: 16, height: 16 }));
  tray.setToolTip(APP_NAME);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Abrir',
        click: () => {
          mainWindow?.show();
          mainWindow?.focus();
        },
      },
      {
        label: 'Sair',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on('click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

app.on('window-all-closed', () => {
  // no-op: closing the window hides it (see createWindow) rather than
  // triggering this, but keep the app running on every platform regardless
  // (default Electron behavior quits on non-macOS, which we don't want
  // since the tray icon is how this app is meant to be dismissed).
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(async () => {
  const dataDir = path.join(app.getPath('userData'), 'data');
  const [backendPort, webPort] = await Promise.all([getFreePort(), getFreePort()]);

  await startBackend(dataDir, backendPort);
  await startWeb(webPort, backendPort);

  createWindow(webPort);
  createTray();
});
