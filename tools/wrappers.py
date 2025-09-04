#!/usr/bin/env python3
import sys
import subprocess


def run_command(cmd):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True)
        print(result.stdout)
        if result.stderr:
            print(result.stderr)
    except Exception as e:
        print(f"Error running command: {e}")


def run_sherlock(username):
    run_command(["python3", "tools/sherlock/sherlock.py", username])


def run_holehe(email):
    run_command(["python3", "tools/holehe/cli.py", email])


def run_phoneinfoga(phone):
    run_command(["python3", "tools/PhoneInfoga/phoneinfoga.py", "-n", phone])


def run_maigret(username):
    run_command(["python3", "tools/maigret/maigret.py", username])


def run_ghunt(email):
    run_command(["ghunt", "email", email])


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 tools/wrappers.py <tool> <argument>")
        sys.exit(1)

    tool = sys.argv[1]
    arg = sys.argv[2]

    if tool == "sherlock":
        run_sherlock(arg)
    elif tool == "holehe":
        run_holehe(arg)
    elif tool == "phoneinfoga":
        run_phoneinfoga(arg)
    elif tool == "maigret":
        run_maigret(arg)
    elif tool == "ghunt":
        run_ghunt(arg)
    else:
        print(f"Unknown tool: {tool}")
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
        return f"Error: Sherlock not found at {sherlock_script}"
    code, out, err = _run_command(["python3", sherlock_script, username])
    return out if code == 0 else (err or out or "Error: Sherlock execution failed")


def run_phoneinfoga(phone: str) -> str:
    py_entry = os.path.join(PROJECT_ROOT, "tools", "PhoneInfoga", "phoneinfoga.py")
    if not os.path.exists(py_entry):
        return f"Error: PhoneInfoga script not found at {py_entry}"
    # Requirement: python3 tools/PhoneInfoga/phoneinfoga.py -n <phone>
    code, out, err = _run_command(["python3", py_entry, "-n", phone])
    return out if code == 0 else (err or out or "Error: PhoneInfoga execution failed")


def run_holehe(email: str) -> str:
    # Requirement: python3 tools/holehe/cli.py <email>
    holehe_cli = os.path.join(PROJECT_ROOT, "tools", "holehe", "cli.py")
    if not os.path.exists(holehe_cli):
        return f"Error: Holehe CLI not found at {holehe_cli}"
    code, out, err = _run_command(["python3", holehe_cli, email])
    return out if code == 0 else (err or out or "Error: Holehe execution failed")


def _ghunt_is_authenticated() -> bool:
    cfg = os.path.join(os.path.expanduser("~"), ".config", "ghunt")
    tokens = os.path.join(cfg, "tokens.json")
    cookies = os.path.join(cfg, "cookies.json")
    return os.path.exists(tokens) and os.path.exists(cookies)


def run_ghunt(email: str) -> str:
    if not _ghunt_is_authenticated():
        return "Error: GHunt not authenticated. Ensure tokens.json and cookies.json are present in ~/.config/ghunt."
    ghunt_cli = os.path.join(PROJECT_ROOT, "tools", "ghunt", "ghunt.py")
    if not os.path.exists(ghunt_cli):
        return f"Error: GHunt CLI not found at {ghunt_cli}"
    code, out, err = _run_command(["python3", ghunt_cli, email])
    return out if code == 0 else (err or out or "Error: GHunt execution failed")


def run_maigret(username: str) -> str:
    # Requirement: python3 tools/maigret/maigret.py <username>
    maigret_script = os.path.join(PROJECT_ROOT, "tools", "maigret", "maigret.py")
    if not os.path.exists(maigret_script):
        return f"Error: Maigret not found at {maigret_script}"
    code, out, err = _run_command(["python3", maigret_script, username])
    return out if code == 0 else (err or out or "Error: Maigret execution failed")


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
    elif tool == "maigret":
        print(run_maigret(arg))
    else:
        print(f"Unknown tool: {tool}")
        sys.exit(2)


if __name__ == "__main__":
    main()


