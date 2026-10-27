"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseInvoiceService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const stock_posting_service_1 = require("../../stocks/posting/stock-posting.service");
const stock_voucher_source_1 = require("../../stocks/posting/stock-voucher.source");
const stock_voucher_numbering_helper_1 = require("../../stocks/stock-voucher/stock-voucher-numbering.helper");
const purchase_calc_1 = require("../common/purchase-calc");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
const D = (v) => new client_1.Prisma.Decimal(v ?? 0);
const ZERO = D(0);
const num = (v) => Number(v.toFixed(2));
const DOC_TYPE = 'PURCHASE_BILL';
const SRC_MODULE = 'PURCHASE';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let PurchaseInvoiceService = class PurchaseInvoiceService {
    prisma;
    requestContext;
    vouchers;
    stockPosting;
    constructor(prisma, requestContext, vouchers, stockPosting) {
        this.prisma = prisma;
        this.requestContext = requestContext;
        this.vouchers = vouchers;
        this.stockPosting = stockPosting;
    }
    async preview(dto) {
        const p = await this.prepare(this.prisma, dto);
        return this.calcPayload(p, dto);
    }
    async save(dto) {
        const actor = this.actor();
        const h = dto.header;
        const piId = await this.prisma.$transaction(async (tx) => {
            const p = await this.prepare(tx, dto);
            await this.assertNotDuplicate(tx, dto);
            if (h.post)
                this.assertPrintedAmount(p, dto);
            let id = h.piId ?? null;
            let slno, refno, fromStatus = null;
            if (id) {
                const cur = await tx.purInvoice.findFirst({ where: { piId: id, piAccYear: h.accYear, piIsDeleted: false } });
                if (!cur)
                    (0, purchase_errors_1.purNotFound)(`Purchase invoice ${id} not found`);
                if (cur.piStatus !== 'DRAFT')
                    (0, purchase_errors_1.purConflict)(`${cur.piRefno} is ${cur.piStatus} — only a draft can be edited.`, purchase_errors_1.PUR.NOT_DRAFT, 'piId');
                slno = cur.piSlno;
                refno = cur.piRefno;
                fromStatus = 'DRAFT';
                await tx.purItemAlloc.deleteMany({ where: { piaDocType: DOC_TYPE, piaDocId: id, piaAccYear: h.accYear } });
                await tx.purInvoiceItem.deleteMany({ where: { piiPiId: id, piiAccYear: h.accYear } });
                await tx.$executeRaw `DELETE FROM public.txn_charge_detail WHERE cd_doc_type = ${DOC_TYPE} AND cd_doc_id = ${id}::uuid AND cd_acc_year = ${h.accYear}::bpchar`;
            }
            else {
                ({ slno, refno } = await this.allocateNumber(tx, h.companyId, h.branchId, h.accYear, h.deviceId));
            }
            id = await this.writeDocument(tx, dto, p, id, slno, refno, actor);
            if (!fromStatus) {
                await this.log(tx, dto, id, refno, txn_status_log_helper_1.TxnStatusEvent.CREATED, null, 'DRAFT', actor);
            }
            if (h.post)
                await this.postInTx(tx, id, h.accYear, actor);
            return id;
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(piId, h.accYear);
    }
    async post(piId, accYear) {
        const actor = this.actor();
        await this.prisma.$transaction((tx) => this.postInTx(tx, piId, accYear, actor), { timeout: 60000, maxWait: 10000 });
        return this.get(piId, accYear);
    }
    async get(piId, accYear) {
        const header = await this.prisma.purInvoice.findFirst({ where: { piId, piAccYear: accYear, piIsDeleted: false } });
        if (!header)
            (0, purchase_errors_1.purNotFound)(`Purchase invoice ${piId} not found`);
        const [lines, allocs, charges, supplier] = await Promise.all([
            this.prisma.purInvoiceItem.findMany({ where: { piiPiId: piId, piiAccYear: accYear, piiIsDeleted: false }, orderBy: { piiLineNo: 'asc' } }),
            this.prisma.purItemAlloc.findMany({ where: { piaDocType: DOC_TYPE, piaDocId: piId, piaAccYear: accYear, piaIsDeleted: false }, orderBy: [{ piaRowNo: 'asc' }] }),
            this.prisma.$queryRaw `
        SELECT cd.cd_chg_id AS "chgId", cd.cd_chg_name AS "chgName", cd.cd_on_bill AS "onBill", cd.cd_before_tax AS "beforeTax",
               cd.cd_landing_cost AS "landingCost", cd.cd_rate AS "rate", cd.cd_amount AS "amount", cd.cd_party_id AS "partyId",
               l.led_name AS "partyName", cd.cd_cgst_amt AS "cgst", cd.cd_sgst_amt AS "sgst", cd.cd_igst_amt AS "igst"
          FROM public.txn_charge_detail cd
          LEFT JOIN accounts.acc_ledger_master l ON l.led_id = cd.cd_party_id
         WHERE cd.cd_doc_type = ${DOC_TYPE} AND cd.cd_doc_id = ${piId}::uuid AND cd.cd_acc_year = ${accYear}::bpchar AND cd.cd_is_deleted = false
         ORDER BY cd.cd_slno`,
            this.prisma.$queryRaw `SELECT sup_name FROM purchase.suppliers WHERE sup_id = ${header.piSupplierId}::uuid`,
        ]);
        const byLine = new Map();
        for (const a of allocs)
            byLine.set(a.piaLineId, [...(byLine.get(a.piaLineId) ?? []), a]);
        return jsonSafe({
            header: { ...header, supplierName: supplier[0]?.sup_name ?? null },
            lines: lines.map((l) => ({ ...l, allocs: byLine.get(l.piiId) ?? [] })),
            charges,
        });
    }
    async cancel(dto) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            const cur = await tx.purInvoice.findFirst({ where: { piId: dto.piId, piAccYear: dto.accYear, piIsDeleted: false } });
            if (!cur)
                (0, purchase_errors_1.purNotFound)(`Purchase invoice ${dto.piId} not found`);
            if (cur.piStatus !== 'POSTED')
                (0, purchase_errors_1.purConflict)(`${cur.piRefno} is ${cur.piStatus} — only a posted bill can be cancelled.`, purchase_errors_1.PUR.NOT_POSTED, 'piId');
            const [paid] = await tx.$queryRaw `
        SELECT count(*) AS n FROM accounts.acc_bill_balance
         WHERE abl_src_module = ${SRC_MODULE} AND abl_src_doc_type = ${DOC_TYPE} AND abl_src_doc_id = ${dto.piId}::uuid
           AND abl_is_deleted = false AND (abl_alloc_amount + abl_disc_amount + abl_writeoff_amount) <> 0`;
            if (Number(paid.n) > 0) {
                (0, purchase_errors_1.purConflict)(`${cur.piRefno} is already paid or adjusted — undo the payment allocation first, or enter a debit note.`, purchase_errors_1.PUR.EDIT_LOCKED_PAID, 'piId');
            }
            await (0, purchase_doc_helpers_1.assertNoLiveReturns)(tx, dto.piId, cur.piRefno);
            await (0, purchase_doc_helpers_1.assertShortagesUntouched)(tx, dto.piId, cur.piRefno);
            const rules = this.stockRules();
            const shadows = await tx.$queryRaw `
        SELECT svh_id FROM stock.stock_voucher
         WHERE svh_link_src_module = ${SRC_MODULE} AND svh_link_src_doc_type = ${DOC_TYPE}
           AND svh_link_src_doc_id = ${dto.piId}::uuid AND svh_acc_year = ${dto.accYear}::bpchar
           AND svh_status = 'POSTED' AND svh_is_deleted = false`;
            for (const s of shadows) {
                await this.stockPosting.cancel(tx, new stock_voucher_source_1.StockVoucherSource({ svhId: s.svh_id, accYear: dto.accYear, companyId: cur.piCompanyId, branchId: cur.piBranchId, rules }), { actor, reason: dto.reason, cancelledOn: new Date() });
            }
            if (cur.piPostedVoucherId) {
                await this.vouchers.reverseLegs(tx, cur.piPostedVoucherId, dto.accYear, `Purchase ${cur.piRefno} cancelled: ${dto.reason}`, actor);
            }
            await tx.accBillBalance.updateMany({
                where: { ablSrcModule: SRC_MODULE, ablSrcDocType: DOC_TYPE, ablSrcDocId: dto.piId, ablIsDeleted: false },
                data: { ablIsDeleted: true, ablModifiedBy: actor },
            });
            await tx.purShortage.updateMany({
                where: { pshSrcDocType: DOC_TYPE, pshSrcDocId: dto.piId, pshIsDeleted: false },
                data: { pshIsDeleted: true, pshModifiedBy: actor, pshModifiedOn: new Date() },
            });
            await tx.purInvoice.update({
                where: { piId_piAccYear: { piId: dto.piId, piAccYear: dto.accYear } },
                data: { piStatus: 'CANCELLED', piModifiedBy: actor, piModifiedOn: new Date() },
            });
            await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
                companyId: cur.piCompanyId, branchId: cur.piBranchId, accYear: dto.accYear,
                srcModule: txn_status_log_helper_1.TxnStatusSrcModule.PURCHASE, srcDocType: txn_status_log_helper_1.TxnStatusDocType.PURCHASE_BILL, srcDocId: dto.piId,
                srcDocRefno: cur.piRefno, event: txn_status_log_helper_1.TxnStatusEvent.CANCELLED, fromStatus: 'POSTED', toStatus: 'CANCELLED',
                changedBy: actor, remarks: dto.reason, deviceId: cur.piDeviceId,
            });
        }, { timeout: 60000, maxWait: 10000 });
        return this.get(dto.piId, dto.accYear);
    }
    actor() {
        const u = this.requestContext.getUserId();
        if (!u)
            (0, purchase_errors_1.purRefuse)('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
        return u;
    }
    async prepare(tx, dto) {
        const h = dto.header;
        if ((h.mode ?? 'CREDIT') !== 'CREDIT') {
            (0, purchase_errors_1.purRefuse)('Cash purchase is not built yet — enter it as Credit and pay it in Payment.', purchase_errors_1.PUR.MODE_NOT_SUPPORTED, 'header.mode');
        }
        const [supplier] = await tx.$queryRaw `
      SELECT sup_id, sup_name, sup_state_code, sup_gst_type, sup_gst_no, sup_credit_days
        FROM purchase.suppliers WHERE sup_id = ${h.supplierId}::uuid AND sup_is_deleted = false`;
        if (!supplier)
            (0, purchase_errors_1.purNotFound)(`Supplier ${h.supplierId} not found`, purchase_errors_1.PUR.SUPPLIER_NOT_FOUND, 'header.supplierId');
        const [branch] = await tx.$queryRaw `
      SELECT COALESCE(NULLIF(trim(b.br_state_code), ''), NULLIF(trim(c.comp_state_code), '')) AS state
        FROM public.branch_master b JOIN public.companys c ON c.comp_id = b.br_comp_id
       WHERE b.br_id = ${h.branchId}::uuid`;
        const ourState = (branch?.state ?? '').trim();
        const theirState = (supplier.sup_state_code ?? '').trim() || (supplier.sup_gst_no ?? '').slice(0, 2);
        const interState = !!ourState && !!theirState && ourState !== theirState;
        const gt = (supplier.sup_gst_type ?? 'REGULAR').toUpperCase();
        const taxMode = gt.startsWith('COMP') ? 'COMPOSITION' : gt.startsWith('UNREG') ? 'UNREGISTERED' : 'REGULAR';
        const uomIds = [...new Set(dto.lines.map((l) => l.uomId))];
        const items = new Map((await tx.$queryRaw `
        SELECT iuc.iuc_id, iuc.iuc_item_id, iuc.iuc_to_base_factor,
               COALESCE(base.iuc_id, iuc.iuc_id) AS base_iuc_id,
               im.item_default_tax_id, im.item_hsn_code, im.item_itc_class, im.item_shortage_pct, im.item_name_en AS item_name
          FROM inventory.item_unit_conversion iuc
          JOIN inventory.item_master im ON im.item_id = iuc.iuc_item_id
          LEFT JOIN LATERAL (SELECT b.iuc_id FROM inventory.item_unit_conversion b
                              WHERE b.iuc_item_id = iuc.iuc_item_id AND b.iuc_is_base_unit AND NOT b.iuc_is_deleted
                              ORDER BY b.iuc_unit_slno LIMIT 1) base ON true
         WHERE iuc.iuc_id = ANY(${uomIds}::uuid[]) AND NOT iuc.iuc_is_deleted`).map((r) => [r.iuc_id, r]));
        const problems = [];
        dto.lines.forEach((l, i) => {
            const it = items.get(l.uomId);
            if (!it)
                problems.push({ field: `lines.${i}.uomId`, code: purchase_errors_1.PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: unit ${l.uomId} not found` });
            else if (it.iuc_item_id !== l.itemId)
                problems.push({ field: `lines.${i}.uomId`, code: purchase_errors_1.PUR.UNIT_NOT_FOUND, message: `Line ${l.lineNo}: the unit belongs to another item` });
            const billed = D(l.billedQty), recd = l.receivedQty === undefined ? null : D(l.receivedQty), dmg = D(l.damagedQty);
            if (billed.isZero() && D(l.freeQty).isZero())
                problems.push({ field: `lines.${i}.billedQty`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: no qty` });
            if (recd && recd.plus(dmg).greaterThan(billed))
                problems.push({ field: `lines.${i}.receivedQty`, code: purchase_errors_1.PUR.QTY_INVALID, message: `Line ${l.lineNo}: received + damaged is more than billed — enter the excess separately` });
        });
        for (const l of dto.lines)
            if (!l.taxId)
                l.taxId = items.get(l.uomId)?.item_default_tax_id ?? undefined;
        const taxIds = [...new Set(dto.lines.map((l) => l.taxId).filter((t) => !!t))];
        const taxes = new Map((taxIds.length
            ? await tx.$queryRaw `SELECT tax_id, tax_rate_perc, tax_cess_perc, tax_cess_per_unit FROM inventory.tax_rate_master WHERE tax_id = ANY(${taxIds}::uuid[])`
            : []).map((t) => [t.tax_id, t]));
        const chgIds = [...new Set((dto.charges ?? []).map((c) => c.chgId))];
        const charges = chgIds.length
            ? await tx.$queryRaw `
          SELECT c.chg_id, c.chg_name, c.chg_type, c.chg_method, c.chg_default_rate, c.chg_cost_alloc, c.chg_before_tax,
                 c.chg_tax_apl, c.chg_landing_cost, c.chg_on_bill, c.chg_ledger_code, c.chg_role, c.chg_tax_id, t.tax_rate_perc
            FROM public.charge_master c LEFT JOIN inventory.tax_rate_master t ON t.tax_id = c.chg_tax_id
           WHERE c.chg_id = ANY(${chgIds}::uuid[]) AND c.chg_is_deleted = false AND c.chg_module IN ('P','B')`
            : [];
        const chgById = new Map(charges.map((c) => [c.chg_id, c]));
        const calcCharges = [];
        const payeeIds = new Set();
        (dto.charges ?? []).forEach((c, i) => {
            const m = chgById.get(c.chgId);
            if (!m) {
                problems.push({ field: `charges.${i}.chgId`, code: purchase_errors_1.PUR.CHARGE_NOT_FOUND, message: `Charge ${c.chgId} is not a purchase charge` });
                return;
            }
            if (!m.chg_on_bill && !(c.payees?.length) && !m.chg_ledger_code) {
                problems.push({ field: `charges.${i}.payees`, code: purchase_errors_1.PUR.OFFBILL_NO_PAYEE, message: `${m.chg_name}: say who is owed (pick the loadmen / party)` });
            }
            c.payees?.forEach((p) => payeeIds.add(p.partyId));
            calcCharges.push({
                key: String(i), type: m.chg_type === 'DEDUCT' ? 'DEDUCT' : 'ADD',
                method: m.chg_method ?? 'FIXED',
                rate: c.rate ?? m.chg_default_rate ?? 0, amount: c.amount ?? null,
                alloc: (m.chg_cost_alloc && m.chg_cost_alloc !== 'NONE' ? m.chg_cost_alloc : 'VALUE'),
                beforeTax: m.chg_on_bill ? m.chg_before_tax : false,
                onBill: m.chg_on_bill,
                landingCost: m.chg_on_bill ? m.chg_landing_cost : true,
                taxPct: m.chg_on_bill && m.chg_tax_apl && !m.chg_before_tax ? (m.tax_rate_perc ?? 0) : 0,
                payees: m.chg_on_bill ? [] : (c.payees ?? []).map((p) => ({ partyId: p.partyId, amount: p.amount ?? null })),
            });
        });
        if (payeeIds.size) {
            const led = await tx.$queryRaw `
        SELECT led_id, led_name, led_is_reverse_charge FROM accounts.acc_ledger_master WHERE led_id = ANY(${[...payeeIds]}::uuid[]) AND NOT led_is_deleted`;
            const ok = new Map(led.map((l) => [l.led_id, l]));
            for (const id of payeeIds) {
                const l = ok.get(id);
                if (!l)
                    problems.push({ field: 'charges', code: purchase_errors_1.PUR.OFFBILL_NO_PAYEE, message: `Payee ledger ${id} not found` });
                else if (l.led_is_reverse_charge)
                    problems.push({ field: 'charges', code: purchase_errors_1.PUR.OFFBILL_GTA_REFUSED, message: `${l.led_name} is a reverse-charge (GTA) party — enter its bill in Expense Voucher (RCM).` });
            }
        }
        if (problems.length)
            (0, purchase_errors_1.purRefuseMany)(problems[0].message, problems);
        const calc = (0, purchase_calc_1.calcPurchase)({
            interState,
            supplierTaxMode: taxMode,
            tcsAmount: h.tcsAmount ?? 0,
            roundOffStep: 1,
            charges: calcCharges,
            lines: dto.lines.map((l) => {
                const it = items.get(l.uomId);
                const tax = l.taxId ? taxes.get(l.taxId) : undefined;
                return {
                    key: String(l.lineNo), billedQty: l.billedQty, receivedQty: l.receivedQty ?? null, damagedQty: l.damagedQty ?? 0,
                    freeQty: l.freeQty ?? 0, toBaseFactor: it.iuc_to_base_factor, rate: l.rate,
                    discPct: l.discPct, discPerQty: l.discPerQty, discAmt: l.discAmt, schPct: l.schPct, schPerQty: l.schPerQty, schAmt: l.schAmt,
                    extraDiscAmt: l.extraDiscAmt, gstPct: tax?.tax_rate_perc ?? 0,
                    cessPct: l.cessPct ?? tax?.tax_cess_perc ?? 0, cessPerUnit: l.cessPerUnit ?? tax?.tax_cess_per_unit ?? 0,
                    weight: l.weight ?? 0, itcClass: it.item_itc_class ?? 'ELIGIBLE', shortagePct: it.item_shortage_pct ?? 0,
                };
            }),
        });
        const allocs = new Map();
        const allocProblems = [];
        dto.lines.forEach((l, i) => {
            const out = calc.lines[i];
            const recd = l.receivedQty === undefined || l.receivedQty === null ? D(l.billedQty).minus(D(l.damagedQty)) : D(l.receivedQty);
            const dmg = D(l.damagedQty), free = D(l.freeQty);
            if (l.allocs && l.allocs.length) {
                const rows = l.allocs.map((a) => ({
                    godownId: a.godownId ?? h.godownId, bucket: a.bucket ?? 'SALEABLE', batchNo: a.batchNo?.trim() || null,
                    mfgDate: a.mfgDate ?? null, expiryDate: a.expiryDate ?? null, mrp: a.mrp ?? l.mrp ?? null, salePrice: a.salePrice ?? l.sellA ?? null,
                    serialNo: a.serialNo?.trim() || null, warrantyTo: a.warrantyTo ?? null, sizeId: a.sizeId ?? null, colourId: a.colourId ?? null,
                    model: a.model?.trim() || null, qty: D(a.qty), freeQty: D(a.freeQty),
                }));
                const sum = rows.reduce((s, r) => s.plus(r.qty).plus(r.freeQty), ZERO);
                const want = recd.plus(dmg).plus(free);
                if (!sum.equals(want)) {
                    allocProblems.push({ field: `lines.${i}.allocs`, code: purchase_errors_1.PUR.ALLOC_SUM_MISMATCH, message: `Line ${l.lineNo}: the batch split adds up to ${sum.toString()}, it must be ${want.toString()} (received + damaged + free)` });
                }
                rows.forEach((r, k) => {
                    if (r.serialNo && !r.qty.plus(r.freeQty).equals(1)) {
                        allocProblems.push({ field: `lines.${i}.allocs.${k}.qty`, code: purchase_errors_1.PUR.SERIAL_COUNT, message: `Line ${l.lineNo}: a serial-number row is one piece` });
                    }
                });
                allocs.set(l.lineNo, rows);
            }
            else {
                const base = { godownId: h.godownId, batchNo: null, mfgDate: null, expiryDate: null, mrp: l.mrp ?? null, salePrice: l.sellA ?? null, serialNo: null, warrantyTo: null, sizeId: null, colourId: null, model: null };
                const rows = [];
                if (recd.plus(free).greaterThan(0))
                    rows.push({ ...base, bucket: 'SALEABLE', qty: recd, freeQty: free });
                if (dmg.greaterThan(0))
                    rows.push({ ...base, bucket: 'DAMAGED', qty: dmg, freeQty: ZERO });
                allocs.set(l.lineNo, rows);
            }
            void out;
        });
        if (allocProblems.length)
            (0, purchase_errors_1.purRefuseMany)(allocProblems[0].message, allocProblems);
        return { supplier, interState, taxMode, items, taxes, charges, calc, allocs };
    }
    calcPayload(p, dto) {
        const c = p.calc;
        return {
            interState: p.interState,
            supplierTaxMode: p.taxMode,
            lines: c.lines.map((l, i) => ({ lineNo: dto.lines[i].lineNo, ...decimals(l) })),
            charges: c.charges.map((ch, i) => ({ chgId: dto.charges[i].chgId, ...decimals(ch), payees: ch.payees.map((x) => ({ partyId: x.partyId, amount: x.amount.toFixed(2) })) })),
            totals: decimals({ ...c, lines: undefined, charges: undefined }),
            invoiceAmountPrinted: dto.header.invoiceAmountPrinted,
            difference: D(dto.header.invoiceAmountPrinted).minus(c.netPayable).toFixed(2),
        };
    }
    async assertNotDuplicate(tx, dto) {
        const h = dto.header;
        const dup = await tx.$queryRaw `
      SELECT pi.pi_refno, b.br_name AS br FROM purchase.pur_invoice pi
        LEFT JOIN public.branch_master b ON b.br_id = pi.pi_branch_id
       WHERE pi.pi_company_id = ${h.companyId}::uuid AND pi.pi_supplier_id = ${h.supplierId}::uuid
         AND upper(trim(pi.pi_supplier_inv_no)) = upper(trim(${h.supplierInvNo}))
         AND pi.pi_acc_year = ${h.accYear}::bpchar AND pi.pi_is_deleted = false AND pi.pi_status <> 'CANCELLED'
         AND (${h.piId ?? null}::uuid IS NULL OR pi.pi_id <> ${h.piId ?? null}::uuid)
       LIMIT 1`;
        if (dup.length) {
            (0, purchase_errors_1.purConflict)(`Supplier invoice ${h.supplierInvNo} is already entered as ${dup[0].pi_refno}${dup[0].br ? ` (${dup[0].br})` : ''}.`, purchase_errors_1.PUR.DUPLICATE_SUPPLIER_INVOICE, 'header.supplierInvNo');
        }
    }
    assertPrintedAmount(p, dto) {
        const diff = D(dto.header.invoiceAmountPrinted).minus(p.calc.netPayable);
        if (!diff.isZero()) {
            (0, purchase_errors_1.purRefuse)(`Invoice amount ${D(dto.header.invoiceAmountPrinted).toFixed(2)} does not match the net payable ${p.calc.netPayable.toFixed(2)} (difference ${diff.toFixed(2)}). Check the lines, charges and round off.`, purchase_errors_1.PUR.INVOICE_AMOUNT_MISMATCH, 'header.invoiceAmountPrinted');
        }
    }
    async allocateNumber(tx, companyId, branchId, accYear, deviceId) {
        const devCode = await (0, stock_voucher_numbering_helper_1.resolveDeviceCode)(tx, deviceId);
        const lockKey = ['PUR', companyId, branchId, accYear, deviceId].join('|');
        await tx.$queryRaw `SELECT count(pg_advisory_xact_lock(hashtext('purchase_doc_no'), hashtext(${lockKey})))::int AS locked`;
        const [r] = await tx.$queryRaw `
      SELECT COALESCE(MAX(pi_slno), 0) + 1 AS n FROM purchase.pur_invoice
       WHERE pi_company_id = ${companyId}::uuid AND pi_branch_id = ${branchId}::uuid AND pi_acc_year = ${accYear}::bpchar AND pi_device_id = ${deviceId}::uuid`;
        const slno = BigInt(r.n);
        return { slno, refno: ['PUR', accYear.trim(), devCode, slno.toString().padStart(5, '0')].join('/') };
    }
    async writeDocument(tx, dto, p, id, slno, refno, actor) {
        const h = dto.header;
        const c = p.calc;
        const creditDays = h.creditDays ?? p.supplier.sup_credit_days ?? 0;
        const due = addDays(h.supplierInvDate, creditDays);
        const data = {
            piCompanyId: h.companyId, piBranchId: h.branchId, piAccYear: h.accYear, piDeviceId: h.deviceId, piSessionId: h.sessionId ?? null,
            piSlno: slno, piRefno: refno, piDocDate: new Date(`${h.docDate}T00:00:00Z`), piStatus: 'DRAFT',
            piSupplierId: h.supplierId, piSupplierGstin: p.supplier.sup_gst_no, piSupplierGstType: p.taxMode,
            piSupplierInvNo: h.supplierInvNo.trim(), piSupplierInvDate: new Date(`${h.supplierInvDate}T00:00:00Z`),
            piGoodsReceivedOn: h.goodsReceivedOn ? new Date(`${h.goodsReceivedOn}T00:00:00Z`) : new Date(`${h.docDate}T00:00:00Z`),
            piSourceKind: 'DIRECT', piGodownId: h.godownId, piInvoiceAmountPrinted: D(h.invoiceAmountPrinted), piMode: h.mode ?? 'CREDIT',
            piCreditDays: creditDays, piDueDate: new Date(`${due}T00:00:00Z`), piIsReverseCharge: false,
            piEwbNo: h.ewbNo ?? null, piEwbDate: h.ewbDate ? new Date(`${h.ewbDate}T00:00:00Z`) : null, piIrn: h.irn ?? null, piAckNo: h.ackNo ?? null,
            piGrossAmt: c.gross, piDiscAmt: c.discount, piTaxableAmt: c.taxable, piCgstAmt: c.cgst, piSgstAmt: c.sgst, piIgstAmt: c.igst, piCessAmt: c.cess,
            piChargesOnBill: c.chargesOnBill, piTcsAmt: c.tcs, piRoundOff: c.roundOff, piNetPayable: c.netPayable, piOffbillCharges: c.offbillCharges,
            piShortValue: c.shortValue, piItcEligibleAmt: c.itcEligible, piItcPendingAmt: c.itcPending, piItcIneligibleAmt: c.itcIneligible,
            piPolicy: { invAmountCheck: 'REFUSE', roundOffStep: 1, priceUpdate: 'OFF' },
            piRemarks: h.remarks ?? null,
        };
        let piId;
        if (id) {
            await tx.purInvoice.update({ where: { piId_piAccYear: { piId: id, piAccYear: h.accYear } }, data: { ...data, piModifiedBy: actor, piModifiedOn: new Date(), piRevisionNo: { increment: 1 } } });
            piId = id;
        }
        else {
            const row = await tx.purInvoice.create({ data: { ...data, piCreatedBy: actor }, select: { piId: true } });
            piId = row.piId;
        }
        for (let i = 0; i < dto.lines.length; i++) {
            const l = dto.lines[i];
            const o = c.lines[i];
            const it = p.items.get(l.uomId);
            const row = await tx.purInvoiceItem.create({
                data: {
                    piiPiId: piId, piiCompanyId: h.companyId, piiBranchId: h.branchId, piiAccYear: h.accYear, piiLineNo: l.lineNo,
                    piiItemId: l.itemId, piiUomId: l.uomId, piiBaseUomId: it.base_iuc_id, piiToBaseFactor: it.iuc_to_base_factor,
                    piiHsnCode: it.item_hsn_code, piiWeight: l.weight ?? null,
                    piiBilledQty: D(l.billedQty), piiReceivedQty: D(l.billedQty).minus(D(l.damagedQty)).minus(o.shortQty), piiDamagedQty: D(l.damagedQty),
                    piiShortQty: o.pendingShortQty, piiAbsorbedShortQty: o.absorbedShortQty, piiFreeQty: D(l.freeQty),
                    piiRate: D(l.rate), piiDiscPct: D(l.discPct), piiDiscPerQty: D(l.discPerQty), piiDiscAmt: o.discAmt,
                    piiSchPct: D(l.schPct), piiSchPerQty: D(l.schPerQty), piiSchAmt: o.schAmt, piiExtraDiscAmt: o.extraDiscAmt,
                    piiChrgBeforeTax: o.chrgBeforeTax, piiChrgAfterTax: o.chrgAfterTax,
                    piiGrossAmt: o.gross, piiTaxableAmt: o.taxable, piiTaxId: l.taxId ?? null, piiGstPct: o.gstPct,
                    piiCgstAmt: o.cgst, piiSgstAmt: o.sgst, piiIgstAmt: o.igst, piiCessPct: D(l.cessPct), piiCessPerUnit: D(l.cessPerUnit), piiCessAmt: o.cess,
                    piiTotalAmt: o.total, piiItcEligibleAmt: o.itcEligible, piiItcPendingAmt: o.itcPending, piiItcIneligibleAmt: o.itcIneligible,
                    piiItcClass: o.itcClass, piiLandedCostWot: o.landedCostWot, piiMarkupAPct: l.markupAPct ?? null,
                    piiSellA: l.sellA ?? null, piiSellB: l.sellB ?? null, piiSellC: l.sellC ?? null, piiSellD: l.sellD ?? null, piiMrp: l.mrp ?? null,
                    piiPriceUpdateResult: 'OFF', piiRemarks: l.remarks ?? null, piiCreatedBy: actor,
                },
                select: { piiId: true },
            });
            const rows = p.allocs.get(l.lineNo) ?? [];
            let rowNo = 0;
            for (const a of rows) {
                await tx.purItemAlloc.create({
                    data: {
                        piaCompanyId: h.companyId, piaBranchId: h.branchId, piaAccYear: h.accYear, piaDocType: DOC_TYPE, piaDocId: piId, piaLineId: row.piiId,
                        piaRowNo: ++rowNo, piaGodownId: a.godownId, piaBucket: a.bucket, piaBatchNo: a.batchNo,
                        piaMfgDate: a.mfgDate ? new Date(`${a.mfgDate}T00:00:00Z`) : null, piaExpiryDate: a.expiryDate ? new Date(`${a.expiryDate}T00:00:00Z`) : null,
                        piaMrp: a.mrp, piaSalePrice: a.salePrice, piaSizeId: a.sizeId, piaColourId: a.colourId, piaModel: a.model,
                        piaSerialNo: a.serialNo, piaWarrantyTo: a.warrantyTo ? new Date(`${a.warrantyTo}T00:00:00Z`) : null,
                        piaQty: a.qty, piaFreeQty: a.freeQty, piaCreatedBy: actor,
                    },
                });
            }
        }
        let slnoC = 0;
        for (let i = 0; i < (dto.charges ?? []).length; i++) {
            const ch = dto.charges[i];
            const m = p.charges.find((x) => x.chg_id === ch.chgId);
            const out = c.charges[i];
            const rows = out.payees.length ? out.payees.map((x) => ({ partyId: x.partyId, amount: x.amount })) : [{ partyId: null, amount: out.amount }];
            for (const r of rows) {
                slnoC++;
                await tx.$executeRaw `
          INSERT INTO public.txn_charge_detail (
            cd_doc_type, cd_doc_id, cd_slno, cd_comp_id, cd_branch_id, cd_acc_year, cd_voucher_no,
            cd_chg_id, cd_chg_name, cd_role, cd_method, cd_type, cd_apply_on, cd_ledger_code,
            cd_landing_cost, cd_cost_alloc, cd_before_tax, cd_tax_apl, cd_sep_post,
            cd_rate, cd_amount, cd_tax_perc, cd_cgst_amt, cd_sgst_amt, cd_igst_amt, cd_net_amt,
            cd_on_bill, cd_party_id, cd_created_by)
          VALUES (${DOC_TYPE}, ${piId}::uuid, ${slnoC}::int, ${h.companyId}::uuid, ${h.branchId}::uuid, ${h.accYear}::bpchar, ${slno}::bigint,
            ${m.chg_id}::uuid, ${m.chg_name}, ${m.chg_role}, ${m.chg_method}, ${m.chg_type}, ${m.chg_cost_alloc ?? 'VALUE'}, ${m.chg_ledger_code}::uuid,
            ${m.chg_on_bill ? m.chg_landing_cost : true}, ${m.chg_cost_alloc}, ${m.chg_before_tax}, ${m.chg_tax_apl}, ${!m.chg_landing_cost},
            ${ch.rate ?? m.chg_default_rate ?? 0}::numeric, ${r.amount.abs()}::numeric, ${m.tax_rate_perc ?? 0}::numeric,
            ${rows.length === 1 ? out.cgst : ZERO}::numeric, ${rows.length === 1 ? out.sgst : ZERO}::numeric, ${rows.length === 1 ? out.igst : ZERO}::numeric,
            ${r.amount.abs()}::numeric, ${m.chg_on_bill}, ${r.partyId}::uuid, ${actor})`;
            }
        }
        return piId;
    }
    stockRules() {
        return {
            voucherType: 'RECEIPT', typeCode: DOC_TYPE, displayName: 'Purchase', requiresToGodown: true, requiresFromGodown: false,
            isInward: true, ledgerTxnTypes: ['PURCHASE'], quantityMode: 'QTY', defaultRateSource: 'MANUAL', allowsCount: false,
            allowsToBranch: false, postShape: 'SIMPLE', auditScreenName: 'Purchase', statusDocType: txn_status_log_helper_1.TxnStatusDocType.PURCHASE_BILL,
        };
    }
    async postInTx(tx, piId, accYear, actor) {
        const pi = await tx.purInvoice.findFirst({ where: { piId, piAccYear: accYear, piIsDeleted: false } });
        if (!pi)
            (0, purchase_errors_1.purNotFound)(`Purchase invoice ${piId} not found`);
        if (pi.piStatus !== 'DRAFT')
            (0, purchase_errors_1.purConflict)(`${pi.piRefno} is ${pi.piStatus} — only a draft can be posted.`, purchase_errors_1.PUR.NOT_DRAFT, 'piId');
        const diff = pi.piInvoiceAmountPrinted.minus(pi.piNetPayable);
        if (!diff.isZero()) {
            (0, purchase_errors_1.purRefuse)(`Invoice amount ${pi.piInvoiceAmountPrinted.toFixed(2)} does not match the net payable ${pi.piNetPayable.toFixed(2)} (difference ${diff.toFixed(2)}).`, purchase_errors_1.PUR.INVOICE_AMOUNT_MISMATCH, 'header.invoiceAmountPrinted');
        }
        const lines = await tx.purInvoiceItem.findMany({ where: { piiPiId: piId, piiAccYear: accYear, piiIsDeleted: false }, orderBy: { piiLineNo: 'asc' } });
        const allocs = await tx.purItemAlloc.findMany({ where: { piaDocType: DOC_TYPE, piaDocId: piId, piaAccYear: accYear, piaIsDeleted: false }, orderBy: { piaRowNo: 'asc' } });
        const postedOn = new Date();
        const docDate = isoDate(pi.piDocDate);
        const stockAllocs = allocs.filter((a) => a.piaQty.plus(a.piaFreeQty).greaterThan(0));
        if (stockAllocs.length) {
            const rules = this.stockRules();
            const slno = await (0, stock_voucher_numbering_helper_1.nextStockVoucherSlno)(tx, { companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, voucherType: 'RECEIPT', deviceId: pi.piDeviceId });
            const totalQty = stockAllocs.reduce((s, a) => s.plus(a.piaQty).plus(a.piaFreeQty), ZERO);
            const [hdr] = await tx.$queryRaw `
        INSERT INTO stock.stock_voucher (
          svh_company_id, svh_branch_id, svh_acc_year, svh_device_id, svh_session_id,
          svh_voucher_type, svh_slno, svh_refno, svh_usr_refno, svh_doc_date, svh_doc_datetime,
          svh_to_godown_id, svh_supplier_id, svh_party_ref,
          svh_link_src_module, svh_link_src_doc_type, svh_link_src_doc_id, svh_link_src_acc_year,
          svh_line_count, svh_total_qty, svh_status, svh_rate_source, svh_remarks, svh_created_on, svh_created_by)
        VALUES (${pi.piCompanyId}::uuid, ${pi.piBranchId}::uuid, ${accYear}::bpchar, ${pi.piDeviceId}::uuid, ${pi.piSessionId}::uuid,
          'RECEIPT', ${slno}::bigint, ${`${DOC_TYPE}/${pi.piRefno}/r${pi.piRevisionNo}`}, ${pi.piSupplierInvNo}, ${docDate}::date, ${postedOn},
          ${pi.piGodownId}::uuid, ${pi.piSupplierId}::uuid, ${pi.piSupplierId},
          ${SRC_MODULE}, ${DOC_TYPE}, ${piId}::uuid, ${accYear}::bpchar,
          ${stockAllocs.length}::int, ${totalQty}::numeric, 'DRAFT', 'MANUAL', ${`Purchase ${pi.piRefno} · ${pi.piSupplierInvNo}`}, ${postedOn}, ${actor})
        RETURNING svh_id`;
            const lineById = new Map(lines.map((l) => [l.piiId, l]));
            const values = stockAllocs.map((a, k) => {
                const l = lineById.get(a.piaLineId);
                const f = l.piiToBaseFactor;
                return client_1.Prisma.sql `(
          ${hdr.svh_id}::uuid, ${pi.piCompanyId}::uuid, ${pi.piBranchId}::uuid, ${accYear}::bpchar, ${k + 1}::int, 1,
          ${l.piiItemId}::uuid, ${l.piiUomId}::uuid, ${l.piiBaseUomId}::uuid, ${f}::numeric,
          ${a.piaGodownId}::uuid, ${a.piaBucket}, ${a.piaBatchNo}, ${a.piaMfgDate}::date, ${a.piaExpiryDate}::date,
          ${a.piaMrp}::numeric, ${a.piaSalePrice}::numeric, ${a.piaSerialNo}, ${pi.piSupplierId}::uuid,
          ${a.piaQty}::numeric, ${a.piaQty.times(f)}::numeric, ${a.piaFreeQty}::numeric, ${a.piaFreeQty.times(f)}::numeric,
          ${l.piiLandedCostWot}::numeric, ${l.piiLandedCostWot}::numeric, ${l.piiLandedCostWot}::numeric, 0::numeric,
          ${postedOn}, ${actor})`;
            });
            await tx.$executeRaw `
        INSERT INTO stock.stock_voucher_item (
          svi_voucher_id, svi_company_id, svi_branch_id, svi_acc_year, svi_line_no, svi_split_no,
          svi_item_id, svi_uom_id, svi_base_uom_id, svi_to_base_factor,
          svi_godown_id, svi_bucket, svi_batch_no, svi_mfg_date, svi_expiry_date,
          svi_mrp, svi_sale_price, svi_serial_no, svi_supplier_id,
          svi_qty, svi_base_qty, svi_free_qty, svi_free_base_qty,
          svi_cost_rate, svi_cost_rate_wot, svi_landed_rate, svi_tax_perc,
          svi_created_on, svi_created_by) VALUES ${client_1.Prisma.join(values)}`;
            await this.stockPosting.post(tx, new stock_voucher_source_1.StockVoucherSource({ svhId: hdr.svh_id, accYear, companyId: pi.piCompanyId, branchId: pi.piBranchId, rules }), { actor, postedOn, ledgerSource: { srcModule: SRC_MODULE, srcDocType: DOC_TYPE, srcRefno: pi.piRefno, partyId: pi.piSupplierId } });
            const [moved] = await tx.$queryRaw `
        SELECT SUM(sml_qty + sml_free_qty) AS qty FROM stock.stock_ledger
         WHERE sml_src_doc_id = ${hdr.svh_id}::uuid AND sml_acc_year = ${accYear}::bpchar AND sml_is_reversal = false AND sml_is_deleted = false`;
            if (!D(moved?.qty).toDecimalPlaces(4).equals(totalQty.toDecimalPlaces(4))) {
                throw new Error(`${purchase_errors_1.PUR.STOCK_QTY_MISMATCH}: ${pi.piRefno} moved ${D(moved?.qty).toString()} against ${totalQty.toString()}`);
            }
            const lots = await tx.$queryRaw `
        SELECT svi_line_no, svi_lot_id, svi_id FROM stock.stock_voucher_item WHERE svi_voucher_id = ${hdr.svh_id}::uuid AND svi_acc_year = ${accYear}::bpchar`;
            for (const r of lots) {
                const a = stockAllocs[r.svi_line_no - 1];
                if (a)
                    await tx.purItemAlloc.update({ where: { piaId_piaAccYear: { piaId: a.piaId, piaAccYear: accYear } }, data: { piaLotId: r.svi_lot_id, piaSviId: r.svi_id, piaSviAccYear: accYear } });
            }
        }
        const [vt] = await tx.$queryRaw `SELECT vchr_type_id AS id FROM accounts.acc_voucher_types WHERE vchr_type_code = 'PUR' AND vchr_is_active LIMIT 1`;
        if (!vt)
            (0, purchase_errors_1.purRefuse)('Voucher type PUR is missing (migration 20261028100000).', purchase_errors_1.PUR.VOUCHER_TYPE_MISSING);
        const nature = pi.piIgstAmt.greaterThan(0) ? 'INTER' : 'INTRA';
        const legs = [];
        const add = (leg) => { if (Math.abs(leg.amount) >= 0.005)
            legs.push(leg); };
        for (const l of lines) {
            const tax = l.piiCgstAmt.plus(l.piiSgstAmt).plus(l.piiIgstAmt).plus(l.piiCessAmt);
            if (tax.isZero())
                continue;
            const eligShare = l.piiItcEligibleAmt.dividedBy(tax);
            const heads = [['INPUT_CGST', l.piiCgstAmt], ['INPUT_SGST', l.piiSgstAmt], ['INPUT_IGST', l.piiIgstAmt], ['INPUT_CESS', l.piiCessAmt]];
            let given = ZERO;
            heads.forEach(([role, amt], k) => {
                if (amt.isZero())
                    return;
                const isLast = heads.slice(k + 1).every(([, a]) => a.isZero());
                const part = isLast ? l.piiItcEligibleAmt.minus(given) : amt.times(eligShare).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
                given = given.plus(part);
                add({ role, drCr: 'DR', amount: num(part), taxId: l.piiTaxId, supplyNature: nature, roleTag: role, field: `lines.${l.piiLineNo}` });
            });
            add({ role: 'INPUT_TAX_PENDING', drCr: 'DR', amount: num(l.piiItcPendingAmt), roleTag: 'INPUT_TAX_PENDING' });
        }
        add({ role: 'SHORTAGE_RECEIVABLE', drCr: 'DR', amount: num(pi.piShortValue), roleTag: 'SHORTAGE_RECEIVABLE' });
        const chargeRows = await tx.$queryRaw `
      SELECT cd_on_bill, cd_landing_cost, cd_before_tax, cd_type, cd_amount, cd_ledger_code, cd_party_id, cd_cgst_amt, cd_sgst_amt, cd_igst_amt, cd_chg_name
        FROM public.txn_charge_detail WHERE cd_doc_type = ${DOC_TYPE} AND cd_doc_id = ${piId}::uuid AND cd_acc_year = ${accYear}::bpchar AND cd_is_deleted = false`;
        for (const r of chargeRows) {
            const sign = r.cd_type === 'DEDUCT' ? -1 : 1;
            if (r.cd_on_bill) {
                if (!r.cd_landing_cost) {
                    const amt = sign * num(r.cd_amount);
                    add({ ledgerId: r.cd_ledger_code, drCr: amt >= 0 ? 'DR' : 'CR', amount: Math.abs(amt), remarks: r.cd_chg_name });
                }
                for (const [role, v] of [['INPUT_CGST', r.cd_cgst_amt], ['INPUT_SGST', r.cd_sgst_amt], ['INPUT_IGST', r.cd_igst_amt]]) {
                    const amt = sign * num(v);
                    add({ role, drCr: amt >= 0 ? 'DR' : 'CR', amount: Math.abs(amt), supplyNature: nature, roleTag: role, remarks: r.cd_chg_name });
                }
            }
            else {
                add({ ledgerId: r.cd_party_id ?? r.cd_ledger_code, drCr: 'CR', amount: num(r.cd_amount), remarks: `${r.cd_chg_name} · ${pi.piRefno}`, docRefno: pi.piRefno });
            }
        }
        add({ role: 'TCS_RECEIVABLE', drCr: 'DR', amount: num(pi.piTcsAmt), roleTag: 'TCS_RECEIVABLE' });
        if (!pi.piRoundOff.isZero())
            add({ role: 'ROUND_OFF', drCr: pi.piRoundOff.greaterThan(0) ? 'DR' : 'CR', amount: Math.abs(num(pi.piRoundOff)), roleTag: 'ROUND_OFF' });
        add({ ledgerId: pi.piSupplierId, drCr: 'CR', amount: num(pi.piNetPayable), remarks: `Bill ${pi.piSupplierInvNo}`, docRefno: pi.piRefno });
        const cents = (x) => Math.round(x * 100);
        const crTotal = legs.filter((g) => g.drCr === 'CR').reduce((s2, g) => s2 + cents(g.amount), 0);
        const drTotal = legs.filter((g) => g.drCr === 'DR').reduce((s2, g) => s2 + cents(g.amount), 0);
        const inventory = (crTotal - drTotal) / 100;
        if (inventory < 0)
            throw new Error(`Purchase ${pi.piRefno}: stock value came out negative (${inventory})`);
        add({ role: 'INVENTORY', drCr: 'DR', amount: inventory, remarks: `Purchase ${pi.piRefno}`, roleTag: 'INVENTORY' });
        const posted = await this.vouchers.postLegs(tx, {
            header: {
                companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, voucherTypeId: vt.id, voucherDate: docDate,
                srcModule: SRC_MODULE, srcDocType: DOC_TYPE, srcDocId: piId, docLabel: 'Purchase', docRefno: pi.piRefno, docDate,
                usrRefno: pi.piSupplierInvNo, docAmount: num(pi.piNetPayable), roundOff: num(pi.piRoundOff), partyId: pi.piSupplierId,
                userId: actor, sessionId: pi.piSessionId, deviceId: pi.piDeviceId, remarks: pi.piRemarks ?? `Purchase ${pi.piSupplierInvNo}`,
                createdBy: actor, presetRefno: pi.piRefno, presetNo: pi.piSlno,
            },
            legs,
        });
        const billRow = async (partyId, amount, narration, dueDate, refSuffix) => {
            if (!amount.greaterThan(0))
                return;
            await tx.accBillBalance.create({
                data: {
                    ablCompanyId: pi.piCompanyId, ablBranchId: pi.piBranchId, ablAccYear: accYear, ablPartyId: partyId, ablBillType: 'PURCHASE',
                    ablSrcModule: SRC_MODULE, ablSrcDocType: DOC_TYPE, ablSrcDocId: piId, ablSrcAccYear: accYear,
                    ablVoucherId: posted.voucherId, ablVoucherTypeId: vt.id, ablVoucherNo: pi.piSlno, ablVoucherDate: new Date(`${docDate}T00:00:00Z`),
                    ablVoucherRefno: pi.piRefno, ablDocRefno: refSuffix ? `${pi.piRefno}/${refSuffix}` : pi.piRefno,
                    ablDocDate: pi.piSupplierInvDate, ablDueDate: dueDate, ablCreditDays: dueDate ? (pi.piCreditDays ?? 0) : 0,
                    ablDrCr: 'CR', ablBillAmount: amount, ablNarration: narration, ablCreatedBy: actor,
                },
            });
        };
        await billRow(pi.piSupplierId, pi.piNetPayable, `Purchase bill ${pi.piSupplierInvNo} (${pi.piRefno})`, pi.piDueDate, null);
        let k = 0;
        for (const r of chargeRows.filter((x) => !x.cd_on_bill)) {
            k++;
            await billRow(r.cd_party_id ?? r.cd_ledger_code, r.cd_amount, `${r.cd_chg_name} — ${pi.piRefno}`, null, `C${k}`);
        }
        for (const l of lines) {
            if (!l.piiShortQty.greaterThan(0))
                continue;
            const value = l.piiBilledQty.isZero() ? ZERO : l.piiTaxableAmt.times(l.piiShortQty).dividedBy(l.piiBilledQty).toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
            await tx.purShortage.create({
                data: {
                    pshCompanyId: pi.piCompanyId, pshBranchId: pi.piBranchId, pshAccYear: accYear, pshSupplierId: pi.piSupplierId, pshItemId: l.piiItemId,
                    pshSrcDocType: DOC_TYPE, pshSrcDocId: piId, pshSrcDocYear: accYear, pshSrcItemId: l.piiId, pshSrcDocRefno: pi.piRefno,
                    pshReason: 'SHORT_BILL', pshQtyBase: l.piiShortQty.times(l.piiToBaseFactor), pshValue: value, pshGstPending: l.piiItcPendingAmt,
                    pshOriginCostRate: l.piiLandedCostWot, pshCreatedBy: actor,
                },
            });
        }
        await tx.purInvoice.update({ where: { piId_piAccYear: { piId, piAccYear: accYear } }, data: { piStatus: 'POSTED', piPostedVoucherId: posted.voucherId, piModifiedBy: actor, piModifiedOn: postedOn } });
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: pi.piCompanyId, branchId: pi.piBranchId, accYear, srcModule: txn_status_log_helper_1.TxnStatusSrcModule.PURCHASE, srcDocType: txn_status_log_helper_1.TxnStatusDocType.PURCHASE_BILL,
            srcDocId: piId, srcDocRefno: pi.piRefno, event: txn_status_log_helper_1.TxnStatusEvent.POSTED, fromStatus: 'DRAFT', toStatus: 'POSTED', changedBy: actor, deviceId: pi.piDeviceId,
        });
    }
    async log(tx, dto, id, refno, event, from, to, actor) {
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: dto.header.companyId, branchId: dto.header.branchId, accYear: dto.header.accYear,
            srcModule: txn_status_log_helper_1.TxnStatusSrcModule.PURCHASE, srcDocType: txn_status_log_helper_1.TxnStatusDocType.PURCHASE_BILL, srcDocId: id, srcDocRefno: refno,
            event, fromStatus: from, toStatus: to, changedBy: actor, deviceId: dto.header.deviceId,
        });
    }
};
exports.PurchaseInvoiceService = PurchaseInvoiceService;
exports.PurchaseInvoiceService = PurchaseInvoiceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        voucher_posting_service_1.VoucherPostingService,
        stock_posting_service_1.StockPostingService])
], PurchaseInvoiceService);
function jsonSafe(v) {
    if (typeof v === 'bigint')
        return v.toString();
    if (Array.isArray(v))
        return v.map((x) => jsonSafe(x));
    if (v && typeof v === 'object' && !(v instanceof Date) && !(v instanceof client_1.Prisma.Decimal)) {
        const out = {};
        for (const [k, x] of Object.entries(v))
            out[k] = jsonSafe(x);
        return out;
    }
    return v;
}
function addDays(iso, days) {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
function decimals(o) {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
        if (v === undefined)
            continue;
        out[k] = v instanceof client_1.Prisma.Decimal ? v.toFixed(Math.max(2, Math.min(6, v.decimalPlaces()))) : v;
    }
    return out;
}
void UUID;
//# sourceMappingURL=purchase-invoice.service.js.map