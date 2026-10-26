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
exports.StockVoucherService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const loose_search_1 = require("../../../common/search/loose-search");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const ist_clock_util_1 = require("../../../common/utils/ist-clock.util");
const stock_voucher_numbering_helper_1 = require("./stock-voucher-numbering.helper");
const stock_voucher_import_helper_1 = require("./stock-voucher-import.helper");
const stock_voucher_batch_numbering_helper_1 = require("./stock-voucher-batch-numbering.helper");
const batch_detail_helper_1 = require("../batch-detail/batch-detail.helper");
const stock_voucher_posting_helper_1 = require("./stock-voucher-posting.helper");
const stock_posting_service_1 = require("../posting/stock-posting.service");
const stock_voucher_source_1 = require("../posting/stock-voucher.source");
const stock_error_codes_1 = require("../types/stock-error-codes");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const stock_voucher_types_1 = require("./types/stock-voucher.types");
const STOCK_VOUCHER_TABLE_NAME = 'stock_voucher';
const PARKED_LINE_NO = 1_000_000;
const DEFAULT_REPORT_LIMIT = 200;
const MAX_REPORT_LIMIT = 1000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;
const DOC_DATETIME_ONLINE_SKEW_MS = 15 * 60_000;
const DOC_DATETIME_OFFLINE_MAX_MS = 7 * 24 * 3_600_000;
let StockVoucherService = class StockVoucherService {
    prisma;
    auditLogService;
    requestContextService;
    stockPosting;
    constructor(prisma, auditLogService, requestContextService, stockPosting) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
        this.stockPosting = stockPosting;
    }
    async save(rules, dto, hooks) {
        const { header } = dto;
        const actor = this.actorOf(header.userId);
        this.assertPayloadRules(rules, dto);
        await this.assertReasons(rules, dto);
        await this.assertCrew(rules, dto);
        const postAfterSave = header.status === 'POSTED' || header.post === true;
        const postedOn = new Date();
        const { svhId, rowsPosted, bookChanges } = await this.prisma.$transaction(async (tx) => {
            if (header.svhId) {
                const existing = await this.loadForWrite(tx, rules, header.svhId, header.accYear, header.companyId, header.branchId);
                this.assertDraft(rules, existing);
            }
            if (rules.allowsCount && header.freezeStock && header.freezeFrom && header.freezeTo) {
                await this.assertFreezeNotHeld(tx, header);
            }
            const before = header.svhId
                ? await this.getById(rules, header.svhId, header.accYear, header.companyId, header.branchId, tx)
                : null;
            const batches = rules.autoBatchNo
                ? await (0, stock_voucher_batch_numbering_helper_1.assignAutoBatchNumbers)(tx, {
                    companyId: header.companyId,
                    branchId: header.branchId,
                    accYear: header.accYear,
                    docDate: header.docDate,
                    svhId: header.svhId,
                }, dto.lines)
                : null;
            const saved = batches ? { ...dto, lines: batches.lines } : dto;
            const { svhId: id, bookChanges } = header.svhId
                ? await this.updateDraft(tx, rules, saved, actor, postedOn)
                : await this.createDraft(tx, rules, saved, actor, postedOn);
            if (batches) {
                await (0, batch_detail_helper_1.syncBatchDetails)(tx, {
                    companyId: header.companyId,
                    accYear: header.accYear,
                    srcDocType: rules.voucherType,
                    srcDocId: id,
                    actor: this.auditActor(actor),
                }, saved.lines, batches.numbered);
            }
            if (!postAfterSave) {
                await this.logRevision(tx, rules, id, header, before, actor, false);
                return { svhId: id, rowsPosted: null, bookChanges };
            }
            await this.lockForPreflight(tx, rules, id, header.accYear);
            await hooks?.beforePost?.(tx, id);
            await this.assertPostable(rules, id, header.accYear, header.companyId, header.branchId, tx);
            const posted = await this.stockPosting.post(tx, new stock_voucher_source_1.StockVoucherSource({
                svhId: id,
                accYear: header.accYear,
                companyId: header.companyId,
                branchId: header.branchId,
                rules,
            }), { actor, postedOn });
            await hooks?.afterPost?.(tx, posted.rowsPosted, id);
            await this.logStatusChange(tx, {
                rules,
                svhId: id,
                accYear: header.accYear,
                companyId: header.companyId,
                branchId: header.branchId,
                tenantId: header.tenantId ?? null,
                refno: (await this.loadRefno(tx, id, header.accYear)) ?? id,
                fromStatus: 'DRAFT',
                toStatus: posted.status,
                actor,
                changedOn: postedOn,
                remarks: `${rules.displayName} saved and posted — ${posted.rowsPosted} ledger rows`,
                deviceId: header.deviceId,
                sessionId: header.sessionId ?? null,
            });
            await this.logRevision(tx, rules, id, header, before, actor, true);
            return { svhId: id, rowsPosted: posted.rowsPosted, bookChanges };
        });
        const document = await this.getById(rules, svhId, header.accYear, header.companyId, header.branchId);
        const rebased = new Map(bookChanges.map((change) => [change.sviId, change]));
        return {
            ...document,
            lines: document.lines.map((line) => ({
                ...line,
                bookChanged: rebased.has(line.sviId),
                previousBookQty: rebased.get(line.sviId)?.previousBookQty ?? null,
            })),
            rowsPosted,
            bookChanges,
        };
    }
    async logRevision(tx, rules, svhId, header, before, actor, posted) {
        const after = await this.getById(rules, svhId, header.accYear, header.companyId, header.branchId, tx);
        await this.auditLogService.logDocumentRevision({
            screenName: rules.auditScreenName,
            tableName: STOCK_VOUCHER_TABLE_NAME,
            docId: svhId,
            displayName: after.header.refno,
            before,
            after,
            userId: actor,
            branchId: header.branchId,
            deviceId: header.deviceId,
            notes: `${rules.displayName} ${before ? 'updated' : 'created'}${posted ? ' and posted' : ''}`,
        }, tx);
    }
    async loadRefno(tx, svhId, accYear) {
        const row = await tx.stockVoucher.findUnique({
            where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
            select: { svhRefno: true },
        });
        return row?.svhRefno ?? null;
    }
    assertPayloadRules(rules, dto) {
        const { header, lines } = dto;
        const errors = [];
        if (rules.refuseTypes?.length) {
            for (const refused of rules.refuseTypes) {
                if (refused === rules.voucherType) {
                    errors.push({
                        field: 'voucherType',
                        code: stock_error_codes_1.StockErrorCode.VOUCHER_TYPE_NOT_ALLOWED,
                        message: `${rules.voucherType} cannot be saved through this route.`,
                    });
                }
            }
        }
        if (rules.requiresToGodown && !header.toGodownId) {
            errors.push({
                field: 'toGodownId',
                code: stock_error_codes_1.StockErrorCode.TO_GODOWN_REQUIRED,
                message: `A ${rules.displayName} must name the godown the stock arrives in.`,
            });
        }
        if (rules.requiresFromGodown && !header.fromGodownId) {
            errors.push({
                field: 'fromGodownId',
                code: stock_error_codes_1.StockErrorCode.FROM_GODOWN_REQUIRED,
                message: `A ${rules.displayName} must name the godown the stock leaves from.`,
            });
        }
        if (rules.lineDirection !== 'REASON') {
            const signed = lines.findIndex((line) => line.direction !== undefined && line.direction !== null);
            if (signed >= 0) {
                errors.push({
                    field: `lines.${signed}`,
                    code: stock_error_codes_1.StockErrorCode.LINE_DIRECTION_NOT_ALLOWED,
                    message: `Line ${lines[signed].lineNo}: only a stock adjustment states a direction per line; a ${rules.displayName.toLowerCase()} moves every line the same way.`,
                });
            }
        }
        if (rules.postShape === 'BUCKET_MOVE') {
            lines.forEach((line, index) => {
                if (!line.toBucket) {
                    errors.push({
                        field: `lines.${index}.toBucket`,
                        code: stock_error_codes_1.StockErrorCode.MOVE_TO_BUCKET_REQUIRED,
                        message: `Line ${line.lineNo}: a stock move names the bucket the stock moves to.`,
                    });
                }
                else if (line.toBucket === (line.bucket ?? 'SALEABLE')) {
                    errors.push({
                        field: `lines.${index}.toBucket`,
                        code: stock_error_codes_1.StockErrorCode.MOVE_SAME_BUCKET,
                        message: `Line ${line.lineNo}: moves stock from ${line.toBucket} into ${line.toBucket}. Pick a different bucket.`,
                    });
                }
            });
        }
        else {
            const moved = lines.findIndex((line) => line.toBucket !== undefined && line.toBucket !== null);
            if (moved >= 0) {
                errors.push({
                    field: `lines.${moved}.toBucket`,
                    code: stock_error_codes_1.StockErrorCode.TO_BUCKET_NOT_ALLOWED,
                    message: `Line ${lines[moved].lineNo}: only a stock move names a destination bucket; a ${rules.displayName.toLowerCase()} keeps the stock where it is.`,
                });
            }
        }
        if (!rules.allowsToBranch && header.toBranchId) {
            errors.push({
                field: 'toBranchId',
                code: stock_error_codes_1.StockErrorCode.TO_BRANCH_NOT_ALLOWED,
                message: `Only a transfer names the branch stock is going to; a ${rules.displayName.toLowerCase()} does not leave the branch.`,
            });
        }
        if (!rules.allowsCount) {
            if (header.freezeStock || header.freezeFrom || header.freezeTo) {
                errors.push({
                    field: 'freezeStock',
                    code: stock_error_codes_1.StockErrorCode.FREEZE_NOT_ALLOWED,
                    message: `Only a physical count freezes stock; a ${rules.displayName.toLowerCase()} counts nothing.`,
                });
            }
            const counted = lines.findIndex((line) => line.bookQty !== undefined && line.bookQty !== null);
            const shelf = lines.findIndex((line) => line.countedQty !== undefined && line.countedQty !== null);
            const at = counted >= 0 ? counted : shelf;
            if (at >= 0) {
                errors.push({
                    field: `lines.${at}`,
                    code: stock_error_codes_1.StockErrorCode.COUNT_FIELDS_NOT_ALLOWED,
                    message: `Line ${lines[at].lineNo}: bookQty and countedQty belong to a physical count. A ${rules.displayName.toLowerCase()} states a quantity, it does not reconcile one.`,
                });
            }
        }
        else if (header.freezeStock && !(header.freezeFrom && header.freezeTo)) {
            errors.push({
                field: 'freezeStock',
                code: stock_error_codes_1.StockErrorCode.FREEZE_WINDOW_REQUIRED,
                message: 'A freeze needs both freezeFrom and freezeTo — without a window the count measures a moving target.',
            });
        }
        if (!rules.allowsLoading) {
            const sent = loadingFieldSent(header);
            if (sent) {
                errors.push({
                    field: sent,
                    code: stock_error_codes_1.StockErrorCode.LOADING_NOT_ALLOWED,
                    message: `Only a transfer records loading and unloading; a ${rules.displayName.toLowerCase()} names no crew, vehicle or loading charge.`,
                });
            }
            const rated = lines.findIndex((line) => this.toDecimalNumber(line.loadRate ?? 0) !== 0 ||
                this.toDecimalNumber(line.unloadRate ?? 0) !== 0);
            if (rated >= 0) {
                errors.push({
                    field: `lines.${rated}.loadRate`,
                    code: stock_error_codes_1.StockErrorCode.LOADING_NOT_ALLOWED,
                    message: `Line ${lines[rated].lineNo}: loading and unloading rates belong to a transfer line.`,
                });
            }
        }
        else {
            const dayStart = Date.parse(`${header.docDate}T00:00:00+05:30`);
            for (const [field, value] of [
                ['loadDatetime', header.loadDatetime],
                ['unloadDatetime', header.unloadDatetime],
            ]) {
                const at = this.toInstant(value);
                if (at !== null && !Number.isNaN(dayStart) && at < dayStart) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.LOADING_BEFORE_DOC_DATE,
                        message: `${field} ${(0, ist_clock_util_1.istClockText)(at)} is before the document date ${header.docDate}. Goods are loaded and unloaded on or after the day the transfer is dated.`,
                    });
                }
            }
        }
        const linkParts = [
            header.linkSrcModule,
            header.linkSrcDocType,
            header.linkSrcDocId,
            header.linkSrcAccYear,
        ];
        const linkGiven = linkParts.filter((part) => part !== undefined && part !== null && part !== '');
        if (linkGiven.length > 0 && linkGiven.length < linkParts.length) {
            errors.push({
                field: 'linkSrcModule',
                code: stock_error_codes_1.StockErrorCode.LINK_INCOMPLETE,
                message: 'The source document is all four of linkSrcModule, linkSrcDocType, linkSrcDocId and linkSrcAccYear, or none of them (ck_svh_link).',
            });
        }
        if (!lines.length) {
            errors.push({ field: 'lines', code: stock_error_codes_1.StockErrorCode.LINES_REQUIRED, message: 'A document must have at least one line.' });
        }
        const dateYear = accYearOfDate(header.docDate);
        if (dateYear !== header.accYear.trim()) {
            errors.push({
                field: 'docDate',
                code: stock_error_codes_1.StockErrorCode.DOC_DATE_OUTSIDE_YEAR,
                message: `${header.docDate} falls in ${dateYear}, not in ${header.accYear.trim()}, the year this document is filed under.`,
            });
        }
        if (header.freezeStock && (!header.freezeFrom || !header.freezeTo)) {
            errors.push({
                field: 'freezeFrom',
                code: stock_error_codes_1.StockErrorCode.FREEZE_WINDOW_REQUIRED,
                message: 'A stock freeze needs a window: send freezeFrom and freezeTo as instants with an offset. The guard compares them to now(), not to the document date.',
            });
        }
        const docDatetime = this.toInstant(header.docDatetime);
        if (docDatetime !== null) {
            const now = Date.now();
            const syncedAt = this.toInstant(header.syncDate);
            const skewMinutes = DOC_DATETIME_ONLINE_SKEW_MS / 60_000;
            if (syncedAt === null) {
                if (Math.abs(docDatetime - now) > DOC_DATETIME_ONLINE_SKEW_MS) {
                    errors.push({
                        field: 'docDatetime',
                        code: stock_error_codes_1.StockErrorCode.DOC_DATETIME_OUT_OF_RANGE,
                        message: `docDatetime ${(0, ist_clock_util_1.istClockText)(docDatetime)} is more than ${skewMinutes} minutes from the ` +
                            `server clock (${(0, ist_clock_util_1.istClockText)(now)}). Leave it out to take the server's time; a device ` +
                            'that keyed the document offline sends syncDate with it.',
                    });
                }
            }
            else if (docDatetime > syncedAt + DOC_DATETIME_ONLINE_SKEW_MS ||
                syncedAt > now + DOC_DATETIME_ONLINE_SKEW_MS ||
                syncedAt - docDatetime > DOC_DATETIME_OFFLINE_MAX_MS) {
                errors.push({
                    field: 'docDatetime',
                    code: stock_error_codes_1.StockErrorCode.DOC_DATETIME_OUT_OF_RANGE,
                    message: `An offline document is keyed before it syncs, syncs no later than now, and trails its ` +
                        `sync by at most 7 days: docDatetime ${(0, ist_clock_util_1.istClockText)(docDatetime)}, syncDate ` +
                        `${(0, ist_clock_util_1.istClockText)(syncedAt)}, server clock ${(0, ist_clock_util_1.istClockText)(now)}.`,
                });
            }
        }
        const freezeFrom = this.toInstant(header.freezeFrom);
        const freezeTo = this.toInstant(header.freezeTo);
        if (freezeFrom !== null && freezeTo !== null && freezeTo <= freezeFrom) {
            errors.push({ field: 'freezeTo', code: stock_error_codes_1.StockErrorCode.FREEZE_WINDOW_ORDER, message: 'freezeTo must be after freezeFrom.' });
        }
        const isCount = rules.quantityMode === 'COUNT';
        const countedGodownId = isCount ? (header.toGodownId ?? header.fromGodownId ?? null) : null;
        const derivableSource = header.rateSource !== null &&
            header.rateSource !== undefined &&
            stock_voucher_types_1.DERIVABLE_RATE_SOURCES.includes(header.rateSource);
        const seen = new Map();
        const holdingSeen = new Map();
        lines.forEach((line, index) => {
            const field = `lines.${index}`;
            const splitNo = line.splitNo ?? 1;
            const key = `${line.lineNo}|${splitNo}`;
            const firstAt = seen.get(key);
            if (firstAt !== undefined) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_DUPLICATE,
                    message: `Line ${line.lineNo} split ${splitNo} is already used by row ${firstAt + 1}.`,
                });
            }
            else {
                seen.set(key, index);
            }
            const qty = this.toDecimalNumber(line.qty);
            const freeQty = this.toDecimalNumber(line.freeQty ?? 0);
            if (qty < 0 || freeQty < 0) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_QTY_NEGATIVE,
                    message: `Line ${line.lineNo}: quantities are magnitudes and cannot be negative. A negative opening is an ADJUSTMENT.`,
                });
            }
            else if (!isCount && qty === 0 && freeQty === 0) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_QTY_REQUIRED,
                    message: `Line ${line.lineNo} has no quantity.`,
                });
            }
            if (!isCount) {
                const factor = this.toDecimalColumn(line.toBaseFactor);
                const baseQty = this.toDecimalColumn(line.qty).mul(factor).toDecimalPlaces(6);
                if (!this.toDecimalColumn(line.baseQty).toDecimalPlaces(6).equals(baseQty)) {
                    errors.push({
                        field: `${field}.baseQty`,
                        code: stock_error_codes_1.StockErrorCode.LINE_BASE_QTY_MISMATCH,
                        message: `Line ${line.lineNo}: baseQty ${line.baseQty} is not qty ${line.qty} × toBaseFactor ${line.toBaseFactor} = ${baseQty.toString()}.`,
                    });
                }
                const freeBaseQty = this.toDecimalColumn(line.freeQty ?? 0).mul(factor).toDecimalPlaces(6);
                if (!this.toDecimalColumn(line.freeBaseQty ?? 0).toDecimalPlaces(6).equals(freeBaseQty)) {
                    errors.push({
                        field: `${field}.freeBaseQty`,
                        code: stock_error_codes_1.StockErrorCode.LINE_FREE_BASE_QTY_MISMATCH,
                        message: `Line ${line.lineNo}: freeBaseQty ${line.freeBaseQty ?? '(not sent)'} is not freeQty ${line.freeQty ?? 0} × toBaseFactor ${line.toBaseFactor} = ${freeBaseQty.toString()}.`,
                    });
                }
            }
            if (!isCount && !line.uomId) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_UNIT_REQUIRED,
                    message: `Line ${line.lineNo} names no unit. uomId is an item_unit_conversion iuc_id, not a unit_id.`,
                });
            }
            if (isCount) {
                if (line.uomId) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.COUNT_UNIT_NOT_ALLOWED,
                        message: `Line ${line.lineNo}: a count line names no unit. It is counted in the base unit the book figure is held in, read from the balance row.`,
                    });
                }
                if (qty !== 0 || freeQty !== 0) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.COUNT_QTY_NOT_ALLOWED,
                        message: `Line ${line.lineNo}: a count line states what was FOUND, not a quantity to move. Send countedQty and leave qty at 0 — a quantity to move is an ADJUSTMENT.`,
                    });
                }
                if (this.toDecimalNumber(line.costRate ?? 0) !== 0) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.COUNT_COST_NOT_ALLOWED,
                        message: `Line ${line.lineNo}: a count line carries no cost rate. An overage is valued from the document's rate source; a shortage at what the stock cost us, stamped by the engine.`,
                    });
                }
                if (this.readRefusedBookQty(line) !== undefined) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.COUNT_BOOK_QTY_NOT_ALLOWED,
                        message: `Line ${line.lineNo}: bookQty is read from stock_balance at save time and is never taken from the payload.`,
                    });
                }
                if (line.countedQty === undefined || line.countedQty === null || line.countedQty === '') {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.COUNT_NOT_COUNTED,
                        message: `Line ${line.lineNo} has not been counted yet. Send countedQty: 0 to record that nothing was found — absent means the counter has not reached this line.`,
                    });
                }
                else if (this.toDecimalNumber(line.countedQty) < 0) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.COUNT_QTY_NEGATIVE,
                        message: `Line ${line.lineNo}: countedQty is a count and cannot be negative. Only the derived difference is signed.`,
                    });
                }
                if (!line.lotId) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.COUNT_HOLDING_REQUIRED,
                        message: `Line ${line.lineNo} names no holding. A count line comes from the count sheet, which carries the lotId its book figure was read from.`,
                    });
                }
                if (countedGodownId && line.godownId !== countedGodownId) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.COUNT_GODOWN_MISMATCH,
                        message: `Line ${line.lineNo} is in a different godown than the one this count names. A count is per godown.`,
                    });
                }
                if (line.lotId) {
                    const holding = this.holdingKey(line.lotId, line.godownId, line.bucket);
                    const firstHoldingAt = holdingSeen.get(holding);
                    if (firstHoldingAt !== undefined) {
                        errors.push({
                            field,
                            code: stock_error_codes_1.StockErrorCode.COUNT_HOLDING_DUPLICATE,
                            message: `Line ${line.lineNo} counts the same holding (lot, godown and bucket) as row ${firstHoldingAt + 1}. A holding is one line on a count sheet — put the whole count on that line.`,
                        });
                    }
                    else {
                        holdingSeen.set(holding, index);
                    }
                }
            }
            if (rules.requiresLot) {
                if (!line.lotId) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.LINE_LOT_REQUIRED,
                        message: `Line ${line.lineNo} names no lot. A ${rules.displayName.toLowerCase()} moves existing stock — pick the holding from the balance, which carries its lotId.`,
                    });
                }
            }
            else if (!isCount && !rules.allowsLot && line.lotId) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_LOT_NOT_ALLOWED,
                    message: `Line ${line.lineNo}: a ${rules.displayName.toLowerCase()} does not choose its own lot. The engine resolves it at post.`,
                });
            }
            if (this.toDecimalNumber(line.weightQty ?? 0) < 0) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_WEIGHT_NEGATIVE,
                    message: `Line ${line.lineNo}: weight is a magnitude and cannot be negative.`,
                });
            }
            if (rules.allowsLoading) {
                for (const rate of ['loadRate', 'unloadRate']) {
                    if (this.toDecimalNumber(line[rate] ?? 0) < 0) {
                        errors.push({
                            field: `${field}.${rate}`,
                            code: stock_error_codes_1.StockErrorCode.LOADING_RATE_NEGATIVE,
                            message: `Line ${line.lineNo}: ${rate} ${line[rate]} is negative. A rate is what the crew is paid per unit, 0 or more.`,
                        });
                    }
                }
            }
            if (splitNo > 1 && !line.batchNo?.trim()) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_SPLIT_BATCH_REQUIRED,
                    message: `Line ${line.lineNo} split ${splitNo} needs a batch number.`,
                });
            }
            if (line.mfgDate && line.expiryDate && line.expiryDate < line.mfgDate) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_EXPIRY_BEFORE_MFG,
                    message: `Line ${line.lineNo}: expiry ${line.expiryDate} is before manufacture ${line.mfgDate}.`,
                });
            }
            if (rules.zeroesLineCost &&
                !isCount &&
                (this.toDecimalNumber(line.costRate ?? 0) !== 0 ||
                    this.toDecimalNumber(line.costRateWot ?? 0) !== 0)) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_COST_NOT_ALLOWED,
                    message: `Line ${line.lineNo}: a ${rules.displayName.toLowerCase()} carries no cost rate. The stock is valued at what it cost where it came from, stamped by the engine, and that figure travels with it.`,
                });
            }
            if (!isCount &&
                !rules.zeroesLineCost &&
                rules.isInward &&
                this.toDecimalNumber(line.costRate ?? 0) === 0 &&
                !derivableSource) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_COST_REQUIRED,
                    message: header.rateSource
                        ? `Line ${line.lineNo} brings stock in at cost 0 and the rate source is ${header.rateSource}, which derives nothing. Type the cost rate.`
                        : `Line ${line.lineNo} brings stock in at cost 0 and the document names no rate source. Set a cost rate, or a rateSource for the engine to derive one from.`,
                });
            }
        });
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be saved`, errors);
        }
    }
    async assertReasons(rules, dto) {
        const cited = new Map();
        const cite = (reasonId, field, remarks) => {
            const at = cited.get(reasonId);
            if (at) {
                at.push({ field, remarks });
            }
            else {
                cited.set(reasonId, [{ field, remarks }]);
            }
        };
        if (dto.header.reasonId) {
            cite(dto.header.reasonId, 'reasonId', dto.header.remarks);
        }
        dto.lines.forEach((line, index) => {
            if (line.reasonId) {
                cite(line.reasonId, `lines.${index}`, line.remarks ?? dto.header.remarks);
            }
        });
        if (!cited.size) {
            return;
        }
        const rows = await this.prisma.stockReasonMaster.findMany({
            where: {
                srmId: { in: [...cited.keys()] },
                srmIsDeleted: false,
                OR: [{ srmCompanyId: dto.header.companyId }, { srmCompanyId: null }],
            },
            select: {
                srmId: true,
                srmCode: true,
                srmName: true,
                srmIsActive: true,
                srmAllowedTxnTypes: true,
                srmRequireRemarks: true,
            },
        });
        const byId = new Map(rows.map((row) => [row.srmId, row]));
        const errors = [];
        for (const [reasonId, citations] of cited) {
            const [first] = citations;
            const reason = byId.get(reasonId);
            if (!reason) {
                errors.push({
                    field: first.field,
                    code: stock_error_codes_1.StockErrorCode.REASON_NOT_FOUND,
                    message: `No stock reason ${reasonId} visible to this company. A reason is either the company's own or one shared with every company.`,
                });
                continue;
            }
            if (!reason.srmIsActive) {
                errors.push({
                    field: first.field,
                    code: stock_error_codes_1.StockErrorCode.REASON_INACTIVE,
                    message: `Stock reason ${reason.srmCode} (${reason.srmName}) is inactive.`,
                });
                continue;
            }
            const allowed = reason.srmAllowedTxnTypes ?? [];
            if (allowed.length && !allowed.some((txnType) => rules.ledgerTxnTypes.includes(txnType))) {
                errors.push({
                    field: first.field,
                    code: stock_error_codes_1.StockErrorCode.REASON_NOT_ALLOWED,
                    message: `Stock reason ${reason.srmCode} (${reason.srmName}) may not be cited by a ${rules.displayName.toLowerCase()}; it is restricted to ${allowed.join(', ')}.`,
                });
                continue;
            }
            if (reason.srmRequireRemarks) {
                for (const citation of citations) {
                    if (!citation.remarks?.trim()) {
                        errors.push({
                            field: citation.field,
                            code: stock_error_codes_1.StockErrorCode.REASON_REMARK_REQUIRED,
                            message: `Stock reason ${reason.srmCode} (${reason.srmName}) requires a remark saying what happened.`,
                        });
                    }
                }
            }
        }
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('This document cites a stock reason it may not use', errors);
        }
    }
    async assertCrew(rules, dto) {
        if (!rules.allowsLoading) {
            return;
        }
        const { header } = dto;
        const one = (id) => (id ? [id] : []);
        const crew = [
            { field: 'loadmanIds', ids: header.loadmanIds ?? [] },
            { field: 'driverId', ids: one(header.driverId) },
            { field: 'supervisorId', ids: one(header.supervisorId) },
            { field: 'unloadmanIds', ids: header.unloadmanIds ?? [] },
            { field: 'unloadSupervisorId', ids: one(header.unloadSupervisorId) },
        ];
        const errors = [];
        for (const { field, ids } of crew) {
            const twice = ids.find((id, at) => ids.indexOf(id) !== at);
            if (twice) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LOADING_EMPLOYEE_INVALID,
                    message: `${field} names ${twice} twice — one person is one member of a crew.`,
                });
            }
        }
        const named = [...new Set(crew.flatMap((entry) => entry.ids))];
        if (named.length) {
            const found = await this.prisma.$queryRaw `
        SELECT emp_id
          FROM public.employee_master
         WHERE emp_id         = ANY(${named}::uuid[])
           AND emp_is_deleted = false
           AND emp_company_id = ${header.companyId}::uuid`;
            const live = new Set(found.map((row) => row.emp_id));
            for (const { field, ids } of crew) {
                const bad = ids.filter((id) => !live.has(id));
                if (bad.length) {
                    errors.push({
                        field,
                        code: stock_error_codes_1.StockErrorCode.LOADING_EMPLOYEE_INVALID,
                        message: `${field} names ${bad.length === 1 ? 'an employee' : 'employees'} that do not exist, ` +
                            `are deleted, or belong to another company: ${bad.join(', ')}`,
                    });
                }
            }
        }
        if (header.vehicleId) {
            const [vehicle] = await this.prisma.$queryRaw `
        SELECT veh_id
          FROM public.vehicle_master
         WHERE veh_id         = ${header.vehicleId}::uuid
           AND veh_is_deleted = false
           AND veh_company_id = ${header.companyId}::uuid`;
            if (!vehicle) {
                errors.push({
                    field: 'vehicleId',
                    code: stock_error_codes_1.StockErrorCode.LOADING_VEHICLE_INVALID,
                    message: `vehicleId ${header.vehicleId} is not a vehicle of this company (missing, deleted, or another company's).`,
                });
            }
        }
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} names a crew or vehicle it may not`, errors);
        }
    }
    async createDraft(tx, rules, dto, actor, now) {
        const { header } = dto;
        const scope = {
            companyId: header.companyId,
            branchId: header.branchId,
            accYear: header.accYear,
            voucherType: rules.voucherType,
            deviceId: header.deviceId,
        };
        const { slno, refno } = await (0, stock_voucher_numbering_helper_1.allocateStockVoucherNumber)(tx, scope, rules.typeCode, { slno: header.slno, refno: header.refno }, rules.refnoVchrTypeId);
        const created = await tx.stockVoucher.create({
            data: {
                svhCompanyId: header.companyId,
                svhBranchId: header.branchId,
                svhTenantId: header.tenantId ?? null,
                svhAccYear: header.accYear,
                svhDeviceId: header.deviceId,
                svhSessionId: header.sessionId ?? null,
                svhVoucherType: rules.voucherType,
                svhSlno: slno,
                svhRefno: refno,
                svhUsrRefno: header.usrRefno ?? null,
                svhDocDate: new Date(`${header.docDate}T00:00:00Z`),
                svhFromGodownId: header.fromGodownId ?? null,
                svhToGodownId: header.toGodownId ?? null,
                svhToBranchId: header.toBranchId ?? null,
                svhSupplierId: header.supplierId ?? null,
                svhPartyRef: header.partyRef ?? null,
                svhReasonId: header.reasonId ?? null,
                svhRateSource: this.resolveRateSource(rules, header),
                svhRemarks: header.remarks ?? null,
                ...this.docDatetimeData(header),
                ...this.linkSourceData(header),
                ...this.freezeData(header),
                ...this.loadingData(rules, header),
                svhSyncDate: header.syncDate ? new Date(header.syncDate) : null,
                svhStatus: 'DRAFT',
                svhCreatedBy: this.actorFor(header.createdBy, actor),
            },
            select: { svhId: true, svhAccYear: true, svhRefno: true },
        });
        const written = await this.replaceLines(tx, rules, dto, created.svhId, actor, header.createdBy, now);
        await this.writeHeaderTotals(tx, rules, created.svhId, header, written);
        await this.logStatusChange(tx, {
            rules,
            svhId: created.svhId,
            accYear: header.accYear,
            companyId: header.companyId,
            branchId: header.branchId,
            tenantId: header.tenantId ?? null,
            refno: created.svhRefno,
            fromStatus: null,
            toStatus: 'DRAFT',
            actor,
            changedOn: now,
            remarks: `${rules.displayName} created`,
            deviceId: header.deviceId,
            sessionId: header.sessionId ?? null,
        });
        return { svhId: created.svhId, bookChanges: written.bookChanges };
    }
    async writeHeaderTotals(tx, rules, svhId, header, written) {
        const totals = this.documentTotals(rules, written);
        await tx.stockVoucher.update({
            where: { svhId_svhAccYear: { svhId, svhAccYear: header.accYear } },
            data: {
                svhLineCount: totals.lineCount,
                svhTotalQty: totals.totalQty,
                svhTotalValue: totals.totalValue,
                svhTotalValueWot: totals.totalValueWot,
                ...(rules.allowsLoading ? this.loadingCharges(header, written) : {}),
            },
        });
    }
    loadingCharges(header, written) {
        const carried = (row) => new client_1.Prisma.Decimal(row.sviQty).plus(row.sviFreeQty);
        const charge = (enabled, rate) => enabled
            ? written.rows
                .reduce((sum, row) => sum.plus(carried(row).mul(row[rate])), new client_1.Prisma.Decimal(0))
                .toDecimalPlaces(2, client_1.Prisma.Decimal.ROUND_HALF_UP)
            : new client_1.Prisma.Decimal(0);
        return {
            svhLoadingCharge: charge(header.loadEnabled, 'sviLoadRate'),
            svhUnloadingCharge: charge(header.unloadEnabled, 'sviUnloadRate'),
        };
    }
    documentTotals(rules, written) {
        const isCount = rules.quantityMode === 'COUNT';
        const netted = rules.lineDirection === 'REASON' && rules.postShape !== 'BUCKET_MOVE';
        let totalQty = new client_1.Prisma.Decimal(0);
        let totalValue = new client_1.Prisma.Decimal(0);
        let totalValueWot = new client_1.Prisma.Decimal(0);
        for (const row of written.rows) {
            if (isCount) {
                const holding = written.holdings?.get(this.holdingKey(row.sviLotId, row.sviGodownId, row.sviBucket));
                const diff = new client_1.Prisma.Decimal(row.sviCountedQty ?? 0).minus(row.sviBookQty ?? 0);
                totalQty = totalQty.plus(diff);
                totalValue = totalValue.plus(diff.mul(holding?.avgCostRate ?? 0).toDecimalPlaces(2));
                totalValueWot = totalValueWot.plus(diff.mul(holding?.avgCostRateWot ?? 0).toDecimalPlaces(2));
                continue;
            }
            const sign = netted && row.sviDirection === -1 ? -1 : 1;
            const base = new client_1.Prisma.Decimal(row.sviBaseQty).plus(row.sviFreeBaseQty ?? 0);
            totalQty = totalQty.plus(base.mul(sign));
            totalValue = totalValue.plus(base.mul(row.sviCostRate).toDecimalPlaces(2).mul(sign));
            totalValueWot = totalValueWot.plus(base.mul(row.sviCostRateWot).toDecimalPlaces(2).mul(sign));
        }
        return { lineCount: written.rows.length, totalQty, totalValue, totalValueWot };
    }
    async assertFreezeNotHeld(tx, header) {
        const godownId = header.toGodownId ?? header.fromGodownId ?? null;
        if (!godownId) {
            return;
        }
        const [held] = await tx.$queryRaw `
      SELECT svh.svh_refno, svh.svh_freeze_from, svh.svh_freeze_to
        FROM stock.stock_voucher svh
       WHERE svh.svh_company_id   = ${header.companyId}::uuid
         AND svh.svh_branch_id    = ${header.branchId}::uuid
         -- ix_svh_freeze_open covers these four.
         AND svh.svh_voucher_type = 'PHYSICAL'
         AND svh.svh_freeze_stock = true
         AND svh.svh_status       = 'DRAFT'
         AND svh.svh_is_deleted   = false
         AND COALESCE(svh.svh_from_godown_id, svh.svh_to_godown_id) = ${godownId}::uuid
         -- Windows that touch: the other's start is before this end, and its
         -- end after this start.
         AND svh.svh_freeze_from <= ${header.freezeTo}::timestamptz
         AND svh.svh_freeze_to   >= ${header.freezeFrom}::timestamptz
         AND (${header.svhId ?? null}::uuid IS NULL OR svh.svh_id <> ${header.svhId ?? null}::uuid)
       ORDER BY svh.svh_freeze_from
       LIMIT 1`;
        if (!held) {
            return;
        }
        (0, module_service_utils_1.throwStockConflict)(`Godown already frozen for physical count ${held.svh_refno}`, [
            {
                field: 'freezeStock',
                code: stock_error_codes_1.StockErrorCode.FREEZE_GODOWN_HELD,
                message: `This godown is already frozen for physical count ${held.svh_refno} from ` +
                    `${(0, ist_clock_util_1.istClockText)(held.svh_freeze_from)} to ${(0, ist_clock_util_1.istClockText)(held.svh_freeze_to)}. ` +
                    'Two open freezes would refuse each other\'s post for good — count on that sheet, ' +
                    'or post or cancel it first.',
            },
        ]);
    }
    async assertCountNotSuperseded(tx, svhId, accYear, refno) {
        const [later] = await tx.$queryRaw `
      SELECT later.svh_refno   AS later_refno,
             mine.svi_line_no  AS line_no,
             lp.tsl_changed_on AS later_posted_on
        FROM stock.stock_voucher_item mine
        JOIN LATERAL (
          SELECT t.tsl_changed_on
            FROM public.txn_status_log t
           WHERE t.tsl_src_doc_id = mine.svi_voucher_id
             AND t.tsl_to_status  = 'POSTED'
             AND t.tsl_is_deleted = false
           ORDER BY t.tsl_changed_on DESC
           LIMIT 1
        ) mp ON true
        JOIN stock.stock_voucher_item other
          ON other.svi_lot_id     = mine.svi_lot_id
         AND other.svi_godown_id  = mine.svi_godown_id
         AND other.svi_bucket     = mine.svi_bucket
         AND other.svi_voucher_id <> mine.svi_voucher_id
         AND other.svi_is_deleted = false
        JOIN stock.stock_voucher later
          ON later.svh_id           = other.svi_voucher_id
         AND later.svh_acc_year     = other.svi_acc_year
         AND later.svh_voucher_type = 'PHYSICAL'
         AND later.svh_status       = 'POSTED'
         AND later.svh_is_deleted   = false
        JOIN LATERAL (
          SELECT t.tsl_changed_on
            FROM public.txn_status_log t
           WHERE t.tsl_src_doc_id = later.svh_id
             AND t.tsl_to_status  = 'POSTED'
             AND t.tsl_is_deleted = false
           ORDER BY t.tsl_changed_on DESC
           LIMIT 1
        ) lp ON true
       WHERE mine.svi_voucher_id = ${svhId}::uuid
         AND mine.svi_acc_year   = ${accYear}::bpchar
         AND mine.svi_is_deleted = false
         AND mine.svi_lot_id IS NOT NULL
         AND lp.tsl_changed_on > mp.tsl_changed_on
       ORDER BY mine.svi_line_no
       LIMIT 1`;
        if (!later) {
            return;
        }
        (0, module_service_utils_1.throwStockConflict)(`${refno} has been counted again by ${later.later_refno}`, [
            {
                field: 'svhId',
                code: stock_error_codes_1.StockErrorCode.COUNT_SUPERSEDED,
                message: `Line ${later.line_no} of ${refno} was counted again by ${later.later_refno}, posted ` +
                    `${(0, ist_clock_util_1.istClockText)(later.later_posted_on)}. Cancelling ${refno} would undo an old variance ` +
                    `under a newer count. Count the holding again instead.`,
            },
        ]);
    }
    async updateDraft(tx, rules, dto, actor, now) {
        const { header } = dto;
        const svhId = header.svhId;
        await tx.stockVoucher.update({
            where: { svhId_svhAccYear: { svhId, svhAccYear: header.accYear } },
            data: {
                svhTenantId: header.tenantId ?? null,
                svhDeviceId: header.deviceId,
                svhSessionId: header.sessionId ?? null,
                svhUsrRefno: header.usrRefno ?? null,
                svhDocDate: new Date(`${header.docDate}T00:00:00Z`),
                svhFromGodownId: header.fromGodownId ?? null,
                svhToGodownId: header.toGodownId ?? null,
                svhToBranchId: header.toBranchId ?? null,
                svhSupplierId: header.supplierId ?? null,
                svhPartyRef: header.partyRef ?? null,
                svhReasonId: header.reasonId ?? null,
                svhRateSource: this.resolveRateSource(rules, header),
                svhRemarks: header.remarks ?? null,
                ...this.docDatetimeData(header),
                ...this.linkSourceData(header),
                ...this.freezeData(header),
                ...this.loadingData(rules, header),
                svhSyncDate: header.syncDate ? new Date(header.syncDate) : null,
                svhVersionNo: { increment: 1 },
                svhModifiedOn: now,
                svhModifiedBy: this.actorFor(header.modifiedBy, actor),
            },
        });
        const written = await this.replaceLines(tx, rules, dto, svhId, actor, header.modifiedBy, now);
        await this.writeHeaderTotals(tx, rules, svhId, header, written);
        return { svhId, bookChanges: written.bookChanges };
    }
    async replaceLines(tx, rules, dto, svhId, actor, author, now) {
        const { header, lines } = dto;
        const stored = header.svhId
            ? await tx.stockVoucherItem.findMany({
                where: { sviVoucherId: svhId, sviAccYear: header.accYear, sviIsDeleted: false },
            })
            : null;
        this.assertLineIds(rules, lines, stored === null ? null : new Set(stored.map((r) => r.sviId)));
        const kept = new Set(lines.map((line) => line.sviId).filter((id) => !!id));
        const dropped = (stored ?? []).filter((row) => !kept.has(row.sviId)).map((row) => row.sviId);
        if (dropped.length) {
            await tx.stockVoucherItem.deleteMany({
                where: { sviVoucherId: svhId, sviAccYear: header.accYear, sviId: { in: dropped } },
            });
        }
        if (!lines.length) {
            return { rows: [], holdings: null, bookChanges: [] };
        }
        const isCount = rules.quantityMode === 'COUNT';
        const zeroCost = isCount || rules.zeroesLineCost === true;
        const holdings = isCount ? await this.loadCountHoldings(tx, header, lines) : null;
        const data = lines.map((line) => {
            const holding = holdings?.get(this.holdingKey(line.lotId, line.godownId, line.bucket));
            return {
                sviVoucherId: svhId,
                sviCompanyId: header.companyId,
                sviBranchId: header.branchId,
                sviTenantId: header.tenantId ?? null,
                sviAccYear: header.accYear,
                sviLineNo: line.lineNo,
                sviSplitNo: line.splitNo ?? 1,
                sviItemId: line.itemId,
                sviUomId: isCount ? holding.baseUomId : line.uomId,
                sviBaseUomId: isCount ? holding.baseUomId : line.baseUomId,
                sviToBaseFactor: isCount ? new client_1.Prisma.Decimal(1) : this.toDecimalColumn(line.toBaseFactor),
                sviGodownId: line.godownId,
                sviLotId: isCount || rules.requiresLot || rules.allowsLot ? (line.lotId ?? null) : null,
                sviBucket: (line.bucket ?? 'SALEABLE'),
                sviToBucket: rules.postShape === 'BUCKET_MOVE' ? (line.toBucket ?? null) : null,
                sviBarcode: line.barcode ?? null,
                sviBatchNo: isCount ? holding.batchNo : (line.batchNo ?? null),
                sviMfgDate: isCount
                    ? holding.mfgDate
                    : line.mfgDate
                        ? new Date(`${line.mfgDate}T00:00:00Z`)
                        : null,
                sviExpiryDate: isCount
                    ? holding.expiryDate
                    : line.expiryDate
                        ? new Date(`${line.expiryDate}T00:00:00Z`)
                        : null,
                sviMrp: isCount ? holding.mrp : this.toNullableDecimal(line.mrp),
                sviSalePrice: isCount
                    ? holding.salePrice
                    : this.toNullableDecimal(line.salePrice),
                sviSerialNo: isCount ? holding.serialNo : (line.serialNo ?? null),
                sviSupplierId: isCount ? holding.supplierId : (line.supplierId ?? null),
                sviQty: isCount ? new client_1.Prisma.Decimal(0) : this.toDecimalColumn(line.qty),
                sviBaseQty: isCount ? new client_1.Prisma.Decimal(0) : this.toDecimalColumn(line.baseQty),
                sviFreeQty: isCount ? new client_1.Prisma.Decimal(0) : this.toDecimalColumn(line.freeQty ?? 0),
                ...(isCount
                    ? { sviFreeBaseQty: new client_1.Prisma.Decimal(0) }
                    : line.freeBaseQty === undefined
                        ? {}
                        : { sviFreeBaseQty: this.toDecimalColumn(line.freeBaseQty) }),
                sviWeightQty: this.toDecimalColumn(line.weightQty ?? 0),
                sviBookQty: isCount
                    ? holding.bookQty
                    : this.toNullableDecimal(line.bookQty),
                sviCountedQty: this.toNullableDecimal(line.countedQty),
                sviCostRate: zeroCost ? new client_1.Prisma.Decimal(0) : this.toDecimalColumn(line.costRate),
                sviCostRateWot: zeroCost
                    ? new client_1.Prisma.Decimal(0)
                    : this.toDecimalColumn(line.costRateWot ?? 0),
                sviLandedRate: zeroCost
                    ? new client_1.Prisma.Decimal(0)
                    : this.toDecimalColumn(line.landedRate ?? 0),
                sviTaxPerc: zeroCost ? new client_1.Prisma.Decimal(0) : this.toDecimalColumn(line.taxPerc ?? 0),
                sviLoadRate: rules.allowsLoading
                    ? this.toDecimalColumn(line.loadRate ?? 0).toDecimalPlaces(4, client_1.Prisma.Decimal.ROUND_HALF_UP)
                    : new client_1.Prisma.Decimal(0),
                sviUnloadRate: rules.allowsLoading
                    ? this.toDecimalColumn(line.unloadRate ?? 0).toDecimalPlaces(4, client_1.Prisma.Decimal.ROUND_HALF_UP)
                    : new client_1.Prisma.Decimal(0),
                sviReasonId: line.reasonId ?? null,
                sviDirection: rules.lineDirection === 'REASON' ? (line.direction ?? null) : null,
                sviSyncDate: line.syncDate ? new Date(line.syncDate) : null,
                sviRemarks: line.remarks ?? null,
                sviCreatedBy: this.actorFor(line.createdBy ?? author, actor),
                ...this.lineModifiedByData(line.modifiedBy ?? header.modifiedBy, actor),
            };
        });
        const storedById = new Map((stored ?? []).map((row) => [row.sviId, row]));
        const bookChanges = [];
        if (isCount) {
            lines.forEach((line, index) => {
                const row = line.sviId ? storedById.get(line.sviId) : undefined;
                const next = data[index].sviBookQty;
                if (!row || row.sviBookQty === null || next === null) {
                    return;
                }
                if (!new client_1.Prisma.Decimal(row.sviBookQty).equals(next)) {
                    bookChanges.push({
                        sviId: row.sviId,
                        lineNo: line.lineNo,
                        previousBookQty: (0, module_service_utils_1.toNumber)(row.sviBookQty),
                        bookQty: (0, module_service_utils_1.toNumber)(next),
                    });
                }
            });
        }
        const changed = [];
        const moving = [];
        lines.forEach((line, index) => {
            const row = line.sviId ? storedById.get(line.sviId) : undefined;
            if (!row || !this.lineDiffers(row, data[index])) {
                return;
            }
            changed.push({ sviId: row.sviId, next: data[index], line });
            if (row.sviLineNo !== data[index].sviLineNo || row.sviSplitNo !== data[index].sviSplitNo) {
                moving.push(row.sviId);
            }
        });
        const key = (sviId) => ({ sviId_sviAccYear: { sviId, sviAccYear: header.accYear } });
        for (const [index, sviId] of moving.entries()) {
            await tx.stockVoucherItem.update({
                where: key(sviId),
                data: { sviLineNo: PARKED_LINE_NO + index },
            });
        }
        for (const { sviId, next, line } of changed) {
            const fields = { ...next };
            delete fields.sviCreatedBy;
            await tx.stockVoucherItem.update({
                where: key(sviId),
                data: {
                    ...fields,
                    sviModifiedOn: now,
                    sviModifiedBy: this.actorFor(line.modifiedBy ?? author, actor),
                },
            });
        }
        const inserted = data.filter((_, index) => !lines[index].sviId);
        if (inserted.length) {
            await tx.stockVoucherItem.createMany({ data: inserted });
        }
        return { rows: data, holdings, bookChanges };
    }
    assertLineIds(rules, lines, stored) {
        const errors = [];
        const seen = new Set();
        lines.forEach((line, index) => {
            const id = line.sviId;
            if (!id) {
                return;
            }
            const field = `lines.${index}.sviId`;
            if (stored === null) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_ID_ON_NEW,
                    message: `Line ${line.lineNo} sends line id ${id}, but a new ${rules.displayName.toLowerCase()} has no lines yet. Send it without sviId.`,
                });
            }
            else if (seen.has(id)) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_ID_REPEATED,
                    message: `Line ${line.lineNo} repeats line id ${id}: one stored line cannot become two.`,
                });
            }
            else if (!stored.has(id)) {
                errors.push({
                    field,
                    code: stock_error_codes_1.StockErrorCode.LINE_ID_STALE,
                    message: `Line ${line.lineNo} names line ${id}, which is not a line of this document any more. Reload it and save again.`,
                });
            }
            seen.add(id);
        });
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be saved`, errors);
        }
    }
    lineDiffers(stored, next) {
        const row = stored;
        return Object.entries(next).some(([column, value]) => value !== undefined &&
            column !== 'sviCreatedBy' &&
            column !== 'sviModifiedBy' &&
            !this.sameColumnValue(row[column], value));
    }
    sameColumnValue(left, right) {
        if (left === null || left === undefined || right === null || right === undefined) {
            return (left ?? null) === (right ?? null);
        }
        if (client_1.Prisma.Decimal.isDecimal(left) || client_1.Prisma.Decimal.isDecimal(right)) {
            return new client_1.Prisma.Decimal(left).equals(new client_1.Prisma.Decimal(right));
        }
        if (left instanceof Date && right instanceof Date) {
            return left.getTime() === right.getTime();
        }
        return left === right;
    }
    async loadCountHoldings(tx, header, lines) {
        const lotIds = [...new Set(lines.map((line) => line.lotId).filter((id) => !!id))];
        const rows = lotIds.length
            ? await tx.$queryRaw `
          SELECT sbl.sbl_lot_id,
                 sbl.sbl_item_id,
                 sbl.sbl_godown_id,
                 sbl.sbl_bucket,
                 sbl.sbl_base_uom_id,
                 sbl.sbl_on_hand_qty,
                 sbl.sbl_avg_cost_rate,
                 sbl.sbl_avg_cost_rate_wot,
                 sbl.sbl_batch_no,
                 sbl.sbl_expiry_date,
                 sbl.sbl_mrp,
                 sbl.sbl_sale_price,
                 sbl.sbl_supplier_id,
                 -- stock_balance carries neither, and a count line must still
                 -- reprint what the sheet showed: both live on the lot.
                 slt.slt_mfg_date,
                 slt.slt_serial_no
            FROM stock.stock_balance sbl
            JOIN stock.stock_lot slt ON slt.slt_id = sbl.sbl_lot_id
           WHERE sbl.sbl_company_id = ${header.companyId}::uuid
             AND sbl.sbl_branch_id  = ${header.branchId}::uuid
             AND sbl.sbl_lot_id     = ANY (${lotIds}::uuid[])
             AND sbl.sbl_is_deleted = false
        `
            : [];
        const byHolding = new Map();
        for (const row of rows) {
            byHolding.set(this.holdingKey(row.sbl_lot_id, row.sbl_godown_id, row.sbl_bucket), {
                itemId: row.sbl_item_id,
                baseUomId: row.sbl_base_uom_id,
                bookQty: new client_1.Prisma.Decimal(row.sbl_on_hand_qty ?? 0),
                avgCostRate: new client_1.Prisma.Decimal(row.sbl_avg_cost_rate ?? 0),
                avgCostRateWot: new client_1.Prisma.Decimal(row.sbl_avg_cost_rate_wot ?? 0),
                batchNo: row.sbl_batch_no,
                mfgDate: row.slt_mfg_date,
                expiryDate: row.sbl_expiry_date,
                mrp: row.sbl_mrp,
                salePrice: row.sbl_sale_price,
                serialNo: row.slt_serial_no,
                supplierId: row.sbl_supplier_id,
            });
        }
        const errors = [];
        lines.forEach((line, index) => {
            const holding = byHolding.get(this.holdingKey(line.lotId, line.godownId, line.bucket));
            if (!holding) {
                errors.push({
                    field: `lines.${index}`,
                    code: stock_error_codes_1.StockErrorCode.COUNT_HOLDING_GONE,
                    message: `Line ${line.lineNo} names a holding this godown no longer has — regenerate the count sheet. (Someone may have sold the last of this lot while the count was being taken.)`,
                });
                return;
            }
            if (holding.itemId !== line.itemId) {
                errors.push({
                    field: `lines.${index}`,
                    code: stock_error_codes_1.StockErrorCode.COUNT_HOLDING_OTHER_ITEM,
                    message: `Line ${line.lineNo} names a holding that belongs to another item — regenerate the count sheet.`,
                });
            }
        });
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('This count sheet is out of date', errors);
        }
        return byHolding;
    }
    holdingKey(lotId, godownId, bucket) {
        return `${lotId ?? ''}|${godownId}|${bucket ?? 'SALEABLE'}`;
    }
    async list(rules, query) {
        const limit = this.clamp(query.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
        const offset = Math.max(query.offset ?? 0, 0);
        const rows = await this.prisma.$queryRaw `
      SELECT svh.svh_id,
             svh.svh_acc_year,
             svh.svh_refno,
             svh.svh_usr_refno,
             svh.svh_doc_date,
             svh.svh_to_godown_id,
             gdl.gdl_name AS to_godown_name,
             svh.svh_status,
             svh.svh_line_count,
             svh.svh_total_qty,
             svh.svh_total_value,
             svh.svh_total_value_wot,
             posted.tsl_changed_on AS posted_on,
             svh.svh_rate_source,
             svh.svh_remarks
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations gdl ON gdl.gdl_id = svh.svh_to_godown_id
        -- WHEN it was posted lives on the trail, not on the header. Keyed on
        -- (doc type, doc id, acc year) so ux_tsl_doc_seq serves the lookup; a
        -- re-post after a cancellation appends a second POSTED row, and the
        -- LATEST one is the answer the list wants.
        LEFT JOIN LATERAL (
          SELECT tsl.tsl_changed_on
            FROM public.txn_status_log tsl
           WHERE tsl.tsl_src_doc_type = ${rules.statusDocType}
             AND tsl.tsl_src_doc_id   = svh.svh_id
             AND tsl.tsl_acc_year     = svh.svh_acc_year
             AND tsl.tsl_to_status    = 'POSTED'
             AND tsl.tsl_is_deleted   = false
           ORDER BY tsl.tsl_seq_no DESC
           LIMIT 1
        ) posted ON true
       WHERE svh.svh_company_id   = ${query.companyId}::uuid
         AND svh.svh_branch_id    = ${query.branchId}::uuid
         AND svh.svh_acc_year     = ${query.accYear}::bpchar
         AND svh.svh_voucher_type = ${rules.voucherType}
         AND svh.svh_is_deleted   = false
         AND (${query.status ?? null}::varchar IS NULL OR svh.svh_status = ${query.status ?? null}::varchar)
         AND (${query.fromDate ?? null}::date IS NULL OR svh.svh_doc_date >= ${query.fromDate ?? null}::date)
         AND (${query.toDate ?? null}::date   IS NULL OR svh.svh_doc_date <= ${query.toDate ?? null}::date)
         AND ${(0, loose_search_1.looseSearchSql)(['svh.svh_refno', 'svh.svh_usr_refno'], query.search)}
       ORDER BY svh.svh_doc_date DESC, svh.svh_slno DESC
       LIMIT ${limit} OFFSET ${offset}
    `;
        return {
            items: rows.map((row) => ({
                svhId: row.svh_id,
                accYear: row.svh_acc_year.trim(),
                refno: row.svh_refno,
                usrRefno: row.svh_usr_refno,
                docDate: this.toIsoDate(row.svh_doc_date),
                godownId: row.svh_to_godown_id,
                godownName: row.to_godown_name,
                status: row.svh_status,
                lineCount: row.svh_line_count,
                totalQty: (0, module_service_utils_1.toNumber)(row.svh_total_qty),
                totalValue: (0, module_service_utils_1.toNumber)(row.svh_total_value),
                totalValueWot: (0, module_service_utils_1.toNumber)(row.svh_total_value_wot),
                postedOn: row.posted_on?.toISOString() ?? null,
                rateSource: row.svh_rate_source,
                remarks: row.svh_remarks,
            })),
            meta: { limit, offset, count: rows.length },
        };
    }
    async getById(rules, svhId, accYear, companyId, branchId, client = this.prisma) {
        const [header] = await client.$queryRaw `
      SELECT svh.svh_id,
             svh.svh_acc_year,
             svh.svh_company_id,
             svh.svh_branch_id,
             svh.svh_tenant_id,
             svh.svh_device_id,
             svh.svh_session_id,
             svh.svh_voucher_type,
             svh.svh_slno,
             svh.svh_refno,
             svh.svh_usr_refno,
             svh.svh_doc_date,
             svh.svh_doc_datetime,
             svh.svh_from_godown_id,
             fgd.gdl_name AS from_godown_name,
             svh.svh_to_godown_id,
             tgd.gdl_name AS to_godown_name,
             svh.svh_supplier_id,
             sup.sup_name AS supplier_name,
             svh.svh_to_branch_id,
             tbr.br_name AS to_branch_name,
             svh.svh_party_ref,
             svh.svh_reason_id,
             srm.srm_name AS reason_name,
             svh.svh_link_src_module,
             svh.svh_link_src_doc_type,
             svh.svh_link_src_doc_id,
             svh.svh_link_src_acc_year,
             svh.svh_freeze_stock,
             svh.svh_freeze_from,
             svh.svh_freeze_to,
             svh.svh_sync_date,
             svh.svh_status,
             svh.svh_line_count,
             svh.svh_total_qty,
             svh.svh_total_value,
             svh.svh_total_value_wot,
             posted.tsl_changed_on AS posted_on,
             posted.tsl_changed_by AS posted_by,
             usr.usr_display_name  AS posted_by_name,
             cancelled.tsl_changed_on AS cancelled_on,
             cancelled.tsl_remarks    AS cancel_reason,
             svh.svh_created_on,
             svh.svh_created_by,
             cusr.usr_display_name AS created_by_name,
             svh.svh_modified_on,
             svh.svh_rate_source,
             svh.svh_remarks,
             svh.svh_is_deleted,
             -- Notes 153 — the Loading / Unloading boxes, with the names behind
             -- the ids. A crew keeps its order; an employee gone since reads NULL
             -- in its place rather than shortening the list.
             svh.svh_load_enabled,
             svh.svh_load_datetime,
             svh.svh_loadman_id,
             ARRAY(SELECT e.emp_name
                     FROM unnest(svh.svh_loadman_id) WITH ORDINALITY AS crew(id, ord)
                     LEFT JOIN public.employee_master e ON e.emp_id = crew.id
                    ORDER BY crew.ord) AS loadman_names,
             svh.svh_driver_id,
             drv.emp_name AS driver_name,
             svh.svh_supervisor_id,
             lsv.emp_name AS supervisor_name,
             svh.svh_vehicle_id,
             svh.svh_vehicle_no,
             svh.svh_loading_charge,
             svh.svh_unload_enabled,
             svh.svh_unload_datetime,
             svh.svh_unloadman_id,
             ARRAY(SELECT e.emp_name
                     FROM unnest(svh.svh_unloadman_id) WITH ORDINALITY AS crew(id, ord)
                     LEFT JOIN public.employee_master e ON e.emp_id = crew.id
                    ORDER BY crew.ord) AS unloadman_names,
             svh.svh_unload_supervisor_id,
             usv.emp_name AS unload_supervisor_name,
             svh.svh_unloading_charge
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations fgd ON fgd.gdl_id = svh.svh_from_godown_id
        LEFT JOIN inventory.godown_locations tgd ON tgd.gdl_id = svh.svh_to_godown_id
        LEFT JOIN purchase.suppliers sup ON sup.sup_id = svh.svh_supplier_id
        -- Notes 154 #4 — the branch a transfer goes to, by name.
        LEFT JOIN public.branch_master tbr ON tbr.br_id = svh.svh_to_branch_id
        -- Who posted or cancelled this, when, and why: public.txn_status_log is
        -- the only record of it — the header carries svh_status alone. Both
        -- laterals take the LATEST matching step, so a voucher posted, cancelled
        -- and posted again reads back its current post, not its first.
        LEFT JOIN LATERAL (
          SELECT tsl.tsl_changed_on, tsl.tsl_changed_by
            FROM public.txn_status_log tsl
           WHERE tsl.tsl_src_doc_type = ${rules.statusDocType}
             AND tsl.tsl_src_doc_id   = svh.svh_id
             AND tsl.tsl_acc_year     = svh.svh_acc_year
             AND tsl.tsl_to_status    = 'POSTED'
             AND tsl.tsl_is_deleted   = false
           ORDER BY tsl.tsl_seq_no DESC
           LIMIT 1
        ) posted ON true
        LEFT JOIN LATERAL (
          SELECT tsl.tsl_changed_on, tsl.tsl_remarks
            FROM public.txn_status_log tsl
           WHERE tsl.tsl_src_doc_type = ${rules.statusDocType}
             AND tsl.tsl_src_doc_id   = svh.svh_id
             AND tsl.tsl_acc_year     = svh.svh_acc_year
             AND tsl.tsl_to_status    = 'CANCELLED'
             AND tsl.tsl_is_deleted   = false
           ORDER BY tsl.tsl_seq_no DESC
           LIMIT 1
        ) cancelled ON true
        LEFT JOIN public.user_master usr         ON usr.usr_id = posted.tsl_changed_by
        -- svh_created_by is free TEXT (a user id, a till, an import job), so the
        -- match is on text: a value that is not a uuid finds no user, not a 500.
        LEFT JOIN public.user_master cusr        ON cusr.usr_id::text = svh.svh_created_by
        LEFT JOIN stock.stock_reason_master srm  ON srm.srm_id = svh.svh_reason_id
        LEFT JOIN public.employee_master drv     ON drv.emp_id = svh.svh_driver_id
        LEFT JOIN public.employee_master lsv     ON lsv.emp_id = svh.svh_supervisor_id
        LEFT JOIN public.employee_master usv     ON usv.emp_id = svh.svh_unload_supervisor_id
       WHERE svh.svh_id          = ${svhId}::uuid
         AND svh.svh_acc_year    = ${accYear}::bpchar
         AND svh.svh_company_id  = ${companyId}::uuid
         AND svh.svh_branch_id   = ${branchId}::uuid
         AND svh.svh_voucher_type = ${rules.voucherType}
    `;
        if (!header) {
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear} for this company and branch.`, stock_error_codes_1.StockErrorCode.VOUCHER_NOT_FOUND);
        }
        const identityFromLot = rules.requiresLot === true;
        const lines = await client.$queryRaw `
      SELECT svi.svi_id,
             svi.svi_line_no,
             svi.svi_split_no,
             svi.svi_item_id,
             itm.item_code,
             itm.item_name_en AS item_name,
             unt.unit_name,
             svi.svi_uom_id,
             svi.svi_base_uom_id,
             svi.svi_to_base_factor,
             svi.svi_godown_id,
             gdl.gdl_name AS godown_name,
             svi.svi_bucket,
             svi.svi_to_bucket,
             svi.svi_barcode,
             COALESCE(lot.slt_batch_no, svi.svi_batch_no)       AS svi_batch_no,
             COALESCE(lot.slt_mfg_date, svi.svi_mfg_date)       AS svi_mfg_date,
             COALESCE(lot.slt_expiry_date, svi.svi_expiry_date) AS svi_expiry_date,
             COALESCE(lot.slt_mrp, svi.svi_mrp)                 AS svi_mrp,
             COALESCE(lot.slt_sale_price, svi.svi_sale_price)   AS svi_sale_price,
             COALESCE(lot.slt_serial_no, svi.svi_serial_no)     AS svi_serial_no,
             svi.svi_supplier_id,
             sup.sup_name AS line_supplier_name,
             svi.svi_qty,
             svi.svi_base_qty,
             svi.svi_free_qty,
             svi.svi_free_base_qty,
             svi.svi_weight_qty,
             svi.svi_book_qty,
             svi.svi_counted_qty,
             svi.svi_diff_qty,
             svi.svi_cost_rate,
             svi.svi_cost_rate_wot,
             svi.svi_landed_rate,
             svi.svi_tax_perc,
             svi.svi_reason_id,
             srm.srm_name AS line_reason_name,
             svi.svi_direction,
             svi.svi_sync_date,
             svi.svi_value,
             svi.svi_value_wot,
             svi.svi_lot_id,
             svi.svi_remarks,
             svi.svi_load_rate,
             svi.svi_unload_rate,
             -- Which identity cells the line may open, as /stock/opening/item-lookup
             -- answers it: the effective policy on the DOCUMENT's date, the one
             -- the preflight and the post key the lot by. Saves the screen a
             -- lookup per distinct item after every load (notes 66).
             COALESCE(stp.stp_track_signature, 'N') AS track_signature,
             -- Addendum 2 E2: the size / colour / model this line's auto
             -- batch carries, by the row the line wrote — retired rows too,
             -- matched on the batch the line still holds, so a cancelled
             -- draft (notes 149 #3) still reads what was keyed while a line
             -- whose batch was typed over since shows nothing. Notes 151 #8:
             -- a line that wrote no row (an adjustment, a count, an issue
             -- naming a batch an opening numbered) reads the batch's LIVE
             -- row by company + item + folded batch instead.
             sbd.sbd_size_id,
             isz.isz_name AS size_name,
             sbd.sbd_colour_id,
             icl.icl_name AS colour_name,
             sbd.sbd_model
        FROM stock.stock_voucher_item svi
        JOIN inventory.item_master itm            ON itm.item_id = svi.svi_item_id
        -- Joined on a transfer only (E5 above); elsewhere every lot.* is NULL.
        LEFT JOIN stock.stock_lot lot             ON ${identityFromLot}::boolean
                                                 AND lot.slt_id = svi.svi_lot_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = svi.svi_uom_id
        LEFT JOIN inventory.item_unit_master unt  ON unt.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.godown_locations gdl  ON gdl.gdl_id = svi.svi_godown_id
        LEFT JOIN stock.stock_reason_master srm   ON srm.srm_id = svi.svi_reason_id
        LEFT JOIN purchase.suppliers sup          ON sup.sup_id = svi.svi_supplier_id
        LEFT JOIN LATERAL (
          SELECT d.sbd_size_id, d.sbd_colour_id, d.sbd_model
            FROM stock.stock_batch_detail d
           WHERE d.sbd_batch_no = upper(btrim(COALESCE(lot.slt_batch_no, svi.svi_batch_no)))
             AND (d.sbd_src_line_id = svi.svi_id
                  OR (d.sbd_company_id = ${companyId}::uuid
                      AND d.sbd_item_id = svi.svi_item_id
                      AND d.sbd_is_deleted = false))
           -- The line's own row first (retired or not), else the live one.
           ORDER BY (d.sbd_src_line_id = svi.svi_id) DESC NULLS LAST, d.sbd_is_deleted
           LIMIT 1
        ) sbd ON true
        LEFT JOIN inventory.item_size_master isz   ON isz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
        ${(0, stock_voucher_posting_helper_1.effectivePolicyLateral)({
            companyId: client_1.Prisma.sql `${companyId}::uuid`,
            branchId: client_1.Prisma.sql `${branchId}::uuid`,
            itemId: client_1.Prisma.raw('svi.svi_item_id'),
            itemGroupId: client_1.Prisma.raw('itm.item_group_id'),
            onDate: client_1.Prisma.sql `${this.toIsoDate(header.svh_doc_date)}::date`,
        })}
       WHERE svi.svi_voucher_id = ${svhId}::uuid
         AND svi.svi_acc_year   = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
       ORDER BY svi.svi_line_no, svi.svi_split_no
    `;
        return {
            header: this.toHeaderPayload(header, rules),
            lines: lines.map((row) => this.toLinePayload(row, rules)),
        };
    }
    async validate(rules, svhId, accYear, companyId, branchId, tx) {
        await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId, tx);
        const isCount = rules.quantityMode === 'COUNT';
        const canPick = rules.postShape === 'SIMPLE' && rules.quantityMode === 'QTY';
        return (tx ?? this.prisma).$queryRaw `
      WITH doc AS (
        SELECT svh.svh_id,
               svh.svh_acc_year,
               svh.svh_company_id,
               svh.svh_branch_id,
               svh.svh_doc_date,
               svh.svh_doc_datetime,
               svh.svh_rate_source,
               svh.svh_reason_id
          FROM stock.stock_voucher svh
         WHERE svh.svh_id       = ${svhId}::uuid
           AND svh.svh_acc_year = ${accYear}::bpchar
      ),
      line AS (
        -- svh_doc_datetime rides along for the freeze check below: the window
        -- is tested against the MOVEMENT's timestamp, not now().
        SELECT svi.*, doc.svh_doc_date, doc.svh_doc_datetime, doc.svh_rate_source,
               doc.svh_company_id, doc.svh_branch_id, doc.svh_reason_id
          FROM stock.stock_voucher_item svi
          JOIN doc ON doc.svh_id = svi.svi_voucher_id AND doc.svh_acc_year = svi.svi_acc_year
         WHERE svi.svi_is_deleted = false
      ),
      -- The effective policy, most-specific-first, resolved against the
      -- DOCUMENT's date and not today's — see the StockTrackPolicy model note.
      -- No row at all is a complete answer: track nothing, WAVG, FEFO, ALLOW.
      -- THE SAME FRAGMENT THE POST USES (stock-voucher-posting.helper), so the
      -- preflight and the engine cannot disagree about which policy applies.
      ${(0, stock_voucher_posting_helper_1.effectivePolicyCte)()},
      -- The identity the post will key on: each dimension blanked when the
      -- policy does not track it, then collapsed to the same sentinels
      -- ux_slt_identity is built over ('~', -1, 0001-01-01, the nil uuid),
      -- batch and serial folded the way the generated key columns fold them.
      keyed AS (
        SELECT line.*,
               policy.track_batch, policy.track_mrp, policy.track_sale_price,
               policy.track_expiry, policy.track_serial, policy.track_supplier,
               policy.issue_strategy,
               ${(0, stock_voucher_posting_helper_1.lotIdentityKeyColumns)()},
               ${(0, stock_voucher_posting_helper_1.lineDirectionColumn)(rules)}
          FROM line
          JOIN policy ON policy.svi_id = line.svi_id
          ${(0, stock_voucher_posting_helper_1.lineReasonJoin)()}
      ),
      -- §1.4 — an OUTWARD line of a lot-tracked item that names no lot and no
      -- complete identity is not refused for the missing dimension: the post
      -- PICKS its lots by the item's issue strategy (FEFO / FIFO / LIFO) from
      -- what the godown holds. What the preflight checks instead is that there
      -- IS something to pick from, and that the strategy is not MANUAL.
      pick AS (
        SELECT keyed.svi_id,
               (${canPick}::boolean AND keyed.line_direction < 0 AND ${(0, stock_voucher_posting_helper_1.lotlessOutwardLine)()}) AS pickable,
               -- Stock the PICK could issue from: narrowed by whatever identity
               -- the line stated, exactly as pickIssueLots narrows (notes 93),
               -- so the preflight and the post agree about "nothing to pick".
               EXISTS (
                 SELECT 1
                   FROM stock.stock_balance pb
                   JOIN stock.stock_lot pl ON pl.slt_id = pb.sbl_lot_id AND pl.slt_is_deleted = false
                  WHERE pb.sbl_company_id = keyed.svh_company_id
                    AND pb.sbl_branch_id  = keyed.svh_branch_id
                    AND pb.sbl_godown_id  = keyed.svi_godown_id
                    AND pb.sbl_item_id    = keyed.svi_item_id
                    AND pb.sbl_bucket     = keyed.svi_bucket
                    AND pb.sbl_is_deleted = false
                    AND pb.sbl_available_qty > 0
                    AND pl.slt_status IN ('ACTIVE', 'CLOSED')
                    AND ${(0, stock_voucher_posting_helper_1.issueNarrowing)('pl', {
            trackBatch: client_1.Prisma.raw('keyed.track_batch'),
            trackMrp: client_1.Prisma.raw('keyed.track_mrp'),
            trackSalePrice: client_1.Prisma.raw('keyed.track_sale_price'),
            trackExpiry: client_1.Prisma.raw('keyed.track_expiry'),
            trackSerial: client_1.Prisma.raw('keyed.track_serial'),
            trackSupplier: client_1.Prisma.raw('keyed.track_supplier'),
            keyBatch: client_1.Prisma.raw('keyed.key_batch'),
            keyMrp: client_1.Prisma.raw('keyed.key_mrp'),
            keySp: client_1.Prisma.raw('keyed.key_sp'),
            keyExpiry: client_1.Prisma.raw('keyed.key_expiry'),
            keySerial: client_1.Prisma.raw('keyed.key_serial'),
            keySupplier: client_1.Prisma.raw('keyed.key_supplier'),
        })}
               ) AS has_stock
          FROM keyed
      ),
      -- Has this holding already been opened this year? Matched through the
      -- lot's generated key columns and the OPENING rows in the ledger, NOT
      -- through the documents: a cancelled opening is reversed in the ledger
      -- and must correctly read as "not opened".
      --
      -- A HOLDING IS godown × lot × BUCKET — stock_balance's grain, and the
      -- count's. 40 SALEABLE opened on one document and the 5 crushed ones
      -- opened DAMAGED on a second are two holdings, not a repeat; before
      -- 2026-09-30 (notes 66) the bucket was not matched and the second
      -- document was refused, though keying both on one document passed.
      opened AS (
        SELECT keyed.svi_id,
               -- Gated INSIDE the CASE rather than by omitting the CTE: a
               -- CASE whose condition is a constant false never evaluates the
               -- EXISTS, so a count pays nothing for the expensive half while
               -- the query stays one statement.
               --
               -- A HOLDING MAY BE COUNTED ANY NUMBER OF TIMES, each posting its
               -- own variance from the then-current book figure, so this branch
               -- must be off for a count. Left on it would refuse the second
               -- count of every holding — which is also the ordinary answer to
               -- "the counter miscounted".
               CASE WHEN ${!rules.allowsRepeatHolding}::boolean THEN EXISTS (
                 SELECT 1
                   FROM stock.stock_lot slt
                   JOIN stock.stock_ledger sml ON sml.sml_lot_id = slt.slt_id
                  WHERE slt.slt_company_id  = keyed.svh_company_id
                    AND slt.slt_item_id     = keyed.svi_item_id
                    AND slt.slt_key_batch    = keyed.key_batch
                    AND slt.slt_key_mrp      = keyed.key_mrp
                    AND slt.slt_key_sp       = keyed.key_sp
                    AND slt.slt_key_expiry   = keyed.key_expiry
                    AND slt.slt_key_serial   = keyed.key_serial
                    AND slt.slt_key_supplier = keyed.key_supplier
                    AND sml.sml_company_id  = keyed.svh_company_id
                    AND sml.sml_branch_id   = keyed.svh_branch_id
                    AND sml.sml_acc_year    = keyed.svi_acc_year
                    AND sml.sml_godown_id   = keyed.svi_godown_id
                    AND sml.sml_bucket      = keyed.svi_bucket
                    AND sml.sml_txn_type    = 'OPENING'
                    -- LIVE, FORWARD AND NOT REVERSED. A cancel leaves the
                    -- original row where it is and mirrors it; reading the
                    -- forward side alone made a cancelled opening hold its
                    -- holding for ever. See unreversedLedgerRow.
                    AND ${(0, stock_voucher_posting_helper_1.unreversedLedgerRow)()}
                    AND sml.sml_src_doc_id <> keyed.svi_voucher_id
               ) ELSE false END AS already_opened
          FROM keyed
      ),
      -- §3.5 — THE DRIFT CHECK, and the count's version of "already opened".
      --
      -- svi_book_qty is a snapshot taken when the sheet was generated. A sheet
      -- generated at 18:00 and posted at 23:00 has a book figure that may no
      -- longer be true, and the difference posted is then the difference
      -- between two moments rather than a variance. With the freeze on (§11)
      -- this should never fire; it is what tells you the freeze is not working.
      bal AS (
        SELECT keyed.svi_id,
               sbl.sbl_on_hand_qty
          FROM keyed
          LEFT JOIN stock.stock_balance sbl
                 ON sbl.sbl_company_id = keyed.svh_company_id
                AND sbl.sbl_branch_id  = keyed.svh_branch_id
                AND sbl.sbl_godown_id  = keyed.svi_godown_id
                AND sbl.sbl_item_id    = keyed.svi_item_id
                AND sbl.sbl_lot_id     = keyed.svi_lot_id
                AND sbl.sbl_bucket     = keyed.svi_bucket
                AND sbl.sbl_is_deleted = false
      ),
      -- §11 — THE FREEZE, SEEN BEFORE THE POST. tr_sml_freeze_guard refuses the
      -- ledger row regardless, but as one 409 for the whole document; this
      -- names the line and the count that holds the shelf. A count never trips
      -- over its own freeze, and a second DRAFT count of the same godown is
      -- refused by the first's — one sheet holds a shelf at a time.
      --
      -- THE WINDOW IS TESTED AGAINST svh_doc_datetime, NOT now(), and that
      -- changed on 2026-09-21. The old rule was wall clock, matching the
      -- dropped fn_sml_freeze_guard — but the till posts OFFLINE and pushes on
      -- reconnect, so wall clock refuses a sale made at 10:00, before the count
      -- began, that arrives at 14:00 during it. The shelf was already short
      -- when the counter started counting; the count reconciles it. A movement
      -- that HAPPENED inside the window is still refused.
      -- offline-sync-invariants.md §7b, and StockPostingService.assertNotFrozen
      -- is the other half of the same rule.
      frozen AS (
        SELECT keyed.svi_id,
               f.svh_refno     AS frozen_by,
               f.svh_freeze_to AS frozen_until
          FROM keyed
          LEFT JOIN LATERAL (
            SELECT svh.svh_refno, svh.svh_freeze_to
              FROM stock.stock_voucher svh
             WHERE svh.svh_voucher_type = 'PHYSICAL'
               AND svh.svh_freeze_stock = true
               AND svh.svh_status       = 'DRAFT'
               AND svh.svh_is_deleted   = false
               AND svh.svh_company_id   = keyed.svh_company_id
               AND svh.svh_branch_id    = keyed.svh_branch_id
               AND COALESCE(svh.svh_from_godown_id, svh.svh_to_godown_id) = keyed.svi_godown_id
               -- THE MOVEMENT'S OWN TIMESTAMP, not now(). See the note above.
               AND keyed.svh_doc_datetime BETWEEN svh.svh_freeze_from AND svh.svh_freeze_to
               AND svh.svh_id <> keyed.svi_voucher_id
             LIMIT 1
          ) f ON true
      )
      SELECT keyed.svi_id                             AS "sviId",
             keyed.svi_line_no                        AS "lineNo",
             keyed.svi_split_no                       AS "splitNo",
             keyed.svi_item_id                        AS "itemId",
             itm.item_code                            AS "itemCode",
             itm.item_name_en                         AS "itemName",
             CASE
               -- ── Notes 143 #5: the line's item and godown are the document's ──
               -- Stored as sent, and until now checked only by the item lookup
               -- and the CSV import: a line could open stock in another
               -- branch's godown, or of another company's item, or of a service.
               -- A blank company / branch on an item means shared (notes 73).
               -- Inactive is refused only on stock a SIMPLE document brings IN
               -- (an opening, an adjustment in): an outward line may still clear
               -- what a retired item or godown holds, and a transfer receipt or
               -- a bucket move only relocates stock that already exists.
               WHEN itm.item_company_id IS NOT NULL AND itm.item_company_id <> keyed.svh_company_id
                 THEN 'this item belongs to another company'
               -- Another branch's own item is refused where the item lookup
               -- refuses it, on a SIMPLE document; a transfer receipt lands a
               -- branch-specific item the despatching branch was free to send.
               WHEN ${rules.postShape === 'SIMPLE'}::boolean
                    AND itm.item_branch_id IS NOT NULL AND itm.item_branch_id <> keyed.svh_branch_id
                 THEN 'this item belongs to another branch'
               WHEN COALESCE(itm.item_is_service, false)
                 THEN 'this is a service item; a service has no stock'
               WHEN ${rules.postShape === 'SIMPLE'}::boolean AND keyed.line_direction > 0
                    AND (itm.item_is_deleted OR NOT itm.item_is_active)
                 THEN 'this item is inactive or deleted'
               WHEN gdl.gdl_id IS NULL OR COALESCE(gdl.gdl_is_deleted, false)
                    OR gdl.gdl_branch_id IS DISTINCT FROM keyed.svh_branch_id
                 THEN 'this godown is not one of this branch''s godowns'
               WHEN ${rules.postShape === 'SIMPLE'}::boolean AND keyed.line_direction > 0
                    AND NOT COALESCE(gdl.gdl_is_active, true)
                 THEN 'this godown is inactive'
               -- Notes 151 #7 — a line that NAMES its lot names one that exists,
               -- of this company and of this item. A valid lot of another
               -- company's (shared) item used to resolve straight through the
               -- engine's l.slt_id = svi_lot_id join; the adjustment screen checks
               -- the same three, and every type that posts a named lot gets
               -- them here.
               WHEN keyed.svi_lot_id IS NOT NULL AND nl.slt_id IS NULL
                 THEN 'this line names a lot that does not exist'
               WHEN keyed.svi_lot_id IS NOT NULL AND nl.slt_company_id <> keyed.svh_company_id
                 THEN 'this line names a lot that belongs to another company'
               WHEN keyed.svi_lot_id IS NOT NULL AND nl.slt_item_id <> keyed.svi_item_id
                 THEN 'this line names a lot that belongs to a different item'

               -- OPENING-ONLY, AND IT INVERTS UNDER COUNT. A count sends
               -- svi_qty 0 on every line, always; ungated this branch reports a
               -- problem on every line of every count sheet ever taken.
               WHEN ${rules.quantityMode === 'QTY'}::boolean
                    AND keyed.svi_qty = 0 AND keyed.svi_free_qty = 0
                 THEN 'this line has no quantity'

               -- ── The four PHYSICAL branches ────────────────────────────────
               -- ABSENT IS NOT "0 FOUND", it is NOT COUNTED YET, and posting an
               -- uncounted line as a total shortage is the most expensive
               -- mistake this screen can make. Refused at save too; caught
               -- again here because a sheet can be edited between the two.
               WHEN ${isCount}::boolean AND keyed.svi_counted_qty IS NULL
                 THEN 'this line has not been counted yet'
               WHEN ${isCount}::boolean
                    AND keyed.svi_book_qty IS DISTINCT FROM COALESCE(bal.sbl_on_hand_qty, 0)
                 THEN 'the book quantity has changed since this sheet was generated'
               -- Only an OVERAGE needs a rate from the document: a shortage is
               -- relieved at what the stock cost us, stamped by
               -- fn_sml_cost_default. Which lines are which is knowable only
               -- here, because svi_diff_qty is GENERATED.
               WHEN ${isCount}::boolean AND keyed.svi_diff_qty > 0
                    AND COALESCE(keyed.svh_rate_source, '') <> ALL (${stock_voucher_types_1.DERIVABLE_RATE_SOURCES}::text[])
                 THEN 'this line found stock and the document names no rate source the engine can derive one from'
               WHEN ${isCount}::boolean AND keyed.svi_diff_qty > 0
                    AND keyed.svh_rate_source = 'AVG_COST'
                    AND sic.sic_avg_cost_rate IS NULL
                 THEN 'the rate source is AVG_COST and this item has no average cost yet'

               WHEN iuc.iuc_id IS NULL OR iuc.iuc_item_id <> keyed.svi_item_id
                 THEN 'the unit does not belong to this item'
               -- Notes 143 #3. The base unit is the conversion row the keyed
               -- unit converts INTO (its iuc_base_unit_id) — the same pointer
               -- the item lookup follows — and of this item.
               WHEN bu.iuc_id IS NULL OR bu.iuc_item_id <> keyed.svi_item_id
                    OR bu.iuc_unit_id IS DISTINCT FROM iuc.iuc_base_unit_id
                 THEN 'the base unit is not this item''s base unit'
               -- What the ledger moves is svi_base_qty; a draft saved before the
               -- save-time rule could still hold one that is not qty × factor.
               WHEN ${rules.quantityMode === 'QTY'}::boolean
                    AND (keyed.svi_base_qty <> round(keyed.svi_qty * keyed.svi_to_base_factor, 6)
                         OR keyed.svi_free_base_qty <> round(keyed.svi_free_qty * keyed.svi_to_base_factor, 6))
                 THEN 'the base quantity is not quantity × factor'
               WHEN pick.pickable AND upper(keyed.issue_strategy) = 'MANUAL'
                 THEN 'the issue strategy for this item is MANUAL: the line must name the lot it issues from'
               WHEN pick.pickable AND NOT pick.has_stock
                 THEN 'this line names no lot and the godown holds no stock of the item matching what the line states to issue from'
               -- A line that NAMES its lot (a transfer, a count) carries the
               -- holding's identity by reference; the six dimensions are the
               -- engine's to resolve only when it does not.
               -- Notes 143 #7: batch and serial blank AFTER TRIMMING, as the lot
               -- key folds them — "  " used to pass here and open the no-batch
               -- lot. And an MRP of 0 is no MRP: the item lookup seeds 0 when
               -- there is no price row, which opened an "MRP 0" lot.
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_batch      AND COALESCE(btrim(keyed.svi_batch_no), '') = ''
                 THEN 'this item is batch-tracked and the line has no batch number'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_expiry     AND keyed.svi_expiry_date IS NULL
                 THEN 'this item is expiry-tracked and the line has no expiry date'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_mrp        AND COALESCE(keyed.svi_mrp, 0) <= 0
                 THEN 'this item is MRP-tracked and the line has no MRP (0 is not an MRP)'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_sale_price AND keyed.svi_sale_price IS NULL
                 THEN 'this item is sale-price-tracked and the line has no sale price'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_serial     AND COALESCE(btrim(keyed.svi_serial_no), '') = ''
                 THEN 'this item is serial-tracked and the line has no serial number'
               WHEN keyed.svi_lot_id IS NULL AND NOT pick.pickable AND keyed.track_supplier   AND keyed.svi_supplier_id IS NULL
                 THEN 'this item is supplier-tracked and the line has no supplier'
               -- A receipt's cost is the transit row's, stamped when the goods
               -- left (§1.1); its line carries none and needs no rate source.
               WHEN ${rules.postShape !== 'TRANSFER_IN'}::boolean AND keyed.line_direction > 0 AND keyed.svi_cost_rate = 0
                    AND COALESCE(keyed.svh_rate_source, '') <> ALL (${stock_voucher_types_1.DERIVABLE_RATE_SOURCES}::text[])
                 THEN 'this line brings stock in with no cost rate and no rate source the engine can derive one from'
               -- Document-wide, and therefore QTY-only: a count whose every
               -- line is a shortage needs no average at all, and refusing it
               -- for want of one would refuse the shrinkage sheet that is the
               -- commonest count there is. Its COUNT counterpart above fires
               -- per line, on the overages alone.
               WHEN ${!isCount}::boolean
                    AND keyed.svh_rate_source = 'AVG_COST' AND sic.sic_avg_cost_rate IS NULL
                 THEN 'the rate source is AVG_COST and this item has no average cost yet'
               WHEN opened.already_opened
                 THEN 'this holding already has an opening in this year'
               WHEN frozen.frozen_by IS NOT NULL
                 THEN 'this godown is frozen for physical count ' || frozen.frozen_by
                      || ' until ' || to_char(frozen.frozen_until, ${ist_clock_util_1.IST_CLOCK_SQL_FORMAT})
               ELSE NULL
             END                                      AS "problem"
        FROM keyed
        JOIN pick   ON pick.svi_id   = keyed.svi_id
        JOIN opened ON opened.svi_id = keyed.svi_id
        JOIN bal    ON bal.svi_id    = keyed.svi_id
        JOIN frozen ON frozen.svi_id = keyed.svi_id
        JOIN inventory.item_master itm ON itm.item_id = keyed.svi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = keyed.svi_uom_id
        LEFT JOIN inventory.item_unit_conversion bu  ON bu.iuc_id  = keyed.svi_base_uom_id
        LEFT JOIN inventory.godown_locations gdl     ON gdl.gdl_id = keyed.svi_godown_id
        -- The lot a line names (notes 151 #7); a deleted lot reads as none.
        LEFT JOIN stock.stock_lot nl
               ON nl.slt_id = keyed.svi_lot_id AND nl.slt_is_deleted = false
        LEFT JOIN stock.stock_item_cost sic
               ON sic.sic_company_id = keyed.svh_company_id
              AND sic.sic_branch_id  = keyed.svh_branch_id
              AND sic.sic_item_id    = keyed.svi_item_id
              AND sic.sic_is_deleted = false
       ORDER BY keyed.svi_line_no, keyed.svi_split_no
    `;
    }
    async assertPostable(rules, svhId, accYear, companyId, branchId, tx) {
        const problems = (await this.validate(rules, svhId, accYear, companyId, branchId, tx)).filter((row) => row.problem !== null);
        if (problems.length) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be posted`, problems.map((row) => ({
                field: `lines.${row.lineNo}`,
                code: stock_error_codes_1.StockErrorCode.LINE_NOT_POSTABLE,
                message: `Line ${row.lineNo}${row.splitNo > 1 ? ` split ${row.splitNo}` : ''} (${row.itemName}): ${row.problem}`,
            })));
        }
    }
    async post(rules, svhId, accYear, companyId, branchId, userId, hooks) {
        const { beforePost, afterPost } = typeof hooks === 'function' ? { afterPost: hooks } : (hooks ?? {});
        const actor = this.actorOf(userId);
        const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        this.assertDraft(rules, existing);
        const postedOn = new Date();
        const rowsPosted = await this.prisma.$transaction(async (tx) => {
            const locked = await this.loadForWrite(tx, rules, svhId, accYear, companyId, branchId);
            this.assertDraft(rules, locked);
            this.assertDocDateInYear(rules, locked.docDate, accYear);
            await this.lockForPreflight(tx, rules, svhId, accYear);
            await beforePost?.(tx, svhId);
            await this.assertPostable(rules, svhId, accYear, companyId, branchId, tx);
            const posted = await this.stockPosting.post(tx, new stock_voucher_source_1.StockVoucherSource({ svhId, accYear, companyId, branchId, rules }), { actor, postedOn });
            await afterPost?.(tx, posted.rowsPosted, svhId);
            await this.logStatusChange(tx, {
                rules,
                svhId,
                accYear,
                companyId,
                branchId,
                tenantId: existing.svhTenantId ?? null,
                refno: existing.svhRefno,
                fromStatus: existing.svhStatus,
                toStatus: posted.status,
                actor,
                changedOn: postedOn,
                remarks: posted.status === 'IN_TRANSIT'
                    ? `${rules.displayName} despatched — ${posted.rowsPosted} ledger rows, ${posted.transitRows} lines in transit`
                    : `${rules.displayName} posted — ${posted.rowsPosted} ledger rows`,
                deviceId: existing.svhDeviceId,
                sessionId: existing.svhSessionId,
            });
            if (posted.closedOut) {
                await this.logStatusChange(tx, {
                    rules,
                    svhId: posted.closedOut.svhId,
                    accYear: posted.closedOut.accYear,
                    companyId,
                    branchId,
                    tenantId: existing.svhTenantId ?? null,
                    refno: posted.closedOut.refno,
                    fromStatus: 'IN_TRANSIT',
                    toStatus: 'RECEIVED',
                    actor,
                    changedOn: postedOn,
                    remarks: `Closed by receipt ${existing.svhRefno}`,
                });
            }
            return posted.rowsPosted;
        });
        const document = await this.getById(rules, svhId, accYear, companyId, branchId);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: STOCK_VOUCHER_TABLE_NAME,
            screenName: rules.auditScreenName,
            screenType: 'transaction',
            pk: svhId,
            displayName: document.header.refno,
            originalRecord: { svhId, svhStatus: 'DRAFT' },
            modifiedRecord: { svhId, svhStatus: document.header.status, rowsPosted },
            userId: actor,
            notes: `${rules.displayName} posted — ${rowsPosted} ledger rows`,
        });
        return {
            ...document,
            rowsPosted,
            status: document.header.status,
            postedOn: document.header.postedOn,
        };
    }
    async cancel(rules, svhId, accYear, reason, companyId, branchId, userId) {
        const actor = this.actorOf(userId);
        const trimmedReason = reason?.trim();
        if (!trimmedReason) {
            (0, module_service_utils_1.throwStockUnprocessable)('Cancellation needs a reason', [
                {
                    field: 'reason',
                    code: stock_error_codes_1.StockErrorCode.CANCEL_REASON_REQUIRED,
                    message: 'A cancelled document with no reason is unanswerable three months later.',
                },
            ]);
        }
        const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        if (existing.svhStatus === 'CANCELLED') {
            const cancelStep = await this.findLastStatusStep(rules, svhId, accYear, 'CANCELLED');
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} already cancelled`, [
                {
                    field: 'svhId',
                    code: stock_error_codes_1.StockErrorCode.VOUCHER_ALREADY_CANCELLED,
                    message: `${existing.svhRefno} was cancelled on ${cancelStep?.tslChangedOn.toISOString() ?? 'an earlier date'}.`,
                },
            ]);
        }
        const isDraft = existing.svhStatus === 'DRAFT';
        const isTransfer = rules.postShape === 'TRANSFER_OUT' || rules.postShape === 'TRANSFER_IN';
        if (isDraft && isTransfer) {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is a draft`, [
                {
                    field: 'svhId',
                    code: stock_error_codes_1.StockErrorCode.VOUCHER_DRAFT_NOT_CANCELLABLE,
                    message: `${existing.svhRefno} is DRAFT and has moved no stock of its own, so there is nothing to reverse. Delete it instead — cancelling it would strand the despatch it settles.`,
                },
            ]);
        }
        const cancelledOn = new Date();
        const rowsReversed = await this.prisma.$transaction(async (tx) => {
            let reversed;
            if (isDraft) {
                reversed = await (0, stock_voucher_posting_helper_1.cancelDraftVoucher)(tx, {
                    rules,
                    svhId,
                    accYear,
                    actor,
                    reason: trimmedReason,
                    cancelledOn,
                });
                await (0, batch_detail_helper_1.softDeleteBatchDetailsOf)(tx, svhId, this.auditActor(actor));
            }
            else {
                if (rules.quantityMode === 'COUNT') {
                    await this.assertCountNotSuperseded(tx, svhId, accYear, existing.svhRefno);
                }
                reversed = await this.stockPosting.cancel(tx, new stock_voucher_source_1.StockVoucherSource({ svhId, accYear, companyId, branchId, rules }), { actor, reason: trimmedReason, cancelledOn, refuseNegative: true });
            }
            await this.logStatusChange(tx, {
                rules,
                svhId,
                accYear,
                companyId,
                branchId,
                tenantId: existing.svhTenantId ?? null,
                refno: existing.svhRefno,
                fromStatus: existing.svhStatus,
                toStatus: 'CANCELLED',
                actor,
                changedOn: cancelledOn,
                remarks: trimmedReason,
                deviceId: existing.svhDeviceId,
                sessionId: existing.svhSessionId,
            });
            return reversed;
        });
        const document = await this.getById(rules, svhId, accYear, companyId, branchId);
        await this.auditLogService.logEntityChange({
            action: 'cancel',
            tableName: STOCK_VOUCHER_TABLE_NAME,
            screenName: rules.auditScreenName,
            screenType: 'transaction',
            pk: svhId,
            displayName: document.header.refno,
            originalRecord: { svhId, svhStatus: existing.svhStatus },
            modifiedRecord: { svhId, svhStatus: document.header.status, rowsReversed },
            userId: actor,
            notes: isDraft
                ? `${rules.displayName} draft cancelled: ${trimmedReason}`
                : `${rules.displayName} cancelled: ${trimmedReason}`,
        });
        return {
            ...document,
            rowsReversed,
            status: document.header.status,
            cancelledOn: document.header.cancelledOn,
        };
    }
    async softDelete(rules, svhId, accYear, companyId, branchId, userId) {
        const actor = this.actorOf(userId);
        const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        if (existing.svhStatus !== 'DRAFT') {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is ${existing.svhStatus}`, [
                {
                    field: 'svhId',
                    code: stock_error_codes_1.StockErrorCode.VOUCHER_NOT_DELETABLE,
                    message: existing.svhStatus === 'CANCELLED'
                        ?
                            `${existing.svhRefno} is already cancelled, which is as far out of play as a document goes. There is nothing left to delete.`
                        : `${existing.svhRefno} is ${existing.svhStatus} and has ledger rows. Cancel it — a cancellation reverses the movement; a soft delete would only hide the document while its stock stayed.`,
                },
            ]);
        }
        const modifiedOn = new Date();
        await this.prisma.$transaction(async (tx) => {
            await tx.stockVoucher.update({
                where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
                data: {
                    svhIsDeleted: true,
                    svhModifiedOn: modifiedOn,
                    svhModifiedBy: this.auditActor(actor),
                },
            });
            await tx.stockVoucherItem.updateMany({
                where: { sviVoucherId: svhId, sviAccYear: accYear },
                data: {
                    sviIsDeleted: true,
                    sviModifiedOn: modifiedOn,
                    sviModifiedBy: this.auditActor(actor),
                },
            });
            await (0, batch_detail_helper_1.softDeleteBatchDetailsOf)(tx, svhId, this.auditActor(actor));
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: STOCK_VOUCHER_TABLE_NAME,
                screenName: rules.auditScreenName,
                screenType: 'transaction',
                pk: svhId,
                displayName: existing.svhRefno,
                originalRecord: { svhId, svhIsDeleted: false, svhStatus: existing.svhStatus },
                modifiedRecord: { svhId, svhIsDeleted: true, svhStatus: existing.svhStatus },
                userId: actor,
                notes: `${rules.displayName} draft soft deleted`,
            }, tx);
            await this.logStatusChange(tx, {
                rules,
                svhId,
                accYear,
                companyId,
                branchId,
                tenantId: existing.svhTenantId ?? null,
                refno: existing.svhRefno,
                fromStatus: existing.svhStatus,
                toStatus: existing.svhStatus,
                event: txn_status_log_helper_1.TxnStatusEvent.DELETED,
                actor,
                changedOn: modifiedOn,
                remarks: `${rules.displayName} draft deleted`,
                deviceId: existing.svhDeviceId,
                sessionId: existing.svhSessionId,
            });
        });
        return { svhId, accYear, deleted: true };
    }
    async importLines(rules, svhId, accYear, companyId, branchId, csvText, userId) {
        const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        this.assertDraft(rules, existing);
        const header = await this.prisma.stockVoucher.findUnique({
            where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
            select: {
                svhDeviceId: true,
                svhSessionId: true,
                svhTenantId: true,
                svhDocDate: true,
                svhFromGodownId: true,
                svhToGodownId: true,
                svhSupplierId: true,
                svhUsrRefno: true,
                svhRateSource: true,
                svhRemarks: true,
                svhSlno: true,
                svhRefno: true,
            },
        });
        if (!header) {
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear}.`, stock_error_codes_1.StockErrorCode.VOUCHER_NOT_FOUND);
        }
        const defaultGodownId = rules.requiresToGodown
            ? header.svhToGodownId
            : (header.svhFromGodownId ?? header.svhToGodownId);
        if (!defaultGodownId) {
            (0, module_service_utils_1.throwStockUnprocessable)('This document has no godown to import into', [
                {
                    field: 'svhId',
                    code: stock_error_codes_1.StockErrorCode.IMPORT_NO_GODOWN,
                    message: `${header.svhRefno} names no godown, so a row without one has nowhere to go. Save the header with a godown first.`,
                },
            ]);
        }
        const { lines, errors, rowsRead } = await (0, stock_voucher_import_helper_1.resolveImportedLines)(this.prisma, csvText, {
            companyId,
            branchId,
            defaultGodownId,
        });
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)(`${errors.length} of ${rowsRead} rows could not be read`, errors);
        }
        await this.save(rules, {
            header: {
                svhId,
                accYear,
                companyId,
                branchId,
                tenantId: header.svhTenantId,
                deviceId: header.svhDeviceId,
                sessionId: header.svhSessionId,
                slno: header.svhSlno.toString(),
                refno: header.svhRefno,
                usrRefno: header.svhUsrRefno,
                docDate: header.svhDocDate.toISOString().slice(0, 10),
                fromGodownId: header.svhFromGodownId,
                toGodownId: header.svhToGodownId,
                supplierId: header.svhSupplierId,
                rateSource: header.svhRateSource,
                remarks: header.svhRemarks,
                userId,
            },
            lines,
        });
        const problems = await this.validate(rules, svhId, accYear, companyId, branchId);
        const document = await this.getById(rules, svhId, accYear, companyId, branchId);
        return {
            ...document,
            rowsRead,
            linesImported: lines.length,
            problems,
        };
    }
    async pendingItems(rules, companyId, branchId, accYear, limit, offset) {
        const take = this.clamp(limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
        const skip = Math.max(offset ?? 0, 0);
        const items = await this.prisma.$queryRaw `
      SELECT itm.item_id                        AS "itemId",
             itm.item_code                      AS "itemCode",
             itm.item_name_en                   AS "itemName",
             base.iuc_id                        AS "baseUomId",
             unt.unit_name                      AS "unitName",
             stp.stp_track_signature            AS "trackSignature"
        FROM inventory.item_master itm
        LEFT JOIN inventory.item_unit_conversion base
               ON base.iuc_item_id = itm.item_id
              AND base.iuc_is_base_unit = true
              AND base.iuc_is_deleted = false
        LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = base.iuc_unit_id
        LEFT JOIN stock.stock_track_policy stp
               ON stp.stp_scope = 'ITEM'
              AND stp.stp_scope_id = itm.item_id
              AND stp.stp_is_active = true
              AND stp.stp_is_deleted = false
       WHERE itm.item_is_deleted = false
         AND itm.item_is_active  = true
         AND itm.item_is_service = false
         AND (itm.item_company_id IS NULL OR itm.item_company_id = ${companyId}::uuid)
         AND NOT EXISTS (
           SELECT 1
             FROM stock.stock_ledger sml
            WHERE sml.sml_item_id    = itm.item_id
              AND sml.sml_company_id = ${companyId}::uuid
              AND sml.sml_branch_id  = ${branchId}::uuid
              AND sml.sml_acc_year   = ${accYear}::bpchar
              AND sml.sml_txn_type   = ANY (${rules.ledgerTxnTypes}::text[])
              -- Same rule as the preflight's: a cancelled opening is not an
              -- opening, so its item belongs back on this work list.
              AND ${(0, stock_voucher_posting_helper_1.unreversedLedgerRow)()}
         )
       ORDER BY itm.item_code NULLS LAST, itm.item_name_en
       LIMIT ${take} OFFSET ${skip}
    `;
        return { items, meta: { limit: take, offset: skip, count: items.length } };
    }
    async reconcile(rules, companyId, branchId, accYear, limit, offset) {
        const take = this.clamp(limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
        const skip = Math.max(offset ?? 0, 0);
        const items = await this.prisma.$queryRaw `
      WITH opening AS (
        SELECT sml.sml_item_id                                    AS item_id,
               SUM(sml.sml_signed_base_qty)                       AS opening_qty,
               -- sml_cost_value is a MAGNITUDE; the sign lives in
               -- sml_direction alone, which is why a reversal nets out here.
               SUM(sml.sml_cost_value * sml.sml_direction)        AS opening_value
          FROM stock.stock_ledger sml
         WHERE sml.sml_company_id = ${companyId}::uuid
           AND sml.sml_branch_id  = ${branchId}::uuid
           AND sml.sml_acc_year   = ${accYear}::bpchar
           AND sml.sml_txn_type   = ANY (${rules.ledgerTxnTypes}::text[])
           AND sml.sml_is_deleted = false
         GROUP BY sml.sml_item_id
      ),
      current AS (
        SELECT sbl.sbl_item_id            AS item_id,
               SUM(sbl.sbl_on_hand_qty)   AS current_qty,
               SUM(sbl.sbl_stock_value)   AS current_value
          FROM stock.stock_balance sbl
         WHERE sbl.sbl_company_id = ${companyId}::uuid
           AND sbl.sbl_branch_id  = ${branchId}::uuid
           AND sbl.sbl_is_deleted = false
         GROUP BY sbl.sbl_item_id
      ),
      merged AS (
        SELECT COALESCE(opening.item_id, current.item_id)      AS item_id,
               COALESCE(opening.opening_qty,   0)              AS opening_qty,
               COALESCE(opening.opening_value, 0)              AS opening_value,
               COALESCE(current.current_qty,   0)              AS current_qty,
               COALESCE(current.current_value, 0)              AS current_value
          FROM opening
          FULL OUTER JOIN current ON current.item_id = opening.item_id
      )
      SELECT merged.item_id                                    AS "itemId",
             itm.item_code                                     AS "itemCode",
             itm.item_name_en                                  AS "itemName",
             unt.unit_name                                     AS "unitName",
             merged.opening_qty                                AS "openingQty",
             merged.opening_value                              AS "openingValue",
             merged.current_qty                                AS "currentQty",
             merged.current_value                              AS "currentValue",
             merged.current_qty   - merged.opening_qty         AS "diffQty",
             merged.current_value - merged.opening_value       AS "diffValue"
        FROM merged
        JOIN inventory.item_master itm ON itm.item_id = merged.item_id
        LEFT JOIN inventory.item_unit_conversion base
               ON base.iuc_item_id = itm.item_id
              AND base.iuc_is_base_unit = true
              AND base.iuc_is_deleted = false
        LEFT JOIN inventory.item_unit_master unt ON unt.unit_id = base.iuc_unit_id
       ORDER BY itm.item_code NULLS LAST, itm.item_name_en
       LIMIT ${take} OFFSET ${skip}
    `;
        return {
            items: items.map((row) => ({
                ...row,
                openingQty: (0, module_service_utils_1.toNumber)(row.openingQty),
                openingValue: (0, module_service_utils_1.toNumber)(row.openingValue),
                currentQty: (0, module_service_utils_1.toNumber)(row.currentQty),
                currentValue: (0, module_service_utils_1.toNumber)(row.currentValue),
                diffQty: (0, module_service_utils_1.toNumber)(row.diffQty),
                diffValue: (0, module_service_utils_1.toNumber)(row.diffValue),
            })),
            meta: { limit: take, offset: skip, count: items.length },
        };
    }
    async countSheet(rules, query) {
        if (rules.quantityMode !== 'COUNT') {
            (0, module_service_utils_1.throwStockUnprocessable)('A count sheet belongs to a physical count', [
                {
                    field: 'voucherType',
                    code: stock_error_codes_1.StockErrorCode.COUNT_SHEET_WRONG_TYPE,
                    message: `A ${rules.displayName.toLowerCase()} states its own lines; only a count generates them from the book.`,
                },
            ]);
        }
        const take = this.clamp(query.limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
        const skip = Math.max(query.offset ?? 0, 0);
        const includeZero = query.includeZero ?? true;
        const rows = await this.prisma.$queryRaw `
      SELECT sbl.sbl_item_id,
             itm.item_code,
             itm.item_name_en           AS item_name,
             sbl.sbl_lot_id,
             sbl.sbl_godown_id,
             gdl.gdl_name               AS godown_name,
             sbl.sbl_bucket,
             sbl.sbl_base_uom_id,
             unt.unit_name,
             sbl.sbl_batch_no,
             slt.slt_mfg_date,
             sbl.sbl_expiry_date,
             sbl.sbl_mrp,
             sbl.sbl_sale_price,
             slt.slt_serial_no,
             sbl.sbl_supplier_id,
             sbl.sbl_on_hand_qty,
             sbl.sbl_avg_cost_rate,
             sbl.sbl_stock_value,
             -- Notes 150 #9: the batch's size / colour / model, by company +
             -- item + folded batch, as every other reader of the table.
             sbd.sbd_size_id,
             isz.isz_name AS size_name,
             sbd.sbd_colour_id,
             icl.icl_name AS colour_name,
             sbd.sbd_model
        FROM stock.stock_balance sbl
        JOIN stock.stock_lot slt                   ON slt.slt_id = sbl.sbl_lot_id
        JOIN inventory.item_master itm             ON itm.item_id = sbl.sbl_item_id
        LEFT JOIN inventory.godown_locations gdl   ON gdl.gdl_id = sbl.sbl_godown_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sbl.sbl_base_uom_id
        LEFT JOIN inventory.item_unit_master unt   ON unt.unit_id = iuc.iuc_unit_id
        LEFT JOIN stock.stock_batch_detail sbd
               ON sbd.sbd_company_id = sbl.sbl_company_id
              AND sbd.sbd_item_id    = sbl.sbl_item_id
              AND sbd.sbd_batch_no   = upper(btrim(sbl.sbl_batch_no))
              AND sbd.sbd_is_deleted = false
        LEFT JOIN inventory.item_size_master   isz ON isz.isz_id = sbd.sbd_size_id
        LEFT JOIN inventory.item_colour_master icl ON icl.icl_id = sbd.sbd_colour_id
       WHERE sbl.sbl_company_id = ${query.companyId}::uuid
         AND sbl.sbl_branch_id  = ${query.branchId}::uuid
         AND sbl.sbl_godown_id  = ${query.godownId}::uuid
         AND sbl.sbl_is_deleted = false
         AND (${query.bucket ?? null}::text IS NULL OR sbl.sbl_bucket = ${query.bucket ?? null}::text)
         AND (${query.itemGroupId ?? null}::uuid IS NULL OR itm.item_group_id = ${query.itemGroupId ?? null}::uuid)
         AND (${includeZero}::boolean OR sbl.sbl_on_hand_qty <> 0)
       ORDER BY itm.item_name_en, sbl.sbl_batch_no NULLS FIRST, sbl.sbl_expiry_date, sbl.sbl_lot_id
       LIMIT ${take} OFFSET ${skip}
    `;
        return {
            items: rows.map((row, index) => ({
                lineNo: skip + index + 1,
                splitNo: 1,
                itemId: row.sbl_item_id,
                itemCode: row.item_code,
                itemName: row.item_name,
                lotId: row.sbl_lot_id,
                godownId: row.sbl_godown_id,
                godownName: row.godown_name,
                bucket: row.sbl_bucket,
                baseUomId: row.sbl_base_uom_id,
                unitName: row.unit_name,
                batchNo: row.sbl_batch_no,
                mfgDate: this.toIsoDate(row.slt_mfg_date),
                expiryDate: this.toIsoDate(row.sbl_expiry_date),
                mrp: (0, module_service_utils_1.toNullableNumber)(row.sbl_mrp),
                salePrice: (0, module_service_utils_1.toNullableNumber)(row.sbl_sale_price),
                serialNo: row.slt_serial_no,
                supplierId: row.sbl_supplier_id,
                bookQty: (0, module_service_utils_1.toNumber)(row.sbl_on_hand_qty ?? new client_1.Prisma.Decimal(0)),
                avgCostRate: (0, module_service_utils_1.toNumber)(row.sbl_avg_cost_rate),
                stockValue: (0, module_service_utils_1.toNumber)(row.sbl_stock_value),
                countedQty: null,
                sizeId: row.sbd_size_id,
                sizeName: row.size_name,
                colourId: row.sbd_colour_id,
                colourName: row.colour_name,
                model: row.sbd_model,
            })),
            meta: { limit: take, offset: skip, count: rows.length },
        };
    }
    async variance(rules, svhId, accYear, companyId, branchId, limit, offset) {
        await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        const take = this.clamp(limit, DEFAULT_REPORT_LIMIT, MAX_REPORT_LIMIT);
        const skip = Math.max(offset ?? 0, 0);
        const rows = await this.prisma.$queryRaw `
      SELECT sml.sml_line_no,
             sml.sml_split_no,
             sml.sml_item_id,
             itm.item_code,
             itm.item_name_en  AS item_name,
             sml.sml_batch_no,
             sml.sml_txn_type,
             sml.sml_direction,
             sml.sml_qty,
             sml.sml_signed_base_qty,
             sml.sml_cost_rate,
             sml.sml_cost_value,
             sml.sml_reason_id,
             srm.srm_name      AS reason_name
        FROM stock.stock_ledger sml
        JOIN inventory.item_master itm            ON itm.item_id = sml.sml_item_id
        LEFT JOIN stock.stock_reason_master srm   ON srm.srm_id = sml.sml_reason_id
       WHERE sml.sml_src_doc_id = ${svhId}::uuid
         AND sml.sml_acc_year   = ${accYear}::bpchar
         AND sml.sml_is_deleted = false
       ORDER BY sml.sml_line_no, sml.sml_split_no
       LIMIT ${take} OFFSET ${skip}
    `;
        return {
            items: rows.map((row) => ({
                lineNo: row.sml_line_no,
                splitNo: row.sml_split_no,
                itemId: row.sml_item_id,
                itemCode: row.item_code,
                itemName: row.item_name,
                batchNo: row.sml_batch_no,
                txnType: row.sml_txn_type,
                direction: Number(row.sml_direction),
                qty: (0, module_service_utils_1.toNumber)(row.sml_qty),
                signedBaseQty: (0, module_service_utils_1.toNumber)(row.sml_signed_base_qty ?? new client_1.Prisma.Decimal(0)),
                costRate: (0, module_service_utils_1.toNumber)(row.sml_cost_rate),
                costValue: (0, module_service_utils_1.toNumber)(row.sml_cost_value),
                reasonId: row.sml_reason_id,
                reasonName: row.reason_name,
            })),
            meta: { limit: take, offset: skip, count: rows.length },
        };
    }
    async loadForWrite(tx, rules, svhId, accYear, companyId, branchId) {
        const [row] = await tx.$queryRaw `
      SELECT svh_refno, svh_status, svh_is_deleted, svh_voucher_type,
             svh_company_id, svh_branch_id,
             to_char(svh_doc_date, 'YYYY-MM-DD') AS doc_date
        FROM stock.stock_voucher
       WHERE svh_id       = ${svhId}::uuid
         AND svh_acc_year = ${accYear}::bpchar
         FOR UPDATE`;
        if (!row ||
            row.svh_voucher_type !== rules.voucherType ||
            row.svh_company_id !== companyId ||
            row.svh_branch_id !== branchId) {
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear} for this company and branch.`, stock_error_codes_1.StockErrorCode.VOUCHER_NOT_FOUND);
        }
        return {
            svhRefno: row.svh_refno,
            svhStatus: row.svh_status,
            svhIsDeleted: row.svh_is_deleted,
            docDate: row.doc_date,
        };
    }
    async lockForPreflight(tx, rules, svhId, accYear) {
        if (rules.postShape === 'TRANSFER_OUT' || rules.postShape === 'TRANSFER_IN') {
            return;
        }
        await (0, stock_voucher_posting_helper_1.lockVoucherItems)(tx, svhId, accYear);
    }
    assertDocDateInYear(rules, docDate, accYear) {
        const dateYear = accYearOfDate(docDate);
        if (dateYear !== accYear.trim()) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be posted`, [
                {
                    field: 'docDate',
                    code: stock_error_codes_1.StockErrorCode.DOC_DATE_OUTSIDE_YEAR,
                    message: `${docDate} falls in ${dateYear}, not in ${accYear.trim()}, the year this document is filed under. Correct the date and save it first.`,
                },
            ]);
        }
    }
    actorOf(supplied) {
        return (0, module_service_utils_1.resolveActor)(this.requestContextService.getUserId(), supplied);
    }
    async logStatusChange(tx, step) {
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: step.companyId,
            branchId: step.branchId,
            tenantId: step.tenantId,
            accYear: step.accYear,
            srcModule: txn_status_log_helper_1.TxnStatusSrcModule.INVENTORY,
            srcDocType: step.rules.statusDocType,
            srcDocId: step.svhId,
            srcDocRefno: step.refno,
            event: step.event ?? this.toStatusEvent(step.fromStatus, step.toStatus),
            fromStatus: step.fromStatus,
            toStatus: step.toStatus,
            changedOn: step.changedOn,
            changedBy: step.actor,
            remarks: step.remarks ?? null,
            deviceId: step.deviceId ?? null,
            sessionId: step.sessionId ?? null,
        });
    }
    findLastStatusStep(rules, svhId, accYear, toStatus) {
        return this.prisma.txnStatusLog.findFirst({
            where: {
                tslSrcDocType: rules.statusDocType,
                tslSrcDocId: svhId,
                tslAccYear: accYear,
                tslToStatus: toStatus,
                tslIsDeleted: false,
            },
            orderBy: { tslSeqNo: 'desc' },
            select: { tslChangedOn: true, tslChangedBy: true, tslRemarks: true },
        });
    }
    toStatusEvent(fromStatus, toStatus) {
        if (fromStatus === null) {
            return txn_status_log_helper_1.TxnStatusEvent.CREATED;
        }
        if (toStatus === 'CANCELLED') {
            return txn_status_log_helper_1.TxnStatusEvent.CANCELLED;
        }
        if (toStatus === 'POSTED') {
            return txn_status_log_helper_1.TxnStatusEvent.POSTED;
        }
        return txn_status_log_helper_1.TxnStatusEvent.STATUS_CHANGED;
    }
    async loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId, tx) {
        const existing = await (tx ?? this.prisma).stockVoucher.findUnique({
            where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
            select: {
                svhId: true,
                svhRefno: true,
                svhStatus: true,
                svhIsDeleted: true,
                svhVoucherType: true,
                svhCompanyId: true,
                svhBranchId: true,
                svhTenantId: true,
                svhDeviceId: true,
                svhSessionId: true,
            },
        });
        if (!existing ||
            existing.svhVoucherType !== rules.voucherType ||
            existing.svhCompanyId !== companyId ||
            existing.svhBranchId !== branchId) {
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear} for this company and branch.`, stock_error_codes_1.StockErrorCode.VOUCHER_NOT_FOUND);
        }
        return existing;
    }
    assertDraft(rules, existing) {
        if (existing.svhIsDeleted) {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is deleted`, [
                { field: 'svhId', code: stock_error_codes_1.StockErrorCode.VOUCHER_DELETED, message: `${existing.svhRefno} has been deleted.` },
            ]);
        }
        if (existing.svhStatus !== 'DRAFT') {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is ${existing.svhStatus}`, [
                {
                    field: 'svhId',
                    code: stock_error_codes_1.StockErrorCode.VOUCHER_NOT_DRAFT,
                    message: `${existing.svhRefno} is ${existing.svhStatus}; only a DRAFT voucher can be edited or posted. A posted document accepts only cancel and print.`,
                },
            ]);
        }
    }
    toHeaderPayload(row, rules) {
        return {
            ...(rules.allowsLoading ? this.toLoadingPayload(row) : {}),
            svhId: row.svh_id,
            accYear: row.svh_acc_year.trim(),
            companyId: row.svh_company_id,
            branchId: row.svh_branch_id,
            tenantId: row.svh_tenant_id,
            deviceId: row.svh_device_id,
            sessionId: row.svh_session_id,
            voucherType: row.svh_voucher_type,
            slno: row.svh_slno.toString(),
            refno: row.svh_refno,
            usrRefno: row.svh_usr_refno,
            docDate: this.toIsoDate(row.svh_doc_date),
            docDatetime: row.svh_doc_datetime.toISOString(),
            fromGodownId: row.svh_from_godown_id,
            fromGodownName: row.from_godown_name,
            godownId: row.svh_to_godown_id,
            godownName: row.to_godown_name,
            supplierId: row.svh_supplier_id,
            supplierName: row.supplier_name,
            toBranchId: row.svh_to_branch_id,
            toBranchName: row.to_branch_name ?? null,
            partyRef: row.svh_party_ref,
            reasonId: row.svh_reason_id,
            reasonName: row.reason_name,
            linkSrcModule: row.svh_link_src_module,
            linkSrcDocType: row.svh_link_src_doc_type,
            linkSrcDocId: row.svh_link_src_doc_id,
            linkSrcAccYear: row.svh_link_src_acc_year?.trim() ?? null,
            freezeStock: row.svh_freeze_stock,
            freezeFrom: row.svh_freeze_from?.toISOString() ?? null,
            freezeTo: row.svh_freeze_to?.toISOString() ?? null,
            syncDate: row.svh_sync_date?.toISOString() ?? null,
            status: row.svh_status,
            lineCount: row.svh_line_count,
            totalQty: (0, module_service_utils_1.toNumber)(row.svh_total_qty),
            totalValue: (0, module_service_utils_1.toNumber)(row.svh_total_value),
            totalValueWot: (0, module_service_utils_1.toNumber)(row.svh_total_value_wot),
            postedOn: row.posted_on?.toISOString() ?? null,
            postedBy: row.posted_by,
            postedByName: row.posted_by_name,
            cancelledOn: row.cancelled_on?.toISOString() ?? null,
            cancelReason: row.cancel_reason,
            createdOn: row.svh_created_on.toISOString(),
            createdBy: row.svh_created_by,
            createdByName: row.created_by_name,
            modifiedOn: row.svh_modified_on?.toISOString() ?? null,
            rateSource: row.svh_rate_source,
            remarks: row.svh_remarks,
            isDeleted: row.svh_is_deleted,
        };
    }
    toLoadingPayload(row) {
        return {
            loadEnabled: row.svh_load_enabled,
            loadDatetime: row.svh_load_datetime?.toISOString() ?? null,
            loadmanIds: row.svh_loadman_id ?? [],
            loadmanNames: row.loadman_names ?? [],
            driverId: row.svh_driver_id,
            driverName: row.driver_name,
            supervisorId: row.svh_supervisor_id,
            supervisorName: row.supervisor_name,
            vehicleId: row.svh_vehicle_id,
            vehicleNo: row.svh_vehicle_no,
            loadingCharge: (0, module_service_utils_1.toNumber)(row.svh_loading_charge),
            unloadEnabled: row.svh_unload_enabled,
            unloadDatetime: row.svh_unload_datetime?.toISOString() ?? null,
            unloadmanIds: row.svh_unloadman_id ?? [],
            unloadmanNames: row.unloadman_names ?? [],
            unloadSupervisorId: row.svh_unload_supervisor_id,
            unloadSupervisorName: row.unload_supervisor_name,
            unloadingCharge: (0, module_service_utils_1.toNumber)(row.svh_unloading_charge),
        };
    }
    toLinePayload(row, rules) {
        return {
            ...(rules.allowsLoading
                ? { loadRate: (0, module_service_utils_1.toNumber)(row.svi_load_rate), unloadRate: (0, module_service_utils_1.toNumber)(row.svi_unload_rate) }
                : {}),
            sviId: row.svi_id,
            lineNo: row.svi_line_no,
            splitNo: row.svi_split_no,
            itemId: row.svi_item_id,
            itemCode: row.item_code,
            itemName: row.item_name,
            unitName: row.unit_name,
            uomId: row.svi_uom_id,
            baseUomId: row.svi_base_uom_id,
            toBaseFactor: (0, module_service_utils_1.toNumber)(row.svi_to_base_factor),
            godownId: row.svi_godown_id,
            godownName: row.godown_name,
            bucket: row.svi_bucket,
            barcode: row.svi_barcode,
            batchNo: row.svi_batch_no,
            mfgDate: this.toIsoDate(row.svi_mfg_date),
            expiryDate: this.toIsoDate(row.svi_expiry_date),
            mrp: (0, module_service_utils_1.toNullableNumber)(row.svi_mrp),
            salePrice: (0, module_service_utils_1.toNullableNumber)(row.svi_sale_price),
            serialNo: row.svi_serial_no,
            supplierId: row.svi_supplier_id,
            supplierName: row.line_supplier_name,
            toBucket: row.svi_to_bucket ?? null,
            qty: (0, module_service_utils_1.toNumber)(row.svi_qty),
            baseQty: (0, module_service_utils_1.toNumber)(row.svi_base_qty),
            freeQty: (0, module_service_utils_1.toNumber)(row.svi_free_qty),
            freeBaseQty: (0, module_service_utils_1.toNumber)(row.svi_free_base_qty),
            weightQty: (0, module_service_utils_1.toNumber)(row.svi_weight_qty),
            bookQty: (0, module_service_utils_1.toNullableNumber)(row.svi_book_qty),
            countedQty: (0, module_service_utils_1.toNullableNumber)(row.svi_counted_qty),
            diffQty: (0, module_service_utils_1.toNullableNumber)(row.svi_diff_qty),
            costRate: (0, module_service_utils_1.toNumber)(row.svi_cost_rate),
            costRateWot: (0, module_service_utils_1.toNumber)(row.svi_cost_rate_wot),
            landedRate: (0, module_service_utils_1.toNumber)(row.svi_landed_rate),
            taxPerc: (0, module_service_utils_1.toNumber)(row.svi_tax_perc),
            reasonId: row.svi_reason_id,
            reasonName: row.line_reason_name,
            direction: row.svi_direction === null ? null : Number(row.svi_direction),
            syncDate: row.svi_sync_date?.toISOString() ?? null,
            value: (0, module_service_utils_1.toNullableNumber)(row.svi_value) ?? 0,
            valueWot: (0, module_service_utils_1.toNullableNumber)(row.svi_value_wot) ?? 0,
            lotId: row.svi_lot_id,
            remarks: row.svi_remarks,
            trackSignature: row.track_signature,
            sizeId: row.sbd_size_id,
            sizeName: row.size_name,
            colourId: row.sbd_colour_id,
            colourName: row.colour_name,
            model: row.sbd_model,
        };
    }
    auditActor(actor) {
        return actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor;
    }
    actorFor(supplied, actor) {
        if (actor !== module_service_utils_1.DEFAULT_ACTOR) {
            return actor;
        }
        const trimmed = supplied?.trim();
        return trimmed ? trimmed : null;
    }
    lineModifiedByData(supplied, actor) {
        if (actor !== module_service_utils_1.DEFAULT_ACTOR) {
            return {};
        }
        const trimmed = supplied?.trim();
        return trimmed ? { sviModifiedBy: trimmed } : {};
    }
    docDatetimeData(header) {
        return header.docDatetime ? { svhDocDatetime: new Date(header.docDatetime) } : {};
    }
    linkSourceData(header) {
        return {
            svhLinkSrcModule: header.linkSrcModule ?? null,
            svhLinkSrcDocType: header.linkSrcDocType ?? null,
            svhLinkSrcDocId: header.linkSrcDocId ?? null,
            svhLinkSrcAccYear: header.linkSrcAccYear ?? null,
        };
    }
    freezeData(header) {
        return {
            svhFreezeStock: header.freezeStock ?? false,
            svhFreezeFrom: header.freezeFrom ? new Date(header.freezeFrom) : null,
            svhFreezeTo: header.freezeTo ? new Date(header.freezeTo) : null,
        };
    }
    loadingData(rules, header) {
        if (!rules.allowsLoading) {
            return {};
        }
        return {
            svhLoadEnabled: header.loadEnabled ?? false,
            svhLoadDatetime: header.loadDatetime ? new Date(header.loadDatetime) : null,
            svhLoadmanId: header.loadmanIds ?? [],
            svhDriverId: header.driverId ?? null,
            svhSupervisorId: header.supervisorId ?? null,
            svhVehicleId: header.vehicleId ?? null,
            svhVehicleNo: header.vehicleNo ?? null,
            svhUnloadEnabled: header.unloadEnabled ?? false,
            svhUnloadDatetime: header.unloadDatetime ? new Date(header.unloadDatetime) : null,
            svhUnloadmanId: header.unloadmanIds ?? [],
            svhUnloadSupervisorId: header.unloadSupervisorId ?? null,
        };
    }
    resolveRateSource(rules, header) {
        if (header.rateSource !== undefined) {
            return header.rateSource ?? null;
        }
        return rules.defaultRateSource ?? null;
    }
    toIsoDate(value) {
        return value ? value.toISOString().slice(0, 10) : null;
    }
    toDecimalNumber(value) {
        if (value === null || value === undefined || value === '') {
            return 0;
        }
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }
    toDecimalColumn(value) {
        if (value === null || value === undefined || value === '') {
            return new client_1.Prisma.Decimal(0);
        }
        try {
            const decimal = new client_1.Prisma.Decimal(value);
            return decimal.isFinite() ? decimal : new client_1.Prisma.Decimal(0);
        }
        catch {
            return new client_1.Prisma.Decimal(0);
        }
    }
    toInstant(value) {
        if (!value) {
            return null;
        }
        const parsed = Date.parse(value);
        return Number.isNaN(parsed) ? null : parsed;
    }
    readRefusedBookQty(line) {
        return line.bookQty;
    }
    toNullableDecimal(value) {
        if (value === null || value === undefined || value === '') {
            return null;
        }
        const parsed = typeof value === 'number' ? value : Number(value);
        return Number.isFinite(parsed) ? new client_1.Prisma.Decimal(parsed) : null;
    }
    clamp(value, fallback, max) {
        if (value === undefined || !Number.isFinite(value) || value <= 0) {
            return fallback;
        }
        return Math.min(Math.trunc(value), max);
    }
};
exports.StockVoucherService = StockVoucherService;
exports.StockVoucherService = StockVoucherService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService,
        stock_posting_service_1.StockPostingService])
], StockVoucherService);
function accYearOfDate(date) {
    const [year, month] = date.split('-').map(Number);
    const start = month >= 4 ? year : year - 1;
    return `${start}-${start + 1}`;
}
function loadingFieldSent(header) {
    const filled = [
        ['loadEnabled', header.loadEnabled === true],
        ['loadDatetime', !!header.loadDatetime],
        ['loadmanIds', (header.loadmanIds?.length ?? 0) > 0],
        ['driverId', !!header.driverId],
        ['supervisorId', !!header.supervisorId],
        ['vehicleId', !!header.vehicleId],
        ['vehicleNo', !!header.vehicleNo?.trim()],
        ['unloadEnabled', header.unloadEnabled === true],
        ['unloadDatetime', !!header.unloadDatetime],
        ['unloadmanIds', (header.unloadmanIds?.length ?? 0) > 0],
        ['unloadSupervisorId', !!header.unloadSupervisorId],
    ];
    return filled.find(([, given]) => given)?.[0] ?? null;
}
//# sourceMappingURL=stock-voucher.service.js.map