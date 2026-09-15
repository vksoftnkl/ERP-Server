"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertAccYearWritable = assertAccYearWritable;
exports.accYearOf = accYearOf;
exports.assertVoucherPartitionExists = assertVoucherPartitionExists;
exports.loadParty = loadParty;
exports.loadReceiptVoucherType = loadReceiptVoucherType;
exports.assertHeaderScope = assertHeaderScope;
exports.lockBills = lockBills;
exports.assertBillUsable = assertBillUsable;
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const receipt_enum_1 = require("./types/receipt-enum");
const receipt_utils_1 = require("./receipt.utils");
async function assertAccYearWritable(client, companyId, accYear, field) {
    if (!(0, receipt_utils_1.isValidAccYear)(accYear)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `"${accYear}" is not an accounting year — expected YYYY-YYYY with the second half one greater than the first`,
            },
        ]);
    }
    const year = await client.fiscalYear.findFirst({
        where: { compId: companyId, fyYearName: accYear, isDeleted: false },
        select: { fyStatus: true, fyLockDate: true, fyYearName: true },
    });
    if (!year) {
        return;
    }
    if (year.fyStatus !== 'OPEN') {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `Accounting year ${year.fyYearName} is ${year.fyStatus} and cannot be written to`,
            },
        ]);
    }
    if (year.fyLockDate && year.fyLockDate.getTime() <= Date.now()) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field,
                message: `Accounting year ${year.fyYearName} was locked on ${year.fyLockDate
                    .toISOString()
                    .slice(0, 10)} and cannot be written to`,
            },
        ]);
    }
}
function accYearOf(date) {
    const year = date.getUTCFullYear();
    const start = date.getUTCMonth() >= 3 ? year : year - 1;
    return `${start}-${start + 1}`;
}
async function assertVoucherPartitionExists(tx, accYear, field) {
    const suffix = accYear.replace('-', '_');
    const rows = await tx.$queryRaw `
    SELECT count(*)::int AS present
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'accounts'
       AND c.relname IN (${`acc_voucher_header_${suffix}`}, ${`acc_vouchers_${suffix}`})`;
    if ((rows[0]?.present ?? 0) < 2) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Accounting year is not set up', [
            {
                field,
                message: `${accYear} has no voucher partitions. Run ` +
                    `SELECT public.ensure_acc_year_partitions('${accYear}'); and try again.`,
            },
        ]);
    }
}
async function loadParty(client, companyId, partyId, field = 'avhPartyId') {
    const ledger = await client.accLedgerMaster.findFirst({
        where: {
            ledId: partyId,
            ledIsDeleted: false,
            OR: [{ ledCompanyId: null }, { ledCompanyId: companyId }],
        },
        select: {
            ledId: true,
            ledName: true,
            ledIsActive: true,
            ledIsBillByBill: true,
            ledIsTdsApplicable: true,
            ledTdsDeducteeType: true,
            ledIsTcsApplicable: true,
            ledTanNo: true,
            accGroupMaster: { select: { accGroupName: true, accGroupNature: true } },
        },
    });
    if (!ledger) {
        (0, module_service_utils_1.throwAccountsNotFound)('Party not found', field, `No ledger ${partyId} is visible to this company`);
    }
    if (!ledger.ledIsActive) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field, message: `"${ledger.ledName}" is inactive and cannot receive a receipt` },
        ]);
    }
    return {
        ledId: ledger.ledId,
        ledName: ledger.ledName,
        ledIsBillByBill: ledger.ledIsBillByBill,
        ledIsTdsApplicable: ledger.ledIsTdsApplicable ?? false,
        ledTdsDeducteeType: ledger.ledTdsDeducteeType ?? null,
        ledIsTcsApplicable: ledger.ledIsTcsApplicable ?? false,
        ledTanNo: ledger.ledTanNo ?? null,
        groupName: ledger.accGroupMaster?.accGroupName ?? null,
        groupNature: ledger.accGroupMaster?.accGroupNature ?? null,
    };
}
async function loadReceiptVoucherType(client) {
    const type = await client.accVoucherType.findFirst({
        where: { vchrTypeCode: receipt_enum_1.RECEIPT_VOUCHER_TYPE_CODE },
        select: { vchrTypeId: true, vchrTypeCode: true, vchrTypeName: true, vchrIsActive: true },
    });
    if (!type || !type.vchrIsActive) {
        (0, module_service_utils_1.throwAccountsNotFound)('Receipt voucher type is not configured', 'avhVoucherTypeId', `accounts.acc_voucher_types has no active row with vchr_type_code = '${receipt_enum_1.RECEIPT_VOUCHER_TYPE_CODE}'. ` +
            'Run migration 20260915120000.');
    }
    return {
        vchrTypeId: type.vchrTypeId,
        vchrTypeCode: type.vchrTypeCode,
        vchrTypeName: type.vchrTypeName,
    };
}
function assertHeaderScope(header, keys) {
    if (header.avhCompanyId !== keys.companyId ||
        header.avhBranchId !== keys.branchId ||
        header.avhAccYear !== keys.accYear) {
        (0, module_service_utils_1.throwAccountsNotFound)('Receipt not found', 'avhVoucherId', `No receipt ${keys.voucherId} at this company / branch / year`);
    }
}
async function lockBills(tx, bills) {
    if (bills.length === 0) {
        return new Map();
    }
    const ids = bills.map((bill) => bill.billId);
    const years = [...new Set(bills.map((bill) => bill.billAccYear))];
    const rows = await tx.$queryRaw `
    SELECT abl_id, abl_acc_year, abl_party_id, abl_bill_type, abl_doc_refno,
           abl_doc_date, abl_due_date, abl_bill_amount, abl_pending_amount,
           abl_dr_cr, abl_is_deleted, abl_company_id, abl_branch_id
      FROM accounts.acc_bill_balance
     WHERE abl_id       = ANY(${ids}::uuid[])
       AND abl_acc_year = ANY(${years}::bpchar[])
     ORDER BY abl_id
       FOR UPDATE`;
    return new Map(rows.map((row) => [
        `${row.abl_id}|${row.abl_acc_year}`,
        {
            ablId: row.abl_id,
            ablAccYear: row.abl_acc_year,
            ablPartyId: row.abl_party_id,
            ablBillType: row.abl_bill_type,
            ablDocRefno: row.abl_doc_refno,
            ablDocDate: row.abl_doc_date,
            ablDueDate: row.abl_due_date,
            ablBillAmount: new client_1.Prisma.Decimal(row.abl_bill_amount),
            ablPendingAmount: new client_1.Prisma.Decimal(row.abl_pending_amount),
            ablDrCr: row.abl_dr_cr,
            ablIsDeleted: row.abl_is_deleted,
            ablCompanyId: row.abl_company_id,
            ablBranchId: row.abl_branch_id,
        },
    ]));
}
function assertBillUsable(bill, expect) {
    if (!bill || bill.ablIsDeleted) {
        (0, module_service_utils_1.throwAccountsNotFound)('Bill not found', expect.field, `No live bill ${expect.billId}`);
    }
    if (bill.ablPartyId !== expect.partyId) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: expect.field,
                message: `Bill ${bill.ablDocRefno} belongs to another party`,
            },
        ]);
    }
    if (bill.ablCompanyId !== expect.companyId) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            { field: expect.field, message: `Bill ${bill.ablDocRefno} belongs to another company` },
        ]);
    }
    const allowed = expect.kind === 'RECEIVABLE' ? receipt_enum_1.RECEIVABLE_BILL_TYPES : receipt_enum_1.CREDIT_BILL_TYPES;
    if (!allowed.includes(bill.ablBillType)) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: expect.field,
                message: `Bill ${bill.ablDocRefno} is a ${bill.ablBillType} bill and cannot be settled as ` +
                    `${expect.kind === 'RECEIVABLE' ? 'a receivable' : 'a credit'} by a receipt`,
            },
        ]);
    }
    const wantSide = expect.kind === 'RECEIVABLE' ? 'DR' : 'CR';
    if (bill.ablDrCr !== wantSide) {
        (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
            {
                field: expect.field,
                message: `Bill ${bill.ablDocRefno} sits on the ${bill.ablDrCr} side of this party's account, ` +
                    `and a ${expect.kind === 'RECEIVABLE' ? 'receivable' : 'credit'} must be ${wantSide}`,
            },
        ]);
    }
    return bill;
}
//# sourceMappingURL=receipt.guards.js.map