#!/usr/bin/env python3
"""Genera PDF comparativo con tablas e imágenes (reportlab)."""
from __future__ import annotations

import json
import statistics
from pathlib import Path

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
JSON_PATH = BASE / "datos_scrape.json"
CAP = BASE / "capturas"
OUT_PDF = BASE / "Informe_Comparativo_JYMX_vs_TiendaFX.pdf"


def median_bytes(rows: list[dict]) -> float:
    ok = [r["bytes"] for r in rows if "error" not in r]
    return statistics.median(ok) if ok else 0.0


def img_pair(left: Path, right: Path, label_left: str, label_right: str, max_w_cm: float = 7.8):
    """Dos capturas lado a lado con leyenda debajo."""
    max_w = max_w_cm * cm
    out = []
    li, ri = Image(str(left)), Image(str(right))
    for im in (li, ri):
        sc = max_w / im.imageWidth
        im.drawWidth = max_w
        im.drawHeight = im.imageHeight * sc
    tbl = Table([[li, ri]], colWidths=[max_w + 0.2 * cm, max_w + 0.2 * cm])
    tbl.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 4),
                ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ]
        )
    )
    out.append(tbl)
    styles = getSampleStyleSheet()
    cap = ParagraphStyle(
        "cap",
        parent=styles["Normal"],
        fontSize=8,
        textColor=colors.HexColor("#444444"),
        alignment=1,
    )
    out.append(Spacer(1, 0.15 * cm))
    out.append(
        Table(
            [
                [
                    Paragraph(f"<b>{label_left}</b><br/>{left.name}", cap),
                    Paragraph(f"<b>{label_right}</b><br/>{right.name}", cap),
                ]
            ],
            colWidths=[max_w + 0.2 * cm, max_w + 0.2 * cm],
        )
    )
    return out


