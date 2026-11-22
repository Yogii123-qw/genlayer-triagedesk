"""Render frontend screenshots for TriageDesk verification.

Serves frontend/ over local HTTP and captures 360x844, 390x844 and
1440x900 in dark and light themes. Prints horizontal overflow per shot.
"""
import http.server
import functools
import threading
import sys
from playwright.sync_api import sync_playwright

PORT = 8931
SHOTS = [
    ("360x844-dark", 360, 844, "dark"),
    ("360x844-light", 360, 844, "light"),
    ("390x844-dark", 390, 844, "dark"),
    ("390x844-light", 390, 844, "light"),
    ("1440x900-dark", 1440, 900, "dark"),
    ("1440x900-light", 1440, 900, "light"),
]


def main():
    outdir = sys.argv[1]
    root = sys.argv[2]
    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
    srv = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), handler)
    t = threading.Thread(target=srv.serve_forever, daemon=True)
    t.start()
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            for name, w, h, theme in SHOTS:
                page = browser.new_page(viewport={"width": w, "height": h})
                page.add_init_script(
                    "localStorage.setItem('triagedesk-theme', '%s');" % theme
                )
                page.goto("http://127.0.0.1:%d/index.html" % PORT, wait_until="networkidle")
                page.wait_for_timeout(400)
                overflow = page.evaluate(
                    "document.documentElement.scrollWidth - document.documentElement.clientWidth"
                )
                page.screenshot(path="%s/%s.png" % (outdir, name), full_page=True)
                print(name, "overflow_px=", overflow)
                page.close()
            browser.close()
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
