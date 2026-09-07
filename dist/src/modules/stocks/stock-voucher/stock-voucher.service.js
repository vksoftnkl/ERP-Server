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
const STOCK_VOUCHER_TABLE_NAME = 'stock_voucher';
const STOCK_VOUCHER_ITEM_TABLE_NAME = 'stock_voucher_item';
const DEFAULT_REPORT_LIMIT = 200;
const MAX_REPORT_LIMIT = 1000;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 500;
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
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
        const conversions = await this.resolveConversions(dto.lines);
        this.assertUnitsBelongToItems(dto.lines, conversions);
        const svhId = await this.prisma.$transaction(async (tx) => {
            return header.svhId
                ? await this.updateDraft(tx, rules, dto, actor)
                : await this.createDraft(tx, rules, dto, actor);
        });
        return this.getById(rules, svhId, header.accYear, header.companyId, header.branchId);
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
        if (!lines.length) {
            errors.push({ field: 'lines', message: 'A document must have at least one line.' });
        }
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
            else if (qty === 0 && freeQty === 0) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} has no quantity.`,
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
            if (rules.isInward && this.toDecimalNumber(line.costRate ?? 0) === 0 && !header.rateSource) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} brings stock in at cost 0 and the document names no rate source. Set a cost rate, or a rateSource for the engine to derive one from.`,
                });
            }
        });
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be saved`, errors);
        }
    }
    async resolveConversions(lines) {
        const uomIds = [...new Set(lines.map((line) => line.uomId))];
        if (!uomIds.length) {
            return new Map();
        }
        const rows = await this.prisma.itemUnitConversion.findMany({
            where: { iucId: { in: uomIds }, iucIsDeleted: false },
            select: {
                iucId: true,
                iucItemId: true,
                iucToBaseFactor: true,
                iucBaseUnitId: true,
                item: {
                    select: {
                        unitConversions: {
                            where: { iucIsBaseUnit: true, iucIsDeleted: false },
                            select: { iucId: true },
                            take: 1,
                        },
                    },
                },
            },
        });
        const map = new Map();
        for (const row of rows) {
            map.set(row.iucId, {
                iucId: row.iucId,
                itemId: row.iucItemId,
                toBaseFactor: (0, module_service_utils_1.toNumber)(row.iucToBaseFactor),
                baseIucId: row.item?.unitConversions[0]?.iucId ?? null,
            });
        }
        return map;
    }
    assertUnitsBelongToItems(lines, conversions) {
        const errors = [];
        lines.forEach((line, index) => {
            const conversion = conversions.get(line.uomId);
            if (!conversion) {
                errors.push({
                    field: `lines.${index}`,
                    message: `Line ${line.lineNo}: no item_unit_conversion row ${line.uomId}. uomId is an iuc_id, not a unit_id.`,
                });
                return;
            }
            if (conversion.itemId !== line.itemId) {
                errors.push({
                    field: `lines.${index}`,
                    message: `Line ${line.lineNo}: the unit does not belong to this item.`,
                });
            }
            if (!conversion.baseIucId && !line.baseUomId) {
                errors.push({
                    field: `lines.${index}`,
                    message: `Line ${line.lineNo}: the item has no base unit in item_unit_conversion, so svi_base_uom_id cannot be resolved. Send baseUomId, or set a base unit on the item.`,
                });
            }
        });
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('Unit resolution failed', errors);
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
        const { slno, refno } = await (0, stock_voucher_numbering_helper_1.allocateStockVoucherNumber)(tx, scope, rules.typeCode, {
            slno: header.slno,
            refno: header.refno,
        });
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
                svhSupplierId: header.supplierId ?? null,
                svhRateSource: header.rateSource ?? null,
                svhRemarks: header.remarks ?? null,
                svhStatus: 'DRAFT',
                svhCreatedBy: actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor,
            },
            select: { svhId: true, svhAccYear: true, svhRefno: true },
        });
        await this.replaceLines(tx, rules, dto, created.svhId, actor);
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
        return created.svhId;
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
                svhSupplierId: header.supplierId ?? null,
                svhRateSource: header.rateSource ?? null,
                svhRemarks: header.remarks ?? null,
                svhVersionNo: { increment: 1 },
                svhModifiedOn: new Date(),
                svhModifiedBy: actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor,
            },
        });
        await this.replaceLines(tx, rules, dto, svhId, actor);
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
    async replaceLines(tx, rules, dto, svhId, actor) {
        const { header, lines } = dto;
        await tx.stockVoucherItem.deleteMany({
            where: { sviVoucherId: svhId, sviAccYear: header.accYear },
        });
        if (!lines.length) {
            return;
        }
        const conversions = await this.resolveConversions(lines);
        const data = lines.map((line) => {
            const conversion = conversions.get(line.uomId);
            const factor = conversion.toBaseFactor;
            const qty = this.toDecimalNumber(line.qty);
            const freeQty = this.toDecimalNumber(line.freeQty ?? 0);
            return {
                sviVoucherId: svhId,
                sviCompanyId: header.companyId,
                sviBranchId: header.branchId,
                sviTenantId: header.tenantId ?? null,
                sviAccYear: header.accYear,
                sviLineNo: line.lineNo,
                sviSplitNo: line.splitNo ?? 1,
                sviItemId: line.itemId,
                sviUomId: line.uomId,
                sviBaseUomId: line.baseUomId ?? conversion.baseIucId,
                sviToBaseFactor: new client_1.Prisma.Decimal(factor),
                sviGodownId: line.godownId,
                sviLotId: null,
                sviBucket: (line.bucket ?? 'SALEABLE'),
                sviBatchNo: line.batchNo ?? null,
                sviMfgDate: line.mfgDate ? new Date(`${line.mfgDate}T00:00:00Z`) : null,
                sviExpiryDate: line.expiryDate ? new Date(`${line.expiryDate}T00:00:00Z`) : null,
                sviMrp: this.toNullableDecimal(line.mrp),
                sviSalePrice: this.toNullableDecimal(line.salePrice),
                sviSerialNo: line.serialNo ?? null,
                sviSupplierId: line.supplierId ?? null,
                sviQty: new client_1.Prisma.Decimal(qty),
                sviBaseQty: new client_1.Prisma.Decimal(qty * factor),
                sviFreeQty: new client_1.Prisma.Decimal(freeQty),
                sviFreeBaseQty: new client_1.Prisma.Decimal(freeQty * factor),
                sviCostRate: new client_1.Prisma.Decimal(this.toDecimalNumber(line.costRate)),
                sviCostRateWot: new client_1.Prisma.Decimal(this.toDecimalNumber(line.costRateWot ?? 0)),
                sviTaxPerc: new client_1.Prisma.Decimal(this.toDecimalNumber(line.taxPerc ?? 0)),
                sviRemarks: line.remarks ?? null,
                sviCreatedBy: actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor,
            };
        });
        await tx.stockVoucherItem.createMany({ data });
        await this.auditLogService.logEntityChange({
            action: 'update',
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
             svh.svh_posted_on,
             svh.svh_rate_source,
             svh.svh_remarks
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations gdl ON gdl.gdl_id = svh.svh_to_godown_id
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
                postedOn: row.svh_posted_on?.toISOString() ?? null,
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
             svh.svh_status,
             svh.svh_line_count,
             svh.svh_total_qty,
             svh.svh_total_value,
             svh.svh_total_value_wot,
             svh.svh_posted_on,
             svh.svh_posted_by,
             usr.usr_display_name AS posted_by_name,
             svh.svh_cancelled_on,
             svh.svh_cancel_reason,
             svh.svh_rate_source,
             svh.svh_remarks,
             svh.svh_is_deleted
        FROM stock.stock_voucher svh
        LEFT JOIN inventory.godown_locations fgd ON fgd.gdl_id = svh.svh_from_godown_id
        LEFT JOIN inventory.godown_locations tgd ON tgd.gdl_id = svh.svh_to_godown_id
        LEFT JOIN public.user_master usr         ON usr.usr_id = svh.svh_posted_by
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
             svi.svi_batch_no,
             svi.svi_mfg_date,
             svi.svi_expiry_date,
             svi.svi_mrp,
             svi.svi_sale_price,
             svi.svi_serial_no,
             svi.svi_supplier_id,
             svi.svi_qty,
             svi.svi_base_qty,
             svi.svi_free_qty,
             svi.svi_free_base_qty,
             svi.svi_cost_rate,
             svi.svi_cost_rate_wot,
             svi.svi_tax_perc,
             svi.svi_value,
             svi.svi_value_wot,
             svi.svi_lot_id,
             svi.svi_remarks
        FROM stock.stock_voucher_item svi
        JOIN inventory.item_master itm            ON itm.item_id = svi.svi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = svi.svi_uom_id
        LEFT JOIN inventory.item_unit_master unt  ON unt.unit_id = iuc.iuc_unit_id
        LEFT JOIN inventory.godown_locations gdl  ON gdl.gdl_id = svi.svi_godown_id
       WHERE svi.svi_voucher_id = ${svhId}::uuid
         AND svi.svi_acc_year   = ${accYear}::bpchar
         AND svi.svi_is_deleted = false
       ORDER BY svi.svi_line_no, svi.svi_split_no
    `;
        return { header: this.toHeaderPayload(header), lines: lines.map((row) => this.toLinePayload(row)) };
    }
    async validate(rules, svhId, accYear, companyId, branchId) {
        await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        return this.prisma.$queryRaw `
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
      policy AS (
        SELECT line.svi_id,
               COALESCE(stp.stp_track_batch,      false) AS track_batch,
               COALESCE(stp.stp_track_mrp,        false) AS track_mrp,
               COALESCE(stp.stp_track_sale_price, false) AS track_sale_price,
               COALESCE(stp.stp_track_expiry,     false) AS track_expiry,
               COALESCE(stp.stp_track_serial,     false) AS track_serial,
               COALESCE(stp.stp_track_supplier,   false) AS track_supplier
          FROM line
          JOIN inventory.item_master itm ON itm.item_id = line.svi_item_id
          LEFT JOIN LATERAL (
            SELECT p.*
              FROM stock.stock_track_policy p
             WHERE p.stp_is_active  = true
               AND p.stp_is_deleted = false
               AND line.svh_doc_date BETWEEN p.stp_effective_from AND p.stp_effective_to
               AND (p.stp_company_id IS NULL OR p.stp_company_id = line.svh_company_id)
               AND (p.stp_branch_id  IS NULL OR p.stp_branch_id  = line.svh_branch_id)
               AND (
                     (p.stp_scope = 'ITEM'    AND p.stp_scope_id = line.svi_item_id)
                  OR (p.stp_scope = 'GROUP'   AND p.stp_scope_id = itm.item_group_id)
                  OR  p.stp_scope = 'COMPANY'
               )
             ORDER BY (p.stp_branch_id IS NOT NULL) DESC,
                      (p.stp_company_id IS NOT NULL) DESC,
                      CASE p.stp_scope WHEN 'ITEM' THEN 0 WHEN 'GROUP' THEN 1 ELSE 2 END,
                      p.stp_effective_from DESC
             LIMIT 1
          ) stp ON true
      ),
      -- The identity fn_slt_resolve would key on: each dimension blanked when
      -- the policy does not track it, then collapsed to the same sentinels
      -- ux_slt_identity is built over ('~', -1, 0001-01-01, the nil uuid).
      keyed AS (
        SELECT line.*,
               policy.track_batch, policy.track_mrp, policy.track_sale_price,
               policy.track_expiry, policy.track_serial, policy.track_supplier,
               COALESCE(CASE WHEN policy.track_batch       THEN NULLIF(line.svi_batch_no, '') END, '~')          AS key_batch,
               COALESCE(CASE WHEN policy.track_mrp         THEN line.svi_mrp        END, -1)                     AS key_mrp,
               COALESCE(CASE WHEN policy.track_sale_price  THEN line.svi_sale_price END, -1)                     AS key_sp,
               COALESCE(CASE WHEN policy.track_expiry      THEN line.svi_expiry_date END, DATE '0001-01-01')     AS key_expiry,
               COALESCE(CASE WHEN policy.track_serial      THEN NULLIF(line.svi_serial_no, '') END, '~')         AS key_serial,
               COALESCE(CASE WHEN policy.track_supplier    THEN line.svi_supplier_id END, ${NIL_UUID}::uuid)     AS key_supplier
          FROM line
          JOIN policy ON policy.svi_id = line.svi_id
      ),
      -- Has this holding already been opened this year? Matched through the
      -- lot's generated key columns and the OPENING rows in the ledger, NOT
      -- through the documents: a cancelled opening is reversed in the ledger
      -- and must correctly read as "not opened".
      opened AS (
        SELECT keyed.svi_id,
               EXISTS (
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
                    AND sml.sml_is_deleted  = false
                    AND sml.sml_src_doc_id <> keyed.svi_voucher_id
               ) AS already_opened
          FROM keyed
      )
      SELECT keyed.svi_id                             AS "sviId",
             keyed.svi_line_no                        AS "lineNo",
             keyed.svi_split_no                       AS "splitNo",
             keyed.svi_item_id                        AS "itemId",
             itm.item_code                            AS "itemCode",
             itm.item_name_en                         AS "itemName",
             CASE
               WHEN keyed.svi_qty = 0 AND keyed.svi_free_qty = 0
                 THEN 'this line has no quantity'
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
               WHEN ${rules.isInward}::boolean AND keyed.svi_cost_rate = 0 AND keyed.svh_rate_source IS NULL
                 THEN 'this line brings stock in with no cost rate and the document names no rate source'
               WHEN keyed.svh_rate_source = 'AVG_COST' AND sic.sic_avg_cost_rate IS NULL
                 THEN 'the rate source is AVG_COST and this item has no average cost yet'
               WHEN opened.already_opened
                 THEN 'this holding already has an opening in this year'
               ELSE NULL
             END                                      AS "problem"
        FROM keyed
        JOIN opened ON opened.svi_id = keyed.svi_id
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
    async post(rules, svhId, accYear, companyId, branchId, userId) {
        const actor = (0, module_service_utils_1.resolveActor)(userId, this.requestContextService.getUserId());
        const existing = await this.loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId);
        this.assertDraft(rules, existing);
        const problems = (await this.validate(rules, svhId, accYear, companyId, branchId)).filter((row) => row.problem !== null);
        if (problems.length) {
            (0, module_service_utils_1.throwStockUnprocessable)(`This ${rules.displayName.toLowerCase()} cannot be posted`, problems.map((row) => ({
                field: `lines.${row.lineNo}`,
                message: `Line ${row.lineNo}${row.splitNo > 1 ? ` split ${row.splitNo}` : ''} (${row.itemName}): ${row.problem}`,
            })));
        }
        const rowsPosted = await this.prisma.$transaction(async (tx) => {
            const [row] = await tx.$queryRaw `
        SELECT stock.fn_svh_post(${svhId}::uuid, ${accYear}::bpchar, ${actor}::uuid) AS rows
      `;
            return Number(row?.rows ?? 0);
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
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} already cancelled`, [
                {
                    field: 'svhId',
                    message: `${existing.svhRefno} was cancelled on ${existing.svhCancelledOn?.toISOString() ?? 'an earlier date'}.`,
                },
            ]);
        }
        if (existing.svhStatus === 'DRAFT') {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is a draft`, [
                {
                    field: 'svhId',
                    message: `${existing.svhRefno} is DRAFT and has moved no stock, so there is nothing to reverse. Delete it instead.`,
                },
            ]);
        }
        const rowsReversed = await this.prisma.$transaction(async (tx) => {
            const [row] = await tx.$queryRaw `
        SELECT stock.fn_svh_cancel(${svhId}::uuid, ${accYear}::bpchar, ${trimmedReason}, ${actor}::uuid) AS rows
      `;
            return Number(row?.rows ?? 0);
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
            notes: `${rules.displayName} cancelled: ${trimmedReason}`,
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
                    message: `${existing.svhRefno} is ${existing.svhStatus} and has ledger rows. Cancel it — a cancellation reverses the movement; a soft delete would only hide the document while its stock stayed.`,
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
                    svhModifiedBy: actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor,
                },
            });
            await tx.stockVoucherItem.updateMany({
                where: { sviVoucherId: svhId, sviAccYear: accYear },
                data: {
                    sviIsDeleted: true,
                    sviModifiedOn: modifiedOn,
                    sviModifiedBy: actor === module_service_utils_1.DEFAULT_ACTOR ? null : actor,
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
        });
        return { svhId, accYear, deleted: true };
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
              AND sml.sml_txn_type   = ${rules.ledgerTxnType}
              AND sml.sml_is_deleted = false
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
           AND sml.sml_txn_type   = ${rules.ledgerTxnType}
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
    async loadForWrite(tx, rules, svhId, accYear) {
        const existing = await tx.stockVoucher.findUnique({
            where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
            select: {
                svhId: true,
                svhRefno: true,
                svhStatus: true,
                svhIsDeleted: true,
                svhVoucherType: true,
                svhCancelledOn: true,
            },
        });
        if (!existing || existing.svhVoucherType !== rules.voucherType) {
            (0, module_service_utils_1.throwStockNotFound)(`${rules.displayName} not found`, 'svhId', `No ${rules.voucherType} voucher ${svhId} in ${accYear}.`);
        }
        return existing;
    }
    async loadHeaderOrThrow(rules, svhId, accYear, companyId, branchId) {
        const existing = await this.prisma.stockVoucher.findUnique({
            where: { svhId_svhAccYear: { svhId, svhAccYear: accYear } },
            select: {
                svhId: true,
                svhRefno: true,
                svhStatus: true,
                svhIsDeleted: true,
                svhVoucherType: true,
                svhCompanyId: true,
                svhBranchId: true,
                svhCancelledOn: true,
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
    assertDraft(rules, existing) {
        if (existing.svhIsDeleted) {
            (0, module_service_utils_1.throwStockConflict)(`${rules.displayName} is deleted`, [{ field: 'svhId', message: `${existing.svhRefno} has been deleted.` }]);
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
            status: row.svh_status,
            lineCount: row.svh_line_count,
            totalQty: (0, module_service_utils_1.toNumber)(row.svh_total_qty),
            totalValue: (0, module_service_utils_1.toNumber)(row.svh_total_value),
            totalValueWot: (0, module_service_utils_1.toNumber)(row.svh_total_value_wot),
            postedOn: row.svh_posted_on?.toISOString() ?? null,
            postedBy: row.svh_posted_by,
            postedByName: row.posted_by_name,
            cancelledOn: row.svh_cancelled_on?.toISOString() ?? null,
            cancelReason: row.svh_cancel_reason,
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
            batchNo: row.svi_batch_no,
            mfgDate: this.toIsoDate(row.svi_mfg_date),
            expiryDate: this.toIsoDate(row.svi_expiry_date),
            mrp: (0, module_service_utils_1.toNullableNumber)(row.svi_mrp),
            salePrice: (0, module_service_utils_1.toNullableNumber)(row.svi_sale_price),
            serialNo: row.svi_serial_no,
            supplierId: row.svi_supplier_id,
            qty: (0, module_service_utils_1.toNumber)(row.svi_qty),
            baseQty: (0, module_service_utils_1.toNumber)(row.svi_base_qty),
            freeQty: (0, module_service_utils_1.toNumber)(row.svi_free_qty),
            freeBaseQty: (0, module_service_utils_1.toNumber)(row.svi_free_base_qty),
            costRate: (0, module_service_utils_1.toNumber)(row.svi_cost_rate),
            costRateWot: (0, module_service_utils_1.toNumber)(row.svi_cost_rate_wot),
            taxPerc: (0, module_service_utils_1.toNumber)(row.svi_tax_perc),
            value: (0, module_service_utils_1.toNullableNumber)(row.svi_value) ?? 0,
            valueWot: (0, module_service_utils_1.toNullableNumber)(row.svi_value_wot) ?? 0,
            lotId: row.svi_lot_id,
            remarks: row.svi_remarks,
        };
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