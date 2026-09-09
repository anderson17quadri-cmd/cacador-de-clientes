"""Aplicativo Windows autocontido do LeadHunter AI, sem Docker e sem navegador externo."""

from __future__ import annotations

import ctypes
import hashlib
import json
import os
import queue
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.request
import zipfile
from ctypes import wintypes
from pathlib import Path


APP_NAME = "LeadHunter AI"
APP_USER_MODEL_ID = "LeadHunterAI.Desktop"
APP_URL = "http://127.0.0.1:3000/dashboard"
WEB_HEALTH_URL = "http://127.0.0.1:3000/"
API_HEALTH_URL = "http://127.0.0.1:3001/health"
CREATE_NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)
PROCESSES: list[subprocess.Popen[bytes]] = []
LOG_HANDLES: list[object] = []
JOB_HANDLE = None


class JobObjectBasicLimitInformation(ctypes.Structure):
    _fields_ = [
        ("PerProcessUserTimeLimit", ctypes.c_int64),
        ("PerJobUserTimeLimit", ctypes.c_int64),
        ("LimitFlags", wintypes.DWORD),
        ("MinimumWorkingSetSize", ctypes.c_size_t),
        ("MaximumWorkingSetSize", ctypes.c_size_t),
        ("ActiveProcessLimit", wintypes.DWORD),
        ("Affinity", ctypes.c_size_t),
        ("PriorityClass", wintypes.DWORD),
        ("SchedulingClass", wintypes.DWORD),
    ]


class IoCounters(ctypes.Structure):
    _fields_ = [
        ("ReadOperationCount", ctypes.c_uint64),
        ("WriteOperationCount", ctypes.c_uint64),
        ("OtherOperationCount", ctypes.c_uint64),
        ("ReadTransferCount", ctypes.c_uint64),
        ("WriteTransferCount", ctypes.c_uint64),
        ("OtherTransferCount", ctypes.c_uint64),
    ]


class JobObjectExtendedLimitInformation(ctypes.Structure):
    _fields_ = [
        ("BasicLimitInformation", JobObjectBasicLimitInformation),
        ("IoInfo", IoCounters),
        ("ProcessMemoryLimit", ctypes.c_size_t),
        ("JobMemoryLimit", ctypes.c_size_t),
        ("PeakProcessMemoryUsed", ctypes.c_size_t),
        ("PeakJobMemoryUsed", ctypes.c_size_t),
    ]


def create_process_job() -> None:
    global JOB_HANDLE
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
    kernel32.CreateJobObjectW.restype = wintypes.HANDLE
    kernel32.SetInformationJobObject.restype = wintypes.BOOL
    handle = kernel32.CreateJobObjectW(None, None)
    if not handle:
        raise OSError(ctypes.get_last_error(), "Falha ao criar o grupo de processos locais.")
    info = JobObjectExtendedLimitInformation()
    info.BasicLimitInformation.LimitFlags = 0x00002000
    if not kernel32.SetInformationJobObject(
        handle, 9, ctypes.byref(info), ctypes.sizeof(info)
    ):
        raise OSError(ctypes.get_last_error(), "Falha ao configurar os processos locais.")
    JOB_HANDLE = handle


def attach_to_process_job(process: subprocess.Popen[bytes]) -> None:
    if JOB_HANDLE is None:
        return
    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.AssignProcessToJobObject.argtypes = [wintypes.HANDLE, wintypes.HANDLE]
    kernel32.AssignProcessToJobObject.restype = wintypes.BOOL
    if not kernel32.AssignProcessToJobObject(JOB_HANDLE, wintypes.HANDLE(process._handle)):
        raise OSError(ctypes.get_last_error(), "Falha ao vincular um componente ao aplicativo.")


