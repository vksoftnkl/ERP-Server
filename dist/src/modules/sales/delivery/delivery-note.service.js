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
exports.q3 = exports.DeliveryNoteService = void 0;
exports.parseQty = parseQty;
exports.istToday = istToday;
exports.accYearOf = accYearOf;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const txn_status_log_helper_1 = require("../../../common/txn-status-log/txn-status-log.helper");
const sales_context_service_1 = require("../posting/sales-context.service");
const transport_band_service_1 = require("../posting/transport-band.service");
const sales_guards_1 = require("../posting/sales.guards");
const delivery_constants_1 = require("./core/delivery.constants");
const delivery_pending_service_1 = require("./core/delivery-pending.service");
const delivery_status_service_1 = require("./core/delivery-status.service");
const delivery_weight_1 = require("./core/delivery-weight");
const delivery_note_numbering_1 = require("./delivery-note-numbering");
const delivery_note_read_service_1 = require("./delivery-note-read.service");
const delivery_note_rules_1 = require("./delivery-note.rules");
const delivery_stock_correction_service_1 = require("./delivery-stock-correction.service");
const delivery_errors_1 = require("./delivery.errors");
const delivery_note_dto_1 = require("./dto/delivery-note.dto");
const TX = { timeout: 60_000, maxWait: 10_000 };
const Z = new client_1.Prisma.Decimal(0);
const q3 = (d) => d.toDecimalPlaces(3).toString();
exports.q3 = q3;
const RIGHT_CODE = {
    view: delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_VIEW,
    create: delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_CREATE,
    edit: delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_EDIT,
    delete: delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_DELETE,
    post: delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_POST,
    cancel: delivery_constants_1.DELIVERY_ERROR_CODES.DN_RIGHT_CANCEL,
};
let DeliveryNoteService = class DeliveryNoteService {
    prisma;
    salesContext;
    pending;
    status;
    corrections;
    reader;
    transportBand;
    audit;
    constructor(prisma, salesContext, pending, status, corrections, reader, transportBand, audit) {
        this.prisma = prisma;
        this.salesContext = salesContext;
        this.pending = pending;
        this.status = status;
        this.corrections = corrections;
        this.reader = reader;
        this.transportBand = transportBand;
        this.audit = audit;
    }
    async rights(client) {
        return this.salesContext.rights(delivery_constants_1.DELIVERY_MENU_ID.DELIVERY_NOTE, client);
    }
    assertRight(rights, verb) {
        if (!rights[verb]) {
            (0, delivery_errors_1.refuseWith)(RIGHT_CODE[verb], `This user may not ${verb} delivery notes (menu 305)`, 'userId', {
                verb,
            });
        }
    }
    async get(q) {
        const rights = await this.rights();
        this.assertRight(rights, 'view');
        return this.reader.payload(null, q, rights);
    }
    async scan(q) {
        this.assertRight(await this.rights(), 'view');
        return this.reader.scan(q);
    }
    async openLines(q) {
        this.assertRight(await this.rights(), 'view');
        return this.reader.openLines(null, q.companyId, q.branchId, q.godownId, q.bills);
    }
    async lots(q) {
        this.assertRight(await this.rights(), 'view');
        return this.reader.lots(q);
    }
    async save(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const rights = await this.rights(tx);
            const existing = dto.sdnId ? await this.lockNote(tx, dto.companyId, dto.sdnId) : null;
            this.assertRight(rights, existing ? 'edit' : 'create');
            await (0, sales_guards_1.assertAccYearWritable)(tx, dto.companyId, dto.accYear, 'accYear');
            if (existing) {
                this.assertDraft(existing, dto.baseRevision);
            }
            const r = await this.resolve(tx, dto, 'save', existing, rights);
            const first = (0, delivery_note_rules_1.firstRefusal)((0, delivery_note_rules_1.checkDeliveryNote)(r.header, r.lines, {
                phase: 'save',
                companyId: dto.companyId,
                branchId: dto.branchId,
                canOverride: rights.override,
                overrideWarnings: [],
            }));
            if (first) {
                (0, delivery_errors_1.raiseNote)(first);
            }
            const before = existing ? await this.reader.payload(tx, this.keysOf(existing), rights) : null;
            const note = await this.writeDraft(tx, dto, existing, r, actor, now);
            if (!existing) {
                await this.step(tx, note, txn_status_log_helper_1.TxnStatusEvent.CREATED, null, delivery_constants_1.DN_STATUS.DRAFT, actor, now, null);
            }
            await this.revision(tx, note, before, rights, actor, existing ? 'Delivery note saved' : 'Delivery note created');
            return this.reader.payload(tx, this.keysOf(note), rights);
        }, TX);
    }
    async validate(dto) {
        const rights = await this.rights();
        if (!rights.create && !rights.edit) {
            this.assertRight(rights, 'create');
        }
        return this.prisma.$transaction(async (tx) => {
            const existing = dto.sdnId ? await this.reader.header(tx, { companyId: dto.companyId, sdnId: dto.sdnId }) : null;
            const r = await this.resolve(tx, dto, 'validate', existing, rights);
            const notes = (0, delivery_note_rules_1.checkDeliveryNote)(r.header, r.lines, {
                phase: 'validate',
                companyId: dto.companyId,
                branchId: dto.branchId,
                canOverride: rights.override,
                overrideWarnings: dto.overrideWarnings ?? [],
            });
            const totals = (0, delivery_note_rules_1.noteTotals)(r.lines);
            const errors = notes.filter((n) => n.severity === 'REFUSE').map(delivery_errors_1.worded);
            return {
                ok: errors.length === 0,
                errors,
                warnings: notes.filter((n) => n.severity === 'WARN').map(delivery_errors_1.worded),
                infos: notes.filter((n) => n.severity === 'INFO').map(delivery_errors_1.worded),
                totals,
                load: (0, delivery_note_rules_1.noteLoad)(r.header, totals),
                rights,
            };
        }, TX);
    }
    async post(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const rights = await this.rights(tx);
            this.assertRight(rights, 'post');
            await (0, sales_guards_1.assertAccYearWritable)(tx, dto.companyId, dto.accYear, 'accYear');
            const existing = dto.sdnId ? await this.lockNote(tx, dto.companyId, dto.sdnId) : null;
            if (existing) {
                this.assertDraft(existing, dto.baseRevision);
            }
            await this.lockBills(tx, dto.lines.map((l) => ({ billId: l.billId, billAccYear: l.billAccYear })));
            const r = await this.resolve(tx, dto, 'post', existing, rights);
            const overrides = (dto.overrideWarnings ?? []).map((c) => c.trim().toUpperCase());
            const notes = (0, delivery_note_rules_1.checkDeliveryNote)(r.header, r.lines, {
                phase: 'post',
                companyId: dto.companyId,
                branchId: dto.branchId,
                canOverride: rights.override,
                overrideWarnings: overrides,
            });
            const first = (0, delivery_note_rules_1.firstRefusal)(notes);
            if (first) {
                (0, delivery_errors_1.raiseNote)(first);
            }
            const ticked = [...new Set(notes.filter((n) => n.severity === 'WARN').map((n) => n.code))];
            const before = existing ? await this.reader.payload(tx, this.keysOf(existing), rights) : null;
            const draft = await this.writeDraft(tx, dto, existing, r, actor, now);
            if (!existing) {
                await this.step(tx, draft, txn_status_log_helper_1.TxnStatusEvent.CREATED, null, delivery_constants_1.DN_STATUS.DRAFT, actor, now, null);
            }
            await tx.saleDeliveryNoteItem.updateMany({
                where: { sdniNoteId: draft.sdnId, sdniAccYear: draft.sdnAccYear, sdniIsDeleted: false, sdniQty: 0 },
                data: { sdniIsDeleted: true, sdniModifiedOn: now, sdniModifiedBy: actor },
            });
            const items = await tx.saleDeliveryNoteItem.findMany({
                where: { sdniNoteId: draft.sdnId, sdniAccYear: draft.sdnAccYear, sdniIsDeleted: false },
                orderBy: { sdniLineNo: 'asc' },
            });
            const totals = (0, delivery_note_rules_1.noteTotals)(r.lines);
            const posted = await tx.saleDeliveryNote.update({
                where: { sdnId_sdnAccYear: { sdnId: draft.sdnId, sdnAccYear: draft.sdnAccYear } },
                data: {
                    sdnStatus: delivery_constants_1.DN_STATUS.POSTED,
                    sdnDate: new Date(`${istToday()}T00:00:00Z`),
                    sdnDatetime: now,
                    sdnPostedOn: now,
                    sdnPostedBy: actor,
                    sdnOverrides: ticked.length ? ticked.join(',').slice(0, 400) : null,
                    sdnVehicleCapacityKg: r.header.capacityKg,
                    sdnTotLines: totals.lines,
                    sdnTotQty: new client_1.Prisma.Decimal(totals.qty),
                    sdnTotBags: new client_1.Prisma.Decimal(totals.bags),
                    sdnTotWeightKg: new client_1.Prisma.Decimal(totals.weightKg),
                    sdnBillCount: totals.bills,
                    sdnModifiedOn: now,
                    sdnModifiedBy: actor,
                },
            });
            await tx.saleDeliveryEvent.createMany({
                data: items.map((i) => {
                    const f = r.facts.get(i.sdniBillItemId);
                    return {
                        sdeCompanyId: posted.sdnCompanyId,
                        sdeBranchId: posted.sdnBranchId,
                        sdeTenantId: posted.sdnTenantId,
                        sdeAccYear: posted.sdnAccYear,
                        sdeKind: 'GIVEN',
                        sdeBillId: i.sdniBillId,
                        sdeBillAccYear: i.sdniBillAccYear,
                        sdeBillItemId: i.sdniBillItemId,
                        sdeBillLineNo: f.lineNo,
                        sdeItemId: i.sdniItemId,
                        sdeGodownId: i.sdniGodownId,
                        sdeLotId: i.sdniLotId,
                        sdeSettleQty: i.sdniQty,
                        sdeSettleBaseQty: i.sdniBaseQty,
                        sdeOutQty: i.sdniQty,
                        sdeOutBaseQty: i.sdniBaseQty,
                        sdeSrcDocType: delivery_constants_1.DELIVERY_NOTE_DOC_TYPE,
                        sdeSrcDocId: posted.sdnId,
                        sdeSrcAccYear: posted.sdnAccYear,
                        sdeSrcLineId: i.sdniId,
                        sdeSrcRefno: posted.sdnRefno,
                        sdeEventDatetime: now,
                        sdeDeviceId: posted.sdnDeviceId,
                        sdeCreatedOn: now,
                        sdeCreatedBy: actor,
                    };
                }),
            });
            const corrections = await this.corrections.post(tx, this.correctionDoc(posted, posted.sdnAccYear, now), items.map((i) => this.correctionLineOf(i, (0, delivery_pending_service_1.dec)(i.sdniQty))), actor, { undo: false });
            await this.step(tx, posted, txn_status_log_helper_1.TxnStatusEvent.POSTED, delivery_constants_1.DN_STATUS.DRAFT, delivery_constants_1.DN_STATUS.POSTED, actor, now, ticked.length ? `Ticked: ${ticked.join(', ')}` : null);
            await this.revision(tx, posted, before, rights, actor, 'Delivery note posted');
            const bills = await this.status.recompute(tx, billsOf(items));
            const payload = await this.reader.payload(tx, this.keysOf(posted), rights);
            return { ...payload, postedBills: billsJson(bills), corrections: corrections };
        }, TX);
    }
    async cancel(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const rights = await this.rights(tx);
            this.assertRight(rights, 'cancel');
            const note = await this.lockNote(tx, dto.companyId, dto.sdnId, dto.branchId);
            if (!note) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_NOT_FOUND, `No delivery note ${dto.sdnId}`, 'sdnId');
            }
            if (note.sdnStatus === delivery_constants_1.DN_STATUS.CANCELLED) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_ALREADY_CANCELLED, `${note.sdnRefno} is already cancelled`, 'sdnId', {
                    refno: note.sdnRefno,
                    date: note.sdnCancelledOn ? (0, delivery_note_read_service_1.istClock)(note.sdnCancelledOn) : '',
                });
            }
            if (note.sdnStatus !== delivery_constants_1.DN_STATUS.POSTED) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GOODS_BACK_NOT_POSTED, `${note.sdnRefno} is a draft: delete it instead`, 'sdnId', {
                    refno: note.sdnRefno,
                });
            }
            const reason = (dto.reason ?? '').trim();
            if (!reason) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_CANCEL_REASON_REQUIRED, 'Say why the note is cancelled', 'reason');
            }
            await (0, sales_guards_1.assertAccYearWritable)(tx, note.sdnCompanyId, note.sdnAccYear.trim(), 'accYear');
            const before = await this.reader.payload(tx, this.keysOf(note), rights);
            const items = await tx.saleDeliveryNoteItem.findMany({
                where: { sdniNoteId: note.sdnId, sdniAccYear: note.sdnAccYear, sdniIsDeleted: false },
            });
            await this.lockBills(tx, billsOf(items));
            const given = await tx.$queryRaw `
        SELECT g.sde_id, g.sde_src_line_id, g.sde_bill_id, g.sde_bill_acc_year, g.sde_bill_item_id,
               g.sde_bill_line_no, g.sde_item_id, g.sde_godown_id, g.sde_lot_id,
               g.sde_out_qty + COALESCE(b.q, 0)  AS out_qty,
               g.sde_out_base_qty + COALESCE(b.qb, 0) AS out_base
          FROM sales.sale_delivery_event g
          LEFT JOIN LATERAL (
            SELECT SUM(x.sde_out_qty) AS q, SUM(x.sde_out_base_qty) AS qb
              FROM sales.sale_delivery_event x
             WHERE x.sde_src_line_id = g.sde_src_line_id AND x.sde_kind = 'GOODS_BACK'
               AND x.sde_src_doc_id = g.sde_src_doc_id
          ) b ON true
         WHERE g.sde_src_doc_type = ${delivery_constants_1.DELIVERY_NOTE_DOC_TYPE} AND g.sde_src_doc_id = ${note.sdnId}::uuid
           AND g.sde_kind = 'GIVEN'
           AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event c
                            WHERE c.sde_reverses_id = g.sde_id AND c.sde_kind = 'CANCEL')`;
            const live = given.filter((g) => (0, delivery_pending_service_1.dec)(g.out_qty).greaterThan(0));
            if (live.length > 0) {
                await tx.saleDeliveryEvent.createMany({
                    data: live.map((g) => ({
                        sdeCompanyId: note.sdnCompanyId,
                        sdeBranchId: note.sdnBranchId,
                        sdeTenantId: note.sdnTenantId,
                        sdeAccYear: note.sdnAccYear,
                        sdeKind: 'CANCEL',
                        sdeBillId: g.sde_bill_id,
                        sdeBillAccYear: g.sde_bill_acc_year,
                        sdeBillItemId: g.sde_bill_item_id,
                        sdeBillLineNo: g.sde_bill_line_no,
                        sdeItemId: g.sde_item_id,
                        sdeGodownId: g.sde_godown_id,
                        sdeLotId: g.sde_lot_id,
                        sdeSettleQty: (0, delivery_pending_service_1.dec)(g.out_qty).negated(),
                        sdeSettleBaseQty: (0, delivery_pending_service_1.dec)(g.out_base).negated(),
                        sdeOutQty: (0, delivery_pending_service_1.dec)(g.out_qty).negated(),
                        sdeOutBaseQty: (0, delivery_pending_service_1.dec)(g.out_base).negated(),
                        sdeSrcDocType: delivery_constants_1.DELIVERY_NOTE_DOC_TYPE,
                        sdeSrcDocId: note.sdnId,
                        sdeSrcAccYear: note.sdnAccYear,
                        sdeSrcLineId: g.sde_src_line_id,
                        sdeSrcRefno: note.sdnRefno,
                        sdeReversesId: g.sde_id,
                        sdeEventDatetime: now,
                        sdeReason: reason.slice(0, 200),
                        sdeDeviceId: note.sdnDeviceId,
                        sdeCreatedOn: now,
                        sdeCreatedBy: actor,
                    })),
                });
            }
            await this.corrections.cancelAll(tx, { sdnId: note.sdnId, companyId: note.sdnCompanyId, branchId: note.sdnBranchId }, actor, `Delivery note ${note.sdnRefno} cancelled: ${reason}`, now);
            const cancelled = await tx.saleDeliveryNote.update({
                where: { sdnId_sdnAccYear: { sdnId: note.sdnId, sdnAccYear: note.sdnAccYear } },
                data: {
                    sdnStatus: delivery_constants_1.DN_STATUS.CANCELLED,
                    sdnCancelledOn: now,
                    sdnCancelledBy: actor,
                    sdnCancelReason: reason.slice(0, 200),
                    sdnModifiedOn: now,
                    sdnModifiedBy: actor,
                },
            });
            await this.step(tx, cancelled, txn_status_log_helper_1.TxnStatusEvent.CANCELLED, delivery_constants_1.DN_STATUS.POSTED, delivery_constants_1.DN_STATUS.CANCELLED, actor, now, reason);
            await this.revision(tx, cancelled, before, rights, actor, `Delivery note cancelled: ${reason}`);
            const bills = await this.status.recompute(tx, billsOf(items));
            const payload = await this.reader.payload(tx, this.keysOf(cancelled), rights);
            return { ...payload, postedBills: billsJson(bills) };
        }, TX);
    }
    async delete(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        await this.prisma.$transaction(async (tx) => {
            const rights = await this.rights(tx);
            this.assertRight(rights, 'delete');
            const note = await this.lockNote(tx, dto.companyId, dto.sdnId, dto.branchId);
            if (!note) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_NOT_FOUND, `No delivery note ${dto.sdnId}`, 'sdnId');
            }
            if (note.sdnStatus !== delivery_constants_1.DN_STATUS.DRAFT) {
                this.assertDraft(note, undefined);
            }
            await tx.saleDeliveryNoteItem.updateMany({
                where: { sdniNoteId: note.sdnId, sdniAccYear: note.sdnAccYear, sdniIsDeleted: false },
                data: { sdniIsDeleted: true, sdniModifiedOn: now, sdniModifiedBy: actor },
            });
            await tx.saleDeliveryNote.update({
                where: { sdnId_sdnAccYear: { sdnId: note.sdnId, sdnAccYear: note.sdnAccYear } },
                data: { sdnIsDeleted: true, sdnModifiedOn: now, sdnModifiedBy: actor },
            });
            await this.transportBand.remove(tx, { docType: 'DELIVERY_NOTE', docId: note.sdnId, accYear: note.sdnAccYear }, actor);
            await this.step(tx, note, txn_status_log_helper_1.TxnStatusEvent.DELETED, delivery_constants_1.DN_STATUS.DRAFT, delivery_constants_1.DN_STATUS.DRAFT, actor, now, null);
            await this.audit.logEntityChange({
                action: 'cancel',
                tableName: 'sale_delivery_note',
                screenName: delivery_constants_1.DELIVERY_NOTE_SCREEN,
                screenType: 'transaction',
                pk: note.sdnId,
                displayName: note.sdnRefno,
                originalRecord: { sdnStatus: note.sdnStatus },
                modifiedRecord: { sdnIsDeleted: true },
                userId: actor,
                notes: 'Draft delivery note deleted',
            }, tx);
        }, TX);
        return { sdnId: dto.sdnId, deleted: true };
    }
    async goodsBack(dto) {
        const actor = this.salesContext.actor();
        const now = new Date();
        return this.prisma.$transaction(async (tx) => {
            const rights = await this.rights(tx);
            this.assertRight(rights, 'post');
            const todayYear = accYearOf(istToday());
            await (0, sales_guards_1.assertAccYearWritable)(tx, dto.companyId, todayYear, 'accYear');
            const note = await this.lockNote(tx, dto.companyId, dto.sdnId, dto.branchId);
            if (!note) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_NOT_FOUND, `No delivery note ${dto.sdnId}`, 'sdnId');
            }
            if (note.sdnStatus === delivery_constants_1.DN_STATUS.CANCELLED) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_ALREADY_CANCELLED, `${note.sdnRefno} is cancelled`, 'sdnId', {
                    refno: note.sdnRefno,
                    date: note.sdnCancelledOn ? (0, delivery_note_read_service_1.istClock)(note.sdnCancelledOn) : '',
                });
            }
            if (note.sdnStatus !== delivery_constants_1.DN_STATUS.POSTED) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GOODS_BACK_NOT_POSTED, `${note.sdnRefno} is a draft; nothing has left the godown yet`, 'sdnId', {
                    refno: note.sdnRefno,
                });
            }
            const reason = (dto.reason ?? '').trim();
            if (!reason) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GOODS_BACK_REASON_REQUIRED, 'Say why the goods came back', 'reason');
            }
            const sent = dto.lines.map((l) => l.sdeId).filter((x) => !!x);
            if (sent.length > 0) {
                const [seen] = await tx.$queryRaw `
          SELECT count(*)::int AS n FROM sales.sale_delivery_event WHERE sde_id = ANY(${sent}::uuid[])`;
                if (seen && seen.n > 0) {
                    const payload = await this.reader.payload(tx, this.keysOf(note), rights);
                    return { ...payload, postedBills: [], corrections: [], replayed: true };
                }
            }
            const items = await tx.saleDeliveryNoteItem.findMany({
                where: { sdniNoteId: note.sdnId, sdniAccYear: note.sdnAccYear, sdniIsDeleted: false },
            });
            const byId = new Map(items.map((i) => [i.sdniId, i]));
            const outByLine = await this.outByLine(tx, note.sdnId);
            const asks = [];
            dto.lines.forEach((l, idx) => {
                const item = byId.get(l.sdniId);
                const qty = parseQty(l.qty);
                const lineNo = item?.sdniLineNo ?? idx + 1;
                if (qty === null || qty.lessThan(0)) {
                    (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_QTY_NEGATIVE, `Line ${lineNo}: came back cannot be below 0`, `lines[${idx}].qty`, { n: lineNo }, lineNo, 'GOODS_BACK');
                }
                if (qty.isZero()) {
                    return;
                }
                const max = item ? (outByLine.get(item.sdniId) ?? Z) : Z;
                if (!item || qty.greaterThan(max)) {
                    (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_GOODS_BACK_OVER, `Line ${lineNo}: ${q3(qty)} came back, but only ${q3(max)} were given on this note`, `lines[${idx}].qty`, { n: lineNo, qty: q3(qty), max: q3(max) }, lineNo);
                }
                asks.push({ item, qty, sdeId: l.sdeId });
            });
            if (asks.length === 0) {
                (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_NO_LINES, 'Type a came-back quantity on at least one line', 'lines');
            }
            const before = await this.reader.payload(tx, this.keysOf(note), rights);
            await this.lockBills(tx, billsOf(asks.map((a) => a.item)));
            const facts = await this.pending.linesByKeys(tx, asks.map((a) => ({ billItemId: a.item.sdniBillItemId, billAccYear: a.item.sdniBillAccYear })));
            const lineNoOf = new Map(facts.map((f) => [f.billItemId, f.lineNo]));
            await tx.saleDeliveryEvent.createMany({
                data: asks.map((a) => {
                    const base = a.qty.times((0, delivery_pending_service_1.dec)(a.item.sdniToBaseFactor)).toDecimalPlaces(6);
                    return {
                        ...(a.sdeId ? { sdeId: a.sdeId } : {}),
                        sdeCompanyId: note.sdnCompanyId,
                        sdeBranchId: note.sdnBranchId,
                        sdeTenantId: note.sdnTenantId,
                        sdeAccYear: note.sdnAccYear,
                        sdeKind: 'GOODS_BACK',
                        sdeBillId: a.item.sdniBillId,
                        sdeBillAccYear: a.item.sdniBillAccYear,
                        sdeBillItemId: a.item.sdniBillItemId,
                        sdeBillLineNo: lineNoOf.get(a.item.sdniBillItemId) ?? a.item.sdniBillLineNo,
                        sdeItemId: a.item.sdniItemId,
                        sdeGodownId: note.sdnGodownId,
                        sdeLotId: a.item.sdniLotId,
                        sdeSettleQty: a.qty.negated(),
                        sdeSettleBaseQty: base.negated(),
                        sdeOutQty: a.qty.negated(),
                        sdeOutBaseQty: base.negated(),
                        sdeSrcDocType: delivery_constants_1.DELIVERY_NOTE_DOC_TYPE,
                        sdeSrcDocId: note.sdnId,
                        sdeSrcAccYear: note.sdnAccYear,
                        sdeSrcLineId: a.item.sdniId,
                        sdeSrcRefno: note.sdnRefno,
                        sdeEventDatetime: now,
                        sdeReason: reason.slice(0, 200),
                        sdeDeviceId: note.sdnDeviceId,
                        sdeCreatedOn: now,
                        sdeCreatedBy: actor,
                    };
                }),
            });
            const corrections = await this.corrections.post(tx, this.correctionDoc(note, todayYear, now), asks.map((a) => this.correctionLineOf(a.item, a.qty)), actor, { undo: true });
            const total = asks.reduce((s, a) => s.plus(a.qty), Z);
            await this.step(tx, note, txn_status_log_helper_1.TxnStatusEvent.GOODS_BACK, delivery_constants_1.DN_STATUS.POSTED, delivery_constants_1.DN_STATUS.POSTED, actor, now, `${q3(total)} came back: ${reason}`);
            await this.revision(tx, note, before, rights, actor, `Goods back (${q3(total)}): ${reason}`);
            const bills = await this.status.recompute(tx, billsOf(asks.map((a) => a.item)));
            const payload = await this.reader.payload(tx, this.keysOf(note), rights);
            return { ...payload, postedBills: billsJson(bills), corrections };
        }, TX);
    }
    keysOf(n) {
        return {
            companyId: n.sdnCompanyId,
            branchId: n.sdnBranchId,
            accYear: n.sdnAccYear.trim(),
            sdnId: n.sdnId,
        };
    }
    async lockNote(tx, companyId, sdnId, branchId) {
        const rows = await tx.$queryRaw `
      SELECT sdn_id, sdn_acc_year FROM sales.sale_delivery_note
       WHERE sdn_id = ${sdnId}::uuid AND sdn_company_id = ${companyId}::uuid
         AND sdn_is_deleted = false
       FOR UPDATE`;
        if (rows.length === 0) {
            return null;
        }
        const note = await tx.saleDeliveryNote.findUnique({
            where: { sdnId_sdnAccYear: { sdnId: rows[0].sdn_id, sdnAccYear: rows[0].sdn_acc_year } },
        });
        if (note && branchId && note.sdnBranchId !== branchId) {
            return null;
        }
        return note;
    }
    async lockBills(tx, bills) {
        const uniq = new Map(bills.map((b) => [`${b.billId}|${b.billAccYear.trim()}`, b]));
        if (uniq.size === 0) {
            return;
        }
        const ids = [...uniq.values()].map((b) => b.billId);
        const years = [...uniq.values()].map((b) => b.billAccYear.trim());
        await tx.$queryRaw `
      SELECT b.sb_id FROM sales.sale_bill b
        JOIN (SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[])::bpchar AS yr) k
          ON b.sb_id = k.id AND b.sb_acc_year = k.yr
       ORDER BY b.sb_acc_year, b.sb_id
       FOR UPDATE OF b`;
    }
    assertDraft(note, baseRevision) {
        if (note.sdnStatus === delivery_constants_1.DN_STATUS.CANCELLED) {
            (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_ALREADY_CANCELLED, `${note.sdnRefno} is cancelled`, 'sdnId', {
                refno: note.sdnRefno,
                date: note.sdnCancelledOn ? (0, delivery_note_read_service_1.istClock)(note.sdnCancelledOn) : '',
            });
        }
        if (note.sdnStatus !== delivery_constants_1.DN_STATUS.DRAFT) {
            (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_NOT_DRAFT, `${note.sdnRefno} is posted; a posted note is never changed`, 'sdnId', {
                refno: note.sdnRefno,
            });
        }
        if (baseRevision !== undefined && baseRevision !== note.sdnRevisionNo) {
            (0, delivery_errors_1.refuseWith)(delivery_constants_1.DELIVERY_ERROR_CODES.DN_REVISION_STALE, `This draft was saved since you opened it (now revision ${note.sdnRevisionNo}, you sent ${baseRevision})`, 'baseRevision', { refno: note.sdnRefno });
        }
    }
    async resolve(tx, dto, phase, existing, rights) {
        void rights;
        const godownId = dto.sdnGodownId ?? null;
        const [g] = godownId
            ? await tx.$queryRaw `SELECT gdl_name, gdl_branch_id, gdl_is_active, gdl_is_deleted FROM inventory.godown_locations
           WHERE gdl_id = ${godownId}::uuid`
            : [];
        const [br] = await tx.$queryRaw `
      SELECT br_name FROM public.branch_master WHERE br_id = ${dto.branchId}::uuid`;
        const godownState = !godownId
            ? 'MISSING'
            : !g || g.gdl_branch_id !== dto.branchId || !g.gdl_is_active || g.gdl_is_deleted
                ? 'OTHER_BRANCH'
                : 'OK';
        let godownLocked = false;
        let storedGodownName = '';
        if (existing && godownId && existing.sdnGodownId !== godownId && dto.lines.length > 0) {
            const live = await tx.saleDeliveryNoteItem.count({
                where: { sdniNoteId: existing.sdnId, sdniAccYear: existing.sdnAccYear, sdniIsDeleted: false },
            });
            if (live > 0) {
                godownLocked = true;
                storedGodownName = await this.reader.godownName(tx, existing.sdnGodownId);
            }
        }
        const [veh] = dto.sdnVehicleId
            ? await tx.$queryRaw `
          SELECT veh_vehicle_no, veh_capacity_kg FROM public.vehicle_master WHERE veh_id = ${dto.sdnVehicleId}::uuid`
            : [];
        let frozen = null;
        if (phase !== 'save' && godownState === 'OK' && godownId) {
            const [f] = await tx.$queryRaw `
        SELECT c.svh_freeze_from, c.svh_freeze_to FROM stock.stock_voucher c
         WHERE c.svh_company_id = ${dto.companyId}::uuid AND c.svh_branch_id = ${dto.branchId}::uuid
           AND c.svh_voucher_type = 'PHYSICAL' AND c.svh_freeze_stock = true
           AND c.svh_status = 'DRAFT' AND c.svh_is_deleted = false
           AND COALESCE(c.svh_from_godown_id, c.svh_to_godown_id) = ${godownId}::uuid
           AND now() BETWEEN c.svh_freeze_from AND c.svh_freeze_to
         LIMIT 1`;
            if (f) {
                frozen = { from: (0, delivery_note_read_service_1.istClock)(f.svh_freeze_from), to: (0, delivery_note_read_service_1.istClock)(f.svh_freeze_to) };
            }
        }
        const factsList = await this.pending.linesByKeys(tx, dto.lines.map((l) => ({ billItemId: l.billItemId, billAccYear: l.billAccYear })));
        const facts = new Map(factsList.map((f) => [f.billItemId, f]));
        const lotOf = (l) => l.lotId !== undefined && l.lotId !== null ? l.lotId : (facts.get(l.billItemId)?.lotId ?? null);
        const known = godownId
            ? await this.reader.lotsKnown(tx, dto.companyId, dto.branchId, dto.lines
                .filter((l) => facts.has(l.billItemId) && lotOf(l))
                .map((l) => ({ godownId, itemId: facts.get(l.billItemId).itemId, lotId: lotOf(l) })))
            : new Set();
        const shelves = godownId
            ? await this.reader.shelvesBase(tx, dto.companyId, dto.branchId, dto.lines
                .filter((l) => facts.has(l.billItemId))
                .map((l) => {
                const f = facts.get(l.billItemId);
                return { godownId, itemId: f.itemId, lotId: lotOf(l), bucket: f.bucket };
            }))
            : new Map();
        const names = await this.reader.names(tx, {
            itemIds: factsList.map((f) => f.itemId),
            unitIds: factsList.map((f) => f.unitId),
            godownIds: [godownId, ...factsList.map((f) => f.godownId)],
            lotIds: [...factsList.map((f) => f.lotId), ...dto.lines.map((l) => l.lotId ?? null)],
        });
        const godownName = godownId ? (names.godowns.get(godownId) ?? g?.gdl_name ?? '') : '';
        const lines = dto.lines.map((l, i) => {
            const f = facts.get(l.billItemId) ?? null;
            const lotId = lotOf(l);
            return {
                lineNo: i + 1,
                billId: l.billId,
                billAccYear: l.billAccYear.trim(),
                billItemId: l.billItemId,
                qty: parseQty(l.qty),
                facts: f && f.billAccYear === l.billAccYear.trim() ? f : null,
                bodyGodownId: l.godownId ?? null,
                lotId,
                lotKnown: !lotId || !f || !godownId ? true : known.has(`${godownId}|${f.itemId}|${lotId}`),
                shelfBase: f && godownId ? (shelves.get((0, delivery_note_read_service_1.holdingKey)(godownId, f.itemId, lotId, f.bucket)) ?? Z) : Z,
                names: {
                    bill: f?.billRefno ?? l.billId,
                    item: f ? (names.items.get(f.itemId)?.name ?? '') : '',
                    unit: f ? (names.units.get(f.unitId) ?? '') : '',
                    billGodown: f ? (names.godowns.get(f.godownId) ?? '') : '',
                    godown: godownName,
                    lot: lotId ? (names.lots.get(lotId) ?? lotId) : '',
                    billLot: f?.lotId ? (names.lots.get(f.lotId) ?? f.lotId) : '',
                },
            };
        });
        const vehicleLabel = dto.sdnVehicleNo?.trim() || veh?.veh_vehicle_no || '';
        return {
            header: {
                godownId,
                godownState,
                godownName,
                branchName: br?.br_name ?? '',
                godownLocked,
                storedGodownName,
                mode: dto.sdnMode,
                vehicleId: dto.sdnVehicleId ?? null,
                vehicleNo: dto.sdnVehicleNo ?? null,
                vehicleLabel,
                capacityKg: veh?.veh_capacity_kg ? (0, delivery_pending_service_1.dec)(veh.veh_capacity_kg) : null,
                transporterId: dto.transport?.transporterId ?? null,
                transporterName: dto.transport?.transporterName ?? null,
                collectedBy: dto.sdnCollectedBy ?? null,
                frozen,
            },
            lines,
            facts,
        };
    }
    async writeDraft(tx, dto, existing, r, actor, now) {
        const totals = (0, delivery_note_rules_1.noteTotals)(r.lines);
        const head = {
            sdnGodownId: dto.sdnGodownId,
            sdnMode: dto.sdnMode,
            sdnVehicleId: dto.sdnVehicleId ?? null,
            sdnVehicleNo: dto.sdnVehicleNo ?? null,
            sdnDriverId: dto.sdnDriverId ?? null,
            sdnSupervisorId: dto.sdnSupervisorId ?? null,
            sdnLoadmanId: dto.sdnLoadmanIds ?? [],
            sdnCollectedBy: dto.sdnCollectedBy ?? null,
            sdnCollectorPhone: dto.sdnCollectorPhone ?? null,
            sdnRemarks: dto.sdnRemarks ?? null,
            sdnTotLines: totals.lines,
            sdnTotQty: new client_1.Prisma.Decimal(totals.qty),
            sdnTotBags: new client_1.Prisma.Decimal(totals.bags),
            sdnTotWeightKg: new client_1.Prisma.Decimal(totals.weightKg),
            sdnBillCount: totals.bills,
        };
        let note;
        if (!existing) {
            const n = await (0, delivery_note_numbering_1.allocateDeliveryNoteNumber)(tx, {
                companyId: dto.companyId,
                branchId: dto.branchId,
                accYear: dto.accYear,
                deviceId: dto.deviceId,
            });
            note = await tx.saleDeliveryNote.create({
                data: {
                    ...(dto.sdnId ? { sdnId: dto.sdnId } : {}),
                    ...head,
                    sdnCompanyId: dto.companyId,
                    sdnBranchId: dto.branchId,
                    sdnAccYear: dto.accYear,
                    sdnDeviceId: dto.deviceId,
                    sdnSlno: n.lastNo,
                    sdnRefno: n.refno,
                    sdnDate: new Date(`${istToday()}T00:00:00Z`),
                    sdnDatetime: now,
                    sdnStatus: delivery_constants_1.DN_STATUS.DRAFT,
                    sdnRevisionNo: 1,
                    sdnCreatedOn: now,
                    sdnCreatedBy: actor,
                },
            });
        }
        else {
            note = await tx.saleDeliveryNote.update({
                where: { sdnId_sdnAccYear: { sdnId: existing.sdnId, sdnAccYear: existing.sdnAccYear } },
                data: {
                    ...head,
                    sdnRevisionNo: { increment: 1 },
                    sdnModifiedOn: now,
                    sdnModifiedBy: actor,
                },
            });
        }
        const stored = existing
            ? await tx.saleDeliveryNoteItem.findMany({
                where: { sdniNoteId: note.sdnId, sdniAccYear: note.sdnAccYear, sdniIsDeleted: false },
                select: { sdniId: true },
            })
            : [];
        const keep = new Set();
        for (const [i, l] of dto.lines.entries()) {
            const f = r.facts.get(l.billItemId);
            const rl = r.lines[i];
            const qty = rl.qty ?? Z;
            const data = {
                sdniLineNo: i + 1,
                sdniBillId: l.billId,
                sdniBillAccYear: l.billAccYear.trim(),
                sdniBillItemId: l.billItemId,
                sdniBillLineNo: f.lineNo,
                sdniBillRefno: f.billRefno,
                sdniItemId: f.itemId,
                sdniItemUnitId: f.unitId,
                sdniToBaseFactor: f.factor,
                sdniBillGodownId: f.godownId,
                sdniGodownId: dto.sdnGodownId,
                sdniBillLotId: f.lotId,
                sdniLotId: rl.lotId,
                sdniBucket: f.bucket,
                sdniQty: qty,
                sdniBaseQty: qty.times(f.factor).toDecimalPlaces(6),
                sdniWeightKg: (0, delivery_weight_1.lineWeightKg)(qty, f.unitKg),
                sdniScannedQty: parseQty(l.scannedQty ?? '0') ?? Z,
                sdniOtherGodownOk: l.otherGodownOk === true,
                sdniRemarks: l.remarks ?? null,
            };
            if (l.sdniId && stored.some((s) => s.sdniId === l.sdniId)) {
                keep.add(l.sdniId);
                await tx.saleDeliveryNoteItem.update({
                    where: { sdniId_sdniAccYear: { sdniId: l.sdniId, sdniAccYear: note.sdnAccYear } },
                    data: { ...data, sdniModifiedOn: now, sdniModifiedBy: actor },
                });
            }
            else {
                const row = await tx.saleDeliveryNoteItem.create({
                    data: {
                        ...(l.sdniId ? { sdniId: l.sdniId } : {}),
                        ...data,
                        sdniNoteId: note.sdnId,
                        sdniAccYear: note.sdnAccYear,
                        sdniCompanyId: note.sdnCompanyId,
                        sdniBranchId: note.sdnBranchId,
                        sdniTenantId: note.sdnTenantId,
                        sdniCreatedOn: now,
                        sdniCreatedBy: actor,
                    },
                });
                keep.add(row.sdniId);
            }
        }
        const drop = stored.filter((s) => !keep.has(s.sdniId)).map((s) => s.sdniId);
        if (drop.length > 0) {
            await tx.saleDeliveryNoteItem.updateMany({
                where: { sdniId: { in: drop }, sdniAccYear: note.sdnAccYear },
                data: { sdniIsDeleted: true, sdniModifiedOn: now, sdniModifiedBy: actor },
            });
        }
        const t = dto.transport;
        if (dto.sdnMode === 'TRANSPORTER' && t && (t.transporterId || t.transporterName || t.lrNo)) {
            await this.transportBand.write(tx, {
                docType: 'DELIVERY_NOTE',
                docId: note.sdnId,
                accYear: note.sdnAccYear,
                companyId: note.sdnCompanyId,
                branchId: note.sdnBranchId,
                tenantId: note.sdnTenantId,
                docRefno: note.sdnRefno,
            }, {
                direction: 'OUTWARD',
                from: { godownId: note.sdnGodownId, branchId: note.sdnBranchId },
                to: {},
                mode: 'ROAD',
                transporterId: t.transporterId ?? null,
                transporterName: t.transporterName ?? null,
                lrNo: t.lrNo ?? null,
                lrDate: t.lrDate ?? null,
            }, actor, { gdrId: null, now });
        }
        else if (existing) {
            await this.transportBand.remove(tx, { docType: 'DELIVERY_NOTE', docId: note.sdnId, accYear: note.sdnAccYear }, actor);
        }
        return note;
    }
    async outByLine(tx, sdnId) {
        const rows = await tx.$queryRaw `
      SELECT sde_src_line_id AS line_id, SUM(sde_out_qty) AS q
        FROM sales.sale_delivery_event
       WHERE sde_src_doc_type = ${delivery_constants_1.DELIVERY_NOTE_DOC_TYPE} AND sde_src_doc_id = ${sdnId}::uuid
       GROUP BY sde_src_line_id`;
        return new Map(rows.map((r) => [r.line_id, (0, delivery_pending_service_1.dec)(r.q)]));
    }
    correctionDoc(note, shadowAccYear, now) {
        return {
            sdnId: note.sdnId,
            noteAccYear: note.sdnAccYear.trim(),
            shadowAccYear,
            companyId: note.sdnCompanyId,
            branchId: note.sdnBranchId,
            tenantId: note.sdnTenantId,
            deviceId: note.sdnDeviceId,
            refno: note.sdnRefno,
            docDate: istToday(),
            docDatetime: now,
        };
    }
    correctionLineOf(i, qty) {
        return {
            lineNo: i.sdniLineNo,
            itemId: i.sdniItemId,
            iucId: i.sdniItemUnitId,
            factor: (0, delivery_pending_service_1.dec)(i.sdniToBaseFactor),
            qty,
            givingGodownId: i.sdniGodownId,
            billGodownId: i.sdniBillGodownId,
            givenLotId: i.sdniLotId,
            billLotId: i.sdniBillLotId,
            bucket: i.sdniBucket,
        };
    }
    async step(tx, note, event, from, to, actor, now, remarks) {
        await (0, txn_status_log_helper_1.appendTxnStatusLog)(tx, {
            companyId: note.sdnCompanyId,
            branchId: note.sdnBranchId,
            tenantId: note.sdnTenantId,
            accYear: note.sdnAccYear,
            srcModule: txn_status_log_helper_1.TxnStatusSrcModule.SALES,
            srcDocType: txn_status_log_helper_1.TxnStatusDocType.DELIVERY_NOTE,
            srcDocId: note.sdnId,
            srcDocRefno: note.sdnRefno,
            event,
            fromStatus: from,
            toStatus: to,
            changedOn: now,
            changedBy: actor,
            remarks,
            deviceId: note.sdnDeviceId,
        });
    }
    async revision(tx, note, before, rights, actor, notes) {
        const after = await this.reader.payload(tx, this.keysOf(note), rights);
        await this.audit.logDocumentRevision({
            screenName: delivery_constants_1.DELIVERY_NOTE_SCREEN,
            tableName: 'sale_delivery_note',
            docId: note.sdnId,
            displayName: note.sdnRefno,
            before: before === null ? null : auditRecordOf(before),
            after: auditRecordOf(after),
            userId: actor,
            branchId: note.sdnBranchId,
            deviceId: note.sdnDeviceId,
            notes,
        }, tx);
    }
};
exports.DeliveryNoteService = DeliveryNoteService;
exports.DeliveryNoteService = DeliveryNoteService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        sales_context_service_1.SalesContextService,
        delivery_pending_service_1.DeliveryPendingService,
        delivery_status_service_1.DeliveryStatusService,
        delivery_stock_correction_service_1.DeliveryStockCorrectionService,
        delivery_note_read_service_1.DeliveryNoteReadService,
        transport_band_service_1.TransportBandService,
        audit_log_service_1.AuditLogService])
], DeliveryNoteService);
function parseQty(v) {
    if (v === null || v === undefined) {
        return null;
    }
    const s = String(v).trim();
    if (!delivery_note_dto_1.DELIVERY_QTY_PATTERN.test(s)) {
        return null;
    }
    return new client_1.Prisma.Decimal(s);
}
function istToday(now = new Date()) {
    return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}
