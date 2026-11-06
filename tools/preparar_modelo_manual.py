"""Prepara o PDF institucional sem dados dos clientes do documento de origem.

Uso: python tools/preparar_modelo_manual.py entrada.pdf manual-modelo.pdf
O documento de origem não é alterado.
"""
import sys
import fitz


def main(source, destination):
    doc = fitz.open(source)
    if len(doc) != 16:
        raise ValueError("O manual padrão precisa ter exatamente 16 páginas")

    # Coordenadas do documento A4 original (pontos PDF).
    # Apaga somente os campos variáveis, preservando o restante das páginas.
    fields = {
        0: ([(49, 645, 215, 762)], (239, 235, 232)),
        4: ([(286, 746, 492, 774)], (239, 235, 232)),
        5: ([(42, 781, 228, 809)], (205, 198, 195)),
        6: ([(402, 670, 501, 704)], (206, 197, 195)),
        9: ([(350, 780, 517, 808)], (207, 198, 195)),
    }
    for page_number, (rectangles, rgb) in fields.items():
        page = doc[page_number]
        color = tuple(channel / 255 for channel in rgb)
        for rectangle in rectangles:
            page.add_redact_annot(fitz.Rect(rectangle), fill=color)
        page.apply_redactions(images=0, graphics=0, text=0)

    doc.set_metadata({"title": "Manual do Cliente - Modelo Santrelle", "author": "Santrelle Arquitetura"})
    doc.save(destination, garbage=4, deflate=True)
    doc.close()


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Uso: preparar_modelo_manual.py entrada.pdf saida.pdf")
    main(sys.argv[1], sys.argv[2])
