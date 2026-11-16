import { Injectable } from '@nestjs/common';
import { Prisma, type SaleDeliveryNote } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { SalesContextService } from '../posting/sales-context.service';
import { TransportBandService } from '../posting/transport-band.service';
import { assertAccYearWritable } from '../posting/sales.guards';
import type { RightsBlock } from '../posting/types/posting.types';
import {
  DELIVERY_ERROR_CODES as C,
  DELIVERY_MENU_ID,
  DELIVERY_NOTE_DOC_TYPE,
  DELIVERY_NOTE_SCREEN,
  DN_STATUS,
  type BillKey,
} from './core/delivery.constants';
import { DeliveryPendingService, dec, type BillLineFacts } from './core/delivery-pending.service';
import { DeliveryStatusService, type DeliveryStatusChange } from './core/delivery-status.service';
import { lineWeightKg } from './core/delivery-weight';
import { allocateDeliveryNoteNumber } from './delivery-note-numbering';
import { DeliveryNoteReadService, holdingKey, istClock } from './delivery-note-read.service';
import {
  checkDeliveryNote,
  duplicateLineIds,
  firstRefusal,
  noteLoad,
  noteTotals,
  undoBelowReturned,
  yearChangedNote,
  type RuleHeader,
  type RuleLine,
  type RulePhase,
  type UndoLine,
} from './delivery-note.rules';
import {
  DeliveryStockCorrectionService,
  type CorrectionLine,
  type CorrectionResult,
} from './delivery-stock-correction.service';
import { note as finding, raiseNote, refuseWith, worded, type DeliveryNote } from './delivery.errors';
import {
  DELIVERY_QTY_PATTERN,
  type CancelDeliveryNoteDto,
  type DeliveryNoteKeysDto,
  type GoodsBackDto,
  type PostDeliveryNoteDto,
  type SaveDeliveryNoteDto,
  type ValidateDeliveryNoteDto,
} from './dto/delivery-note.dto';

type Tx = Prisma.TransactionClient;
const TX = { timeout: 60_000, maxWait: 10_000 } as const;
const Z = new Prisma.Decimal(0);
const q3 = (d: Prisma.Decimal): string => d.toDecimalPlaces(3).toString();

const RIGHT_CODE: Record<'view' | 'create' | 'edit' | 'delete' | 'post' | 'cancel', string> = {
  view: C.DN_RIGHT_VIEW,
  create: C.DN_RIGHT_CREATE,
  edit: C.DN_RIGHT_EDIT,
  delete: C.DN_RIGHT_DELETE,
  post: C.DN_RIGHT_POST,
  cancel: C.DN_RIGHT_CANCEL,
};

/** What `resolve` hands the rules and the writer. */
interface Resolved {
  header: RuleHeader;
  lines: RuleLine[];
  facts: Map<string, BillLineFacts>;
}

/**
 * Plan §8.1 — the Delivery Note / gate pass (menu 305).
 *
 * A note moves NO stock of its own. Posting writes one insert-only GIVEN
 * event per line into sales.sale_delivery_event; Physical = Owned + Billed
 * not delivered follows from those events (decision 35). Only a different
 * lot or godown posts a correction voucher (DeliveryStockCorrectionService).
 * The bills' computed delivery status is rewritten by DeliveryStatusService,
 * the only writer, at the end of every write path.
 */