function accYearOf(ymdText) {
    const y = Number(ymdText.slice(0, 4));
    const m = Number(ymdText.slice(5, 7));
    const start = m >= 4 ? y : y - 1;
    return `${start}-${start + 1}`;
}
function billsOf(items) {
    const m = new Map();
    for (const i of items) {
        m.set(`${i.sdniBillId}|${i.sdniBillAccYear.trim()}`, {
            billId: i.sdniBillId,
            billAccYear: i.sdniBillAccYear.trim(),
        });
    }
    return [...m.values()];
}
function billsJson(changes) {
    return changes.map((c) => ({
        billId: c.billId,
        billAccYear: c.billAccYear,
        billRefno: c.billRefno,
        statusBefore: c.statusBefore,
        statusAfter: c.statusAfter,
    }));
}
function auditRecordOf(doc) {
    const { rights: _r, load: _l, elsewhere: _e, ...rest } = doc;
    void _r;
    void _l;
    void _e;
    const lines = Array.isArray(rest.lines) ? rest.lines : [];
    return {
        ...rest,
        lines: lines.map((l) => {
            const { shelfQty: _s, lastGiven: _g, barcodes: _b, pendingQty: _p, givenBeforeQty: _gb, ...line } = l;
            void _s;
            void _g;
            void _b;
            void _p;
            void _gb;
            return line;
        }),
    };
}
//# sourceMappingURL=delivery-note.service.js.map