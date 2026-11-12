#!/usr/bin/env python3
"""Capture public Megathread source links and four initial directory indexes; no ROM bytes."""

import concurrent.futures
import html
import json
from html.parser import HTMLParser
from pathlib import Path
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = "https://r-roms.github.io/"


class Node:
    def __init__(self, tag="", attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def text(self):
        return " ".join(
            x.text() if isinstance(x, Node) else x for x in self.children
        ).strip()

    def all(self, tag):
        for child in self.children:
            if isinstance(child, Node):
                if child.tag == tag:
                    yield child
                yield from child.all(tag)


class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root = Node()
        self.stack = [self.root]
        self.feed(text)

    def handle_starttag(self, tag, attrs):
        n = Node(tag, attrs)
        self.stack[-1].children.append(n)
        if tag not in {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}:
            self.stack.append(n)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                break

    def handle_data(self, data):
        self.stack[-1].children.append(data)


def fetch(url):
    url = url.replace(" ", "%20")
    request = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    return urllib.request.urlopen(request, timeout=40).read().decode("utf-8")


def page(item):
    title, url = item
    doc = Document(fetch(url)).root
    sources = []
    for row in doc.all("tr"):
        cells = list(row.all("td"))
        if not cells:
            continue
        links = []
        for a in row.all("a"):
            href = urllib.parse.urljoin(url, a.attrs.get("href", ""))
            if href.startswith("https://") and urllib.parse.urlparse(href).hostname != "r-roms.github.io":
                links.append({"url": href, "label": a.text()})
        if links:
            sources.append({"title": cells[0].text(), "links": links})
    print(title, len(sources), flush=True)
    return {"title": title, "url": url, "sources": sources}


def directory(url):
    doc = Document(fetch(url)).root
    entries = []
    for div in doc.all("div"):
        if "entry" not in div.attrs.get("class", "").split():
            continue
        anchors = list(div.all("a"))
        if not anchors:
            continue
        a = anchors[0]
        name = a.text()
        if name == "../":
            continue
        href = urllib.parse.urljoin(url, a.attrs.get("href", ""))
        sizes = list(div.all("span"))
        entries.append({"name": name, "url": href, "sizeText": sizes[0].text() if sizes else "", "kind": "minerva" if "/rom?" in href else "folder"})
    return entries


def main():
    home = Document(fetch(BASE)).root
    unique = {}
    for a in home.all("a"):
        url = urllib.parse.urljoin(BASE, a.attrs.get("href", ""))
        path = urllib.parse.urlparse(url).path
        if urllib.parse.urlparse(url).hostname == "r-roms.github.io" and path.count("/") >= 2 and not path.endswith((".svg", ".css", ".js")):
            unique[url] = a.text()
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pages = list(pool.map(page, [(v, k) for k, v in unique.items()]))
    seed = {"updated": "2026-11-12", "pages": pages, "directories": {}}
    wanted = {
        "nes": "Nintendo - Nintendo Entertainment System (Headered)",
        "snes": "Nintendo - Super Nintendo Entertainment System",
        "gba": "Nintendo - Game Boy Advance",
        "md": "Sega - Mega Drive - Genesis",
    }
    jobs = []
    for platform, name in wanted.items():
        for p in pages:
            match = next((r for r in p["sources"] if r["title"] == name), None)
            if match:
                link = next((x["url"] for x in match["links"] if "minerva-archive.org/browse/" in x["url"]), None)
                if link:
                    jobs.append((platform, link))
                    break
    for platform, url in jobs:
        try:
            seed["directories"][url] = directory(url)
            print(platform, len(seed["directories"][url]), flush=True)
        except Exception as e:
            print(platform, "live loading required:", e, flush=True)
    (ROOT / "assets/seed.json").write_text(json.dumps(seed, ensure_ascii=False, separators=(",", ":")))
    print("pages", len(pages), "bytes", (ROOT / "assets/seed.json").stat().st_size)


if __name__ == "__main__":
    main()
