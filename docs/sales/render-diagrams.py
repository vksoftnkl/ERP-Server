#!/usr/bin/env python3
"""Render the three sales-module diagrams as PNGs, from what the code does."""
from PIL import Image, ImageDraw, ImageFont
import os

F = "/usr/share/fonts/truetype/dejavu/"
def font(sz, bold=False, mono=False):
    if mono:
        return ImageFont.truetype(F + ("DejaVuSansMono-Bold.ttf" if bold else "DejaVuSansMono.ttf"), sz)
    return ImageFont.truetype(F + ("DejaVuSans-Bold.ttf" if bold else "DejaVuSans.ttf"), sz)

BG      = (250, 249, 246)
INK     = (28, 30, 34)
MUTED   = (110, 116, 124)
LINE    = (196, 198, 202)
WHITE   = (255, 255, 255)

# one hue per document, used across all three sheets
DOC = {
    "SO":   (( 46,  92, 158), (226, 236, 248)),   # sale order
    "DC":   ((150,  84,  20), (250, 238, 222)),   # delivery challan
    "BILL": ((140,  36,  60), (250, 228, 234)),   # sale bill
    "DCR":  ((118,  92,  24), (248, 242, 218)),   # dc return
    "SR":   (( 34, 104,  90), (222, 242, 236)),   # sale return
    "MSTR": (( 92,  76, 140), (236, 232, 248)),   # charge masters / quotation
}
GREY = ((88, 92, 98), (238, 238, 236))

def rbox(d, xy, fill, outline, w=2, r=10):
    d.rounded_rectangle(xy, radius=r, fill=fill, outline=outline, width=w)

def text(d, x, y, s, f, fill=INK, anchor="la"):
    d.text((x, y), s, font=f, fill=fill, anchor=anchor)

def wrapped(d, x, y, s, f, maxw, fill=INK, lh=None):
    lh = lh or f.size + 4
    words, line, yy = s.split(), "", y
    for w in words:
        t = (line + " " + w).strip()
        if d.textlength(t, font=f) > maxw and line:
            text(d, x, yy, line, f, fill); yy += lh; line = w
        else:
            line = t
    if line:
        text(d, x, yy, line, f, fill); yy += lh
    return yy

def arrow(d, p1, p2, color=(120,124,130), w=3, head=11):
    import math
    d.line([p1, p2], fill=color, width=w)
    a = math.atan2(p2[1]-p1[1], p2[0]-p1[0])
    for s in (2.6, -2.6):
        d.line([p2, (p2[0]+head*math.cos(a+s), p2[1]+head*math.sin(a+s))], fill=color, width=w)

def header(d, W, title, subtitle):
    text(d, 60, 44, title, font(40, True))
    text(d, 60, 98, subtitle, font(18), MUTED)
    d.line([(60, 136), (W-60, 136)], fill=LINE, width=2)

def footer(d, W, H, note):
    d.line([(60, H-70), (W-60, H-70)], fill=LINE, width=1)
    text(d, 60, H-56, note, font(14), MUTED)

OUT = "/home/vk/Dev/erp/ERP server/docs/sales"
os.makedirs(OUT, exist_ok=True)

