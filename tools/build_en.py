"""Build the English pages from the Croatian ones and keep the search metadata in sync.

The Croatian page is the source. For every page this script:
  - fills elements marked data-i18n with their text from the page's dictionary, so the HTML
    carries readable text before any script runs (the scripts still set the same text);
  - writes the hreflang links (hr, sr, bs -> Croatian page; en, sr-ME, x-default -> English);
  - writes en/<path>/index.html: the same page with English language, head and links.
It also writes sitemap.xml.

Run after editing a Croatian page or a dictionary:  python tools/build_en.py
Every replacement must match exactly once; if a page changed so that one does not, the script
stops and names it.
"""

import html
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ORIGIN = "https://kalkulator.tabu.hr"

PAGES = [
    {
        "path": "/",
        "src": "index.html",
        "dict": ("inline", "index.html"),
        "head": {
            "description": "Free Tabu tools for individuals and business users: a gross to net salary "
            "calculator and an employee turnover cost calculator.",
            "og:title": "Tabu calculators",
            "og:description": "Free Tabu tools for individuals and business users.",
        },
        "replace": [
            ('href="/placa/"', 'href="/en/placa/"'),
            ('href="/turnover/"', 'href="/en/turnover/"'),
        ],
    },
    {
        "path": "/placa/",
        "src": "placa/index.html",
        "dict": ("module", "placa/i18n.js"),
        "head": {
            "description": "Gross to net, net to gross and employer cost for Croatia, Serbia and Bosnia "
            "and Herzegovina, including tax reliefs.",
            "og:title": "Gross to net salary calculator | Tabu",
            "og:description": "Gross to net, net to gross and employer cost for Croatia, Serbia and BiH.",
        },
        "replace": [
            ('src="app.js"', 'src="/placa/app.js"'),
            ('class="back" href="https://kalkulator.tabu.hr/"', 'class="back" href="/en/"'),
        ],
    },
    {
        "path": "/turnover/",
        "src": "turnover/index.html",
        "dict": ("inline", "turnover/index.html"),
        "head": {
            "description": "Estimate the true cost of an employee leaving - the vacancy, hiring, "
            "onboarding and more.",
            "og:title": "Employee Turnover Cost Calculator | Tabu",
            "og:description": "Estimate the true cost of an employee leaving - the vacancy, hiring, "
            "onboarding and more.",
        },
        "replace": [
            ('class="back" href="https://kalkulator.tabu.hr/"', 'class="back" href="/en/"'),
            ('id="cta" href="https://www.tabu.hr/poslovni"', 'id="cta" href="https://www.tabu.hr/en/poslovni"'),
        ],
    },
]

STRING = re.compile(r"(\w+)\s*:\s*'((?:[^'\\]|\\.)*)'")


def fail(msg):
    sys.exit(f"build_en: {msg}")


def strings(block):
    return {k: re.sub(r"\\(.)", r"\1", v) for k, v in STRING.findall(block)}


def dictionaries(kind, file):
    text = (ROOT / file).read_text(encoding="utf-8")
    if kind == "module":
        out = {}
        for lang, name in (("hr", "HR"), ("en", "EN")):
            m = re.search(r"\nconst " + name + r" = \{(.*?)\n\};", text, re.S)
            if not m:
                fail(f"{file}: const {name} not found")
            out[lang] = strings(m.group(1))
        out["en"] = {**out["hr"], **out["en"]}
        return out
    m = re.search(r"const I18N = \{(.*?)\n\};", text, re.S)
    if not m:
        fail(f"{file}: const I18N not found")
    body = m.group(1)
    starts = list(re.finditer(r"\n\s*(hr|en)\s*:\s*\{", body))
    if sorted(s.group(1) for s in starts) != ["en", "hr"]:
        fail(f"{file}: expected one hr and one en block in I18N")
    out = {}
    for i, s in enumerate(starts):
        end = starts[i + 1].start() if i + 1 < len(starts) else len(body)
        out[s.group(1)] = strings(body[s.end():end])
    return out


def fill_text(page, words):
    def sub(m):
        key = m.group(3)
        if key not in words:
            return m.group(0)
        return m.group(1) + html.escape(words[key], quote=False) + m.group(5)

    return re.sub(r'(<(\w+)\b[^>]*\sdata-i18n="(\w+)"[^>]*>)([^<]*)(</\2>)', sub, page)


