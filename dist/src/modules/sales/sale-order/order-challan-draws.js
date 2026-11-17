"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.challanDrawsOf = challanDrawsOf;
const client_1 = require("@prisma/client");
async function challanDrawsOf(tx, soAccYear, lines) {
    const out = new Map();
    if (lines.length === 0) {
        return out;
    }
    const lineNoById = new Map(lines.map((l) => [l.soiId, l.soiLineNo]));
    const rows = await tx.$queryRaw `
    SELECT o.soi_id,
           (SELECT SUM(CASE WHEN d.sdi_item_unit_id = o.soi_item_unit_id THEN d.sdi_dc_qty
                            ELSE d.sdi_dc_qty * COALESCE(NULLIF(d.sdi_to_base_factor, 0), 1)
                                 / COALESCE(NULLIF(o.soi_to_base_factor, 0), 1) END)
              FROM sales.sale_dc_item d
              JOIN sales.sale_dc h ON h.sdc_id = d.sdi_dc_id AND h.sdc_acc_year = d.sdi_acc_year
             WHERE d.sdi_src_item_id = o.soi_id AND d.sdi_src_doc_type = 'SALES_ORDER'
               AND d.sdi_is_deleted = false AND h.sdc_is_deleted = false
               AND h.sdc_status = 'POSTED') AS dc_qty,
           (SELECT SUM(CASE WHEN r.sdri_item_unit_id = o.soi_item_unit_id THEN r.sdri_return_qty
                            ELSE r.sdri_return_qty * COALESCE(NULLIF(r.sdri_to_base_factor, 0), 1)
                                 / COALESCE(NULLIF(o.soi_to_base_factor, 0), 1) END)
              FROM sales.sale_dc_return_item r
              JOIN sales.sale_dc_return rh ON rh.sdr_id = r.sdri_return_id AND rh.sdr_acc_year = r.sdri_acc_year
              JOIN sales.sale_dc_item d ON d.sdi_id = r.sdri_dc_item_id AND d.sdi_acc_year = r.sdri_dc_acc_year
             WHERE d.sdi_src_item_id = o.soi_id AND d.sdi_src_doc_type = 'SALES_ORDER'
               AND d.sdi_is_deleted = false AND r.sdri_is_deleted = false
               AND rh.sdr_is_deleted = false AND rh.sdr_status = 'POSTED') AS returned_qty,
           (SELECT SUM(b.sbi_net_amt)
              FROM sales.sale_dc_item d
              JOIN sales.sale_bill_item b ON b.sbi_src_item_id = d.sdi_id
               AND b.sbi_src_doc_type = 'DELIVERY_CHALLAN' AND b.sbi_is_deleted = false
              JOIN sales.sale_bill bh ON bh.sb_id = b.sbi_bill_id AND bh.sb_acc_year = b.sbi_acc_year
             WHERE d.sdi_src_item_id = o.soi_id AND d.sdi_src_doc_type = 'SALES_ORDER'
               AND d.sdi_is_deleted = false AND bh.sb_is_deleted = false
               AND bh.sb_status = 'POSTED') AS dc_billed_amt
      FROM sales.sale_order_item o
     WHERE o.soi_id = ANY(${[...lineNoById.keys()]}::uuid[])
       AND o.soi_acc_year = ${soAccYear}::bpchar`;
    for (const r of rows ?? []) {
        const lineNo = lineNoById.get(r?.soi_id);
        if (lineNo === undefined || r.dc_qty === null || r.dc_qty === undefined) {
            continue;
        }
        out.set(lineNo, {
            qty: new client_1.Prisma.Decimal(r.dc_qty).minus(new client_1.Prisma.Decimal(r.returned_qty ?? 0)),
            billedAmt: new client_1.Prisma.Decimal(r.dc_billed_amt ?? 0),
        });
    }
    return out;
}
//# sourceMappingURL=order-challan-draws.js.map