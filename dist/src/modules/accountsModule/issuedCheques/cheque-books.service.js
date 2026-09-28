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
exports.ChequeBooksService = exports.CHEQUE_BOOKS_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const rights_1 = require("../../../common/posting/rights");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const cheque_book_helper_1 = require("../vouchers/cheque-book.helper");
const voucher_facts_1 = require("../vouchers/voucher-facts");
const vouchers_errors_1 = require("../vouchers/vouchers.errors");
exports.CHEQUE_BOOKS_MENU_ID = 263;
let ChequeBooksService = class ChequeBooksService {
    prisma;
    requestContext;
    constructor(prisma, requestContext) {
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    caller() {
        const userId = this.requestContext.getUserId() ?? null;
        return { userId, actor: userId ?? module_service_utils_1.DEFAULT_ACTOR };
    }
    async require(tx, right, code) {
        const { userId } = this.caller();
        const r = userId ? await (0, rights_1.loadRights)(tx, userId, exports.CHEQUE_BOOKS_MENU_ID) : null;
        if (!r?.[right]) {
            (0, vouchers_errors_1.throwRight)(`This user may not ${right} cheque books (menu ${exports.CHEQUE_BOOKS_MENU_ID}, Cheque Books)`, code);
        }
    }
    async get(q) {
        const tx = this.prisma;
        await this.require(tx, 'view', vouchers_errors_1.VCH.RIGHT_VIEW);
        return this.load(tx, q.companyId, q.chequeBookId);
    }
    async save(dto) {
        const { actor } = this.caller();
        return this.prisma.$transaction(async (tx) => {
            await this.require(tx, dto.chequeBookId ? 'edit' : 'create', dto.chequeBookId ? vouchers_errors_1.VCH.RIGHT_EDIT : vouchers_errors_1.VCH.RIGHT_CREATE);
            if (dto.leafTo < dto.leafFrom) {
                (0, vouchers_errors_1.throwInvalid)('The last leaf is before the first', vouchers_errors_1.VCH.BOOK_INVALID, 'leafTo');
            }
            const width = dto.leafWidth ?? 6;
            if (String(dto.leafTo).length > width) {
                (0, vouchers_errors_1.throwInvalid)(`Leaf ${dto.leafTo} has more than ${width} digits — widen leafWidth`, vouchers_errors_1.VCH.BOOK_INVALID, 'leafWidth');
            }
            const bank = (await (0, voucher_facts_1.loadLedgerFacts)(tx, dto.companyId, [dto.bankLedgerId])).get(dto.bankLedgerId);
            if (!bank || !(0, voucher_facts_1.isBankLedger)(bank) || bank.isDeleted || !bank.isActive) {
                (0, vouchers_errors_1.throwInvalid)(`${bank?.name ?? 'That ledger'} is not a live bank account (Bank Accounts / Bank OD)`, vouchers_errors_1.VCH.BANK_REQUIRED, 'bankLedgerId');
            }
            let existing = null;
            if (dto.chequeBookId) {
                await tx.$queryRaw `SELECT 1 FROM accounts.acc_cheque_book WHERE acb_id = ${dto.chequeBookId}::uuid FOR UPDATE`;
                existing = await (0, cheque_book_helper_1.loadChequeBook)(tx, dto.chequeBookId);
                if (!existing || existing.isDeleted || existing.companyId !== dto.companyId) {
                    (0, vouchers_errors_1.throwMissing)(`No cheque book ${dto.chequeBookId} for this company`, vouchers_errors_1.VCH.BOOK_NOT_FOUND, 'chequeBookId');
                }
                if (existing.status === 'CLOSED') {
                    (0, vouchers_errors_1.throwState)(`Book ${existing.bookNo} is closed`, vouchers_errors_1.VCH.BOOK_FINISHED, 'chequeBookId');
                }
                const used = existing.nextLeaf > existing.leafFrom;
                if (used &&
                    (existing.bankLedgerId !== dto.bankLedgerId || existing.leafFrom !== dto.leafFrom)) {
                    (0, vouchers_errors_1.throwState)(`Book ${existing.bookNo} has handed out leaves already — its bank and first leaf are on paper`, vouchers_errors_1.VCH.BOOK_INVALID, existing.bankLedgerId !== dto.bankLedgerId ? 'bankLedgerId' : 'leafFrom');
                }
                if (dto.leafTo < existing.nextLeaf - 1) {
                    (0, vouchers_errors_1.throwState)(`Leaves up to ${(0, cheque_book_helper_1.formatLeaf)(existing.nextLeaf - 1, existing.leafWidth)} are already used — the last leaf cannot be below that`, vouchers_errors_1.VCH.BOOK_INVALID, 'leafTo');
                }
            }
            const [overlap] = await tx.$queryRaw `
        SELECT acb_book_no FROM accounts.acc_cheque_book
         WHERE acb_company_id = ${dto.companyId}::uuid
           AND acb_bank_ledger_id = ${dto.bankLedgerId}::uuid
           AND acb_is_deleted = false AND acb_status <> 'CLOSED'
           AND (${dto.chequeBookId ?? null}::uuid IS NULL OR acb_id <> ${dto.chequeBookId ?? null}::uuid)
           AND acb_leaf_from <= ${dto.leafTo}::bigint AND acb_leaf_to >= ${dto.leafFrom}::bigint
         LIMIT 1`;
            if (overlap) {
                (0, vouchers_errors_1.throwState)(`Leaves ${dto.leafFrom}–${dto.leafTo} overlap book ${overlap.acb_book_no} on ${bank.name}`, vouchers_errors_1.VCH.BOOK_OVERLAP, 'leafFrom');
            }
            let id = dto.chequeBookId ?? null;
            try {
                if (!existing) {
                    const [row] = await tx.$queryRaw `
            INSERT INTO accounts.acc_cheque_book (
              acb_company_id, acb_branch_id, acb_bank_ledger_id, acb_book_no, acb_leaf_from, acb_leaf_to,
              acb_next_leaf, acb_leaf_width, acb_format, acb_remarks, acb_created_by
            ) VALUES (
              ${dto.companyId}::uuid, ${dto.branchId ?? null}::uuid, ${dto.bankLedgerId}::uuid, ${dto.bookNo},
              ${dto.leafFrom}::bigint, ${dto.leafTo}::bigint, ${dto.leafFrom}::bigint, ${width}::smallint,
              ${dto.format ?? null}, ${dto.remarks ?? null}, ${actor}
            ) RETURNING acb_id`;
                    id = row.acb_id;
                }
                else {
                    await tx.$executeRaw `
            UPDATE accounts.acc_cheque_book
               SET acb_branch_id = ${dto.branchId ?? null}::uuid,
                   acb_bank_ledger_id = ${dto.bankLedgerId}::uuid,
                   acb_book_no = ${dto.bookNo},
                   acb_leaf_from = ${dto.leafFrom}::bigint,
                   acb_leaf_to = ${dto.leafTo}::bigint,
                   acb_next_leaf = CASE WHEN acb_next_leaf = acb_leaf_from THEN ${dto.leafFrom}::bigint ELSE acb_next_leaf END,
                   acb_leaf_width = ${width}::smallint,
                   acb_format = ${dto.format ?? null},
                   acb_remarks = ${dto.remarks ?? null},
                   acb_status = CASE WHEN (CASE WHEN acb_next_leaf = acb_leaf_from THEN ${dto.leafFrom}::bigint ELSE acb_next_leaf END) > ${dto.leafTo}::bigint
                                     THEN 'FINISHED' ELSE 'ACTIVE' END,
                   acb_modified_on = now(), acb_modified_by = ${actor}
             WHERE acb_id = ${id}::uuid`;
                }
            }
            catch (e) {
                if (e instanceof client_1.Prisma.PrismaClientKnownRequestError &&
                    String(e.message).includes('ux_acb_book_no')) {
                    (0, vouchers_errors_1.throwState)(`${bank.name} already has a book numbered ${dto.bookNo}`, vouchers_errors_1.VCH.BOOK_OVERLAP, 'bookNo');
                }
                throw e;
            }
            return this.load(tx, dto.companyId, id);
        });
    }
    async close(dto) {
        const { actor } = this.caller();
        return this.prisma.$transaction(async (tx) => {
            await this.require(tx, 'edit', vouchers_errors_1.VCH.RIGHT_EDIT);
            await tx.$queryRaw `SELECT 1 FROM accounts.acc_cheque_book WHERE acb_id = ${dto.chequeBookId}::uuid FOR UPDATE`;
            const book = await (0, cheque_book_helper_1.loadChequeBook)(tx, dto.chequeBookId);
            if (!book || book.isDeleted || book.companyId !== dto.companyId) {
                (0, vouchers_errors_1.throwMissing)(`No cheque book ${dto.chequeBookId} for this company`, vouchers_errors_1.VCH.BOOK_NOT_FOUND, 'chequeBookId');
            }
            if (book.status === 'CLOSED') {
                (0, vouchers_errors_1.throwState)(`Book ${book.bookNo} is already closed`, vouchers_errors_1.VCH.BOOK_FINISHED, 'chequeBookId');
            }
            await tx.$executeRaw `
        UPDATE accounts.acc_cheque_book
           SET acb_status = 'CLOSED', acb_closed_on = now(), acb_close_reason = ${dto.reason},
               acb_modified_on = now(), acb_modified_by = ${actor}
         WHERE acb_id = ${dto.chequeBookId}::uuid`;
            return this.load(tx, dto.companyId, dto.chequeBookId);
        });
    }
    async load(tx, companyId, id) {
        const book = await (0, cheque_book_helper_1.loadChequeBook)(tx, id);
        if (!book || book.isDeleted || book.companyId !== companyId) {
            (0, vouchers_errors_1.throwMissing)(`No cheque book ${id} for this company`, vouchers_errors_1.VCH.BOOK_NOT_FOUND, 'chequeBookId');
        }
        const [extra] = await tx.$queryRaw `
      SELECT acb_closed_on, acb_close_reason FROM accounts.acc_cheque_book WHERE acb_id = ${id}::uuid`;
        const leaves = await tx.$queryRaw `
      SELECT p.apd_instrument_no, p.apd_id, p.apd_acc_year, l.led_name, p.apd_amount, p.apd_status,
             h.avh_voucher_refno
        FROM accounts.acc_pdc_register p
        JOIN accounts.acc_ledger_master l ON l.led_id = p.apd_party_id
        LEFT JOIN accounts.acc_voucher_header h
               ON h.avh_voucher_id = p.apd_voucher_id AND h.avh_acc_year = p.apd_voucher_acc_year
       WHERE p.apd_cheque_book_id = ${id}::uuid AND p.apd_is_deleted = false
       ORDER BY p.apd_instrument_no`;
        const finished = book.nextLeaf > book.leafTo;
        return {
            chequeBookId: book.chequeBookId,
            companyId: book.companyId,
            branchId: book.branchId,
            bankLedgerId: book.bankLedgerId,
            bankName: book.bankName,
            bookNo: book.bookNo,
            leafFrom: (0, cheque_book_helper_1.formatLeaf)(book.leafFrom, book.leafWidth),
            leafTo: (0, cheque_book_helper_1.formatLeaf)(book.leafTo, book.leafWidth),
            nextLeaf: finished ? null : (0, cheque_book_helper_1.formatLeaf)(book.nextLeaf, book.leafWidth),
            left: (0, cheque_book_helper_1.leavesLeft)(book),
            used: book.nextLeaf - book.leafFrom,
            leafWidth: book.leafWidth,
            format: book.format,
            status: book.status,
            closedOn: extra?.acb_closed_on?.toISOString() ?? null,
            closeReason: extra?.acb_close_reason ?? null,
            remarks: book.remarks,
            leaves: leaves.map((r) => ({
                leaf: r.apd_instrument_no,
                apdId: r.apd_id,
                apdAccYear: r.apd_acc_year.trim(),
                partyName: r.led_name,
                amount: Number(new client_1.Prisma.Decimal(r.apd_amount).toFixed(2)),
                status: r.apd_status,
                voucherRefno: r.avh_voucher_refno,
            })),
        };
    }
};
exports.ChequeBooksService = ChequeBooksService;
exports.ChequeBooksService = ChequeBooksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], ChequeBooksService);
//# sourceMappingURL=cheque-books.service.js.map