"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalisePaymentTenders = normalisePaymentTenders;
exports.normalisePaymentOtherLines = normalisePaymentOtherLines;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const cheque_book_helper_1 = require("../vouchers/cheque-book.helper");
const receipt_utils_1 = require("../receipt/receipt.utils");
const payment_enum_1 = require("./types/payment-enum");
const payment_tds_1 = require("./payment-tds");
async function normalisePaymentTenders(client, params) {
    if (params.tenders.length === 0) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: 'tenders',
                message: 'A payment with no instruments is a journal, not a payment. Even a payment settled ' +
                    'entirely from a debit the party holds needs a journal voucher instead.',
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
            tndEditLedger: true,
            tndIsActive: true,
            tenderType: { select: { ttmTypeId: true, ttmTypeName: true, ttmIsCash: true } },
        },
    });
    const masterById = new Map(masters.map((master) => [master.tndId, master]));
    const bookIds = params.tenders
        .filter((tender) => tender.tdTenderTypeId === payment_enum_1.CHEQUE_TENDER_TYPE_ID)
        .map((tender) => tender.cheque?.chequeBookId ?? '')
        .filter(Boolean);
    const books = await (0, cheque_book_helper_1.loadChequeBooks)(client, bookIds);
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
        const isCheque = master.tndTypeId === payment_enum_1.CHEQUE_TENDER_TYPE_ID;
        const isCashType = master.tenderType?.ttmIsCash ?? false;
        const instrumentDate = tender.tdInstrumentDate
            ? (0, receipt_utils_1.toDateOnly)(tender.tdInstrumentDate)
            : isCheque
                ? params.paymentDate
                : null;
        let cheque = null;
        let tenderLedgerId;
        if (isCheque) {
            if ((0, receipt_utils_1.trimOrNull)(tender.tdRefNo)) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('tdRefNo'),
                        message: 'A cheque we issue takes its number from the book at post — leave tdRefNo empty ' +
                            'and name the book in cheque.chequeBookId.',
                    },
                ]);
            }
            const book = tender.cheque?.chequeBookId ? books.get(tender.cheque.chequeBookId) : undefined;
            if (!tender.cheque?.chequeBookId) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('cheque.chequeBookId'),
                        message: 'A cheque row must name the book its leaf comes from',
                    },
                ]);
            }
            if (!book || book.isDeleted) {
                (0, module_service_utils_1.throwAccountsNotFound)('Cheque book not found', field('cheque.chequeBookId'), `No live cheque book ${tender.cheque.chequeBookId}`);
            }
            assertBookUsable(book, params, field('cheque.chequeBookId'));
            if (instrumentDate && instrumentDate < params.paymentDate) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('tdInstrumentDate'),
                        message: 'A cheque we issue is dated the payment or later — it cannot be back-dated',
                    },
                ]);
            }
            cheque = {
                chequeBookId: book.chequeBookId,
                bookNo: book.bookNo,
                bankLedgerId: book.bankLedgerId,
                bankName: book.bankName,
                favouring: (0, receipt_utils_1.trimOrNull)(tender.cheque.favouring) ?? params.partyName.slice(0, 150),
                acPayee: tender.cheque.acPayee ?? true,
                bankBranch: (0, receipt_utils_1.trimOrNull)(tender.cheque.bankBranch),
                ifsc: (0, receipt_utils_1.trimOrNull)(tender.cheque.ifsc),
                micr: (0, receipt_utils_1.trimOrNull)(tender.cheque.micr),
                drawerName: (0, receipt_utils_1.trimOrNull)(tender.cheque.drawerName),
            };
            tenderLedgerId = book.bankLedgerId;
        }
        else {
            tenderLedgerId = master.tndEditLedger
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
        }
        const received = (0, receipt_utils_1.money)(tender.tdReceivedAmt ?? 0);
        const change = (0, receipt_utils_1.money)(tender.tdChangeAmt ?? 0);
        if (received.greaterThan(0) && !received.minus(change).equals(amount)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: field('tdReceivedAmt'),
                    message: `Paid ${received.toFixed(2)} less change ${change.toFixed(2)} is ` +
                        `${received.minus(change).toFixed(2)}, but the row is for ${amount.toFixed(2)}`,
                },
            ]);
        }
        const beneficiary = !isCheque && !isCashType && tender.beneficiary
            ? {
                name: (0, receipt_utils_1.trimOrNull)(tender.beneficiary.name),
                accountNo: (0, receipt_utils_1.trimOrNull)(tender.beneficiary.accountNo),
                ifsc: (0, receipt_utils_1.trimOrNull)(tender.beneficiary.ifsc)?.toUpperCase() ?? null,
            }
            : null;
        normalised.push({
            rowNo: tender.tdRowNo,
            tenderId: master.tndId,
            tenderName: master.tndName,
            tenderTypeId: master.tndTypeId,
            tenderTypeName: master.tenderType?.ttmTypeName ?? '',
            isCashType,
            tenderLedgerId,
            clearingLedgerId: isCheque ? null : master.tndSettlementLedgerId,
            amount,
            receivedAmt: received,
            changeAmt: change,
            mdrAmt: (0, receipt_utils_1.money)(tender.tdMdrAmt ?? 0),
            refNo: isCheque ? null : (0, receipt_utils_1.trimOrNull)(tender.tdRefNo),
            bankName: (0, receipt_utils_1.trimOrNull)(tender.tdBankName) ?? cheque?.bankName ?? null,
            payerVpa: (0, receipt_utils_1.trimOrNull)(tender.tdPayerVpa),
            instrumentDate,
            isCheque,
            isPdc: Boolean(isCheque && instrumentDate && instrumentDate > params.paymentDate),
            notes: (0, receipt_utils_1.trimOrNull)(tender.tdNotes),
            settlementMode: settlementModeForTenderType(master.tndTypeId),
            cheque,
            beneficiary,
            tdId: tender.tdId ?? null,
        });
    });
    return normalised.sort((left, right) => left.rowNo - right.rowNo);
}
function assertBookUsable(book, params, field) {
    if (book.companyId !== params.companyId) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field, message: `Cheque book ${book.bookNo} belongs to another company` },
        ]);
    }
    if (book.branchId !== null && book.branchId !== params.branchId) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field, message: `Cheque book ${book.bookNo} is not usable at this branch` },
        ]);
    }
    if (book.status !== 'ACTIVE' || (0, cheque_book_helper_1.leavesLeft)(book) <= 0) {
        (0, module_service_utils_1.throwAccountsConflict)('Cheque book has no leaf to give', [
            {
                field,
                message: `Book ${book.bookNo} on ${book.bankName} is ${book.status === 'ACTIVE' ? 'used up' : book.status} ` +
                    '— start a new book (Cheque Books, menu 263) or pick another.',
            },
        ]);
    }
}
function settlementModeForTenderType(typeId) {
    switch (typeId) {
        case 1:
            return payment_enum_1.BillSettlementMode.CASH;
        case 2:
            return payment_enum_1.BillSettlementMode.CARD;
        case 3:
            return payment_enum_1.BillSettlementMode.UPI;
        case 4:
            return payment_enum_1.BillSettlementMode.WALLET;
        case payment_enum_1.CHEQUE_TENDER_TYPE_ID:
            return payment_enum_1.BillSettlementMode.CHEQUE;
        default:
            return payment_enum_1.BillSettlementMode.BANK;
    }
}
async function normalisePaymentOtherLines(client, params) {
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
            const role = line.role;
            const roundingUp = role === payment_enum_1.PaymentLedgerRole.ROUND_OFF && line.drCr === payment_enum_1.DrCr.DR;
            const side = roundingUp ? payment_enum_1.DrCr.DR : payment_enum_1.PAYMENT_ROLE_SIDE[role];
            if (!side) {
                const rides = role === payment_enum_1.PaymentLedgerRole.DISCOUNT_RECEIVED ||
                    line.role === 'WRITE_OFF' ||
                    role === payment_enum_1.PaymentLedgerRole.ROUND_OFF;
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('role'),
                        message: rides
                            ? `${line.role} is not keyed as a line — it rides on allocations[].discount / .writeoff / ` +
                                '.roundoff, and sending both would count it twice.' +
                                (role === payment_enum_1.PaymentLedgerRole.ROUND_OFF
                                    ? ' (Paying a few paise MORE than a bill is a DR ROUND_OFF line.)'
                                    : '')
                            : `"${line.role}" is not a role a payment may post to. Use one of ` +
                                `${[...Object.keys(payment_enum_1.PAYMENT_ROLE_SIDE), 'ROUND_OFF (DR)'].join(', ')}, or pick a ledger by hand.`,
                    },
                ]);
            }
            if (side !== line.drCr) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    { field: field('drCr'), message: `${line.role} posts ${side}, not ${line.drCr}` },
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
            const mode = payment_enum_1.PAYMENT_ROLE_SETTLEMENT_MODE[line.role];
            const settles = line.drCr === payment_enum_1.DrCr.CR && (line.settlesBill ?? Boolean(mode));
            if (settles && !mode) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('settlesBill'),
                        message: `${line.role} cannot settle a bill — it is not a deduction from what we owe. Leave settlesBill off.`,
                    },
                ]);
            }
            const approvedBy = (0, receipt_utils_1.trimOrNull)(line.approvedBy);
            if (role === payment_enum_1.PaymentLedgerRole.BALANCES_WRITTEN_BACK &&
                amount.greaterThan(params.settings.writeoffApprovalAbove) &&
                !approvedBy) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: field('approvedBy'),
                        message: `Writing back ${amount.toFixed(2)} needs an approver ` +
                            `(accounts.writeoff_approval_above is ${params.settings.writeoffApprovalAbove.toFixed(2)})`,
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
                settlementMode: mode ?? payment_enum_1.FREE_LEDGER_SETTLEMENT_MODE,
                isInstrumentSplit: false,
                approvedBy,
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
                    message: `"${ledger.ledName}" is the party of this payment and cannot also be a line on it`,
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
            settlesBill: line.drCr === payment_enum_1.DrCr.CR && (line.settlesBill ?? false),
            narration: (0, receipt_utils_1.trimOrNull)(line.narration),
            settlementMode: payment_enum_1.FREE_LEDGER_SETTLEMENT_MODE,
            isInstrumentSplit: false,
            approvedBy: null,
        });
    });
    seedBankCharges(lines, params);
    const tds = seedTds(lines, params);
    return { lines, tds };
}
function seedBankCharges(lines, params) {
    const total = params.tenders
        .reduce((sum, tender) => sum.plus(tender.mdrAmt), receipt_utils_1.ZERO)
        .toDecimalPlaces(2);
    const existing = lines.filter((line) => line.role === payment_enum_1.PaymentLedgerRole.BANK_CHARGES);
    const supplied = existing.reduce((sum, line) => sum.plus(line.amount), receipt_utils_1.ZERO);
    if (total.lessThanOrEqualTo(0)) {
        if (supplied.greaterThan(0)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'tenders.tdMdrAmt',
                    message: `The payload carries ${supplied.toFixed(2)} of bank charges, but no tender row has any. ` +
                        'Put it on the instrument it came from.',
                },
            ]);
        }
        return;
    }
    if (existing.length > 0) {
        if (!supplied.equals(total)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'tenders.tdMdrAmt',
                    message: `The tenders carry ${total.toFixed(2)} of bank charges and the BANK_CHARGES line ` +
                        `says ${supplied.toFixed(2)}. They must agree.`,
                },
            ]);
        }
        for (const line of existing) {
            line.isInstrumentSplit = true;
        }
        return;
    }
    const mapped = params.ledgerForRole(payment_enum_1.PaymentLedgerRole.BANK_CHARGES);
    if (!mapped) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Posting ledgers are not configured', [
            {
                field: 'tenders.tdMdrAmt',
                message: `The tenders carry ${total.toFixed(2)} of bank charges, and nothing maps "BANK_CHARGES" to a ledger`,
            },
        ]);
    }
    lines.push({
        lineNo: lines.length + 1,
        role: payment_enum_1.PaymentLedgerRole.BANK_CHARGES,
        ledgerId: mapped.ledgerId,
        ledgerName: mapped.ledgerName,
        drCr: payment_enum_1.DrCr.DR,
        amount: total,
        settlesBill: false,
        narration: null,
        settlementMode: payment_enum_1.FREE_LEDGER_SETTLEMENT_MODE,
        isInstrumentSplit: true,
        approvedBy: null,
    });
}
function seedTds(lines, params) {
    const keyed = lines.filter((line) => line.role === payment_enum_1.PaymentLedgerRole.TDS_PAYABLE);
    const keyedTotal = keyed.reduce((sum, line) => sum.plus(line.amount), receipt_utils_1.ZERO);
    if (!params.party.ledIsTdsApplicable) {
        if (keyed.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'otherLines',
                    message: `${params.party.ledName} is not TDS-applicable in its ledger master, so TDS of ` +
                        `${keyedTotal.toFixed(2)} would reach TDS Payable with no section to file it under ` +
                        'in 26Q. Mark the party TDS-applicable (section and deductee type) and the payment ' +
                        'will work the deduction out itself.',
                },
            ]);
        }
        return null;
    }
    if (!params.tds || !params.tds.rate) {
        (0, module_service_utils_1.throwAccountsBadRequest)('TDS rate is not configured', [
            {
                field: 'avhPartyId',
                message: `${params.party.ledName} is TDS-applicable under ${params.party.ledTdsSection ?? 'no section'} ` +
                    `(${params.party.ledTdsDeducteeType ?? 'ANY'}) and no rate is in force for it in accounts.tds_rates`,
            },
        ]);
    }
    const extras = lines
        .filter((line) => line.drCr === payment_enum_1.DrCr.DR)
        .reduce((sum, line) => sum.plus(line.amount), receipt_utils_1.ZERO);
    const paid = params.tenders.reduce((sum, tender) => sum.plus(tender.amount), receipt_utils_1.ZERO);
    const net = client_1.Prisma.Decimal.max(paid.minus(extras), receipt_utils_1.ZERO);
    const computed = (0, payment_tds_1.computePaymentTds)(params.party, params.tds, net);
    if (!computed) {
        return null;
    }
    const serverTax = computed.deducted ? computed.tax : receipt_utils_1.ZERO;
    if (keyed.length > 0) {
        if (!keyedTotal.equals(serverTax)) {
            (0, module_service_utils_1.throwAccountsConflict)('TDS does not agree', [
                {
                    field: 'otherLines',
                    message: `The client keyed TDS of ${keyedTotal.toFixed(2)}, but ${computed.section} @ ` +
                        `${computed.rate.toString()}% on ${computed.base.toFixed(2)} (${computed.rateSource}) ` +
                        `comes to ${serverTax.toFixed(2)}${computed.reason ? ` — ${computed.reason}` : ''}. ` +
                        'Re-read /payments/open-items and re-post.',
                },
            ]);
        }
        for (const line of keyed) {
            line.settlesBill = true;
            line.settlementMode = payment_enum_1.BillSettlementMode.TDS;
        }
        return computed;
    }
    if (serverTax.lessThanOrEqualTo(0)) {
        return computed;
    }
    const mapped = params.ledgerForRole(payment_enum_1.PaymentLedgerRole.TDS_PAYABLE);
    if (!mapped) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Posting ledgers are not configured', [
            {
                field: 'avhPartyId',
                message: `${params.party.ledName} is TDS-applicable, and nothing maps "TDS_PAYABLE" to a ledger`,
            },
        ]);
    }
    lines.push({
        lineNo: lines.length + 1,
        role: payment_enum_1.PaymentLedgerRole.TDS_PAYABLE,
        ledgerId: mapped.ledgerId,
        ledgerName: mapped.ledgerName,
        drCr: payment_enum_1.DrCr.CR,
        amount: serverTax,
        settlesBill: true,
        narration: `TDS ${computed.section} @ ${computed.rate.toString()}% on ${computed.base.toFixed(2)}`,
        settlementMode: payment_enum_1.BillSettlementMode.TDS,
        isInstrumentSplit: false,
        approvedBy: null,
    });
    return computed;
}
//# sourceMappingURL=payment-lines.js.map