#!/usr/bin/env python3
"""Build a small provider allowlist and public HTTPS ROM catalog, never whole game files."""

import concurrent.futures
from datetime import datetime
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import time
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location(
    "legacy_parser", ROOT / "scripts/refresh-index.py"
)
parser = importlib.util.module_from_spec(spec)
spec.loader.exec_module(parser)
CACHE = ROOT / "build/direct-cache"
CACHE.mkdir(parents=True, exist_ok=True)
TODAY = datetime.now().astimezone().date().isoformat()
USER_AGENT = "Mozilla/5.0 (Android) PocketShelf/1.2"
SYSTEMS = {
    "nes": "nintendo-nes",
    "snes": "nintendo-snes",
    "gba": "nintendo-gameboy-advance",
    "md": "sega-genesis",
    "gb": "nintendo-gameboy",
    "gbc": "nintendo-gameboy-color",
    "nds": "nintendo-ds",
    "n64": "nintendo-64",
    "gg": "sega-gamegear",
    "sms": "sega-sms",
    "32x": "sega-32x",
    "pce": "nec-pc-engine-turbografx-16",
}
LIBRETRO = {
    "nes": "Nintendo - Nintendo Entertainment System",
    "snes": "Nintendo - Super Nintendo Entertainment System",
    "gba": "Nintendo - GameBoy Advance",
    "md": "Sega - Mega Drive - Genesis",
}
ROM = re.compile(
    r"\.(zip|7z|nes|sfc|smc|gba|gb|gbc|md|gen|bin|nds|3ds|iso|chd|z64|n64|gg|sms|32x|pce)$",
    re.I,
)


def fetch(url):
    file = CACHE / (hashlib.sha256(url.encode()).hexdigest() + ".html")
    if file.exists() and time.time() - file.stat().st_mtime < 24 * 3600:
        return file.read_text()
    time.sleep(0.12)
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    data = urllib.request.urlopen(request, timeout=30).read().decode("utf-8")
    file.write_text(data)
    return data


def edge_entries(text, base):
    result = []
    for detail in parser.Document(text).root.all("details"):
        name = detail.attrs.get("data-name", "")
        if not ROM.search(name):
            continue
        a = next(
            (
                a
                for a in detail.all("a")
                if a.attrs.get("href", "").startswith("/download/")
            ),
            None,
        )
        if a is None:
            continue
        spans = list(detail.all("span"))
        size_text = spans[0].text().split(",")[0].strip() if spans else ""
        result.append(
            {
                "name": name,
                "url": urllib.parse.urljoin(base, a.attrs["href"]),
                "kind": "direct",
                "sizeText": size_text,
                "provider": "edge",
            }
        )
    return result


def probe(url):
    request = urllib.request.Request(
        url, headers={"User-Agent": USER_AGENT, "Range": "bytes=0-63"}
    )
    with urllib.request.urlopen(request, timeout=25) as response:
        prefix = response.read(64)
        content_type = response.headers.get("Content-Type", "")
        if prefix[:4] != b"PK\x03\x04" or "html" in content_type:
            raise RuntimeError("not a direct ZIP response")
        return {
            "url": url,
            "http": response.status,
            "zipHeader": True,
            "checkedAt": TODAY,
        }


def main():
    result = {
        "updated": TODAY,
        "providers": [
            {
                "id": "edge",
                "name": "经典游戏目录",
                "description": "Edge Emulation · 免登录 HTTPS 直链",
                "url": "https://edgeemu.net/",
                "checks": [],
            },
            {
                "id": "libretro",
                "name": "公共游戏与演示",
                "description": "Libretro · 公开内容直链",
                "url": "https://buildbot.libretro.com/assets/cores/",
                "checks": [],
            },
        ],
        "platforms": [],
        "directories": {},
    }
    failures = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for platform, system in SYSTEMS.items():
            base = "https://edgeemu.net/browse/" + system
            try:
                text = fetch(base)
                sample = edge_entries(text, base)
                if not sample:
                    raise RuntimeError("no public file links")
                check = probe(sample[0]["url"])
                urls = [
                    urllib.parse.urljoin(base, option.attrs["value"])
                    for select in parser.Document(text).root.all("select")
                    if select.attrs.get("name") == "letter"
                    for option in select.all("option")
                    if option.attrs.get("value", "").startswith("/browse/")
                ]
                record = {
                    "platform": platform,
                    "provider": "edge",
                    "url": base,
                    "pages": urls,
                }
                if platform in {"nes", "snes", "gba", "md", "gb", "gbc"}:

                    def read_page(url):
                        try:
                            return edge_entries(fetch(url), url)
                        except Exception as error:
                            failures.append({"url": url, "error": str(error)})
                            return []

                    entries = {
                        entry["url"]: entry
                        for batch in pool.map(read_page, urls)
                        for entry in batch
                    }
                    result["directories"][base] = sorted(
                        entries.values(), key=lambda entry: entry["name"].casefold()
                    )
                    print(platform, len(entries), "HTTPS file links", flush=True)
                result["platforms"].append(record)
                result["providers"][0]["checks"].append({"platform": platform, **check})
            except Exception as error:
                failures.append({"platform": platform, "error": str(error)})
                print(platform, "omitted:", error, flush=True)
        for platform, directory in LIBRETRO.items():
            base = (
                "https://buildbot.libretro.com/assets/cores/"
                + urllib.parse.quote(directory)
                + "/"
            )
            try:
                entries = []
                for a in parser.Document(fetch(base)).root.all("a"):
                    url = urllib.parse.urljoin(base, a.attrs.get("href", ""))
                    name = urllib.parse.unquote(
                        urllib.parse.urlparse(url).path.split("/")[-1]
                    )
                    if ROM.search(name) and not re.search(
                        r"utility|tools|bios", name, re.I
                    ):
                        entries.append(
                            {
                                "name": name,
                                "url": url,
                                "kind": "direct",
                                "provider": "libretro",
                            }
                        )
                if not entries:
                    continue
                # Verify a ZIP entry when available; raw ROMs are checked again before download.
                sample = next(
                    (
                        entry
                        for entry in entries
                        if entry["name"].lower().endswith(".zip")
                    ),
                    None,
                )
                if sample:
                    result["providers"][1]["checks"].append(
                        {"platform": platform, **probe(sample["url"])}
                    )
                result["platforms"].append(
                    {
                        "platform": platform,
                        "provider": "libretro",
                        "url": base,
                        "pages": [],
                    }
                )
                result["directories"][base] = entries
                print("libretro", platform, len(entries), flush=True)
            except Exception as error:
                failures.append(
                    {"provider": "libretro", "platform": platform, "error": str(error)}
                )
    required = {"nes", "snes", "gba", "md"}
    available = {
        row["platform"] for row in result["platforms"] if row["provider"] == "edge"
    }
    if not required.issubset(available):
        raise RuntimeError("Core direct-source checks failed; previous index preserved")
    result["failures"] = failures
    target = ROOT / "assets/direct.json"
    target.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    print("saved", target.stat().st_size, "bytes; failures", len(failures), flush=True)


if __name__ == "__main__":
    main()
