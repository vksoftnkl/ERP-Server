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
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_voucher_numbering_helper_1 = require("./stock-voucher-numbering.helper");
const stock_voucher_import_helper_1 = require("./stock-voucher-import.helper");
const stock_voucher_posting_helper_1 = require("./stock-voucher-posting.helper");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const stock_voucher_types_1 = require("./types/stock-voucher.types");
const STOCK_VOUCHER_TABLE_NAME = 'stock_voucher';
const STOCK_VOUCHER_ITEM_TABLE_NAME = 'stock_voucher_item';
const DEFAULT_REPORT_LIMIT = 200;
const MAX_REPORT_LIMIT = 1000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;
let StockVoucherService = class StockVoucherService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(rules, dto) {
        const { header } = dto;
        const actor = (0, module_service_utils_1.resolveActor)(header.userId, this.requestContextService.getUserId());
        this.assertPayloadRules(rules, dto);
        await this.assertReasons(rules, dto);
        const postAfterSave = header.status === 'POSTED';
        const postedOn = new Date();
        const { svhId, rowsPosted } = await this.prisma.$transaction(async (tx) => {
            const id = header.svhId
                ? await this.updateDraft(tx, rules, dto, actor)
                : await this.createDraft(tx, rules, dto, actor);
            if (!postAfterSave) {
                return { svhId: id, rowsPosted: null };
            }
            await this.assertPostable(rules, id, header.accYear, header.companyId, header.branchId, tx);
            const posted = await (0, stock_voucher_posting_helper_1.postStockVoucher)(tx, {
                rules,
                svhId: id,
                accYear: header.accYear,
                actor,
                postedOn,
            });
            await this.logStatusChange(tx, {
                rules,
                svhId: id,
                accYear: header.accYear,
                companyId: header.companyId,
                branchId: header.branchId,
                tenantId: header.tenantId ?? null,
                refno: (await this.loadRefno(tx, id, header.accYear)) ?? id,
                fromStatus: 'DRAFT',
                toStatus: 'POSTED',
                actor,
                changedOn: postedOn,
                remarks: `${rules.displayName} saved and posted — ${posted} ledger rows`,
                deviceId: header.deviceId,
                sessionId: header.sessionId ?? null,
            });
            return { svhId: id, rowsPosted: posted };
        });
        const document = await this.getById(rules, svhId, header.accYear, header.companyId, header.branchId);
        return { ...document, rowsPosted };
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
                        message: `${rules.voucherType} cannot be saved through this route.`,
                    });
                }
            }
        }
        if (rules.requiresToGodown && !header.toGodownId) {
            errors.push({
                field: 'toGodownId',
                message: `A ${rules.displayName} must name the godown the stock arrives in.`,
            });
        }
        if (rules.requiresFromGodown && !header.fromGodownId) {
            errors.push({
                field: 'fromGodownId',
                message: `A ${rules.displayName} must name the godown the stock leaves from.`,
            });
        }
        if (!rules.allowsToBranch && header.toBranchId) {
            errors.push({
                field: 'toBranchId',
                message: `Only a transfer names the branch stock is going to; a ${rules.displayName.toLowerCase()} does not leave the branch.`,
            });
        }
        if (!rules.allowsCount) {
            if (header.freezeStock || header.freezeFrom || header.freezeTo) {
                errors.push({
                    field: 'freezeStock',
                    message: `Only a physical count freezes stock; a ${rules.displayName.toLowerCase()} counts nothing.`,
                });
            }
            const counted = lines.findIndex((line) => line.bookQty !== undefined && line.bookQty !== null);
            const shelf = lines.findIndex((line) => line.countedQty !== undefined && line.countedQty !== null);
            const at = counted >= 0 ? counted : shelf;
            if (at >= 0) {
                errors.push({
                    field: `lines.${at}`,
                    message: `Line ${lines[at].lineNo}: bookQty and countedQty belong to a physical count. A ${rules.displayName.toLowerCase()} states a quantity, it does not reconcile one.`,
                });
            }
        }
        else if (header.freezeStock && !(header.freezeFrom && header.freezeTo)) {
            errors.push({
                field: 'freezeStock',
                message: 'A freeze needs both freezeFrom and freezeTo — without a window the count measures a moving target.',
            });
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
                message: 'The source document is all four of linkSrcModule, linkSrcDocType, linkSrcDocId and linkSrcAccYear, or none of them (ck_svh_link).',
            });
        }
        if (!lines.length) {
            errors.push({ field: 'lines', message: 'A document must have at least one line.' });
        }
        if (header.freezeStock && (!header.freezeFrom || !header.freezeTo)) {
            errors.push({
                field: 'freezeFrom',
                message: 'A stock freeze needs a window: send freezeFrom and freezeTo as instants with an offset. The guard compares them to now(), not to the document date.',
            });
        }
        const freezeFrom = this.toInstant(header.freezeFrom);
        const freezeTo = this.toInstant(header.freezeTo);
        if (freezeFrom !== null && freezeTo !== null && freezeTo <= freezeFrom) {
            errors.push({ field: 'freezeTo', message: 'freezeTo must be after freezeFrom.' });
        }
        const isCount = rules.quantityMode === 'COUNT';
        const countedGodownId = isCount ? (header.toGodownId ?? header.fromGodownId ?? null) : null;
        const derivableSource = header.rateSource !== null &&
            header.rateSource !== undefined &&
            stock_voucher_types_1.DERIVABLE_RATE_SOURCES.includes(header.rateSource);
        const seen = new Map();
        lines.forEach((line, index) => {
            const field = `lines.${index}`;
            const splitNo = line.splitNo ?? 1;
            const key = `${line.lineNo}|${splitNo}`;
            const firstAt = seen.get(key);
            if (firstAt !== undefined) {
                errors.push({
                    field,
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
                    message: `Line ${line.lineNo}: quantities are magnitudes and cannot be negative. A negative opening is an ADJUSTMENT.`,
                });
            }
            else if (!isCount && qty === 0 && freeQty === 0) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} has no quantity.`,
                });
            }
            if (!isCount && !line.uomId) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} names no unit. uomId is an item_unit_conversion iuc_id, not a unit_id.`,
                });
            }
            if (isCount) {
                if (line.uomId) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo}: a count line names no unit. It is counted in the base unit the book figure is held in, read from the balance row.`,
                    });
                }
                if (qty !== 0 || freeQty !== 0) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo}: a count line states what was FOUND, not a quantity to move. Send countedQty and leave qty at 0 — a quantity to move is an ADJUSTMENT.`,
                    });
                }
                if (this.toDecimalNumber(line.costRate ?? 0) !== 0) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo}: a count line carries no cost rate. An overage is valued from the document's rate source; a shortage at what the stock cost us, stamped by the engine.`,
                    });
                }
                if (this.readRefusedBookQty(line) !== undefined) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo}: bookQty is read from stock_balance at save time and is never taken from the payload.`,
                    });
                }
                if (line.countedQty === undefined || line.countedQty === null || line.countedQty === '') {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo} has not been counted yet. Send countedQty: 0 to record that nothing was found — absent means the counter has not reached this line.`,
                    });
                }
                else if (this.toDecimalNumber(line.countedQty) < 0) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo}: countedQty is a count and cannot be negative. Only the derived difference is signed.`,
                    });
                }
                if (!line.lotId) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo} names no holding. A count line comes from the count sheet, which carries the lotId its book figure was read from.`,
                    });
                }
                if (countedGodownId && line.godownId !== countedGodownId) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo} is in a different godown than the one this count names. A count is per godown.`,
                    });
                }
            }
            if (rules.requiresLot) {
                if (!line.lotId) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo} names no lot. A ${rules.displayName.toLowerCase()} moves existing stock — pick the holding from the balance, which carries its lotId.`,
                    });
                }
            }
            else if (!isCount && line.lotId) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo}: a ${rules.displayName.toLowerCase()} does not choose its own lot. The engine resolves it at post.`,
                });
            }
            if (this.toDecimalNumber(line.weightQty ?? 0) < 0) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo}: weight is a magnitude and cannot be negative.`,
                });
            }
            if (splitNo > 1 && !line.batchNo?.trim()) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} split ${splitNo} needs a batch number.`,
                });
            }
            if (line.mfgDate && line.expiryDate && line.expiryDate < line.mfgDate) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo}: expiry ${line.expiryDate} is before manufacture ${line.mfgDate}.`,
                });
            }
            if (rules.zeroesLineCost &&
                !isCount &&
                (this.toDecimalNumber(line.costRate ?? 0) !== 0 ||
                    this.toDecimalNumber(line.costRateWot ?? 0) !== 0)) {
                errors.push({
                    field,
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
                    message: `No stock reason ${reasonId} visible to this company. A reason is either the company's own or one shared with every company.`,
                });
                continue;
            }
            if (!reason.srmIsActive) {
                errors.push({
                    field: first.field,
                    message: `Stock reason ${reason.srmCode} (${reason.srmName}) is inactive.`,
                });
                continue;
            }
            const allowed = reason.srmAllowedTxnTypes ?? [];
            if (allowed.length && !allowed.some((txnType) => rules.ledgerTxnTypes.includes(txnType))) {
                errors.push({
                    field: first.field,
                    message: `Stock reason ${reason.srmCode} (${reason.srmName}) may not be cited by a ${rules.displayName.toLowerCase()}; it is restricted to ${allowed.join(', ')}.`,
                });
                continue;
            }
            if (reason.srmRequireRemarks) {
                for (const citation of citations) {
                    if (!citation.remarks?.trim()) {
                        errors.push({
                            field: citation.field,
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
    async createDraft(tx, rules, dto, actor) {
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
                svhSyncDate: header.syncDate ? new Date(header.syncDate) : null,
                svhStatus: 'DRAFT',
                svhCreatedBy: this.actorFor(header.createdBy, actor),
            },
            select: { svhId: true, svhAccYear: true, svhRefno: true },
        });
        await this.replaceLines(tx, rules, dto, created.svhId, actor, header.createdBy);
        await this.writeHeaderTotals(tx, created.svhId, header);
        await this.auditLogService.logEntityChange({
            action: 'insert',
            tableName: STOCK_VOUCHER_TABLE_NAME,
            screenName: rules.auditScreenName,
            screenType: 'transaction',
            pk: created.svhId,
            displayName: created.svhRefno,
            originalRecord: null,
            modifiedRecord: { svhId: created.svhId, svhRefno: created.svhRefno, svhStatus: 'DRAFT' },
            userId: actor,
            notes: `${rules.displayName} draft created`,
        }, tx);
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
            changedOn: new Date(),
            remarks: `${rules.displayName} created`,
            deviceId: header.deviceId,
            sessionId: header.sessionId ?? null,
        });
        return created.svhId;
    }
    async writeHeaderTotals(tx, svhId, header) {
        const data = {};
        if (header.lineCount !== undefined) {
            data.svhLineCount = header.lineCount;
        }
        if (header.totalQty !== undefined) {
            data.svhTotalQty = new client_1.Prisma.Decimal(this.toDecimalNumber(header.totalQty));
        }
        if (header.totalValue !== undefined) {
            data.svhTotalValue = new client_1.Prisma.Decimal(this.toDecimalNumber(header.totalValue));
        }
        if (header.totalValueWot !== undefined) {
            data.svhTotalValueWot = new client_1.Prisma.Decimal(this.toDecimalNumber(header.totalValueWot));
        }
        if (!Object.keys(data).length) {
            return;
        }
        await tx.stockVoucher.update({
            where: { svhId_svhAccYear: { svhId, svhAccYear: header.accYear } },
            data,
        });
    }
    async updateDraft(tx, rules, dto, actor) {
        const { header } = dto;
        const svhId = header.svhId;
        const existing = await this.loadForWrite(tx, rules, svhId, header.accYear);
        this.assertDraft(rules, existing);
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
                svhSyncDate: header.syncDate ? new Date(header.syncDate) : null,
                svhVersionNo: { increment: 1 },
                svhModifiedOn: new Date(),
                svhModifiedBy: this.actorFor(header.modifiedBy, actor),
            },
        });
        await this.replaceLines(tx, rules, dto, svhId, actor, header.modifiedBy);
        await this.writeHeaderTotals(tx, svhId, header);
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: STOCK_VOUCHER_TABLE_NAME,
            screenName: rules.auditScreenName,
            screenType: 'transaction',
            pk: svhId,
            displayName: existing.svhRefno,
            originalRecord: { svhId, svhRefno: existing.svhRefno, svhStatus: existing.svhStatus },
            modifiedRecord: { svhId, svhRefno: existing.svhRefno, svhStatus: 'DRAFT' },
            userId: actor,
            notes: `${rules.displayName} draft updated`,
        }, tx);
        return svhId;
    }
    async replaceLines(tx, rules, dto, svhId, actor, author) {
        const { header, lines } = dto;
        await tx.stockVoucherItem.deleteMany({
            where: { sviVoucherId: svhId, sviAccYear: header.accYear },
        });
        if (!lines.length) {
            return;
        }
        const isCount = rules.quantityMode === 'COUNT';
        const zeroCost = isCount || rules.zeroesLineCost === true;
        const holdings = isCount ? await this.loadCountHoldings(tx, header, lines) : null;
        const data = lines.map((line) => {
            const holding = holdings?.get(this.holdingKey(line.lotId, line.godownId, line.bucket));
            const qty = isCount ? 0 : this.toDecimalNumber(line.qty);
            const freeQty = isCount ? 0 : this.toDecimalNumber(line.freeQty ?? 0);
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
                sviToBaseFactor: new client_1.Prisma.Decimal(isCount ? 1 : this.toDecimalNumber(line.toBaseFactor)),
                sviGodownId: line.godownId,
                sviLotId: isCount || rules.requiresLot ? (line.lotId ?? null) : null,
                sviBucket: (line.bucket ?? 'SALEABLE'),
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
                sviQty: new client_1.Prisma.Decimal(qty),
                sviBaseQty: new client_1.Prisma.Decimal(isCount ? 0 : this.toDecimalNumber(line.baseQty)),
                sviFreeQty: new client_1.Prisma.Decimal(freeQty),
                ...(isCount
                    ? { sviFreeBaseQty: new client_1.Prisma.Decimal(0) }
                    : line.freeBaseQty === undefined
                        ? {}
                        : { sviFreeBaseQty: new client_1.Prisma.Decimal(this.toDecimalNumber(line.freeBaseQty)) }),
                sviWeightQty: new client_1.Prisma.Decimal(this.toDecimalNumber(line.weightQty ?? 0)),
                sviBookQty: isCount
                    ? holding.bookQty
                    : this.toNullableDecimal(line.bookQty),
                sviCountedQty: this.toNullableDecimal(line.countedQty),
                sviCostRate: new client_1.Prisma.Decimal(zeroCost ? 0 : this.toDecimalNumber(line.costRate)),
                sviCostRateWot: new client_1.Prisma.Decimal(zeroCost ? 0 : this.toDecimalNumber(line.costRateWot ?? 0)),
                sviLandedRate: new client_1.Prisma.Decimal(zeroCost ? 0 : this.toDecimalNumber(line.landedRate ?? 0)),
                sviTaxPerc: new client_1.Prisma.Decimal(zeroCost ? 0 : this.toDecimalNumber(line.taxPerc ?? 0)),
                sviReasonId: line.reasonId ?? null,
                sviSyncDate: line.syncDate ? new Date(line.syncDate) : null,
                sviRemarks: line.remarks ?? null,
                sviCreatedBy: this.actorFor(line.createdBy ?? author, actor),
                ...this.lineModifiedByData(line.modifiedBy ?? header.modifiedBy),
            };
        });
        await tx.stockVoucherItem.createMany({ data });
        await this.auditLogService.logEntityChange({
            action: 'insert',
            tableName: STOCK_VOUCHER_ITEM_TABLE_NAME,
            screenName: rules.auditScreenName,
            screenType: 'transaction',
            pk: svhId,
            displayName: header.refno ?? svhId,
            originalRecord: null,
            modifiedRecord: { svhId, lineCount: data.length },
            userId: actor,
            notes: `${rules.displayName} lines replaced`,
        }, tx);
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
                    message: `Line ${line.lineNo} names a holding this godown no longer has — regenerate the count sheet. (Someone may have sold the last of this lot while the count was being taken.)`,
                });
                return;
            }
            if (holding.itemId !== line.itemId) {
                errors.push({
                    field: `lines.${index}`,
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
        const search = query.search?.trim();
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
         AND (
               ${search ?? null}::text IS NULL
            OR svh.svh_refno     ILIKE '%' || ${search ?? null}::text || '%'
            OR svh.svh_usr_refno ILIKE '%' || ${search ?? null}::text || '%'
         )
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
    async getById(rules, svhId, accYear, companyId, branchId) {
        const [header] = await this.prisma.$queryRaw `
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
             svh.svh_rate_source,
             svh.svh_remarks,
             svh.svh_is_deleted
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations fgd ON fgd.gdl_id = svh.svh_from_godown_id
        LEFT JOIN inventory.godown_locations tgd ON tgd.gdl_id = svh.svh_to_godown_id
        LEFT JOIN purchase.suppliers sup ON sup.sup_id = svh.svh_supplier_id
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
        LEFT JOIN stock.stock_reason_master srm  ON srm.srm_id = svh.svh_reason_id
       WHERE svh.svh_id          = ${svhId}::uuid
         AND svh.svh_acc_year    = ${accYear}::bpchar
         AND svh.svh_company_id  = ${companyId}::uuid
         AND svh.svh_branch_id   = ${branchId}::uuid
         AND svh.svh_voucher_type = ${rules.voucherType}
    `;
        if (!header) {
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear} for this company and branch.`);
        }
        const lines = await this.prisma.$queryRaw `
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
             svi.svi_barcode,
             svi.svi_batch_no,
             svi.svi_mfg_date,
             svi.svi_expiry_date,
             svi.svi_mrp,
             svi.svi_sale_price,
             svi.svi_serial_no,
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
             svi.svi_sync_date,
             svi.svi_value,
             svi.svi_value_wot,
             svi.svi_lot_id,
             svi.svi_remarks
        FROM stock.stock_voucher_item svi
        JOIN inventory.item_master itm            ON itm.item_id = svi.svi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = svi.svi_uom_id
        LEFT JOIN inventory.item_unit_master unt  ON unt.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.godown_locations gdl  ON gdl.gdl_id = svi.svi_godown_id
        LEFT JOIN stock.stock_reason_master srm   ON srm.srm_id = svi.svi_reason_id
        LEFT JOIN purchase.suppliers sup          ON sup.sup_id = svi.svi_supplier_id
       WHERE svi.svi_voucher_id = ${svhId}::uuid
         AND svi.svi_acc_year   = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
       ORDER BY svi.svi_line_no, svi.svi_split_no
    `;
        return {
            header: this.toHeaderPayload(header),
            lines: lines.map((row) => this.toLinePayload(row)),
        };
    }
    async validate(rules, svhId, accYear, companyId, branchId, tx) {
        await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId, tx);
        const isCount = rules.quantityMode === 'COUNT';
        return (tx ?? this.prisma).$queryRaw `
      WITH doc AS (
        SELECT svh.svh_id,
               svh.svh_acc_year,
               svh.svh_company_id,
               svh.svh_branch_id,
               svh.svh_doc_date,
               svh.svh_rate_source
          FROM stock.stock_voucher svh
         WHERE svh.svh_id       = ${svhId}::uuid
           AND svh.svh_acc_year = ${accYear}::bpchar
      ),
      line AS (
        SELECT svi.*, doc.svh_doc_date, doc.svh_rate_source, doc.svh_company_id, doc.svh_branch_id
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
               ${(0, stock_voucher_posting_helper_1.lotIdentityKeyColumns)()}
          FROM line
          JOIN policy ON policy.svi_id = line.svi_id
      ),
      -- Has this holding already been opened this year? Matched through the
      -- lot's generated key columns and the OPENING rows in the ledger, NOT
      -- through the documents: a cancelled opening is reversed in the ledger
      -- and must correctly read as "not opened".
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
      -- names the line and the count that holds the shelf. Wall clock, like
      -- the guard: a back-dated document posted now still changes today's
      -- on-hand. A count never trips over its own freeze, and a second DRAFT
      -- count of the same godown is refused by the first's — one sheet holds
      -- a shelf at a time.
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
               AND now() BETWEEN svh.svh_freeze_from AND svh.svh_freeze_to
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
               WHEN keyed.track_batch      AND COALESCE(keyed.svi_batch_no, '') = ''
                 THEN 'this item is batch-tracked and the line has no batch number'
               WHEN keyed.track_expiry     AND keyed.svi_expiry_date IS NULL
                 THEN 'this item is expiry-tracked and the line has no expiry date'
               WHEN keyed.track_mrp        AND keyed.svi_mrp IS NULL
                 THEN 'this item is MRP-tracked and the line has no MRP'
               WHEN keyed.track_sale_price AND keyed.svi_sale_price IS NULL
                 THEN 'this item is sale-price-tracked and the line has no sale price'
               WHEN keyed.track_serial     AND COALESCE(keyed.svi_serial_no, '') = ''
                 THEN 'this item is serial-tracked and the line has no serial number'
               WHEN keyed.track_supplier   AND keyed.svi_supplier_id IS NULL
                 THEN 'this item is supplier-tracked and the line has no supplier'
               WHEN ${rules.isInward}::boolean AND keyed.svi_cost_rate = 0
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
                      || ' until ' || to_char(frozen.frozen_until, 'YYYY-MM-DD HH24:MI')
               ELSE NULL
             END                                      AS "problem"
        FROM keyed
        JOIN opened ON opened.svi_id = keyed.svi_id
        JOIN bal    ON bal.svi_id    = keyed.svi_id
        JOIN frozen ON frozen.svi_id = keyed.svi_id
        JOIN inventory.item_master itm ON itm.item_id = keyed.svi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = keyed.svi_uom_id
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
                message: `Line ${row.lineNo}${row.splitNo > 1 ? ` split ${row.splitNo}` : ''} (${row.itemName}): ${row.problem}`,
            })));
        }
    }
    async post(rules, svhId, accYear, companyId, branchId, userId, afterPost) {
        const actor = (0, module_service_utils_1.resolveActor)(userId, this.requestContextService.getUserId());
        const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        this.assertDraft(rules, existing);
        await this.assertPostable(rules, svhId, accYear, companyId, branchId);
        const postedOn = new Date();
        const rowsPosted = await this.prisma.$transaction(async (tx) => {
            let posted;
            if ((0, stock_voucher_posting_helper_1.usesInProcessPosting)(rules)) {
                posted = await (0, stock_voucher_posting_helper_1.postStockVoucher)(tx, { rules, svhId, accYear, actor, postedOn });
            }
            else {
                const fn = client_1.Prisma.raw(this.assertPostFunction(rules));
                const [row] = await tx.$queryRaw `
          SELECT ${fn}(${svhId}::uuid, ${accYear}::bpchar, ${actor}::uuid) AS rows
        `;
                posted = Number(row?.rows ?? 0);
            }
            await afterPost?.(tx, posted);
            await this.logStatusChange(tx, {
                rules,
                svhId,
                accYear,
                companyId,
                branchId,
                tenantId: existing.svhTenantId ?? null,
                refno: existing.svhRefno,
                fromStatus: existing.svhStatus,
                toStatus: 'POSTED',
                actor,
                changedOn: postedOn,
                remarks: `${rules.displayName} posted — ${posted} ledger rows`,
            });
            return posted;
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
        const actor = (0, module_service_utils_1.resolveActor)(userId, this.requestContextService.getUserId());
        const trimmedReason = reason?.trim();
        if (!trimmedReason) {
            (0, module_service_utils_1.throwStockUnprocessable)('Cancellation needs a reason', [
                {
                    field: 'reason',
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
                    message: `${existing.svhRefno} was cancelled on ${cancelStep?.tslChangedOn.toISOString() ?? 'an earlier date'}.`,
                },
            ]);
        }
        const isDraft = existing.svhStatus === 'DRAFT';
        if (isDraft && !(0, stock_voucher_posting_helper_1.usesInProcessPosting)(rules)) {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is a draft`, [
                {
                    field: 'svhId',
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
            }
            else if ((0, stock_voucher_posting_helper_1.usesInProcessPosting)(rules)) {
                reversed = await (0, stock_voucher_posting_helper_1.cancelStockVoucher)(tx, {
                    rules,
                    svhId,
                    accYear,
                    actor,
                    reason: trimmedReason,
                    cancelledOn,
                });
            }
            else {
                const [row] = await tx.$queryRaw `
          SELECT stock.fn_svh_cancel(${svhId}::uuid, ${accYear}::bpchar, ${trimmedReason}, ${actor}::uuid) AS rows
        `;
                reversed = Number(row?.rows ?? 0);
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
        const actor = (0, module_service_utils_1.resolveActor)(userId, this.requestContextService.getUserId());
        const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        if (existing.svhStatus !== 'DRAFT') {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is ${existing.svhStatus}`, [
                {
                    field: 'svhId',
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
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear}.`);
        }
        const defaultGodownId = rules.requiresToGodown
            ? header.svhToGodownId
            : (header.svhFromGodownId ?? header.svhToGodownId);
        if (!defaultGodownId) {
            (0, module_service_utils_1.throwStockUnprocessable)('This document has no godown to import into', [
                {
                    field: 'svhId',
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
             sbl.sbl_stock_value
        FROM stock.stock_balance sbl
        JOIN stock.stock_lot slt                   ON slt.slt_id = sbl.sbl_lot_id
        JOIN inventory.item_master itm             ON itm.item_id = sbl.sbl_item_id
        LEFT JOIN inventory.godown_locations gdl   ON gdl.gdl_id = sbl.sbl_godown_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sbl.sbl_base_uom_id
        LEFT JOIN inventory.item_unit_master unt   ON unt.unit_id = iuc.iuc_unit_id
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
    async loadForWrite(tx, rules, svhId, accYear) {
        const existing = await tx.stockVoucher.findUnique({
            where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
            select: {
                svhId: true,
                svhRefno: true,
                svhStatus: true,
                svhIsDeleted: true,
                svhVoucherType: true,
            },
        });
        if (!existing || existing.svhVoucherType !== rules.voucherType) {
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear}.`);
        }
        return existing;
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
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear} for this company and branch.`);
        }
        return existing;
    }
    assertPostFunction(rules) {
        if (!stock_voucher_types_1.STOCK_POST_FUNCTIONS.includes(rules.postFunction)) {
            throw new common_1.InternalServerErrorException(`${rules.voucherType} is wired to post through ${rules.postFunction}, which is not one of ${stock_voucher_types_1.STOCK_POST_FUNCTIONS.join(', ')}.`);
        }
        return rules.postFunction;
    }
    assertDraft(rules, existing) {
        if (existing.svhIsDeleted) {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is deleted`, [
                { field: 'svhId', message: `${existing.svhRefno} has been deleted.` },
            ]);
        }
        if (existing.svhStatus !== 'DRAFT') {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is ${existing.svhStatus}`, [
                {
                    field: 'svhId',
                    message: `${existing.svhRefno} is ${existing.svhStatus}; only a DRAFT voucher can be edited or posted. A posted document accepts only cancel and print.`,
                },
            ]);
        }
    }
    toHeaderPayload(row) {
        return {
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
            rateSource: row.svh_rate_source,
            remarks: row.svh_remarks,
            isDeleted: row.svh_is_deleted,
        };
    }
    toLinePayload(row) {
        return {
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
            syncDate: row.svi_sync_date?.toISOString() ?? null,
            value: (0, module_service_utils_1.toNullableNumber)(row.svi_value) ?? 0,
            valueWot: (0, module_service_utils_1.toNullableNumber)(row.svi_value_wot) ?? 0,
            lotId: row.svi_lot_id,
            remarks: row.svi_remarks,
        };
    }
    auditActor(actor) {
        return actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor;
    }
    actorFor(supplied, actor) {
        const trimmed = supplied?.trim();
        return trimmed ? trimmed : this.auditActor(actor);
    }
    lineModifiedByData(supplied) {
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
        request_context_service_1.RequestContextService])
], StockVoucherService);
//# sourceMappingURL=stock-voucher.service.js.map