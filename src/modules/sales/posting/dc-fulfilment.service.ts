import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';

/**
 * The delivery challan's fulfilment caches — `sdi_billed_qty`,
 * `sdi_returned_qty`, `sdi_line_status`, and the header's `sdc_billed_amt` /
 * `sdc_returned_amt` / `sdc_fulfil_status`.
 *
 * RE-DERIVED, never incremented. A bill that posts, cancels or amends, and a
 * DC return that posts or cancels, each name the challans they touched and
 * this recomputes those challans from what ALL the live documents say. An
 * increment would drift the first time one of them rolled back halfway.
 *
 * `sdi_open_qty` is GENERATED (dc − billed − returned) and is never written.
 */
@Injectable()
export class DcFulfilmentService {
  constructor(private readonly prisma: PrismaService) {}

  /** Challan ids referenced by a bill's lines (`sbi_src_doc_type = DELIVERY_CHALLAN`). */
  async dcRefsOfBill(
    tx: Prisma.TransactionClient,
    sbId: string,
    sbAccYear: string,
  ): Promise<{ dcId: string; accYear: string }[]> {
    const rows = await tx.$queryRaw<{ sdi_dc_id: string; sdi_acc_year: string }[]>`
      SELECT DISTINCT d.sdi_dc_id, d.sdi_acc_year
        FROM sales.sale_bill_item b
        JOIN sales.sale_dc_item d ON d.sdi_id = b.sbi_src_item_id
       WHERE b.sbi_bill_id = ${sbId}::uuid AND b.sbi_acc_year = ${sbAccYear}::char(9)
         AND b.sbi_src_doc_type = 'DELIVERY_CHALLAN' AND b.sbi_src_item_id IS NOT NULL`;
    return rows.map((r) => ({ dcId: r.sdi_dc_id, accYear: r.sdi_acc_year.trim() }));
  }

  async recompute(
    tx: Prisma.TransactionClient,
    refs: readonly { dcId: string; accYear: string }[],
    actor: string,
    now: Date,
  ): Promise<void> {
    const seen = new Set<string>();
    for (const ref of refs) {
      const key = `${ref.dcId}|${ref.accYear}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      await this.recomputeOne(tx, ref.dcId, ref.accYear, actor, now);
    }
  }

  private async recomputeOne(
    tx: Prisma.TransactionClient,
    dcId: string,
    accYear: string,
    actor: string,
    now: Date,
  ): Promise<void> {
    await tx.$executeRaw`
      UPDATE sales.sale_dc_item d
         SET sdi_billed_qty = COALESCE((
               SELECT SUM(b.sbi_bill_qty)
                 FROM sales.sale_bill_item b
                 JOIN sales.sale_bill h ON h.sb_id = b.sbi_bill_id AND h.sb_acc_year = b.sbi_acc_year
                WHERE b.sbi_src_item_id = d.sdi_id AND b.sbi_src_doc_type = 'DELIVERY_CHALLAN'
                  AND b.sbi_is_deleted = false AND h.sb_is_deleted = false AND h.sb_status = 'POSTED'), 0),
             sdi_returned_qty = COALESCE((
               SELECT SUM(r.sdri_return_qty)
                 FROM sales.sale_dc_return_item r
                 JOIN sales.sale_dc_return rh ON rh.sdr_id = r.sdri_return_id AND rh.sdr_acc_year = r.sdri_acc_year
                WHERE r.sdri_dc_item_id = d.sdi_id
                  AND r.sdri_is_deleted = false AND rh.sdr_is_deleted = false AND rh.sdr_status = 'POSTED'), 0),
             sdi_modified_on = ${now},
             sdi_modified_by = ${actor}
       WHERE d.sdi_dc_id = ${dcId}::uuid AND d.sdi_acc_year = ${accYear}::char(9)
         AND d.sdi_is_deleted = false`;

    await tx.$executeRaw`
      UPDATE sales.sale_dc_item d
         SET sdi_line_status = CASE
               WHEN d.sdi_billed_qty <= 0 AND d.sdi_returned_qty <= 0 THEN 'OPEN'
               WHEN d.sdi_dc_qty - d.sdi_billed_qty - d.sdi_returned_qty > 0 THEN 'PARTIAL'
               WHEN d.sdi_billed_qty > 0 AND d.sdi_returned_qty <= 0 THEN 'BILLED'
               WHEN d.sdi_returned_qty > 0 AND d.sdi_billed_qty <= 0 THEN 'RETURNED'
               ELSE 'CLOSED' END
       WHERE d.sdi_dc_id = ${dcId}::uuid AND d.sdi_acc_year = ${accYear}::char(9)
         AND d.sdi_is_deleted = false`;

    await tx.$executeRaw`
      UPDATE sales.sale_dc h
         SET sdc_billed_amt = COALESCE((
               SELECT SUM(ROUND(d.sdi_billed_qty * COALESCE(d.sdi_rate, 0), 2))
                 FROM sales.sale_dc_item d
                WHERE d.sdi_dc_id = h.sdc_id AND d.sdi_acc_year = h.sdc_acc_year AND d.sdi_is_deleted = false), 0),
             sdc_returned_amt = COALESCE((
               SELECT SUM(ROUND(d.sdi_returned_qty * COALESCE(d.sdi_rate, 0), 2))
                 FROM sales.sale_dc_item d
                WHERE d.sdi_dc_id = h.sdc_id AND d.sdi_acc_year = h.sdc_acc_year AND d.sdi_is_deleted = false), 0),
             sdc_fulfil_status = (
               SELECT CASE
                        WHEN COUNT(*) = 0 THEN 'OPEN'
                        WHEN bool_and(d.sdi_line_status = 'OPEN') THEN 'OPEN'
                        -- Every line disposed of. BILLED / RETURNED only when
                        -- that is the ONLY way any line went; a line that was
                        -- part billed and part returned is CLOSED, and so is
                        -- a challan made of them.
                        WHEN bool_and(d.sdi_line_status IN ('BILLED', 'CLOSED'))
                             AND bool_or(d.sdi_line_status = 'BILLED') THEN 'BILLED'
                        WHEN bool_and(d.sdi_line_status IN ('RETURNED', 'CLOSED'))
                             AND bool_or(d.sdi_line_status = 'RETURNED') THEN 'RETURNED'
                        WHEN bool_and(d.sdi_line_status <> 'OPEN' AND d.sdi_line_status <> 'PARTIAL') THEN 'CLOSED'
                        ELSE 'PARTIAL' END
                 FROM sales.sale_dc_item d
                WHERE d.sdi_dc_id = h.sdc_id AND d.sdi_acc_year = h.sdc_acc_year AND d.sdi_is_deleted = false),
             sdc_modified_on = ${now},
             sdc_modified_by = ${actor}
       WHERE h.sdc_id = ${dcId}::uuid AND h.sdc_acc_year = ${accYear}::char(9)`;
  }
}
