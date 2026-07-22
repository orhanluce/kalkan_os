# -*- coding: utf-8 -*-
"""WARDPROOF yatirimci sunumu (pitch deck) PDF ureticisi.

16:9 slayt formati, Turkce karakter destegi icin Windows Segoe UI TTF
fontlari gomulur. Icerik, girisimcilik destek programi basvurusuyla uyumlu
pitch deck metninden derlenmistir — uydurma musteri/satis/yatirim yok, kesin
olmayan rakamlar "yonetim varsayimi" etiketlidir.

Kullanim:  python scripts/build_wardproof_pitch_deck_pdf.py
Cikti:     output/WARDPROOF_Yatirimci_Sunumu_2026.pdf
"""

import os

from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen import canvas

# ---------------------------------------------------------------- fontlar
FONT_DIR = r"C:\Windows\Fonts"
pdfmetrics.registerFont(TTFont("Segoe", os.path.join(FONT_DIR, "segoeui.ttf")))
pdfmetrics.registerFont(TTFont("SegoeB", os.path.join(FONT_DIR, "segoeuib.ttf")))
pdfmetrics.registerFont(TTFont("SegoeI", os.path.join(FONT_DIR, "segoeuii.ttf")))

# ---------------------------------------------------------------- tema
PAGE_W, PAGE_H = 960, 540  # 16:9

NAVY = HexColor("#0E1F33")
NAVY_DARK = HexColor("#0A1626")
TEAL = HexColor("#1FA789")
GOLD = HexColor("#D9A441")
INK = HexColor("#17293D")
GREY = HexColor("#5B6B7C")
LIGHT = HexColor("#F4F6F9")
WHITE = HexColor("#FFFFFF")
LINE = HexColor("#D8DEE6")
RED = HexColor("#B54A4A")
GREEN = HexColor("#2E7D5B")

MARGIN = 56


def wrap(c, text, font, size, max_w):
    """Kelime bazli satir kirma."""
    words = text.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if c.stringWidth(test, font, size) <= max_w:
            cur = test
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def draw_wrapped(c, text, x, y, font, size, max_w, leading=None, color=INK):
    leading = leading or size * 1.35
    c.setFont(font, size)
    c.setFillColor(color)
    for line in wrap(c, text, font, size, max_w):
        c.drawString(x, y, line)
        y -= leading
    return y


