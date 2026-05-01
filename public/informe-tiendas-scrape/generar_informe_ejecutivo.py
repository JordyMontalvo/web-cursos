#!/usr/bin/env python3
"""
Informe ejecutivo exhaustivo para dirección: capturas Chrome + PDF con tablas e imágenes.
Requisitos: Google Chrome, venv con reportlab y pillow (./.venv).
"""
from __future__ import annotations

import io
import json
import shutil
import subprocess
import sys
from pathlib import Path

from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    Image,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

BASE = Path(__file__).resolve().parent
RAW = BASE / "capturas_ejecutivo" / "raw"
ASSETS = BASE / "capturas_ejecutivo" / "pdf_assets"
JSON_PATH = BASE / "datos_scrape.json"
OUT_PDF = BASE / "Informe_Ejecutivo_JYMX_vs_TiendaFX.pdf"
# Límite por imagen para que quepan dos columnas en A4 (marco ~498 pt alto).
MAX_IMG_W_PT = 230.0
MAX_IMG_H_PT = 300.0

SHOTS: list[tuple[str, str, int, int]] = [
    ("01_jymx_home", "https://jymxtribe.sites.fuxion.com/", 1440, 5200),
    ("02_tfx_home", "https://tiendafx.com/", 1440, 5200),
    ("03_jymx_tienda", "https://jymxtribe.sites.fuxion.com/tienda/", 1440, 4200),
    ("04_tfx_cat_desintoxicacion", "https://tiendafx.com/categoria-producto/desintoxicacion/", 1440, 4200),
    ("05_jymx_cat_sin_cat", "https://jymxtribe.sites.fuxion.com/categoria-producto/sin-categorizar/", 1440, 3800),
    ("06_tfx_nosotros", "https://tiendafx.com/nosotros/", 1440, 4500),
    ("07_tfx_contacto", "https://tiendafx.com/contacto/", 1440, 4500),
    ("08_jymx_carrito", "https://jymxtribe.sites.fuxion.com/carrito/", 1440, 2800),
    ("09_tfx_cart", "https://tiendafx.com/cart/", 1440, 2800),
    ("10_jymx_beauty_in", "https://jymxtribe.sites.fuxion.com/producto/beauty-in/", 1440, 6200),
    ("11_tfx_beauty_in", "https://tiendafx.com/producto/beauty-in/", 1440, 6200),
    ("12_jymx_prunex_landing", "https://jymxtribe.sites.fuxion.com/prunex/", 1440, 6500),
    ("13_tfx_prunex", "https://tiendafx.com/producto/prunex/", 1440, 6200),
    ("14_jymx_liquid_fiber", "https://jymxtribe.sites.fuxion.com/producto/liquid-fiber/", 1440, 5200),
    ("15_tfx_liquid_fiber", "https://tiendafx.com/producto/liquid-fiber/", 1440, 5200),
]


def find_chrome() -> str:
    for p in (
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ):
        if Path(p).is_file():
            return p
    return ""


def chrome_shot(chrome: str, name: str, url: str, w: int, h: int) -> Path:
    RAW.mkdir(parents=True, exist_ok=True)
    out = RAW / f"{name}.png"
    cmd = [
        chrome,
        "--headless=new",
        "--disable-gpu",
        "--hide-scrollbars",
        f"--window-size={w},{h}",
        "--virtual-time-budget=12000",
        f"--screenshot={out}",
        url,
    ]
    subprocess.run(cmd, check=True, capture_output=True, timeout=120)
    if not out.is_file() or out.stat().st_size < 5000:
        raise RuntimeError(f"Captura fallida o vacía: {out}")
    return out


def to_pdf_asset(png: Path, name: str) -> Path:
    ASSETS.mkdir(parents=True, exist_ok=True)
    dest = ASSETS / f"{name}.jpg"
    im = PILImage.open(png).convert("RGB")
    max_w = 1100
    if im.width > max_w:
        ratio = max_w / im.width
        im = im.resize((max_w, int(im.height * ratio)), PILImage.Resampling.LANCZOS)
    im.save(dest, "JPEG", quality=80, optimize=True)
    return dest