@Injectable()
export class DeliveryNoteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly salesContext: SalesContextService,
    private readonly pending: DeliveryPendingService,
    private readonly status: DeliveryStatusService,
    private readonly corrections: DeliveryStockCorrectionService,
    private readonly reader: DeliveryNoteReadService,
    private readonly transportBand: TransportBandService,
    private readonly audit: AuditLogService,
  ) {}

  // ═══════════════════════════════════════════════════════════════════════
  //  rights
  // ═══════════════════════════════════════════════════════════════════════

  async rights(client?: Tx): Promise<RightsBlock> {
    return this.salesContext.rights(DELIVERY_MENU_ID.DELIVERY_NOTE, client);
  }

  private assertRight(rights: RightsBlock, verb: keyof typeof RIGHT_CODE): void {
    if (!rights[verb]) {
      refuseWith(RIGHT_CODE[verb], `This user may not ${verb} delivery notes (menu 305)`, 'userId', {
        verb,
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  get / scan / open-lines / lots
  // ═══════════════════════════════════════════════════════════════════════

  async get(q: { companyId: string; branchId: string; accYear: string; sdnId: string }) {
    const rights = await this.rights();
    this.assertRight(rights, 'view');
    return this.reader.payload(null, q, rights);
  }

  async scan(q: { companyId: string; branchId: string; godownId: string; code: string }) {
    this.assertRight(await this.rights(), 'view');
    return this.reader.scan(q);
  }

  async openLines(q: {
    companyId: string;
    branchId: string;
    godownId: string;
    bills: { billId: string; billAccYear: string }[];
  }) {
    this.assertRight(await this.rights(), 'view');
    return this.reader.openLines(null, q.companyId, q.branchId, q.godownId, q.bills);
  }

  async lots(q: { companyId: string; branchId: string; godownId: string; itemId: string; bucket?: string }) {
    this.assertRight(await this.rights(), 'view');
    return this.reader.lots(q);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  save (a DRAFT holds nothing, Q12)
  // ═══════════════════════════════════════════════════════════════════════

  async save(dto: SaveDeliveryNoteDto): Promise<Record<string, unknown>> {
    const actor = this.salesContext.actor();
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const rights = await this.rights(tx);
      // N4 — found and locked in the session's branch only.
      const existing = await this.findForWrite(tx, dto);
      this.assertRight(rights, existing ? 'edit' : 'create');
      // N3 (user, 2026-11-16) — a NEW draft is born in today's year (IST), so
      // the keeper hears it now, not at post. An existing draft from an older
      // year may still be re-saved or deleted (cleaned up); its post is refused.
      if (!existing) {
        const yearOff = yearChangedNote(dto.accYear, accYearOf(istToday()), null, false);
        if (yearOff) {
          raiseNote(yearOff);
        }
      }
      // A saved draft is written in its own year (the partition it lives in).
      await assertAccYearWritable(tx, dto.companyId, (existing?.sdnAccYear ?? dto.accYear).trim(), 'accYear');
      if (existing) {
        this.assertDraft(existing, dto.baseRevision);
      }
      // S2 — each note line once, and never another note's line id.
      const ids = await this.lineIdFinding(tx, dto, existing);
      if (ids) {
        raiseNote(ids);
      }
      const r = await this.resolve(tx, dto, 'save', existing, rights);
      const first = firstRefusal(
        checkDeliveryNote(r.header, r.lines, {
          phase: 'save',
          companyId: dto.companyId,
          branchId: dto.branchId,
          canOverride: rights.override,
          overrideWarnings: [],
        }),
      );
      if (first) {
        raiseNote(first);
      }
      const before = existing ? await this.reader.payload(tx, this.keysOf(existing), rights) : null;
      const note = await this.writeDraft(tx, dto, existing, r, actor, now);
      if (!existing) {
        await this.step(tx, note, TxnStatusEvent.CREATED, null, DN_STATUS.DRAFT, actor, now, null);
      }
      await this.revision(tx, note, before, rights, actor, existing ? 'Delivery note saved' : 'Delivery note created');
      return this.reader.payload(tx, this.keysOf(note), rights);
    }, TX);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  validate (the dry run of post; writes nothing)
  // ═══════════════════════════════════════════════════════════════════════

  async validate(dto: ValidateDeliveryNoteDto): Promise<Record<string, unknown>> {
    const rights = await this.rights();
    if (!rights.create && !rights.edit) {
      this.assertRight(rights, 'create');
    }
    return this.prisma.$transaction(async (tx) => {
      // N4 — found and locked in the session's branch only.
      const existing = await this.findForWrite(tx, dto);
      const r = await this.resolve(tx, dto, 'validate', existing, rights);
      // S2 and N3 ahead of the rules' own findings: what /post would refuse first.
      const ahead = [
        await this.lineIdFinding(tx, dto, existing),
        existing && existing.sdnStatus !== DN_STATUS.DRAFT
          ? null
          : yearChangedNote(
              existing?.sdnAccYear ?? dto.accYear,
              accYearOf(istToday()),
              existing?.sdnRefno ?? null,
              !!existing,
            ),
      ].filter((n): n is DeliveryNote => n !== null);
      const notes = [
        ...ahead,
        ...checkDeliveryNote(r.header, r.lines, {
          phase: 'validate',
          companyId: dto.companyId,
          branchId: dto.branchId,
          canOverride: rights.override,
          overrideWarnings: dto.overrideWarnings ?? [],
        }),
      ];
      const totals = noteTotals(r.lines);
      const errors = notes.filter((n) => n.severity === 'REFUSE').map(worded);
      return {
        ok: errors.length === 0,
        errors,
        warnings: notes.filter((n) => n.severity === 'WARN').map(worded),
        infos: notes.filter((n) => n.severity === 'INFO').map(worded),
        totals,
        load: noteLoad(r.header, totals),
        rights,
      };
    }, TX);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  post — goods left the godown (D4)
  // ═══════════════════════════════════════════════════════════════════════

  async post(dto: PostDeliveryNoteDto): Promise<Record<string, unknown>> {
    const actor = this.salesContext.actor();
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      // 1 · rights (the save a post makes is part of the post: POST alone),
      //     the year, the note DRAFT.
      const rights = await this.rights(tx);
      this.assertRight(rights, 'post');
      // N4 — found and locked in the session's branch only.
      const existing = await this.findForWrite(tx, dto);
      if (existing) {
        this.assertDraft(existing, dto.baseRevision);
      }
      // N3 — the note is filed in the year it is posted in (today, IST): a
      // draft from another year is refused, never moved across partitions.
      const yearNow = accYearOf(istToday());
      const yearOff = yearChangedNote(
        existing?.sdnAccYear ?? dto.accYear,
        yearNow,
        existing?.sdnRefno ?? null,
        !!existing,
      );
      if (yearOff) {
        raiseNote(yearOff);
      }
      await assertAccYearWritable(tx, dto.companyId, yearNow, 'accYear');
      // S2 — each note line once, and never another note's line id.
      const ids = await this.lineIdFinding(tx, dto, existing);
      if (ids) {
        raiseNote(ids);
      }
      // Lock the bills' headers, ordered, so two keepers giving the same bill
      // serialise and the second reads the first's events (§6).
      await this.lockBills(
        tx,
        dto.lines.map((l) => ({ billId: l.billId, billAccYear: l.billAccYear })),
      );
      // 2 · the rules again, under the locks.
      const r = await this.resolve(tx, dto, 'post', existing, rights);
      const overrides = (dto.overrideWarnings ?? []).map((c) => c.trim().toUpperCase());
      const notes = checkDeliveryNote(r.header, r.lines, {
        phase: 'post',
        companyId: dto.companyId,
        branchId: dto.branchId,
        canOverride: rights.override,
        overrideWarnings: overrides,
      });
      const first = firstRefusal(notes);
      if (first) {
        raiseNote(first);
      }
      const ticked = [...new Set(notes.filter((n) => n.severity === 'WARN').map((n) => n.code))];

      // 3 · the note: saved as sent, zero lines dropped, POSTED.
      const before = existing ? await this.reader.payload(tx, this.keysOf(existing), rights) : null;
      const draft = await this.writeDraft(tx, dto, existing, r, actor, now);
      if (!existing) {
        await this.step(tx, draft, TxnStatusEvent.CREATED, null, DN_STATUS.DRAFT, actor, now, null);
      }
      await tx.saleDeliveryNoteItem.updateMany({
        where: { sdniNoteId: draft.sdnId, sdniAccYear: draft.sdnAccYear, sdniIsDeleted: false, sdniQty: 0 },
        data: { sdniIsDeleted: true, sdniModifiedOn: now, sdniModifiedBy: actor },
      });
      const items = await tx.saleDeliveryNoteItem.findMany({
        where: { sdniNoteId: draft.sdnId, sdniAccYear: draft.sdnAccYear, sdniIsDeleted: false },
        orderBy: { sdniLineNo: 'asc' },
      });
      const totals = noteTotals(r.lines);
      const posted = await tx.saleDeliveryNote.update({
        where: { sdnId_sdnAccYear: { sdnId: draft.sdnId, sdnAccYear: draft.sdnAccYear } },
        data: {
          sdnStatus: DN_STATUS.POSTED,
          sdnDate: new Date(`${istToday()}T00:00:00Z`),
          sdnDatetime: now,
          sdnPostedOn: now,
          sdnPostedBy: actor,
          sdnOverrides: ticked.length ? ticked.join(',').slice(0, 400) : null,
          sdnVehicleCapacityKg: r.header.capacityKg,
          sdnTotLines: totals.lines,
          sdnTotQty: new Prisma.Decimal(totals.qty),
          sdnTotBags: new Prisma.Decimal(totals.bags),
          sdnTotWeightKg: new Prisma.Decimal(totals.weightKg),
          sdnBillCount: totals.bills,
          sdnModifiedOn: now,
          sdnModifiedBy: actor,
        },
      });

      // 4 · one GIVEN event per line: settle +q, out +q.
      await tx.saleDeliveryEvent.createMany({
        data: items.map((i) => {
          const f = r.facts.get(i.sdniBillItemId)!;
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
            sdeSrcDocType: DELIVERY_NOTE_DOC_TYPE,
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

      // 5 · the books follow the goods: lot swaps and godown moves.
      const corrections = await this.corrections.post(
        tx,
        this.correctionDoc(posted, posted.sdnAccYear, now),
        items.map((i) => this.correctionLineOf(i, dec(i.sdniQty))),
        actor,
        { undo: false },
      );

      // 6 · the trail, the revision, and the bills' computed status.
      await this.step(
        tx,
        posted,
        TxnStatusEvent.POSTED,
        DN_STATUS.DRAFT,
        DN_STATUS.POSTED,
        actor,
        now,
        ticked.length ? `Ticked: ${ticked.join(', ')}` : null,
      );
      await this.revision(tx, posted, before, rights, actor, 'Delivery note posted');
      const bills = await this.status.recompute(tx, billsOf(items));
      const payload = await this.reader.payload(tx, this.keysOf(posted), rights);
      return { ...payload, postedBills: billsJson(bills), corrections: corrections };
    }, TX);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  cancel — CANCEL events, corrections cancelled (decision 40)
  // ═══════════════════════════════════════════════════════════════════════

  async cancel(dto: CancelDeliveryNoteDto): Promise<Record<string, unknown>> {
    const actor = this.salesContext.actor();
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const rights = await this.rights(tx);
      this.assertRight(rights, 'cancel');
      const note = await this.lockNote(tx, dto.companyId, dto.sdnId, dto.branchId);
      if (!note) {
        refuseWith(C.DN_NOT_FOUND, `No delivery note ${dto.sdnId}`, 'sdnId');
      }
      if (note.sdnStatus === DN_STATUS.CANCELLED) {
        refuseWith(C.DN_ALREADY_CANCELLED, `${note.sdnRefno} is already cancelled`, 'sdnId', {
          refno: note.sdnRefno,
          date: note.sdnCancelledOn ? istClock(note.sdnCancelledOn) : '',
        });
      }
      if (note.sdnStatus !== DN_STATUS.POSTED) {
        refuseWith(C.DN_GOODS_BACK_NOT_POSTED, `${note.sdnRefno} is a draft: delete it instead`, 'sdnId', {
          refno: note.sdnRefno,
        });
      }
      const reason = (dto.reason ?? '').trim();
      if (!reason) {
        refuseWith(C.DN_CANCEL_REASON_REQUIRED, 'Say why the note is cancelled', 'reason');
      }
      await assertAccYearWritable(tx, note.sdnCompanyId, note.sdnAccYear.trim(), 'accYear');
      // N6 — the post's count-freeze check: the goods would come back into
      // the godown mid-count.
      await this.assertNotFrozen(tx, note, 'CANCEL');
      const before = await this.reader.payload(tx, this.keysOf(note), rights);
      const items = await tx.saleDeliveryNoteItem.findMany({
        where: { sdniNoteId: note.sdnId, sdniAccYear: note.sdnAccYear, sdniIsDeleted: false },
      });
      await this.lockBills(tx, billsOf(items));

      // Each GIVEN reversed for what is still out (given less goods back).
      const given = await tx.$queryRaw<
        {
          sde_id: string;
          sde_src_line_id: string;
          sde_bill_id: string;
          sde_bill_acc_year: string;
          sde_bill_item_id: string;
          sde_bill_line_no: number;
          sde_item_id: string;
          sde_godown_id: string;
          sde_lot_id: string | null;
          out_qty: Prisma.Decimal;
          out_base: Prisma.Decimal;
        }[]
      >`
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
         WHERE g.sde_src_doc_type = ${DELIVERY_NOTE_DOC_TYPE} AND g.sde_src_doc_id = ${note.sdnId}::uuid
           AND g.sde_kind = 'GIVEN'
           AND NOT EXISTS (SELECT 1 FROM sales.sale_delivery_event c
                            WHERE c.sde_reverses_id = g.sde_id AND c.sde_kind = 'CANCEL')`;
      const live = given.filter((g) => dec(g.out_qty).greaterThan(0));
      // S3 / R-1 — under the bill locks: never below what sale returns took back.
      const noteLineOf = new Map(items.map((i) => [i.sdniId, i.sdniLineNo]));
      await this.assertUndoAboveReturned(
        tx,
        live.map((g) => ({
          billItemId: g.sde_bill_item_id,
          billAccYear: g.sde_bill_acc_year,
          removeBase: dec(g.out_base),
          noteLineNo: noteLineOf.get(g.sde_src_line_id) ?? 0,
          field: 'sdnId',
        })),
      );
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
            sdeSettleQty: dec(g.out_qty).negated(),
            sdeSettleBaseQty: dec(g.out_base).negated(),
            sdeOutQty: dec(g.out_qty).negated(),
            sdeOutBaseQty: dec(g.out_base).negated(),
            sdeSrcDocType: DELIVERY_NOTE_DOC_TYPE,
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
      await this.corrections.cancelAll(
        tx,
        { sdnId: note.sdnId, companyId: note.sdnCompanyId, branchId: note.sdnBranchId },
        actor,
        `Delivery note ${note.sdnRefno} cancelled: ${reason}`,
        now,
      );
      const cancelled = await tx.saleDeliveryNote.update({
        where: { sdnId_sdnAccYear: { sdnId: note.sdnId, sdnAccYear: note.sdnAccYear } },
        data: {
          sdnStatus: DN_STATUS.CANCELLED,
          sdnCancelledOn: now,
          sdnCancelledBy: actor,
          sdnCancelReason: reason.slice(0, 200),
          sdnModifiedOn: now,
          sdnModifiedBy: actor,
        },
      });
      await this.step(tx, cancelled, TxnStatusEvent.CANCELLED, DN_STATUS.POSTED, DN_STATUS.CANCELLED, actor, now, reason);
      await this.revision(tx, cancelled, before, rights, actor, `Delivery note cancelled: ${reason}`);
      const bills = await this.status.recompute(tx, billsOf(items));
      const payload = await this.reader.payload(tx, this.keysOf(cancelled), rights);
      return { ...payload, postedBills: billsJson(bills) };
    }, TX);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  delete — drafts only (decision 45)
  // ═══════════════════════════════════════════════════════════════════════

  async delete(dto: DeliveryNoteKeysDto): Promise<{ sdnId: string; deleted: true }> {
    const actor = this.salesContext.actor();
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const rights = await this.rights(tx);
      this.assertRight(rights, 'delete');
      const note = await this.lockNote(tx, dto.companyId, dto.sdnId, dto.branchId);
      if (!note) {
        refuseWith(C.DN_NOT_FOUND, `No delivery note ${dto.sdnId}`, 'sdnId');
      }
      if (note.sdnStatus !== DN_STATUS.DRAFT) {
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
      await this.transportBand.remove(
        tx,
        { docType: 'DELIVERY_NOTE', docId: note.sdnId, accYear: note.sdnAccYear },
        actor,
      );
      await this.step(tx, note, TxnStatusEvent.DELETED, DN_STATUS.DRAFT, DN_STATUS.DRAFT, actor, now, null);
      await this.audit.logEntityChange(
        {
          action: 'cancel',
          tableName: 'sale_delivery_note',
          screenName: DELIVERY_NOTE_SCREEN,
          screenType: 'transaction',
          pk: note.sdnId,
          displayName: note.sdnRefno,
          originalRecord: { sdnStatus: note.sdnStatus },
          modifiedRecord: { sdnIsDeleted: true },
          userId: actor,
          notes: 'Draft delivery note deleted',
        },
        tx,
      );
    }, TX);
    return { sdnId: dto.sdnId, deleted: true };
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  goods back — refused at the door (Q13, addendum §5.1)
  // ═══════════════════════════════════════════════════════════════════════

  async goodsBack(dto: GoodsBackDto): Promise<Record<string, unknown>> {
    const actor = this.salesContext.actor();
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      // 1 · the Post right; 2 · today's year writable (decision 71).
      const rights = await this.rights(tx);
      this.assertRight(rights, 'post');
      const todayYear = accYearOf(istToday());
      await assertAccYearWritable(tx, dto.companyId, todayYear, 'accYear');
      // 3 · the note POSTED.
      const note = await this.lockNote(tx, dto.companyId, dto.sdnId, dto.branchId);
      if (!note) {
        refuseWith(C.DN_NOT_FOUND, `No delivery note ${dto.sdnId}`, 'sdnId');
      }
      if (note.sdnStatus === DN_STATUS.CANCELLED) {
        refuseWith(C.DN_ALREADY_CANCELLED, `${note.sdnRefno} is cancelled`, 'sdnId', {
          refno: note.sdnRefno,
          date: note.sdnCancelledOn ? istClock(note.sdnCancelledOn) : '',
        });
      }
      if (note.sdnStatus !== DN_STATUS.POSTED) {
        refuseWith(C.DN_GOODS_BACK_NOT_POSTED, `${note.sdnRefno} is a draft; nothing has left the godown yet`, 'sdnId', {
          refno: note.sdnRefno,
        });
      }
      // 4 · the reason.
      const reason = (dto.reason ?? '').trim();
      if (!reason) {
        refuseWith(C.DN_GOODS_BACK_REASON_REQUIRED, 'Say why the goods came back', 'reason');
      }
      // 6 (first) · a re-sent request: an sdeId that exists writes nothing.
      const sent = dto.lines.map((l) => l.sdeId).filter((x): x is string => !!x);
      if (sent.length > 0) {
        const [seen] = await tx.$queryRaw<{ n: number }[]>`
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
      // 5 · each qty > 0 and ≤ given − earlier goods back. S2: rows naming the
      // same note line are SUMMED before the check and written as ONE event
      // (the first row's sdeId), so two rows of 5 never pass a max of 6.
      const merged = new Map<
        string,
        { item: (typeof items)[number]; qty: Prisma.Decimal; sdeId?: string; idx: number }
      >();
      const sdeOwner = new Map<string, string>();
      dto.lines.forEach((l, idx) => {
        const item = byId.get(l.sdniId);
        const qty = parseQty(l.qty);
        const lineNo = item?.sdniLineNo ?? idx + 1;
        if (qty === null || qty.lessThan(0)) {
          // event=GOODS_BACK picks the "came back" wording of DN_QTY_NEGATIVE (round 2).
          refuseWith(
            C.DN_QTY_NEGATIVE,
            `Line ${lineNo}: came back cannot be below 0`,
            `lines[${idx}].qty`,
            { n: lineNo },
            lineNo,
            'GOODS_BACK',
          );
        }
        // One event id names one note line (it is the event's primary key).
        if (l.sdeId) {
          const owner = sdeOwner.get(l.sdeId);
          if (owner !== undefined && owner !== l.sdniId) {
            refuseWith(
              C.DN_LINE_DUPLICATE,
              `Line ${lineNo}: sdeId ${l.sdeId} is sent on two note lines`,
              `lines[${idx}].sdeId`,
              { n: lineNo },
              lineNo,
            );
          }
          sdeOwner.set(l.sdeId, l.sdniId);
        }
        if (qty.isZero()) {
          return;
        }
        const prev = item ? merged.get(item.sdniId) : undefined;
        const total = (prev?.qty ?? Z).plus(qty);
        const max = item ? (outByLine.get(item.sdniId) ?? Z) : Z;
        if (!item || total.greaterThan(max)) {
          refuseWith(
            C.DN_GOODS_BACK_OVER,
            `Line ${lineNo}: ${q3(total)} came back, but only ${q3(max)} were given on this note`,
            `lines[${idx}].qty`,
            { n: lineNo, qty: q3(total), max: q3(max) },
            lineNo,
          );
        }
        merged.set(item.sdniId, {
          item,
          qty: total,
          sdeId: prev?.sdeId ?? l.sdeId,
          idx: prev?.idx ?? idx,
        });
      });
      const asks = [...merged.values()];
      if (asks.length === 0) {
        refuseWith(C.DN_NO_LINES, 'Type a came-back quantity on at least one line', 'lines');
      }
      // N6 — the post's count-freeze check: the goods come back into the
      // note's godown mid-count.
      await this.assertNotFrozen(tx, note, 'GOODS_BACK');
      const before = await this.reader.payload(tx, this.keysOf(note), rights);
      await this.lockBills(tx, billsOf(asks.map((a) => a.item)));
      // S3 / R-1 — under the bill locks: never below what sale returns took back.
      await this.assertUndoAboveReturned(
        tx,
        asks.map((a) => ({
          billItemId: a.item.sdniBillItemId,
          billAccYear: a.item.sdniBillAccYear,
          removeBase: a.qty.times(dec(a.item.sdniToBaseFactor)).toDecimalPlaces(6),
          noteLineNo: a.item.sdniLineNo,
          field: `lines[${a.idx}].qty`,
        })),
      );
      const facts = await this.pending.linesByKeys(
        tx,
        asks.map((a) => ({ billItemId: a.item.sdniBillItemId, billAccYear: a.item.sdniBillAccYear })),
      );
      const lineNoOf = new Map(facts.map((f) => [f.billItemId, f.lineNo]));
      await tx.saleDeliveryEvent.createMany({
        data: asks.map((a) => {
          const base = a.qty.times(dec(a.item.sdniToBaseFactor)).toDecimalPlaces(6);
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
            // Back to the note's godown, where they left from (decision 40).
            sdeGodownId: note.sdnGodownId,
            sdeLotId: a.item.sdniLotId,
            sdeSettleQty: a.qty.negated(),
            sdeSettleBaseQty: base.negated(),
            sdeOutQty: a.qty.negated(),
            sdeOutBaseQty: base.negated(),
            sdeSrcDocType: DELIVERY_NOTE_DOC_TYPE,
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
      // The line's corrections undone for the returned qty, dated now in
      // today's year (decision 71).
      const corrections = await this.corrections.post(
        tx,
        this.correctionDoc(note, todayYear, now),
        asks.map((a) => this.correctionLineOf(a.item, a.qty)),
        actor,
        { undo: true },
      );
      const total = asks.reduce((s, a) => s.plus(a.qty), Z);
      await this.step(
        tx,
        note,
        TxnStatusEvent.GOODS_BACK,
        DN_STATUS.POSTED,
        DN_STATUS.POSTED,
        actor,
        now,
        `${q3(total)} came back: ${reason}`,
      );
      await this.revision(tx, note, before, rights, actor, `Goods back (${q3(total)}): ${reason}`);
      const bills = await this.status.recompute(tx, billsOf(asks.map((a) => a.item)));
      const payload = await this.reader.payload(tx, this.keysOf(note), rights);
      return { ...payload, postedBills: billsJson(bills), corrections };
    }, TX);
  }

  // ═══════════════════════════════════════════════════════════════════════
  //  internals
  // ═══════════════════════════════════════════════════════════════════════

  private keysOf(n: SaleDeliveryNote) {
    return {
      companyId: n.sdnCompanyId,
      branchId: n.sdnBranchId,
      accYear: n.sdnAccYear.trim(),
      sdnId: n.sdnId,
    };
  }

  /** The note row under FOR UPDATE, or null. */
  private async lockNote(
    tx: Tx,
    companyId: string,
    sdnId: string,
    branchId?: string,
  ): Promise<SaleDeliveryNote | null> {
    const rows = await tx.$queryRaw<{ sdn_id: string; sdn_acc_year: string }[]>`
      SELECT sdn_id, sdn_acc_year FROM sales.sale_delivery_note
       WHERE sdn_id = ${sdnId}::uuid AND sdn_company_id = ${companyId}::uuid
         AND (${branchId ?? null}::uuid IS NULL OR sdn_branch_id = ${branchId ?? null}::uuid)
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

  /**
   * N4 — the note a save / post / validate names, found and locked in the
   * session's branch (as cancel / delete / goods back find theirs). null = a
   * new note: no id, or a client uuid never used. An id that IS used — by a
   * note of another branch or company, or a deleted draft — is DN_NOT_FOUND,
   * never a second insert of the same primary key.
   */
  private async findForWrite(
    tx: Tx,
    dto: { companyId: string; branchId: string; sdnId?: string },
  ): Promise<SaleDeliveryNote | null> {
    if (!dto.sdnId) {
      return null;
    }
    const note = await this.lockNote(tx, dto.companyId, dto.sdnId, dto.branchId);
    if (note) {
      return note;
    }
    const [used] = await tx.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM sales.sale_delivery_note WHERE sdn_id = ${dto.sdnId}::uuid`;
    if (used && used.n > 0) {
      refuseWith(C.DN_NOT_FOUND, `No delivery note ${dto.sdnId} in this branch`, 'sdnId');
    }
    return null;
  }

  /**
   * S2 — each note line once in the body (duplicateLineIds), and a client
   * line id that already names a line of ANOTHER note is refused too: both
   * would otherwise be a primary-key 500. A line id of this note's own
   * removed line is fine (writeDraft brings it back).
   */
  private async lineIdFinding(
    tx: Tx,
    dto: Pick<SaveDeliveryNoteDto, 'lines'>,
    existing: SaleDeliveryNote | null,
  ): Promise<DeliveryNote | null> {
    const dup = duplicateLineIds(dto.lines);
    if (dup) {
      return dup;
    }
    const ids = dto.lines.map((l) => l.sdniId).filter((x): x is string => !!x);
    if (ids.length === 0) {
      return null;
    }
    const rows = await tx.$queryRaw<{ sdni_id: string }[]>`
      SELECT sdni_id FROM sales.sale_delivery_note_item
       WHERE sdni_id = ANY(${ids}::uuid[])
         AND sdni_note_id <> ${existing?.sdnId ?? '00000000-0000-0000-0000-000000000000'}::uuid
       LIMIT 1`;
    if (rows.length === 0) {
      return null;
    }
    const idx = dto.lines.findIndex((l) => l.sdniId === rows[0].sdni_id);
    return finding(
      C.DN_LINE_DUPLICATE,
      'REFUSE',
      `lines[${idx}].sdniId`,
      `Line ${idx + 1}: sdniId ${rows[0].sdni_id} is a line of another delivery note`,
      { n: idx + 1 },
      idx + 1,
    );
  }

  /**
   * The count freeze on a godown now (N4 of the plan): a PHYSICAL draft with
   * freeze on, whose window holds this moment. One query for post / validate
   * (rule 9) and, since review N6, cancel and goods back.
   */
  private async frozenAt(
    tx: Tx,
    companyId: string,
    branchId: string,
    godownId: string,
  ): Promise<{ from: string; to: string } | null> {
    const [f] = await tx.$queryRaw<{ svh_freeze_from: Date; svh_freeze_to: Date }[]>`
      SELECT c.svh_freeze_from, c.svh_freeze_to FROM stock.stock_voucher c
       WHERE c.svh_company_id = ${companyId}::uuid AND c.svh_branch_id = ${branchId}::uuid
         AND c.svh_voucher_type = 'PHYSICAL' AND c.svh_freeze_stock = true
         AND c.svh_status = 'DRAFT' AND c.svh_is_deleted = false
         AND COALESCE(c.svh_from_godown_id, c.svh_to_godown_id) = ${godownId}::uuid
         AND now() BETWEEN c.svh_freeze_from AND c.svh_freeze_to
       LIMIT 1`;
    return f ? { from: istClock(f.svh_freeze_from), to: istClock(f.svh_freeze_to) } : null;
  }

  /**
   * Review N6 — a cancel or goods back puts goods back into the note's
   * godown, so it meets the post's freeze check (same code, DN_GODOWN_FROZEN;
   * `event` picks the wording variant of the step).
   */
  private async assertNotFrozen(
    tx: Tx,
    note: SaleDeliveryNote,
    event: 'CANCEL' | 'GOODS_BACK',
  ): Promise<void> {
    const frozen = await this.frozenAt(tx, note.sdnCompanyId, note.sdnBranchId, note.sdnGodownId);
    if (!frozen) {
      return;
    }
    const godown = await this.reader.godownName(tx, note.sdnGodownId);
    refuseWith(
      C.DN_GODOWN_FROZEN,
      `${godown} is frozen for a count from ${frozen.from} to ${frozen.to}`,
      'sdnGodownId',
      { godown, from: frozen.from, to: frozen.to },
      null,
      event,
    );
  }

  /**
   * Review S3 / decision R-1 — after a cancel or goods back each bill line
   * must still be given at least what its live posted sale returns took back
   * as "taken". Read under the bill locks; the first breach is refused
   * (DN_UNDO_BELOW_RETURNED, 409).
   */
  private async assertUndoAboveReturned(
    tx: Tx,
    asks: readonly {
      billItemId: string;
      billAccYear: string;
      removeBase: Prisma.Decimal;
      noteLineNo: number;
      field: string;
    }[],
  ): Promise<void> {
    const byLine = new Map<
      string,
      { billItemId: string; billAccYear: string; removeBase: Prisma.Decimal; noteLineNo: number; field: string }
    >();
    for (const a of asks) {
      const key = `${a.billItemId}|${a.billAccYear.trim()}`;
      const prev = byLine.get(key);
      byLine.set(key, {
        billItemId: a.billItemId,
        billAccYear: a.billAccYear.trim(),
        removeBase: (prev?.removeBase ?? Z).plus(a.removeBase),
        noteLineNo: prev?.noteLineNo ?? a.noteLineNo,
        field: prev?.field ?? a.field,
      });
    }
    if (byLine.size === 0) {
      return;
    }
    const taken = await this.pending.returnsTakenByLine(tx, [...byLine.values()]);
    if (taken.size === 0) {
      return;
    }
    const keys = [...byLine.values()].filter((b) => taken.has(`${b.billItemId}|${b.billAccYear}`));
    const facts = await this.pending.linesByKeys(tx, keys);
    const names = await this.reader.names(tx, {
      itemIds: [],
      unitIds: facts.map((f) => f.unitId),
      godownIds: [],
      lotIds: [],
    });
    const lines: UndoLine[] = facts
      .map((f) => {
        const key = `${f.billItemId}|${f.billAccYear.trim()}`;
        const b = byLine.get(key)!;
        const t = taken.get(key)!;
        return {
          noteLineNo: b.noteLineNo,
          field: b.field,
          billRefno: f.billRefno ?? f.billId,
          billLineNo: f.lineNo,
          unitName: names.units.get(f.unitId) ?? '',
          factor: f.factor,
          givenBase: f.givenBase,
          removeBase: b.removeBase,
          takenBase: t.takenBase,
          returnRefnos: t.refnos,
        };
      })
      .sort((a, b) => a.noteLineNo - b.noteLineNo);
    const first = undoBelowReturned(lines);
    if (first) {
      raiseNote(first);
    }
  }

  /** Lock the bills' headers in (acc_year, sb_id) order (§6: two keepers, one bill). */
  private async lockBills(tx: Tx, bills: readonly BillKey[]): Promise<void> {
    const uniq = new Map(bills.map((b) => [`${b.billId}|${b.billAccYear.trim()}`, b]));
    if (uniq.size === 0) {
      return;
    }
    const ids = [...uniq.values()].map((b) => b.billId);
    const years = [...uniq.values()].map((b) => b.billAccYear.trim());
    await tx.$queryRaw`
      SELECT b.sb_id FROM sales.sale_bill b
        JOIN (SELECT unnest(${ids}::uuid[]) AS id, unnest(${years}::text[])::bpchar AS yr) k
          ON b.sb_id = k.id AND b.sb_acc_year = k.yr
       ORDER BY b.sb_acc_year, b.sb_id
       FOR UPDATE OF b`;
  }

  private assertDraft(note: SaleDeliveryNote, baseRevision: number | undefined): void {
    if (note.sdnStatus === DN_STATUS.CANCELLED) {
      refuseWith(C.DN_ALREADY_CANCELLED, `${note.sdnRefno} is cancelled`, 'sdnId', {
        refno: note.sdnRefno,
        date: note.sdnCancelledOn ? istClock(note.sdnCancelledOn) : '',
      });
    }
    if (note.sdnStatus !== DN_STATUS.DRAFT) {
      refuseWith(C.DN_NOT_DRAFT, `${note.sdnRefno} is posted; a posted note is never changed`, 'sdnId', {
        refno: note.sdnRefno,
      });
    }
    if (baseRevision !== undefined && baseRevision !== note.sdnRevisionNo) {
      refuseWith(
        C.DN_REVISION_STALE,
        `This draft was saved since you opened it (now revision ${note.sdnRevisionNo}, you sent ${baseRevision})`,
        'baseRevision',
        { refno: note.sdnRefno },
      );
    }
  }

  /**
   * Everything the rules need, read in one place (§8.1 rules 2–9): the
   * godown, the vehicle, a count freeze, each line's bill facts, its lot and
   * its shelf.
   */
  private async resolve(
    tx: Tx,
    dto: SaveDeliveryNoteDto,
    phase: RulePhase,
    existing: SaleDeliveryNote | null,
    rights: RightsBlock,
  ): Promise<Resolved> {
    void rights;
    const godownId = dto.sdnGodownId ?? null;
    const [g] = godownId
      ? await tx.$queryRaw<
          { gdl_name: string | null; gdl_branch_id: string; gdl_is_active: boolean; gdl_is_deleted: boolean }[]
        >`SELECT gdl_name, gdl_branch_id, gdl_is_active, gdl_is_deleted FROM inventory.godown_locations
           WHERE gdl_id = ${godownId}::uuid`
      : [];
    const [br] = await tx.$queryRaw<{ br_name: string | null }[]>`
      SELECT br_name FROM public.branch_master WHERE br_id = ${dto.branchId}::uuid`;
    const godownState: RuleHeader['godownState'] = !godownId
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
      ? await tx.$queryRaw<{ veh_vehicle_no: string | null; veh_capacity_kg: Prisma.Decimal | null }[]>`
          SELECT veh_vehicle_no, veh_capacity_kg FROM public.vehicle_master WHERE veh_id = ${dto.sdnVehicleId}::uuid`
      : [];
    const frozen: RuleHeader['frozen'] =
      phase !== 'save' && godownState === 'OK' && godownId
        ? await this.frozenAt(tx, dto.companyId, dto.branchId, godownId)
        : null;

    const factsList = await this.pending.linesByKeys(
      tx,
      dto.lines.map((l) => ({ billItemId: l.billItemId, billAccYear: l.billAccYear })),
    );
    const facts = new Map(factsList.map((f) => [f.billItemId, f]));
    const lotOf = (l: SaveDeliveryNoteDto['lines'][number]) =>
      l.lotId !== undefined && l.lotId !== null ? l.lotId : (facts.get(l.billItemId)?.lotId ?? null);
    const known = godownId
      ? await this.reader.lotsKnown(
          tx,
          dto.companyId,
          dto.branchId,
          dto.lines
            .filter((l) => facts.has(l.billItemId) && lotOf(l))
            .map((l) => ({ godownId, itemId: facts.get(l.billItemId)!.itemId, lotId: lotOf(l)! })),
        )
      : new Set<string>();
    const shelves = godownId
      ? await this.reader.shelvesBase(
          tx,
          dto.companyId,
          dto.branchId,
          dto.lines
            .filter((l) => facts.has(l.billItemId))
            .map((l) => {
              const f = facts.get(l.billItemId)!;
              return { godownId, itemId: f.itemId, lotId: lotOf(l), bucket: f.bucket };
            }),
        )
      : new Map<string, Prisma.Decimal>();
    const names = await this.reader.names(tx, {
      itemIds: factsList.map((f) => f.itemId),
      unitIds: factsList.map((f) => f.unitId),
      godownIds: [godownId, ...factsList.map((f) => f.godownId)],
      lotIds: [...factsList.map((f) => f.lotId), ...dto.lines.map((l) => l.lotId ?? null)],
    });
    const godownName = godownId ? (names.godowns.get(godownId) ?? g?.gdl_name ?? '') : '';
    const lines: RuleLine[] = dto.lines.map((l, i) => {
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
        shelfBase:
          f && godownId ? (shelves.get(holdingKey(godownId, f.itemId, lotId, f.bucket)) ?? Z) : Z,
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
        capacityKg: veh?.veh_capacity_kg ? dec(veh.veh_capacity_kg) : null,
        transporterId: dto.transport?.transporterId ?? null,
        transporterName: dto.transport?.transporterName ?? null,
        collectedBy: dto.sdnCollectedBy ?? null,
        frozen,
      },
      lines,
      facts,
    };
  }

  /** Insert / update the DRAFT header and its lines exactly as sent. */
  private async writeDraft(
    tx: Tx,
    dto: SaveDeliveryNoteDto,
    existing: SaleDeliveryNote | null,
    r: Resolved,
    actor: string,
    now: Date,
  ): Promise<SaleDeliveryNote> {
    const totals = noteTotals(r.lines);
    const head = {
      sdnGodownId: dto.sdnGodownId!,
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
      sdnTotQty: new Prisma.Decimal(totals.qty),
      sdnTotBags: new Prisma.Decimal(totals.bags),
      sdnTotWeightKg: new Prisma.Decimal(totals.weightKg),
      sdnBillCount: totals.bills,
    };
    let note: SaleDeliveryNote;
    if (!existing) {
      const n = await allocateDeliveryNoteNumber(tx, {
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
          sdnStatus: DN_STATUS.DRAFT,
          sdnRevisionNo: 1,
          sdnCreatedOn: now,
          sdnCreatedBy: actor,
        },
      });
    } else {
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
    // Every line the note ever had: a re-sent id of a line removed earlier is
    // brought back (an update), never inserted a second time (S2).
    const stored = existing
      ? await tx.saleDeliveryNoteItem.findMany({
          where: { sdniNoteId: note.sdnId, sdniAccYear: note.sdnAccYear },
          select: { sdniId: true, sdniIsDeleted: true },
        })
      : [];
    const keep = new Set<string>();
    for (const [i, l] of dto.lines.entries()) {
      const f = r.facts.get(l.billItemId)!;
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
        sdniGodownId: dto.sdnGodownId!,
        sdniBillLotId: f.lotId,
        sdniLotId: rl.lotId,
        sdniBucket: f.bucket,
        sdniQty: qty,
        sdniBaseQty: qty.times(f.factor).toDecimalPlaces(6),
        sdniWeightKg: lineWeightKg(qty, f.unitKg),
        sdniScannedQty: parseQty(l.scannedQty ?? '0') ?? Z,
        sdniOtherGodownOk: l.otherGodownOk === true,
        sdniRemarks: l.remarks ?? null,
      };
      if (l.sdniId && stored.some((s) => s.sdniId === l.sdniId)) {
        keep.add(l.sdniId);
        await tx.saleDeliveryNoteItem.update({
          where: { sdniId_sdniAccYear: { sdniId: l.sdniId, sdniAccYear: note.sdnAccYear } },
          data: { ...data, sdniIsDeleted: false, sdniModifiedOn: now, sdniModifiedBy: actor },
        });
      } else {
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
    const drop = stored.filter((s) => !s.sdniIsDeleted && !keep.has(s.sdniId)).map((s) => s.sdniId);
    if (drop.length > 0) {
      await tx.saleDeliveryNoteItem.updateMany({
        where: { sdniId: { in: drop }, sdniAccYear: note.sdnAccYear },
        data: { sdniIsDeleted: true, sdniModifiedOn: now, sdniModifiedBy: actor },
      });
    }
    // The transporter / LR (Transporter mode) in txn_transport_detail.
    const t = dto.transport;
    if (dto.sdnMode === 'TRANSPORTER' && t && (t.transporterId || t.transporterName || t.lrNo)) {
      await this.transportBand.write(
        tx,
        {
          docType: 'DELIVERY_NOTE',
          docId: note.sdnId,
          accYear: note.sdnAccYear,
          companyId: note.sdnCompanyId,
          branchId: note.sdnBranchId,
          tenantId: note.sdnTenantId,
          docRefno: note.sdnRefno,
        },
        {
          direction: 'OUTWARD',
          from: { godownId: note.sdnGodownId, branchId: note.sdnBranchId },
          to: {},
          mode: 'ROAD',
          transporterId: t.transporterId ?? null,
          transporterName: t.transporterName ?? null,
          lrNo: t.lrNo ?? null,
          lrDate: t.lrDate ?? null,
        },
        actor,
        { gdrId: null, now },
      );
    } else if (existing) {
      await this.transportBand.remove(
        tx,
        { docType: 'DELIVERY_NOTE', docId: note.sdnId, accYear: note.sdnAccYear },
        actor,
      );
    }
    return note;
  }

  /** Per note line: given less goods back (what may still come back). */
  private async outByLine(tx: Tx, sdnId: string): Promise<Map<string, Prisma.Decimal>> {
    const rows = await tx.$queryRaw<{ line_id: string; q: Prisma.Decimal }[]>`
      SELECT sde_src_line_id AS line_id, SUM(sde_out_qty) AS q
        FROM sales.sale_delivery_event
       WHERE sde_src_doc_type = ${DELIVERY_NOTE_DOC_TYPE} AND sde_src_doc_id = ${sdnId}::uuid
       GROUP BY sde_src_line_id`;
    return new Map(rows.map((r) => [r.line_id, dec(r.q)]));
  }

  private correctionDoc(note: SaleDeliveryNote, shadowAccYear: string, now: Date) {
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

  private correctionLineOf(
    i: {
      sdniLineNo: number;
      sdniItemId: string;
      sdniItemUnitId: string;
      sdniToBaseFactor: Prisma.Decimal;
      sdniGodownId: string;
      sdniBillGodownId: string;
      sdniLotId: string | null;
      sdniBillLotId: string | null;
      sdniBucket: string;
    },
    qty: Prisma.Decimal,
  ): CorrectionLine {
    return {
      lineNo: i.sdniLineNo,
      itemId: i.sdniItemId,
      iucId: i.sdniItemUnitId,
      factor: dec(i.sdniToBaseFactor),
      qty,
      givingGodownId: i.sdniGodownId,
      billGodownId: i.sdniBillGodownId,
      givenLotId: i.sdniLotId,
      billLotId: i.sdniBillLotId,
      bucket: i.sdniBucket,
    };
  }

  /** One txn_status_log step of the note (DELIVERY_NOTE). */
  private async step(
    tx: Tx,
    note: SaleDeliveryNote,
    event: TxnStatusEvent,
    from: string | null,
    to: string,
    actor: string,
    now: Date,
    remarks: string | null,
  ): Promise<void> {
    await appendTxnStatusLog(tx, {
      companyId: note.sdnCompanyId,
      branchId: note.sdnBranchId,
      tenantId: note.sdnTenantId,
      accYear: note.sdnAccYear,
      srcModule: TxnStatusSrcModule.SALES,
      srcDocType: TxnStatusDocType.DELIVERY_NOTE,
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

  /** Notes 89 — one before / after revision per save (audit screen 164). */
  private async revision(
    tx: Tx,
    note: SaleDeliveryNote,
    before: Record<string, unknown> | null,
    rights: RightsBlock,
    actor: string,
    notes: string,
  ): Promise<void> {
    const after = await this.reader.payload(tx, this.keysOf(note), rights);
    await this.audit.logDocumentRevision(
      {
        screenName: DELIVERY_NOTE_SCREEN,
        tableName: 'sale_delivery_note',
        docId: note.sdnId,
        displayName: note.sdnRefno,
        before: before === null ? null : auditRecordOf(before),
        after: auditRecordOf(after),
        userId: actor,
        branchId: note.sdnBranchId,
        deviceId: note.sdnDeviceId,
        notes,
      },
      tx,
    );
  }
}

/** A quantity from the body: up to 3 decimals, else null (DN_QTY_NEGATIVE). */
export function parseQty(v: string | number | null | undefined): Prisma.Decimal | null {
  if (v === null || v === undefined) {
    return null;
  }
  const s = String(v).trim();
  if (!DELIVERY_QTY_PATTERN.test(s)) {
    return null;
  }
  return new Prisma.Decimal(s);
}

/** Today's IST date, YYYY-MM-DD (db-session-timezone-ist). */
export function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** The Indian accounting year (April–March) a date falls in: 2026-11-15 → 2026-2027. */
export function accYearOf(ymdText: string): string {
  const y = Number(ymdText.slice(0, 4));
  const m = Number(ymdText.slice(5, 7));
  const start = m >= 4 ? y : y - 1;
  return `${start}-${start + 1}`;
}

function billsOf(
  items: readonly { sdniBillId: string; sdniBillAccYear: string }[],
): BillKey[] {
  const m = new Map<string, BillKey>();
  for (const i of items) {
    m.set(`${i.sdniBillId}|${i.sdniBillAccYear.trim()}`, {
      billId: i.sdniBillId,
      billAccYear: i.sdniBillAccYear.trim(),
    });
  }
  return [...m.values()];
}

function billsJson(changes: readonly DeliveryStatusChange[]) {
  return changes.map((c) => ({
    billId: c.billId,
    billAccYear: c.billAccYear,
    billRefno: c.billRefno,
    statusBefore: c.statusBefore,
    statusAfter: c.statusAfter,
  }));
}

/** A get payload as its revision keeps it: no rights, no derived shelf / last-given. */
function auditRecordOf(doc: Record<string, unknown>): Record<string, unknown> {
  const { rights: _r, load: _l, elsewhere: _e, ...rest } = doc;
  void _r;
  void _l;
  void _e;
  const lines = Array.isArray(rest.lines) ? (rest.lines as Record<string, unknown>[]) : [];
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

export { q3 };
