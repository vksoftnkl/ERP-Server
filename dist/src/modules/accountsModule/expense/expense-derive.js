"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deriveExpense = deriveExpense;
const client_1 = require("@prisma/client");
const ledger_map_helper_1 = require("../ledgerRole/ledger-map.helper");
const voucher_facts_1 = require("../vouchers/voucher-facts");
const vouchers_errors_1 = require("../vouchers/vouchers.errors");
const expense_enum_1 = require("./types/expense-enum");
const ZERO = new client_1.Prisma.Decimal(0);
const HUNDRED = new client_1.Prisma.Decimal(100);
const CASH_TENDER_TYPE_ID = 1;
const round2 = (v) => v.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
const num = (v) => Number(v.toFixed(2));
const GST_COMPONENTS = ['CGST', 'SGST', 'IGST', 'CESS'];
function deriveExpense(draft, facts, ctx) {
    const bill = draft.gstBill;
    let gstHead = null;
    if (bill) {
        const gstin = (bill.supplierGstin ?? facts.party?.gstin ?? '').trim().toUpperCase();
        if (!facts.party) {
            (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.GST_INCOMPLETE, 'An expense with a GST bill names its supplier ledger (partyId): GSTR-2 files the bill under it', { field: 'partyId' });
        }
        if (!/^\d{2}[A-Z0-9]{13}$/.test(gstin)) {
            (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.GST_INCOMPLETE, 'A GST bill needs the supplier’s GSTIN — type it, or give the supplier ledger one', { field: 'gstBill.supplierGstin' });
        }
        const pos = bill.placeOfSupplyCode ?? (gstin.slice(0, 2) || facts.company.stateCode);
        gstHead = {
            supplyNature: pos === facts.company.stateCode ? 'INTRA' : 'INTER',
            placeOfSupplyCode: pos,
            supplierGstin: gstin,
            invoiceNo: bill.invoiceNo,
            invoiceDate: bill.invoiceDate,
        };
    }
    const lineLegs = [];
    const costCentres = [];
    const lines = [];
    const gstLines = [];
    const taxLegs = new Map();
    const unmapped = new Set();
    let total = ZERO;
    let taxable = ZERO;
    const tax = { cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO };
    if (draft.lines.length === 0) {
        (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.NO_LINES, 'An expense voucher has at least one line', {
            field: 'lines',
        });
    }
    const seenRows = new Set();
    for (const line of draft.lines) {
        const field = `lines.${line.rowNo}`;
        if (seenRows.has(line.rowNo)) {
            (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.NO_LINES, `Row ${line.rowNo} appears twice`, {
                field,
                line: line.rowNo,
            });
        }
        seenRows.add(line.rowNo);
        const ledger = facts.ledgers.get(line.ledgerId);
        if (!ledger || !ledger.isActive || ledger.isDeleted) {
            (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.LEDGER_NOT_EXPENSE, `Row ${line.rowNo}: not a live ledger of this company`, { field: `${field}.ledgerId`, line: line.rowNo });
        }
        else if (!facts.expenseLedgerIds.has(ledger.ledId) ||
            ledger.isParty ||
            (0, voucher_facts_1.isMoneyLedger)(ledger)) {
            (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.LEDGER_NOT_EXPENSE, `Row ${line.rowNo}: ${ledger.name} is not an expense ledger — a supplier is paid by a bill-wise ` +
                'Payment, money is moved by a contra', { field: `${field}.ledgerId`, line: line.rowNo });
        }
        const amount = round2(new client_1.Prisma.Decimal(String(line.amount)));
        if (amount.lte(0)) {
            (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.NO_LINES, `Row ${line.rowNo}: the amount must be above zero`, {
                field: `${field}.amount`,
                line: line.rowNo,
            });
        }
        let lineTax = { cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO };
        let itcEligibility = null;
        let taxName = null;
        let costTax = ZERO;
        if (bill && gstHead) {
            const rate = line.taxId ? facts.taxRates.get(line.taxId) : undefined;
            if (!line.taxId) {
                (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.GST_INCOMPLETE, `Row ${line.rowNo}: pick the GST rate`, {
                    field: `${field}.taxId`,
                    line: line.rowNo,
                });
            }
            else if (!rate || !rate.isActive) {
                (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.GST_RATE_MISSING, `Row ${line.rowNo}: the GST rate named is not an active rate`, { field: `${field}.taxId`, line: line.rowNo });
            }
            else {
                taxName = rate.name;
                const whole = round2(amount.mul(rate.ratePerc).div(HUNDRED));
                lineTax =
                    gstHead.supplyNature === 'INTER'
                        ? { cgst: ZERO, sgst: ZERO, igst: whole, cess: ZERO }
                        : {
                            cgst: round2(whole.div(2)),
                            sgst: whole.minus(round2(whole.div(2))),
                            igst: ZERO,
                            cess: ZERO,
                        };
                lineTax.cess =
                    rate.cessBasis === 'PERCENT' || rate.cessBasis === 'BOTH'
                        ? round2(amount.mul(rate.cessPerc).div(HUNDRED))
                        : ZERO;
                const isService = (line.hsn ?? '').trim().startsWith('99');
                itcEligibility =
                    line.itc === false
                        ? 'INELIGIBLE'
                        : ((0, voucher_facts_1.itcClassOf)(ledger?.itcEligibility) ?? (isService ? 'INPUT_SERVICES' : 'INPUTS'));
                const lineTaxTotal = lineTax.cgst.plus(lineTax.sgst).plus(lineTax.igst).plus(lineTax.cess);
                const taxLedgers = {
                    CGST: null,
                    SGST: null,
                    IGST: null,
                    CESS: null,
                };
                if (itcEligibility === 'INELIGIBLE') {
                    costTax = lineTaxTotal;
                }
                else {
                    for (const c of GST_COMPONENTS) {
                        const value = lineTax[c.toLowerCase()];
                        if (value.isZero()) {
                            continue;
                        }
                        const role = `INPUT_${c}`;
                        const hit = facts.roleLedgers.get((0, ledger_map_helper_1.roleLedgerKey)({ role, taxId: rate.taxId, supplyNature: gstHead.supplyNature })) ?? null;
                        if (!hit) {
                            if (!unmapped.has(role)) {
                                unmapped.add(role);
                                (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.GST_LEDGER_UNMAPPED, `No ledger is mapped for ${role} (${gstHead.supplyNature === 'INTRA' ? 'intra' : 'inter'}-state) — map it in Posting Ledgers (menu 250)`, { field: `${field}.taxId`, line: line.rowNo });
                            }
                            continue;
                        }
                        taxLedgers[c] = hit.ledgerId;
                        const cur = taxLegs.get(hit.ledgerId);
                        if (cur) {
                            cur.amount = cur.amount.plus(value);
                            cur.rows.push(line.rowNo);
                        }
                        else {
                            taxLegs.set(hit.ledgerId, { role, amount: value, rows: [line.rowNo] });
                        }
                    }
                }
                if (ledger) {
                    gstLines.push({
                        rowNo: line.rowNo,
                        ledgerId: ledger.ledId,
                        ledgerName: ledger.name,
                        hsn: line.hsn,
                        isService,
                        taxable: amount,
                        rate,
                        ...lineTax,
                        itcEligibility,
                        taxLedgers,
                    });
                }
            }
        }
        const lineTaxTotal = lineTax.cgst.plus(lineTax.sgst).plus(lineTax.igst).plus(lineTax.cess);
        const lineTotal = amount.plus(lineTaxTotal);
        total = total.plus(lineTotal);
        taxable = taxable.plus(amount);
        tax.cgst = tax.cgst.plus(lineTax.cgst);
        tax.sgst = tax.sgst.plus(lineTax.sgst);
        tax.igst = tax.igst.plus(lineTax.igst);
        tax.cess = tax.cess.plus(lineTax.cess);
        lineLegs.push({
            ledgerId: line.ledgerId,
            drCr: 'DR',
            amount: num(amount.plus(costTax)),
            remarks: line.description,
            field: `${field}.ledgerId`,
        });
        if (line.costCentreId) {
            costCentres.push({ rowNo: lineLegs.length, costCentreId: line.costCentreId });
        }
        lines.push({
            ...line,
            ledgerName: ledger?.name ?? null,
            taxName,
            cgst: num(lineTax.cgst),
            sgst: num(lineTax.sgst),
            igst: num(lineTax.igst),
            cess: num(lineTax.cess),
            total: num(lineTotal),
            itcEligibility,
        });
    }
    const tenderLegs = [];
    const tenders = [];
    let paid = ZERO;
    for (const t of facts.tenders) {
        const field = `tenders.${t.rowNo}`;
        if (t.isCheque || t.isPdc) {
            (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.TENDER_NOT_ALLOWED, `Tender ${t.rowNo}: an expense is not paid by cheque here — a cheque goes on a bill-wise Payment, ` +
                'which keeps the issued-cheque register', { field: `${field}.tdTenderId` });
        }
        if (t.mdrAmt.gt(0)) {
            (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.TENDER_NOT_ALLOWED, `Tender ${t.rowNo}: a bank charge is an expense line of its own, not a tender deduction`, { field: `${field}.tdMdrAmt` });
        }
        const drawerCash = t.tenderTypeId === CASH_TENDER_TYPE_ID;
        const ledgerId = drawerCash && facts.cash.ledgerId
            ? facts.cash.ledgerId
            : (t.clearingLedgerId ?? t.tenderLedgerId);
        paid = paid.plus(t.amount);
        tenderLegs.push({
            ledgerId,
            drCr: 'CR',
            amount: num(t.amount),
            remarks: t.refNo ? `${t.tenderName} ${t.refNo}` : t.tenderName,
            field: `${field}.tdTenderId`,
        });
        tenders.push({
            tdId: t.tdId,
            rowNo: t.rowNo,
            tenderId: t.tenderId,
            tenderName: t.tenderName,
            tenderTypeId: t.tenderTypeId,
            tenderTypeName: t.tenderTypeName,
            amount: num(t.amount),
            refNo: t.refNo,
            ledgerId,
            ledgerName: facts.ledgerNames.get(ledgerId) ?? null,
            moneyFrom: drawerCash ? facts.cash.moneyFrom : expense_enum_1.ExpenseMoneyFrom.LEDGER,
        });
    }
    if (!paid.equals(total)) {
        (0, vouchers_errors_1.refuse)(ctx, expense_enum_1.ExpenseErrorCode.TOTAL_MISMATCH, `The lines come to ${total.toFixed(2)} and the tenders to ${paid.toFixed(2)}: they must be equal`, { field: 'tenders' });
    }
    const taxLegList = [...taxLegs.entries()].map(([ledgerId, t]) => ({
        ledgerId,
        role: t.role,
        drCr: 'DR',
        amount: num(t.amount),
        remarks: `Input ${t.role.replace('INPUT_', '')} on rows ${t.rows.join(', ')}`,
        field: 'gstBill',
    }));
    const legs = [...lineLegs, ...taxLegList, ...tenderLegs];
    const lineOf = (i) => (i < lineLegs.length ? draft.lines[i].rowNo : null);
    const legPayload = legs.map((leg, i) => ({
        rowNo: i + 1,
        drCr: leg.drCr,
        ledgerId: leg.ledgerId ?? null,
        ledgerName: (leg.ledgerId &&
            (facts.ledgers.get(leg.ledgerId)?.name ?? facts.ledgerNames.get(leg.ledgerId))) ??
            null,
        role: leg.role ?? null,
        amount: leg.amount,
        remarks: leg.remarks ?? null,
        line: lineOf(i),
    }));
    return {
        payload: {
            total: num(total),
            taxable: num(taxable),
            tax: { cgst: num(tax.cgst), sgst: num(tax.sgst), igst: num(tax.igst), cess: num(tax.cess) },
            supplyNature: gstHead?.supplyNature ?? null,
            placeOfSupplyCode: gstHead?.placeOfSupplyCode ?? null,
            lines,
            tenders,
            legs: legPayload,
        },
        legs,
        costCentres,
        gst: gstHead && gstLines.length > 0 ? { ...gstHead, taxable, ...tax, lines: gstLines } : null,
    };
}
//# sourceMappingURL=expense-derive.js.map