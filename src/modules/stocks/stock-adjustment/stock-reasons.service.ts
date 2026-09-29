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
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import type { StockErrorDetail, StockErrorResponse } from '../stock-voucher/types/stock-voucher.types';
import type {
  DeactivateStockReasonDto,
  SaveStockReasonDto,
  StockReasonPickerQueryDto,
} from './dto/stock-reason.dto';
import { BUCKET_MOVE_KIND, STOCK_ADJUSTMENT_RULES, type StockAdjustmentKind } from './stock-adjustment.rules';

export interface StockReasonRow {
  srmId: string;
  companyId: string | null;
  /** true when the row is shared with every company (srm_company_id NULL). */
  isShared: boolean;
  code: string;
  name: string;
  direction: string;
  allowedTxnTypes: string[];
  requireRemarks: boolean;
  glLedgerId: string | null;
  glLedgerName: string | null;
  sortOrder: number;
  remarks: string | null;
  isActive: boolean;
}

export interface StockReasonListRow extends StockReasonRow {
  /** A SHARED row that this company has its own row for (same code): the picker hides it. */
  isOverridden: boolean;
  usageCount: number;
  /** No use anywhere and the company's own: a delete really deletes. */
  canDelete: boolean;
}

export interface StockReasonUsage {
  srmId: string;
  ledgerRows: number;
  voucherHeaders: number;
  voucherLines: number;
  lastUsedOn: string | null;
}

interface RawReason {
  srm_id: string;
  srm_company_id: string | null;
  srm_code: string;
  srm_name: string;
  srm_direction: string;
  srm_allowed_txn_types: string[];
  srm_require_remarks: boolean;
  srm_gl_ledger_id: string | null;
  led_name: string | null;
  srm_sort_order: number;
  srm_remarks: string | null;
  srm_is_active: boolean;
}

/**
 * `stock.stock_reason_master` — the picker (16q Q17) and the maintenance
 * screen that was missing (Q18–Q20, plan §6).
 *
 * The three write rules the schema cannot enforce:
 *  1. a company may not edit or delete a SHARED row (`srm_company_id IS NULL`);
 *     to change one it creates its own row with the same code, which then
 *     hides the shared one for that company;
 *  2. `srm_code` is immutable once any ledger row cites the reason;
 *  3. delete means deactivate; `srm_is_deleted` only for a reason never used.
 */
