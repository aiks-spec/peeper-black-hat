import os
import sys
import json
import subprocess
from typing import Tuple


PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))


def _run_command(cmd: list, cwd: str = PROJECT_ROOT) -> Tuple[int, str, str]:
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            env={**os.environ},
        )
        return result.returncode, result.stdout or "", result.stderr or ""
    except Exception as e:
        return 1, "", str(e)


def run_sherlock(username: str) -> str:
    sherlock_script = os.path.join(PROJECT_ROOT, "tools", "sherlock", "sherlock.py")
    if not os.path.exists(sherlock_script):
        return f"Sherlock not found at {sherlock_script}"
    code, out, err = _run_command(["python3", sherlock_script, username])
    return out if code == 0 else (err or out)


def run_phoneinfoga(phone: str) -> str:
    # Prefer local binary in tools/PhoneInfoga if present
    bin_path = os.path.join(PROJECT_ROOT, "tools", "PhoneInfoga", "phoneinfoga")
    if os.path.exists(bin_path) and os.access(bin_path, os.X_OK):
        code, out, err = _run_command([bin_path, "scan", "--number", phone])
        return out if code == 0 else (err or out)

    # Fallback: try python entrypoint inside tools/PhoneInfoga if there is any
    py_entry = os.path.join(PROJECT_ROOT, "tools", "PhoneInfoga", "phoneinfoga.py")
    if os.path.exists(py_entry):
        code, out, err = _run_command(["python3", py_entry, "scan", "--number", phone])
        return out if code == 0 else (err or out)

    return f"PhoneInfoga binary or script not found under {os.path.join(PROJECT_ROOT, 'tools', 'PhoneInfoga')}"


def run_holehe(email: str) -> str:
    # Try direct script path
    holehe_script = os.path.join(PROJECT_ROOT, "tools", "holehe", "holehe.py")
    if os.path.exists(holehe_script):
        code, out, err = _run_command(["python3", holehe_script, email])
        return out if code == 0 else (err or out)

    # Try package-style runner inside repo if present: python3 -m holehe
    holehe_pkg_dir = os.path.join(PROJECT_ROOT, "tools", "holehe")
    if os.path.isdir(holehe_pkg_dir):
        env = {**os.environ}
        env["PYTHONPATH"] = f"{holehe_pkg_dir}{os.pathsep}{env.get('PYTHONPATH', '')}"
        try:
            result = subprocess.run(
                ["python3", "-m", "holehe", email],
                cwd=PROJECT_ROOT,
                capture_output=True,
                text=True,
                env=env,
            )
            return result.stdout if result.returncode == 0 else (result.stderr or result.stdout)
        except Exception as e:
            return str(e)

    return f"Holehe not found under {os.path.join(PROJECT_ROOT, 'tools', 'holehe')}"


def _ghunt_is_authenticated() -> bool:
    cfg = os.path.join(os.path.expanduser("~"), ".config", "ghunt")
    tokens = os.path.join(cfg, "tokens.json")
    cookies = os.path.join(cfg, "cookies.json")
    return os.path.exists(tokens) and os.path.exists(cookies)


def run_ghunt(email: str) -> str:
    if not _ghunt_is_authenticated():
        return "GHunt not authenticated. Ensure tokens.json and cookies.json are present in ~/.config/ghunt."

    # Prefer local repo invocation if a cli or module entry is present
    ghunt_repo = os.path.join(PROJECT_ROOT, "tools", "ghunt")
    ghunt_cli = os.path.join(ghunt_repo, "ghunt.py")
    if os.path.exists(ghunt_cli):
        code, out, err = _run_command(["python3", ghunt_cli, email])
        return out if code == 0 else (err or out)

    # If no local CLI script, try module in repo via PYTHONPATH
    if os.path.isdir(ghunt_repo):
        env = {**os.environ}
        env["PYTHONPATH"] = f"{ghunt_repo}{os.pathsep}{env.get('PYTHONPATH', '')}"
        try:
            result = subprocess.run(
                ["python3", "-m", "ghunt", email],
                cwd=PROJECT_ROOT,
                capture_output=True,
                text=True,
                env=env,
            )
            return result.stdout if result.returncode == 0 else (result.stderr or result.stdout)
        except Exception as e:
            return str(e)

    return f"GHunt not found under {ghunt_repo}"


def main():
    if len(sys.argv) < 3:
        print("Usage: python tools/wrappers.py <tool> <arg>")
        sys.exit(1)

    tool = sys.argv[1].strip().lower()
    arg = " ".join(sys.argv[2:]).strip()

    if tool == "sherlock":
        print(run_sherlock(arg))
    elif tool == "phoneinfoga":
        print(run_phoneinfoga(arg))
    elif tool == "holehe":
        print(run_holehe(arg))
    elif tool == "ghunt":
        print(run_ghunt(arg))
    else:
        print(f"Unknown tool: {tool}")
        sys.exit(2)


if __name__ == "__main__":
    main()


