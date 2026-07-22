from pathlib import Path
import importlib.util

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm


ROOT = Path(__file__).resolve().parents[1]
BASE_BUILDER = Path(r"C:\Users\orhan\finanskor-otomasyon\tools\build_finanskor_report_pdf.py")
SRC = ROOT / "WARDROOF_VC_URUN_MALIYET_RAPORU_2026-07.md"
OUT = ROOT / "output" / "pdf" / "WARDROOF_VC_URUN_MALIYET_RAPORU_2026-07.pdf"

spec = importlib.util.spec_from_file_location("base_report", BASE_BUILDER)
report = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(report)


def header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    canvas.setStrokeColor(colors.HexColor("#D7DEE8"))
    canvas.setLineWidth(0.5)
    canvas.line(18 * mm, height - 14 * mm, width - 18 * mm, height - 14 * mm)
    canvas.setFont("Arial-Bold", 7.5)
    canvas.setFillColor(colors.HexColor("#126B68"))
    canvas.drawString(18 * mm, height - 10.5 * mm, "WARDROOF")
    canvas.setFont("Arial", 7.2)
    canvas.setFillColor(colors.HexColor("#667085"))
    canvas.drawRightString(
        width - 18 * mm,
        height - 10.5 * mm,
        "VC - Ürün - Ölçekleme Raporu | 20.07.2026",
    )
    canvas.line(18 * mm, 13 * mm, width - 18 * mm, 13 * mm)
    canvas.drawString(
        18 * mm,
        8.5 * mm,
        "Kurucu karar desteği - hukuk veya yatırım tavsiyesi değildir",
    )
    canvas.drawRightString(width - 18 * mm, 8.5 * mm, f"{doc.page}")
    canvas.restoreState()


def main():
    OUT.parent.mkdir(parents=True, exist_ok=True)
    report.header_footer = header_footer
    doc = report.ReportDoc(str(OUT))
    doc.title = "WARDROOF VC, Ürün ve Maliyet Raporu"
    doc.author = "WARDROOF"
    story = report.parse_md(SRC.read_text(encoding="utf-8"))
    doc.build(story)
    print(OUT)


if __name__ == "__main__":
    main()
