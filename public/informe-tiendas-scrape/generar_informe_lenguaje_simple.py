#!/usr/bin/env python3
"""
Informe en lenguaje sencillo (sin términos de programación).
Reutiliza las imágenes JPG en capturas_ejecutivo/pdf_assets/ (generadas antes con generar_informe_ejecutivo.py).

Uso:
  .venv/bin/python generar_informe_lenguaje_simple.py
  (Si faltan JPG, ejecutar antes generar_informe_ejecutivo.py sin --solo-pdf)
"""
from __future__ import annotations

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
ASSETS = BASE / "capturas_ejecutivo" / "pdf_assets"
OUT = BASE / "Informe_Comparativa_Lenguaje_Sencillo.pdf"

MAX_IMG_W_PT = 220.0
MAX_IMG_H_PT = 280.0


def rl_image(jpg: Path) -> Image:
    im = PILImage.open(jpg)
    iw, ih = im.size
    sc = min(MAX_IMG_W_PT / float(iw), MAX_IMG_H_PT / float(ih))
    return Image(str(jpg), width=iw * sc, height=ih * sc)


def pair_row(left: Path, right: Path, cap_left: str, cap_right: str, styles) -> list:
    cw = MAX_IMG_W_PT + 14
    sm = ParagraphStyle("sm", parent=styles["Normal"], fontSize=8, textColor=colors.HexColor("#4a5568"))
    tbl = Table([[rl_image(left), rl_image(right)]], colWidths=[cw, cw])
    tbl.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (0, 0), (-1, -1), "CENTER")]))
    cap = Table(
        [
            [
                Paragraph(f"<b>{cap_left}</b><br/><i>{left.name}</i>", sm),
                Paragraph(f"<b>{cap_right}</b><br/><i>{right.name}</i>", sm),
            ]
        ],
        colWidths=[cw, cw],
    )
    return [tbl, Spacer(1, 0.1 * cm), cap, Spacer(1, 0.35 * cm)]


def P(txt: str, style) -> Paragraph:
    return Paragraph(txt.replace("\n", "<br/>"), style)


