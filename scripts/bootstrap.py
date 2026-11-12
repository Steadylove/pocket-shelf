#!/usr/bin/env python3
"""Download pinned official build dependencies and verify SHA-256."""
import hashlib
import json
from pathlib import Path
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
for dependency in json.loads((ROOT / "dependencies.json").read_text()):
    target = ROOT / dependency["path"]
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.exists() and hashlib.sha256(target.read_bytes()).hexdigest() == dependency["sha256"]:
        print("verified", dependency["path"])
        continue
    data = urllib.request.urlopen(dependency["url"], timeout=90).read()
    if hashlib.sha256(data).hexdigest() != dependency["sha256"]:
        raise RuntimeError("Dependency checksum mismatch: " + dependency["path"])
    target.write_bytes(data)
    print("downloaded and verified", dependency["path"])
