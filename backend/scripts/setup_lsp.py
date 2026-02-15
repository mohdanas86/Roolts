#!/usr/bin/env python3
"""
Roolts LSP Setup Script
========================
Installs language servers into the portable runtime environment.

Usage:
    python setup_lsp.py          # Install all language servers
    python setup_lsp.py python   # Install Python LSP only
    python setup_lsp.py java     # Download Eclipse JDTLS
    python setup_lsp.py status   # Check what's installed
"""

import sys
import os
import subprocess
import zipfile
import requests
import shutil
from pathlib import Path

# Paths
BACKEND_DIR = Path(__file__).parent.parent.resolve()
COMPILER_DIR = BACKEND_DIR / "compiler"
LSP_DIR = BACKEND_DIR / "lsp_servers"


def print_banner():
    print()
    print("  ╔═══════════════════════════════════════╗")
    print("  ║   🔧 Roolts LSP Server Installer      ║")
    print("  ╚═══════════════════════════════════════╝")
    print()


def install_python_lsp():
    """Install python-lsp-server using portable Python."""
    python_exe = COMPILER_DIR / "python" / "python.exe"
    if not python_exe.exists():
        print("  ❌ Portable Python not found. Install Python runtime first.")
        return False

    print("  📦 Installing python-lsp-server (pylsp)...")

    try:
        result = subprocess.run(
            [str(python_exe), "-m", "pip", "install",
             "python-lsp-server[all]", "--quiet", "--disable-pip-version-check"],
            capture_output=True, text=True, timeout=120
        )

        if result.returncode == 0:
            print("  ✅ python-lsp-server installed successfully!")
            return True
        else:
            print(f"  ❌ pip install failed: {result.stderr[:200]}")
            # Try without [all] extras
            print("  🔄 Retrying with minimal install...")
            result = subprocess.run(
                [str(python_exe), "-m", "pip", "install",
                 "python-lsp-server", "--quiet", "--disable-pip-version-check"],
                capture_output=True, text=True, timeout=120
            )
            if result.returncode == 0:
                print("  ✅ python-lsp-server (minimal) installed!")
                return True
            print(f"  ❌ Failed: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        print("  ❌ Installation timed out (120s). Check your internet connection.")
        return False
    except Exception as e:
        print(f"  ❌ Error: {e}")
        return False


def install_jdtls():
    """Download and install Eclipse JDT Language Server."""
    jdtls_dir = LSP_DIR / "jdtls"

    # Check if already installed
    plugins_dir = jdtls_dir / "plugins"
    if plugins_dir.exists():
        launchers = [f for f in plugins_dir.iterdir()
                     if f.name.startswith("org.eclipse.equinox.launcher_")]
        if launchers:
            print("  ✅ Eclipse JDTLS already installed.")
            return True

    # Check JDK exists
    java_exe = COMPILER_DIR / "java" / "jdk-21.0.2+13" / "bin" / "java.exe"
    if not java_exe.exists():
        print("  ❌ Portable JDK not found. Install Java runtime first.")
        return False

    # Download JDTLS
    JDTLS_URL = "https://download.eclipse.org/jdtls/milestones/1.43.0/jdt-language-server-1.43.0-202412191447.tar.gz"

    print("  📦 Downloading Eclipse JDTLS (v1.43.0)...")
    LSP_DIR.mkdir(parents=True, exist_ok=True)
    tar_path = LSP_DIR / "jdtls.tar.gz"

    try:
        response = requests.get(JDTLS_URL, stream=True, timeout=30,
                                headers={'User-Agent': 'Roolts/1.0'})
        response.raise_for_status()

        total = int(response.headers.get('content-length', 0))
        downloaded = 0

        with open(tar_path, 'wb') as f:
            for chunk in response.iter_content(chunk_size=8192):
                f.write(chunk)
                downloaded += len(chunk)
                if total > 0:
                    pct = int(downloaded / total * 100)
                    print(f"\r  📥 {downloaded // (1024*1024)}MB / {total // (1024*1024)}MB ({pct}%)", end="", flush=True)

        print()  # newline after progress

        # Extract
        print("  📂 Extracting JDTLS...")
        jdtls_dir.mkdir(parents=True, exist_ok=True)

        # Use tar command (available on Windows 10+)
        result = subprocess.run(
            ["tar", "-xzf", str(tar_path), "-C", str(jdtls_dir)],
            capture_output=True, text=True, timeout=60
        )

        if result.returncode != 0:
            print(f"  ❌ Extraction failed: {result.stderr[:200]}")
            return False

        # Cleanup
        if tar_path.exists():
            os.remove(tar_path)

        print("  ✅ Eclipse JDTLS installed!")
        return True

    except requests.exceptions.RequestException as e:
        print(f"\n  ❌ Download failed: {e}")
        return False
    except Exception as e:
        print(f"\n  ❌ Error: {e}")
        return False


def check_clangd():
    """Check if clangd is available."""
    clangd_path = COMPILER_DIR / "c_cpp" / "w64devkit" / "bin" / "clangd.exe"
    if clangd_path.exists():
        print("  ✅ clangd found in w64devkit.")
        return True

    # Check system PATH
    try:
        result = subprocess.run(["clangd", "--version"], capture_output=True, text=True, timeout=5)
        if result.returncode == 0:
            print(f"  ✅ clangd found in system PATH: {result.stdout.strip()[:60]}")
            return True
    except Exception:
        pass

    print("  ⚠️  clangd not found. C/C++ IntelliSense won't be available.")
    print("       Install LLVM/clangd or add it to w64devkit.")
    return False


def show_status():
    """Show installation status of all language servers."""
    print("  Language Server Status:")
    print("  " + "─" * 40)

    # Python
    python_exe = COMPILER_DIR / "python" / "python.exe"
    if python_exe.exists():
        result = subprocess.run(
            [str(python_exe), "-m", "pylsp", "--help"],
            capture_output=True, text=True, timeout=5
        )
        if result.returncode == 0:
            print("  ✅ Python (pylsp)       — installed")
        else:
            print("  ❌ Python (pylsp)       — NOT installed")
    else:
        print("  ❌ Python runtime       — NOT found")

    # Java
    jdtls_dir = LSP_DIR / "jdtls" / "plugins"
    if jdtls_dir.exists():
        launchers = [f for f in jdtls_dir.iterdir()
                     if f.name.startswith("org.eclipse.equinox.launcher_")]
        if launchers:
            print("  ✅ Java (JDTLS)        — installed")
        else:
            print("  ❌ Java (JDTLS)        — NOT installed")
    else:
        print("  ❌ Java (JDTLS)        — NOT installed")

    # C/C++
    check_clangd()

    # JS/TS
    print("  ✅ JS/TS (Monaco)      — built-in")


def main():
    print_banner()

    if len(sys.argv) < 2 or sys.argv[1] == "all":
        print("  Installing all available language servers...\n")
        install_python_lsp()
        print()
        install_jdtls()
        print()
        check_clangd()
        print()
        print("  Done! Language servers are ready.")

    elif sys.argv[1] == "python":
        install_python_lsp()

    elif sys.argv[1] == "java":
        install_jdtls()

    elif sys.argv[1] == "status":
        show_status()

    else:
        print(f"  Unknown option: {sys.argv[1]}")
        print("  Usage: python setup_lsp.py [all|python|java|status]")

    print()


if __name__ == "__main__":
    main()