# ════════════════════════════════════════════════════════ 1 · TABLE WIRING
def tables():
    W, H = 2560, 1840
    img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
    header(d, W, "Sales — table wiring",
           "Which tables each document writes. Own tables on the left; everything to the right is shared, and the cell says what the document puts there.")

    # ── the document chain ────────────────────────────────────────────────
    main = [("MSTR", "Quotation", "sale_quotation", "sale_quotation_item"),
            ("SO",   "Sale order", "sale_order", "sale_order_item"),
            ("DC",   "Delivery challan", "sale_dc", "sale_dc_item"),
            ("BILL", "Sale bill", "sale_bill", "sale_bill_item")]
    x0, y0, bw, bh, gap = 60, 172, 300, 92, 76
    text(d, x0, y0-28, "THE DOCUMENT CHAIN  ·  sales schema, each its own header + item table", font(15, True), MUTED)
    pos = {}
    for i, (k, name, t1, t2) in enumerate(main):
        x = x0 + i * (bw + gap)
        st, bgc = DOC[k]
        rbox(d, (x, y0, x + bw, y0 + bh), bgc, st, 2)
        text(d, x + 14, y0 + 12, name, font(18, True), st)
        text(d, x + 14, y0 + 40, t1, font(13, mono=True))
        text(d, x + 14, y0 + 60, t2, font(13, mono=True), MUTED)
        pos[k] = (x, y0)
        if i:
            arrow(d, (x - gap + 4, y0 + bh/2), (x - 5, y0 + bh/2), (150,154,160), 3, 9)
    # the returns hang off what they answer, not off each other
    ry = y0 + bh + 44
    for k, name, t1, t2, over, note in [
        ("DCR", "DC return", "sale_dc_return", "sale_dc_return_item", "DC", "against a POSTED challan"),
        ("SR",  "Sale return", "sale_return", "sale_return_item", "BILL", "against a POSTED bill"),
    ]:
        x = pos[over][0]
        st, bgc = DOC[k]
        rbox(d, (x, ry, x + bw, ry + bh), bgc, st, 2)
        text(d, x + 14, ry + 12, name, font(18, True), st)
        text(d, x + 14, ry + 40, t1, font(13, mono=True))
        text(d, x + 14, ry + 60, t2, font(13, mono=True), MUTED)
        arrow(d, (x + bw/2, ry - 6), (x + bw/2, y0 + bh + 5), st, 3, 9)
        text(d, x, ry + bh + 8, note, font(12), MUTED)
    text(d, pos["MSTR"][0] + bw + 8, y0 + bh + 14, "quotation → bill", font(12), MUTED)
    text(d, pos["DC"][0] - 62, y0 + bh + 14, "a bill may draw on an order line AND / OR a posted challan line", font(12), MUTED)

    # ── the matrix ────────────────────────────────────────────────────────
    cols = [("SO", "Sale\norder"), ("DC", "Delivery\nchallan"), ("BILL", "Sale\nbill"),
            ("DCR", "DC\nreturn"), ("SR", "Sale\nreturn")]
    rows = [
        ("hdr", "stock  ·  moved by the ONE engine, through a shadow voucher", None),
        ("", "stock.stock_voucher / _item", {"DC": "shadow ISSUE", "BILL": "shadow ISSUE", "DCR": "shadow RECEIPT", "SR": "shadow RECEIPT"}),
        ("", "stock.stock_ledger", {"DC": "DC_ISSUE  −", "BILL": "SALE  −", "DCR": "DC_RETURN  +", "SR": "SALE_RETURN  +"}),
        ("", "stock.stock_balance / _lot / _item_cost", {"DC": "phases 4–7", "BILL": "phases 4–7", "DCR": "phases 4–7", "SR": "phases 4–7"}),
        ("", "stock.stock_reservation", {"SO": "reserve", "BILL": "consume"}),
        ("hdr", "accounts  ·  the ledger, the receivable and how it was paid", None),
        ("", "accounts.acc_voucher_header + acc_vouchers", {"SO": "ARc  5", "DC": "DCh  19", "BILL": "Bil  3", "DCR": "DCR  20", "SR": "SRt  18"}),
        ("", "accounts.acc_bill_balance", {"SO": "ADVANCE CR", "BILL": "SALES DR", "SR": "SALES_RETURN CR"}),
        ("", "accounts.acc_bill_adjustment", {"BILL": "set-offs", "SR": "ADJUST"}),
        ("", "accounts.acc_tender_detail", {"SO": "advance", "BILL": "tenders", "SR": "refund"}),
        ("", "accounts.acc_temp_credit", {"BILL": "TEMP_CR"}),
        ("", "accounts.acc_pdc_register", {"SO": "cheque"}),
        ("hdr", "GST  ·  the register every declared document is filed on", None),
        ("", "accounts.acc_voucher_doc_register + _detail", {"DC": "DELIVERY_CHALLAN", "BILL": "INVOICE  +1", "DCR": "CHALLAN  −1", "SR": "CREDIT_NOTE  −1"}),
        ("", "accounts.acc_voucher_doc_einvoice / _ewaybill", {"DC": "e-way only", "BILL": "IRN + e-way", "DCR": "e-way only", "SR": "IRN + e-way"}),
        ("hdr", "sales  ·  caches the next document in the chain reads", None),
        ("", "sales.loyalty_ledger / loyalty_member", {"BILL": "earn + redeem", "SR": "claw-back"}),
        ("", "sales.promotion_usage", {"BILL": "record", "SR": "reverse"}),
        ("", "fulfilment written BACK onto the source", {"DC": "← from bill / DCR", "BILL": "→ sdi_billed_qty", "DCR": "→ sdi_returned_qty", "SR": "→ sb_returned_amt"}),
        ("hdr", "public  ·  shared by every module", None),
        ("", "public.txn_status_log", {"SO": "steps", "DC": "steps", "BILL": "steps", "DCR": "steps", "SR": "steps"}),
        ("", "public.txn_charge_detail", {"SO": "order charges", "DC": "charges", "BILL": "charges", "SR": "charges"}),
        ("", "public.txn_transport_detail", {"DC": "OUTWARD", "BILL": "OUTWARD", "DCR": "INWARD", "SR": "INWARD"}),
        ("", "public.audit_log", {"SO": "every write", "DC": "every write", "BILL": "every write", "DCR": "every write", "SR": "every write"}),
    ]

    mx, my = 60, ry + bh + 40
    label_w, cell_w, cell_h, cgap = 620, 330, 42, 10
    # column heads
    for j, (k, lbl) in enumerate(cols):
        cx = mx + label_w + j * (cell_w + cgap)
        st, bgc = DOC[k]
        rbox(d, (cx, my, cx + cell_w, my + 58), bgc, st, 2, 8)
        for li, ln in enumerate(lbl.split("\n")):
            text(d, cx + cell_w/2, my + 12 + li*20, ln, font(15, True), st, anchor="ma")
    yy = my + 58 + 10
    for kind, label, cells in rows:
        if kind == "hdr":
            d.rectangle((mx, yy, mx + label_w + len(cols)*(cell_w+cgap) - cgap, yy + 30), fill=(238, 237, 233))
            text(d, mx + 12, yy + 7, label.upper(), font(14, True), (86, 90, 96))
            yy += 30 + 6
            continue
        text(d, mx + 12, yy + cell_h/2, label, font(15, mono=True), INK, anchor="lm")
        for j, (k, _) in enumerate(cols):
            cx = mx + label_w + j * (cell_w + cgap)
            v = (cells or {}).get(k)
            if v:
                st, bgc = DOC[k]
                rbox(d, (cx, yy, cx + cell_w, yy + cell_h), bgc, st, 1, 7)
                text(d, cx + cell_w/2, yy + cell_h/2, v, font(14, True), st, anchor="mm")
            else:
                d.line([(cx + cell_w/2 - 7, yy + cell_h/2), (cx + cell_w/2 + 7, yy + cell_h/2)], fill=(214,214,212), width=2)
        yy += cell_h + 5

    # masters band, full width under the matrix
    yy += 18
    st, bgc = DOC["MSTR"]
    rbox(d, (mx, yy, W - 60, yy + 168), bgc, st, 2)
    text(d, mx + 18, yy + 14, "Charge masters", font(18, True), st)
    wrapped(d, mx + 18, yy + 44, "Rate tables, not documents: no posting, no ledger, no stock. A document reads them and copies the money onto its own charge lines.",
            font(13), 560, MUTED)
    cx2 = mx + 620
    for t, sub in [("sales.sale_loading_charges", "weight slab → load / unload rate   (ilc_*)"),
                   ("sales.sale_freight_charges", "distance slab → freight rate   (ifc_*)")]:
        text(d, cx2, yy + 46, t, font(14, mono=True))
        text(d, cx2, yy + 68, sub, font(12), MUTED)
        cx2 += 560
    text(d, mx + 18, yy + 104, "READ-ONLY MASTERS EVERY POST TOUCHES", font(13, True), (86,90,96))
    mx2 = mx + 18
    for t in ["accounts.acc_ledger_map  role → ledger", "accounts.acc_voucher_seq  the number",
              "accounts.acc_tender_master", "public.statutory_limits  269ST / e-way / IRN",
              "public.app_setting_value  sales.*", "public.user_menus  um_can_post …"]:
        text(d, mx2, yy + 130, t, font(12, mono=True), MUTED)
        mx2 += 400
        if mx2 > W - 400:
            mx2 = mx + 18; yy += 20

    footer(d, W, H, "A cancel is never a delete: the stock engine writes reversal rows (sml_is_reversal), the voucher gets a POSTED mirror linked by avh_against_voucher_id, "
                    "and the register row goes CANCELED. The GST gateway is a stub — applicability is computed and filed, nothing is sent.")
    img.save(f"{OUT}/sales-tables-wiring.png")
    print("tables ok")

