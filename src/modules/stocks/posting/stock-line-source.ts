import type { Prisma } from '@prisma/client';
import type { StockVoucherTypeRules } from '../stock-voucher/types/stock-voucher.types';

/**
 * §3.1 — the adapter every document posts stock through.
 *
 * The engine today reads `stock.stock_voucher_item` directly. A delivery
 * challan, a sale bill and a sale return move stock in exactly the same way and
 * must NOT each grow an engine of their own: that is precisely the divergence
 * that already happened once, when the `.sql` engine and the NestJS one drifted
 * apart with nobody the wiser.
 *
 * So a source says WHO is moving stock and hands the engine the lines; the
 * phases — resolveLots → attachLotsToLines → writeLedger → applyBalances →
 * applyItemCost → assertNegativeStockPolicy → refreshLotTotals — belong to
 * `StockPostingService` and to nothing else.
 */

export type StockSrcModule = 'SALES' | 'STOCK' | 'PURCHASE';

export type StockSrcDocType =
  | 'DELIVERY_CHALLAN'
  | 'SALE_BILL'
  | 'SALE_RETURN'
  | 'DC_RETURN'
  | 'STOCK_VOUCHER';

/** What the movement IS. `direction` says which way the goods went. */
export type StockTxnType =
  | 'DC_ISSUE'
  | 'SALE'
  | 'SALE_RETURN'
  | 'DC_RETURN'
  | 'OPENING'
  | 'ADJUSTMENT'
  | 'TRANSFER_OUT'
  | 'TRANSFER_IN'
  | 'COUNT'
  | 'REPACK_OUT'
  | 'REPACK_IN';

/** One line, as the engine needs it — item, lot identity, quantity, cost. */
export interface StockLine {
  lineId: string;
  lineNo: number;
  splitNo: number;
  itemId: string;
  godownId: string;
  /** A lot the caller has already chosen; otherwise the engine resolves one. */
  lotId?: string | null;
  bucket: string;
  unitId: string | null;
  /** Document unit → base unit. */
  factor: number;
  qty: number;
  baseQty: number;
  freeQty: number;
  freeBaseQty: number;
  /** Lot identity, filtered by the item's effective track policy. */
  batchNo?: string | null;
  batchDate?: string | null;
  expiryDate?: string | null;
  serialNo?: string | null;
  mrp?: number | null;
  salePrice?: number | null;
  supplierId?: string | null;
  /** What the document charged. The COST comes out of the engine. */
  docRate?: number | null;
  docRateWot?: number | null;
  isService?: boolean;
}

/** The document, as the engine sees it. */
export interface StockLineSource {
  srcModule: StockSrcModule;
  srcDocType: StockSrcDocType;
  srcDocId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  tenantId?: string | null;
  docDate: string;
  /**
   * The moment the goods actually MOVED — not the moment the row arrives.
   *
   * This is the whole point of the freeze fix: a sale made at 10:00, before a
   * count began, that syncs at 14:00 during it, moved before the freeze and
   * must not be refused for arriving late. See `StockPostingService`.
   */
  docDatetime: string;
  refno: string;
  partyId?: string | null;
  reasonId?: string | null;
  txnType: StockTxnType;
  /** +1 inward, -1 outward. */
  direction: 1 | -1;

  lines(tx: Prisma.TransactionClient): Promise<StockLine[]>;

  /** Write the resolved lot and cost back onto the document's own line. */
  attachLot(
    tx: Prisma.TransactionClient,
    lineId: string,
    lotId: string,
    costRate: number,
    costRateWot: number,
  ): Promise<void>;

  /**
   * The godowns this document touches, for the freeze guard. Defaults to the
   * distinct godowns of `lines()`; a source that already knows them says so
   * and saves the read.
   */
  godownIds?(tx: Prisma.TransactionClient): Promise<string[]>;
}

/**
 * The existing caller, unchanged in behaviour.
 *
 * `stock_voucher` keeps its own engine SQL — the CTE chain in
 * `stock-voucher-posting.helper.ts` reads `stock_voucher_item` directly and is
 * the reference implementation of all seven phases. This source carries the
 * rule record that SQL needs, so the service can run it without knowing
 * anything about stock vouchers.
 */
export interface StockVoucherSourceInput {
  svhId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  rules: StockVoucherTypeRules;
}
