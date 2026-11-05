"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MONEY_LINE_SRC_DOC_TYPE = void 0;
exports.coverMoneyLines = coverMoneyLines;
exports.coverPostedVoucher = coverPostedVoucher;
exports.retireMoneyLineRows = retireMoneyLineRows;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../utils/module-service.utils");
const vouchers_errors_1 = require("../../modules/accountsModule/vouchers/vouchers.errors");
exports.MONEY_LINE_SRC_DOC_TYPE = 'VOUCHER';
const CASH_TENDER_TYPE_ID = 1;
const CHEQUE_TENDER_TYPE_ID = 5;
const BANK_TENDER_TYPE_ID = 6;
const logger = new common_1.Logger('MoneyLines');
async function coverMoneyLines(tx, scope, legs) {
    const need = new Map();
    for (const l of legs) {
        const amount = new client_1.Prisma.Decimal(l.amount);
        if (!l.ledgerId || amount.isZero()) {
            continue;
        }
        const key = `${l.ledgerId}|${l.drCr}`;
        const row = need.get(key) ?? { ledgerId: l.ledgerId, drCr: l.drCr, amount: new client_1.Prisma.Decimal(0) };
        row.amount = row.amount.plus(amount);
        need.set(key, row);
    }
    const ids = [...new Set([...need.values()].map((n) => n.ledgerId))];
    if (ids.length === 0) {
        return { written: 0, gaps: [] };
    }
    const money = await tx.$queryRaw `
    SELECT led_id::text, led_name, upper(led_ledger_type) AS kind
      FROM accounts.acc_ledger_master
     WHERE led_id = ANY(${ids}::uuid[]) AND upper(led_ledger_type) IN ('CASH', 'BANK')`;
    if (money.length === 0) {
        return { written: 0, gaps: [] };
    }
    const moneyById = new Map(money.map((m) => [m.led_id, m]));
    const have = await coveredAmounts(tx, scope);
    const gaps = [];
    let written = 0;
    let rowNo = await nextRowNo(tx, scope);
    const partyFor = counterpartOf(legs, scope.partyId ?? null);
    for (const n of need.values()) {
        const ledger = moneyById.get(n.ledgerId);
        if (!ledger) {
            continue;
        }
        const short = n.amount.minus(have.get(`${n.ledgerId}|${n.drCr}`) ?? 0).toDecimalPlaces(2);
        if (short.lessThanOrEqualTo(0)) {
            continue;
        }
        const named = scope.tenders?.find((t) => t.ledgerId === n.ledgerId && t.drCr === n.drCr);
        const pick = named ? await namedTender(tx, named.tenderId) : await tenderFor(tx, scope, ledger);
        if ('code' in pick) {
            gaps.push({
                ledgerId: n.ledgerId,
                ledgerName: ledger.led_name,
                ledgerType: ledger.kind,
                drCr: n.drCr,
                amount: Number(short.toFixed(2)),
                code: pick.code,
                message: pick.message,
            });
            continue;
        }
        await tx.$executeRaw `
      INSERT INTO accounts.acc_tender_detail (
        td_company_id, td_branch_id, td_tenant_id, td_acc_year,
        td_src_module, td_src_doc_type, td_src_doc_id, td_row_no, td_doc_date,
        td_party_ledger_id, td_voucher_id,
        td_tender_id, td_tender_type_id, td_tender_ledger_id, td_dr_cr,
        td_amount, td_total_amt, td_session_id, td_device_id, td_user_id, td_created_by
      ) VALUES (
        ${scope.companyId}::uuid, ${scope.branchId}::uuid, ${scope.tenantId ?? null}::uuid,
        ${scope.accYear}::char(9),
        ${srcModuleOf(scope.srcModule)}, ${exports.MONEY_LINE_SRC_DOC_TYPE}, ${scope.voucherId}::uuid,
        ${rowNo}::int, ${scope.voucherDate}::date,
        ${partyFor(n.ledgerId, n.drCr)}::uuid, ${scope.voucherId}::uuid,
        ${pick.tenderId}::uuid, ${pick.typeId}::int, ${n.ledgerId}::uuid, ${n.drCr}::char(2),
        ${short.toFixed(2)}::numeric, ${short.toFixed(2)}::numeric,
        ${scope.sessionId ?? null}::uuid, ${scope.deviceId ?? null}, ${scope.userId}::uuid,
        ${(scope.createdBy ?? 'SYSTEM').slice(0, 50)}
      )`;
        rowNo += 1;
        written += 1;
    }
    if (gaps.length > 0) {
        if ((scope.srcModule ?? '').toUpperCase() === 'SALES') {
            logger.warn(`${scope.docLabel ?? 'Voucher'} ${scope.voucherId}: ${gaps
                .map((g) => `${g.ledgerName} ${g.drCr} ${g.amount.toFixed(2)} (${g.code})`)
                .join('; ')} — no tender`);
        }
        else {
            (0, module_service_utils_1.throwUnprocessable)(`${scope.docLabel ?? 'The voucher'} has a cash / bank line with no tender`, gaps.map((g) => ({ field: 'tender', code: g.code, message: g.message })));
        }
    }
    return { written, gaps };
}
async function coverPostedVoucher(tx, voucher, opts = {}) {
    const [h] = await tx.$queryRaw `
    SELECT avh_company_id::text AS company_id, avh_branch_id::text AS branch_id,
           avh_tenant_id::text AS tenant_id, to_char(avh_voucher_date, 'YYYY-MM-DD') AS voucher_date,
           avh_src_module AS src_module, avh_src_doc_type AS src_doc_type,
           avh_src_doc_id::text AS src_doc_id, avh_party_id::text AS party_id,
           avh_session_id::text AS session_id, avh_device_id::text AS device_id,
           COALESCE(avh_user_id, avh_status_by)::text AS user_id,
           avh_voucher_refno AS refno, avh_created_by AS created_by
      FROM accounts.acc_voucher_header
     WHERE avh_voucher_id = ${voucher.voucherId}::uuid AND avh_acc_year = ${voucher.accYear}::char(9)`;
    if (!h || !h.user_id) {
        return { written: 0, gaps: [] };
    }
    const legs = await tx.$queryRaw `
    SELECT av_ledger_id::text AS ledger_id, trim(av_dr_cr) AS dr_cr, av_amount AS amount
      FROM accounts.acc_vouchers
     WHERE av_voucher_id = ${voucher.voucherId}::uuid AND av_acc_year = ${voucher.accYear}::char(9)
       AND av_is_deleted = false`;
    return coverMoneyLines(tx, {
        voucherId: voucher.voucherId,
        accYear: voucher.accYear,
        companyId: h.company_id,
        branchId: h.branch_id,
        tenantId: h.tenant_id,
        voucherDate: h.voucher_date,
        srcModule: h.src_module,
        srcDocType: h.src_doc_type,
        srcDocId: h.src_doc_id,
        partyId: h.party_id,
        sessionId: h.session_id,
        deviceId: h.device_id,
        userId: h.user_id,
        createdBy: opts.createdBy ?? h.created_by,
        bankTender: opts.bankTender ?? null,
        tenders: opts.tenders,
        docLabel: h.refno ? `Voucher ${h.refno}` : null,
    }, legs.map((l) => ({ ledgerId: l.ledger_id, drCr: l.dr_cr, amount: l.amount })));
}
async function retireMoneyLineRows(tx, voucherId, actor) {
    await tx.$executeRaw `
    UPDATE accounts.acc_tender_detail
       SET td_is_deleted = true, td_modified_on = now(), td_modified_by = ${actor.slice(0, 50)}
     WHERE td_voucher_id = ${voucherId}::uuid
       AND td_src_doc_type = ${exports.MONEY_LINE_SRC_DOC_TYPE}
       AND td_is_deleted = false`;
}
async function coveredAmounts(tx, scope) {
    const replaced = scope.srcDocType === 'SALE_BILL_RETENDER' ? (scope.srcDocId ?? null) : null;
    const ownDoc = replaced ? null : (scope.srcDocId ?? null);
    const rows = await tx.$queryRaw `
    SELECT l.led::text AS led, trim(t.td_dr_cr) AS side, sum(t.td_amount) AS amt
      FROM accounts.acc_tender_detail t
     CROSS JOIN LATERAL (
           SELECT t.td_tender_ledger_id AS led
           UNION
           SELECT t.td_settle_ledger_id WHERE t.td_settle_ledger_id IS NOT NULL) l
     WHERE t.td_is_deleted = false
       AND (t.td_voucher_id = ${scope.voucherId}::uuid
            OR t.td_src_doc_id = ${scope.voucherId}::uuid
            -- the rows that replaced the voided one: the contra's DEBITS
            OR t.td_replaces_id = ${replaced}::uuid
            -- the document's own rows, not claimed by another voucher (a bill's, a return's)
            OR (t.td_src_doc_id = ${ownDoc}::uuid AND t.td_voucher_id IS NULL))
     GROUP BY 1, 2`;
    const out = new Map();
    const add = (key, amt) => out.set(key, (out.get(key) ?? new client_1.Prisma.Decimal(0)).plus(amt));
    for (const r of rows) {
        add(`${r.led}|${r.side}`, r.amt);
    }
    if (replaced) {
        const [voided] = await tx.$queryRaw `
      SELECT td_tender_ledger_id::text AS led, trim(td_dr_cr) AS side, td_amount AS amt
        FROM accounts.acc_tender_detail WHERE td_id = ${replaced}::uuid`;
        if (voided) {
            add(`${voided.led}|${voided.side === 'DR' ? 'CR' : 'DR'}`, voided.amt);
        }
    }
    return out;
}
async function tenderFor(tx, scope, ledger) {
    if (ledger.kind === 'BANK' && !scope.bankTender) {
        return {
            code: vouchers_errors_1.VCH.MONEY_LINE_NO_TENDER,
            message: `${ledger.led_name} is a bank ledger: its line names the tender it moved by (Bank / NEFT or a ` +
                'cheque) — pick the money side from the tender list',
        };
    }
    const typeId = ledger.kind === 'CASH'
        ? CASH_TENDER_TYPE_ID
        : scope.bankTender === 'CHEQUE'
            ? CHEQUE_TENDER_TYPE_ID
            : BANK_TENDER_TYPE_ID;
    const rows = await tx.$queryRaw `
    SELECT tnd_id::text FROM accounts.acc_tender_master
     WHERE tnd_company_id = ${scope.companyId}::uuid
       AND (tnd_branch_id IS NULL OR tnd_branch_id = ${scope.branchId}::uuid)
       AND tnd_type_id = ${typeId}::int
       AND tnd_is_active AND NOT tnd_is_deleted
       AND (${typeId}::int <> ${BANK_TENDER_TYPE_ID}::int OR tnd_ledger_id = ${ledger.led_id}::uuid)
     ORDER BY (tnd_branch_id IS NULL), tnd_is_default DESC, tnd_display_position, tnd_created_on`;
    if (rows.length === 0) {
        const kind = typeId === CASH_TENDER_TYPE_ID ? 'CASH' : typeId === BANK_TENDER_TYPE_ID ? 'BANK' : 'CHEQUE';
        return {
            code: vouchers_errors_1.VCH.NO_TENDER_FOR_LEDGER,
            message: typeId === BANK_TENDER_TYPE_ID
                ? `${ledger.led_name} has no BANK tender: create its tender in Tender Master (e.g. "${ledger.led_name} – NEFT/IMPS")`
                : `No active ${kind} tender in this branch for ${ledger.led_name}: create it in Tender Master`,
        };
    }
    if (typeId === BANK_TENDER_TYPE_ID && rows.length > 1) {
        return {
            code: vouchers_errors_1.VCH.MONEY_LINE_NO_TENDER,
            message: `More than one BANK tender points at ${ledger.led_name}: the line must name which one`,
        };
    }
    return { tenderId: rows[0].tnd_id, typeId };
}
async function namedTender(tx, tenderId) {
    const [row] = await tx.$queryRaw `
    SELECT tnd_type_id AS type_id FROM accounts.acc_tender_master
     WHERE tnd_id = ${tenderId}::uuid AND NOT tnd_is_deleted`;
    return row
        ? { tenderId, typeId: row.type_id }
        : { code: vouchers_errors_1.VCH.MONEY_LINE_NO_TENDER, message: `Tender ${tenderId} is not a live tender` };
}
async function nextRowNo(tx, scope) {
    const [row] = await tx.$queryRaw `
    SELECT COALESCE(max(td_row_no), 0)::int AS n FROM accounts.acc_tender_detail
     WHERE td_src_doc_id = ${scope.voucherId}::uuid AND td_src_doc_type = ${exports.MONEY_LINE_SRC_DOC_TYPE}`;
    return (row?.n ?? 0) + 1;
}
function counterpartOf(legs, partyId) {
    return (ledgerId, side) => {
        if (partyId) {
            return partyId;
        }
        let best = null;
        for (const l of legs) {
            if (l.drCr === side || l.ledgerId === ledgerId || !l.ledgerId) {
                continue;
            }
            const amount = new client_1.Prisma.Decimal(l.amount);
            if (!best || amount.greaterThan(best.amount)) {
                best = { id: l.ledgerId, amount };
            }
        }
        return best?.id ?? ledgerId;
    };
}
function srcModuleOf(srcModule) {
    const m = (srcModule ?? '').toUpperCase();
    return m === 'TILL' || m === 'SALES' ? m : 'ACCOUNTS';
}
//# sourceMappingURL=money-lines.js.map