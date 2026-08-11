#!/usr/bin/env python3
"""Scrape superficial + métricas HTML para informe comparativo (sin ejecutar JS)."""
import json
import re
import time
import urllib.request
from html.parser import HTMLParser
from xml.etree import ElementTree as ET

JYM = "https://jymxtribe.sites.fuxion.com"
TFX = "https://tiendafx.com"
UA = "Mozilla/5.0 (compatible; InformeScrape/1.0; +research)"


def fetch(url: str, timeout=35) -> tuple[str, int]:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        raw = r.read()
        return raw.decode("utf-8", "replace"), len(raw)


def strip_html(html: str) -> str:
    class P(HTMLParser):
        def __init__(self):
            super().__init__()
            self.parts: list[str] = []

        def handle_data(self, d):
            if d.strip():
                self.parts.append(d)

    p = P()
    try:
        p.feed(html)
    except Exception:
        pass
    return " ".join(p.parts)


def analyze(url: str, html: str, nbytes: int) -> dict:
    low = html.lower()
    body = low.split("<body", 1)[-1] if "<body" in low else low
    title_m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
    title = title_m.group(1).strip() if title_m else ""
    text = strip_html(html)
    words = len(text.split())

    vid_patterns = [
        r"youtube\.com/embed",
        r"youtu\.be/",
        r"vimeo\.com/video",
        r"<video[\s>]",
        r"elementor-widget-video",
        r"wp-block-embed-youtube",
    ]
    video_hits = [p for p in vid_patterns if re.search(p, body, re.I)]

    return {
        "url": url,
        "bytes": nbytes,
        "title": title,
        "words_visible_text_approx": words,
        "img_tags": len(re.findall(r"<img\b", html, re.I)),
        "has_fuxion_hero": "fuxion-hero" in body,
        "has_elementor": "elementor-element" in body,
        "has_woocommerce_product": "woocommerce" in body and (
            "single-product" in body or "product-type-simple" in body or "add_to_cart" in body
        ),
        "video_indicators": video_hits,
        "has_video_risk": len(video_hits) > 0,
        "og_image": (re.search(
            r'<meta\s+property=["\']og:image["\']\s+content=["\']([^"\']+)["\']',
            html,
            re.I,
        ).group(1) if re.search(
            r'<meta\s+property=["\']og:image["\']', html, re.I
        ) else None),
    }


def jymx_extra_urls() -> list[str]:
    out = []
    for path in (
        "wp-sitemap-posts-page-1.xml",
        "wp-sitemap-posts-product-1.xml",
    ):
        xml, _ = fetch(f"{JYM}/{path}")
        root = ET.fromstring(xml)
        ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        for loc in root.findall(".//sm:loc", ns):
            if loc.text:
                out.append(loc.text.strip())
    return sorted(set(out))


def main():
    results = {"jymxtribe": [], "tiendafx": [], "meta": {}}

    with urllib.request.urlopen(
        urllib.request.Request(f"{JYM}/wp-json/wp/v2/product?per_page=100", headers={"User-Agent": UA})
    ) as r:
        jproducts = json.load(r)
    with urllib.request.urlopen(
        urllib.request.Request(f"{TFX}/wp-json/wp/v2/product?per_page=100", headers={"User-Agent": UA})
    ) as r:
        tproducts = json.load(r)

    j_urls = sorted({p["link"] for p in jproducts})
    t_urls = sorted({p["link"] for p in tproducts})
    j_landings = [u for u in jymx_extra_urls() if "/producto/" not in u and u.rstrip("/") not in (JYM, f"{JYM}/")]

    results["meta"] = {
        "jymx_product_count_api": len(j_urls),
        "tiendafx_product_count_api": len(t_urls),
        "jymx_extra_sitemap_urls": len(jymx_extra_urls()),
        "jymx_landing_pages_sampled": [u for u in j_landings if u.count("/") <= 4][:20],
    }

    def run_batch(label: str, urls: list[str], delay: float = 0.35):
        bucket = []
        for i, url in enumerate(urls):
            try:
                html, nb = fetch(url)
                bucket.append(analyze(url, html, nb))
            except Exception as e:
                bucket.append({"url": url, "error": str(e)})
            if i and i % 10 == 0:
                time.sleep(delay)
        results[label] = bucket

    run_batch("jymxtribe", j_urls + [u for u in jymx_extra_urls() if u not in j_urls])
    run_batch("tiendafx", t_urls)

    # Resúmenes agregados
    def summarize(rows: list[dict]) -> dict:
        ok = [r for r in rows if "error" not in r]
        if not ok:
            return {}
        return {
            "pages": len(ok),
            "avg_bytes": round(sum(r["bytes"] for r in ok) / len(ok)),
            "avg_words": round(sum(r["words_visible_text_approx"] for r in ok) / len(ok)),
            "avg_img_tags": round(sum(r["img_tags"] for r in ok) / len(ok)),
            "with_video_indicator": sum(1 for r in ok if r.get("has_video_risk")),
            "with_fuxion_hero": sum(1 for r in ok if r.get("has_fuxion_hero")),
        }

    results["summary_jymxtribe_products_only"] = summarize(
        [r for r in results["jymxtribe"] if "/producto/" in r.get("url", "")]
    )
    results["summary_jymxtribe_all_crawled"] = summarize(results["jymxtribe"])
    results["summary_tiendafx"] = summarize(results["tiendafx"])

    out_path = "/Users/jordymontalvo/proyectos/Documents/web-cursos/web-cursos/public/informe-tiendas-scrape/datos_scrape.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print("Wrote", out_path)
    print(json.dumps({k: v for k, v in results.items() if k.startswith("summary")}, indent=2))


if __name__ == "__main__":
    main()