# ═══════════════════════════════════════════════════ 2 · FUNCTIONAL WIRING
def functional():
    W, H = 2560, 1140
    img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
    header(d, W, "Sales — functional wiring",
           "One posting layer under every document. A screen talks to its own service; the money, the goods and the paperwork are always the shared services below.")

    y = 176
    # layer 1 — controllers
    text(d, 60, y, "HTTP  ·  @Controller, the house envelope { success, message, data } and a per-module exception filter that maps codes", font(15, True), MUTED)
    y += 26
    ctrls = [("SO","/sale-orders","8"), ("DC","/delivery-challans","10"), ("BILL","/bills","14"),
             ("DCR","/dc-returns","7"), ("SR","/sale-returns","9"), ("MSTR","/temp-credits","2"),
             ("MSTR","/sale-loading-charges","3"), ("MSTR","/sale-freight-charges","3"), ("MSTR","/quotations","3")]
    cw, ch, gp = 262, 62, 14
    for i, (k, path, n) in enumerate(ctrls):
        x = 60 + i*(cw+gp)
        st, bgc = DOC[k]
        rbox(d, (x, y, x+cw, y+ch), bgc, st, 2)
        text(d, x+14, y+11, path, font(16, True), st)
        text(d, x+14, y+35, f"{n} routes", font(12), MUTED)
    y += ch + 34

    # layer 2 — document services
    text(d, 60, y, "DOCUMENT SERVICES  ·  the screen's own rules: what may be edited, what the payload means, which guards run", font(15, True), MUTED)
    y += 26
    svcs = [
        ("SO", "sale-order.service", ["save / post / cancel / amend", "fulfilment recompute", "advance receipt + PDC"]),
        ("DC", "delivery-challan.service", ["save via SalesDocStore", "post / amend / cancel", "convert-purpose"]),
        ("BILL", "bill.service  +  bill-lifecycle", ["bill-read · bill-band", "bill-retender · bill-snapshot", "the only /validate + /post pair"]),
        ("DCR", "dc-return.service", ["save via SalesDocStore", "post / cancel  (no amend)", "open-lines off the challan"]),
        ("SR", "sale-return.service", ["save via SalesDocStore", "post / amend / cancel", "CASH · ADJUST · ADVANCE"]),
        ("MSTR", "charge masters + quotation", ["plain CRUD", "no posting, no ledger", "read by the documents"]),
    ]
    sw, sh = 396, 118
    for i, (k, name, lines) in enumerate(svcs):
        x = 60 + i*(sw+14)
        st, bgc = DOC[k]
        rbox(d, (x, y, x+sw, y+sh), bgc, st, 2)
        text(d, x+14, y+12, name, font(17, True), st)
        for li, ln in enumerate(lines):
            text(d, x+14, y+42+li*23, "· " + ln, font(13))
    y2 = y + sh
    y += sh + 30

    # shared store
    rbox(d, (60, y, 60+3*sw+28, y+46), (240, 239, 235), (150,152,156), 2)
    text(d, 74, y+13, "SalesDocStore", font(16, True))
    text(d, 74+180, y+15, "— one DRAFT→POSTED→CANCELLED persistence for challan, DC return and sale return: numbering, line sync, status, trail, audit.", font(13), MUTED)
    rbox(d, (60+3*sw+42, y, W-60, y+46), (240, 239, 235), (150,152,156), 2)
    text(d, 60+3*sw+56, y+13, "bill.service / sale-order.service keep their own persistence (older, wider payloads)", font(13), MUTED)
    y += 46 + 30

    # posting layer panel
    panel_top = y
    rbox(d, (60, y, W-60, y+266), (243, 242, 238), (120, 124, 130), 3)
    text(d, 78, y+14, "SalesPostingModule", font(20, True))
    text(d, 78+250, y+20, "route-less · imported by every document · re-exports StockPostingModule", font(13), MUTED)
    posting = [
        ("SalesPostingService", "the legs, in ONE fixed order.\nΣ DR = Σ CR asserted here.\nreverseLegs writes the mirror."),
        ("SalesStockService", "writes the SHADOW stock voucher\nand posts it through the engine.\nReturns COGS per line."),
        ("DocRegisterService", "the GST register row + detail.\nDecides IRN / e-way applicability."),
        ("StatutoryService", "269ST cash, PAN, HSN digits,\ne-way + IRN windows, CN cut-off."),
        ("SalesContextService", "WHO is calling, what the company\nconfigured, which rights they hold."),
        ("LoyaltyLedgerService", "earn, redeem, claw-back —\none writer for the wallet."),
        ("PromotionUsageService", "scheme budget consumed\nand given back."),
        ("ChargeCarryService", "an order's charge carried onto\nthe bills that fulfil it."),
        ("TransportBandService", "the ship-to / dispatch band,\nfrozen once declared."),
        ("StockReservationService", "order reserves, bill consumes."),
        ("DcFulfilmentService", "re-derives sdi_billed_qty /\n_returned_qty / _open_qty."),
        ("GstGatewayService", "IRN / e-way generation + cancel.\nSTUB — logs, sends nothing."),
        ("SalesDocBlocksService", "the posting + locks blocks\nevery /get answers with."),
    ]
    pw, ph = 332, 84
    for i, (name, desc) in enumerate(posting):
        col, row = i % 7, i // 7
        x = 78 + col*(pw+12); yy = y + 52 + row*(ph+10)
        rbox(d, (x, yy, x+pw, yy+ph), WHITE, (168, 170, 174), 1, 8)
        text(d, x+12, yy+9, name, font(14, True))
        for li, ln in enumerate(desc.split("\n")):
            text(d, x+12, yy+30+li*17, ln, font(11), MUTED)
    y += 266 + 30

    # engines
    text(d, 60, y, "ENGINES & FOUNDATIONS  ·  written once, shared by sales, purchase and stock alike", font(15, True), MUTED)
    y += 26
    eng = [
        ("StockPostingService  →  stock-voucher-posting.helper", "THE one stock engine. Seven phases: resolve lots · attach · write ledger ·\nbalance · moving average · negative-stock policy · lot totals. Cancel = reversal rows."),
        ("voucher-sequence.helper", "allocateVoucherNumber / allocateVoucherSlno.\nAdvisory-locked, per type · company · branch · year · device."),
        ("ledger-map.helper", "role → ledger (SALES, COGS, INVENTORY,\nOUTPUT_CGST …). fn_ledger_for lives here, in TS."),
        ("txn-status-log.helper + AuditLogService", "one row per STEP, one audit row per write."),
    ]
    ew = [900, 560, 540, 460]
    x = 60
    for (name, desc), w in zip(eng, ew):
        rbox(d, (x, y, x+w, y+96), (236, 240, 244), (120, 140, 160), 2)
        text(d, x+14, y+12, name, font(15, True), (40, 70, 100))
        for li, ln in enumerate(desc.split("\n")):
            text(d, x+14, y+40+li*18, ln, font(12), MUTED)
        x += w + 14
    y += 96 + 22
    rbox(d, (60, y, W-60, y+44), (232, 233, 230), (140, 142, 146), 2)
    text(d, W/2, y+14, "PostgreSQL  ·  partitioned by acc_year  ·  GENERATED columns and CHECK constraints are the last word, and the services mirror them rather than replace them",
         font(14, True), (70, 74, 80), anchor="ma")

    # arrows from services into the panel
    for i in range(6):
        sx = 60 + i*(sw+14) + sw/2
        if sx < W-60:
            arrow(d, (sx, y2+4), (sx, panel_top-6), (150, 154, 160), 3, 9)

    footer(d, W, H, "Counted off the imports: the bill takes all thirteen posting services; the sale return ten and the challan / DC return nine each (all three plus SalesDocStore); "
                    "the sale order only SalesContextService + StockReservationService — it reserves stock and takes an advance, it does not move goods.")
    img.save(f"{OUT}/sales-functional-wiring.png")
    print("functional ok")

