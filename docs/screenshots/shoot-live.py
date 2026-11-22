"""Render frontend screenshots for TriageDesk live verification.

Serves frontend/ over local HTTP and captures 360x844, 390x844 and
1440x900 in dark and light themes, plus two detail views with the
triaged report open. Waits for the live leaderboard row (read from the
deployed contract through genlayer-js) before each shot, so a shot
only counts when real on-chain data rendered. Prints horizontal
overflow and the rendered report title/score per shot.
"""
import http.server
import functools
import subprocess
import threading
import sys
from playwright.sync_api import sync_playwright

PORT = 8932
SHOTS = [
    ("360x844-dark", 360, 844, "dark"),
    ("360x844-light", 360, 844, "light"),
    ("390x844-dark", 390, 844, "dark"),
    ("390x844-light", 390, 844, "light"),
    ("1440x900-dark", 1440, 900, "dark"),
    ("1440x900-light", 1440, 900, "light"),
]
DETAIL_SHOTS = [
    ("1440x900-detail-dark", 1440, 900, "dark"),
    ("390x844-detail-dark", 390, 844, "dark"),
]


def check_live(page):
    page.wait_for_selector(".report-item", timeout=30000)
    title = page.text_content(".r-title")
    score = page.text_content(".report-score .num")
    total = page.text_content("#statTotal")
    triaged = page.text_content("#statTriaged")
    top = page.text_content("#statTop")
    return title, score, total, triaged, top


def rpc_fulfill(route):
    # The sandbox browser cannot open a tunnel through the egress proxy,
    # so the Studio RPC is fetched from this harness (curl works) and
    # fulfilled live. The response body is the real RPC answer for the
    # exact request the page sent, fetched at capture time.
    body = route.request.post_data or ""
    out = subprocess.run(
        ["curl", "-sS", "-m", "60", "-X", "POST",
         "-H", "Content-Type: application/json", "-d", body,
         "https://studio.genlayer.com/api"],
        capture_output=True, text=True, timeout=70,
    )
    route.fulfill(status=200, content_type="application/json", body=out.stdout)


def open_page(browser, w, h, theme):
    page = browser.new_page(viewport={"width": w, "height": h})
    page.route("**/studio.genlayer.com/api", rpc_fulfill)
    page.add_init_script(
        "localStorage.setItem('triagedesk-theme', '%s');" % theme
    )
    page.goto("http://127.0.0.1:%d/index.html" % PORT, wait_until="networkidle")
    return page


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
                page = open_page(browser, w, h, theme)
                title, score, total, triaged, top = check_live(page)
                page.wait_for_timeout(400)
                overflow = page.evaluate(
                    "document.documentElement.scrollWidth - document.documentElement.clientWidth"
                )
                page.screenshot(path="%s/%s.png" % (outdir, name), full_page=True)
                print(name, "overflow_px=", overflow, "title=", title, "score=", score, "total=", total, "triaged=", triaged, "top=", top)
                page.close()
            for name, w, h, theme in DETAIL_SHOTS:
                page = open_page(browser, w, h, theme)
                check_live(page)
                page.click(".report-item")
                page.wait_for_selector("#detailCard:not(.hidden)", timeout=15000)
                page.wait_for_timeout(400)
                overflow = page.evaluate(
                    "document.documentElement.scrollWidth - document.documentElement.clientWidth"
                )
                detail_total = page.text_content("#detailTotal")
                page.screenshot(path="%s/%s.png" % (outdir, name), full_page=True)
                print(name, "overflow_px=", overflow, "detail_total=", detail_total)
                page.close()
            browser.close()
    finally:
        srv.shutdown()


if __name__ == "__main__":
    main()
