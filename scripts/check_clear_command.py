#!/usr/bin/env -S uv run python
"""Manual check for /clear command: runs the unit test that simulates the flow."""

import subprocess
import sys
from pathlib import Path

if __name__ == '__main__':
    root = Path(__file__).resolve().parent.parent
    rc = subprocess.call(
        [
            'uv',
            'run',
            'pytest',
            'tests/unit/controller/test_agent_controller.py::test_clear_command_resets_history_preserves_runtime',
            '-v',
        ],
        cwd=root,
    )
    sys.exit(rc)
