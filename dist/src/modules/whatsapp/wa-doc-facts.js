"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readDocFacts = readDocFacts;
exports.readParty = readParty;
exports.shopPhone = shopPhone;
exports.inr = inr;
exports.dmy = dmy;
exports.templateParams = templateParams;
exports.pdfName = pdfName;
const client_1 = require("@prisma/client");
const wa_errors_1 = require("./wa-errors");
const wa_constants_1 = require("./wa.constants");
const SO_POSTED = ['CONFIRMED', 'PARTIAL', 'COMPLETED', 'CLOSED', 'EXPIRED'];
const iso = (d) => (d ? d.toISOString().slice(0, 10) : '');
async function readDocFacts(client, p) {
    const kind = wa_constants_1.WA_KIND_OF_DOC[p.docType];
    if (p.docType !== 'SALES_ORDER') {
        notFound(p);
    }
    const [r] = await client.$queryRaw `
    SELECT so_branch_id, so_order_refno, so_order_date, so_order_amt, so_status, so_cust_id, so_cust_name,
           so_cust_phone, so_contact_phone, so_device_id
      FROM sales.sale_order
     WHERE so_id = ${p.docId}::uuid AND so_acc_year = ${p.accYear}::bpchar
       AND so_company_id = ${p.companyId}::uuid AND so_is_deleted = false`;
    if (!r)
        notFound(p);
    return {
        docType: p.docType,
        kind,
        docId: p.docId,
        accYear: p.accYear,
        companyId: p.companyId,
        branchId: r.so_branch_id,
        refno: r.so_order_refno ?? '',
        date: iso(r.so_order_date),
        amount: new client_1.Prisma.Decimal(r.so_order_amt ?? 0),
        status: r.so_status,
        posted: SO_POSTED.includes(r.so_status),
        cancelled: r.so_status === 'CANCELLED',
        partyId: r.so_cust_id,
        docPartyName: r.so_cust_name,
        docPhone: r.so_cust_phone || r.so_contact_phone,
        vchrTypeId: wa_constants_1.WA_VT.ORDER,
        deviceId: r.so_device_id,
        printPurposeCode: 'SALE_ORDER',
    };
}
function notFound(p) {
    (0, wa_errors_1.waRefuse)(wa_constants_1.WA_CODES.DOC_NOT_FOUND, `No ${p.docType} ${p.docId} in year ${p.accYear} for this company`, 'docId');
}
async function readParty(client, partyId) {
    const [r] = await client.$queryRaw `
    SELECT led_id, led_name, led_whatsapp_no, led_phone1, led_phone2, led_wa_lang,
           led_wa_reminders_off_on, led_wa_all_off_on
      FROM accounts.acc_ledger_master
     WHERE led_id = ${partyId}::uuid AND led_is_deleted = false`;
    return r
        ? {
            partyId: r.led_id,
            name: r.led_name,
            whatsapp: r.led_whatsapp_no,
            phone1: r.led_phone1,
            phone2: r.led_phone2,
            lang: r.led_wa_lang,
            remindersOffOn: r.led_wa_reminders_off_on,
            allOffOn: r.led_wa_all_off_on,
        }
        : null;
}
async function shopPhone(client, companyId, branchId) {
    const [r] = await client.$queryRaw `
    SELECT COALESCE(NULLIF(btrim(b.br_phone), ''), NULLIF(btrim(b.br_tel), ''),
                    NULLIF(btrim(c.comp_phone), ''), NULLIF(btrim(c.comp_tel), '')) AS phone
      FROM public.companys c
      LEFT JOIN public.branch_master b ON b.br_id = ${branchId}::uuid
     WHERE c.comp_id = ${companyId}::uuid`;
    return r?.phone ?? null;
}
function inr(v) {
    const d = new client_1.Prisma.Decimal(v).abs().toFixed(2);
    const [whole, frac] = d.split('.');
    const last3 = whole.slice(-3);
    const rest = whole.slice(0, -3);
    const grouped = rest ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',')},${last3}` : last3;
    return `${grouped}.${frac}`;
}
function dmy(isoDate) {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate ?? '');
    return m ? `${m[3]}-${m[2]}-${m[1]}` : '';
}
function templateParams(names, values) {
    const out = {};
    for (const n of names) {
        const v = (values[n] ?? '').toString().replace(/\s+/g, ' ').trim();
        out[n] = (v || '-').slice(0, 1024);
    }
    return out;
}
function pdfName(prefix, ref) {
    const safe = `${prefix}-${ref}`.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    return `${safe.slice(0, 90) || prefix}.pdf`;
}
//# sourceMappingURL=wa-doc-facts.js.map