def main():
    needed = [
        "01_jymx_home.jpg",
        "02_tfx_home.jpg",
        "03_jymx_tienda.jpg",
        "04_tfx_cat_desintoxicacion.jpg",
        "05_jymx_cat_sin_cat.jpg",
        "06_tfx_nosotros.jpg",
        "07_tfx_contacto.jpg",
        "08_jymx_carrito.jpg",
        "09_tfx_cart.jpg",
        "10_jymx_beauty_in.jpg",
        "11_tfx_beauty_in.jpg",
        "12_jymx_prunex_landing.jpg",
        "13_tfx_prunex.jpg",
        "14_jymx_liquid_fiber.jpg",
        "15_tfx_liquid_fiber.jpg",
    ]
    for f in needed:
        if not (ASSETS / f).is_file():
            print("Falta la imagen:", ASSETS / f, file=sys.stderr)
            print("Ejecutá primero: generar_informe_ejecutivo.py (sin --solo-pdf)", file=sys.stderr)
            sys.exit(1)

    styles = getSampleStyleSheet()
    A = ASSETS

    titulo = ParagraphStyle(
        "tit",
        parent=styles["Heading1"],
        fontSize=17,
        textColor=colors.HexColor("#1a365d"),
        spaceAfter=12,
    )
    h2 = ParagraphStyle(
        "h2",
        parent=styles["Heading2"],
        fontSize=12,
        textColor=colors.HexColor("#2c5282"),
        spaceBefore=8,
        spaceAfter=8,
    )
    body = ParagraphStyle(
        "body",
        parent=styles["Normal"],
        fontSize=10.5,
        leading=14,
        spaceAfter=6,
    )
    sub = ParagraphStyle("sub", parent=body, fontSize=10, textColor=colors.HexColor("#2d3748"), fontName="Helvetica-Bold")

    story: list = []

    story.append(P("Comparación de dos tiendas en internet", titulo))
    story.append(
        P(
            "Este documento está escrito para personas que <b>no trabajan en informática</b>. "
            "Compara la tienda del equipo de <b>Jorge</b> (sitio en Fuxion) con <b>Tienda FX</b>. "
            "Las fotos son capturas reales de la pantalla, tomadas el 1 de mayo de 2026.",
            body,
        )
    )
    story.append(
        P(
            "<b>Cómo leer cada parte:</b> primero se describe qué ve una persona en cada sitio; "
            "después, una comparación en pocas palabras; al final, las dos capturas lado a lado.",
            body,
        )
    )
    story.append(PageBreak())

    # --- Vista producto Prunex ---
    story.append(P("1. Vista: producto Prunex (la misma referencia en las dos tiendas)", h2))
    story.append(P("<b>En el sitio de Jorge</b>", sub))
    story.append(
        P(
            "La entrada principal del producto se ve como una <b>página larga tipo revista</b>: "
            "título grande sobre la digestión, frases que explican el beneficio, botones para comprar, "
            "fotos del producto y del envase, bloques con beneficios y textos cortos, "
            "y más abajo opiniones de clientas contadas con sus palabras. "
            "Da sensación de contar una historia antes de comprar.",
            body,
        )
    )
    story.append(P("<b>En Tienda FX</b>", sub))
    story.append(
        P(
            "Aquí Prunex aparece como <b>ficha de catálogo</b>: nombre del producto, precio, "
            "un texto breve, botón para agregar al carrito, fotos del producto y bloques que refuerzan "
            "confianza (por ejemplo pagos) y sugerencias de otros productos que combinan bien.",
            body,
        )
    )
    story.append(P("<b>En pocas palabras</b>", sub))
    story.append(
        P(
            "La misma referencia se presenta de dos maneras: en el sitio de Jorge predomina el <b>relato y la emoción</b>; "
            "en Tienda FX predomina la <b>compra rápida y la organización tipo tienda</b>. "
            "En la captura de Tienda FX de este ejemplo no se aprecia un recuadro de video del producto; "
            "en el sitio de Jorge esta pantalla larga tampoco muestra un video incrustado en la parte superior "
            "(el video del mismo producto puede estar en otra ruta de compra dentro de la misma tienda).",
            body,
        )
    )
    story.extend(pair_row(A / "12_jymx_prunex_landing.jpg", A / "13_tfx_prunex.jpg", "Sitio de Jorge", "Tienda FX", styles))
    story.append(PageBreak())

    # Beauty-In
    story.append(P("2. Vista: producto Beauty-In (mismo producto, misma idea de negocio)", h2))
    story.append(P("<b>En el sitio de Jorge</b>", sub))
    story.append(
        P(
            "Se ve la foto del producto, el precio y textos de descripción. "
            "Hay secciones tipo pestañas: en una de ellas se puede abrir un <b>video</b> del producto "
            "(pantalla negra con reproductor en el centro de la página al bajar un poco).",
            body,
        )
    )
    story.append(P("<b>En Tienda FX</b>", sub))
    story.append(
        P(
            "También hay foto, precio y textos. El video aparece <b>integrado en bloques</b> de la página "
            "(como módulos armados uno debajo del otro), con títulos comerciales que preguntan por qué elegir el producto.",
            body,
        )
    )
    story.append(P("<b>En pocas palabras</b>", sub))
    story.append(
        P(
            "<b>Las dos tiendas muestran video</b> de este producto, pero lo colocan distinto: "
            "Jorge lo agrupa en una zona de “pestañas”; Tienda FX lo mezcla con bloques de diseño en la misma página.",
            body,
        )
    )
    story.extend(pair_row(A / "10_jymx_beauty_in.jpg", A / "11_tfx_beauty_in.jpg", "Sitio de Jorge", "Tienda FX", styles))
    story.append(PageBreak())

    # Liquid Fiber
    story.append(P("3. Vista: producto Liquid Fiber (ficha “normal” de tienda)", h2))
    story.append(P("<b>En el sitio de Jorge</b>", sub))
    story.append(
        P(
            "Página más compacta: imagen principal, precio, descripción y botón de compra. "
            "Menos adornos alrededor del precio.",
            body,
        )
    )
    story.append(P("<b>En Tienda FX</b>", sub))
    story.append(
        P(
            "Misma idea (foto, precio, comprar), pero con <b>más elementos visuales</b> alrededor: "
            "mensajes de confianza, sugerencias de otros productos y un aspecto más “producción gráfica”.",
            body,
        )
    )
    story.append(P("<b>En pocas palabras</b>", sub))
    story.append(
        P(
            "Las dos cumplen la misma función (informar y vender), pero Tienda FX <b>llena más la pantalla</b> "
            "con mensajes y cruces de venta; Jorge se ve más sobrio en esta ficha.",
            body,
        )
    )
    story.extend(pair_row(A / "14_jymx_liquid_fiber.jpg", A / "15_tfx_liquid_fiber.jpg", "Sitio de Jorge", "Tienda FX", styles))
    story.append(PageBreak())

    # Inicio
    story.append(P("4. Vista: página de inicio (primera impresión)", h2))
    story.append(P("<b>En el sitio de Jorge</b>", sub))
    story.append(
        P(
            "Destacan mensajes en grande sobre promociones, un carrusel de imágenes, "
            "listado de productos y una zona de “blog” o noticias.",
            body,
        )
    )
    story.append(P("<b>En Tienda FX</b>", sub))
    story.append(
        P(
            "Mensaje principal sobre vivir saludable, filas de <b>categorías con dibujos</b>, "
            "productos destacados del mes y un bloque de opiniones de clientes.",
            body,
        )
    )
    story.append(P("<b>En pocas palabras</b>", sub))
    story.append(
        P(
            "Jorge refuerza <b>campañas y catálogo</b> al entrar; Tienda FX refuerza <b>mensaje de marca, "
            "navegación por necesidad y prueba social</b>.",
            body,
        )
    )
    story.extend(pair_row(A / "01_jymx_home.jpg", A / "02_tfx_home.jpg", "Sitio de Jorge", "Tienda FX", styles))
    story.append(PageBreak())

    # Listados
    story.append(P("5. Vista: ver muchos productos juntos", h2))
    story.append(P("<b>En el sitio de Jorge</b>", sub))
    story.append(
        P(
            "Hay una sección tipo <b>“Tienda”</b> donde los productos aparecen en cuadrícula con foto y precio.",
            body,
        )
    )
    story.append(P("<b>En Tienda FX</b>", sub))
    story.append(
        P(
            "Se puede entrar por <b>tema</b> (en el ejemplo, productos ligados a desintoxicación): "
            "título del tema y lista de productos.",
            body,
        )
    )
    story.append(P("<b>En pocas palabras</b>", sub))
    story.append(
        P(
            "Jorge agrupa en una sola <b>vista general de tienda</b>; Tienda FX guía más por <b>interés o necesidad</b>.",
            body,
        )
    )
    story.extend(pair_row(A / "03_jymx_tienda.jpg", A / "04_tfx_cat_desintoxicacion.jpg", "Sitio de Jorge — Tienda", "Tienda FX — categoría", styles))
    story.append(PageBreak())

    # Categoría débil vs fuerte
    story.append(P("6. Vista: listado por categoría (calidad del armado)", h2))
    story.append(P("<b>En el sitio de Jorge</b>", sub))
    story.append(
        P(
            "En el ejemplo revisado aparece una categoría genérica con pocos productos; "
            "se nota que <b>no está aprovechada</b> como vitrina comercial.",
            body,
        )
    )
    story.append(P("<b>En Tienda FX</b>", sub))
    story.append(
        P(
            "La categoría de ejemplo luce <b>trabajada</b>: título claro, textos y varios productos presentados.",
            body,
        )
    )
    story.append(P("<b>En pocas palabras</b>", sub))
    story.append(
        P(
            "No es que la tecnología sea distinta: es el <b>cuidado del contenido</b>. "
            "En Tienda FX la categoría enseñada se ve lista para vender; en Jorge el ejemplo elegido se ve incompleto.",
            body,
        )
    )
    story.extend(pair_row(A / "05_jymx_cat_sin_cat.jpg", A / "04_tfx_cat_desintoxicacion.jpg", "Sitio de Jorge", "Tienda FX (misma captura de categoría)", styles))
    story.append(PageBreak())

    # Carrito
    story.append(P("7. Vista: carrito de compras vacío", h2))
    story.append(P("<b>En el sitio de Jorge</b>", sub))
    story.append(P("Mensaje de que no hay productos y enlaces para seguir comprando.", body))
    story.append(P("<b>En Tienda FX</b>", sub))
    story.append(P("Mismo concepto: carrito vacío y camino para volver a la tienda.", body))
    story.append(P("<b>En pocas palabras</b>", sub))
    story.append(
        P(
            "La experiencia base es parecida. Tienda FX mantiene en el encabezado el acceso al <b>carrito lateral</b> "
            "(panel que se abre al costado en el sitio completo); en las capturas se ve el estilo general de la tienda.",
            body,
        )
    )
    story.extend(pair_row(A / "08_jymx_carrito.jpg", A / "09_tfx_cart.jpg", "Sitio de Jorge", "Tienda FX", styles))
    story.append(PageBreak())

    # Institucional
    story.append(P("8. Vista: quiénes somos y contacto", h2))
    story.append(P("<b>En Tienda FX</b>", sub))
    story.append(
        P(
            "Existen páginas claras de <b>“Nosotros”</b> (historia de la tienda) y <b>“Contacto”</b> "
            "con formulario: nombre, correo, teléfono, campo para número de WhatsApp y mensaje.",
            body,
        )
    )
    story.append(P("<b>En el sitio de Jorge</b>", sub))
    story.append(
        P(
            "En la revisión hecha desde la página de inicio <b>no aparecieron</b> en el menú principal "
            "entradas equivalentes a “Nosotros” o “Contacto”. "
            "Sí suele verse un <b>botón flotante de WhatsApp</b> para hablar directo (visible en otras pantallas del sitio).",
            body,
        )
    )
    story.append(P("<b>En pocas palabras</b>", sub))
    story.append(
        P(
            "Tienda FX orienta más a <b>confianza institucional y formulario</b>; "
            "Jorge orienta más a <b>contacto rápido por WhatsApp</b> y a la narrativa de producto.",
            body,
        )
    )
    story.extend(pair_row(A / "06_tfx_nosotros.jpg", A / "07_tfx_contacto.jpg", "Tienda FX — Nosotros", "Tienda FX — Contacto", styles))
    story.append(Spacer(1, 0.4 * cm))

    # Tabla final muy simple
    story.append(P("Resumen en una tabla", h2))
    hdr = ParagraphStyle("hdr", parent=styles["Normal"], fontSize=9, fontName="Helvetica-Bold", textColor=colors.white)
    c = ParagraphStyle("c", parent=styles["Normal"], fontSize=9, leading=12)
    rows = [
        [
            Paragraph("Tema", hdr),
            Paragraph("Sitio de Jorge", hdr),
            Paragraph("Tienda FX", hdr),
        ],
        [
            Paragraph("Primera impresión", c),
            Paragraph("Promos y catálogo; blog visible.", c),
            Paragraph("Mensaje de marca; categorías con dibujos; opiniones.", c),
        ],
        [
            Paragraph("Producto estrella (Prunex)", c),
            Paragraph("Página larga tipo historia.", c),
            Paragraph("Ficha directa para comprar.", c),
        ],
        [
            Paragraph("Video en producto", c),
            Paragraph("Sí en varios productos; a veces en pestañas.", c),
            Paragraph("Sí en varios productos; a veces en bloques.", c),
        ],
        [
            Paragraph("Empresa y contacto", c),
            Paragraph("WhatsApp flotante; sin menú “Nosotros” en la muestra.", c),
            Paragraph("Páginas Nosotros y Contacto con formulario.", c),
        ],
    ]
    tab = Table(rows, colWidths=[3.8 * cm, 6.2 * cm, 6.2 * cm])
    tab.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2c5282")),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e0")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f7fafc")]),
            ]
        )
    )
    story.append(tab)
    story.append(Spacer(1, 0.5 * cm))
    story.append(
        P(
            "<i>Nota:</i> las tiendas pueden cambiar mañana. Si hace falta actualizar, se pueden volver a tomar "
            "las capturas con el mismo método.",
            ParagraphStyle("note", parent=styles["Normal"], fontSize=8.5, textColor=colors.grey),
        )
    )

    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=1.6 * cm,
        rightMargin=1.6 * cm,
        topMargin=1.1 * cm,
        bottomMargin=1.1 * cm,
    )
    doc.build(story)
    print("Listo:", OUT, "—", OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
