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
exports.BillWiseService = void 0;
const common_1 = require("@nestjs/common");
const books_reconcile_guard_1 = require("../reconcile/books-reconcile.guard");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const opening_balance_guards_1 = require("./opening-balance.guards");
const opening_balance_utils_1 = require("./opening-balance.utils");
const opening_balance_api_types_1 = require("./types/opening-balance-api.types");
const BILL_SELECT = {
    ablId: true,
    ablDocRefno: true,
    ablDocDate: true,
    ablDueDate: true,
    ablCreditDays: true,
    ablGraceDays: true,
    ablDrCr: true,
    ablBillAmount: true,
    ablAllocAmount: true,
    ablDiscAmount: true,
    ablWriteoffAmount: true,
    ablPendingAmount: true,
    ablStatus: true,
    ablNarration: true,
};
let BillWiseService = class BillWiseService {
    prisma;
    requestContextService;
    constructor(prisma, requestContextService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
    }
    async list(query) {
        const accYear = this.requireAccYear(query.accYear);
        const party = await this.requireParty(this.prisma, query.companyId, query.partyId);
        const opening = await this.findOpening(this.prisma, query.companyId, query.branchId, accYear, query.partyId);
        const bills = opening
            ? await this.prisma.accBillBalance.findMany({
                where: this.billScope(opening.opId, accYear),
                select: BILL_SELECT,
                orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
            })
            : [];
        return this.toPayload(query, party.ledName, opening, bills);
    }
    async save(dto) {
        const accYear = this.requireAccYear(dto.accYear);
        const replace = dto.replace ?? false;
        const actor = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
        return this.prisma.$transaction(async (tx) => {
            await (0, opening_balance_guards_1.assertAccYearWritable)(tx, dto.companyId, accYear, 'accYear');
            const party = await this.requireParty(tx, dto.companyId, dto.partyId);
            if (!party.ledIsBillByBill) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: 'partyId',
                        message: `"${party.ledName}" is not a bill-by-bill ledger — open it with a figure on the opening balances screen instead`,
                    },
                ]);
            }
            const opening = await this.resolveOpening(tx, dto, accYear, actor);
            const stored = await tx.accBillBalance.findMany({
                where: this.billScope(opening.opId, accYear),
                select: BILL_SELECT,
            });
            const storedById = new Map(stored.map((bill) => [bill.ablId, bill]));
            this.assertBillsAreWritable(dto.bills, storedById);
            const now = new Date();
            const seen = new Set();
            let created = 0;
            let updated = 0;
            let frozenUnchanged = 0;
            for (const [index, row] of dto.bills.entries()) {
                const existing = row.ablId ? (storedById.get(row.ablId) ?? null) : null;
                if (existing && (0, opening_balance_utils_1.isBillFrozen)(existing)) {
                    await tx.accBillBalance.update({
                        where: { ablId_ablAccYear: { ablId: existing.ablId, ablAccYear: accYear } },
                        data: {
                            ablDueDate: row.ablDueDate === undefined ? undefined : this.toNullableDate(row.ablDueDate),
                            ablCreditDays: row.ablCreditDays ?? undefined,
                            ablGraceDays: row.ablGraceDays ?? undefined,
                            ablNarration: (0, module_service_utils_1.normalizeNullableString)(row.ablNarration),
                            ablModifiedOn: now,
                            ablModifiedBy: actor,
                        },
                    });
                    seen.add(existing.ablId);
                    frozenUnchanged += 1;
                    continue;
                }
                if (existing) {
                    await tx.accBillBalance.update({
                        where: { ablId_ablAccYear: { ablId: existing.ablId, ablAccYear: accYear } },
                        data: {
                            ablDocRefno: row.ablDocRefno.trim(),
                            ablDocDate: (0, opening_balance_utils_1.toDateOnly)(row.ablDocDate),
                            ablDueDate: this.toNullableDate(row.ablDueDate),
                            ablCreditDays: row.ablCreditDays ?? 0,
                            ablGraceDays: row.ablGraceDays ?? 0,
                            ablDrCr: row.ablDrCr,
                            ablBillAmount: (0, opening_balance_utils_1.money)(row.ablBillAmount),
                            ablNarration: (0, module_service_utils_1.normalizeNullableString)(row.ablNarration),
                            ablModifiedOn: now,
                            ablModifiedBy: actor,
                        },
                    });
                    seen.add(existing.ablId);
                    updated += 1;
                    continue;
                }
                const inserted = await this.insertBill(tx, index, {
                    data: {
                        ablCompanyId: dto.companyId,
                        ablBranchId: dto.branchId,
                        ablTenantId: dto.tenantId ?? null,
                        ablAccYear: accYear,
                        ablPartyId: dto.partyId,
                        ablBillType: opening_balance_api_types_1.OPENING_BILL_TYPE,
                        ablVoucherId: null,
                        ablVoucherTypeId: null,
                        ablSrcModule: opening_balance_api_types_1.OPENING_SRC_MODULE,
                        ablSrcDocType: opening_balance_api_types_1.OPENING_SRC_DOC_TYPE,
                        ablSrcDocId: opening.opId,
                        ablSrcAccYear: accYear,
                        ablParentBillId: null,
                        ablParentAccYear: null,
                        ablDocRefno: row.ablDocRefno.trim(),
                        ablDocDate: (0, opening_balance_utils_1.toDateOnly)(row.ablDocDate),
                        ablDueDate: this.toNullableDate(row.ablDueDate),
                        ablCreditDays: row.ablCreditDays ?? 0,
                        ablGraceDays: row.ablGraceDays ?? 0,
                        ablDrCr: row.ablDrCr,
                        ablBillAmount: (0, opening_balance_utils_1.money)(row.ablBillAmount),
                        ablNarration: (0, module_service_utils_1.normalizeNullableString)(row.ablNarration) ?? null,
                        ablCreatedOn: now,
                        ablCreatedBy: actor,
                    },
                    select: { ablId: true },
                });
                seen.add(inserted.ablId);
                created += 1;
            }
            const deleted = replace
                ? await this.deleteAbsentBills(tx, stored, seen, accYear, actor, now)
                : 0;
            const after = await tx.accBillBalance.findMany({
                where: this.billScope(opening.opId, accYear),
                select: BILL_SELECT,
                orderBy: [{ ablDocDate: 'asc' }, { ablDocRefno: 'asc' }],
            });
            await this.syncOpeningFromBills(tx, opening.opId, accYear, after, actor, now);
            const staledAccYears = await (0, opening_balance_guards_1.staleLaterYears)(tx, {
                companyId: dto.companyId,
                branchId: dto.branchId,
                accYear,
                reason: opening_balance_api_types_1.OpeningStaleReason.SOURCE_OPENING_EDITED,
                refId: opening.opId,
            });
            await (0, books_reconcile_guard_1.assertBooksReconcile)(tx, {
                companyId: dto.companyId,
                accYear,
                ledgerIds: [dto.partyId],
            });
            const refreshed = await tx.accOpeningBalance.findFirst({
                where: { opId: opening.opId, opAccYear: accYear },
                select: { opId: true, opAmount: true, opDrCr: true, opIsDeleted: true },
            });
            return {
                ...this.toPayload({ ...dto, accYear }, party.ledName, refreshed && !refreshed.opIsDeleted ? refreshed : null, after),
                created,
                updated,
                deleted,
                frozenUnchanged,
                staledAccYears,
            };
        });
    }
    async syncOpeningFromBills(client, opId, accYear, bills, actor, now) {
        let signed = opening_balance_utils_1.ZERO;
        for (const bill of bills) {
            signed = signed.plus((0, opening_balance_utils_1.signedBill)(bill.ablBillAmount, bill.ablDrCr));
        }
        const total = (0, opening_balance_utils_1.money)(signed);
        if (total.isZero()) {
            await client.accOpeningBalance.update({
                where: { opId_opAccYear: { opId, opAccYear: accYear } },
                data: { opIsDeleted: true, opModifiedAt: now, opModifiedBy: actor },
            });
            return;
        }
        const split = (0, opening_balance_utils_1.splitSigned)(total);
        await client.accOpeningBalance.update({
            where: { opId_opAccYear: { opId, opAccYear: accYear } },
            data: {
                opAmount: split.amount,
                opDrCr: split.drCr,
                opIsDeleted: false,
                opModifiedAt: now,
                opModifiedBy: actor,
            },
        });
    }
    async resolveOpening(client, dto, accYear, actor) {
        if (dto.opId) {
            const named = await client.accOpeningBalance.findFirst({
                where: { opId: dto.opId, opAccYear: accYear, opIsDeleted: false },
                select: { opId: true, opCompanyId: true, opBranchId: true, opLedgerId: true },
            });
            if (!named ||
                named.opCompanyId !== dto.companyId ||
                named.opLedgerId !== dto.partyId ||
                named.opBranchId !== dto.branchId) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: 'opId',
                        message: `opId ${dto.opId} is not this party's opening for ${accYear} at this branch`,
                    },
                ]);
            }
            return { opId: named.opId };
        }
        const existing = await this.findOpening(client, dto.companyId, dto.branchId, accYear, dto.partyId);
        if (existing) {
            return { opId: existing.opId };
        }
        const created = await client.accOpeningBalance.create({
            data: {
                opCompanyId: dto.companyId,
                opBranchId: dto.branchId,
                opAccYear: accYear,
                opTenantId: dto.tenantId ?? null,
                opLedgerId: dto.partyId,
                opAmount: new client_1.Prisma.Decimal(0),
                opDrCr: opening_balance_api_types_1.OpeningDrCr.DEBIT,
                opSource: opening_balance_api_types_1.OpeningSource.MANUAL,
                opCreatedAt: new Date(),
                opCreatedBy: actor,
            },
            select: { opId: true },
        });
        return { opId: created.opId };
    }
    findOpening(client, companyId, branchId, accYear, partyId) {
        return client.accOpeningBalance.findFirst({
            where: {
                opCompanyId: companyId,
                opBranchId: branchId,
                opAccYear: accYear,
                opLedgerId: partyId,
                opIsDeleted: false,
            },
            select: { opId: true, opAmount: true, opDrCr: true },
        });
    }
    billScope(opId, accYear) {
        return {
            ablSrcDocType: opening_balance_api_types_1.OPENING_SRC_DOC_TYPE,
            ablSrcDocId: opId,
            ablAccYear: accYear,
            ablIsDeleted: false,
        };
    }
    assertBillsAreWritable(rows, storedById) {
        const errors = [];
        const seenRefnos = new Map();
        for (const [index, row] of rows.entries()) {
            const refno = row.ablDocRefno.trim();
            if (refno.length === 0) {
                errors.push({
                    field: `bills.${index}.ablDocRefno`,
                    message: 'A bill reference is required — it is the original invoice number',
                });
            }
            const firstIndex = seenRefnos.get(refno.toUpperCase());
            if (firstIndex !== undefined) {
                errors.push({
                    field: `bills.${index}.ablDocRefno`,
                    message: `"${refno}" appears twice in this breakup (rows ${firstIndex} and ${index}) — one bill per reference per year`,
                });
            }
            else {
                seenRefnos.set(refno.toUpperCase(), index);
            }
            if (!(row.ablBillAmount > 0)) {
                errors.push({
                    field: `bills.${index}.ablBillAmount`,
                    message: 'A bill amount must be greater than zero — put the side in ablDrCr',
                });
            }
            if (row.ablDueDate && row.ablDueDate < row.ablDocDate) {
                errors.push({
                    field: `bills.${index}.ablDueDate`,
                    message: `Due date ${row.ablDueDate} is before the bill date ${row.ablDocDate}`,
                });
            }
            if (!row.ablId) {
                continue;
            }
            const existing = storedById.get(row.ablId);
            if (!existing) {
                errors.push({
                    field: `bills.${index}.ablId`,
                    message: `Bill ${row.ablId} is not an opening bill of this party for this year`,
                });
                continue;
            }
            if (!(0, opening_balance_utils_1.isBillFrozen)(existing)) {
                continue;
            }
            const settled = (0, opening_balance_utils_1.settledTotal)(existing);
            const amountChanged = !(0, opening_balance_utils_1.money)(row.ablBillAmount).equals((0, opening_balance_utils_1.money)(existing.ablBillAmount));
            const sideChanged = row.ablDrCr !== existing.ablDrCr;
            const refnoChanged = refno !== existing.ablDocRefno;
            const dateChanged = row.ablDocDate !== (0, opening_balance_utils_1.toDateString)(existing.ablDocDate);
            if (amountChanged || sideChanged || refnoChanged || dateChanged) {
                errors.push({
                    field: `bills.${index}.ablBillAmount`,
                    message: `"${existing.ablDocRefno}" has ${settled.toFixed(2)} settled against it, so its amount, side, ` +
                        'reference and date are fixed. Either add a correcting opening bill for the difference, ' +
                        'or reverse the allocation in the receipt screen first and then edit this one.',
                });
            }
        }
        if (errors.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', errors);
        }
    }
    async insertBill(client, index, args) {
        try {
            return await client.accBillBalance.create(args);
        }
        catch (error) {
            if ((0, module_service_utils_1.isUniqueConstraintError)(error)) {
                (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                    {
                        field: `bills.${index}.ablDocRefno`,
                        message: `"${args.data.ablDocRefno}" is already an opening bill of this party for this year. ` +
                            'Send its ablId to update it, or use a different reference.',
                    },
                ]);
            }
            throw error;
        }
    }
    async deleteAbsentBills(client, stored, seen, accYear, actor, now) {
        const absent = stored.filter((bill) => !seen.has(bill.ablId));
        const frozen = absent.filter((bill) => (0, opening_balance_utils_1.isBillFrozen)(bill));
        if (frozen.length > 0) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', frozen.map((bill) => ({
                field: 'bills',
                message: `"${bill.ablDocRefno}" has ${(0, opening_balance_utils_1.settledTotal)(bill).toFixed(2)} settled against it and cannot be ` +
                    'removed from the breakup. Reverse the allocation in the receipt screen first.',
            })));
        }
        const deletable = absent.map((bill) => bill.ablId);
        if (deletable.length === 0) {
            return 0;
        }
        await client.accBillBalance.updateMany({
            where: { ablId: { in: deletable }, ablAccYear: accYear },
            data: { ablIsDeleted: true, ablModifiedOn: now, ablModifiedBy: actor },
        });
        return deletable.length;
    }
    async requireParty(client, companyId, partyId) {
        const ledgers = await (0, opening_balance_guards_1.loadVisibleLedgers)(client, companyId);
        const party = ledgers.get(partyId);
        if (!party) {
            (0, module_service_utils_1.throwAccountsNotFound)('Party not found', 'partyId', `Ledger ${partyId} does not exist or does not belong to this company`);
        }
        return { ledName: party.ledName, ledIsBillByBill: party.ledIsBillByBill };
    }
    toPayload(scope, partyName, opening, bills) {
        let signed = opening_balance_utils_1.ZERO;
        for (const bill of bills) {
            signed = signed.plus((0, opening_balance_utils_1.signedBill)(bill.ablBillAmount, bill.ablDrCr));
        }
        const billTotal = (0, opening_balance_utils_1.money)(signed);
        const billSplit = billTotal.isZero() ? null : (0, opening_balance_utils_1.splitSigned)(billTotal);
        const openingSigned = opening ? (0, opening_balance_utils_1.money)((0, opening_balance_utils_1.signedOpening)(opening.opAmount, opening.opDrCr)) : opening_balance_utils_1.ZERO;
        return {
            companyId: scope.companyId,
            branchId: scope.branchId,
            accYear: scope.accYear,
            partyId: scope.partyId,
            partyName,
            opId: opening?.opId ?? null,
            bills: bills.map((bill) => this.toBillRow(bill)),
            billTotalAmount: (0, opening_balance_utils_1.toAmount)(billSplit?.amount ?? opening_balance_utils_1.ZERO),
            billTotalDrCr: billSplit?.drCr ?? null,
            openingAmount: (0, opening_balance_utils_1.toAmount)(opening?.opAmount ?? opening_balance_utils_1.ZERO),
            openingDrCr: opening?.opDrCr ?? null,
            isTied: billTotal.equals(openingSigned),
        };
    }
    toBillRow(bill) {
        return {
            ablId: bill.ablId,
            ablDocRefno: bill.ablDocRefno,
            ablDocDate: (0, opening_balance_utils_1.toDateString)(bill.ablDocDate) ?? '',
            ablDueDate: (0, opening_balance_utils_1.toDateString)(bill.ablDueDate),
            ablCreditDays: bill.ablCreditDays,
            ablGraceDays: bill.ablGraceDays,
            ablDrCr: bill.ablDrCr,
            ablBillAmount: (0, opening_balance_utils_1.toAmount)(bill.ablBillAmount),
            ablAllocAmount: (0, opening_balance_utils_1.toAmount)(bill.ablAllocAmount),
            ablDiscAmount: (0, opening_balance_utils_1.toAmount)(bill.ablDiscAmount),
            ablWriteoffAmount: (0, opening_balance_utils_1.toAmount)(bill.ablWriteoffAmount),
            ablPendingAmount: (0, opening_balance_utils_1.toAmount)(bill.ablPendingAmount),
            ablStatus: bill.ablStatus,
            ablNarration: bill.ablNarration,
            isFrozen: (0, opening_balance_utils_1.isBillFrozen)(bill),
        };
    }
    toNullableDate(value) {
        return value ? (0, opening_balance_utils_1.toDateOnly)(value) : null;
    }
    requireAccYear(accYear) {
        const trimmed = accYear.trim();
        if (!(0, opening_balance_utils_1.isValidAccYear)(trimmed)) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Validation failed', [
                {
                    field: 'accYear',
                    message: `"${accYear}" is not an accounting year — expected YYYY-YYYY with the second half one greater than the first`,
                },
            ]);
        }
        return trimmed;
    }
};
exports.BillWiseService = BillWiseService;
exports.BillWiseService = BillWiseService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], BillWiseService);
//# sourceMappingURL=bill-wise.service.js.map