def hreflang(path):
    hr, en = ORIGIN + path, ORIGIN + "/en" + path
    rows = [("hr", hr), ("sr", hr), ("bs", hr), ("en", en), ("sr-ME", en), ("x-default", en)]
    return "".join(f'<link rel="alternate" hreflang="{code}" href="{url}">\n' for code, url in rows)


def set_hreflang(page, path):
    page = re.sub(r'<link rel="alternate" hreflang="[^"]*" href="[^"]*">\n', "", page)
    canonical = re.search(r'<link rel="canonical" href="[^"]*">\n', page)
    if not canonical:
        fail(f"{path}: no canonical link")
    return page[: canonical.end()] + hreflang(path) + page[canonical.end():]


def replace_once(page, old, new, where):
    if page.count(old) != 1:
        fail(f"{where}: expected exactly one {old!r}, found {page.count(old)}")
    return page.replace(old, new)


def set_attr(page, pattern, value, where):
    found = re.findall(pattern, page)
    if len(found) != 1:
        fail(f"{where}: expected exactly one match for {pattern!r}, found {len(found)}")
    return re.sub(pattern, lambda m: m.group(1) + html.escape(value) + m.group(3), page)


def english(page, cfg, words):
    where = "en" + cfg["path"]
    url = ORIGIN + "/en" + cfg["path"]
    page = replace_once(page, '<html lang="hr">', '<html lang="en">', where)
    page = replace_once(
        page, "<!DOCTYPE html>\n",
        f"<!DOCTYPE html>\n<!-- Generated from {cfg['src']} by tools/build_en.py; edit the Croatian page. -->\n",
        where)
    page = set_attr(page, r"(<title>)([^<]*)(</title>)", words["doc_title"], where)
    page = set_attr(page, r'(<meta name="description" content=")([^"]*)(">)', cfg["head"]["description"], where)
    page = set_attr(page, r'(<link rel="canonical" href=")([^"]*)(">)', url, where)
    page = set_attr(page, r'(<meta property="og:url" content=")([^"]*)(">)', url, where)
    page = set_attr(page, r'(<meta property="og:title" content=")([^"]*)(">)', cfg["head"]["og:title"], where)
    page = set_attr(page, r'(<meta property="og:description" content=")([^"]*)(">)',
                    cfg["head"]["og:description"], where)
    page = page.replace('href="https://www.tabu.hr"', 'href="https://www.tabu.hr/en"')
    for old, new in cfg["replace"]:
        page = replace_once(page, old, new, where)
    return page


def main():
    urls = []
    for cfg in PAGES:
        src = ROOT / cfg["src"]
        words = dictionaries(*cfg["dict"])
        page = src.read_text(encoding="utf-8")
        page = set_hreflang(page, cfg["path"])
        if cfg["dict"][1] != cfg["src"]:
            page = fill_text(page, words["hr"])
        else:
            # Inline dictionaries live in the page itself; fill only the markup before the scripts.
            head, sep, tail = page.partition("<script src=\"/assets/lang.js\">")
            page = fill_text(head, words["hr"]) + sep + tail
        src.write_text(page, encoding="utf-8", newline="\n")

        head, sep, tail = page.partition("<script src=\"/assets/lang.js\">")
        en_page = english(fill_text(head, words["en"]) + sep + tail, cfg, words["en"])
        dst = ROOT / "en" / cfg["path"].strip("/") / "index.html"
        dst.parent.mkdir(parents=True, exist_ok=True)
        dst.write_text(en_page, encoding="utf-8", newline="\n")
        urls += [ORIGIN + cfg["path"], ORIGIN + "/en" + cfg["path"]]
        print(f"{cfg['src']} -> {dst.relative_to(ROOT).as_posix()}")

    sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    sitemap += "".join(f"  <url><loc>{u}</loc></url>\n" for u in urls) + "</urlset>\n"
    (ROOT / "sitemap.xml").write_text(sitemap, encoding="utf-8", newline="\n")
    print(f"sitemap.xml: {len(urls)} URLs")


if __name__ == "__main__":
    main()
