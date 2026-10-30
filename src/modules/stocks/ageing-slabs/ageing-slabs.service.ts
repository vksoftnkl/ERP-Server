import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  resolveActor,
  throwStockUnprocessable,
} from 'src/common/utils/module-service.utils';
import type { StockErrorDetail, StockErrorResponse } from '../stock-voucher/types/stock-voucher.types';
import { StockErrorCode } from '../types/stock-error-codes';
import type { AgeingSlabDto, SaveAgeingSlabsDto } from './dto/ageing-slabs.dto';

export const AGEING_SLAB_MAX = 20;

export interface AgeingSlab {
  slabNo: number;
  label: string;
  fromDays: number;
  toDays: number | null;
}

export interface AgeingSlabLadder {
  /** true = the company has rows of its own; false = the shared default (company NULL) applies. */
  usingOwn: boolean;
  slabs: AgeingSlab[];
}

/**
 * The ladder rules (notes 159 §3), one 422 detail per offending field. Pure,
 * so the unit spec can walk every rule without a database.
 *
 * The database holds only part of this: ex_sag_overlap stops two slabs
 * claiming one day, ck_sag_days a negative or inverted range. Nothing there
 * stops a GAP (31-60 then 71-90) or a ladder with no open end — the oldest
 * stock would fall out of every bucket and the report stop summing to the
 * balance — so the save refuses both here.
 */
export function ladderErrors(slabs: readonly AgeingSlabDto[]): StockErrorDetail[] {
  const errors: StockErrorDetail[] = [];
  if (slabs.length < 1 || slabs.length > AGEING_SLAB_MAX) {
    errors.push({
      field: 'slabs',
      code: StockErrorCode.AGEING_SLAB_COUNT,
      message: `A ladder has 1 to ${AGEING_SLAB_MAX} slabs; this one has ${slabs.length}.`,
    });
    return errors;
  }

  const labels = new Map<string, number>();
  slabs.forEach((slab, i) => {
    const at = `slabs.${i}`;
    if (slab.slabNo !== i + 1) {
      errors.push({
        field: `${at}.slabNo`,
        code: StockErrorCode.AGEING_SLAB_NUMBER,
        message: `Slab ${i + 1} is numbered ${slab.slabNo}; slabs are numbered 1 to ${slabs.length} in order.`,
      });
    }

    const label = slab.label.trim();
    if (!label) {
      errors.push({ field: `${at}.label`, code: StockErrorCode.AGEING_SLAB_LABEL, message: `Slab ${i + 1} needs a label.` });
    } else {
      const folded = label.toUpperCase();
      const first = labels.get(folded);
      if (first !== undefined) {
        errors.push({
          field: `${at}.label`,
          code: StockErrorCode.AGEING_SLAB_LABEL,
          message: `Slab ${i + 1}'s label "${label}" is slab ${first + 1}'s too; labels are unique.`,
        });
      } else {
        labels.set(folded, i);
      }
    }

    if (i === 0) {
      if (slab.fromDays !== 0) {
        errors.push({
          field: `${at}.fromDays`,
          code: StockErrorCode.AGEING_SLAB_FIRST_NOT_ZERO,
          message: `The first slab starts at day 0, not ${slab.fromDays}: stock received today is 0 days old.`,
        });
      }
    } else {
      const prevTo = slabs[i - 1].toDays;
      // An open-ended slab before this one is reported on ITS toDays below;
      // there is no "day after" to compare with.
      if (prevTo !== null && prevTo !== undefined && slab.fromDays !== prevTo + 1) {
        const gap = slab.fromDays > prevTo + 1;
        errors.push({
          field: `${at}.fromDays`,
          code: StockErrorCode.AGEING_SLAB_NOT_CONTIGUOUS,
          message: gap
            ? `Slab ${i + 1} starts at day ${slab.fromDays}, leaving days ${prevTo + 1}–${slab.fromDays - 1} in no slab; it starts at ${prevTo + 1}, the day after slab ${i} ends.`
            : `Slab ${i + 1} starts at day ${slab.fromDays}, inside slab ${i} (which ends at ${prevTo}); it starts at ${prevTo + 1}.`,
        });
      }
    }

    const last = i === slabs.length - 1;
    const toDays = slab.toDays ?? null;
    if (toDays === null) {
      if (!last) {
        errors.push({
          field: `${at}.toDays`,
          code: StockErrorCode.AGEING_SLAB_OPEN_END,
          message: `Slab ${i + 1} is open-ended but is not the last; only the last slab has no end day.`,
        });
      }
    } else if (last) {
      errors.push({
        field: `${at}.toDays`,
        code: StockErrorCode.AGEING_SLAB_OPEN_END,
        message: `The last slab ends at day ${toDays}; it must be open-ended (no end day), or stock older than ${toDays} days falls in no slab.`,
      });
    } else if (toDays < slab.fromDays) {
      errors.push({
        field: `${at}.toDays`,
        code: StockErrorCode.AGEING_SLAB_TO_BEFORE_FROM,
        message: `Slab ${i + 1} ends at day ${toDays}, before it starts (day ${slab.fromDays}).`,
      });
    }
  });
  return errors;
}