def rl_image(jpg: Path) -> Image:
    im = PILImage.open(jpg)
    iw, ih = im.size
    sc = min(MAX_IMG_W_PT / float(iw), MAX_IMG_H_PT / float(ih))
    return Image(str(jpg), width=iw * sc, height=ih * sc)


def pair_row(left: Path, right: Path, cap_left: str, cap_right: str, styles) -> list:
    sm = ParagraphStyle("sm", parent=styles["Normal"], fontSize=7.5, textColor=colors.HexColor("#4a5568"))
    cw = MAX_IMG_W_PT + 12
    tbl = Table(
        [[rl_image(left), rl_image(right)]],
        colWidths=[cw, cw],
    )
    tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ]
        )
    )
    cap = Table(
        [
            [
                Paragraph(f"<b>{cap_left}</b><br/><i>{left.name}</i>", sm),
                Paragraph(f"<b>{cap_right}</b><br/><i>{right.name}</i>", sm),
            ]
        ],
        colWidths=[cw, cw],
    )
    return [tbl, Spacer(1, 0.12 * cm), cap, Spacer(1, 0.35 * cm)]


def main():
    skip = "--solo-pdf" in sys.argv
    chrome = find_chrome()
    if not skip:
        if not chrome:
            print("No se encontró Chrome/Chromium.", file=sys.stderr)
            sys.exit(1)
        RAW.mkdir(parents=True, exist_ok=True)
        ASSETS.mkdir(parents=True, exist_ok=True)
        print("Capturando", len(SHOTS), "páginas…")
        for name, url, w, h in SHOTS:
            print(" ", name, url)
            png = chrome_shot(chrome, name, url, w, h)
            to_pdf_asset(png, name)
        print("Assets JPG en", ASSETS)
    else:
        missing = [s[0] for s in SHOTS if not (ASSETS / f"{s[0]}.jpg").is_file()]
        if missing:
            print("Faltan JPG:", missing, file=sys.stderr)
            sys.exit(1)
        print("Modo --solo-pdf: usando assets existentes.")

    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    sj = data["summary_jymxtribe_products_only"]
    st = data["summary_tiendafx"]
    sa = data["summary_jymxtribe_all_crawled"]
    meta = data["meta"]

    styles = getSampleStyleSheet()
    title = ParagraphStyle(
        "T",
        parent=styles["Heading1"],
        fontSize=18,
        textColor=colors.HexColor("#1a365d"),
        spaceAfter=10,
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=12.5,
        textColor=colors.HexColor("#2c5282"),
        spaceBefore=10,
        spaceAfter=8,
    )
    h3 = ParagraphStyle(
        "H3",
        parent=styles["Heading3"],
        fontSize=10.5,
        textColor=colors.HexColor("#2d3748"),
        spaceBefore=6,
        spaceAfter=5,
    )
    cell = ParagraphStyle(
        "cell",
        parent=styles["Normal"],
        fontSize=7.5,
        leading=9,
    )
    hdr = ParagraphStyle(
        "hdr",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.white,
        fontName="Helvetica-Bold",
    )

    story: list = []
    story.append(Paragraph("Informe ejecutivo — comparativa de tiendas online", title))
    story.append(
        Paragraph(
            "<b>Objetivo:</b> documento para dirección con evidencia visual y hallazgos técnicos "
            "entre el sitio <b>Fuxion Sites (JYMX Tribe)</b> y <b>Tienda FX</b>.<br/>"
            "<b>Fecha:</b> 1 de mayo de 2026. <b>Método:</b> capturas headless + revisión de HTML público "
            "(sin sesión de usuario; checkout con carrito vacío redirige en ambos casos).",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 0.35 * cm))

    # Resumen bullets jefe
    story.append(Paragraph("Síntesis para decisión", h2))
    bullets = (
        "<b>Identidad:</b> JYMX usa título textual en cabecera; TFX logo gráfico de marca.<br/>"
        "<b>Catálogo / marketing:</b> JYMX combina landings en raíz (<code>/prunex/</code>, etc.) "
        "con fichas <code>/producto/</code>; TFX concentra comercial en <code>/producto/</code> + "
        "archivos de categoría con iconografía.<br/>"
        "<b>Vídeo en producto:</b> JYMX — pestaña <code>fu_video_tab</code> + Vimeo en 11/27 productos API; "
        "TFX — widgets Elementor / &lt;video&gt; en 7/26; <b>Prunex</b> sin embed en TFX, sí en variante "
        "<code>/producto/prunex1/</code> en JYMX.<br/>"
        "<b>Experiencia carrito:</b> TFX integra <b>Xoo Side Cart</b> (panel lateral) en todo el sitio; "
        "JYMX carrito clásico + <b>wishlist/compare</b> (fable-extra) y botón flotante <b>WhatsApp</b> "
        "(tema Fuxion).<br/>"
        "<b>Institucional:</b> TFX expone <code>/nosotros/</code> y <code>/contacto/</code> en menú; "
        "JYMX no muestra equivalente en el home analizado.<br/>"
        "<b>Peso de página:</b> mediana HTML mayor en TFX; medias infladas por CSS/JS agregados (LiteSpeed)."
    )
    story.append(Paragraph(bullets, styles["Normal"]))
    story.append(PageBreak())

    # Tabla cuantitativa
    story.append(Paragraph("Anexo A — métricas del scrape automatizado (API + HTML)", h2))
    tq = [
        ["Métrica", "JYMX", "Tienda FX"],
        ["Productos (REST)", str(meta["jymx_product_count_api"]), str(meta["tiendafx_product_count_api"])],
        ["Tamaño HTML medio (productos)", f"{sj['avg_bytes']:,} B", f"{st['avg_bytes']:,} B"],
        ["Palabras texto (media)", str(sj["avg_words"]), str(st["avg_words"])],
        ["Etiquetas img (media)", str(sj["avg_img_tags"]), str(st["avg_img_tags"])],
        ["Indicador vídeo en HTML", f"{sj['with_video_indicator']}/{sj['pages']}", f"{st['with_video_indicator']}/{st['pages']}"],
        ["Landings fuxion-hero (crawl+sitemap)", f"{sa['with_fuxion_hero']}/{sa['pages']}", str(st["with_fuxion_hero"])],
    ]
    t = Table(tq, colWidths=[6.8 * cm, 5.2 * cm, 5.2 * cm])
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.4, colors.HexColor("#cbd5e0")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7fafc")]),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t)
    story.append(Spacer(1, 0.4 * cm))

    # Tabla exhaustiva cualitativa
    story.append(Paragraph("Anexo B — inventario comparativo (exhaustivo)", h2))
    rows = [
        [Paragraph("Dimensión", hdr), Paragraph("JYMX Tribe", hdr), Paragraph("Tienda FX", hdr)],
        [
            Paragraph("Dominio / plataforma", cell),
            Paragraph("Subdominio Fuxion Sites.", cell),
            Paragraph("Dominio propio; LiteSpeed/Hostinger.", cell),
        ],
        [
            Paragraph("Cabecera / marca", cell),
            Paragraph("Identificador textual «Jorge Bena».", cell),
            Paragraph("Logo imagen TFX + menú Elementor/ElementsKit.", cell),
        ],
        [
            Paragraph("Home — promoción", cell),
            Paragraph("Carrusel <i>wf_slider</i> campañas Fuxion.", cell),
            Paragraph("Bloques valor + categorías con iconos ilustrados.", cell),
        ],
        [
            Paragraph("Home — utilidades", cell),
            Paragraph("Wishlist y comparador (fable-extra); búsqueda con categoría.", cell),
            Paragraph("Carrito lateral Xoo WSC; PixelYourSite (Meta).", cell),
        ],
        [
            Paragraph("Home — contenido editorial", cell),
            Paragraph("Bloque Blog &amp; News (entrada por defecto WP visible).", cell),
            Paragraph("Sección testimonios clientes.", cell),
        ],
        [
            Paragraph("Institucional", cell),
            Paragraph("Sin «Nosotros/Contacto» destacados en menú del home analizado.", cell),
            Paragraph("Páginas <code>/nosotros/</code> y <code>/contacto/</code> (form Elementor, campo WhatsApp).", cell),
        ],
        [
            Paragraph("WhatsApp", cell),
            Paragraph("Botón flotante <code>fx-whatsapp-float</code> → wa.me (visto en carrito/checkout assets).", cell),
            Paragraph("Captación vía formulario (placeholder WhatsApp), no mismo botón flotante.", cell),
        ],
        [
            Paragraph("Listado tienda", cell),
            Paragraph("Página <code>/tienda/</code> (Shopire).", cell),
            Paragraph("Archivos por categoría de necesidad (p. ej. desintoxicación).", cell),
        ],
        [
            Paragraph("Archivo categoría producto", cell),
            Paragraph("Taxonomía «Sin categorizar» (placeholder).", cell),
            Paragraph("Categorías reales con copy comercial.", cell),
        ],
        [
            Paragraph("URL marketing producto", cell),
            Paragraph("Landings en raíz: <code>/prunex/</code>, <code>/vita/</code>… + <code>fuxion-hero</code>.", cell),
            Paragraph("Comercial principalmente bajo <code>/producto/</code>.", cell),
        ],
        [
            Paragraph("Vídeo en ficha", cell),
            Paragraph("Pestaña Woo <code>fu_video_tab</code> + iframe Vimeo (muestra: Beauty-In).", cell),
            Paragraph("Widget Elementor vídeo / &lt;video&gt; según SKU (Beauty-In sí).", cell),
        ],
        [
            Paragraph("Sellos confianza checkout", cell),
            Paragraph("Mercado Pago (plugin) + estilos tema.", cell),
            Paragraph("Mercado Pago + bloques confianza en fichas (MP, pagos seguros).", cell),
        ],
        [
            Paragraph("Carrito vacío → checkout", cell),
            Paragraph("<code>/finalizar-compra/</code> redirige a <code>/carrito/</code> sin ítems.", cell),
            Paragraph("Checkout canónico redirige a <code>/cart/</code> vacío (mismo patrón).", cell),
        ],
        [
            Paragraph("Etiquetas sobre foto", cell),
            Paragraph("No se observó Advanced Woo Labels en muestras.", cell),
            Paragraph("Etiquetas tipo «Yacón + fibra…» (Advanced Woo Labels) en varias fichas.", cell),
        ],
        [
            Paragraph("Rendimiento HTML", cell),
            Paragraph("Fichas producto ~80 KB mediana (API).", cell),
            Paragraph("HTML más pesado (CSS/JS inline agresivo); outliers &gt;4 MB.", cell),
        ],
        [
            Paragraph("Plugins distintivos", cell),
            Paragraph("fuxion-plugin, fable-extra, shopire, owl, elementor puntual.", cell),
            Paragraph("Astra, Elementor, LiteSpeed, ElementsKit, Xoo WSC, Ultimate Elementor, PYS.", cell),
        ],
    ]
    big = Table(rows, colWidths=[3.5 * cm, 6.35 * cm, 6.35 * cm])
    big.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a202c")),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
            ]
        )
    )
    story.append(big)
    story.append(PageBreak())

    # --- Secciones visuales ---
    def sec(num: str, tit: str, desc: str):
        story.append(Paragraph(f"{num} {tit}", h2))
        story.append(Paragraph(desc, styles["Normal"]))
        story.append(Spacer(1, 0.25 * cm))

    A = ASSETS

    sec("I", "Portales de inicio", "Primera impresión: carrusel y blog vs bloques de valor y categorías icónicas.")
    story.extend(pair_row(A / "01_jymx_home.jpg", A / "02_tfx_home.jpg", "JYMX — home", "TFX — home", styles))
    story.append(PageBreak())

    sec(
        "II",
        "Listados comerciales",
        "JYMX página «Tienda» frente a archivo de categoría en TFX (desintoxicación). "
        "No son la misma taxonomía; sirve para contrastar densidad de información y navegación.",
    )
    story.extend(pair_row(A / "03_jymx_tienda.jpg", A / "04_tfx_cat_desintoxicacion.jpg", "JYMX — /tienda/", "TFX — categoría", styles))
    story.append(PageBreak())

    sec(
        "III",
        "Archivos de categoría Woo",
        "Mismo tipo de plantilla de archivo: JYMX taxonomía genérica vs TFX categoría comercial.",
    )
    story.extend(pair_row(A / "05_jymx_cat_sin_cat.jpg", A / "04_tfx_cat_desintoxicacion.jpg", "JYMX — sin categorizar", "TFX — desintoxicación", styles))
    story.append(PageBreak())

    sec("IV", "Carrito vacío", "Flujo estándar WooCommerce; TFX mantiene cabecera con carrito lateral.")
    story.extend(pair_row(A / "08_jymx_carrito.jpg", A / "09_tfx_cart.jpg", "JYMX — carrito", "TFX — cart", styles))
    story.append(PageBreak())

    sec(
        "V",
        "Mismo SKU — Beauty-In (vídeo)",
        "JYMX: pestaña de vídeo Fuxion + Vimeo embebido. TFX: maquetación Elementor con widget de vídeo.",
    )
    story.extend(pair_row(A / "10_jymx_beauty_in.jpg", A / "11_tfx_beauty_in.jpg", "JYMX — /producto/beauty-in/", "TFX — /producto/beauty-in/", styles))
    story.append(PageBreak())

    sec(
        "VI",
        "Prunex — dos modelos de venta",
        "JYMX landing de storytelling vs ficha de e-commerce TFX con upsells y sellos.",
    )
    story.extend(pair_row(A / "12_jymx_prunex_landing.jpg", A / "13_tfx_prunex.jpg", "JYMX — /prunex/", "TFX — /producto/prunex/", styles))
    story.append(PageBreak())

    sec(
        "VII",
        "Mismo SKU — Liquid Fiber (ficha catálogo)",
        "Comparación de ficha «clásica» en ambos sitios.",
    )
    story.extend(pair_row(A / "14_jymx_liquid_fiber.jpg", A / "15_tfx_liquid_fiber.jpg", "JYMX — Liquid Fiber", "TFX — Liquid Fiber", styles))
    story.append(PageBreak())

    story.append(Paragraph("VIII Presencia institucional (solo Tienda FX)", h2))
    story.append(
        Paragraph(
            "JYMX no ofrece en el menú principal las páginas corporativas equivalentes "
            "detectadas en TFX. Se documentan ambas para contexto de marca y captación de leads.",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 0.25 * cm))
    story.extend(pair_row(A / "06_tfx_nosotros.jpg", A / "07_tfx_contacto.jpg", "TFX — Nosotros", "TFX — Contacto", styles))

    story.append(Spacer(1, 0.6 * cm))
    story.append(Paragraph("Cierre y responsabilidad de datos", h3))
    story.append(
        Paragraph(
            "Las capturas reflejan el estado público del sitio en la fecha indicada. "
            "Contenidos dinámicos (precios, stock, A/B tests) pueden variar. "
            "Los datos numéricos provienen de <i>datos_scrape.json</i> generado por <i>analizar_tiendas.py</i>.",
            styles["Normal"],
        )
    )

    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        leftMargin=1.5 * cm,
        rightMargin=1.5 * cm,
        topMargin=1.2 * cm,
        bottomMargin=1.2 * cm,
        title="Informe ejecutivo comparativa tiendas",
    )
    doc.build(story)
    print("PDF:", OUT_PDF, "tamaño", OUT_PDF.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
