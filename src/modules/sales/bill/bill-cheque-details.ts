import { Prisma } from '@prisma/client';
import type {
  SaveTenderDetailDto,
  TenderChequeDetailDto,
} from '../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import {
  matchChequeDetails,
  readPdcChequeDetails,
  type PdcChequeDetail,
} from '../posting/pdc-register.helper';
import { TENDER_TYPE } from '../posting/sales-doc.utils';

/**
 * notes (48) — a cheque tender's drawer, bank branch, IFSC and MICR.
 *
 * Their home is the cheque register row (acc_pdc_register), never the tender
 * row. But the register row is only written at /bills/post, so a DRAFT keeps
 * them in `sale_bill.sb_draft_cheques`, keyed by td_id, until then:
 *
 *   /create, /update, the amend's re-save → buildDraftCheques → sb_draft_cheques
 *   /post (postCore)                      → readDraftCheques → the register row,
 *                                           and sb_draft_cheques back to NULL
 *   /get                                  → chequeDetailsFor: the register row,
 *                                           else the draft's
 *
 * `null` for a row means "sent, and empty" (the register gets the party as the
 * drawer and nothing else); a row with no entry means "not sent", which keeps
 * whatever the register row already holds — so an amend from a client that
 * never keys them wipes nothing.
 */
export type BillDraftCheques = Record<string, PdcChequeDetail | null>;

/** The draft's stored details, defensively — a bad value reads as none. */
export function readDraftCheques(value: Prisma.JsonValue | null | undefined): BillDraftCheques {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {};
  }
  const out: BillDraftCheques = {};
  for (const [tdId, raw] of Object.entries(value)) {
    if (raw === null) {
      out[tdId] = null;
    } else if (typeof raw === 'object' && !Array.isArray(raw)) {
      const r = raw as Record<string, unknown>;
      out[tdId] = {
        drawerName: str(r.drawerName),
        bankBranch: str(r.bankBranch),
        ifsc: str(r.ifsc),
        micr: str(r.micr),
      };
    }
  }
  return out;
}

/**
 * The draft's details after a save. `undefined` when the payload omitted
 * `tenders` (nothing to change). Each payload row is matched to the row the
 * tender sync persisted by its td_id, else by the row number the sync gave it
 * (`tdRowNo ?? position`). A cheque row that did not send `cheque` keeps its
 * earlier draft entry; a row that is no longer a live cheque drops its entry.
 */
export function buildDraftCheques(
  payload: readonly SaveTenderDetailDto[] | undefined,
  persisted: readonly {
    tdId: string;
    tdRowNo: number;
    tdTenderTypeId: number | string;
    tdIsDeleted?: boolean | null;
  }[],
  prior: BillDraftCheques,
): BillDraftCheques | undefined {
  if (!payload) {
    return undefined;
  }
  const live = new Set(
    persisted
      .filter((row) => !row.tdIsDeleted && Number(row.tdTenderTypeId) === TENDER_TYPE.CHEQUE)
      .map((row) => row.tdId),
  );
  const next: BillDraftCheques = {};
  for (const tdId of live) {
    if (tdId in prior) {
      next[tdId] = prior[tdId];
    }
  }
  Object.assign(next, matchChequeDetails(payload, persisted));
  return next;
}

/** What goes into the column: NULL rather than an empty object. */
export function toDraftChequesJson(
  drafts: BillDraftCheques,
): Prisma.InputJsonValue | typeof Prisma.DbNull {
  return Object.keys(drafts).length > 0 ? (drafts as Prisma.InputJsonValue) : Prisma.DbNull;
}

/**
 * The details to echo on each cheque row of a bill: the register row's when
 * the cheque is registered (posted), else the draft's. Keyed by td_id.
 */
export async function chequeDetailsFor(
  client: Prisma.TransactionClient,
  tenders: readonly { tdId: string; tdTenderTypeId: number | string }[],
  draft: Prisma.JsonValue | null | undefined,
): Promise<Map<string, TenderChequeDetailDto | null>> {
  const ids = tenders
    .filter((t) => Number(t.tdTenderTypeId) === TENDER_TYPE.CHEQUE)
    .map((t) => t.tdId);
  const out = new Map<string, TenderChequeDetailDto | null>();
  if (ids.length === 0) {
    return out;
  }
  const drafts = readDraftCheques(draft);
  const registered = await readPdcChequeDetails(client, ids);
  for (const id of ids) {
    const detail = registered.get(id) ?? drafts[id] ?? null;
    out.set(id, detail ? toDetail(detail) : null);
  }
  return out;
}

function toDetail(detail: PdcChequeDetail | TenderChequeDetailDto | null): PdcChequeDetail | null {
  if (!detail) {
    return null;
  }
  return {
    drawerName: detail.drawerName ?? null,
    bankBranch: detail.bankBranch ?? null,
    ifsc: detail.ifsc ?? null,
    micr: detail.micr ?? null,
  };
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}
