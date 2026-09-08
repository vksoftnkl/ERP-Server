import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  resolveActor,
  throwStockConflict,
  throwStockNotFound,
  throwStockUnprocessable,
} from 'src/common/utils/module-service.utils';
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { SaveStockVoucherDto } from '../stock-voucher/dto/save-stock-voucher.dto';
import type { SaveStockVoucherItemDto } from '../stock-voucher/dto/save-stock-voucher-item.dto';
import type {
  StockBucket,
  StockErrorDetail,
  StockErrorResponse,
  StockVoucherPayload,
  StockVoucherStatus,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';
import type { SaveStockTransferDto } from './dto/save-stock-transfer.dto';
import type { SaveStockTransferReceiveDto } from './dto/save-stock-transfer-receive.dto';
import type {
  StockTransferDespatchResult,
  StockTransferPrefill,
  StockTransferPrefillRow,
  StockTransferReceiveResult,
  StockTransitRow,
} from './types/stock-transfer.types';
import { TRANSFER_LINK_SRC_DOC_TYPE, TRANSFER_LINK_SRC_MODULE } from './types/stock-transfer.types';

/** What the raw transit reads hand back, before Decimal → number. */
interface TransitDbRow {
  stt_id: string;
  stt_status: string;
  stt_item_id: string;
  item_code: string | null;
  item_name: string;
  stt_lot_id: string;
  batch_no: string | null;
  expiry_date: Date | null;
  stt_to_godown_id: string;
  to_godown_name: string | null;
  stt_bucket: string;
  stt_base_uom_id: string;
  unit_name: string | null;
  stt_sent_qty: Prisma.Decimal;
  stt_received_qty: Prisma.Decimal;
  stt_damage_qty: Prisma.Decimal;
  remaining_qty: Prisma.Decimal;
  stt_cost_rate: Prisma.Decimal;
  stt_transit_value: Prisma.Decimal;
  stt_lr_no: string | null;
  stt_vehicle_no: string | null;
  stt_expected_on: Date | null;
  stt_sent_on: Date | null;
  stt_received_on: Date | null;
}

/** One on-hand holding, as the over-issue check reads it. */
interface BalanceRow {
  sbl_godown_id: string;
  sbl_item_id: string;
  sbl_lot_id: string;
  sbl_bucket: string;
  sbl_on_hand_qty: Prisma.Decimal;
}

/**
 * The transfer-specific half. Everything type-agnostic — save, load, list,
 * post, cancel, delete, audit — is StockVoucherService's, imported and never
 * copied.
 *
 * WHAT IS ACTUALLY DIFFERENT ABOUT A TRANSFER, and therefore what is here:
 *
 *  1. THE REFUSALS THE ENGINE DOES NOT MAKE (§3.2, §7.2). Four of them exist
 *     because of defects reproduced in REVIEW_2026-09-05.md — until those are
 *     fixed in 20/16, this service is the only thing standing between them and
 *     the ledger. Each one is commented with what it is standing in for.
 *  2. THE LORRY (§0.3). fn_svh_post_transfer never writes stt_lr_no,
 *     stt_vehicle_no or stt_expected_on. Nothing in the engine does. The API
 *     updates the transit rows itself, in the post's own transaction.
 *  3. TWO TABLES ARE READ THAT NO OTHER SCREEN READS — stock_transit for the
 *     receipt prefill and the inbound worklist, stock_balance for the
 *     over-issue check.
 *
 * WHAT IS NOT HERE, DELIBERATELY: any UPDATE of svh_status. fn_svh_post_lock
 * exempts IN_TRANSIT and RECEIVED (MUST-FIX 2), so a plain UPDATE would regress
 * an OUT to DRAFT and a second despatch would move the stock twice. Only the
 * two engine functions may write that column, and there is no reopen action.
 */
@Injectable()
export class StockTransferService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly stockVoucherService: StockVoucherService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────────
  // §3 — save a TRANSFER_OUT draft
  // ──────────────────────────────────────────────────────────────────────────

  async save(
    rules: StockVoucherTypeRules,
    dto: SaveStockTransferDto,
  ): Promise<StockVoucherPayload> {
    await this.assertTransferOutRules(dto);
    return this.stockVoucherService.save(rules, dto as unknown as SaveStockVoucherDto);
  }

  /**
   * §3.2 — everything the engine will not refuse, or will refuse without saying
   * anything a clerk can act on. Reported as ONE 422 with a per-line list, the
   * way the shared service reports its own, because a user forty lines into a
   * transfer should see every bad row at once.
   */
  private async assertTransferOutRules(dto: SaveStockTransferDto): Promise<void> {
    const { header, lines } = dto;
    const errors: StockErrorDetail[] = [];

    // Shape A or shape B, decided exactly as the engine decides it:
    //   v_same := svh_to_branch_id IS NULL OR svh_to_branch_id = svh_branch_id
    const sameBranch = !header.toBranchId || header.toBranchId === header.branchId;

    if (sameBranch && header.fromGodownId && header.fromGodownId === header.toGodownId) {
      // The engine refuses this too (ck_svh_transfer_godowns / a 23514), but as
      // a constraint name. On an inter-branch transfer the two ids may coincide
      // legitimately — MAIN at branch A to MAIN at branch B are different
      // godowns that a chain often names identically.
      errors.push({
        field: 'toGodownId',
        message:
          'A transfer within one branch must move the stock somewhere: the source and destination godowns are the same.',
      });
    }

    lines.forEach((line, index) => {
      const field = `lines.${index}`;
      if (header.toGodownId && line.godownId === header.toGodownId && sameBranch) {
        // Only meaningful within one branch, for the same reason as above.
        errors.push({
          field,
          message: `Line ${line.lineNo} takes stock from the godown this transfer is going to. A godown cannot transfer to itself.`,
        });
      }
    });

    // ── ux_stt_out_line's two collisions, both caught HERE because neither ──
    // ── says anything useful when it fires. ─────────────────────────────────
    if (!sameBranch) {
      // MUST-FIX 3. The index is (out voucher, item, lot, to-godown, bucket)
      // and the destination godown is HEADER-level, so it drops out of the key
      // — two lines of one item+lot from two SOURCE godowns produce the same
      // key and the despatch dies with a bare 23505 naming a partition-local
      // index and no line number. Two source godowns is two vouchers, until the
      // engine aggregates the transit row.
      const bySourceKey = new Map<string, number>();
      // The receive matcher looks up (out voucher, item, lot, to-godown)
      // WITHOUT bucket, so it finds two rows and refuses with 0A000 — "shipped
      // in more than one bucket". The shipment saves and despatches fine and
      // only the RECEIPT fails, at the other branch, days later. Caught at save
      // the sender can still fix it.
      const bucketsSeen = new Map<string, { bucket: StockBucket; index: number }>();

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
        } else {
          bySourceKey.set(transitKey, index);
        }

        const firstBucket = bucketsSeen.get(matcherKey);
        if (!firstBucket) {
          bucketsSeen.set(matcherKey, { bucket, index });
        } else if (firstBucket.bucket !== bucket) {
          errors.push({
            field,
            message: `Line ${line.lineNo} ships the same item and lot as row ${firstBucket.index + 1} in a different bucket (${bucket} against ${firstBucket.bucket}). The receiving branch matches on item and lot alone, would find two transit rows and could never post the receipt. Send them as two transfers.`,
          });
        }
      });
    }

    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        'This transfer cannot be saved',
        errors,
      );
    }

    // The two checks that need the database. Run after the cheap ones so a
    // payload that is wrong on its face never touches it.
    await this.assertLotsAndStock(dto, errors);
  }

  /**
   * §3.3 — the lot belongs to this company and item — and §3.2's last refusal,
   * the one the engine genuinely does not make: THERE IS ENOUGH STOCK.
   *
   * `stp_allow_negative` decides that, and under ALLOW a transfer will happily
   * send stock the branch does not have, leaving the source negative and the
   * destination holding goods that were never there. The grid was filled FROM
   * stock_balance, so the screen already knows the answer — this is the check
   * the engine leaves to the API, and open item 4 asks whether a transfer
   * should be BLOCK regardless of the item's own policy.
   */
  private async assertLotsAndStock(
    dto: SaveStockTransferDto,
    errors: StockErrorDetail[],
  ): Promise<void> {
    const { header, lines } = dto;
    const lotIds = [...new Set(lines.map((line) => line.lotId).filter((id): id is string => !!id))];
    if (!lotIds.length) {
      // Every line missing a lot is already a per-line 422 from the shared
      // service's requiresLot branch; nothing to add here.
      return;
    }

    const lots = await this.prisma.$queryRaw<
      Array<{ slt_id: string; slt_item_id: string; slt_company_id: string }>
    >`
      SELECT slt_id, slt_item_id, slt_company_id
        FROM stock.stock_lot
       WHERE slt_id IN (${Prisma.join(lotIds)})
    `;
    const lotById = new Map(lots.map((lot) => [lot.slt_id, lot]));

    // One query for every holding the document touches, not one per line.
    const balances = await this.prisma.$queryRaw<BalanceRow[]>`
      SELECT sbl_godown_id, sbl_item_id, sbl_lot_id, sbl_bucket, sbl_on_hand_qty
        FROM stock.stock_balance
       WHERE sbl_company_id = ${header.companyId}::uuid
         AND sbl_branch_id  = ${header.branchId}::uuid
         AND sbl_lot_id IN (${Prisma.join(lotIds)})
    `;
    const onHand = new Map(
      balances.map((row) => [
        this.holdingKey(row.sbl_lot_id, row.sbl_godown_id, row.sbl_bucket),
        Number(row.sbl_on_hand_qty),
      ]),
    );

    // Two lines may legitimately draw on ONE holding — the same lot split
    // across two rows of the grid — so the check is against the document's
    // TOTAL for that holding, not line by line. Checked per line it passes
    // twice and oversends once.
    const wanted = new Map<string, number>();
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
        // The single most dangerous payload this screen can send: a valid lot
        // of the WRONG item moves one item's stock under another's identity,
        // and both balances are wrong afterwards in a way no report will show.
        errors.push({
          field,
          message: `Line ${line.lineNo} names a lot that belongs to a different item. The lot is the identity of the stock being moved — it cannot be carried across items.`,
        });
      }
    });

    const reported = new Set<string>();
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
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        'This transfer cannot be saved',
        errors,
      );
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §4 — despatch
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * ONE CALL, ONE TRANSACTION — and the lorry written straight after it.
   *
   * fn_svh_post_transfer decides the shape itself and the response reports
   * which one happened, because the two forms END DIFFERENTLY: a same-branch
   * pair finishes POSTED with no transit row, an inter-branch despatch finishes
   * IN_TRANSIT with one row per line and a receipt still owed. `status` is read
   * back off the row, never assumed from the request.
   */
  async despatch(
    rules: StockVoucherTypeRules,
    args: {
      svhId: string;
      accYear: string;
      companyId: string;
      branchId: string;
      userId?: string;
      lrNo?: string | null;
      vehicleNo?: string | null;
      expectedOn?: string | null;
    },
  ): Promise<StockTransferDespatchResult> {
    const { svhId, accYear, companyId, branchId } = args;
    const actor = resolveActor(args.userId, this.requestContextService.getUserId());

    // §0.3(a). stt_lr_no, stt_vehicle_no and stt_expected_on exist on
    // stock_transit and NOTHING IN THE ENGINE WRITES THEM —
    // fn_svh_post_transfer neither takes them nor sets them. They are written
    // here, keyed by the OUT, in the POST'S OWN TRANSACTION: a second
    // transaction could commit the despatch and then fail to record the lorry,
    // and a despatch note without a vehicle number is not a despatch note.
    //
    // A same-branch transfer created no transit rows and this updates nothing,
    // which is correct rather than an error — the screen is the same screen,
    // and the response says sameBranch so it can stop asking for a vehicle.
    const hasLorry =
      args.lrNo !== undefined || args.vehicleNo !== undefined || args.expectedOn !== undefined;

    // The shared post does the whole document dance — the DRAFT check, the
    // preflight, the engine call through rules.postFunction, the reload and the
    // audit row. Only the lorry is ours.
    const posted = await this.stockVoucherService.post(
      rules,
      svhId,
      accYear,
      companyId,
      branchId,
      args.userId,
      hasLorry
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
        : undefined,
    );

    const transit = await this.loadTransitRows(svhId, accYear);

    return {
      ...posted,
      // Read from the DOCUMENT, not from the request: the engine decided this,
      // and a client that sent no toBranchId to a branch that has one would
      // otherwise be told the wrong shape.
      sameBranch: !posted.header.toBranchId || posted.header.toBranchId === posted.header.branchId,
      status: posted.header.status,
      ledgerRows: posted.rowsPosted,
      transitRows: transit.length,
      transit,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §5 — lists and loads
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * §5.3 — one voucher, plus its transit rows on an inter-branch OUT, so the
   * sender can see what has been received against each line. A same-branch
   * transfer simply has none.
   */
  async getOne(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
  ): Promise<StockVoucherPayload & { transit: StockTransitRow[] }> {
    const document = await this.stockVoucherService.getById(
      rules,
      svhId,
      accYear,
      companyId,
      branchId,
    );
    return { ...document, transit: await this.loadTransitRows(svhId, accYear) };
  }

  /**
   * §5.2 — the inbound worklist, which is Q14's question: what is on its way to
   * me, how long has it been in flight, and what is short.
   *
   * NO accYear. It is scoped by the RECEIVING branch against somebody else's
   * document, and a transfer despatched on 29 March is received in April —
   * stock_transit is unpartitioned and carries both halves' years separately
   * for exactly this reason. Filtering it by a year would drop every transfer
   * that crossed the year end, which are the ones most likely to be lost.
   */
  async inbound(
    companyId: string,
    branchId: string,
    limit = 100,
    offset = 0,
  ): Promise<{
    items: Array<
      StockTransitRow & { outRefno: string | null; fromBranchId: string; daysInFlight: number }
    >;
    meta: { limit: number; offset: number; count: number };
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<
        TransitDbRow & {
          stt_out_refno: string | null;
          stt_from_branch_id: string;
          days_in_flight: number;
          total_count: bigint;
        }
      >
    >`
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

  // ──────────────────────────────────────────────────────────────────────────
  // §6 — the receipt prefill
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * WHAT IS STILL OWED LIVES IN stock_transit, NOT IN THE OUT'S LINES.
   *
   * A second, partial receipt must open with the REMAINDER. Prefilling from the
   * despatch's lines is the bug that lets a clerk receive 30 twice — the lines
   * still say 30 after 25 have arrived, because a posted document does not
   * change.
   */
  async prefill(
    companyId: string,
    branchId: string,
    outVoucherId: string,
    accYear: string,
  ): Promise<StockTransferPrefill> {
    const [out] = await this.prisma.$queryRaw<
      Array<{
        svh_id: string;
        svh_acc_year: string;
        svh_refno: string;
        svh_doc_date: Date;
        svh_status: string;
        svh_branch_id: string;
        svh_from_godown_id: string | null;
        svh_to_branch_id: string | null;
        svh_to_godown_id: string | null;
        svh_is_deleted: boolean;
      }>
    >`
      SELECT svh_id, svh_acc_year, svh_refno, svh_doc_date, svh_status, svh_branch_id,
             svh_from_godown_id, svh_to_branch_id, svh_to_godown_id, svh_is_deleted
        FROM stock.stock_voucher
       WHERE svh_id = ${outVoucherId}::uuid
         AND svh_acc_year = ${accYear}::bpchar
         AND svh_company_id = ${companyId}::uuid
         AND svh_voucher_type = 'TRANSFER_OUT'
    `;

    if (!out) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        'Transfer not found',
        'outVoucherId',
        `No TRANSFER_OUT ${outVoucherId} in ${accYear} for this company.`,
      );
    }
    this.assertReceivable(out, branchId);

    const rows = await this.loadTransitRows(outVoucherId, accYear, { openOnly: true });

    return {
      outVoucher: {
        svhId: out.svh_id,
        accYear: out.svh_acc_year.trim(),
        refno: out.svh_refno,
        docDate: this.toIsoDate(out.svh_doc_date) as string,
        status: out.svh_status as StockVoucherStatus,
        fromBranchId: out.svh_branch_id,
        fromGodownId: out.svh_from_godown_id,
        toBranchId: out.svh_to_branch_id,
        toGodownId: out.svh_to_godown_id,
      },
      // lineNo is assigned HERE rather than by the client so the receipt grid
      // and the transit rows agree from the first render.
      rows: rows.map((row, index): StockTransferPrefillRow => ({ ...row, lineNo: index + 1 })),
    };
  }

  /**
   * The three things that make a despatch receivable, checked in the order a
   * clerk would ask them.
   *
   * `svh_is_deleted` is checked HERE because fn_svh_receive_transfer never
   * checks it (MUST-FIX 2) — a receipt against a soft-deleted despatch would
   * post stock into the destination against a document the sender has thrown
   * away.
   */
  private assertReceivable(
    out: {
      svh_refno: string;
      svh_status: string;
      svh_to_branch_id: string | null;
      svh_is_deleted: boolean;
    },
    branchId: string,
  ): void {
    if (out.svh_is_deleted) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>('Transfer is deleted', [
        {
          field: 'outVoucherId',
          message: `${out.svh_refno} has been deleted by the sending branch.`,
        },
      ]);
    }
    if (out.svh_to_branch_id !== branchId) {
      // Named rather than merely 404'd: a clerk at the wrong branch needs to be
      // told it is not theirs, not that it does not exist.
      throwStockConflict<StockErrorDetail, StockErrorResponse>('Transfer is for another branch', [
        {
          field: 'branchId',
          message: `${out.svh_refno} was sent to another branch. A transfer can only be received where it was addressed.`,
        },
      ]);
    }
    if (out.svh_status !== 'IN_TRANSIT') {
      throwStockConflict<StockErrorDetail, StockErrorResponse>(`Transfer is ${out.svh_status}`, [
        {
          field: 'outVoucherId',
          message:
            out.svh_status === 'RECEIVED'
              ? `${out.svh_refno} has already been received in full.`
              : `${out.svh_refno} is ${out.svh_status}; only a despatched transfer can be received. A same-branch transfer posts both halves at once and has nothing to receive.`,
        },
      ]);
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §7 — save a TRANSFER_IN draft
  // ──────────────────────────────────────────────────────────────────────────

  async saveReceive(
    rules: StockVoucherTypeRules,
    dto: SaveStockTransferReceiveDto,
  ): Promise<StockVoucherPayload> {
    const { header } = dto;
    const [out] = await this.prisma.$queryRaw<
      Array<{
        svh_id: string;
        svh_refno: string;
        svh_status: string;
        svh_branch_id: string;
        svh_from_godown_id: string | null;
        svh_to_branch_id: string | null;
        svh_to_godown_id: string | null;
        svh_is_deleted: boolean;
      }>
    >`
      SELECT svh_id, svh_refno, svh_status, svh_branch_id, svh_from_godown_id,
             svh_to_branch_id, svh_to_godown_id, svh_is_deleted
        FROM stock.stock_voucher
       WHERE svh_id = ${header.linkSrcDocId}::uuid
         AND svh_acc_year = ${header.linkSrcAccYear}::bpchar
         AND svh_company_id = ${header.companyId}::uuid
         AND svh_voucher_type = 'TRANSFER_OUT'
    `;

    if (!out) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        'Transfer not found',
        'linkSrcDocId',
        `No TRANSFER_OUT ${header.linkSrcDocId} in ${header.linkSrcAccYear} for this company. A receipt must name the despatch it is against.`,
      );
    }
    this.assertReceivable(out, header.branchId);

    const transit = await this.loadTransitRows(header.linkSrcDocId, header.linkSrcAccYear, {
      openOnly: true,
    });
    this.assertReceiveLines(dto, transit);

    // §7.1 — the link's module and doc type are STAMPED, not accepted. The
    // engine checks all three by hand and ck_svh_transfer_in_link checks the
    // id; there is nothing here for a client to choose, and a client that chose
    // wrong would be refused by the engine with a constraint name.
    //
    // The godowns are copied from the OUT for the same reason:
    // ck_svh_transfer_godowns applies to a TRANSFER_IN too even though only the
    // LINE godown is used by the matcher, and a receipt that names its own
    // would be describing a movement that did not happen.
    const payload = {
      ...dto,
      header: {
        ...dto.header,
        linkSrcModule: TRANSFER_LINK_SRC_MODULE,
        linkSrcDocType: TRANSFER_LINK_SRC_DOC_TYPE,
        fromGodownId: out.svh_from_godown_id,
        toGodownId: out.svh_to_godown_id,
      },
    };

    return this.stockVoucherService.save(rules, payload as unknown as SaveStockVoucherDto);
  }

  /**
   * §7.2 — the five refusals, before the engine.
   *
   * The engine makes three of them itself (23514 on over-receipt, no_data_found
   * on an unmatched line, 0A000 on a two-bucket shipment) but one line at a
   * time and after a rollback. The fourth — the bucket check — it makes only in
   * ONE direction, and the missing direction is the expensive one.
   */
  private assertReceiveLines(dto: SaveStockTransferReceiveDto, transit: StockTransitRow[]): void {
    const errors: StockErrorDetail[] = [];
    const { lines } = dto;

    if (!lines.length) {
      // The shared service refuses an empty document too, but this message says
      // the thing that is actually true here: nothing arrived is not a receipt.
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        'This receipt cannot be saved',
        [
          {
            field: 'lines',
            message:
              'A receipt records what ARRIVED. If nothing arrived there is no receipt to raise — a short is what remains unkeyed, and it keeps the transfer open by itself.',
          },
        ],
      );
    }

    // The matcher is (item, lot, destination godown) — WITHOUT bucket, exactly
    // as fn_svh_receive_transfer matches, so that a payload this accepts is one
    // the engine can also match.
    const byMatcher = new Map<string, StockTransitRow[]>();
    transit.forEach((row) => {
      const key = `${row.itemId}|${row.lotId}|${row.toGodownId}`;
      byMatcher.set(key, [...(byMatcher.get(key) ?? []), row]);
    });

    // Two receipt lines may draw on ONE transit row — 25 good and 3 broken off
    // the same shipment, which is the worked example — so the over-receipt
    // check is against the document's TOTAL for that row. Checked line by line
    // it passes twice and over-receives once.
    const claimed = new Map<string, number>();
    lines.forEach((line) => {
      const key = `${line.itemId}|${line.lotId ?? ''}|${line.godownId}`;
      claimed.set(key, (claimed.get(key) ?? 0) + this.lineQty(line));
    });

    const reported = new Set<string>();
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
        // 0A000 from the engine. It can only happen on a shipment that was
        // saved before the despatch-side check existed.
        errors.push({
          field,
          message: `Line ${line.lineNo}: this item and lot were shipped in more than one bucket (${rows.map((row) => row.bucket).join(', ')}). The receipt cannot tell them apart. The sender must cancel and ship them as separate transfers.`,
        });
        return;
      }

      const row = rows[0];
      const bucket = line.bucket ?? 'SALEABLE';

      // SHOULD-FIX. The engine treats a line as damage only when
      // svi_bucket = 'DAMAGED' against a non-damaged transit row; it never
      // checks the OTHER direction, so a DAMAGED consignment received as
      // SALEABLE posts damaged goods into the clean bucket, silently. That is
      // stock laundering by typo, and it is refused here.
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
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>(
        'This receipt cannot be saved',
        errors,
      );
    }
  }

  private lineQty(line: SaveStockVoucherItemDto): number {
    return Number(line.qty ?? 0) + Number(line.freeQty ?? 0);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // §8 — post the receipt
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * BOTH DOCUMENTS' NEW STATE, because the receipt closing does not mean the
   * transfer closed.
   *
   * The OUT flips to RECEIVED only when no transit row of it has anything left.
   * A SHORT KEEPS IT OPEN ON PURPOSE — that is the loss report, and the
   * write-off is a separate decision the engine deliberately does not automate.
   * There is no "auto write-off short" here and there must not be one.
   */
  async receive(
    rules: StockVoucherTypeRules,
    svhId: string,
    accYear: string,
    companyId: string,
    branchId: string,
    userId?: string,
  ): Promise<StockTransferReceiveResult> {
    const draft = await this.stockVoucherService.getById(
      rules,
      svhId,
      accYear,
      companyId,
      branchId,
    );
    const outId = draft.header.linkSrcDocId;
    const outAccYear = draft.header.linkSrcAccYear;
    if (!outId || !outAccYear) {
      // ck_svh_transfer_in_link should have made this impossible; if it is
      // reachable the document was written by something other than this module.
      throwStockConflict<StockErrorDetail, StockErrorResponse>('Receipt links no transfer', [
        {
          field: 'linkSrcDocId',
          message: `${draft.header.refno} names no despatch. A receipt cannot be posted without the transfer it is against.`,
        },
      ]);
    }

    const posted = await this.stockVoucherService.post(
      rules,
      svhId,
      accYear,
      companyId,
      branchId,
      userId,
    );

    const [out] = await this.prisma.$queryRaw<
      Array<{ svh_id: string; svh_acc_year: string; svh_refno: string; svh_status: string }>
    >`
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
        status: (out?.svh_status ?? 'IN_TRANSIT') as StockVoucherStatus,
        // The same question fn_svh_receive_transfer asks before flipping the
        // OUT: has any row of it anything left?
        closed: transit.every((row) => row.remainingQty <= 0),
      },
      transit,
    };
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Reading stock_transit
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * `openOnly` is what the prefill needs and what a load must NOT use: the
   * sender looking at a despatched transfer wants to see the settled rows too,
   * because "25 of 30 received" is the answer to their question.
   */
  private async loadTransitRows(
    outVoucherId: string,
    outAccYear: string,
    options: { openOnly?: boolean } = {},
  ): Promise<StockTransitRow[]> {
    const openOnly = options.openOnly === true;
    const rows = await this.prisma.$queryRaw<TransitDbRow[]>`
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

  private toTransitRow(row: TransitDbRow): StockTransitRow {
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
      bucket: row.stt_bucket as StockBucket,
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

  private toIsoDate(value: Date | null): string | null {
    return value ? value.toISOString().slice(0, 10) : null;
  }

  /** stock_balance's grain, and stock_transit's: godown × lot × bucket. */
  private holdingKey(
    lotId: string | null | undefined,
    godownId: string,
    bucket: string | null | undefined,
  ): string {
    return `${lotId ?? ''}|${godownId}|${bucket ?? 'SALEABLE'}`;
  }
}