# ═══════════════════════════════════════════════════════ 3 · API USE CASES
def api():
    W, H = 2560, 1560
    img = Image.new("RGB", (W, H), BG); d = ImageDraw.Draw(img)
    header(d, W, "Sales — API use cases",
           "59 routes across nine controllers. The shape repeats: create a DRAFT, dry-run it, post it through the one-way door, then amend or cancel — never delete.")

    # lifecycle strip
    y = 172
    text(d, 60, y, "THE LIFECYCLE EVERY DOCUMENT SHARES", font(15, True), MUTED)
    y += 26
    steps = [("/create", "DRAFT", "upsert by id · a POSTED id is refused 409"),
             ("/validate", "still DRAFT", "every refusal + warning at once · writes nothing"),
             ("/post", "POSTED", "ONE transaction: stock → legs → register → receivable → status LAST"),
             ("/amend", "POSTED  rev+1", "unwind · re-apply · re-post · refused once declared"),
             ("/cancel", "CANCELLED", "reversal rows + mirror voucher · reason mandatory")]
    bw2, bh2 = 452, 104
    for i, (route, state, note) in enumerate(steps):
        x = 60 + i*(bw2+22)
        rbox(d, (x, y, x+bw2, y+bh2), WHITE, (150, 152, 158), 2)
        text(d, x+16, y+12, route, font(19, True), (40, 44, 50))
        text(d, x+16, y+40, state, font(14, True), (150, 60, 80))
        wrapped(d, x+16, y+62, note, font(12), bw2-32, MUTED, 16)
        if i:
            arrow(d, (x-20, y+bh2/2), (x-5, y+bh2/2), (160,164,170), 3, 9)
    text(d, 60, y+bh2+10, "/delete is DRAFT-only and is a soft delete — a posted document is cancelled, and a cancelled one stays on the books.", font(13), MUTED)
    y += bh2 + 44

    # per-document lanes
    lanes = [
        ("SO", "/sale-orders", 8, [
            ("create", "draft upsert"), ("get", "one order"), ("post", "advance receipt"),
            ("amend", "rev + 1"), ("cancel", "whole order"), ("cancel-lines", "PUT · close open lines"),
            ("pending-amount", "advance still held"), ("delete", "DRAFT only")]),
        ("DC", "/delivery-challans", 10, [
            ("create", "draft upsert"), ("validate", "dry run"), ("post", "goods out + COGS"),
            ("amend", "rev + 1"), ("cancel", "reverses"), ("delete", "DRAFT only"),
            ("get", "+ posting/locks"), ("open-for-bill", "what a bill may take"),
            ("convert-purpose", "SUPPLY / JOB_WORK …"), ("transport", "PUT · the band")]),
        ("BILL", "/bills", 14, [
            ("create", "draft upsert"), ("validate", "dry run"), ("post", "the one-way door"),
            ("amend", "rev + 1"), ("cancel", "reversal"), ("delete", "DRAFT only"),
            ("get", "the whole shape"), ("open-sources", "DC / order lines"),
            ("party-context", "on customer pick"), ("tender-context", "re-tender dialog"),
            ("retender", "how it was paid"), ("delivery-status", "PUT · VERIFIED→DELIVERED"),
            ("update-remarks", "PUT · text only"), ("transport", "PUT · the band")]),
        ("DCR", "/dc-returns", 7, [
            ("create", "against a POSTED DC"), ("post", "goods back at cost"),
            ("cancel", "reverses"), ("delete", "DRAFT only"), ("get", "+ posting/locks"),
            ("open-lines", "what is still open"), ("transport", "PUT · INWARD")]),
        ("SR", "/sale-returns", 9, [
            ("create", "against a POSTED bill"), ("validate", "dry run"),
            ("post", "credit note"), ("amend", "rev + 1"), ("cancel", "reverses"),
            ("delete", "DRAFT only"), ("get", "+ settlement"), ("bill-lines", "what may come back"),
            ("transport", "PUT · INWARD")]),
        ("MSTR", "masters & reads", 11, [
            ("temp-credits/open", "what a walk-in owes"), ("temp-credits/follow-up", "PUT · promise date"),
            ("loading /create", "weight slab rate"), ("loading /get", ""), ("loading /delete", ""),
            ("freight /create", "distance slab rate"), ("freight /get", ""), ("freight /delete", ""),
            ("quotations /create", ""), ("quotations /get", ""), ("quotations /delete", "")]),
    ]
    lane_h, chip_w, chip_h = 142, 232, 54
    for k, base, n, routes in lanes:
        st, bgc = DOC[k]
        rbox(d, (60, y, W-60, y+lane_h), WHITE, st, 2)
        d.rectangle((60, y, 64, y+lane_h), fill=st)
        text(d, 84, y+14, base, font(19, True), st)
        text(d, 84, y+42, f"{n} routes", font(13), MUTED)
        if base == "masters & reads":
            text(d, 84, y+64, "/temp-credits", font(12, mono=True), MUTED)
            text(d, 84, y+82, "/sale-loading-charges", font(12, mono=True), MUTED)
            text(d, 84, y+100, "/sale-freight-charges", font(12, mono=True), MUTED)
            text(d, 84, y+118, "/quotations", font(12, mono=True), MUTED)
        for i, (r, sub) in enumerate(routes):
            col, row = i % 8, i // 8
            cx = 396 + col*(chip_w+12); cy = y + 12 + row*(chip_h + 8)
            rbox(d, (cx, cy, cx+chip_w, cy+chip_h), bgc, st, 1, 8)
            text(d, cx+10, cy+8, r, font(14, True), st)
            if sub:
                text(d, cx+10, cy+30, sub, font(11), MUTED)
        y += lane_h + 12

    # refusal vocabulary
    y += 6
    text(d, 60, y, "WHAT A REFUSAL LOOKS LIKE  ·  the client switches on `code`, never on the message", font(15, True), MUTED)
    y += 26
    codes = [
        ("403", "SALES_RIGHT_POST / _CANCEL / _AMEND / _RETENDER", "a user_menus flag is false"),
        ("409", "SALES_BILL_POSTED · SALES_DOC_CANCELLED · SALES_DC_BILLED", "the row's STATE refuses"),
        ("409", "SALES_IRN_LIVE · SALES_EWB_LIVE · GST_DECLARED_LOCKED", "declared — cancel at the portal first"),
        ("422", "SALES_STOCK_NEGATIVE · SALES_CREDIT_LIMIT · SALES_CASH_LIMIT", "a rule refuses; /validate lists them all"),
        ("422", "SALES_AMOUNT_MISMATCH · SALES_DC_LINE_OVER · SALES_RETURN_OVER_QTY", "the figures do not agree"),
    ]
    cw3 = (W - 120 - 4*14) / 5
    for i, (st_code, names, note) in enumerate(codes):
        x = 60 + i*(cw3+14)
        rbox(d, (x, y, x+cw3, y+96), WHITE, (176, 178, 182), 1, 8)
        text(d, x+14, y+10, st_code, font(22, True), (150, 60, 80))
        wrapped(d, x+14, y+40, names, font(12, mono=True), cw3-28, INK, 16)
        text(d, x+14, y+78, note, font(11), MUTED)

    footer(d, W, H, "Counted from the controllers on 2026-09-22. Every write is Bearer-authenticated, versioned under /api/v1, and every success is { success, message, data }.")
    img.save(f"{OUT}/sales-api-usecases.png")
    print("api ok")

tables(); functional(); api()