@Injectable()
export class StockReasonsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  /** Q17 — shared + company rows merged (a company row hides the shared one with the same code), filtered for one kind. */
  async pick(query: StockReasonPickerQueryDto): Promise<StockReasonRow[]> {
    const kindTypes = STOCK_ADJUSTMENT_RULES[query.voucherType].ledgerTxnTypes as string[];
    // A move cites a MOVE reason, never an any-movement one: PILFERAGE on a
    // move would read as a write-off that wrote nothing off.
    const strict = query.voucherType === BUCKET_MOVE_KIND;
    const rows = await this.prisma.$queryRaw<RawReason[]>`
      SELECT r.srm_id, r.srm_company_id, r.srm_code, r.srm_name, r.srm_direction, r.srm_allowed_txn_types,
             r.srm_require_remarks, r.srm_gl_ledger_id, l.led_name, r.srm_sort_order, r.srm_remarks, r.srm_is_active
        FROM stock.stock_reason_master r
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = r.srm_gl_ledger_id
       WHERE r.srm_is_deleted = false AND r.srm_is_active = true
         AND (r.srm_company_id = ${query.companyId}::uuid
              OR (r.srm_company_id IS NULL AND NOT EXISTS (
                    SELECT 1 FROM stock.stock_reason_master o
                     WHERE o.srm_company_id = ${query.companyId}::uuid AND o.srm_code = r.srm_code
                       AND o.srm_is_deleted = false)))
         AND ((NOT ${strict}::boolean AND cardinality(r.srm_allowed_txn_types) = 0)
              OR r.srm_allowed_txn_types && ${kindTypes}::text[])
         AND (${query.direction ?? null}::text IS NULL OR r.srm_direction IN (${query.direction ?? null}::text, 'BOTH'))
       ORDER BY r.srm_sort_order, r.srm_code
    `;
    return rows.map(toRow);
  }

  /** Q18 — every row the company can see, with override / usage / can-delete facts. */
  async list(companyId: string, includeInactive = false): Promise<StockReasonListRow[]> {
    const rows = await this.prisma.$queryRaw<
      Array<RawReason & { is_overridden: boolean; usage_count: bigint }>
    >`
      SELECT r.srm_id, r.srm_company_id, r.srm_code, r.srm_name, r.srm_direction, r.srm_allowed_txn_types,
             r.srm_require_remarks, r.srm_gl_ledger_id, l.led_name, r.srm_sort_order, r.srm_remarks, r.srm_is_active,
             (r.srm_company_id IS NULL AND EXISTS (
                SELECT 1 FROM stock.stock_reason_master o
                 WHERE o.srm_company_id = ${companyId}::uuid AND o.srm_code = r.srm_code AND o.srm_is_deleted = false))
                                                                                                    AS is_overridden,
             (SELECT count(*) FROM stock.stock_ledger sml WHERE sml.sml_reason_id = r.srm_id)
           + (SELECT count(*) FROM stock.stock_voucher svh WHERE svh.svh_reason_id = r.srm_id)
           + (SELECT count(*) FROM stock.stock_voucher_item svi WHERE svi.svi_reason_id = r.srm_id)  AS usage_count
        FROM stock.stock_reason_master r
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = r.srm_gl_ledger_id
       WHERE r.srm_is_deleted = false
         AND (r.srm_company_id IS NULL OR r.srm_company_id = ${companyId}::uuid)
         AND (${includeInactive}::boolean OR r.srm_is_active = true)
       ORDER BY r.srm_sort_order, r.srm_code, (r.srm_company_id IS NULL)
    `;
    return rows.map((r) => ({
      ...toRow(r),
      isOverridden: r.is_overridden,
      usageCount: Number(r.usage_count),
      canDelete: Number(r.usage_count) === 0 && r.srm_company_id !== null,
    }));
  }

  /** Q19 */
  async getOne(companyId: string, srmId: string): Promise<StockReasonListRow> {
    const rows = await this.list(companyId, true);
    const row = rows.find((r) => r.srmId === srmId);
    if (!row) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>('Stock reason not found', 'srmId', `No stock reason ${srmId} visible to this company.`);
    }
    return row;
  }

  /** Q20 */
  async usage(companyId: string, srmId: string): Promise<StockReasonUsage> {
    await this.getOne(companyId, srmId);
    const [row] = await this.prisma.$queryRaw<
      Array<{ ledger_rows: bigint; headers: bigint; lines: bigint; last_used: Date | null }>
    >`
      SELECT (SELECT count(*) FROM stock.stock_ledger WHERE sml_reason_id = ${srmId}::uuid)           AS ledger_rows,
             (SELECT count(*) FROM stock.stock_voucher WHERE svh_reason_id = ${srmId}::uuid)          AS headers,
             (SELECT count(*) FROM stock.stock_voucher_item WHERE svi_reason_id = ${srmId}::uuid)     AS lines,
             GREATEST((SELECT max(sml_posted_on) FROM stock.stock_ledger WHERE sml_reason_id = ${srmId}::uuid),
                      (SELECT max(svh_created_on) FROM stock.stock_voucher WHERE svh_reason_id = ${srmId}::uuid),
                      (SELECT max(svi_created_on) FROM stock.stock_voucher_item WHERE svi_reason_id = ${srmId}::uuid)) AS last_used
    `;
    return {
      srmId,
      ledgerRows: Number(row?.ledger_rows ?? 0),
      voucherHeaders: Number(row?.headers ?? 0),
      voucherLines: Number(row?.lines ?? 0),
      lastUsedOn: row?.last_used ? row.last_used.toISOString() : null,
    };
  }

  /** Create or update the company's OWN row. A shared row is never written here. */
  async save(dto: SaveStockReasonDto): Promise<StockReasonListRow> {
    const actor = resolveActor(dto.userId, this.requestContextService.getUserId());
    const author = actor === DEFAULT_ACTOR ? null : actor;
    const now = new Date();
    const code = dto.code.trim().toUpperCase();
    const allowed = [...new Set((dto.allowedTxnTypes ?? []).map((t) => t.trim().toUpperCase()).filter(Boolean))];
    if (dto.glLedgerId) {
      const [ledger] = await this.prisma.$queryRaw<Array<{ led_id: string }>>`
        SELECT led_id FROM accounts.acc_ledger_master
         WHERE led_id = ${dto.glLedgerId}::uuid AND led_is_deleted = false
      `;
      if (!ledger) {
        throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Stock reason cannot be saved', [
          { field: 'glLedgerId', message: `No ledger ${dto.glLedgerId}.` },
        ]);
      }
    }
    if (dto.srmId) {
      const [existing] = await this.prisma.$queryRaw<
        Array<{ srm_company_id: string | null; srm_code: string; cited: bigint }>
      >`
        SELECT r.srm_company_id, r.srm_code,
               (SELECT count(*) FROM stock.stock_ledger sml WHERE sml.sml_reason_id = r.srm_id) AS cited
          FROM stock.stock_reason_master r
         WHERE r.srm_id = ${dto.srmId}::uuid AND r.srm_is_deleted = false
      `;
      if (!existing) {
        throwStockNotFound<StockErrorDetail, StockErrorResponse>('Stock reason not found', 'srmId', `No stock reason ${dto.srmId}.`);
      }
      if (existing.srm_company_id === null) {
        throwStockConflict<StockErrorDetail, StockErrorResponse>('Shared reasons are read-only', [
          { field: 'srmId', message: `${existing.srm_code} is shared with every company. To change it for this company, create the company's own row with the same code; it then hides the shared one.` },
        ]);
      }
      if (existing.srm_company_id !== dto.companyId) {
        throwStockNotFound<StockErrorDetail, StockErrorResponse>('Stock reason not found', 'srmId', `No stock reason ${dto.srmId} for this company.`);
      }
      if (existing.srm_code !== code && Number(existing.cited) > 0) {
        throwStockConflict<StockErrorDetail, StockErrorResponse>('Code is immutable once used', [
          { field: 'code', message: `${existing.srm_code} is cited by ${Number(existing.cited)} ledger rows; its code cannot change. Deactivate it and create another.` },
        ]);
      }
      await this.assertCodeFree(dto.companyId, code, dto.srmId);
      await this.prisma.$executeRaw`
        UPDATE stock.stock_reason_master
           SET srm_code = ${code}, srm_name = ${dto.name.trim()}, srm_direction = ${dto.direction},
               srm_allowed_txn_types = ${allowed}::text[], srm_require_remarks = ${dto.requireRemarks ?? false},
               srm_gl_ledger_id = ${dto.glLedgerId ?? null}::uuid, srm_sort_order = ${dto.sortOrder ?? 0},
               srm_remarks = ${dto.remarks ?? null}, srm_is_active = ${dto.isActive ?? true},
               srm_modified_on = ${now}, srm_modified_by = ${author}
         WHERE srm_id = ${dto.srmId}::uuid
      `;
      return this.getOne(dto.companyId, dto.srmId);
    }
    await this.assertCodeFree(dto.companyId, code, null);
    const [created] = await this.prisma.$queryRaw<Array<{ srm_id: string }>>`
      INSERT INTO stock.stock_reason_master (
        srm_company_id, srm_code, srm_name, srm_direction, srm_allowed_txn_types, srm_require_remarks,
        srm_gl_ledger_id, srm_sort_order, srm_remarks, srm_is_active, srm_created_on, srm_created_by)
      VALUES (
        ${dto.companyId}::uuid, ${code}, ${dto.name.trim()}, ${dto.direction}, ${allowed}::text[], ${dto.requireRemarks ?? false},
        ${dto.glLedgerId ?? null}::uuid, ${dto.sortOrder ?? 0}, ${dto.remarks ?? null}, ${dto.isActive ?? true}, ${now}, ${author})
      RETURNING srm_id
    `;
    return this.getOne(dto.companyId, created.srm_id);
  }

  /** Delete means deactivate; a reason never cited anywhere is soft-deleted outright. */
  async deactivate(dto: DeactivateStockReasonDto): Promise<StockReasonListRow | { srmId: string; deleted: true }> {
    const actor = resolveActor(dto.userId, this.requestContextService.getUserId());
    const author = actor === DEFAULT_ACTOR ? null : actor;
    const row = await this.getOne(dto.companyId, dto.srmId);
    if (row.isShared) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>('Shared reasons are read-only', [
        { field: 'srmId', message: `${row.code} is shared with every company and cannot be deactivated here. Create the company's own inactive row with the same code to hide it.` },
      ]);
    }
    const now = new Date();
    if (dto.reactivate) {
      await this.prisma.$executeRaw`
        UPDATE stock.stock_reason_master SET srm_is_active = true, srm_modified_on = ${now}, srm_modified_by = ${author}
         WHERE srm_id = ${dto.srmId}::uuid
      `;
      return this.getOne(dto.companyId, dto.srmId);
    }
    if (row.canDelete) {
      await this.prisma.$executeRaw`
        UPDATE stock.stock_reason_master SET srm_is_deleted = true, srm_is_active = false, srm_modified_on = ${now}, srm_modified_by = ${author}
         WHERE srm_id = ${dto.srmId}::uuid
      `;
      return { srmId: dto.srmId, deleted: true };
    }
    await this.prisma.$executeRaw`
      UPDATE stock.stock_reason_master SET srm_is_active = false, srm_modified_on = ${now}, srm_modified_by = ${author}
       WHERE srm_id = ${dto.srmId}::uuid
    `;
    return this.getOne(dto.companyId, dto.srmId);
  }

  private async assertCodeFree(companyId: string, code: string, exceptId: string | null): Promise<void> {
    const [clash] = await this.prisma.$queryRaw<Array<{ srm_id: string }>>`
      SELECT srm_id FROM stock.stock_reason_master
       WHERE srm_company_id = ${companyId}::uuid AND srm_code = ${code} AND srm_is_deleted = false
         AND (${exceptId}::uuid IS NULL OR srm_id <> ${exceptId}::uuid)
    `;
    if (clash) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>('Code already in use', [
        { field: 'code', message: `This company already has a reason coded ${code}.` },
      ]);
    }
  }
}

function toRow(r: RawReason): StockReasonRow {
  return {
    srmId: r.srm_id,
    companyId: r.srm_company_id,
    isShared: r.srm_company_id === null,
    code: r.srm_code,
    name: r.srm_name,
    direction: r.srm_direction,
    allowedTxnTypes: r.srm_allowed_txn_types ?? [],
    requireRemarks: r.srm_require_remarks,
    glLedgerId: r.srm_gl_ledger_id,
    glLedgerName: r.led_name,
    sortOrder: r.srm_sort_order,
    remarks: r.srm_remarks,
    isActive: r.srm_is_active,
  };
}

export type { StockAdjustmentKind, Prisma };