def bundled_file(name: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
    return base / name


def app_data_dir() -> Path:
    base = Path(os.environ.get("LOCALAPPDATA", Path.home()))
    path = base / "LeadHunterAI"
    path.mkdir(parents=True, exist_ok=True)
    return path


def url_ready(url: str, timeout: float = 2.0) -> bool:
    try:
        with urllib.request.urlopen(url, timeout=timeout) as response:
            return response.status == 200
    except Exception:
        return False


def wait_for_url(url: str, process: subprocess.Popen[bytes], seconds: int) -> None:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if url_ready(url):
            return
        code = process.poll()
        if code is not None:
            raise RuntimeError(f"Um componente local encerrou inesperadamente (código {code}).")
        time.sleep(0.5)
    raise RuntimeError(f"O componente local não respondeu dentro de {seconds} segundos.")


def port_ready(port: int) -> bool:
    try:
        with socket.create_connection(("127.0.0.1", port), timeout=1):
            return True
    except OSError:
        return False


def wait_for_port(port: int, process: subprocess.Popen[bytes], seconds: int) -> None:
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        if port_ready(port):
            return
        code = process.poll()
        if code is not None:
            raise RuntimeError(f"Um componente local encerrou inesperadamente (código {code}).")
        time.sleep(0.5)
    raise RuntimeError(f"A interface local não abriu a porta {port} dentro de {seconds} segundos.")


def extract_runtime(data_dir: Path, set_status) -> Path:
    archive = bundled_file("runtime-package.zip")
    if not archive.is_file():
        raise RuntimeError("O pacote interno do aplicativo não foi encontrado.")

    digest = hashlib.sha256(archive.read_bytes()).hexdigest()[:16]
    runtime_root = data_dir / "runtime" / digest
    marker = runtime_root / ".ready"
    if marker.is_file():
        return runtime_root

    set_status("Preparando os componentes locais (somente na primeira abertura)...")
    runtime_parent = runtime_root.parent
    runtime_parent.mkdir(parents=True, exist_ok=True)
    staging = runtime_parent / f"{digest}.installing"
    if staging.exists():
        shutil.rmtree(staging)
    staging.mkdir(parents=True)
    with zipfile.ZipFile(archive) as package:
        package.extractall(staging)
    (staging / ".ready").write_text(digest, encoding="ascii")
    if runtime_root.exists():
        shutil.rmtree(runtime_root)
    staging.replace(runtime_root)

    for old_runtime in runtime_parent.iterdir():
        if old_runtime.is_dir() and old_runtime != runtime_root:
            try:
                shutil.rmtree(old_runtime)
            except OSError:
                pass
    return runtime_root


def load_or_create_secrets(data_dir: Path) -> dict[str, str]:
    config_file = data_dir / "local-config.json"
    config: dict[str, str] = {}
    if config_file.is_file():
        try:
            config = json.loads(config_file.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            config = {}
    config.setdefault("jwtSecret", secrets.token_urlsafe(48))
    config.setdefault("refreshSecret", secrets.token_urlsafe(48))
    config.setdefault("encryptionSecret", secrets.token_urlsafe(48))
    config_file.write_text(json.dumps(config), encoding="utf-8")
    return config


def start_process(node: Path, script: Path, cwd: Path, env: dict[str, str], log: Path, args=None):
    log.parent.mkdir(parents=True, exist_ok=True)
    handle = log.open("ab")
    LOG_HANDLES.append(handle)
    process = subprocess.Popen(
        [str(node), str(script), *(args or [])],
        cwd=cwd,
        env=env,
        stdin=subprocess.DEVNULL,
        stdout=handle,
        stderr=subprocess.STDOUT,
        creationflags=CREATE_NO_WINDOW,
    )
    attach_to_process_job(process)
    PROCESSES.append(process)
    return process


def stop_services() -> None:
    while PROCESSES:
        process = PROCESSES.pop()
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
    while LOG_HANDLES:
        try:
            LOG_HANDLES.pop().close()
        except OSError:
            pass


def prepare_services(set_status) -> None:
    data_dir = app_data_dir()
    runtime = extract_runtime(data_dir, set_status)
    node = runtime / "node.exe"
    backend = runtime / "backend"
    web = runtime / "web"
    if not node.is_file():
        raise RuntimeError("O mecanismo local do aplicativo está incompleto.")

    database = data_dir / "leadhunter.db"
    if not database.is_file():
        shutil.copy2(runtime / "database-template.db", database)
    secrets_config = load_or_create_secrets(data_dir)

    common_env = os.environ.copy()
    common_env.update({"NODE_ENV": "production", "NO_COLOR": "1"})
    logs = data_dir / "logs"

    if not url_ready(API_HEALTH_URL):
        set_status("Iniciando o banco local e a API...")
        backend_env = common_env.copy()
        backend_env.update(
            {
                "PORT": "3001",
                "API_HOST": "127.0.0.1",
                "LOCAL_PERSONAL_MODE": "true",
                "LOCAL_USER_EMAIL": "pesquisa.local@leadhunter.app",
                "DATABASE_URL": f"file:{database.as_posix()}",
                "JWT_SECRET": secrets_config["jwtSecret"],
                "JWT_REFRESH_SECRET": secrets_config["refreshSecret"],
                "APP_ENCRYPTION_KEY": secrets_config["encryptionSecret"],
                "LEADHUNTER_DATA_DIR": str(data_dir),
                "CORS_ORIGINS": "http://127.0.0.1:3000",
            }
        )
        backend_process = start_process(
            node,
            backend / "dist" / "src" / "main.js",
            backend,
            backend_env,
            logs / "backend.log",
        )
        wait_for_url(API_HEALTH_URL, backend_process, 90)

    if not port_ready(3000):
        set_status("Iniciando a interface do aplicativo...")
        web_env = common_env.copy()
        web_env.update({"PORT": "3000", "HOSTNAME": "127.0.0.1"})
        web_process = start_process(
            node,
            web / "node_modules" / "next" / "dist" / "bin" / "next",
            web,
            web_env,
            logs / "web.log",
            ["start", "-H", "127.0.0.1", "-p", "3000"],
        )
        wait_for_port(3000, web_process, 60)


def show_error(message: str) -> None:
    ctypes.windll.user32.MessageBoxW(0, message, APP_NAME, 0x10)


def run_app_window() -> None:
    import webview

    window_closed = threading.Event()
    window = webview.create_window(
        APP_NAME,
        APP_URL,
        width=1360,
        height=860,
        min_size=(980, 640),
        background_color="#0b1020",
        text_select=True,
    )
    window.events.closed += window_closed.set
    webview.start(private_mode=False)
    window_closed.wait()
    stop_services()


def main() -> None:
    import tkinter as tk

    try:
        ctypes.windll.shell32.SetCurrentProcessExplicitAppUserModelID(APP_USER_MODEL_ID)
    except Exception:
        pass
    create_process_job()
    root = tk.Tk()
    root.title(APP_NAME)
    try:
        root.iconbitmap(default=str(bundled_file("assets/leadhunter-icon.ico")))
    except Exception:
        pass
    root.geometry("520x230")
    root.resizable(False, False)
    root.configure(bg="#0b1020")
    root.eval("tk::PlaceWindow . center")
    tk.Label(
        root,
        text="LeadHunter AI",
        font=("Segoe UI Semibold", 25),
        fg="#f8fafc",
        bg="#0b1020",
    ).pack(pady=(42, 8))
    status = tk.StringVar(value="Preparando o aplicativo...")
    tk.Label(
        root,
        textvariable=status,
        font=("Segoe UI", 10),
        fg="#93c5fd",
        bg="#0b1020",
        wraplength=450,
    ).pack(pady=8)

    result: dict[str, object] = {}
    status_events: queue.SimpleQueue[str] = queue.SimpleQueue()

    def set_status(text: str) -> None:
        status_events.put(text)

    def worker() -> None:
        try:
            prepare_services(set_status)
            result["ready"] = True
        except Exception as exc:
            result["error"] = str(exc)

    threading.Thread(target=worker, daemon=True).start()

    def poll() -> None:
        while not status_events.empty():
            status.set(status_events.get())
        if result:
            root.destroy()
            if "error" in result:
                stop_services()
                show_error(
                    f"Não foi possível iniciar o aplicativo.\n\n{result['error']}\n\n"
                    f"Consulte os logs em:\n{app_data_dir() / 'logs'}"
                )
                return
            run_app_window()
            return
        root.after(100, poll)

    root.after(100, poll)
    root.mainloop()


if __name__ == "__main__":
    main()
