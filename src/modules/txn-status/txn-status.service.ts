import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma/prisma.service';

/**
 * A document whose LATEST status step still says it is not done: DRAFT, HELD,
 * CONFIRMED, or IN_TRANSIT (a despatch on a lorry).
 */
export const PENDING_STATUSES = ['DRAFT', 'HELD', 'CONFIRMED', 'IN_TRANSIT'] as const;

export interface PendingDocument {
  srcModule: string;
  srcDocType: string;
  srcDocId: string;
  refno: string | null;
  /** The document's own year — the partition it lives in. */
  accYear: string;
  status: string;
  /** When it entered this status. */
  since: string;
  changedBy: string | null;
  changedByName: string | null;
  branchId: string;
}

export interface PendingCount {
  srcModule: string;
  srcDocType: string;
  status: string;
  count: number;
}

export interface PendingDocumentsResult {
  items: PendingDocument[];
  counts: PendingCount[];
  total: number;
}

export interface PendingQuery {
  companyId: string;
  branchId?: string | null;
  accYear: string;
  /** Inclusive: steps up to the END of this day. Defaults to now. */
  upToDate?: string | null;
  srcModule?: string | null;
  limit?: number;
  offset?: number;
}

interface PendingRow {
  tsl_src_module: string;
  tsl_src_doc_type: string;
  tsl_src_doc_id: string;
  tsl_src_doc_refno: string | null;
  tsl_acc_year: string;
  tsl_to_status: string;
  tsl_changed_on: Date;
  tsl_changed_by: string | null;
  changed_by_name: string | null;
  tsl_branch_id: string;
  total_count: bigint;
}

/**
 * §1.10 — day end: "is anything still unposted?"
 *
 * `public.txn_status_log` is the one table every module already writes. The
 * pending documents are the LATEST event per `tsl_src_doc_id` whose
 * `tsl_to_status` is one of PENDING_STATUSES. Three things that make the answer
 * right, each of which was wrong before 2026-09-28:
 *
 *   * LATEST BY `tsl_seq_no`, NEVER BY `tsl_changed_on`. On a save-and-post the
 *     CREATED row used to be stamped ~50 ms AFTER the POSTED row (seq 2 POSTED
 *     15:29:20.489, seq 1 CREATED 15:29:20.543); sorting by time called 109
 *     posted openings "draft". The writer takes one instant per request now,
 *     and this reader orders by the sequence anyway.
 *   * sale-order drafts are logged at creation (they were not);
 *   * DC returns and cheques file under their own doc types, not OTHER.
 *
 * A soft delete leaves the status column alone and logs a DELETED event, so a
 * document whose latest event is DELETED is out of play whatever its status.
 */
@Injectable()
export class TxnStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async pending(query: PendingQuery): Promise<PendingDocumentsResult> {
    const limit = Math.min(Math.max(query.limit ?? 200, 1), 2000);
    const offset = Math.max(query.offset ?? 0, 0);
    const branchId = query.branchId ?? null;
    const srcModule = query.srcModule?.trim().toUpperCase() || null;
    // "Up to date" means the whole of that day, in the server's zone.
    const upTo = query.upToDate ? new Date(`${query.upToDate}T23:59:59.999`) : null;
    const latest = Prisma.sql`
      SELECT DISTINCT ON (tsl.tsl_src_doc_type, tsl.tsl_src_doc_id, tsl.tsl_acc_year)
             tsl.tsl_src_module, tsl.tsl_src_doc_type, tsl.tsl_src_doc_id, tsl.tsl_src_doc_refno,
             tsl.tsl_acc_year, tsl.tsl_event, tsl.tsl_to_status, tsl.tsl_changed_on,
             tsl.tsl_changed_by, tsl.tsl_branch_id
        FROM public.txn_status_log tsl
       WHERE tsl.tsl_company_id = ${query.companyId}::uuid
         AND tsl.tsl_acc_year   = ${query.accYear}::bpchar
         AND (${branchId}::uuid IS NULL OR tsl.tsl_branch_id = ${branchId}::uuid)
         AND (${srcModule}::text IS NULL OR tsl.tsl_src_module = ${srcModule}::text)
         AND (${upTo}::timestamptz IS NULL OR tsl.tsl_changed_on <= ${upTo}::timestamptz)
         AND tsl.tsl_is_deleted = false
       ORDER BY tsl.tsl_src_doc_type, tsl.tsl_src_doc_id, tsl.tsl_acc_year, tsl.tsl_seq_no DESC
    `;
    const pendingWhere = Prisma.sql`
      l.tsl_to_status = ANY(${[...PENDING_STATUSES]}::text[])
      AND l.tsl_event <> 'DELETED'
    `;
    const [rows, counts] = await Promise.all([
      this.prisma.$queryRaw<PendingRow[]>`
        WITH latest AS (${latest})
        SELECT l.tsl_src_module, l.tsl_src_doc_type, l.tsl_src_doc_id, l.tsl_src_doc_refno,
               l.tsl_acc_year, l.tsl_to_status, l.tsl_changed_on, l.tsl_changed_by, l.tsl_branch_id,
               u.usr_login_name AS changed_by_name,
               COUNT(*) OVER () AS total_count
          FROM latest l
          LEFT JOIN public.user_master u ON u.usr_id = l.tsl_changed_by
         WHERE ${pendingWhere}
         ORDER BY l.tsl_changed_on ASC, l.tsl_src_doc_refno
         LIMIT ${limit} OFFSET ${offset}
      `,
      this.prisma.$queryRaw<
        { tsl_src_module: string; tsl_src_doc_type: string; tsl_to_status: string; n: bigint }[]
      >`
        WITH latest AS (${latest})
        SELECT l.tsl_src_module, l.tsl_src_doc_type, l.tsl_to_status, COUNT(*) AS n
          FROM latest l
         WHERE ${pendingWhere}
         GROUP BY 1, 2, 3
         ORDER BY 1, 2, 3
      `,
    ]);
    return {
      items: rows.map((r) => ({
        srcModule: r.tsl_src_module,
        srcDocType: r.tsl_src_doc_type,
        srcDocId: r.tsl_src_doc_id,
        refno: r.tsl_src_doc_refno,
        accYear: r.tsl_acc_year.trim(),
        status: r.tsl_to_status,
        since: r.tsl_changed_on.toISOString(),
        changedBy: r.tsl_changed_by,
        changedByName: r.changed_by_name,
        branchId: r.tsl_branch_id,
      })),
      counts: counts.map((c) => ({
        srcModule: c.tsl_src_module,
        srcDocType: c.tsl_src_doc_type,
        status: c.tsl_to_status,
        count: Number(c.n),
      })),
      total: Number(rows[0]?.total_count ?? 0),
    };
  }
}
