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
exports.StockTransferService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const stock_voucher_service_1 = require("../stock-voucher/stock-voucher.service");
const stock_transfer_types_1 = require("./types/stock-transfer.types");
let StockTransferService = class StockTransferService {
    prisma;
    stockVoucherService;
    requestContextService;
    constructor(prisma, stockVoucherService, requestContextService) {
        this.prisma = prisma;
        this.stockVoucherService = stockVoucherService;
        this.requestContextService = requestContextService;
    }
    async save(rules, dto) {
        await this.assertTransferOutRules(dto);
        return this.stockVoucherService.save(rules, dto);
    }
    async assertTransferOutRules(dto) {
        const { header, lines } = dto;
        const errors = [];
        const sameBranch = !header.toBranchId || header.toBranchId === header.branchId;
        if (sameBranch && header.fromGodownId && header.fromGodownId === header.toGodownId) {
            errors.push({
                field: 'toGodownId',
                message: 'A transfer within one branch must move the stock somewhere: the source and destination godowns are the same.',
            });
        }
        lines.forEach((line, index) => {
            const field = `lines.${index}`;
            if (header.toGodownId && line.godownId === header.toGodownId && sameBranch) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} takes stock from the godown this transfer is going to. A godown cannot transfer to itself.`,
                });
            }
        });
        if (!sameBranch) {
            const bySourceKey = new Map();
            const bucketsSeen = new Map();
            lines.forEach((line, index) => {
                const field = `lines.${index}`;
                const bucket = line.bucket ?? 'SALEABLE';
                const transitKey = `${line.itemId}|${line.lotId ?? ''}|${bucket}`;
                const matcherKey = `${line.itemId}|${line.lotId ?? ''}`;
                const clashedSource = bySourceKey.get(transitKey);
                if (clashedSource !== undefined) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo} sends the same item, lot and bucket as row ${clashedSource + 1}. One despatch carries one destination godown, so both lines would become the same transit row and the despatch would be refused. Two source godowns is two transfers.`,
                    });
                }
                else {
                    bySourceKey.set(transitKey, index);
                }
                const firstBucket = bucketsSeen.get(matcherKey);
                if (!firstBucket) {
                    bucketsSeen.set(matcherKey, { bucket, index });
                }
                else if (firstBucket.bucket !== bucket) {
                    errors.push({
                        field,
                        message: `Line ${line.lineNo} ships the same item and lot as row ${firstBucket.index + 1} in a different bucket (${bucket} against ${firstBucket.bucket}). The receiving branch matches on item and lot alone, would find two transit rows and could never post the receipt. Send them as two transfers.`,
                    });
                }
            });
        }
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('This transfer cannot be saved', errors);
        }
        await this.assertLotsAndStock(dto, errors);
    }
    async assertLotsAndStock(dto, errors) {
        const { header, lines } = dto;
        const lotIds = [...new Set(lines.map((line) => line.lotId).filter((id) => !!id))];
        if (!lotIds.length) {
            return;
        }
        const lots = await this.prisma.$queryRaw `
      SELECT slt_id, slt_item_id, slt_company_id
        FROM stock.stock_lot
       WHERE slt_id IN (${client_1.Prisma.join(lotIds)})
    `;
        const lotById = new Map(lots.map((lot) => [lot.slt_id, lot]));
        const balances = await this.prisma.$queryRaw `
      SELECT sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket, sbl_on_hand_qty
        FROM stock.stock_balance
       WHERE sbl_company_id = ${header.companyId}::uuid
         AND sbl_branch_id  = ${header.branchId}::uuid
         AND sbl_lot_id IN (${client_1.Prisma.join(lotIds)})
    `;
        const onHand = new Map(balances.map((row) => [
            this.holdingKey(row.sbl_lot_id, row.sbl_godown_id, row.sbl_bucket),
            Number(row.sbl_on_hand_qty),
        ]));
        const wanted = new Map();
        lines.forEach((line) => {
            if (!line.lotId) {
                return;
            }
            const key = this.holdingKey(line.lotId, line.godownId, line.bucket);
            const qty = Number(line.qty ?? 0) + Number(line.freeQty ?? 0);
            wanted.set(key, (wanted.get(key) ?? 0) + qty);
        });
        lines.forEach((line, index) => {
            const field = `lines.${index}`;
            if (!line.lotId) {
                return;
            }
            const lot = lotById.get(line.lotId);
            if (!lot) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} names a lot that does not exist. Pick the holding from the balance.`,
                });
                return;
            }
            if (lot.slt_company_id !== header.companyId) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} names a lot belonging to another company.`,
                });
            }
            if (lot.slt_item_id !== line.itemId) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} names a lot that belongs to a different item. The lot is the identity of the stock being moved — it cannot be carried across items.`,
                });
            }
        });
        const reported = new Set();
        lines.forEach((line, index) => {
            const field = `lines.${index}`;
            if (!line.lotId) {
                return;
            }
            const key = this.holdingKey(line.lotId, line.godownId, line.bucket);
            if (reported.has(key)) {
                return;
            }
            const available = onHand.get(key) ?? 0;
            const asked = wanted.get(key) ?? 0;
            if (asked > available) {
                reported.add(key);
                errors.push({
                    field,
                    message: `Line ${line.lineNo} sends ${asked} but this godown holds ${available} of that lot in the ${line.bucket ?? 'SALEABLE'} bucket. A transfer moves stock that exists; the engine will not stop this one under an ALLOW policy.`,
                });
            }
        });
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('This transfer cannot be saved', errors);
        }
    }
    async despatch(rules, args) {
        const { svhId, accYear, companyId, branchId } = args;
        const actor = (0, module_service_utils_1.resolveActor)(args.userId, this.requestContextService.getUserId());
        const hasLorry = args.lrNo !== undefined || args.vehicleNo !== undefined || args.expectedOn !== undefined;
        const posted = await this.stockVoucherService.post(rules, svhId, accYear, companyId, branchId, args.userId, hasLorry
            ? async (tx) => {
                await tx.stockTransit.updateMany({
                    where: { sttOutVoucherId: svhId, sttOutAccYear: accYear, sttIsDeleted: false },
                    data: {
                        ...(args.lrNo !== undefined ? { sttLrNo: args.lrNo } : {}),
                        ...(args.vehicleNo !== undefined ? { sttVehicleNo: args.vehicleNo } : {}),
                        ...(args.expectedOn !== undefined
                            ? { sttExpectedOn: args.expectedOn ? new Date(args.expectedOn) : null }
                            : {}),
                        sttModifiedOn: new Date(),
                        sttModifiedBy: actor,
                    },
                });
            }
            : undefined);
        const transit = await this.loadTransitRows(svhId, accYear);
        return {
            ...posted,
            sameBranch: !posted.header.toBranchId || posted.header.toBranchId === posted.header.branchId,
            status: posted.header.status,
            ledgerRows: posted.rowsPosted,
            transitRows: transit.length,
            transit,
        };
    }
    async getOne(rules, svhId, accYear, companyId, branchId) {
        const document = await this.stockVoucherService.getById(rules, svhId, accYear, companyId, branchId);
        return { ...document, transit: await this.loadTransitRows(svhId, accYear) };
    }
    async inbound(companyId, branchId, limit = 100, offset = 0) {
        const rows = await this.prisma.$queryRaw `
      SELECT t.stt_id, t.stt_status, t.stt_item_id, t.stt_lot_id, t.stt_to_godown_id,
             t.stt_bucket, t.stt_base_uom_id, t.stt_sent_qty, t.stt_received_qty,
             t.stt_damage_qty,
             t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty AS remaining_qty,
             t.stt_cost_rate, t.stt_transit_value, t.stt_lr_no, t.stt_vehicle_no,
             t.stt_expected_on, t.stt_sent_on, t.stt_received_on,
             t.stt_out_refno, t.stt_from_branch_id,
             EXTRACT(DAY FROM now() - t.stt_sent_on)::int AS days_in_flight,
             i.item_code, i.item_name_en AS item_name,
             l.slt_batch_no AS batch_no, l.slt_expiry_date AS expiry_date,
             g.gdl_name AS to_godown_name,
             u.unit_name,
             COUNT(*) OVER () AS total_count
        FROM stock.stock_transit t
        JOIN inventory.item_master i ON i.item_id = t.stt_item_id
        LEFT JOIN stock.stock_lot l ON l.slt_id = t.stt_lot_id
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = t.stt_to_godown_id
        LEFT JOIN inventory.item_unit_conversion c ON c.iuc_id = t.stt_base_uom_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = c.iuc_unit_id
       WHERE t.stt_company_id = ${companyId}::uuid
         AND t.stt_to_branch_id = ${branchId}::uuid
         AND t.stt_is_deleted = false
         AND t.stt_status IN ('IN_TRANSIT', 'PARTIAL')
       ORDER BY t.stt_sent_on ASC
       LIMIT ${limit} OFFSET ${offset}
    `;
        return {
            items: rows.map((row) => ({
                ...this.toTransitRow(row),
                outRefno: row.stt_out_refno,
                fromBranchId: row.stt_from_branch_id,
                daysInFlight: Number(row.days_in_flight ?? 0),
            })),
            meta: { limit, offset, count: Number(rows[0]?.total_count ?? 0) },
        };
    }
    async prefill(companyId, branchId, outVoucherId, accYear) {
        const [out] = await this.prisma.$queryRaw `
      SELECT svh_id, svh_acc_year, svh_refno, svh_doc_date, svh_status, svh_branch_id,
             svh_from_godown_id, svh_to_branch_id, svh_to_godown_id, svh_is_deleted
        FROM stock.stock_voucher
       WHERE svh_id = ${outVoucherId}::uuid
         AND svh_acc_year = ${accYear}::bpchar
         AND svh_company_id = ${companyId}::uuid
         AND svh_voucher_type = 'TRANSFER_OUT'
    `;
        if (!out) {
            (0, module_service_utils_1.throwStockNotFound)('Transfer not found', 'outVoucherId', `No TRANSFER_OUT ${outVoucherId} in ${accYear} for this company.`);
        }
        this.assertReceivable(out, branchId);
        const rows = await this.loadTransitRows(outVoucherId, accYear, { openOnly: true });
        return {
            outVoucher: {
                svhId: out.svh_id,
                accYear: out.svh_acc_year.trim(),
                refno: out.svh_refno,
                docDate: this.toIsoDate(out.svh_doc_date),
                status: out.svh_status,
                fromBranchId: out.svh_branch_id,
                fromGodownId: out.svh_from_godown_id,
                toBranchId: out.svh_to_branch_id,
                toGodownId: out.svh_to_godown_id,
            },
            rows: rows.map((row, index) => ({ ...row, lineNo: index + 1 })),
        };
    }
    assertReceivable(out, branchId) {
        if (out.svh_is_deleted) {
            (0, module_service_utils_1.throwStockConflict)('Transfer is deleted', [
                {
                    field: 'outVoucherId',
                    message: `${out.svh_refno} has been deleted by the sending branch.`,
                },
            ]);
        }
        if (out.svh_to_branch_id !== branchId) {
            (0, module_service_utils_1.throwStockConflict)('Transfer is for another branch', [
                {
                    field: 'branchId',
                    message: `${out.svh_refno} was sent to another branch. A transfer can only be received where it was addressed.`,
                },
            ]);
        }
        if (out.svh_status !== 'IN_TRANSIT') {
            (0, module_service_utils_1.throwStockConflict)(`Transfer is ${out.svh_status}`, [
                {
                    field: 'outVoucherId',
                    message: out.svh_status === 'RECEIVED'
                        ? `${out.svh_refno} has already been received in full.`
                        : `${out.svh_refno} is ${out.svh_status}; only a despatched transfer can be received. A same-branch transfer posts both halves at once and has nothing to receive.`,
                },
            ]);
        }
    }
    async saveReceive(rules, dto) {
        const { header } = dto;
        const [out] = await this.prisma.$queryRaw `
      SELECT svh_id, svh_refno, svh_status, svh_branch_id, svh_from_godown_id,
             svh_to_branch_id, svh_to_godown_id, svh_is_deleted
        FROM stock.stock_voucher
       WHERE svh_id = ${header.linkSrcDocId}::uuid
         AND svh_acc_year = ${header.linkSrcAccYear}::bpchar
         AND svh_company_id = ${header.companyId}::uuid
         AND svh_voucher_type = 'TRANSFER_OUT'
    `;
        if (!out) {
            (0, module_service_utils_1.throwStockNotFound)('Transfer not found', 'linkSrcDocId', `No TRANSFER_OUT ${header.linkSrcDocId} in ${header.linkSrcAccYear} for this company. A receipt must name the despatch it is against.`);
        }
        this.assertReceivable(out, header.branchId);
        const transit = await this.loadTransitRows(header.linkSrcDocId, header.linkSrcAccYear, {
            openOnly: true,
        });
        this.assertReceiveLines(dto, transit);
        const payload = {
            ...dto,
            header: {
                ...dto.header,
                linkSrcModule: stock_transfer_types_1.TRANSFER_LINK_SRC_MODULE,
                linkSrcDocType: stock_transfer_types_1.TRANSFER_LINK_SRC_DOC_TYPE,
                fromGodownId: out.svh_from_godown_id,
                toGodownId: out.svh_to_godown_id,
            },
        };
        return this.stockVoucherService.save(rules, payload);
    }
    assertReceiveLines(dto, transit) {
        const errors = [];
        const { lines } = dto;
        if (!lines.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('This receipt cannot be saved', [
                {
                    field: 'lines',
                    message: 'A receipt records what ARRIVED. If nothing arrived there is no receipt to raise — a short is what remains unkeyed, and it keeps the transfer open by itself.',
                },
            ]);
        }
        const byMatcher = new Map();
        transit.forEach((row) => {
            const key = `${row.itemId}|${row.lotId}|${row.toGodownId}`;
            byMatcher.set(key, [...(byMatcher.get(key) ?? []), row]);
        });
        const claimed = new Map();
        lines.forEach((line) => {
            const key = `${line.itemId}|${line.lotId ?? ''}|${line.godownId}`;
            claimed.set(key, (claimed.get(key) ?? 0) + this.lineQty(line));
        });
        const reported = new Set();
        lines.forEach((line, index) => {
            const field = `lines.${index}`;
            const key = `${line.itemId}|${line.lotId ?? ''}|${line.godownId}`;
            const rows = byMatcher.get(key);
            if (!rows?.length) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo}: nothing of this lot is in transit to this godown. The receipt grid is opened from the despatch — godownId here is the DESTINATION, not where the stock came from.`,
                });
                return;
            }
            if (rows.length > 1) {
                errors.push({
                    field,
                    message: `Line ${line.lineNo}: this item and lot were shipped in more than one bucket (${rows.map((row) => row.bucket).join(', ')}). The receipt cannot tell them apart. The sender must cancel and ship them as separate transfers.`,
                });
                return;
            }
            const row = rows[0];
            const bucket = line.bucket ?? 'SALEABLE';
            if (bucket !== row.bucket && bucket !== 'DAMAGED') {
                errors.push({
                    field,
                    message: `Line ${line.lineNo} was shipped as ${row.bucket} and is being received as ${bucket}. Stock cannot change bucket by arriving — receive it as ${row.bucket}, or as DAMAGED if it arrived broken.`,
                });
            }
            if (!reported.has(key)) {
                const asked = claimed.get(key) ?? 0;
                if (asked > row.remainingQty) {
                    reported.add(key);
                    errors.push({
                        field,
                        message: `Line ${line.lineNo} receives ${asked} but only ${row.remainingQty} of that lot is still in transit (${row.sentQty} sent, ${row.receivedQty} already received, ${row.damageQty} damaged). A second receipt opens with the remainder, not the original quantity.`,
                    });
                }
            }
        });
        if (errors.length) {
            (0, module_service_utils_1.throwStockUnprocessable)('This receipt cannot be saved', errors);
        }
    }
    lineQty(line) {
        return Number(line.qty ?? 0) + Number(line.freeQty ?? 0);
    }
    async receive(rules, svhId, accYear, companyId, branchId, userId) {
        const draft = await this.stockVoucherService.getById(rules, svhId, accYear, companyId, branchId);
        const outId = draft.header.linkSrcDocId;
        const outAccYear = draft.header.linkSrcAccYear;
        if (!outId || !outAccYear) {
            (0, module_service_utils_1.throwStockConflict)('Receipt links no transfer', [
                {
                    field: 'linkSrcDocId',
                    message: `${draft.header.refno} names no despatch. A receipt cannot be posted without the transfer it is against.`,
                },
            ]);
        }
        const posted = await this.stockVoucherService.post(rules, svhId, accYear, companyId, branchId, userId);
        const [out] = await this.prisma.$queryRaw `
      SELECT svh_id, svh_acc_year, svh_refno, svh_status
        FROM stock.stock_voucher
       WHERE svh_id = ${outId}::uuid AND svh_acc_year = ${outAccYear}::bpchar
    `;
        const transit = await this.loadTransitRows(outId, outAccYear);
        return {
            inVoucher: { ...posted, ledgerRows: posted.rowsPosted, status: posted.header.status },
            outVoucher: {
                svhId: out?.svh_id ?? outId,
                accYear: (out?.svh_acc_year ?? outAccYear).trim(),
                refno: out?.svh_refno ?? '',
                status: (out?.svh_status ?? 'IN_TRANSIT'),
                closed: transit.every((row) => row.remainingQty <= 0),
            },
            transit,
        };
    }
    async loadTransitRows(outVoucherId, outAccYear, options = {}) {
        const openOnly = options.openOnly === true;
        const rows = await this.prisma.$queryRaw `
      SELECT t.stt_id, t.stt_status, t.stt_item_id, t.stt_lot_id, t.stt_to_godown_id,
             t.stt_bucket, t.stt_base_uom_id, t.stt_sent_qty, t.stt_received_qty,
             t.stt_damage_qty,
             t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty AS remaining_qty,
             t.stt_cost_rate, t.stt_transit_value, t.stt_lr_no, t.stt_vehicle_no,
             t.stt_expected_on, t.stt_sent_on, t.stt_received_on,
             i.item_code, i.item_name_en AS item_name,
             l.slt_batch_no AS batch_no, l.slt_expiry_date AS expiry_date,
             g.gdl_name AS to_godown_name,
             u.unit_name
        FROM stock.stock_transit t
        JOIN inventory.item_master i ON i.item_id = t.stt_item_id
        LEFT JOIN stock.stock_lot l ON l.slt_id = t.stt_lot_id
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = t.stt_to_godown_id
        LEFT JOIN inventory.item_unit_conversion c ON c.iuc_id = t.stt_base_uom_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = c.iuc_unit_id
       WHERE t.stt_out_voucher_id = ${outVoucherId}::uuid
         AND t.stt_out_acc_year = ${outAccYear}::bpchar
         AND t.stt_is_deleted = false
         AND (${openOnly}::boolean = false
              OR t.stt_sent_qty - t.stt_received_qty - t.stt_damage_qty > 0)
       ORDER BY i.item_name, t.stt_bucket
    `;
        return rows.map((row) => this.toTransitRow(row));
    }
    toTransitRow(row) {
        return {
            sttId: row.stt_id,
            status: row.stt_status,
            itemId: row.stt_item_id,
            itemCode: row.item_code,
            itemName: row.item_name,
            lotId: row.stt_lot_id,
            batchNo: row.batch_no,
            expiryDate: this.toIsoDate(row.expiry_date),
            toGodownId: row.stt_to_godown_id,
            toGodownName: row.to_godown_name,
            bucket: row.stt_bucket,
            baseUomId: row.stt_base_uom_id,
            unitName: row.unit_name,
            sentQty: Number(row.stt_sent_qty),
            receivedQty: Number(row.stt_received_qty),
            damageQty: Number(row.stt_damage_qty),
            remainingQty: Number(row.remaining_qty),
            costRate: Number(row.stt_cost_rate),
            transitValue: Number(row.stt_transit_value),
            lrNo: row.stt_lr_no,
            vehicleNo: row.stt_vehicle_no,
            expectedOn: this.toIsoDate(row.stt_expected_on),
            sentOn: row.stt_sent_on ? row.stt_sent_on.toISOString() : null,
            receivedOn: row.stt_received_on ? row.stt_received_on.toISOString() : null,
        };
    }
    toIsoDate(value) {
        return value ? value.toISOString().slice(0, 10) : null;
    }
    holdingKey(lotId, godownId, bucket) {
        return `${lotId ?? ''}|${godownId}|${bucket ?? 'SALEABLE'}`;
    }
};
exports.StockTransferService = StockTransferService;
exports.StockTransferService = StockTransferService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        stock_voucher_service_1.StockVoucherService,
        request_context_service_1.RequestContextService])
], StockTransferService);
//# sourceMappingURL=stock-transfer.service.js.map