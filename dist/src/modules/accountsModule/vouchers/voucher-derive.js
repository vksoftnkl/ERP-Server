"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.round2 = round2;
exports.opposite = opposite;
exports.roleKey = roleKey;
exports.moneySideOf = moneySideOf;
exports.sideVerdict = sideVerdict;
exports.legalOnSide = legalOnSide;
exports.addDays = addDays;
exports.accYearOfDate = accYearOfDate;
exports.derive = derive;
exports.registerDeductee = registerDeductee;
exports.toWire = toWire;
exports.instrumentToWire = instrumentToWire;
const client_1 = require("@prisma/client");
const voucher_facts_1 = require("./voucher-facts");
const vouchers_errors_1 = require("./vouchers.errors");
const cheque_book_helper_1 = require("./cheque-book.helper");
const voucher_facts_2 = require("./voucher-facts");
const ZERO = new client_1.Prisma.Decimal(0);
const HUNDRED = new client_1.Prisma.Decimal(100);
function round2(v) {
    return v.toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP);
}
function opposite(side) {
    return side === 'DR' ? 'CR' : 'DR';
}
function roleKey(role, taxId, supplyNature) {
    return `${role}|${taxId ?? '*'}|${supplyNature ?? '*'}`;
}
function moneySideOf(nature) {
    return nature === 'RECEIPT' ? 'DR' : nature === 'PAYMENT' ? 'CR' : null;
}
function sideVerdict(type, side, ledger) {
    const moneySide = moneySideOf(type.nature);
    if (moneySide) {
        const money = (0, voucher_facts_1.isMoneyLedger)(ledger);
        if (side === moneySide && !money) {
            return 'MONEY_ONLY';
        }
        if (side !== moneySide && money) {
            return 'NO_MONEY';
        }
    }
    const groups = side === 'DR' ? type.drGroups : type.crGroups;
    if (groups.length > 0) {
        const allowed = new Set(groups.map((g) => g.groupId));
        if (!ledger.groupPath.some((g) => allowed.has(g))) {
            return 'GROUPS';
        }
    }
    return 'OK';
}
function legalOnSide(type, side, ledger) {
    return sideVerdict(type, side, ledger) === 'OK';
}
function sideRefusal(type, side, ledger, verdict, prefix) {
    const verb = side === 'DR' ? 'debited' : 'credited';
    const groups = (side === 'DR' ? type.drGroups : type.crGroups).map((g) => g.name);
    switch (verdict) {
        case 'MONEY_ONLY':
            return `${prefix}${ledger.name} (${ledger.groupName}) may not be ${verb} on a ${type.typeName} — the ${side} side takes cash or bank only`;
        case 'NO_MONEY':
            return `${prefix}${ledger.name} may not be ${verb} on a ${type.typeName} — ${type.nature === 'RECEIPT' ? 'cash to bank is a Contra' : 'bank to cash is a Contra'}`;
        default:
            return (`${prefix}${ledger.name} (${ledger.groupName}) may not be ${verb} on a ${type.typeName}` +
                (groups.length ? ` — the ${side} side takes ${groups.join(', ')}` : ''));
    }
}
function addDays(iso, days) {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
function accYearOfDate(iso) {
    const y = Number(iso.slice(0, 4));
    const m = Number(iso.slice(5, 7));
    const start = m >= 4 ? y : y - 1;
    return `${start}-${start + 1}`;
}
function money(v) {
    return v.toFixed(2);
}
function gstDoc(type) {
    switch (type.nature) {
        case 'PURCHASE':
            return { docType: 'INVOICE', tranNature: 'PURCHASE', docFlow: 'INWARD', docSign: 1 };
        case 'SALES':
            return { docType: 'INVOICE', tranNature: 'SALE', docFlow: 'OUTWARD', docSign: 1 };
        case 'CREDIT_NOTE':
            return { docType: 'CREDIT_NOTE', tranNature: 'CREDIT_NOTE', docFlow: 'OUTWARD', docSign: -1 };
        case 'DEBIT_NOTE':
            return { docType: 'DEBIT_NOTE', tranNature: 'DEBIT_NOTE', docFlow: 'OUTWARD', docSign: 1 };
        default:
            return { docType: 'OTHER', tranNature: 'OTHER', docFlow: 'INTERNAL', docSign: 1 };
    }
}
function derive(input) {
    const { type, ctx, header } = input;
    const legs = [];
    const typed = [];
    if (header.date < input.today && input.backdateMode !== 'OFF') {
        const msg = `${header.date} is before today (${input.today})`;
        if (input.backdateMode === 'REFUSE') {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BACKDATED, msg, { field: 'header.date' });
        }
        else {
            (0, vouchers_errors_1.warn)(ctx, vouchers_errors_1.VCH.BACKDATED, msg, { field: 'header.date' });
        }
    }
    if (input.docRefnoClash === 'INDEX') {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.DUP_DOC_REFNO, `${header.docRefno ?? ''} is already on a live ${type.typeName} for this party in this year`, { field: 'header.docRefno' });
    }
    else if (input.docRefnoClash === 'OTHER') {
        (0, vouchers_errors_1.warn)(ctx, vouchers_errors_1.VCH.DUP_DOC_REFNO, `${header.docRefno ?? ''} is already on another live voucher for this party`, { field: 'header.docRefno' });
    }
    if (input.lines.length === 0) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.NO_LINES, 'Type at least one line', { field: 'lines' });
    }
    const seenRows = new Set();
    const sorted = [...input.lines].sort((a, b) => a.rowNo - b.rowNo);
    for (const line of sorted) {
        const field = `lines.${line.rowNo}`;
        if (seenRows.has(line.rowNo)) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INVALID, `Row ${line.rowNo} appears twice`, { field, line: line.rowNo });
            continue;
        }
        seenRows.add(line.rowNo);
        if (line.amount.lessThanOrEqualTo(0)) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.LINE_AMOUNT, `Row ${line.rowNo}: the amount must be above zero`, {
                field: `${field}.amount`,
                line: line.rowNo,
            });
        }
        const ledger = input.ledgers.get(line.ledgerId);
        if (!ledger) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.LEDGER_NOT_FOUND, `Row ${line.rowNo}: no such ledger is visible to this company`, {
                field: `${field}.ledgerId`,
                line: line.rowNo,
            });
            continue;
        }
        if (!ledger.isActive || ledger.isDeleted) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.LEDGER_INACTIVE, `Row ${line.rowNo}: ${ledger.name} is inactive`, {
                field: `${field}.ledgerId`,
                line: line.rowNo,
            });
        }
        const verdict = sideVerdict(type, line.drCr, ledger);
        if (verdict !== 'OK') {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.LEDGER_SIDE, sideRefusal(type, line.drCr, ledger, verdict, `Row ${line.rowNo}: `), { field: `${field}.ledgerId`, line: line.rowNo });
        }
        if (input.instrumentLedgers.has(ledger.ledId)) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_LEDGER, `Row ${line.rowNo}: ${ledger.name} is an instrument-controlled ledger — use Received / Issued Cheques (menu 51 / 52)`, { field: `${field}.ledgerId`, line: line.rowNo });
        }
        if (type.gstRegister && input.generatedRoleLedgers.has(ledger.ledId)) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.GST_LEDGER_TYPED, `Row ${line.rowNo}: ${ledger.name} is a tax ledger the GST band generates — type the taxable line with its rate instead`, { field: `${field}.ledgerId`, line: line.rowNo });
        }
        if (!type.gstRegister && line.gst) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.GST_NOT_ALLOWED, `Row ${line.rowNo}: a ${type.typeName} feeds no GST register, so a line carries no rate`, { field: `${field}.gst`, line: line.rowNo });
        }
        const isTdsBase = line.tdsBase ?? ledger.isTdsApplicable;
        const instrument = readInstrument(input, line, ledger);
        typed.push({
            rowNo: typed.length + 1,
            lineRowNo: line.rowNo,
            drCr: line.drCr,
            ledger,
            amount: round2(line.amount),
            generated: false,
            source: 'TYPED',
            role: null,
            remarks: line.remarks,
            fromRows: [],
            gst: line.gst,
            isTdsBase,
            oppLedgerId: null,
            postDated: instrument?.isPostDated ?? false,
            postsOn: instrument?.postsOn ?? null,
            instrument,
        });
    }
    legs.push(...typed);
    for (const leg of typed) {
        const ins = leg.instrument;
        if (!ins)
            continue;
        const l = leg.ledger;
        const rowNo = legs.length + 1;
        legs.push({
            rowNo,
            lineRowNo: null,
            drCr: opposite(leg.drCr),
            ledger: { ledId: ins.ledgerId, name: ins.ledgerName, groupName: null },
            amount: leg.amount,
            generated: true,
            source: 'INSTRUMENT',
            role: null,
            remarks: ins.refNo ? `${ins.tender.name} ${ins.refNo}` : ins.tender.name,
            fromRows: [leg.lineRowNo],
            gst: null,
            isTdsBase: false,
            oppLedgerId: l.ledId,
            postDated: ins.isPostDated,
            postsOn: ins.postsOn,
            instrument: ins,
        });
        leg.oppLedgerId = ins.ledgerId;
    }
    let party = null;
    let partySide = null;
    if (type.partyMode === 'ONE') {
        if (!header.partyId) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.PARTY_MODE, `A ${type.typeName} needs one party`, {
                field: 'header.partyId',
            });
        }
        else if (!input.party) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.PARTY_NOT_FOUND, 'No such party ledger is visible to this company', {
                field: 'header.partyId',
            });
        }
        else {
            party = input.party;
            if (!party.isActive || party.isDeleted) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.LEDGER_INACTIVE, `${party.name} is inactive`, { field: 'header.partyId' });
            }
            if (type.partySide !== 'DR' && type.partySide !== 'CR') {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INVALID, `${type.typeName} names no party side (vchr_party_side)`, {
                    field: 'header.typeCode',
                });
            }
            else {
                partySide = type.partySide;
                const partyVerdict = sideVerdict(type, partySide, party);
                if (partyVerdict !== 'OK') {
                    const groups = (partySide === 'DR' ? type.drGroups : type.crGroups).map((g) => g.name);
                    (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.LEDGER_SIDE, partyVerdict === 'GROUPS'
                        ? `${party.name} (${party.groupName}) cannot be the party of a ${type.typeName}` +
                            (groups.length ? ` — it takes ${groups.join(', ')}` : '')
                        : sideRefusal(type, partySide, party, partyVerdict, ''), { field: 'header.partyId' });
                }
            }
        }
    }
    else if (header.partyId) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.PARTY_MODE, type.partyMode === 'NONE'
            ? `A ${type.typeName} carries no party`
            : `A ${type.typeName} names its parties on the lines, not on the header`, { field: 'header.partyId' });
    }
    const taxSide = partySide ? opposite(partySide) : null;
    let gst = null;
    const gstTyped = type.gstRegister ? typed.filter((l) => l.gst) : [];
    if (gstTyped.length > 0 && type.gstSide && taxSide && partySide) {
        const rcm = header.reverseCharge && type.gstSide === 'INPUT';
        const posStcd = header.posStcd ??
            (type.gstSide === 'OUTPUT' && !rcm
                ? (party?.stateCode ?? input.company.stateCode)
                : input.company.stateCode);
        const supplyNature = posStcd === input.company.stateCode ? 'INTRA' : 'INTER';
        const prefix = type.gstSide === 'INPUT' ? 'INPUT_' : 'OUTPUT_';
        const byLedger = new Map();
        const unmapped = new Set();
        const askLedger = (role, taxId, lineRowNo) => {
            const hit = input.roleLedgers.get(roleKey(role, taxId, supplyNature)) ??
                input.roleLedgers.get(roleKey(role, null, supplyNature)) ??
                input.roleLedgers.get(roleKey(role, taxId, null)) ??
                input.roleLedgers.get(roleKey(role, null, null)) ??
                null;
            if (!hit && !unmapped.has(role)) {
                unmapped.add(role);
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.GST_LEDGER_UNMAPPED, `No ledger is mapped for ${role} (${supplyNature === 'INTRA' ? 'intra' : 'inter'}-state) — map it in Posting Ledgers (menu 250)`, { field: `lines.${lineRowNo}.gst.taxId`, line: lineRowNo });
            }
            return hit;
        };
        const post = (role, drCr, amount, taxId, lineRowNo) => {
            if (amount.isZero()) {
                return null;
            }
            const led = askLedger(role, taxId, lineRowNo);
            if (!led) {
                return null;
            }
            const key = `${led.ledgerId}|${drCr}`;
            const cur = byLedger.get(key);
            if (cur) {
                cur.amount = cur.amount.plus(amount);
                cur.rows.push(lineRowNo);
            }
            else {
                byLedger.set(key, {
                    ledgerId: led.ledgerId,
                    name: led.ledgerName,
                    role,
                    drCr,
                    amount,
                    rows: [lineRowNo],
                });
            }
            return led.ledgerId;
        };
        const lines = [];
        let tTaxable = ZERO;
        let tCgst = ZERO;
        let tSgst = ZERO;
        let tIgst = ZERO;
        let tCess = ZERO;
        for (const leg of gstTyped) {
            const g = leg.gst;
            const lineRowNo = leg.lineRowNo;
            const rate = input.taxRates.get(g.taxId);
            if (!rate || !rate.isActive) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.GST_RATE_MISSING, `Row ${lineRowNo}: the GST rate named is not an active rate`, {
                    field: `lines.${lineRowNo}.gst.taxId`,
                    line: lineRowNo,
                });
                continue;
            }
            const ledger = leg.ledger;
            const taxable = leg.amount;
            const total = round2(taxable.mul(rate.ratePerc).div(HUNDRED));
            let cgst = ZERO;
            let sgst = ZERO;
            let igst = ZERO;
            if (supplyNature === 'INTER') {
                igst = total;
            }
            else {
                cgst = round2(total.div(2));
                sgst = total.minus(cgst);
            }
            const cess = rate.cessBasis === 'PERCENT' || rate.cessBasis === 'BOTH'
                ? round2(taxable.mul(rate.cessPerc).div(HUNDRED))
                : ZERO;
            const isService = (g.hsn ?? '').trim().startsWith('99');
            const itc = g.itcEligibility ??
                (0, voucher_facts_1.itcClassOf)(ledger.itcEligibility) ??
                (type.gstSide === 'INPUT' ? (isService ? 'INPUT_SERVICES' : 'INPUTS') : null);
            const cgstLedgerId = post(`${prefix}CGST`, taxSide, cgst, g.taxId, lineRowNo);
            const sgstLedgerId = post(`${prefix}SGST`, taxSide, sgst, g.taxId, lineRowNo);
            const igstLedgerId = post(`${prefix}IGST`, taxSide, igst, g.taxId, lineRowNo);
            const cessLedgerId = post(`${prefix}CESS`, taxSide, cess, g.taxId, lineRowNo);
            if (rcm) {
                post('RCM_CGST_PAYABLE', partySide, cgst, g.taxId, lineRowNo);
                post('RCM_SGST_PAYABLE', partySide, sgst, g.taxId, lineRowNo);
                post('RCM_IGST_PAYABLE', partySide, igst, g.taxId, lineRowNo);
                if (!cess.isZero()) {
                    (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.GST_LEDGER_UNMAPPED, `Row ${lineRowNo}: cess under reverse charge has no RCM payable role`, { field: `lines.${lineRowNo}.gst.taxId`, line: lineRowNo });
                }
            }
            lines.push({
                rowNo: leg.rowNo,
                lineRowNo,
                taxableLedgerId: ledger.ledId,
                rate,
                hsn: g.hsn?.trim() || null,
                isService,
                itcEligibility: itc,
                taxable,
                cgst,
                sgst,
                igst,
                cess,
                cgstLedgerId,
                sgstLedgerId,
                igstLedgerId,
                cessLedgerId,
            });
            tTaxable = tTaxable.plus(taxable);
            tCgst = tCgst.plus(cgst);
            tSgst = tSgst.plus(sgst);
            tIgst = tIgst.plus(igst);
            tCess = tCess.plus(cess);
        }
        for (const entry of byLedger.values()) {
            const isRcm = entry.role.startsWith('RCM_');
            legs.push({
                rowNo: legs.length + 1,
                lineRowNo: null,
                drCr: entry.drCr,
                ledger: { ledId: entry.ledgerId, name: entry.name, groupName: null },
                amount: round2(entry.amount),
                generated: true,
                source: isRcm ? 'RCM' : 'GST',
                role: entry.role,
                remarks: isRcm ? 'Reverse charge payable' : 'From the GST band',
                fromRows: [...new Set(entry.rows)],
                gst: null,
                isTdsBase: false,
                oppLedgerId: null,
                postDated: false,
                postsOn: null,
                instrument: null,
            });
        }
        gst = {
            register: type.gstRegister,
            side: type.gstSide,
            ...gstDoc(type),
            supplyNature,
            posStcd,
            reverseCharge: rcm,
            taxable: tTaxable,
            cgst: tCgst,
            sgst: tSgst,
            igst: tIgst,
            cess: tCess,
            lines,
        };
    }
    let tds = null;
    if (type.tdsMode === 'DEDUCT' && party && party.isTdsApplicable && partySide && taxSide) {
        const section = party.tdsSection?.trim() ?? '';
        const rate = input.tds?.rate ?? null;
        if (!section) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.TDS_RATE_MISSING, `${party.name} is TDS-applicable but names no section`, {
                field: 'header.partyId',
            });
        }
        else if (!rate) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.TDS_RATE_MISSING, `No TDS rate is in force for section ${section} (${party.tdsDeducteeType ?? 'ANY'}) on ${header.date}`, { field: 'header.partyId' });
        }
        else {
            const baseLegs = typed.filter((l) => l.isTdsBase && l.drCr === taxSide);
            const net = baseLegs.reduce((s, l) => s.plus(l.amount), ZERO);
            const pct = party.pan ? rate.rate : rate.noPanRate;
            const rateSource = party.pan ? 'MASTER' : 'NO_PAN';
            const paymentShaped = type.billwiseMode === 'DEMAND' && partySide === 'DR';
            let base;
            let tax;
            if (paymentShaped && !pct.isZero()) {
                base = round2(net.div(new client_1.Prisma.Decimal(1).minus(pct.div(HUNDRED))));
                tax = base.minus(net);
            }
            else {
                base = net;
                tax = round2(base.mul(pct).div(HUNDRED));
            }
            const cumulative = input.tds.annualBaseSoFar.plus(base);
            const single = rate.thresholdSingle;
            const annual = rate.thresholdAnnual;
            const deduct = crossesTdsThreshold(base, cumulative, rate);
            const fromRows = baseLegs.map((l) => l.lineRowNo);
            if (!deduct) {
                const reason = base.isZero()
                    ? 'no line counts toward the TDS base'
                    : `${money(base)} is within the ${section} threshold (single ${money(single)}, annual ${money(annual)}; ${money(cumulative)} so far this year)`;
                if (!base.isZero()) {
                    (0, vouchers_errors_1.warn)(ctx, vouchers_errors_1.VCH.TDS_BELOW_THRESHOLD, `No TDS deducted: ${reason}`, { field: 'lines' });
                }
                tds = {
                    section,
                    sectionName: rate.sectionName,
                    deducteeType: party.tdsDeducteeType ?? rate.deducteeType,
                    registerDeductee: registerDeductee(party.tdsDeducteeType),
                    rate: pct,
                    rateSource: 'BELOW_THRESHOLD',
                    base,
                    tax: ZERO,
                    deducted: false,
                    reason,
                    fromRows,
                    ledgerId: null,
                    party,
                    lineRowNo: null,
                };
            }
            else {
                const led = input.roleLedgers.get(roleKey('TDS_PAYABLE', null, null)) ?? null;
                if (!led) {
                    (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.TDS_UNMAPPED, 'No ledger is mapped for TDS_PAYABLE — map it in Posting Ledgers (menu 250)', {
                        field: 'lines',
                    });
                }
                else if (tax.greaterThan(0)) {
                    legs.push({
                        rowNo: legs.length + 1,
                        lineRowNo: null,
                        drCr: 'CR',
                        ledger: { ledId: led.ledgerId, name: led.ledgerName, groupName: null },
                        amount: tax,
                        generated: true,
                        source: 'TDS',
                        role: 'TDS_PAYABLE',
                        remarks: `TDS ${section} @ ${pct.toString()}% on ${money(base)}`,
                        fromRows,
                        gst: null,
                        isTdsBase: false,
                        oppLedgerId: null,
                        postDated: false,
                        postsOn: null,
                        instrument: null,
                    });
                }
                tds = {
                    section,
                    sectionName: rate.sectionName,
                    deducteeType: party.tdsDeducteeType ?? rate.deducteeType,
                    registerDeductee: registerDeductee(party.tdsDeducteeType),
                    rate: pct,
                    rateSource,
                    base,
                    tax,
                    deducted: tax.greaterThan(0),
                    reason: null,
                    fromRows,
                    ledgerId: led?.ledgerId ?? null,
                    party,
                    lineRowNo: null,
                };
            }
        }
    }
    const tdsLines = tds ? [tds] : [];
    if (type.tdsMode === 'DEDUCT' && type.partyMode === 'MANY') {
        const side = type.partySide === 'DR' || type.partySide === 'CR' ? type.partySide : null;
        const byParty = new Map();
        for (const leg of typed) {
            const l = leg.ledger;
            if (!(l.isParty || l.isBillByBill) || !l.isTdsApplicable || !leg.isTdsBase)
                continue;
            if (side && leg.drCr !== side)
                continue;
            byParty.set(l.ledId, [...(byParty.get(l.ledId) ?? []), leg]);
        }
        const paymentShaped = type.billwiseMode === 'DEMAND' && side === 'DR';
        let unmappedTold = false;
        for (const partyLines of byParty.values()) {
            const p = partyLines[0].ledger;
            const first = partyLines[0].lineRowNo;
            const field = `lines.${first}.ledgerId`;
            const fromRows = partyLines.map((l) => l.lineRowNo);
            if (!paymentShaped) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INVALID, `Row ${first}: TDS on a multi-party ${type.typeName} is worked out only when it pays parties (party side DR, bills demanded)`, { field, line: first });
                continue;
            }
            const section = p.tdsSection?.trim() ?? '';
            const facts = input.tdsByParty?.get(p.ledId) ?? null;
            const rate = facts?.rate ?? null;
            if (!section) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.TDS_RATE_MISSING, `${p.name} is TDS-applicable but names no section`, {
                    field,
                    line: first,
                });
                continue;
            }
            if (!rate || !facts) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.TDS_RATE_MISSING, `No TDS rate is in force for section ${section} (${p.tdsDeducteeType ?? 'ANY'}) on ${header.date} — ${p.name}`, { field, line: first });
                continue;
            }
            const pct = p.pan ? rate.rate : rate.noPanRate;
            const rateSource = p.pan ? 'MASTER' : 'NO_PAN';
            const perLine = partyLines.map((leg) => {
                const gross = pct.isZero()
                    ? leg.amount
                    : round2(leg.amount.div(new client_1.Prisma.Decimal(1).minus(pct.div(HUNDRED))));
                return { leg, gross, tax: gross.minus(leg.amount) };
            });
            const base = perLine.reduce((acc, x) => acc.plus(x.gross), ZERO);
            const tax = perLine.reduce((acc, x) => acc.plus(x.tax), ZERO);
            const cumulative = facts.annualBaseSoFar.plus(base);
            const common = {
                section,
                sectionName: rate.sectionName,
                deducteeType: p.tdsDeducteeType ?? rate.deducteeType,
                registerDeductee: registerDeductee(p.tdsDeducteeType),
                rate: pct,
                fromRows,
                party: p,
                lineRowNo: first,
            };
            if (!crossesTdsThreshold(base, cumulative, rate)) {
                const paid = partyLines.reduce((acc, l) => acc.plus(l.amount), ZERO);
                const reason = `${money(paid)} to ${p.name} is within the ${section} threshold (single ${money(rate.thresholdSingle)}, annual ${money(rate.thresholdAnnual)}; ${money(facts.annualBaseSoFar.plus(paid))} so far this year)`;
                (0, vouchers_errors_1.warn)(ctx, vouchers_errors_1.VCH.TDS_BELOW_THRESHOLD, `No TDS deducted: ${reason}`, { field, line: first });
                tdsLines.push({
                    ...common,
                    base: paid,
                    rateSource: 'BELOW_THRESHOLD',
                    tax: ZERO,
                    deducted: false,
                    reason,
                    ledgerId: null,
                });
                continue;
            }
            const led = input.roleLedgers.get(roleKey('TDS_PAYABLE', null, null)) ?? null;
            if (!led) {
                if (!unmappedTold) {
                    unmappedTold = true;
                    (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.TDS_UNMAPPED, 'No ledger is mapped for TDS_PAYABLE — map it in Posting Ledgers (menu 250)', { field: 'lines' });
                }
                continue;
            }
            const datedLines = partyLines.filter((l) => l.postDated);
            if (tax.greaterThan(0) && datedLines.length > 0 && partyLines.length > 1) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INVALID, `Row ${datedLines[0].lineRowNo}: ${p.name} has TDS deducted across ${partyLines.length} lines and one is a post-dated cheque — pay the post-dated cheque on a voucher of its own`, { field, line: datedLines[0].lineRowNo });
                continue;
            }
            if (tax.greaterThan(0)) {
                for (const x of perLine) {
                    x.leg.amount = x.gross;
                }
                const dated = datedLines[0] ?? null;
                legs.push({
                    rowNo: legs.length + 1,
                    lineRowNo: null,
                    drCr: 'CR',
                    ledger: { ledId: led.ledgerId, name: led.ledgerName, groupName: null },
                    amount: tax,
                    generated: true,
                    source: 'TDS',
                    role: 'TDS_PAYABLE',
                    remarks: `TDS ${section} @ ${pct.toString()}% on ${money(base)} — ${p.name}`,
                    fromRows,
                    gst: null,
                    isTdsBase: false,
                    oppLedgerId: null,
                    postDated: !!dated,
                    postsOn: dated?.postsOn ?? null,
                    instrument: null,
                });
            }
            tdsLines.push({
                ...common,
                base,
                rateSource,
                tax,
                deducted: tax.greaterThan(0),
                reason: null,
                ledgerId: led.ledgerId,
            });
        }
    }
    let partyLeg = null;
    if (type.partyMode === 'ONE' && party && partySide) {
        const dr = legs.filter((l) => l.drCr === 'DR').reduce((s, l) => s.plus(l.amount), ZERO);
        const cr = legs.filter((l) => l.drCr === 'CR').reduce((s, l) => s.plus(l.amount), ZERO);
        const amount = partySide === 'CR' ? dr.minus(cr) : cr.minus(dr);
        if (amount.lessThanOrEqualTo(0)) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.UNBALANCED, `The lines leave nothing for the party: ${partySide === 'CR' ? 'debits' : 'credits'} ${money(partySide === 'CR' ? dr : cr)} against ${money(partySide === 'CR' ? cr : dr)} on the party's own side`, { field: 'lines' });
        }
        else {
            const rowNo = legs.length + 1;
            legs.push({
                rowNo,
                lineRowNo: null,
                drCr: partySide,
                ledger: party,
                amount: round2(amount),
                generated: true,
                source: 'PARTY',
                role: null,
                remarks: 'Balances the voucher',
                fromRows: typed.map((l) => l.lineRowNo),
                gst: null,
                isTdsBase: false,
                oppLedgerId: null,
                postDated: false,
                postsOn: null,
                instrument: null,
            });
            partyLeg = { ledger: party, side: partySide, amount: round2(amount), rowNo };
        }
    }
    const partyLedgerIds = new Set();
    if (partyLeg) {
        partyLedgerIds.add(partyLeg.ledger.ledId);
    }
    else if (type.partyMode === 'MANY') {
        typed
            .filter((l) => l.ledger.isParty)
            .forEach((l) => partyLedgerIds.add(l.ledger.ledId));
    }
    if (partyLedgerIds.size === 1) {
        const [only] = [...partyLedgerIds];
        for (const leg of legs) {
            if (leg.instrument)
                continue;
            leg.oppLedgerId = leg.ledger.ledId === only ? null : only;
        }
    }
    const todayLegs = legs.filter((l) => !l.postDated);
    const debit = round2(todayLegs.filter((l) => l.drCr === 'DR').reduce((s, l) => s.plus(l.amount), ZERO));
    const credit = round2(todayLegs.filter((l) => l.drCr === 'CR').reduce((s, l) => s.plus(l.amount), ZERO));
    const difference = debit.minus(credit);
    if (todayLegs.length === 0 && typed.length > 0) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.NO_LINES, 'Every line is post-dated, so nothing posts today — a post-dated cheque needs at least one line that does', { field: 'lines' });
    }
    if (!difference.isZero() && typed.length > 0 && type.partyMode !== 'ONE') {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.UNBALANCED, `The voucher does not balance: debits ${money(debit)}, credits ${money(credit)}, ${difference.greaterThan(0) ? 'debit' : 'credit'} heavy by ${money(difference.abs())}`, { field: 'lines' });
    }
    const bills = [];
    const allocations = [];
    const partyLegs = [];
    if (partyLeg) {
        partyLegs.push({
            lineRowNo: 0,
            legRowNo: partyLeg.rowNo,
            ledger: partyLeg.ledger,
            side: partyLeg.side,
            amount: partyLeg.amount,
            instrument: null,
        });
    }
    else if (type.partyMode === 'MANY') {
        for (const leg of typed) {
            const l = leg.ledger;
            if (l.isParty || l.isBillByBill) {
                partyLegs.push({
                    lineRowNo: leg.lineRowNo,
                    legRowNo: leg.rowNo,
                    ledger: l,
                    side: leg.drCr,
                    amount: leg.amount,
                    instrument: leg.instrument,
                });
            }
        }
    }
    if (type.billwiseMode === 'OFF') {
        if (input.allocations.length > 0) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.ALLOCATION_LINE, `A ${type.typeName} carries no bill-wise allocation`, {
                field: 'allocations',
            });
        }
    }
    else {
        const moneyMode = settlementModeOf(typed, partyLedgerIds);
        const perBill = new Map();
        for (const a of input.allocations) {
            const field = `allocations.${a.index}`;
            const leg = partyLegs.find((p) => p.lineRowNo === a.lineRowNo);
            if (!leg) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.ALLOCATION_LINE, `allocations[${a.index}] names line ${a.lineRowNo}, which is not a party line`, { field: `${field}.lineRowNo` });
                continue;
            }
            if (a.amount.lessThanOrEqualTo(0)) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.LINE_AMOUNT, `allocations[${a.index}]: the amount must be above zero`, {
                    field: `${field}.amount`,
                });
                continue;
            }
            const bill = input.bills.get((0, voucher_facts_1.billKey)(a.billId, a.billAccYear));
            if (!bill || bill.isDeleted || !bill.isActive || bill.companyId !== input.company.companyId) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BILL_NOT_FOUND, `allocations[${a.index}]: no live bill ${a.billId} in ${a.billAccYear}`, {
                    field: `${field}.billId`,
                });
                continue;
            }
            if (bill.partyId !== leg.ledger.ledId) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BILL_WRONG_PARTY, `allocations[${a.index}]: bill ${bill.docRefno} belongs to another party`, {
                    field: `${field}.billId`,
                });
                continue;
            }
            if (bill.side === leg.side) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BILL_WRONG_SIDE, `allocations[${a.index}]: bill ${bill.docRefno} sits on the ${bill.side} side, and a ${leg.side} party leg settles ${opposite(leg.side)} bills`, { field: `${field}.billId` });
                continue;
            }
            const key = (0, voucher_facts_1.billKey)(bill.ablId, bill.ablAccYear);
            const used = (perBill.get(key) ?? ZERO).plus(a.amount);
            perBill.set(key, used);
            if (used.greaterThan(bill.pendingAmount)) {
                const msg = `Bill ${bill.docRefno} has only ${money(bill.pendingAmount)} pending, but ${money(used)} is allocated against it`;
                if (ctx.dryRun) {
                    (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BILL_OVERSPENT, msg, { field: `${field}.amount` });
                }
                else {
                    (0, vouchers_errors_1.throwState)(msg, vouchers_errors_1.VCH.BILL_OVERSPENT, `${field}.amount`);
                }
            }
            const adjType = type.billwiseMode === 'DEMAND' ||
                (type.billwiseMode === 'OPTIONAL' && !leg.ledger.isBillByBill)
                ? 'ALLOCATION'
                : bill.billType === 'ADVANCE'
                    ? 'ADVANCE_ADJUST'
                    : type.nature === 'JOURNAL'
                        ? 'TRANSFER'
                        : 'NOTE_ADJUST';
            const instrument = leg.instrument;
            const settlementMode = adjType === 'ALLOCATION'
                ? type.billwiseMode === 'DEMAND'
                    ? (instrument?.settlementMode ?? moneyMode)
                    : 'JOURNAL'
                : adjType === 'ADVANCE_ADJUST'
                    ? 'ADVANCE'
                    : adjType === 'TRANSFER'
                        ? 'JOURNAL'
                        : 'CREDIT_NOTE';
            allocations.push({
                index: a.index,
                lineRowNo: a.lineRowNo,
                legRowNo: leg.legRowNo,
                party: leg.ledger,
                bill,
                amount: round2(a.amount),
                adjType,
                settlementMode,
                postDated: instrument?.isPostDated ?? false,
                adjDate: instrument?.postsOn ?? header.date,
                instrumentLineRowNo: instrument ? leg.lineRowNo : null,
            });
        }
        for (const leg of partyLegs) {
            const allocated = allocations
                .filter((x) => x.lineRowNo === leg.lineRowNo)
                .reduce((s, x) => s.plus(x.amount), ZERO);
            if (allocated.greaterThan(leg.amount)) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BILLWISE_SHORT, `${leg.ledger.name}: ${money(allocated)} is allocated against a party amount of ${money(leg.amount)}`, { field: 'allocations' });
                continue;
            }
            if (type.billwiseMode === 'DEMAND') {
                if (allocated.equals(leg.amount)) {
                    continue;
                }
                if (input.allowAdvance === false || moneySideOf(type.nature) === null) {
                    (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BILLWISE_SHORT, `${leg.ledger.name}: ${money(leg.amount)} must be allocated bill by bill — ${money(allocated)} is`, { field: 'allocations' });
                    continue;
                }
                bills.push({
                    lineRowNo: leg.lineRowNo,
                    legRowNo: leg.legRowNo,
                    party: leg.ledger,
                    billType: 'ADVANCE',
                    side: leg.side,
                    amount: round2(leg.amount.minus(allocated)),
                    docRefno: null,
                    dueDays: 0,
                    dueDate: null,
                    isAdvance: true,
                });
                continue;
            }
            const raise = type.billwiseMode === 'RAISE' ||
                (type.billwiseMode === 'OPTIONAL' && leg.ledger.isBillByBill);
            if (!raise || !type.raiseBillType) {
                continue;
            }
            if ((type.raiseBillType === 'PURCHASE' || type.raiseBillType === 'SALES') &&
                !header.docRefno) {
                (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.DOC_REFNO_REQUIRED, `A ${type.typeName} raises a ${type.raiseBillType} bill and needs the ${type.raiseBillType === 'PURCHASE' ? "supplier's bill number" : "customer's reference"}`, { field: 'header.docRefno' });
            }
            const dueDays = Math.max(0, input.newBill?.dueDays ?? input.creditDaysByLedger.get(leg.ledger.ledId) ?? 0);
            bills.push({
                lineRowNo: leg.lineRowNo,
                legRowNo: leg.legRowNo,
                party: leg.ledger,
                billType: type.raiseBillType,
                side: leg.side,
                amount: leg.amount,
                docRefno: header.docRefno,
                dueDays,
                dueDate: addDays(header.date, dueDays),
                isAdvance: false,
            });
        }
    }
    const postDated = [];
    for (const leg of typed) {
        const ins = leg.instrument;
        if (!ins?.isPostDated || !ins.postsOn)
            continue;
        const drLeg = legs.find((x) => x.source === 'INSTRUMENT' && x.fromRows[0] === leg.lineRowNo);
        if (!drLeg)
            continue;
        postDated.push({
            lineRowNo: leg.lineRowNo,
            partyLegRowNo: leg.rowNo,
            instrumentLegRowNo: drLeg.rowNo,
            extraLegRowNos: legs
                .filter((x) => x.source === 'TDS' && x.postDated && x.fromRows.includes(leg.lineRowNo))
                .map((x) => x.rowNo),
            party: leg.ledger,
            amount: leg.amount,
            postsOn: ins.postsOn,
            accYear: accYearOfDate(ins.postsOn),
            instrument: ins,
        });
    }
    return {
        legs,
        totals: { debit, credit, difference },
        party: partyLeg,
        gst,
        tds,
        tdsLines,
        bills,
        allocations,
        postDated,
    };
}
function readInstrument(input, line, ledger) {
    const { type, ctx, header } = input;
    const ins = line.instrument ?? null;
    if (!ins) {
        return null;
    }
    const field = `lines.${line.rowNo}.instrument`;
    if (!type.instruments) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_NOT_ALLOWED, `Row ${line.rowNo}: a ${type.typeName} takes no instruments — the money side is typed`, { field, line: line.rowNo });
        return null;
    }
    if ((type.partySide === 'DR' || type.partySide === 'CR') && line.drCr !== type.partySide) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_NOT_ALLOWED, `Row ${line.rowNo}: an instrument sits on a ${type.partySide} line (the party's side); the ${line.drCr} leg is generated from it`, { field, line: line.rowNo });
        return null;
    }
    const tender = input.tenders?.get(ins.tenderId) ?? null;
    if (!tender || tender.isDeleted || tender.companyId !== input.company.companyId) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_TENDER, `Row ${line.rowNo}: no such tender for this company`, {
            field: `${field}.tenderId`,
            line: line.rowNo,
        });
        return null;
    }
    if (!tender.isActive) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_TENDER, `Row ${line.rowNo}: tender "${tender.name}" is inactive`, {
            field: `${field}.tenderId`,
            line: line.rowNo,
        });
        return null;
    }
    if (voucher_facts_1.EXCLUDED_INSTRUMENT_TYPES.includes(tender.typeId)) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_TENDER, `Row ${line.rowNo}: "${tender.name}" (${tender.typeName}) moves no money in and cannot be an instrument here`, { field: `${field}.tenderId`, line: line.rowNo });
        return null;
    }
    if (type.partySide === 'DR') {
        return readIssuedInstrument(input, line, ledger, tender);
    }
    const refNo = ins.refNo?.trim() || null;
    const bankName = ins.bankName?.trim() || null;
    const instrumentDate = ins.instrumentDate?.trim() || null;
    const isCheque = tender.typeId === voucher_facts_1.CHEQUE_TENDER_TYPE_ID;
    if (isCheque) {
        const missing = [];
        if (!instrumentDate)
            missing.push('instrumentDate');
        if (!refNo)
            missing.push('refNo');
        if (!bankName)
            missing.push('bankName');
        if (missing.length > 0) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.CHEQUE_DETAILS, `Row ${line.rowNo}: a cheque needs ${missing.join(', ')}`, {
                field: `${field}.${missing[0]}`,
                line: line.rowNo,
            });
            return null;
        }
    }
    else if (tender.needsRef && !refNo) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_TENDER, `Row ${line.rowNo}: "${tender.name}" needs a reference number`, { field: `${field}.refNo`, line: line.rowNo });
        return null;
    }
    const isPostDated = isCheque && !!instrumentDate && instrumentDate > header.date;
    const postsOn = isPostDated ? instrumentDate : null;
    if (isCheque) {
        const year = accYearOfDate(postsOn ?? header.date);
        const closed = input.closedYears?.get(year);
        if (closed) {
            (0, vouchers_errors_1.refuse)(ctx, closed.startsWith('locked') ? vouchers_errors_1.VCH.PERIOD_LOCKED : vouchers_errors_1.VCH.YEAR_CLOSED, `Row ${line.rowNo}: cheque ${refNo} would post on ${postsOn ?? header.date}, and ${year} is ${closed}`, { field: `${field}.instrumentDate`, line: line.rowNo });
        }
        if (input.registeredCheques?.has(`${ledger.ledId}|${refNo}|${year}`)) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.CHEQUE_DETAILS, `Row ${line.rowNo}: cheque ${refNo} of ${ledger.name} is already in the register for ${year}`, { field: `${field}.refNo`, line: line.rowNo });
        }
    }
    return {
        lineRowNo: line.rowNo,
        tender,
        ledgerId: tender.settlementLedgerId ?? tender.ledgerId,
        ledgerName: tender.ledgerName,
        refNo,
        instrumentDate,
        bankName,
        isCheque,
        isPostDated,
        postsOn,
        cheque: isCheque
            ? {
                drawerName: ins.cheque?.drawerName?.trim() || null,
                bankBranch: ins.cheque?.bankBranch?.trim() || null,
                ifsc: ins.cheque?.ifsc?.trim() || null,
                micr: ins.cheque?.micr?.trim() || null,
            }
            : null,
        settlementMode: (0, voucher_facts_1.settlementModeForTenderType)(tender.typeId),
        issued: false,
        bankLedgerId: null,
        chequeBook: null,
        nextLeaf: null,
        favouring: null,
        acPayee: false,
    };
}
const PAYABLE_TENDER_TYPES = [1, 3, 5, 6];
const leavesPromised = new WeakMap();
function readIssuedInstrument(input, line, party, tender) {
    const { type, ctx, header } = input;
    const ins = line.instrument;
    const field = `lines.${line.rowNo}.instrument`;
    if (!PAYABLE_TENDER_TYPES.includes(tender.typeId)) {
        (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_TENDER, `Row ${line.rowNo}: "${tender.name}" (${tender.typeName}) cannot pay a ${type.typeName} — use cash, a cheque, UPI or a bank transfer`, { field: `${field}.tenderId`, line: line.rowNo });
        return null;
    }
    const isCheque = tender.typeId === voucher_facts_1.CHEQUE_TENDER_TYPE_ID;
    const favouring = ins.favouring?.trim() || party.name;
    let refNo = ins.refNo?.trim() || null;
    let ledgerId = tender.settlementLedgerId ?? tender.ledgerId;
    let ledgerName = tender.ledgerName;
    let bankLedgerId = null;
    if (!tender.isCash) {
        const bankId = ins.bankLedgerId ?? null;
        const bank = bankId ? (input.ledgers.get(bankId) ?? null) : null;
        if (!bankId) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BANK_REQUIRED, `Row ${line.rowNo}: say which bank account the ${tender.typeName.toLowerCase()} is drawn on`, { field: `${field}.bankLedgerId`, line: line.rowNo });
            return null;
        }
        if (!bank || !(0, voucher_facts_2.isBankLedger)(bank) || !bank.isActive || bank.isDeleted) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BANK_REQUIRED, `Row ${line.rowNo}: ${bank?.name ?? 'that ledger'} is not a live bank account (Bank Accounts / Bank OD)`, { field: `${field}.bankLedgerId`, line: line.rowNo });
            return null;
        }
        bankLedgerId = bank.ledId;
        ledgerId = bank.ledId;
        ledgerName = bank.name;
        if (!isCheque && tender.needsRef && !refNo) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.INSTRUMENT_TENDER, `Row ${line.rowNo}: "${tender.name}" needs a reference number`, {
                field: `${field}.refNo`,
                line: line.rowNo,
            });
            return null;
        }
    }
    const instrumentDate = isCheque ? ins.instrumentDate?.trim() || header.date : null;
    const isPostDated = isCheque && !!instrumentDate && instrumentDate > header.date;
    const postsOn = isPostDated ? instrumentDate : null;
    let chequeBook = null;
    let nextLeaf = null;
    if (isCheque) {
        const bookId = ins.chequeBookId ?? null;
        chequeBook = bookId ? (input.chequeBooks?.get(bookId) ?? null) : null;
        if (!bookId ||
            !chequeBook ||
            chequeBook.isDeleted ||
            chequeBook.companyId !== input.company.companyId) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BOOK_REQUIRED, bookId
                ? `Row ${line.rowNo}: no such cheque book for this company`
                : `Row ${line.rowNo}: a cheque names the book its leaf comes from`, { field: `${field}.chequeBookId`, line: line.rowNo });
            return null;
        }
        if (chequeBook.bankLedgerId !== bankLedgerId) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BOOK_BANK, `Row ${line.rowNo}: book ${chequeBook.bookNo} is drawn on ${chequeBook.bankName}, not ${ledgerName}`, { field: `${field}.chequeBookId`, line: line.rowNo });
            return null;
        }
        const promised = leavesPromised.get(input) ?? new Map();
        leavesPromised.set(input, promised);
        const offset = promised.get(chequeBook.chequeBookId) ?? 0;
        const leafNo = chequeBook.nextLeaf + offset;
        if (chequeBook.status !== 'ACTIVE' || leafNo > chequeBook.leafTo) {
            (0, vouchers_errors_1.refuse)(ctx, vouchers_errors_1.VCH.BOOK_FINISHED, chequeBook.status === 'CLOSED'
                ? `Row ${line.rowNo}: book ${chequeBook.bookNo} is closed`
                : `Row ${line.rowNo}: book ${chequeBook.bookNo} has no leaf left${offset > 0 ? ' for this line' : ''} — start a new book`, { field: `${field}.chequeBookId`, line: line.rowNo });
            return null;
        }
        promised.set(chequeBook.chequeBookId, offset + 1);
        nextLeaf = (0, cheque_book_helper_1.formatLeaf)(leafNo, chequeBook.leafWidth);
        refNo = nextLeaf;
        const year = accYearOfDate(postsOn ?? header.date);
        const closed = input.closedYears?.get(year);
        if (closed) {
            (0, vouchers_errors_1.refuse)(ctx, closed.startsWith('locked') ? vouchers_errors_1.VCH.PERIOD_LOCKED : vouchers_errors_1.VCH.YEAR_CLOSED, `Row ${line.rowNo}: the cheque would post on ${postsOn ?? header.date}, and ${year} is ${closed}`, { field: `${field}.instrumentDate`, line: line.rowNo });
        }
    }
    return {
        lineRowNo: line.rowNo,
        tender,
        ledgerId,
        ledgerName,
        refNo,
        instrumentDate,
        bankName: bankLedgerId ? ledgerName : null,
        isCheque,
        isPostDated,
        postsOn,
        cheque: null,
        settlementMode: (0, voucher_facts_1.settlementModeForTenderType)(tender.typeId),
        issued: true,
        bankLedgerId,
        chequeBook,
        nextLeaf,
        favouring,
        acPayee: isCheque ? (ins.acPayee ?? true) : false,
    };
}
function crossesTdsThreshold(base, cumulative, rate) {
    const single = rate.thresholdSingle;
    const annual = rate.thresholdAnnual;
    return (base.greaterThan(0) &&
        ((single.isZero() && annual.isZero()) ||
            (single.greaterThan(0) && base.greaterThan(single)) ||
            (annual.greaterThan(0) && cumulative.greaterThan(annual))));
}
function registerDeductee(ledgerType) {
    return (ledgerType ?? '').trim().toUpperCase() === 'COMPANY' ? 'COMPANY' : 'NON_COMPANY';
}
function settlementModeOf(typed, partyLedgerIds) {
    const kinds = new Set();
    for (const leg of typed) {
        if (partyLedgerIds.has(leg.ledger.ledId)) {
            continue;
        }
        const l = leg.ledger;
        if (!(0, voucher_facts_1.isMoneyLedger)(l)) {
            continue;
        }
        kinds.add(l.groupNames.some((n) => n.toLowerCase() === 'cash-in-hand') ? 'CASH' : 'BANK');
    }
    if (kinds.size === 0) {
        return 'VOUCHER';
    }
    return kinds.size === 1 ? [...kinds][0] : 'MIXED';
}
function toWire(typeCode, date, d) {
    const n = (v) => Number(v.toFixed(2));
    const legs = d.legs.map((l) => ({
        rowNo: l.rowNo,
        lineRowNo: l.lineRowNo,
        drCr: l.drCr,
        ledgerId: l.ledger.ledId,
        ledgerName: l.ledger.name,
        groupName: l.ledger.groupName ?? null,
        amount: n(l.amount),
        generated: l.generated,
        source: l.source,
        role: l.role,
        remarks: l.remarks,
        fromRows: l.fromRows,
        gst: l.gst ? { ...l.gst, isTdsBase: l.isTdsBase } : null,
        isTdsBase: l.isTdsBase,
        postDated: l.postDated,
        postsOn: l.postsOn,
        instrument: l.instrument ? instrumentToWire(l.instrument) : null,
    }));
    const postDated = d.postDated.map((pd) => ({
        lineRowNo: pd.lineRowNo,
        partyId: pd.party.ledId,
        partyName: pd.party.name,
        amount: n(pd.amount),
        postsOn: pd.postsOn,
        accYear: pd.accYear,
        tenderName: pd.instrument.tender.name,
        refNo: pd.instrument.refNo,
    }));
    const party = d.party
        ? {
            ledgerId: d.party.ledger.ledId,
            name: d.party.ledger.name,
            side: d.party.side,
            amount: n(d.party.amount),
            rowNo: d.party.rowNo,
        }
        : null;
    let gst = null;
    if (d.gst) {
        const rows = new Map();
        for (const l of d.gst.lines) {
            const cur = rows.get(l.rate.taxId);
            if (cur) {
                cur.taxable = n(new client_1.Prisma.Decimal(cur.taxable).plus(l.taxable));
                cur.cgst = n(new client_1.Prisma.Decimal(cur.cgst).plus(l.cgst));
                cur.sgst = n(new client_1.Prisma.Decimal(cur.sgst).plus(l.sgst));
                cur.igst = n(new client_1.Prisma.Decimal(cur.igst).plus(l.igst));
                cur.cess = n(new client_1.Prisma.Decimal(cur.cess).plus(l.cess));
                cur.lines.push(l.lineRowNo);
            }
            else {
                rows.set(l.rate.taxId, {
                    taxId: l.rate.taxId,
                    taxName: l.rate.name,
                    ratePerc: Number(l.rate.ratePerc.toString()),
                    taxable: n(l.taxable),
                    cgst: n(l.cgst),
                    sgst: n(l.sgst),
                    igst: n(l.igst),
                    cess: n(l.cess),
                    lines: [l.lineRowNo],
                });
            }
        }
        gst = {
            register: d.gst.register,
            side: d.gst.side,
            docType: d.gst.docType,
            supplyNature: d.gst.supplyNature === 'INTER' ? 'INTER_STATE' : 'INTRA_STATE',
            placeOfSupply: d.gst.posStcd,
            reverseCharge: d.gst.reverseCharge,
            taxable: n(d.gst.taxable),
            cgst: n(d.gst.cgst),
            sgst: n(d.gst.sgst),
            igst: n(d.gst.igst),
            cess: n(d.gst.cess),
            total: n(d.gst.cgst.plus(d.gst.sgst).plus(d.gst.igst).plus(d.gst.cess)),
            rows: [...rows.values()],
        };
    }
    const tdsOf = (t) => ({
        section: t.section,
        deducteeType: t.deducteeType,
        rate: Number(t.rate.toString()),
        rateSource: t.rateSource,
        base: n(t.base),
        tax: n(t.tax),
        deducted: t.deducted,
        reason: t.reason,
        fromRows: t.fromRows,
    });
    const tds = d.tds ? tdsOf(d.tds) : null;
    const tdsLines = d.tdsLines.map((t) => ({
        ...tdsOf(t),
        lineRowNo: t.lineRowNo,
        partyId: t.party.ledId,
        partyName: t.party.name,
    }));
    const bills = d.bills.map((b) => ({
        lineRowNo: b.lineRowNo,
        partyId: b.party.ledId,
        partyName: b.party.name,
        billType: b.billType,
        side: b.side,
        amount: n(b.amount),
        docRefno: b.docRefno,
        dueDays: b.dueDays,
        dueDate: b.dueDate,
        isAdvance: b.isAdvance,
    }));
    const allocations = d.allocations.map((a) => ({
        lineRowNo: a.lineRowNo,
        billId: a.bill.ablId,
        billAccYear: a.bill.ablAccYear,
        billRefno: a.bill.docRefno,
        billType: a.bill.billType,
        amount: n(a.amount),
        pendingBefore: n(a.bill.pendingAmount),
        adjType: a.adjType,
    }));
    return {
        typeCode,
        date,
        legs,
        totals: {
            debit: n(d.totals.debit),
            credit: n(d.totals.credit),
            difference: n(d.totals.difference),
        },
        party,
        gst,
        tds,
        tdsLines,
        bills,
        allocations,
        postDated,
    };
}
function instrumentToWire(i) {
    return {
        tenderId: i.tender.tndId,
        tenderName: i.tender.name,
        tenderTypeId: i.tender.typeId,
        tenderTypeName: i.tender.typeName,
        ledgerId: i.ledgerId,
        ledgerName: i.ledgerName,
        refNo: i.refNo,
        instrumentDate: i.instrumentDate,
        bankName: i.bankName,
        isCheque: i.isCheque,
        isPostDated: i.isPostDated,
        postsOn: i.postsOn,
        cheque: i.cheque,
        settlementMode: i.settlementMode,
        issued: i.issued,
        bankLedgerId: i.bankLedgerId,
        chequeBookId: i.chequeBook?.chequeBookId ?? null,
        bookNo: i.chequeBook?.bookNo ?? null,
        nextLeaf: i.nextLeaf,
        favouring: i.favouring,
        acPayee: i.issued && i.isCheque ? i.acPayee : null,
    };
}
//# sourceMappingURL=voucher-derive.js.map