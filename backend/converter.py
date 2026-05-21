"""
Core conversion logic: Playwright renders PDF, PyMuPDF injects link annotations.
Reused from html_to_pdf_linked.py — now as a reusable module.

Performance: Browser is kept alive as a singleton — avoids ~3-4s cold start per conversion.
"""

import os
import tempfile
import atexit
from html.parser import HTMLParser
from playwright.sync_api import sync_playwright, Playwright, Browser
import fitz  # PyMuPDF


# ── Persistent browser singleton ──
_playwright: Playwright | None = None
_browser: Browser | None = None


def _get_browser() -> Browser:
    """Launch browser once, reuse for all conversions."""
    global _playwright, _browser
    if _browser is None or not _browser.is_connected():
        _playwright = sync_playwright().start()
        _browser = _playwright.chromium.launch()
    return _browser


def _shutdown_browser():
    global _playwright, _browser
    if _browser:
        _browser.close()
    if _playwright:
        _playwright.stop()


atexit.register(_shutdown_browser)


class LinkExtractor(HTMLParser):
    """Extract <a href="url">text</a> pairs from HTML."""

    def __init__(self):
        super().__init__()
        self.links = []
        self._current_href = None
        self._current_text = ""

    def handle_starttag(self, tag, attrs):
        if tag == "a":
            attrs_dict = dict(attrs)
            href = attrs_dict.get("href", "")
            if href and href.startswith("http"):
                self._current_href = href
                self._current_text = ""

    def handle_data(self, data):
        if self._current_href is not None:
            self._current_text += data

    def handle_endtag(self, tag):
        if tag == "a" and self._current_href is not None:
            text = self._current_text.strip()
            if text:
                self.links.append((self._current_href, text))
            self._current_href = None
            self._current_text = ""


def extract_links(html_content: str) -> list[tuple[str, str]]:
    """Extract (url, text) pairs from HTML."""
    extractor = LinkExtractor()
    extractor.feed(html_content)
    return extractor.links


def render_pdf_with_playwright(html_content: str, output_path: str) -> None:
    """Render HTML to PDF using persistent browser (fast — no cold start)."""
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w", encoding="utf-8") as f:
        f.write(html_content)
        temp_html = f.name

    try:
        file_url = "file:///" + temp_html.replace("\\", "/")
        browser = _get_browser()
        page = browser.new_page()
        page.goto(file_url, wait_until="domcontentloaded")
        page.wait_for_timeout(500)  # Brief settle for fonts/CSS variables
        page.pdf(
            path=output_path,
            format="Letter",
            print_background=True,
            prefer_css_page_size=True,
        )
        page.close()
    finally:
        os.unlink(temp_html)


def inject_links(pdf_path: str, links: list[tuple[str, str]], output_path: str) -> dict:
    """Find link text in PDF and inject clickable URI annotations."""
    doc = fitz.open(pdf_path)
    injected = 0
    not_found = []

    for url, text in links:
        found = False
        for page_num in range(len(doc)):
            page = doc[page_num]
            text_instances = page.search_for(text)
            if text_instances:
                for rect in text_instances:
                    link = {
                        "kind": fitz.LINK_URI,
                        "from": rect,
                        "uri": url,
                    }
                    page.insert_link(link)
                    injected += 1
                    found = True
                break
        if not found:
            short_text = text[:40] if len(text) > 40 else None
            if short_text:
                for page_num in range(len(doc)):
                    page = doc[page_num]
                    text_instances = page.search_for(short_text)
                    if text_instances:
                        for rect in text_instances:
                            link = {
                                "kind": fitz.LINK_URI,
                                "from": rect,
                                "uri": url,
                            }
                            page.insert_link(link)
                            injected += 1
                            found = True
                        break
            if not found:
                not_found.append({"url": url, "text": text[:60]})

    doc.save(output_path)
    doc.close()

    return {
        "total_links": len(links),
        "injected": injected,
        "not_found": not_found,
    }


def convert_html_to_pdf(html_content: str, output_path: str) -> dict:
    """Full pipeline: render PDF + inject links."""
    links = extract_links(html_content)

    temp_pdf = output_path + ".tmp"
    render_pdf_with_playwright(html_content, temp_pdf)

    if links:
        result = inject_links(temp_pdf, links, output_path)
        os.unlink(temp_pdf)
    else:
        os.rename(temp_pdf, output_path)
        result = {"total_links": 0, "injected": 0, "not_found": []}

    return result