/**
 * `stock.stock_ageing_slab` (notes 159 §3): one ladder per company, saved
 * whole. The fallback is ALL OR NOTHING — a company's own rows if it has any,
 * else the shared default — never a mixture: two merged ladders would put one
 * holding in two buckets.
 *
 * Save and revert soft-delete (`sag_is_deleted`) rather than DELETE, so the
 * cloud sync (`sag_sync_date`) sees the old rows go. ex_sag_overlap and
 * ux_sag_slab_no both ignore deleted rows.
 */
@Injectable()
export class AgeingSlabsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async get(companyId: string): Promise<AgeingSlabLadder> {
    const rows = await this.prisma.$queryRaw<
      Array<{ own: boolean; sag_slab_no: number; sag_label: string; sag_from_days: number; sag_to_days: number | null }>
    >`
      WITH own AS (
        SELECT 1 FROM stock.stock_ageing_slab
         WHERE sag_company_id = ${companyId}::uuid AND sag_is_active AND NOT sag_is_deleted
         LIMIT 1
      )
      SELECT (s.sag_company_id IS NOT NULL) AS own, s.sag_slab_no, s.sag_label, s.sag_from_days, s.sag_to_days
        FROM stock.stock_ageing_slab s
       WHERE s.sag_is_active AND NOT s.sag_is_deleted
         AND CASE WHEN EXISTS (SELECT 1 FROM own)
                  THEN s.sag_company_id = ${companyId}::uuid
                  ELSE s.sag_company_id IS NULL END
       ORDER BY s.sag_slab_no
    `;
    return {
      usingOwn: rows.length > 0 && rows[0].own,
      slabs: rows.map((r) => ({
        slabNo: r.sag_slab_no,
        label: r.sag_label,
        fromDays: r.sag_from_days,
        toDays: r.sag_to_days,
      })),
    };
  }

  /** Replace every company row with the ladder sent, in one transaction. */
  async save(dto: SaveAgeingSlabsDto): Promise<AgeingSlabLadder> {
    const errors = ladderErrors(dto.slabs);
    if (errors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Ageing slabs cannot be saved', errors);
    }
    const author = this.author();
    const now = new Date();
    const slabs = dto.slabs.map((s) => ({ ...s, label: s.label.trim(), toDays: s.toDays ?? null }));
    await this.prisma.$transaction(async (tx) => {
      // Two saves at once would each retire the old rows and then collide on
      // ux_sag_slab_no with the other's new ones.
      await tx.$queryRaw`
        SELECT count(pg_advisory_xact_lock(hashtext('stock.stock_ageing_slab'), hashtext(${dto.companyId})))::int AS locked
      `;
      // The new rows never meet the old ones (retired first, and the
      // constraint skips deleted rows), but the note asks for it and it keeps
      // the save safe should it ever update rows in place.
      await tx.$executeRaw`SET CONSTRAINTS stock.ex_sag_overlap DEFERRED`;
      await tx.$executeRaw`
        UPDATE stock.stock_ageing_slab
           SET sag_is_deleted = true, sag_is_active = false, sag_modified_on = ${now}, sag_modified_by = ${author}
         WHERE sag_company_id = ${dto.companyId}::uuid AND NOT sag_is_deleted
      `;
      await tx.stockAgeingSlab.createMany({
        data: slabs.map((s) => ({
          sagCompanyId: dto.companyId,
          sagSlabNo: s.slabNo,
          sagLabel: s.label,
          sagFromDays: s.fromDays,
          sagToDays: s.toDays,
          sagCreatedOn: now,
          sagCreatedBy: author,
        })),
      });
    });
    return this.get(dto.companyId);
  }

  /** Retire the company's rows: the shared default applies again. A company with none is a no-op. */
  async revert(companyId: string): Promise<AgeingSlabLadder> {
    const author = this.author();
    await this.prisma.$executeRaw`
      UPDATE stock.stock_ageing_slab
         SET sag_is_deleted = true, sag_is_active = false, sag_modified_on = ${new Date()}, sag_modified_by = ${author}
       WHERE sag_company_id = ${companyId}::uuid AND NOT sag_is_deleted
    `;
    return this.get(companyId);
  }

  private author(): string | null {
    const actor = resolveActor(null, this.requestContextService.getUserId());
    return actor === DEFAULT_ACTOR ? null : actor;
  }
}