class Deck:
    def __init__(self, path):
        self.c = canvas.Canvas(path, pagesize=(PAGE_W, PAGE_H))
        self.c.setTitle("WARDPROOF — Yatırımcı Sunumu")
        self.c.setAuthor("Orhan Işık")
        self.slide_no = 0

    # ---------------- ortak cerceveler ----------------
    def _footer(self):
        c = self.c
        c.setFillColor(GREY)
        c.setFont("Segoe", 8)
        c.drawString(MARGIN, 20, "WARDPROOF — Yatırımcı Sunumu · 2026")
        c.drawRightString(PAGE_W - MARGIN, 20, f"{self.slide_no}")

    def new_content_slide(self, title, message, tag=None):
        """Baslik bandi + ana mesaj satiri olan standart slayt."""
        self.slide_no += 1
        c = self.c
        c.setFillColor(WHITE)
        c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
        # ust bant
        c.setFillColor(NAVY)
        c.rect(0, PAGE_H - 84, PAGE_W, 84, fill=1, stroke=0)
        c.setFillColor(TEAL)
        c.rect(0, PAGE_H - 88, PAGE_W, 4, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("SegoeB", 24)
        c.drawString(MARGIN, PAGE_H - 54, title)
        if tag:
            tw = c.stringWidth(tag, "SegoeB", 9) + 16
            c.setFillColor(GOLD)
            c.roundRect(PAGE_W - MARGIN - tw, PAGE_H - 60, tw, 20, 10, fill=1, stroke=0)
            c.setFillColor(NAVY_DARK)
            c.setFont("SegoeB", 9)
            c.drawCentredString(PAGE_W - MARGIN - tw / 2, PAGE_H - 54, tag)
        # ana mesaj
        c.setFillColor(TEAL)
        c.setFont("SegoeI", 13.5)
        c.drawString(MARGIN, PAGE_H - 112, message)
        self._footer()
        return PAGE_H - 148  # icerik baslangic y'si

    def bullets(self, items, x, y, max_w, size=12.5, gap=7, color=INK):
        c = self.c
        for it in items:
            c.setFillColor(TEAL)
            c.circle(x + 3, y + size * 0.32, 2.4, fill=1, stroke=0)
            y = draw_wrapped(c, it, x + 14, y, "Segoe", size, max_w - 14, color=color)
            y -= gap
        return y

    def note(self, text, y, x=MARGIN, max_w=PAGE_W - 2 * MARGIN):
        c = self.c
        c.setFillColor(LIGHT)
        lines = wrap(c, text, "SegoeI", 9.5, max_w - 20)
        h = len(lines) * 13 + 14
        c.roundRect(x, y - h, max_w, h, 6, fill=1, stroke=0)
        yy = y - 16
        c.setFillColor(GREY)
        c.setFont("SegoeI", 9.5)
        for line in lines:
            c.drawString(x + 10, yy, line)
            yy -= 13
        return y - h - 8

    def end(self):
        self.c.showPage()

    def save(self):
        self.c.save()


def build(path):
    d = Deck(path)
    c = d.c

    # ================================================= SLAYT 1 — KAPAK
    d.slide_no += 1
    c.setFillColor(NAVY_DARK)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.rect(0, 0, PAGE_W, 180, fill=1, stroke=0)
    c.setFillColor(TEAL)
    c.rect(0, 180, PAGE_W, 3, fill=1, stroke=0)
    # logo blogu
    c.setFillColor(WHITE)
    c.setFont("SegoeB", 54)
    c.drawCentredString(PAGE_W / 2, 350, "WARDPROOF")
    c.setFillColor(GOLD)
    c.setFont("SegoeI", 17)
    c.drawCentredString(PAGE_W / 2, 312, "Regülasyondan kanıta, tek izlenebilir zincir.")
    c.setFillColor(WHITE)
    c.setFont("Segoe", 12.5)
    c.drawCentredString(
        PAGE_W / 2, 262,
        "Finansal kuruluşlar ve büyük işletmeler için regülasyon, dayanıklılık,")
    c.drawCentredString(
        PAGE_W / 2, 244, "kontrol, kanıt ve denetim platformu — bulut tabanlı B2B SaaS")
    c.setFillColor(HexColor("#9FB2C6"))
    c.setFont("Segoe", 11)
    c.drawCentredString(PAGE_W / 2, 120, "Kurucu: Orhan Işık   ·   wardproof.com")
    c.setFont("Segoe", 9.5)
    c.drawCentredString(PAGE_W / 2, 98, "SaaS · Finansal Teknolojiler · RegTech · GRC/IRM · Siber Güvenlik · Bulut")
    c.setFillColor(GREY)
    c.setFont("Segoe", 8)
    c.drawCentredString(PAGE_W / 2, 40, "Yatırımcı Sunumu · 2026")
    d.end()

    # ================================================= SLAYT 2 — TEK CUMLE
    y = d.new_content_slide("Tek Cümlede WARDPROOF",
                            "Uyum iddiası değil, kanıt zinciri satıyoruz.")
    y = d.bullets([
        "WARDPROOF; regülasyon, siber dayanıklılık, risk, kontrol, denetim ve kanıt yönetimini tek platformda birleştiren B2B SaaS çözümüdür.",
        "Her sonuç; kaynağı, zamanı, kanıtı ve onay geçmişiyle birlikte durur.",
        "İlke: kaynağı ve kanıtı olmayan hiçbir sonuç “kesin uyum” olarak gösterilmez.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN)
    # zincir diyagrami
    chain = ["Kaynak", "Yükümlülük", "Kritik hizmet", "Kontrol", "Test", "Kanıt",
             "Bulgu", "Düzeltme", "Yeniden test", "Doğrulanmış kapanış", "Çıktı"]
    bx, bw, bh, gap = MARGIN, 72, 34, 8
    total = len(chain) * bw + (len(chain) - 1) * gap
    scale = (PAGE_W - 2 * MARGIN) / total
    bw, gap = bw * scale, gap * scale
    yy = 120
    for i, item in enumerate(chain):
        x0 = bx + i * (bw + gap)
        c.setFillColor(NAVY if i not in (5, 9) else TEAL)
        c.roundRect(x0, yy, bw, bh, 5, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("SegoeB", 6.8)
        for j, ln in enumerate(wrap(c, item, "SegoeB", 6.8, bw - 6)):
            c.drawCentredString(x0 + bw / 2, yy + bh - 14 - j * 8, ln)
        if i < len(chain) - 1:
            c.setFillColor(GOLD)
            c.setFont("SegoeB", 9)
            c.drawCentredString(x0 + bw + gap / 2, yy + bh / 2 - 3, "›")
    c.setFillColor(GREY)
    c.setFont("SegoeI", 9)
    c.drawString(MARGIN, yy - 20, "Çekirdek zincir: resmî düzenleme kaynağından denetim, yönetim ve düzenleyici çıktıya kadar kesintisiz izlenebilirlik.")
    d.end()

    # ================================================= SLAYT 3 — PROBLEM
    y = d.new_content_slide("Problem",
                            "Kurumlar uyumu yönetiyor ama kanıtlayamıyor; kanıt dağınık, eski ve pahalı.")
    y = d.bullets([
        "Mevzuat, kontrol, test, kanıt ve bulgular farklı sistemlerde ve Excel dosyalarında tutuluyor.",
        "Aynı kanıt her denetimde yeniden toplanıyor; eski veya geçersiz kanıt fark edilmeden kullanılabiliyor.",
        "Mevzuat değişikliğinin hangi kontrolü ve kritik hizmeti etkilediği geç görülüyor.",
        "Bulgular yeniden test edilmeden kapatılabiliyor; manuel beyan ile gerçek ölçüm ayrışmıyor.",
        "Kritik hizmet ↔ kontrol ↔ tedarikçi ↔ ICT bağımlılığı bütüncül görülemiyor.",
        "Sonuç: yüksek denetim hazırlık maliyeti, personel yükü ve geç fark edilen risk.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=12)
    d.note("Sahne: denetimden üç hafta önce ekipler klasör klasör kanıt toplar; kimse hangi kanıtın güncel olduğundan emin değildir. Bulgu “kapatıldı” denir ama yeniden test yoktur.", y)
    d.end()

    # ================================================= SLAYT 4 — COZUM
    y = d.new_content_slide("Çözüm",
                            "WARDPROOF tüm zinciri tek izlenebilir sistemde birleştirir ve her sonucu kanıtına bağlar.")
    y = d.bullets([
        "Tek platform: mevzuattan denetim çıktısına kadar kesintisiz zincir.",
        "Bulgular yalnız başarılı yeniden test ve bağımsız onayla “doğrulanmış” kapanır (maker-checker).",
        "Manuel beyan ile otomatik ölçüm açıkça etiketlenir; yanlış kesinlik üretilmez.",
        "Değişmez (immutable) snapshot, canonical hash ve provenance ile kanıt bütünlüğü korunur.",
        "Denetçiye hesap açmadan, süreli ve minimize “Proof Room” erişimi verilir.",
        "Hedefler: denetim hazırlık süresini azaltmak, kanıt tekrarını düşürmek, kritik riski erken görmek.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=12)
    d.note("Özü: kurum bir sonuca tıkladığında kaynağını, zamanını, kanıtını ve kimin onayladığını görür. Ürün sonucu “garanti etmez” — doğrulanabilir kılar.", y)
    d.end()

    # ================================================= SLAYT 5 — URUN VE TEKNOLOJI
    y = d.new_content_slide("Ürün ve Teknoloji",
                            "Geniş modül kapsamı, tek veri modeli, kurumsal güvenlik mimarisi.")
    col_w = (PAGE_W - 2 * MARGIN - 40) / 3
    cols = [
        ("Uyum", ["Mevzuat ve yükümlülük yönetimi", "Uygulanabilirlik kararları (kaynak atfıyla)",
                  "Kontrol testleri", "Maker-checker, bağımsız kapanış", "Görevler ayrılığı (SoD)"]),
        ("Dayanıklılık", ["Kritik hizmet ve bağımlılık analizi", "Tedarikçi / alt yüklenici güvencesi",
                          "DORA bilgi sicili", "Etki toleransları, kurtarma ölçümleri",
                          "RTO/RPO karşılaştırma artefaktları"]),
        ("Kanıt ve Denetim", ["Değişmez snapshot + canonical hash", "Kanıt defteri (ledger) ve provenance",
                              "Proof Room (süreli, minimize erişim)", "Denetim, yönetim ve düzenleyici çıktılar"]),
    ]
    box_top, box_h = y, 236
    for i, (title, items) in enumerate(cols):
        x0 = MARGIN + i * (col_w + 20)
        c.setFillColor(LIGHT)
        c.roundRect(x0, box_top - box_h, col_w, box_h, 8, fill=1, stroke=0)
        c.setFillColor(NAVY)
        c.roundRect(x0, box_top - 30, col_w, 30, 8, fill=1, stroke=0)
        c.rect(x0, box_top - 30, col_w, 14, fill=1, stroke=0)
        c.setFillColor(WHITE)
        c.setFont("SegoeB", 12)
        c.drawCentredString(x0 + col_w / 2, box_top - 20, title)
        yy = box_top - 48
        for it in items:
            c.setFillColor(TEAL)
            c.circle(x0 + 14, yy + 3, 2, fill=1, stroke=0)
            yy = draw_wrapped(c, it, x0 + 24, yy, "Segoe", 9.5, col_w - 34, leading=12)
            yy -= 6
    yb = box_top - box_h - 24
    c.setFillColor(NAVY_DARK)
    c.roundRect(MARGIN, yb - 8, PAGE_W - 2 * MARGIN, 30, 6, fill=1, stroke=0)
    c.setFillColor(WHITE)
    c.setFont("SegoeB", 10.5)
    c.drawCentredString(PAGE_W / 2, yb + 2,
                        "Mimari: çok kiracılı bulut · tenant izolasyonu · satır düzeyi erişim güvenliği (RLS) · değişmezlik ve hash zinciri")
    d.end()

    # ================================================= SLAYT 6 — MEVCUT ASAMA
    y = d.new_content_slide("Mevcut Aşama ve Teknik Doğrulama",
                            "WARDPROOF fikir değil; canlıda çalışan, test edilmiş ileri bir MVP.")
    y = d.bullets([
        "Çalışan ileri MVP mevcut; canlı bulut altyapısında yayında.",
        "Temel modüller geliştirilmiş durumda: uyum zinciri, dayanıklılık, kanıt/denetim katmanı.",
        "Otomatik doğrulama: birim testleri, satır düzeyi erişim (RLS) testleri, canlı ortam smoke testleri, gerçek tarayıcı (Chromium) uçtan uca testleri.",
        "Henüz doğrulanmış ücretli pilot satış yok — dürüst mevcut durum.",
        "Sıradaki aşama: pilot müşteriler ve ürün-pazar uyumu doğrulaması.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=12)
    # zaman cizgisi
    steps = ["Araştırma", "Geliştirme", "Canlı MVP + otomatik testler", "Pilotlar", "Ürün-pazar uyumu"]
    yy = 105
    seg_w = (PAGE_W - 2 * MARGIN) / len(steps)
    c.setStrokeColor(LINE)
    c.setLineWidth(2)
    c.line(MARGIN + seg_w / 2, yy, PAGE_W - MARGIN - seg_w / 2, yy)
    for i, s in enumerate(steps):
        cx = MARGIN + seg_w / 2 + i * seg_w
        done = i <= 2
        c.setFillColor(TEAL if done else WHITE)
        c.setStrokeColor(TEAL if done else GREY)
        c.circle(cx, yy, 7, fill=1, stroke=1)
        c.setFillColor(INK if done else GREY)
        c.setFont("SegoeB" if i == 2 else "Segoe", 9)
        for j, ln in enumerate(wrap(c, s, "Segoe", 9, seg_w - 12)):
            c.drawCentredString(cx, yy - 22 - j * 11, ln)
    c.setFillColor(GOLD)
    c.setFont("SegoeB", 9)
    c.drawCentredString(MARGIN + seg_w / 2 + 2 * seg_w, yy + 16, "▼ şimdi buradayız")
    d.end()

    # ================================================= SLAYT 7 — HEDEF MUSTERI
    y = d.new_content_slide("Hedef Müşteri",
                            "Düzenlemeye tabi finans kuruluşları + büyük kurumların finans, risk ve uyum ekipleri.")
    half = (PAGE_W - 2 * MARGIN - 24) / 2
    c.setFillColor(LIGHT)
    c.roundRect(MARGIN, y - 190, half, 190, 8, fill=1, stroke=0)
    c.roundRect(MARGIN + half + 24, y - 190, half, 190, 8, fill=1, stroke=0)
    c.setFillColor(NAVY)
    c.setFont("SegoeB", 12.5)
    c.drawString(MARGIN + 14, y - 24, "Birincil segment — finans kuruluşları")
    c.drawString(MARGIN + half + 38, y - 24, "İkincil segment — büyük kurumlar")
    yy = y - 46
    c.setFillColor(INK)
    for it in ["Bankalar, aracı kurumlar, portföy yönetim şirketleri",
               "Ödeme ve elektronik para kuruluşları",
               "Kripto varlık hizmet sağlayıcıları",
               "Sigorta ve diğer düzenlemeye tabi kuruluşlar"]:
        c.setFillColor(TEAL); c.circle(MARGIN + 20, yy + 3, 2, fill=1, stroke=0)
        yy = draw_wrapped(c, it, MARGIN + 30, yy, "Segoe", 10.5, half - 46, leading=14); yy -= 6
    yy = y - 46
    for it in ["Finans, risk, iç kontrol ve iç denetim ekipleri",
               "Uyum ve bilgi güvenliği ekipleri",
               "Alıcı persona: uyum müdürü, iç denetim başkanı, risk yöneticisi, CISO, CFO"]:
        c.setFillColor(TEAL); c.circle(MARGIN + half + 44, yy + 3, 2, fill=1, stroke=0)
        yy = draw_wrapped(c, it, MARGIN + half + 54, yy, "Segoe", 10.5, half - 46, leading=14); yy -= 6
    d.note("Satın alma tetikleyicisi regülasyon baskısıdır: denetim hazırlığı, düzenleyici raporlama ve dayanıklılık testi yükümlülükleri — “istersen al” değil, “kanıtlamak zorundasın” pazarı.", y - 206)
    d.end()

    # ================================================= SLAYT 8 — PAZAR
    y = d.new_content_slide("Pazar Büyüklüğü",
                            "Türkiye başlangıç pazarı teorik kapasitesi ~22,75M USD/yıl — doğrulanacak yönetim varsayımı.",
                            tag="YÖNETİM VARSAYIMI")
    rows = [
        ("Düzenlemeye tabi finans kuruluşu", "~250 hesap", "55.000 USD/yıl", "13,75M USD"),
        ("Büyük kurum finans departmanı", "~1.000 hesap", "9.000 USD/yıl", "9,00M USD"),
        ("Toplam", "~1.250 hesap", "—", "22,75M USD/yıl"),
    ]
    headers = ["Segment", "Hesap sayısı", "Ort. yıllık sözleşme", "Teorik kapasite"]
    tx, tw = MARGIN, PAGE_W - 2 * MARGIN
    col_ws = [tw * 0.38, tw * 0.18, tw * 0.22, tw * 0.22]
    ty, rh = y, 34
    c.setFillColor(NAVY)
    c.rect(tx, ty - rh, tw, rh, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("SegoeB", 11)
    xx = tx
    for htxt, wcol in zip(headers, col_ws):
        c.drawString(xx + 10, ty - 22, htxt); xx += wcol
    ty -= rh
    for i, row in enumerate(rows):
        last = i == len(rows) - 1
        c.setFillColor(HexColor("#EAF4F1") if last else (LIGHT if i % 2 == 0 else WHITE))
        c.rect(tx, ty - rh, tw, rh, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("SegoeB" if last else "Segoe", 11)
        xx = tx
        for val, wcol in zip(row, col_ws):
            c.drawString(xx + 10, ty - 22, val); xx += wcol
        ty -= rh
    y = ty - 18
    y = d.bullets([
        "Rakamlar satış taahhüdü değildir; pilot görüşmeler, müşteri keşfi ve kanal sonuçlarıyla doğrulanacaktır.",
        "AB/DORA kaynaklı bölgesel genişleme 5. yıl yol haritasında ayrıca ele alınır.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=11)
    d.end()

    # ================================================= SLAYT 9 — REKABET
    y = d.new_content_slide("Rekabet ve Konumlandırma",
                            "Küresel GRC devleri geniş ama ağır; WARDPROOF kanıt zinciri odaklı, yerel ve erişilebilir.")
    rows = [
        ("ServiceNow IRM", "Geniş kurumsal GRC/IRM platformu", "Uzun kurulum, yüksek toplam sahip olma maliyeti"),
        ("IBM OpenPages", "Geniş kurumsal GRC/IRM platformu", "Kurumsal dönüşüm projesi ölçeğinde uygulama"),
        ("MetricStream", "GRC ve uyum yönetimi", "Benzer kurumsal ölçek ve maliyet profili"),
    ]
    tx, tw = MARGIN, PAGE_W - 2 * MARGIN
    col_ws = [tw * 0.22, tw * 0.36, tw * 0.42]
    ty, rh = y, 30
    c.setFillColor(NAVY)
    c.rect(tx, ty - rh, tw, rh, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("SegoeB", 10.5)
    xx = tx
    for htxt, wcol in zip(["Rakip", "Kategori", "Konum"], col_ws):
        c.drawString(xx + 10, ty - 20, htxt); xx += wcol
    ty -= rh
    for i, row in enumerate(rows):
        c.setFillColor(LIGHT if i % 2 == 0 else WHITE)
        c.rect(tx, ty - rh, tw, rh, fill=1, stroke=0)
        c.setFillColor(INK); c.setFont("Segoe", 10)
        xx = tx
        for val, wcol in zip(row, col_ws):
            c.drawString(xx + 10, ty - 20, val); xx += wcol
        ty -= rh
    y = ty - 16
    c.setFillColor(NAVY); c.setFont("SegoeB", 12)
    c.drawString(MARGIN, y, "WARDPROOF farkı")
    y -= 20
    y = d.bullets([
        "Yalnız mevzuat takibi değil: kaynak → kontrol → test → kanıt → bulgu → retest zincirinin tamamı.",
        "Türkiye ve AB düzenlemelerine uyarlanabilir yerel yapı; manuel beyan / otomatik ölçüm ayrımı.",
        "Kritik hizmet–tedarikçi bağımlılık grafiği; immutable snapshot ve kanıt bütünlüğü; hesapsız süreli Proof Room.",
        "Hedef: daha hızlı uygulama, daha erişilebilir toplam sahip olma maliyeti; yanlış kesinlik üretmeme ilkesi.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=10.5, gap=5)
    d.end()

    # ================================================= SLAYT 10 — IS MODELI
    y = d.new_content_slide("İş Modeli",
                            "Yıllık abonelik çekirdeği + kurulum ve genişleme gelirleri.")
    half = (PAGE_W - 2 * MARGIN - 24) / 2
    c.setFillColor(LIGHT)
    c.roundRect(MARGIN, y - 210, half, 210, 8, fill=1, stroke=0)
    c.roundRect(MARGIN + half + 24, y - 210, half, 210, 8, fill=1, stroke=0)
    c.setFillColor(NAVY); c.setFont("SegoeB", 12)
    c.drawString(MARGIN + 14, y - 22, "Tekrar eden gelir")
    c.drawString(MARGIN + half + 38, y - 22, "Hizmet ve genişleme gelirleri")
    yy = y - 44
    for it in ["Yıllık B2B SaaS aboneliği",
               "Kurum büyüklüğü, modül, kullanıcı ve entegrasyon kapsamına göre katmanlı fiyatlama",
               "ACV varsayımı: finans kuruluşu 55.000 USD; kurumsal segment 9.000 USD (yönetim varsayımı)"]:
        c.setFillColor(TEAL); c.circle(MARGIN + 20, yy + 3, 2, fill=1, stroke=0)
        yy = draw_wrapped(c, it, MARGIN + 30, yy, "Segoe", 10.5, half - 46, leading=14); yy -= 8
    yy = y - 44
    for it in ["Kurulum ve onboarding; mevzuat paketi; eğitim",
               "Entegrasyon ve özel raporlama",
               "Özel kurulum / private cloud seçeneği",
               "Çözüm ortağı ve kanal gelirleri"]:
        c.setFillColor(TEAL); c.circle(MARGIN + half + 44, yy + 3, 2, fill=1, stroke=0)
        yy = draw_wrapped(c, it, MARGIN + half + 54, yy, "Segoe", 10.5, half - 46, leading=14); yy -= 8
    d.note("Gelir mantığı: dar kapsamla başla → modül ve kullanıcıyla genişle. Ürün, kurumun denetim ve uyum kayıtlarının biriktiği sistem hâline geldikçe abonelik yenilemesi veri sürekliliği değeriyle desteklenir.", y - 226)
    d.end()

    # ================================================= SLAYT 11 — SATIS
    y = d.new_content_slide("Satış ve Pazara Giriş",
                            "İsimlendirilmiş hesap listesi + sınırlı pilot + kanal ortaklıkları ile ölçülebilir kazanım.")
    steps = ["Hedef hesap listesi", "Yöneticiye erişim", "Maliyet analizi", "Sınırlı pilot",
             "Ölçülen kazanım", "Yıllık sözleşme", "Genişleme"]
    bw = (PAGE_W - 2 * MARGIN - (len(steps) - 1) * 8) / len(steps)
    yy = y - 40
    for i, s in enumerate(steps):
        x0 = MARGIN + i * (bw + 8)
        c.setFillColor(NAVY if i != 3 else TEAL)
        c.roundRect(x0, yy, bw, 40, 5, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont("SegoeB", 8.2)
        lines = wrap(c, f"{i+1}. {s}", "SegoeB", 8.2, bw - 8)
        for j, ln in enumerate(lines):
            c.drawCentredString(x0 + bw / 2, yy + 26 - j * 10, ln)
    y = yy - 24
    c.setFillColor(NAVY); c.setFont("SegoeB", 12)
    c.drawString(MARGIN, y, "Kanallar")
    y -= 20
    y = d.bullets([
        "Doğrudan kurumsal satış; kurucu ağı ve sektör bağlantıları; ücretsiz keşif görüşmesi.",
        "Ortaklıklar: denetim şirketleri, hukuk büroları, siber güvenlik danışmanları, ERP entegratörleri, teknoloji çözüm ortakları.",
        "Destekleyici: teknopark, hızlandırıcı ve sektör birlikleri; mevzuat odaklı içerik, webinar ve inbound pazarlama.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=11)
    d.note("Pilot tanımı: sınırlı kapsam (ör. tek kritik hizmet + tek düzenleme seti), belirli süre, önceden tanımlı başarı ölçütleri (denetim hazırlık süresi, kanıt tekrar oranı). Pilot çıktısı satış sunumunun kendisi olur.", y)
    d.end()

    # ================================================= SLAYT 12 — KURUCU
    y = d.new_content_slide("Kurucu ve Ekip",
                            "Finansal piyasa derinliği + araştırma disiplini + dijital ürün deneyimi.")
    half = (PAGE_W - 2 * MARGIN - 24) / 2
    c.setFillColor(NAVY); c.setFont("SegoeB", 14)
    c.drawString(MARGIN, y - 6, "Orhan Işık — Kurucu")
    y0 = y - 28
    left = [
        "Finanskor.com ve HisseTakibi.com kurucusu",
        "Sermaye piyasalarında 10+ yıl analiz ve strateji deneyimi",
        "SPF Düzey 3, Türev Araçlar, Kurumsal Yönetim Derecelendirme ve Konut Değerleme lisansları; MYK değerlendirici sertifikası",
        "Algoritmik strateji, finansal veri analizi, model portföy, risk yönetimi ve dijital ürün yönetimi",
    ]
    right = [
        "İstanbul Medeniyet Üniv. – T.C. Çevre Bakanlığı ortak projesinde proje koordinatörlüğü; TÜBİTAK destekli projede araştırmacılık",
        "Yayıncılık ve TRT belgesel projelerinde yazarlık, editörlük, yöneticilik; bütçe, hakediş ve çok paydaşlı koordinasyon",
        "Devam eden doktora çalışmaları; sistematik araştırma ve kaynak doğrulama yetkinliği",
        "Mevcut aşamada sorumluluk: ürün vizyonu, iş modeli, regülasyon araştırması, kullanıcı analizi, süreç tasarımı, geliştirme koordinasyonu",
    ]
    yy = y0
    for it in left:
        c.setFillColor(TEAL); c.circle(MARGIN + 6, yy + 3, 2, fill=1, stroke=0)
        yy = draw_wrapped(c, it, MARGIN + 16, yy, "Segoe", 10, half - 20, leading=13); yy -= 6
    yy = y0
    for it in right:
        c.setFillColor(TEAL); c.circle(MARGIN + half + 30, yy + 3, 2, fill=1, stroke=0)
        yy = draw_wrapped(c, it, MARGIN + half + 40, yy, "Segoe", 10, half - 20, leading=13); yy -= 6
    yb = 96
    c.setFillColor(NAVY_DARK)
    c.roundRect(MARGIN, yb - 30, PAGE_W - 2 * MARGIN, 52, 6, fill=1, stroke=0)
    c.setFillColor(GOLD); c.setFont("SegoeB", 10.5)
    c.drawString(MARGIN + 12, yb + 6, "Büyüme aşaması ekip planı (fon kapsamında):")
    c.setFillColor(WHITE); c.setFont("Segoe", 10)
    c.drawString(MARGIN + 12, yb - 12,
                 "yazılım geliştirme · siber güvenlik · hukuk ve mevzuat doğrulama · kurumsal satış · müşteri uygulamaları")
    d.end()

    # ================================================= SLAYT 13 — FINANSAL PLAN
    y = d.new_content_slide("Finansal İş Planı — Örnek Baz Senaryo",
                            "Muhafazakâr baz senaryoda 3. yılda başa baş bölgesi (yatırım sonrası 30-36 ay varsayımı).",
                            tag="YÖNETİM VARSAYIMI")
    headers = ["Kalem (bin TL)", "Yıl 1", "Yıl 2", "Yıl 3", "Yıl 4", "Yıl 5"]
    rows = [
        ("Müşteri sayısı (finans/kurumsal)", "2 (1/1)", "6 (2/4)", "12 (4/8)", "22 (8/14)", "35 (13/22)"),
        ("Yıllık tekrar eden gelir", "1.500", "5.840", "11.680", "22.640", "36.520"),
        ("Kurulum / hizmet geliri", "300", "800", "1.320", "2.360", "3.480"),
        ("Toplam gelir", "1.800", "6.640", "13.000", "25.000", "40.000"),
        ("Personel gideri", "3.200", "4.500", "6.500", "10.500", "16.000"),
        ("Bulut ve lisans", "600", "900", "1.200", "1.900", "2.800"),
        ("Satış ve pazarlama", "700", "1.200", "1.800", "3.100", "4.700"),
        ("Hukuk ve güvenlik", "900", "1.000", "1.200", "1.600", "2.200"),
        ("Genel yönetim", "400", "600", "800", "1.400", "2.300"),
        ("EBITDA / faaliyet sonucu", "-4.000", "-1.560", "+1.500", "+6.500", "+12.000"),
        ("Yıl sonu kümülatif nakit ihtiyacı", "~4.000", "~5.560", "~4.060", "—", "—"),
    ]
    tx, tw = MARGIN, PAGE_W - 2 * MARGIN
    col0 = tw * 0.34
    coln = (tw - col0) / 5
    rh = 21.5
    ty = y
    c.setFillColor(NAVY)
    c.rect(tx, ty - rh, tw, rh, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("SegoeB", 9.5)
    c.drawString(tx + 8, ty - 15, headers[0])
    for i, htxt in enumerate(headers[1:]):
        c.drawRightString(tx + col0 + (i + 1) * coln - 8, ty - 15, htxt)
    ty -= rh
    for ri, row in enumerate(rows):
        bold = row[0] in ("Toplam gelir", "EBITDA / faaliyet sonucu")
        c.setFillColor(HexColor("#EAF4F1") if bold else (LIGHT if ri % 2 == 0 else WHITE))
        c.rect(tx, ty - rh, tw, rh, fill=1, stroke=0)
        c.setFillColor(INK)
        c.setFont("SegoeB" if bold else "Segoe", 9.3)
        c.drawString(tx + 8, ty - 15, row[0])
        for i, val in enumerate(row[1:]):
            if row[0].startswith("EBITDA"):
                c.setFillColor(RED if val.startswith("-") else GREEN)
            else:
                c.setFillColor(INK)
            c.drawRightString(tx + col0 + (i + 1) * coln - 8, ty - 15, val)
        ty -= rh
    c.setFillColor(GREY); c.setFont("SegoeI", 8.5)
    c.drawString(MARGIN, ty - 12,
                 "Örnek baz senaryo; kesin şirket muhasebesi değildir. Kur varsayımı 1 USD = 40 TL; enflasyon/kur güncellemesi sadeleştirme amacıyla yansıtılmamıştır.")
    c.drawString(MARGIN, ty - 24,
                 "Yıl 1 geliri indirimli pilot varsayımıdır; bugün ücretli müşteri yoktur. Kümülatif nakit ihtiyacı tepe noktası (~5,5-6,0M TL) talep edilen yatırımla tutarlıdır.")
    d.end()

    # ================================================= SLAYT 14 — YATIRIM
    y = d.new_content_slide("Yatırım İhtiyacı ve Fon Kullanımı",
                            "6.000.000 TL (yönetim varsayımı) — ağırlık ürün, güvenlik/hukuk doğrulaması ve pilotlarda.",
                            tag="YÖNETİM VARSAYIMI")
    items = [
        ("Yazılım geliştirme ve teknik insan kaynağı", 40, "2.400.000 TL", TEAL),
        ("Siber güvenlik testleri, hukuk ve mevzuat doğrulaması", 20, "1.200.000 TL", NAVY),
        ("Bulut altyapısı, yazılım lisansları ve teknik araçlar", 15, "900.000 TL", GOLD),
        ("Pilot uygulamalar, satış ve pazarlama", 15, "900.000 TL", HexColor("#4A7FB5")),
        ("İşletme sermayesi ve beklenmeyen giderler", 10, "600.000 TL", GREY),
    ]
    bar_x, bar_w = MARGIN, PAGE_W - 2 * MARGIN
    yy = y - 8
    for label, pct, amount, color in items:
        # etiket satırı: renkli % rozeti + açıklama + tutar
        c.setFillColor(color)
        c.roundRect(bar_x, yy - 20, 44, 20, 4, fill=1, stroke=0)
        c.setFillColor(WHITE); c.setFont("SegoeB", 10)
        c.drawCentredString(bar_x + 22, yy - 14, f"%{pct}")
        c.setFillColor(INK); c.setFont("Segoe", 10.5)
        c.drawString(bar_x + 56, yy - 14, label)
        c.setFont("SegoeB", 10.5)
        c.drawRightString(bar_x + bar_w - 10, yy - 14, amount)
        # ince oransal çubuk (2x ölçek: %50 = tam genişlik)
        c.setFillColor(LIGHT)
        c.roundRect(bar_x, yy - 28, bar_w, 5, 2, fill=1, stroke=0)
        c.setFillColor(color)
        c.roundRect(bar_x, yy - 28, min(bar_w, bar_w * pct / 50), 5, 2, fill=1, stroke=0)
        yy -= 38
    y = yy - 6
    y = d.bullets([
        "Bugüne kadar dış yatırım alınmadı; ürün kurucunun özkaynağı, emeği ve zamanıyla geliştirildi.",
        "CapEx sınırlı (bilgisayar, güvenlik test araçları, lisans, ekipman); harcamaların ağırlığı OpEx niteliğindedir.",
        "Fiziksel ithalat bağımlılığı yok; bulut, lisans ve güvenlik araçlarında sınırlı döviz maliyeti vardır.",
        "İşletme sermayesi ilk 18-24 ayda maaş, bulut, hukuk, güvenlik, pilot ve tahsilat gecikmelerini karşılar.",
    ], MARGIN, y, PAGE_W - 2 * MARGIN, size=10.5, gap=5)
    d.end()

    # ================================================= SLAYT 15 — YOL HARITASI
    y = d.new_content_slide("Yol Haritası ve Kapanış",
                            "Canlı MVP'den, doğrulanmış pilotlar üzerinden bölgesel RegTech oyuncusuna.")
    phases = [
        ("0-6 ay", "Pilot anlaşmaları, ürün sertleştirme, güvenlik testleri, ekip çekirdeği"),
        ("6-12 ay", "Pilot sonuçlarının ölçülmesi, ilk yıllık sözleşmeler, kanal ortaklıkları"),
        ("Yıl 2", "Tekrar eden gelir tabanı, mevzuat paketi genişlemesi, referans müşteriler"),
        ("Yıl 3", "Başa baş bölgesi (yönetim varsayımı), Türkiye ölçeğinde büyüme"),
        ("Yıl 4-5", "Ek modüller, özel kurulum, bölgesel açılım ve AB uyum paketleri"),
    ]
    pw = (PAGE_W - 2 * MARGIN - 4 * 12) / 5
    yy = y - 10
    for i, (period, desc) in enumerate(phases):
        x0 = MARGIN + i * (pw + 12)
        c.setFillColor(NAVY if i > 0 else TEAL)
        c.roundRect(x0, yy - 140, pw, 140, 8, fill=1, stroke=0)
        c.setFillColor(GOLD); c.setFont("SegoeB", 12)
        c.drawString(x0 + 10, yy - 22, period)
        c.setFillColor(WHITE); c.setFont("Segoe", 9)
        ly = yy - 40
        for ln in wrap(c, desc, "Segoe", 9, pw - 20):
            c.drawString(x0 + 10, ly, ln); ly -= 12
    yb = yy - 168
    c.setFillColor(NAVY_DARK)
    c.roundRect(MARGIN, yb - 36, PAGE_W - 2 * MARGIN, 58, 8, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont("SegoeB", 14)
    c.drawCentredString(PAGE_W / 2, yb + 2, "“Uyumun kendisini değil, kanıtlanabilir hâlini yönetiyoruz.”")
    c.setFillColor(GOLD); c.setFont("Segoe", 10.5)
    c.drawCentredString(PAGE_W / 2, yb - 18, "Pilot programımız için görüşmeye açığız  ·  wardproof.com")
    d.end()

    d.save()


if __name__ == "__main__":
    out_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "output")
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, "WARDPROOF_Yatirimci_Sunumu_2026.pdf")
    build(out)
    print("OK:", out)
