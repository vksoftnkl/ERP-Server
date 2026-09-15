"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normaliseTenders = normaliseTenders;
exports.normaliseOtherLines = normaliseOtherLines;
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_enum_1 = require("./types/receipt-enum");
const receipt_utils_1 = require("./receipt.utils");
async function normaliseTenders(client, params) {
    if (params.tenders.length === 0) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'tenders',
                message: 'A receipt with no instruments is a journal, not a receipt. Even a receipt settled ' +
                    'entirely from a credit the party holds needs a journal voucher instead.',
            },
        ]);
    }
    const masters = await client.accTenderMaster.findMany({
        where: {
            tndId: { in: [...new Set(params.tenders.map((tender) => tender.tdTenderId))] },
            tndIsDeleted: false,
        },
        select: {
            tndId: true,
            tndName: true,
            tndCompanyId: true,
            tndBranchId: true,
            tndTypeId: true,
            tndLedgerId: true,
            tndSettlementLedgerId: true,
            tndSurchargeLedgerId: true,
            tndSurchargePerc: true,
            tndSurchargeAmount: true,
            tndEditLedger: true,
            tndEditSurcharge: true,
            tndIsActive: true,
            tenderType: { select: { ttmTypeId: true, ttmTypeName: true, ttmIsCash: true } },
        },
    });
    const masterById = new Map(masters.map((master) => [master.tndId, master]));
    const seenRowNos = new Set();
    const normalised = [];
    params.tenders.forEach((tender, index) => {
        const field = (name) => `tenders.${index}.${name}`;
        if (seenRowNos.has(tender.tdRowNo)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                { field: field('tdRowNo'), message: `Row number ${tender.tdRowNo} appears twice` },
            ]);
        }
        seenRowNos.add(tender.tdRowNo);
        const master = masterById.get(tender.tdTenderId);
        if (!master) {
            (0, module_service_utils_1.throwAccountsNotFound)('Tender not found', field('tdTenderId'), `No live tender with id ${tender.tdTenderId}`);
        }
        if (!master.tndIsActive) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                { field: field('tdTenderId'), message: `Tender "${master.tndName}" is inactive` },
            ]);
        }
        if (master.tndCompanyId !== params.companyId) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: field('tdTenderId'),
                    message: `Tender "${master.tndName}" belongs to another company`,
                },
            ]);
        }
        if (master.tndBranchId !== null && master.tndBranchId !== params.branchId) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: field('tdTenderId'),
                    message: `Tender "${master.tndName}" is not available at this branch`,
                },
            ]);
        }
        if (master.tndTypeId !== tender.tdTenderTypeId) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: field('tdTenderTypeId'),
                    message: `Tender "${master.tndName}" is type ${master.tndTypeId}, not ${tender.tdTenderTypeId}`,
                },
            ]);
        }
        const amount = (0, receipt_utils_1.money)(tender.tdAmount);
        if (amount.lessThanOrEqualTo(0)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                { field: field('tdAmount'), message: 'A tender row must carry more than zero' },
            ]);
        }
        const isCheque = master.tndTypeId === receipt_enum_1.CHEQUE_TENDER_TYPE_ID;
        const instrumentDate = tender.tdInstrumentDate ? (0, receipt_utils_1.toDateOnly)(tender.tdInstrumentDate) : null;
        if (isCheque) {
            const missing = [];
            if (!instrumentDate)
                missing.push('tdInstrumentDate');
            if (!(0, receipt_utils_1.trimOrNull)(tender.tdRefNo))
                missing.push('tdRefNo');
            if (!(0, receipt_utils_1.trimOrNull)(tender.tdBankName))
                missing.push('tdBankName');
            if (missing.length > 0) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field(missing[0]),
                        message: `A cheque needs ${missing.join(', ')}`,
                    },
                ]);
            }
        }
        const received = (0, receipt_utils_1.money)(tender.tdReceivedAmt ?? 0);
        const change = (0, receipt_utils_1.money)(tender.tdChangeAmt ?? 0);
        if (received.greaterThan(0) && !received.minus(change).equals(amount)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: field('tdReceivedAmt'),
                    message: `Received ${received.toFixed(2)} less change ${change.toFixed(2)} is ` +
                        `${received.minus(change).toFixed(2)}, but the row is for ${amount.toFixed(2)}`,
                },
            ]);
        }
        const tenderLedgerId = master.tndEditLedger
            ? (tender.tdTenderLedgerId ?? master.tndLedgerId)
            : master.tndLedgerId;
        if (!master.tndEditLedger &&
            tender.tdTenderLedgerId &&
            tender.tdTenderLedgerId !== master.tndLedgerId) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: field('tdTenderLedgerId'),
                    message: `Tender "${master.tndName}" does not allow its ledger to be changed`,
                },
            ]);
        }
        const surchargePerc = master.tndEditSurcharge
            ? (0, receipt_utils_1.money)(tender.tdSurchargePerc ?? master.tndSurchargePerc)
            : (0, receipt_utils_1.money)(master.tndSurchargePerc);
        const surchargeAmt = master.tndEditSurcharge
            ? (0, receipt_utils_1.money)(tender.tdSurchargeAmt ?? master.tndSurchargeAmount)
            : (0, receipt_utils_1.money)(surchargePerc.greaterThan(0)
                ? amount.times(surchargePerc).dividedBy(100)
                : master.tndSurchargeAmount);
        normalised.push({
            rowNo: tender.tdRowNo,
            tenderId: master.tndId,
            tenderName: master.tndName,
            tenderTypeId: master.tndTypeId,
            tenderTypeName: master.tenderType?.ttmTypeName ?? '',
            tenderLedgerId,
            clearingLedgerId: master.tndSettlementLedgerId,
            surchargeLedgerId: master.tndSurchargeLedgerId,
            amount,
            receivedAmt: received,
            changeAmt: change,
            mdrAmt: (0, receipt_utils_1.money)(tender.tdMdrAmt ?? 0),
            surchargePerc,
            surchargeAmt,
            refNo: (0, receipt_utils_1.trimOrNull)(tender.tdRefNo),
            authCode: (0, receipt_utils_1.trimOrNull)(tender.tdAuthCode),
            cardLast4: (0, receipt_utils_1.trimOrNull)(tender.tdCardLast4),
            bankName: (0, receipt_utils_1.trimOrNull)(tender.tdBankName),
            payerVpa: (0, receipt_utils_1.trimOrNull)(tender.tdPayerVpa),
            instrumentDate,
            isCheque,
            isPdc: Boolean(isCheque && instrumentDate && instrumentDate > params.receiptDate),
            notes: (0, receipt_utils_1.trimOrNull)(tender.tdNotes),
            settlementMode: settlementModeForTenderType(master.tndTypeId),
            cheque: isCheque
                ? {
                    bankBranch: (0, receipt_utils_1.trimOrNull)(tender.cheque?.bankBranch),
                    ifsc: (0, receipt_utils_1.trimOrNull)(tender.cheque?.ifsc),
                    micr: (0, receipt_utils_1.trimOrNull)(tender.cheque?.micr),
                    drawerName: (0, receipt_utils_1.trimOrNull)(tender.cheque?.drawerName),
                    bankLedgerId: tender.cheque?.bankLedgerId ?? null,
                }
                : null,
            tdId: tender.tdId ?? null,
        });
    });
    return normalised.sort((left, right) => left.rowNo - right.rowNo);
}
function settlementModeForTenderType(typeId) {
    switch (typeId) {
        case 1:
            return receipt_enum_1.BillSettlementMode.CASH;
        case 2:
            return receipt_enum_1.BillSettlementMode.CARD;
        case 3:
            return receipt_enum_1.BillSettlementMode.UPI;
        case 4:
            return receipt_enum_1.BillSettlementMode.WALLET;
        case receipt_enum_1.CHEQUE_TENDER_TYPE_ID:
            return receipt_enum_1.BillSettlementMode.CHEQUE;
        case 10:
            return receipt_enum_1.BillSettlementMode.LOYALTY;
        case 11:
            return receipt_enum_1.BillSettlementMode.VOUCHER;
        default:
            return receipt_enum_1.BillSettlementMode.BANK;
    }
}
async function normaliseOtherLines(client, params) {
    const lines = [];
    const freeLedgerIds = params.lines
        .filter((line) => !line.role && line.ledgerId)
        .map((line) => line.ledgerId);
    const freeLedgers = freeLedgerIds.length === 0
        ? []
        : await client.accLedgerMaster.findMany({
            where: {
                ledId: { in: [...new Set(freeLedgerIds)] },
                ledIsDeleted: false,
                OR: [{ ledCompanyId: null }, { ledCompanyId: params.companyId }],
            },
            select: { ledId: true, ledName: true, ledIsActive: true },
        });
    const freeLedgerById = new Map(freeLedgers.map((ledger) => [ledger.ledId, ledger]));
    params.lines.forEach((line, index) => {
        const field = (name) => `otherLines.${index}.${name}`;
        const lineNo = index + 1;
        const amount = (0, receipt_utils_1.money)(line.amount);
        if (amount.lessThanOrEqualTo(0)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                { field: field('amount'), message: 'An other-ledger line must carry more than zero' },
            ]);
        }
        if (Boolean(line.role) === Boolean(line.ledgerId)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: field('role'),
                    message: 'Give the line either a role — which every report can find again — or a ledger ' +
                        'chosen by hand. Not both, and not neither.',
                },
            ]);
        }
        if (line.role) {
            const side = receipt_enum_1.ROLE_SIDE[line.role];
            if (!side) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('role'),
                        message: `"${line.role}" is not a role a receipt may post to. Use one of ` +
                            `${Object.keys(receipt_enum_1.ROLE_SIDE).join(', ')}, or pick a ledger by hand.`,
                    },
                ]);
            }
            if (side !== line.drCr) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('drCr'),
                        message: `${line.role} posts ${side}, not ${line.drCr}`,
                    },
                ]);
            }
            const mapped = params.ledgerForRole(line.role);
            if (!mapped) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Posting ledgers are not configured', [
                    {
                        field: field('role'),
                        message: `Nothing maps "${line.role}" to a ledger — accounts.acc_ledger_map has no row for it`,
                    },
                ]);
            }
            const mode = receipt_enum_1.ROLE_SETTLEMENT_MODE[line.role];
            const settles = line.drCr === receipt_enum_1.DrCr.DR && (line.settlesBill ?? Boolean(mode));
            if (settles && !mode) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('settlesBill'),
                        message: `${line.role} cannot settle a bill — it is not a deduction the customer withheld ` +
                            'from what they owe. Leave settlesBill off.',
                    },
                ]);
            }
            lines.push({
                lineNo,
                role: line.role,
                ledgerId: mapped.ledgerId,
                ledgerName: mapped.ledgerName,
                drCr: line.drCr,
                amount,
                settlesBill: settles,
                narration: (0, receipt_utils_1.trimOrNull)(line.narration),
                settlementMode: mode ?? receipt_enum_1.FREE_LEDGER_SETTLEMENT_MODE,
                isInstrumentSplit: false,
            });
            return;
        }
        const ledger = freeLedgerById.get(line.ledgerId);
        if (!ledger) {
            (0, module_service_utils_1.throwAccountsNotFound)('Ledger not found', field('ledgerId'), `No live ledger ${line.ledgerId} is visible to this company`);
        }
        if (!ledger.ledIsActive) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                { field: field('ledgerId'), message: `"${ledger.ledName}" is inactive` },
            ]);
        }
        if (ledger.ledId === params.partyId) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: field('ledgerId'),
                    message: `"${ledger.ledName}" is the party of this receipt and cannot also be a line on it`,
                },
            ]);
        }
        lines.push({
            lineNo,
            role: null,
            ledgerId: ledger.ledId,
            ledgerName: ledger.ledName,
            drCr: line.drCr,
            amount,
            settlesBill: line.drCr === receipt_enum_1.DrCr.DR && (line.settlesBill ?? false),
            narration: (0, receipt_utils_1.trimOrNull)(line.narration),
            settlementMode: receipt_enum_1.FREE_LEDGER_SETTLEMENT_MODE,
            isInstrumentSplit: false,
        });
    });
    seedInstrumentSplit(lines, params, {
        role: receipt_enum_1.ReceiptLedgerRole.BANK_CHARGES,
        drCr: receipt_enum_1.DrCr.DR,
        total: sumTenders(params.tenders, (tender) => tender.mdrAmt),
        field: 'tenders.tdMdrAmt',
        what: 'bank charges',
    });
    seedInstrumentSplit(lines, params, {
        role: receipt_enum_1.ReceiptLedgerRole.SURCHARGE_RECOVERED,
        drCr: receipt_enum_1.DrCr.CR,
        total: sumTenders(params.tenders, (tender) => tender.surchargeAmt),
        field: 'tenders.tdSurchargeAmt',
        what: 'card surcharge',
    });
    return { lines, expected: { missing: expectedRoles(params, lines) } };
}
function seedInstrumentSplit(lines, params, spec) {
    const existing = lines.filter((line) => line.role === spec.role);
    const supplied = existing.reduce((total, line) => total.plus(line.amount), receipt_utils_1.ZERO);
    if (spec.total.lessThanOrEqualTo(0)) {
        if (supplied.greaterThan(0)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: spec.field,
                    message: `The payload carries ${supplied.toFixed(2)} of ${spec.what}, but no tender row has any. ` +
                        'Put it on the instrument it came from.',
                },
            ]);
        }
        return;
    }
    if (existing.length > 0) {
        if (!supplied.equals(spec.total)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: spec.field,
                    message: `The tenders carry ${spec.total.toFixed(2)} of ${spec.what} and the ${spec.role} line ` +
                        `says ${supplied.toFixed(2)}. They must agree.`,
                },
            ]);
        }
        for (const line of existing) {
            line.isInstrumentSplit = spec.drCr === receipt_enum_1.DrCr.DR;
        }
        return;
    }
    const mapped = params.ledgerForRole(spec.role);
    if (!mapped) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Posting ledgers are not configured', [
            {
                field: spec.field,
                message: `The tenders carry ${spec.total.toFixed(2)} of ${spec.what}, and nothing maps ` +
                    `"${spec.role}" to a ledger`,
            },
        ]);
    }
    lines.push({
        lineNo: lines.length + 1,
        role: spec.role,
        ledgerId: mapped.ledgerId,
        ledgerName: mapped.ledgerName,
        drCr: spec.drCr,
        amount: spec.total,
        settlesBill: false,
        narration: null,
        settlementMode: receipt_enum_1.FREE_LEDGER_SETTLEMENT_MODE,
        isInstrumentSplit: spec.drCr === receipt_enum_1.DrCr.DR,
    });
}
function sumTenders(tenders, pick) {
    return tenders.reduce((total, tender) => total.plus(pick(tender)), receipt_utils_1.ZERO).toDecimalPlaces(2);
}
function expectedRoles(params, lines) {
    const present = new Set(lines.map((line) => line.role));
    const missing = [];
    if (params.party.ledIsTdsApplicable && !present.has(receipt_enum_1.ReceiptLedgerRole.TDS_RECEIVABLE)) {
        missing.push(receipt_enum_1.ReceiptLedgerRole.TDS_RECEIVABLE);
    }
    if (params.party.ledIsTcsApplicable &&
        params.settings.tcsBasis === receipt_enum_1.TcsBasis.RECEIPT &&
        !present.has(receipt_enum_1.ReceiptLedgerRole.TCS_PAYABLE)) {
        missing.push(receipt_enum_1.ReceiptLedgerRole.TCS_PAYABLE);
    }
    return missing;
}
//# sourceMappingURL=receipt-lines.js.map