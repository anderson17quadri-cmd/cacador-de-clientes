"""Monta o runtime Node/SQLite autocontido usado pelo executável Windows."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DESKTOP = ROOT / "desktop"
STAGING = DESKTOP / "runtime-build"
ARCHIVE = DESKTOP / "runtime-package.zip"
TEMPLATE_DB = DESKTOP / "database-template.db"
PNPM = shutil.which("pnpm") or shutil.which("pnpm.cmd")
NPM = shutil.which("npm") or shutil.which("npm.cmd")


def run(command: list[str], cwd: Path, env: dict[str, str] | None = None) -> None:
    print(f"> {' '.join(command)}", flush=True)
    subprocess.run(command, cwd=cwd, env=env, check=True)


def install_backend() -> None:
    target = STAGING / "backend"
    target.mkdir(parents=True)
    shutil.copytree(ROOT / "apps" / "backend" / "dist", target / "dist")
    shutil.copy2(ROOT / "apps" / "backend" / "package.json", target / "package.json")
    run([NPM, "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], target)

    generated = sorted(
        (ROOT / "node_modules" / ".pnpm").glob("@prisma+client@*/node_modules/.prisma"),
        key=lambda path: path.stat().st_mtime,
        reverse=True,
    )
    if not generated:
        raise RuntimeError("Prisma Client gerado não foi encontrado.")
    shutil.copytree(generated[0], target / "node_modules" / ".prisma", dirs_exist_ok=True)


def install_web() -> None:
    target = STAGING / "web"
    target.mkdir(parents=True)
    shutil.copytree(ROOT / "apps" / "web" / ".next", target / ".next")
    public = ROOT / "apps" / "web" / "public"
    if public.is_dir():
        shutil.copytree(public, target / "public")
    package = {
        "name": "leadhunter-web-runtime",
        "version": "1.0.0",
        "private": True,
        "dependencies": {"next": "14.2.35", "react": "18.3.1", "react-dom": "18.3.1"},
    }
    (target / "package.json").write_text(json.dumps(package, indent=2), encoding="utf-8")
    run([NPM, "install", "--omit=dev", "--ignore-scripts", "--no-audit", "--no-fund"], target)


def create_archive() -> None:
    if ARCHIVE.exists():
        ARCHIVE.unlink()
    print(f"Compactando runtime em {ARCHIVE}...", flush=True)
    with zipfile.ZipFile(ARCHIVE, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as package:
        for file in STAGING.rglob("*"):
            if file.is_file():
                package.write(file, file.relative_to(STAGING))


def main() -> None:
    global STAGING
    if not TEMPLATE_DB.is_file():
        raise RuntimeError(f"Banco-modelo não encontrado: {TEMPLATE_DB}")
    node = shutil.which("node")
    if not node:
        raise RuntimeError("Node.js não foi encontrado no PATH.")
    if not PNPM or not NPM:
        raise RuntimeError("npm/pnpm não foram encontrados no PATH.")

    run([PNPM, "--filter", "@leadhunter/backend", "db:generate"], ROOT)
    run([PNPM, "--filter", "@leadhunter/backend", "build"], ROOT)
    web_env = os.environ.copy()
    web_env.pop("NEXT_STANDALONE", None)
    run([PNPM, "--filter", "@leadhunter/web", "build"], ROOT, web_env)

    STAGING = Path(tempfile.mkdtemp(prefix="leadhunter-runtime-", dir=DESKTOP))
    shutil.copy2(node, STAGING / "node.exe")
    shutil.copy2(TEMPLATE_DB, STAGING / "database-template.db")
    install_backend()
    install_web()
    create_archive()
    print(f"Runtime pronto: {ARCHIVE} ({ARCHIVE.stat().st_size / 1024 / 1024:.1f} MB)")
    shutil.rmtree(STAGING, ignore_errors=True)


if __name__ == "__main__":
    main()
