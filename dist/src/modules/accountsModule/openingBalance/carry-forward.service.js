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
exports.CarryForwardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const opening_balance_service_1 = require("./opening-balance.service");
const ledger_roles_1 = require("./ledger-roles");
const opening_balance_guards_1 = require("./opening-balance.guards");
const opening_balance_utils_1 = require("./opening-balance.utils");
const opening_balance_api_types_1 = require("./types/opening-balance-api.types");
let CarryForwardService = class CarryForwardService {
    prisma;
    openingBalanceService;
    requestContextService;
    constructor(prisma, openingBalanceService, requestContextService) {
        this.prisma = prisma;
        this.openingBalanceService = openingBalanceService;
        this.requestContextService = requestContextService;
    }
    async run(dto) {
        const fromAccYear = this.requireAccYear(dto.fromAccYear, 'fromAccYear');
        const toAccYear = this.requireAccYear(dto.toAccYear, 'toAccYear');
        const branchId = dto.branchId ?? null;
        const overwriteManual = dto.overwriteManual ?? false;
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        if ((0, opening_balance_utils_1.nextAccYear)(fromAccYear) !== toAccYear) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'toAccYear',
                    message: `${toAccYear} does not follow ${fromAccYear} — a carry-forward moves one year at a time`,
                },
            ]);
        }
        return this.prisma.$transaction(async (tx) => {
            await (0, opening_balance_guards_1.assertAccYearWritable)(tx, dto.companyId, toAccYear, 'toAccYear');
            const ledgers = await (0, opening_balance_guards_1.loadVisibleLedgers)(tx, dto.companyId);
            const closings = await this.openingBalanceService.closingByLedger(tx, dto.companyId, branchId, fromAccYear);
            const carried = new Map();
            for (const [ledgerId, closing] of closings) {
                const ledger = ledgers.get(ledgerId);
                if (!ledger || !(0, opening_balance_guards_1.isBalanceSheetNature)(ledger.groupNature)) {
                    continue;
                }
                carried.set(ledgerId, closing);
            }
            const profitAndLoss = await this.profitAndLossResult(tx, dto.companyId, branchId, fromAccYear, ledgers);
            const retainedEarnings = await (0, ledger_roles_1.resolveRetainedEarningsLedger)(tx, dto.companyId, branchId);
            if (!(0, opening_balance_utils_1.money)(profitAndLoss).isZero()) {
                if (!retainedEarnings) {
                    (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                        {
                            field: 'companyId',
                            message: `${fromAccYear} has a profit and loss result of ${(0, opening_balance_utils_1.money)(profitAndLoss).abs().toFixed(2)} ` +
                                'that must be carried onto a ledger, but no ledger is mapped to the ' +
                                'RETAINED_EARNINGS role for this company. Map it in Posting Ledgers first.',
                        },
                    ]);
                }
                const existing = carried.get(retainedEarnings.ledgerId);
                const combined = (0, opening_balance_utils_1.money)((existing ? (0, opening_balance_utils_1.signedOpening)(existing.amount, existing.drCr) : opening_balance_utils_1.ZERO).plus(profitAndLoss));
                if (combined.isZero()) {
                    carried.delete(retainedEarnings.ledgerId);
                }
                else {
                    carried.set(retainedEarnings.ledgerId, (0, opening_balance_utils_1.splitSigned)(combined));
                }
            }
            const existingRows = await tx.accOpeningBalance.findMany({
                where: {
                    opCompanyId: dto.companyId,
                    opAccYear: toAccYear,
                    opBranchId: branchId === null ? { equals: null } : branchId,
                    opIsDeleted: false,
                },
                select: { opId: true, opLedgerId: true, opSource: true },
            });
            const existingByLedger = new Map(existingRows.map((row) => [row.opLedgerId, row]));
            const now = new Date();
            const sparedLedgerIds = new Set();
            let created = 0;
            let updated = 0;
            let skippedManual = 0;
            for (const [ledgerId, closing] of carried) {
                const existing = existingByLedger.get(ledgerId);
                if (existing && existing.opSource !== opening_balance_api_types_1.OpeningSource.CARRY_FORWARD && !overwriteManual) {
                    skippedManual += 1;
                    sparedLedgerIds.add(ledgerId);
                    continue;
                }
                if (existing) {
                    await tx.accOpeningBalance.update({
                        where: { opId_opAccYear: { opId: existing.opId, opAccYear: toAccYear } },
                        data: {
                            opAmount: closing.amount,
                            opDrCr: closing.drCr,
                            opSource: opening_balance_api_types_1.OpeningSource.CARRY_FORWARD,
                            opGeneratedAt: now,
                            opGeneratedBy: actor,
                            opIsStale: false,
                            opStaleSince: null,
                            opStaleReason: null,
                            opStaleRefId: null,
                            opStaleRefAccYear: null,
                            opModifiedAt: now,
                            opModifiedBy: actor,
                        },
                    });
                    updated += 1;
                    continue;
                }
                await tx.accOpeningBalance.create({
                    data: {
                        opCompanyId: dto.companyId,
                        opBranchId: branchId,
                        opAccYear: toAccYear,
                        opLedgerId: ledgerId,
                        opAmount: closing.amount,
                        opDrCr: closing.drCr,
                        opSource: opening_balance_api_types_1.OpeningSource.CARRY_FORWARD,
                        opGeneratedAt: now,
                        opGeneratedBy: actor,
                        opCreatedAt: now,
                        opCreatedBy: actor,
                    },
                    select: { opId: true },
                });
                created += 1;
            }
            const stale = existingRows.filter((row) => row.opSource === opening_balance_api_types_1.OpeningSource.CARRY_FORWARD && !carried.has(row.opLedgerId));
            if (stale.length > 0) {
                await tx.accOpeningBalance.updateMany({
                    where: { opId: { in: stale.map((row) => row.opId) }, opAccYear: toAccYear },
                    data: { opIsDeleted: true, opModifiedAt: now, opModifiedBy: actor },
                });
            }
            const bills = await this.carryBills(tx, {
                companyId: dto.companyId,
                branchId,
                fromAccYear,
                toAccYear,
                ledgers,
                sparedLedgerIds,
                overwriteManual,
                actor,
                now,
            });
            const billsCarried = bills.written;
            skippedManual += bills.skippedManual;
            await this.stampFiscalYear(tx, dto.companyId, fromAccYear, toAccYear);
            const totals = await this.totals(tx, dto.companyId, branchId, toAccYear, ledgers);
            const run = await tx.accOpeningRun.create({
                data: {
                    aorCompanyId: dto.companyId,
                    aorBranchId: branchId,
                    aorFromAccYear: fromAccYear,
                    aorToAccYear: toAccYear,
                    aorRunBy: actor,
                    aorCreated: created,
                    aorUpdated: updated,
                    aorSkippedManual: skippedManual,
                    aorTotalDebit: totals.debit,
                    aorTotalCredit: totals.credit,
                    aorOverwriteManual: overwriteManual,
                },
                select: { aorId: true },
            });
            const difference = (0, opening_balance_utils_1.money)(totals.debit.minus(totals.credit));
            return {
                runId: run.aorId,
                companyId: dto.companyId,
                branchId,
                fromAccYear,
                toAccYear,
                created,
                updated,
                skippedManual,
                billsCarried,
                totalDebit: (0, opening_balance_utils_1.toAmount)(totals.debit),
                totalCredit: (0, opening_balance_utils_1.toAmount)(totals.credit),
                difference: (0, opening_balance_utils_1.toAmount)(difference),
                isBalanced: difference.isZero(),
                profitAndLossResult: (0, opening_balance_utils_1.toAmount)((0, opening_balance_utils_1.money)(profitAndLoss)),
                retainedEarningsLedgerId: retainedEarnings?.ledgerId ?? null,
            };
        }, { timeout: 120_000, maxWait: 15_000 });
    }
    async profitAndLossResult(client, companyId, branchId, accYear, ledgers) {
        const movements = await client.$queryRaw `
      SELECT v.av_ledger_id AS led_id,
             SUM(v.av_signed_amount) AS signed
        FROM accounts.acc_vouchers v
        JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = v.av_voucher_id
         AND h.avh_acc_year   = v.av_acc_year
       WHERE v.av_company_id = ${companyId}::uuid
         AND v.av_acc_year   = ${accYear}
         AND v.av_is_deleted = false
         AND h.avh_voucher_status = 'POSTED'
         AND (${branchId}::uuid IS NULL OR v.av_branch_id = ${branchId}::uuid)
       GROUP BY v.av_ledger_id
    `;
        let result = opening_balance_utils_1.ZERO;
        for (const movement of movements) {
            const ledger = ledgers.get(movement.led_id);
            if (!ledger || ledger.groupNature === null || (0, opening_balance_guards_1.isBalanceSheetNature)(ledger.groupNature)) {
                continue;
            }
            result = result.plus(movement.signed ?? opening_balance_utils_1.ZERO);
        }
        return result;
    }
    async carryBills(client, params) {
        const billWiseIds = [...params.ledgers.values()]
            .filter((ledger) => ledger.ledIsBillByBill && !params.sparedLedgerIds.has(ledger.ledId))
            .map((ledger) => ledger.ledId);
        if (billWiseIds.length === 0) {
            return { written: 0, skippedManual: 0 };
        }
        const openBills = await client.accBillBalance.findMany({
            where: {
                ablCompanyId: params.companyId,
                ablAccYear: params.fromAccYear,
                ablPartyId: { in: billWiseIds },
                ablIsDeleted: false,
                ...(params.branchId === null ? {} : { ablBranchId: params.branchId }),
            },
            select: {
                ablId: true,
                ablBranchId: true,
                ablTenantId: true,
                ablPartyId: true,
                ablSalesmanId: true,
                ablAgentId: true,
                ablDocRefno: true,
                ablDocDate: true,
                ablDueDate: true,
                ablCreditDays: true,
                ablGraceDays: true,
                ablDrCr: true,
                ablPendingAmount: true,
                ablNarration: true,
            },
            orderBy: [{ ablPartyId: 'asc' }, { ablDocDate: 'asc' }],
        });
        const carriable = openBills.filter((bill) => bill.ablPendingAmount !== null && bill.ablPendingAmount.greaterThan(0));
        if (carriable.length === 0) {
            return { written: 0, skippedManual: 0 };
        }
        const byParty = new Map();
        for (const bill of carriable) {
            const key = `${bill.ablPartyId}|${bill.ablBranchId}`;
            const bucket = byParty.get(key) ?? [];
            bucket.push(bill);
            byParty.set(key, bucket);
        }
        const existingCarried = await client.accBillBalance.findMany({
            where: {
                ablCompanyId: params.companyId,
                ablAccYear: params.toAccYear,
                ablBillType: opening_balance_api_types_1.OPENING_BILL_TYPE,
                ablParentAccYear: params.fromAccYear,
                ablParentBillId: { in: carriable.map((bill) => bill.ablId) },
                ablIsDeleted: false,
            },
            select: {
                ablId: true,
                ablParentBillId: true,
                ablAllocAmount: true,
                ablDiscAmount: true,
                ablWriteoffAmount: true,
            },
        });
        const carriedByParent = new Map(existingCarried
            .filter((bill) => bill.ablParentBillId !== null)
            .map((bill) => [bill.ablParentBillId, { ablId: bill.ablId, frozen: (0, opening_balance_utils_1.isBillFrozen)(bill) }]));
        let written = 0;
        let skippedManual = 0;
        for (const [key, bills] of byParty) {
            const [partyId, billBranchId] = key.split('|');
            let signed = opening_balance_utils_1.ZERO;
            for (const bill of bills) {
                signed = signed.plus(bill.ablDrCr === 'DR' ? bill.ablPendingAmount : bill.ablPendingAmount.negated());
            }
            const total = (0, opening_balance_utils_1.money)(signed);
            if (total.isZero()) {
                continue;
            }
            const split = (0, opening_balance_utils_1.splitSigned)(total);
            const existingOpening = await client.accOpeningBalance.findFirst({
                where: {
                    opCompanyId: params.companyId,
                    opBranchId: billBranchId,
                    opAccYear: params.toAccYear,
                    opLedgerId: partyId,
                    opIsDeleted: false,
                },
                select: { opId: true, opSource: true },
            });
            if (existingOpening &&
                existingOpening.opSource !== opening_balance_api_types_1.OpeningSource.CARRY_FORWARD &&
                !params.overwriteManual) {
                skippedManual += 1;
                continue;
            }
            const opening = existingOpening
                ? await client.accOpeningBalance.update({
                    where: { opId_opAccYear: { opId: existingOpening.opId, opAccYear: params.toAccYear } },
                    data: {
                        opAmount: split.amount,
                        opDrCr: split.drCr,
                        opSource: opening_balance_api_types_1.OpeningSource.CARRY_FORWARD,
                        opGeneratedAt: params.now,
                        opGeneratedBy: params.actor,
                        opIsStale: false,
                        opStaleSince: null,
                        opStaleReason: null,
                        opStaleRefId: null,
                        opStaleRefAccYear: null,
                        opModifiedAt: params.now,
                        opModifiedBy: params.actor,
                    },
                    select: { opId: true },
                })
                : await client.accOpeningBalance.create({
                    data: {
                        opCompanyId: params.companyId,
                        opBranchId: billBranchId,
                        opAccYear: params.toAccYear,
                        opLedgerId: partyId,
                        opAmount: split.amount,
                        opDrCr: split.drCr,
                        opSource: opening_balance_api_types_1.OpeningSource.CARRY_FORWARD,
                        opGeneratedAt: params.now,
                        opGeneratedBy: params.actor,
                        opCreatedAt: params.now,
                        opCreatedBy: params.actor,
                    },
                    select: { opId: true },
                });
            for (const bill of bills) {
                const alreadyCarried = carriedByParent.get(bill.ablId);
                if (alreadyCarried) {
                    if (alreadyCarried.frozen) {
                        continue;
                    }
                    await client.accBillBalance.update({
                        where: { ablId_ablAccYear: { ablId: alreadyCarried.ablId, ablAccYear: params.toAccYear } },
                        data: {
                            ablBillAmount: bill.ablPendingAmount,
                            ablDrCr: bill.ablDrCr,
                            ablDueDate: bill.ablDueDate,
                            ablSrcDocId: opening.opId,
                            ablModifiedOn: params.now,
                            ablModifiedBy: params.actor,
                        },
                    });
                    written += 1;
                    continue;
                }
                await client.accBillBalance.create({
                    data: {
                        ablCompanyId: params.companyId,
                        ablBranchId: bill.ablBranchId,
                        ablTenantId: bill.ablTenantId,
                        ablAccYear: params.toAccYear,
                        ablPartyId: bill.ablPartyId,
                        ablSalesmanId: bill.ablSalesmanId,
                        ablAgentId: bill.ablAgentId,
                        ablBillType: opening_balance_api_types_1.OPENING_BILL_TYPE,
                        ablVoucherId: null,
                        ablVoucherTypeId: null,
                        ablSrcModule: opening_balance_api_types_1.OPENING_SRC_MODULE,
                        ablSrcDocType: opening_balance_api_types_1.OPENING_SRC_DOC_TYPE,
                        ablSrcDocId: opening.opId,
                        ablSrcAccYear: params.toAccYear,
                        ablParentBillId: bill.ablId,
                        ablParentAccYear: params.fromAccYear,
                        ablDocRefno: bill.ablDocRefno,
                        ablDocDate: bill.ablDocDate,
                        ablDueDate: bill.ablDueDate,
                        ablCreditDays: bill.ablCreditDays,
                        ablGraceDays: bill.ablGraceDays,
                        ablDrCr: bill.ablDrCr,
                        ablBillAmount: bill.ablPendingAmount,
                        ablAllocAmount: new client_1.Prisma.Decimal(0),
                        ablDiscAmount: new client_1.Prisma.Decimal(0),
                        ablWriteoffAmount: new client_1.Prisma.Decimal(0),
                        ablNarration: bill.ablNarration,
                        ablCreatedOn: params.now,
                        ablCreatedBy: params.actor,
                    },
                    select: { ablId: true },
                });
                written += 1;
            }
        }
        return { written, skippedManual };
    }
    async stampFiscalYear(client, companyId, fromAccYear, toAccYear) {
        const [from, to] = await Promise.all([
            client.fiscalYear.findFirst({
                where: { compId: companyId, fyYearName: fromAccYear, isDeleted: false },
                select: { fyId: true },
            }),
            client.fiscalYear.findFirst({
                where: { compId: companyId, fyYearName: toAccYear, isDeleted: false },
                select: { fyId: true },
            }),
        ]);
        if (!to) {
            return;
        }
        await client.fiscalYear.update({
            where: { fyId: to.fyId },
            data: {
                fyIsCarriedForward: true,
                fyCarriedForwardAt: new Date(),
                fyPrevFyId: from?.fyId ?? undefined,
            },
        });
    }
    async totals(client, companyId, branchId, accYear, ledgers) {
        const rows = await client.accOpeningBalance.findMany({
            where: {
                opCompanyId: companyId,
                opAccYear: accYear,
                opBranchId: branchId === null ? { equals: null } : branchId,
                opIsDeleted: false,
            },
            select: { opLedgerId: true, opAmount: true, opDrCr: true },
        });
        let debit = opening_balance_utils_1.ZERO;
        let credit = opening_balance_utils_1.ZERO;
        for (const row of rows) {
            if (!ledgers.has(row.opLedgerId)) {
                continue;
            }
            if (row.opDrCr === opening_balance_api_types_1.OpeningDrCr.DEBIT) {
                debit = debit.plus(row.opAmount);
            }
            else {
                credit = credit.plus(row.opAmount);
            }
        }
        return { debit: (0, opening_balance_utils_1.money)(debit), credit: (0, opening_balance_utils_1.money)(credit) };
    }
    requireAccYear(accYear, field) {
        const trimmed = accYear.trim();
        if (!(0, opening_balance_utils_1.isValidAccYear)(trimmed)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field,
                    message: `"${accYear}" is not an accounting year — expected YYYY-YYYY with the second half one greater than the first`,
                },
            ]);
        }
        return trimmed;
    }
};
exports.CarryForwardService = CarryForwardService;
exports.CarryForwardService = CarryForwardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        opening_balance_service_1.OpeningBalanceService,
        request_context_service_1.RequestContextService])
], CarryForwardService);
//# sourceMappingURL=carry-forward.service.js.map