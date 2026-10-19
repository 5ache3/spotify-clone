#!/usr/bin/env bash
# Create the venv if needed, install requirements, and start the server.
# Works from any directory, e.g. `./server/run.sh` from the project root.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

PY="${PYTHON:-python3.11}"
command -v "$PY" >/dev/null 2>&1 || PY=python3

if [ ! -x .venv/bin/python ]; then
  echo "Creating virtualenv in $DIR/.venv"
  "$PY" -m venv .venv
fi
.venv/bin/pip install -q --disable-pip-version-check -r requirements.txt

command -v ffmpeg >/dev/null 2>&1 || echo "WARNING: ffmpeg not found on PATH; audio conversion will fail." >&2

exec .venv/bin/python server.py "$@"
