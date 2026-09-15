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
exports.OpeningBalanceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const ledger_roles_1 = require("./ledger-roles");
const opening_balance_guards_1 = require("./opening-balance.guards");
const opening_balance_utils_1 = require("./opening-balance.utils");
const opening_balance_api_types_1 = require("./types/opening-balance-api.types");
const OPENING_ROW_SELECT = {
    opId: true,
    opLedgerId: true,
    opAmount: true,
    opDrCr: true,
    opSource: true,
    opIsStale: true,
    opStaleSince: true,
    opStaleReason: true,
    opRemarks: true,
};
let OpeningBalanceService = class OpeningBalanceService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async list(query) {
        const accYear = this.requireAccYear(query.accYear, 'accYear');
        const branchId = query.branchId ?? null;
        const includeZero = query.includeZero ?? true;
        const ledgers = await (0, opening_balance_guards_1.loadVisibleLedgers)(this.prisma, query.companyId);
        const [openings, priorOpenings, difference] = await Promise.all([
            this.prisma.accOpeningBalance.findMany({
                where: this.scopeWhere(query.companyId, branchId, accYear),
                select: OPENING_ROW_SELECT,
            }),
            this.closingByLedger(this.prisma, query.companyId, branchId, (0, opening_balance_utils_1.previousAccYear)(accYear)),
            (0, ledger_roles_1.resolveOpeningDifferenceLedger)(this.prisma, query.companyId, branchId),
        ]);
        const openingByLedger = new Map(openings.map((row) => [row.opLedgerId, row]));
        const billCounts = await (0, opening_balance_guards_1.countBillsByOpening)(this.prisma, accYear, openings.map((row) => row.opId));
        const rows = [];
        const unclassified = [];
        for (const ledger of ledgers.values()) {
            if (ledger.groupNature === null) {
                unclassified.push({
                    ledId: ledger.ledId,
                    ledName: ledger.ledName,
                    groupName: ledger.groupName,
                });
                continue;
            }
            if (!(0, opening_balance_guards_1.isBalanceSheetNature)(ledger.groupNature)) {
                continue;
            }
            const opening = openingByLedger.get(ledger.ledId) ?? null;
            const prior = priorOpenings.get(ledger.ledId) ?? null;
            if (includeZero === false && opening === null && prior === null) {
                continue;
            }
            rows.push(this.toRow(ledger, opening, prior, billCounts.get(opening?.opId ?? '') ?? 0));
        }
        return {
            opCompanyId: query.companyId,
            opBranchId: branchId,
            opAccYear: accYear,
            rows,
            unclassified,
            trialBalance: this.summarise(openings, ledgers, difference),
        };
    }
    async trialBalance(query) {
        const accYear = this.requireAccYear(query.accYear, 'accYear');
        const branchId = query.branchId ?? null;
        const [ledgers, openings, difference] = await Promise.all([
            (0, opening_balance_guards_1.loadVisibleLedgers)(this.prisma, query.companyId),
            this.prisma.accOpeningBalance.findMany({
                where: this.scopeWhere(query.companyId, branchId, accYear),
                select: OPENING_ROW_SELECT,
            }),
            (0, ledger_roles_1.resolveOpeningDifferenceLedger)(this.prisma, query.companyId, branchId),
        ]);
        return this.summarise(openings, ledgers, difference);
    }
    async save(dto) {
        const accYear = this.requireAccYear(dto.opAccYear, 'opAccYear');
        const branchId = dto.opBranchId ?? null;
        const replace = dto.replace ?? false;
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            await (0, opening_balance_guards_1.assertAccYearWritable)(tx, dto.opCompanyId, accYear, 'opAccYear');
            const ledgers = await (0, opening_balance_guards_1.loadVisibleLedgers)(tx, dto.opCompanyId);
            this.assertRowsAreWritable(dto.rows, ledgers);
            const stored = await tx.accOpeningBalance.findMany({
                where: this.scopeWhere(dto.opCompanyId, branchId, accYear),
                select: OPENING_ROW_SELECT,
            });
            const storedByLedger = new Map(stored.map((row) => [row.opLedgerId, row]));
            await this.assertBillWiseRowsOnlyEcho(tx, dto.rows, ledgers, storedByLedger, accYear);
            const now = new Date();
            const seen = new Set();
            const flippedToManual = [];
            let created = 0;
            let updated = 0;
            let skippedZero = 0;
            for (const [index, row] of dto.rows.entries()) {
                const existing = storedByLedger.get(row.opLedgerId) ?? null;
                const amount = (0, opening_balance_utils_1.money)(row.opAmount);
                if (amount.isZero()) {
                    skippedZero += 1;
                    if (existing) {
                        await tx.accOpeningBalance.update({
                            where: { opId_opAccYear: { opId: existing.opId, opAccYear: accYear } },
                            data: { opIsDeleted: true, opModifiedAt: now, opModifiedBy: actor },
                        });
                    }
                    continue;
                }
                seen.add(row.opLedgerId);
                const source = this.resolveSource(existing, row, amount, flippedToManual);
                if (existing) {
                    await tx.accOpeningBalance.update({
                        where: { opId_opAccYear: { opId: existing.opId, opAccYear: accYear } },
                        data: {
                            opAmount: amount,
                            opDrCr: row.opDrCr,
                            opSource: source,
                            opRemarks: (0, module_service_utils_1.normalizeNullableString)(row.opRemarks),
                            opTenantId: dto.opTenantId ?? undefined,
                            opModifiedAt: now,
                            opModifiedBy: actor,
                        },
                    });
                    updated += 1;
                    continue;
                }
                await this.createOpening(tx, {
                    companyId: dto.opCompanyId,
                    branchId,
                    accYear,
                    tenantId: dto.opTenantId ?? null,
                    ledgerId: row.opLedgerId,
                    amount,
                    drCr: row.opDrCr,
                    source,
                    remarks: (0, module_service_utils_1.normalizeNullableString)(row.opRemarks) ?? null,
                    actor,
                    now,
                });
                created += 1;
            }
            const { deleted, retainedWithBills } = replace
                ? await this.deleteAbsentRows(tx, stored, seen, ledgers, accYear, actor, now)
                : { deleted: 0, retainedWithBills: [] };
            const wroteSomething = created > 0 || updated > 0 || deleted > 0;
            const staledAccYears = wroteSomething
                ? await (0, opening_balance_guards_1.staleLaterYears)(tx, {
                    companyId: dto.opCompanyId,
                    branchId,
                    accYear,
                    reason: opening_balance_api_types_1.OpeningStaleReason.SOURCE_OPENING_EDITED,
                    refId: null,
                })
                : [];
            const [after, difference] = await Promise.all([
                tx.accOpeningBalance.findMany({
                    where: this.scopeWhere(dto.opCompanyId, branchId, accYear),
                    select: OPENING_ROW_SELECT,
                }),
                (0, ledger_roles_1.resolveOpeningDifferenceLedger)(tx, dto.opCompanyId, branchId),
            ]);
            return {
                opCompanyId: dto.opCompanyId,
                opBranchId: branchId,
                opAccYear: accYear,
                created,
                updated,
                skippedZero,
                deleted,
                retainedWithBills,
                flippedToManual,
                trialBalance: this.summarise(after, ledgers, difference),
                staledAccYears,
            };
        });
    }
    async softDelete(opId, accYear) {
        const year = this.requireAccYear(accYear, 'accYear');
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accOpeningBalance.findFirst({
                where: { opId, opAccYear: year, opIsDeleted: false },
                select: { opId: true, opCompanyId: true, opBranchId: true, opLedgerId: true },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Opening balance not found', 'opId', `No live opening balance ${opId} in ${year}`);
            }
            await (0, opening_balance_guards_1.assertAccYearWritable)(tx, existing.opCompanyId, year, 'accYear');
            const billCounts = await (0, opening_balance_guards_1.countBillsByOpening)(tx, year, [existing.opId]);
            const billCount = billCounts.get(existing.opId) ?? 0;
            if (billCount > 0) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: 'opId',
                        message: `This opening still has ${billCount} opening bill(s). Delete the bills first.`,
                    },
                ]);
            }
            await tx.accOpeningBalance.update({
                where: { opId_opAccYear: { opId: existing.opId, opAccYear: year } },
                data: {
                    opIsDeleted: true,
                    opModifiedAt: new Date(),
                    opModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            await (0, opening_balance_guards_1.staleLaterYears)(tx, {
                companyId: existing.opCompanyId,
                branchId: existing.opBranchId,
                accYear: year,
                reason: opening_balance_api_types_1.OpeningStaleReason.SOURCE_OPENING_EDITED,
                refId: null,
            });
            return { opId: existing.opId, opAccYear: year, deleted: true };
        });
    }
    async closingByLedger(client, companyId, branchId, accYear) {
        if (!(0, opening_balance_utils_1.isValidAccYear)(accYear)) {
            return new Map();
        }
        const [openings, movements] = await Promise.all([
            client.accOpeningBalance.findMany({
                where: this.scopeWhere(companyId, branchId, accYear),
                select: { opLedgerId: true, opAmount: true, opDrCr: true },
            }),
            client.$queryRaw `
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
      `,
        ]);
        const signedByLedger = new Map();
        for (const opening of openings) {
            signedByLedger.set(opening.opLedgerId, (0, opening_balance_utils_1.signedOpening)(opening.opAmount, opening.opDrCr));
        }
        for (const movement of movements) {
            const current = signedByLedger.get(movement.led_id) ?? opening_balance_utils_1.ZERO;
            signedByLedger.set(movement.led_id, current.plus(movement.signed ?? opening_balance_utils_1.ZERO));
        }
        const closings = new Map();
        for (const [ledgerId, signed] of signedByLedger) {
            const rounded = (0, opening_balance_utils_1.money)(signed);
            if (rounded.isZero()) {
                continue;
            }
            closings.set(ledgerId, (0, opening_balance_utils_1.splitSigned)(rounded));
        }
        return closings;
    }
    scopeWhere(companyId, branchId, accYear) {
        return {
            opCompanyId: companyId,
            opAccYear: accYear,
            opBranchId: branchId === null ? { equals: null } : branchId,
            opIsDeleted: false,
        };
    }
    toRow(ledger, opening, prior, billCount) {
        return {
            opId: opening?.opId ?? null,
            ledId: ledger.ledId,
            ledName: ledger.ledName,
            groupName: ledger.groupName,
            groupNature: ledger.groupNature,
            ledIsBillByBill: ledger.ledIsBillByBill,
            opAmount: (0, opening_balance_utils_1.toAmount)(opening?.opAmount),
            opDrCr: opening?.opDrCr ?? null,
            opSource: opening?.opSource ?? null,
            opIsStale: opening?.opIsStale ?? false,
            opStaleSince: (0, opening_balance_utils_1.toIsoString)(opening?.opStaleSince),
            opStaleReason: opening?.opStaleReason ?? null,
            opRemarks: opening?.opRemarks ?? null,
            priorClosingAmount: (0, opening_balance_utils_1.toNullableAmount)(prior?.amount ?? null),
            priorClosingDrCr: prior?.drCr ?? null,
            billCount,
        };
    }
    summarise(openings, ledgers, difference) {
        let totalDebit = opening_balance_utils_1.ZERO;
        let totalCredit = opening_balance_utils_1.ZERO;
        let unmappedCount = 0;
        for (const opening of openings) {
            const ledger = ledgers.get(opening.opLedgerId);
            if (!ledger || ledger.groupNature === null) {
                unmappedCount += 1;
                continue;
            }
            if (opening.opDrCr === opening_balance_api_types_1.OpeningDrCr.DEBIT) {
                totalDebit = totalDebit.plus(opening.opAmount);
            }
            else {
                totalCredit = totalCredit.plus(opening.opAmount);
            }
        }
        const debit = (0, opening_balance_utils_1.money)(totalDebit);
        const credit = (0, opening_balance_utils_1.money)(totalCredit);
        const diff = (0, opening_balance_utils_1.money)(debit.minus(credit));
        return {
            totalDebit: (0, opening_balance_utils_1.toAmount)(debit),
            totalCredit: (0, opening_balance_utils_1.toAmount)(credit),
            difference: (0, opening_balance_utils_1.toAmount)(diff),
            isBalanced: diff.isZero(),
            unmappedCount,
            differenceLedgerId: difference?.ledgerId ?? null,
            differenceLedgerName: difference?.ledgerName ?? null,
        };
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
    assertRowsAreWritable(rows, ledgers) {
        const errors = [];
        const seenLedgers = new Map();
        for (const [index, row] of rows.entries()) {
            const ledger = ledgers.get(row.opLedgerId);
            if (!ledger) {
                errors.push({
                    field: `rows.${index}.opLedgerId`,
                    message: `Ledger ${row.opLedgerId} does not exist or does not belong to this company`,
                });
                continue;
            }
            const firstIndex = seenLedgers.get(row.opLedgerId);
            if (firstIndex !== undefined) {
                errors.push({
                    field: `rows.${index}.opLedgerId`,
                    message: `"${ledger.ledName}" appears twice in this set (rows ${firstIndex} and ${index}) — one opening per ledger per year`,
                });
                continue;
            }
            seenLedgers.set(row.opLedgerId, index);
            if (row.opAmount < 0) {
                errors.push({
                    field: `rows.${index}.opAmount`,
                    message: `Opening amount cannot be negative for "${ledger.ledName}" — send a positive amount and put the side in opDrCr`,
                });
            }
            if (row.opAmount === 0) {
                continue;
            }
            if (ledger.groupNature === null) {
                errors.push({
                    field: `rows.${index}.opLedgerId`,
                    message: `"${ledger.ledName}" is under a group with no nature — classify the group before opening it`,
                });
                continue;
            }
            if (!(0, opening_balance_guards_1.isBalanceSheetNature)(ledger.groupNature)) {
                errors.push({
                    field: `rows.${index}.opLedgerId`,
                    message: `"${ledger.ledName}" is ${ledger.groupNature} — only Assets and Liabilities ledgers carry an opening balance`,
                });
            }
        }
        if (errors.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', errors);
        }
    }
    async assertBillWiseRowsOnlyEcho(client, rows, ledgers, storedByLedger, accYear) {
        const billWise = rows
            .map((row, index) => ({ row, index, ledger: ledgers.get(row.opLedgerId) }))
            .filter((entry) => entry.ledger?.ledIsBillByBill === true);
        if (billWise.length === 0) {
            return;
        }
        const opIds = billWise
            .map((entry) => storedByLedger.get(entry.row.opLedgerId)?.opId)
            .filter((opId) => typeof opId === 'string');
        const totals = await this.billTotalsByOpening(client, accYear, opIds);
        const errors = [];
        for (const entry of billWise) {
            const stored = storedByLedger.get(entry.row.opLedgerId);
            const total = stored ? (totals.get(stored.opId) ?? opening_balance_utils_1.ZERO) : opening_balance_utils_1.ZERO;
            if (total.isZero()) {
                errors.push({
                    field: `rows.${entry.index}.opAmount`,
                    message: `"${entry.ledger.ledName}" is a bill-by-bill party — enter its opening as bills in the breakup panel, not as a figure`,
                });
                continue;
            }
            const sent = (0, opening_balance_utils_1.signedOpening)((0, opening_balance_utils_1.money)(entry.row.opAmount), entry.row.opDrCr);
            if (!sent.equals((0, opening_balance_utils_1.money)(total))) {
                const expected = (0, opening_balance_utils_1.splitSigned)((0, opening_balance_utils_1.money)(total));
                errors.push({
                    field: `rows.${entry.index}.opAmount`,
                    message: `"${entry.ledger.ledName}" is bill-by-bill: its opening is the total of its bills, ${expected.amount.toFixed(2)} ${expected.drCr}. Change the bills, not this figure.`,
                });
            }
        }
        if (errors.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', errors);
        }
    }
    async billTotalsByOpening(client, accYear, opIds) {
        if (opIds.length === 0) {
            return new Map();
        }
        const bills = await client.accBillBalance.findMany({
            where: {
                ablSrcDocType: 'OPENING_BALANCE',
                ablSrcDocId: { in: [...opIds] },
                ablAccYear: accYear,
                ablIsDeleted: false,
            },
            select: { ablSrcDocId: true, ablBillAmount: true, ablDrCr: true },
        });
        const totals = new Map();
        for (const bill of bills) {
            if (!bill.ablSrcDocId) {
                continue;
            }
            const current = totals.get(bill.ablSrcDocId) ?? opening_balance_utils_1.ZERO;
            const signed = bill.ablDrCr === 'DR' ? bill.ablBillAmount : bill.ablBillAmount.negated();
            totals.set(bill.ablSrcDocId, current.plus(signed));
        }
        return totals;
    }
    resolveSource(existing, row, amount, flippedToManual) {
        if (!existing) {
            return row.opSource ?? opening_balance_api_types_1.OpeningSource.MANUAL;
        }
        if (existing.opSource !== opening_balance_api_types_1.OpeningSource.CARRY_FORWARD) {
            return existing.opSource;
        }
        const figureChanged = !(0, opening_balance_utils_1.money)(existing.opAmount).equals(amount) || existing.opDrCr !== row.opDrCr;
        if (figureChanged) {
            flippedToManual.push(existing.opId);
            return opening_balance_api_types_1.OpeningSource.MANUAL;
        }
        return opening_balance_api_types_1.OpeningSource.CARRY_FORWARD;
    }
    async deleteAbsentRows(client, stored, seen, ledgers, accYear, actor, now) {
        const absent = stored.filter((row) => !seen.has(row.opLedgerId));
        if (absent.length === 0) {
            return { deleted: 0, retainedWithBills: [] };
        }
        const billCounts = await (0, opening_balance_guards_1.countBillsByOpening)(client, accYear, absent.map((row) => row.opId));
        const retainedWithBills = [];
        const deletable = [];
        for (const row of absent) {
            const billCount = billCounts.get(row.opId) ?? 0;
            if (billCount > 0) {
                retainedWithBills.push({
                    opId: row.opId,
                    ledId: row.opLedgerId,
                    ledName: ledgers.get(row.opLedgerId)?.ledName ?? row.opLedgerId,
                    billCount,
                });
                continue;
            }
            deletable.push(row.opId);
        }
        if (deletable.length > 0) {
            await client.accOpeningBalance.updateMany({
                where: { opId: { in: deletable }, opAccYear: accYear },
                data: { opIsDeleted: true, opModifiedAt: now, opModifiedBy: actor },
            });
        }
        return { deleted: deletable.length, retainedWithBills };
    }
    async createOpening(client, params) {
        try {
            const created = await client.accOpeningBalance.create({
                data: {
                    opCompanyId: params.companyId,
                    opBranchId: params.branchId,
                    opAccYear: params.accYear,
                    opTenantId: params.tenantId,
                    opLedgerId: params.ledgerId,
                    opAmount: params.amount,
                    opDrCr: params.drCr,
                    opSource: params.source,
                    opRemarks: params.remarks,
                    opCreatedAt: params.now,
                    opCreatedBy: params.actor,
                },
                select: { opId: true },
            });
            return created.opId;
        }
        catch (error) {
            if ((0, module_service_utils_1.isForeignKeyConstraintError)(error)) {
                const message = String(error.meta?.constraint ?? '');
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    message.includes('branch')
                        ? { field: 'opBranchId', message: 'Branch not found' }
                        : message.includes('company')
                            ? { field: 'opCompanyId', message: 'Company not found' }
                            : { field: 'opLedgerId', message: 'Ledger no longer exists' },
                ]);
            }
            throw error;
        }
    }
};
exports.OpeningBalanceService = OpeningBalanceService;
exports.OpeningBalanceService = OpeningBalanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], OpeningBalanceService);
//# sourceMappingURL=opening-balance.service.js.map