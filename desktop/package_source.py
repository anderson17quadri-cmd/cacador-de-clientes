"""Cria o pacote de fontes que acompanha o executável Windows."""

from __future__ import annotations

import zipfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = Path(__file__).resolve().parent / "source.zip"
INCLUDE = (
    ".dockerignore",
    ".env.example",
    ".eslintrc.js",
    ".npmrc",
    ".prettierrc",
    "apps",
    "docker",
    "packages",
    "docker-compose.yml",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "tsconfig.base.json",
    "turbo.json",
)
EXCLUDED_PARTS = {
    ".next",
    ".next-stale-settings",
    ".turbo",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "uploads",
}


def should_include(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return not any(part in EXCLUDED_PARTS or part.startswith(".venv") for part in relative.parts)


def main() -> None:
    if OUTPUT.exists():
        OUTPUT.unlink()
    with zipfile.ZipFile(OUTPUT, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for item_name in INCLUDE:
            item = ROOT / item_name
            if item.is_file():
                archive.write(item, item.relative_to(ROOT))
            elif item.is_dir():
                for file in item.rglob("*"):
                    if file.is_file() and should_include(file):
                        archive.write(file, file.relative_to(ROOT))
    print(f"Pacote criado: {OUTPUT} ({OUTPUT.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