def main():
    data = json.loads(JSON_PATH.read_text(encoding="utf-8"))
    sj = data["summary_jymxtribe_products_only"]
    sa = data["summary_jymxtribe_all_crawled"]
    st = data["summary_tiendafx"]
    meta = data["meta"]

    j_prod = [r for r in data["jymxtribe"] if "/producto/" in r.get("url", "")]
    t_prod = data["tiendafx"]

    med_j = median_bytes(j_prod)
    med_t = median_bytes([r for r in t_prod if "error" not in r])

    styles = getSampleStyleSheet()
    h1 = ParagraphStyle(
        "H1",
        parent=styles["Heading1"],
        fontSize=16,
        spaceAfter=12,
        textColor=colors.HexColor("#1a365d"),
    )
    h2 = ParagraphStyle(
        "H2",
        parent=styles["Heading2"],
        fontSize=12,
        spaceBefore=14,
        spaceAfter=8,
        textColor=colors.HexColor("#2c5282"),
    )
    small = ParagraphStyle("sm", parent=styles["Normal"], fontSize=8, textColor=colors.grey)

    doc = SimpleDocTemplate(
        str(OUT_PDF),
        pagesize=A4,
        leftMargin=1.8 * cm,
        rightMargin=1.8 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title="Informe comparativo tiendas",
    )
    story: list = []

    story.append(Paragraph("Informe comparativo de tiendas", h1))
    story.append(
        Paragraph(
            "<b>Fuxion Sites (JYMX Tribe)</b> vs <b>Tienda FX</b> &mdash; "
            f"Datos de scrape HTTP (HTML inicial, sin JS).<br/>"
            f"Fecha del informe: 1 de mayo de 2026.",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 0.4 * cm))
    story.append(
        Paragraph(
            f'<font size="9">• {meta["jymx_product_count_api"]} productos API: '
            f'https://jymxtribe.sites.fuxion.com/<br/>'
            f'• {meta["tiendafx_product_count_api"]} productos API: '
            f"https://tiendafx.com/</font>",
            styles["Normal"],
        )
    )
    story.append(PageBreak())

    # Tabla resumen cuantitativo
    story.append(Paragraph("1. Resumen cuantitativo (fichas de producto vía API)", h2))
    t1_data = [
        ["Métrica", "JYMX Tribe", "Tienda FX"],
        ["Productos en API", str(meta["jymx_product_count_api"]), str(meta["tiendafx_product_count_api"])],
        ["Tamaño HTML medio (bytes)", f"{sj['avg_bytes']:,}", f"{st['avg_bytes']:,}"],
        [
            "Tamaño HTML mediano (bytes)",
            f"{int(med_j):,}",
            f"{int(med_t):,}",
        ],
        [
            "Palabras texto aprox. (media)",
            str(sj["avg_words"]),
            str(st["avg_words"]),
        ],
        ["Etiquetas &lt;img&gt; (media)", str(sj["avg_img_tags"]), str(st["avg_img_tags"])],
        [
            "Páginas con indicador de vídeo*",
            f"{sj['with_video_indicator']}/{sj['pages']}",
            f"{st['with_video_indicator']}/{st['pages']}",
        ],
        [
            "Landings con bloque <i>fuxion-hero</i> (crawl+sitemap)",
            f"{sa['with_fuxion_hero']}/{sa['pages']}",
            str(st["with_fuxion_hero"]),
        ],
    ]
    t1 = Table(t1_data, colWidths=[6.2 * cm, 5.5 * cm, 5.5 * cm])
    t1.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#edf2f7")]),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#cbd5e0")),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 5),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(t1)
    story.append(Spacer(1, 0.25 * cm))
    story.append(
        Paragraph(
            "* Patrones en HTML: Vimeo/YouTube, &lt;video&gt;, widget Elementor vídeo. "
            "No implica reproducción sin ejecutar JS.",
            small,
        )
    )
    story.append(PageBreak())

    # Comparativas visuales específicas
    story.append(Paragraph("2. Comparativa visual: página de inicio", h2))
    story.append(
        Paragraph(
            "Misma ventana de captura (1440×2000 px, Chrome headless). "
            "JYMX: carrusel y catálogo Fuxion Sites; TFX: bloques Elementor y categorías con iconos.",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.extend(
        img_pair(
            CAP / "jymx-home.png",
            CAP / "tfx-home.png",
            "JYMX Tribe — inicio",
            "Tienda FX — inicio",
        )
    )
    story.append(PageBreak())

    story.append(Paragraph("3. Comparativa visual: Prunex (misma referencia de producto)", h2))
    story.append(
        Paragraph(
            "<b>Izquierda:</b> en JYMX la URL pública principal es una <b>landing</b> "
            "(<code>/prunex/</code>) con hero, beneficios y testimonios.<br/>"
            "<b>Derecha:</b> en Tienda FX la ficha está bajo <b>WooCommerce</b> "
            "(<code>/producto/prunex/</code>) con maquetación Elementor, upsells y sellos de pago.",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.extend(
        img_pair(
            CAP / "jymx-prunex-landing.png",
            CAP / "tfx-prunex-producto.png",
            "JYMX — /prunex/ (landing)",
            "TFX — /producto/prunex/",
        )
    )
    story.append(PageBreak())

    story.append(Paragraph("4. Comparativa visual: ficha catálogo Woo (Liquid Fiber)", h2))
    story.append(
        Paragraph(
            "Ambos sitios exponen el mismo producto vía ruta <code>/producto/liquid-fiber/</code>. "
            "Contraste de densidad visual, cabecera y bloque de compra.",
            styles["Normal"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.extend(
        img_pair(
            CAP / "jymx-producto-wc.png",
            CAP / "tfx-producto-wc.png",
            "JYMX — producto Woo",
            "TFX — producto Woo",
        )
    )
    story.append(PageBreak())

    # Tabla comparativa cualitativa detallada
    story.append(Paragraph("5. Tabla comparativa cualitativa (revisión específica)", h2))
    cell_style = ParagraphStyle(
        "cell",
        parent=styles["Normal"],
        fontSize=8,
        leading=10,
    )
    hdr = ParagraphStyle("hdr", parent=styles["Normal"], fontSize=9, textColor=colors.whitesmoke, fontName="Helvetica-Bold")
    qual = [
        [
            Paragraph("Aspecto", hdr),
            Paragraph("JYMX Tribe (Fuxion Sites)", hdr),
            Paragraph("Tienda FX", hdr),
        ],
        [
            Paragraph("Identidad en cabecera", cell_style),
            Paragraph(
                "Nombre del sitio en texto («Jorge Bena»); sin logo gráfico "
                "propio tipo TFX en el bloque principal.",
                cell_style,
            ),
            Paragraph(
                "Logo de marca en imagen (cropped-Logo-TFX.avif) y preload en home.",
                cell_style,
            ),
        ],
        [
            Paragraph("Dominio / hosting", cell_style),
            Paragraph(
                "Subdominio sites.fuxion.com (marca Fuxion Sites).",
                cell_style,
            ),
            Paragraph(
                "Dominio propio tiendafx.com (LiteSpeed / Hostinger en cabeceras HTTP).",
                cell_style,
            ),
        ],
        [
            Paragraph("Stack visible en HTML", cell_style),
            Paragraph(
                "Tema Shopire/Easybuy, plugin Fuxion, carrusel wf_slider, "
                "fable-extra (wishlist/compare).",
                cell_style,
            ),
            Paragraph(
                "Astra + Elementor, carrito lateral Xoo WSC, PixelYourSite (Facebook), ElementsKit.",
                cell_style,
            ),
        ],
        [
            Paragraph("Vídeo en fichas /producto/", cell_style),
            Paragraph(
                "11/27 con iframe Vimeo en pestaña tipo fu_video_tab "
                "(p. ej. prunex1, beauty-in).",
                cell_style,
            ),
            Paragraph(
                "<b>7/26</b> con widget Elementor vídeo, &lt;video&gt; o Vimeo según producto; "
                "<b>Prunex</b> sin indicadores en HTML.",
                cell_style,
            ),
        ],
        [
            Paragraph("Landings marketing", cell_style),
            Paragraph(
                "Varias URLs cortas (/prunex/, /vita/, …) con bloque <i>fuxion-hero</i> (7 en crawl).",
                cell_style,
            ),
            Paragraph(
                "Foco en /producto/; sin <i>fuxion-hero</i> en el conjunto analizado.",
                cell_style,
            ),
        ],
        [
            Paragraph("Prunex: dos experiencias", cell_style),
            Paragraph(
                "Landing rica en imagen/testimonios sin iframe vídeo en HTML; "
                "vídeo Vimeo en variante /producto/prunex1/.",
                cell_style,
            ),
            Paragraph(
                "Ficha principal /producto/prunex/ sin embed de vídeo en HTML estático.",
                cell_style,
            ),
        ],
        [
            Paragraph("Peso HTML", cell_style),
            Paragraph(
                "Fichas producto más livianas en mediana (~82 KB en API).",
                cell_style,
            ),
            Paragraph(
                "Mediana ~218 KB; media alta por páginas muy pesadas (CSS/JS inline).",
                cell_style,
            ),
        ],
    ]
    tq = Table(qual, colWidths=[3.6 * cm, 6.3 * cm, 6.3 * cm])
    tq.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2d3748")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7fafc")]),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#e2e8f0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(tq)
    story.append(Spacer(1, 0.5 * cm))
    story.append(Paragraph("6. Fuentes y limitaciones", h2))
    story.append(
        Paragraph(
            "• Datos detallados por URL: <i>datos_scrape.json</i> en la misma carpeta.<br/>"
            "• Capturas PNG: subcarpeta <i>capturas/</i>.<br/>"
            "• El scrape no ejecuta JavaScript; el contenido dinámico puede diferir del visto en navegador.<br/>"
            "• Los sitios pueden cambiar; conservar fecha del informe al citar resultados.",
            styles["Normal"],
        )
    )

    doc.build(story)
    print("PDF generado:", OUT_PDF)


if __name__ == "__main__":
    main()
