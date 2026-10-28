import { Controller, Get, Injectable, Query, Version } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { API_VERSION } from 'src/common/constants/api-version';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { purNotFound, purRefuse } from '../common/purchase.errors';
import { D, jsonSafe, type Tx } from '../common/purchase-doc.helpers';

/**
 * DOC-08 (U4) — a sister company's sale bill becomes this company's purchase. One database, several
 * companies: a "sister" is any other company here whose POSTED sale bill was raised on us — the bill's
 * customer GSTIN is ours, or carries our PAN (another state's registration of the same entity).
 * The purchase's supplier is the sister company as a supplier (same GSTIN, else same PAN).
 *  - list: the sister bills raised on us, each with what would stop a pull (`blocked`);
 *  - lines: one bill's lines in the purchase line shape (item, unit, qty, free, rate before tax after
 *    the bill's discounts, tax, MRP, batch, expiry) + the sale line id the purchase line keeps;
 *  - recordSisterPull (called by the invoice save): pi_source_kind SISTER_SALE, pi_sister_company_id,
 *    pii_src_* = the sale line. A bill already pulled into another live purchase is refused
 *    (SISTER_BILL_ALREADY_PULLED); an item not shared with this company is refused (ITEM_NOT_SHARED,
 *    phase 1 = refuse with the list, plan §9).
 *  - assertSaleBillNotPulled (P19): the sale bill side may not be amended / cancelled while pulled.
 */

export const SISTER = {
  ALREADY_PULLED: 'SISTER_BILL_ALREADY_PULLED',
  ITEM_NOT_SHARED: 'ITEM_NOT_SHARED',
  NOT_A_SISTER_BILL: 'SISTER_BILL_INVALID',
  SUPPLIER_MISMATCH: 'SISTER_SUPPLIER_MISMATCH',
  SALE_BILL_PULLED: 'SALE_BILL_PULLED_BY_SISTER',
} as const;

export class SisterBillListQueryDto {
  @ApiProperty() @IsUUID() companyId!: string;
  @ApiProperty() @IsUUID() branchId!: string;
}
export class SisterBillLinesQueryDto extends SisterBillListQueryDto {
  @ApiProperty() @IsUUID() sbId!: string;
  @ApiProperty() @IsString() @MaxLength(9) accYear!: string;
}

type Raw = Record<string, unknown>;
const pan = (gstin: string | null | undefined) => (gstin && gstin.length >= 12 ? gstin.slice(2, 12).toUpperCase() : null);
const day = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null);

async function ourCompany(db: Tx, companyId: string) {
  const [c] = await db.$queryRaw<{ comp_id: string; comp_name: string; comp_gstin_no: string | null }[]>`
    SELECT comp_id, comp_name, comp_gstin_no FROM public.companys WHERE comp_id = ${companyId}::uuid AND NOT comp_is_deleted`;
  if (!c) purNotFound(`Company ${companyId} not found`);
  return c;
}

/** The supplier rows of a sister company: same GSTIN first, else same PAN. */
async function supplierOfSister(db: Tx, companyId: string, sisterGstin: string | null) {
  if (!sisterGstin) return null;
  const [s] = await db.$queryRaw<{ sup_id: string; sup_name: string; sup_gst_no: string | null }[]>`
    SELECT sup_id, sup_name, sup_gst_no FROM purchase.suppliers
     WHERE NOT sup_is_deleted AND sup_is_active AND (sup_company_id IS NULL OR sup_company_id = ${companyId}::uuid)
       AND (upper(sup_gst_no) = upper(${sisterGstin}) OR substr(upper(sup_gst_no), 3, 10) = ${pan(sisterGstin)})
     ORDER BY (upper(sup_gst_no) = upper(${sisterGstin})) DESC, sup_name LIMIT 1`;
  return s ?? null;
}

/** Live purchases (not cancelled) that pulled the sale bill, other than `exceptPiId`. */
async function pullsOf(db: Tx, sbId: string, exceptPiId: string | null) {
  return db.$queryRaw<{ pi_id: string; pi_refno: string; comp_name: string }[]>`
    SELECT DISTINCT pi.pi_id, pi.pi_refno, c.comp_name
      FROM purchase.pur_invoice_item pii
      JOIN purchase.pur_invoice pi ON pi.pi_id = pii.pii_pi_id AND pi.pi_acc_year = pii.pii_acc_year
      JOIN public.companys c ON c.comp_id = pi.pi_company_id
     WHERE pii.pii_src_doc_type = 'SALE_BILL' AND pii.pii_src_doc_id = ${sbId}::uuid AND NOT pii.pii_is_deleted
       AND NOT pi.pi_is_deleted AND pi.pi_status <> 'CANCELLED'
       AND (${exceptPiId}::uuid IS NULL OR pi.pi_id <> ${exceptPiId}::uuid)`;
}

/** Items of the sale lines not visible to this company (item company set and not ours). */
async function unsharedItems(db: Tx, companyId: string, itemIds: string[]) {
  if (!itemIds.length) return [];
  return db.$queryRaw<{ item_id: string; item_name: string }[]>`
    SELECT item_id, item_name_en AS item_name FROM inventory.item_master
     WHERE item_id = ANY(${itemIds}::uuid[]) AND item_company_id IS NOT NULL AND item_company_id <> ${companyId}::uuid`;
}

@Injectable()
export class PurchaseSisterService {
  constructor(private readonly prisma: PrismaService) {}
  private get db(): Tx { return this.prisma as unknown as Tx; }

  async list(q: SisterBillListQueryDto) {
    const us = await ourCompany(this.db, q.companyId);
    const ourPan = pan(us.comp_gstin_no);
    if (!us.comp_gstin_no) return [];
    const bills = await this.prisma.$queryRaw<Raw[]>`
      SELECT sb.sb_id, sb.sb_acc_year, sb.sb_bill_refno, sb.sb_bill_date, sb.sb_bill_amt, sb.sb_tot_items, sb.sb_cust_gstin,
             sb.sb_company_id, c.comp_name, c.comp_gstin_no
        FROM sales.sale_bill sb
        JOIN public.companys c ON c.comp_id = sb.sb_company_id
       WHERE sb.sb_status = 'POSTED' AND NOT sb.sb_is_deleted AND sb.sb_company_id <> ${q.companyId}::uuid
         AND (upper(sb.sb_cust_gstin) = upper(${us.comp_gstin_no}) OR substr(upper(sb.sb_cust_gstin), 3, 10) = ${ourPan})
       ORDER BY sb.sb_bill_date DESC, sb.sb_bill_refno DESC
       LIMIT 200`;
    const out = [];
    for (const b of bills) {
      const pulled = await pullsOf(this.db, String(b.sb_id), null);
      const supplier = await supplierOfSister(this.db, q.companyId, b.comp_gstin_no as string | null);
      const items = await this.prisma.$queryRaw<{ item_id: string }[]>`
        SELECT DISTINCT sbi_item_id AS item_id FROM sales.sale_bill_item
         WHERE sbi_bill_id = ${b.sb_id as string}::uuid AND sbi_acc_year = ${b.sb_acc_year as string}::bpchar AND NOT sbi_is_deleted`;
      const unshared = await unsharedItems(this.db, q.companyId, items.map((i) => i.item_id));
      const blocked = pulled.length ? `Already pulled into ${pulled[0].pi_refno}`
        : !supplier ? `${b.comp_name as string} (${b.comp_gstin_no as string}) is not a supplier here yet`
        : unshared.length ? `Items not shared with this company: ${unshared.map((u) => u.item_name).join(', ')}` : null;
      out.push({
        sbId: b.sb_id, accYear: b.sb_acc_year, refno: b.sb_bill_refno, billDate: day(b.sb_bill_date), amount: b.sb_bill_amt, items: b.sb_tot_items,
        sisterCompanyId: b.sb_company_id, sisterCompanyName: b.comp_name, sisterGstin: b.comp_gstin_no,
        supplierId: supplier?.sup_id ?? null, supplierName: supplier?.sup_name ?? null, blocked,
      });
    }
    return jsonSafe(out);
  }

  async lines(q: SisterBillLinesQueryDto) {
    const all = await this.list(q) as Raw[];
    const b = all.find((x) => x.sbId === q.sbId);
    if (!b) purNotFound(`Sale bill ${q.sbId} is not a sister company's bill raised on this company`);
    const rows = await this.prisma.$queryRaw<Raw[]>`
      SELECT sbi.sbi_id, sbi.sbi_line_no, sbi.sbi_item_id, im.item_name_en AS item_name, sbi.sbi_item_unit_id, u.unit_name,
             sbi.sbi_bill_qty, sbi.sbi_is_free, sbi.sbi_taxable_amt, sbi.sbi_tax_id, sbi.sbi_tax_perc, sbi.sbi_cess_perc, sbi.sbi_max_price,
             sbi.sbi_batch_no, sbi.sbi_expiry_date, sbi.sbi_hsn_code
        FROM sales.sale_bill_item sbi
        JOIN inventory.item_master im ON im.item_id = sbi.sbi_item_id
        LEFT JOIN inventory.item_unit_conversion iuc ON iuc.iuc_id = sbi.sbi_item_unit_id
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = iuc.iuc_unit_id
       WHERE sbi.sbi_bill_id = ${q.sbId}::uuid AND sbi.sbi_acc_year = ${q.accYear}::bpchar AND NOT sbi.sbi_is_deleted
       ORDER BY sbi.sbi_line_no, sbi.sbi_split_no`;
    // a free line on the sale = free qty on the purchase line of the same item
    const lines: Raw[] = [];
    for (const r of rows) {
      const qty = D(r.sbi_bill_qty as Prisma.Decimal);
      if (r.sbi_is_free) {
        const paid = lines.find((l) => l.itemId === r.sbi_item_id && l.uomId === r.sbi_item_unit_id);
        if (paid) { paid.freeQty = D(paid.freeQty as Prisma.Decimal).plus(qty); continue; }
      }
      lines.push({
        sisterSaleItemId: r.sbi_id, sisterSaleItemAccYear: q.accYear, saleLineNo: r.sbi_line_no,
        itemId: r.sbi_item_id, itemName: r.item_name, uomId: r.sbi_item_unit_id, unitName: r.unit_name, hsnCode: r.sbi_hsn_code,
        billedQty: r.sbi_is_free ? D(0) : qty, freeQty: r.sbi_is_free ? qty : D(0),
        rate: r.sbi_is_free || qty.isZero() ? D(0) : D(r.sbi_taxable_amt as Prisma.Decimal).div(qty).toDecimalPlaces(4),
        taxId: r.sbi_tax_id, gstPct: r.sbi_tax_perc, cessPct: r.sbi_cess_perc, mrp: r.sbi_max_price,
        batchNo: r.sbi_batch_no, expiryDate: day(r.sbi_expiry_date),
      });
    }
    return jsonSafe({ bill: b, lines });
  }
}

/**
 * Invoice save hook: lines that carry `sisterSaleItemId` make this a SISTER_SALE purchase. Validates the
 * pull and writes the links; throws (the save rolls back) on any refusal.
 */
export async function recordSisterPull(
  tx: Tx,
  a: { companyId: string; supplierId: string; piId: string; accYear: string },
  lines: { lineNo: number; itemId: string; sisterSaleItemId?: string; sisterSaleItemAccYear?: string }[],
) {
  const named = lines.filter((l) => l.sisterSaleItemId);
  if (!named.length) return;
  const sale = await tx.$queryRaw<{ sbi_id: string; sbi_line_no: number; sbi_item_id: string; sb_id: string; sb_acc_year: string; sb_bill_refno: string;
                                    sb_company_id: string; sb_status: string; sb_cust_gstin: string | null; comp_gstin_no: string | null }[]>`
    SELECT sbi.sbi_id, sbi.sbi_line_no, sbi.sbi_item_id, sb.sb_id, sb.sb_acc_year, sb.sb_bill_refno, sb.sb_company_id, sb.sb_status, sb.sb_cust_gstin, c.comp_gstin_no
      FROM sales.sale_bill_item sbi
      JOIN sales.sale_bill sb ON sb.sb_id = sbi.sbi_bill_id AND sb.sb_acc_year = sbi.sbi_acc_year
      JOIN public.companys c ON c.comp_id = sb.sb_company_id
     WHERE sbi.sbi_id = ANY(${named.map((l) => l.sisterSaleItemId!)}::uuid[]) AND NOT sbi.sbi_is_deleted`;
  const bySbi = new Map(sale.map((s) => [s.sbi_id, s]));
  const bills = new Set(sale.map((s) => s.sb_id));
  if (bills.size !== 1 || sale.length !== new Set(named.map((l) => l.sisterSaleItemId)).size)
    purRefuse('A purchase pulls the lines of ONE sister sale bill, and every line must be found on it.', SISTER.NOT_A_SISTER_BILL, 'lines.sisterSaleItemId');
  const sb = sale[0];
  const us = await ourCompany(tx, a.companyId);
  if (sb.sb_status !== 'POSTED' || sb.sb_company_id === a.companyId
      || !(sb.sb_cust_gstin && us.comp_gstin_no && (sb.sb_cust_gstin.toUpperCase() === us.comp_gstin_no.toUpperCase() || pan(sb.sb_cust_gstin) === pan(us.comp_gstin_no))))
    purRefuse(`${sb.sb_bill_refno} is not a posted sister company sale bill raised on this company.`, SISTER.NOT_A_SISTER_BILL, 'lines.sisterSaleItemId');
  const pulled = await pullsOf(tx, sb.sb_id, a.piId);
  if (pulled.length) purRefuse(`${sb.sb_bill_refno} is already in purchase ${pulled[0].pi_refno} (${pulled[0].comp_name}).`, SISTER.ALREADY_PULLED, 'lines.sisterSaleItemId', 409);
  const supplier = await supplierOfSister(tx, a.companyId, sb.comp_gstin_no);
  if (!supplier || supplier.sup_id !== a.supplierId)
    purRefuse(`The supplier must be the sister company as a supplier (GSTIN ${sb.comp_gstin_no ?? '—'}).`, SISTER.SUPPLIER_MISMATCH, 'header.supplierId');
  const unshared = await unsharedItems(tx, a.companyId, [...new Set(named.map((l) => l.itemId))]);
  if (unshared.length) purRefuse(`Items not shared with this company: ${unshared.map((u) => u.item_name).join(', ')}.`, SISTER.ITEM_NOT_SHARED, 'lines.itemId');
  for (const l of named) {
    const s = bySbi.get(l.sisterSaleItemId!)!;
    if (s.sbi_item_id !== l.itemId) purRefuse(`Line ${l.lineNo}: the item is not the sale line's.`, SISTER.NOT_A_SISTER_BILL, `lines.${l.lineNo - 1}.itemId`);
    await tx.$executeRaw`
      UPDATE purchase.pur_invoice_item
         SET pii_src_doc_type = 'SALE_BILL', pii_src_doc_id = ${s.sb_id}::uuid, pii_src_doc_year = ${s.sb_acc_year}::bpchar,
             pii_src_item_id = ${s.sbi_id}::uuid, pii_src_doc_line_no = ${s.sbi_line_no}, pii_src_doc_refno = ${s.sb_bill_refno}
       WHERE pii_pi_id = ${a.piId}::uuid AND pii_acc_year = ${a.accYear}::bpchar AND pii_line_no = ${l.lineNo} AND NOT pii_is_deleted`;
  }
  await tx.$executeRaw`
    UPDATE purchase.pur_invoice SET pi_source_kind = 'SISTER_SALE', pi_sister_company_id = ${sb.sb_company_id}::uuid
     WHERE pi_id = ${a.piId}::uuid AND pi_acc_year = ${a.accYear}::bpchar`;
}

/** P19: a sale bill pulled into a live sister purchase may not be amended or cancelled. */
export async function assertSaleBillNotPulled(db: Tx, sbId: string) {
  const pulled = await pullsOf(db, sbId, null);
  if (pulled.length)
    purRefuse(`This bill is in ${pulled[0].comp_name}'s purchase ${pulled[0].pi_refno} — cancel that purchase first.`, SISTER.SALE_BILL_PULLED, 'sbId', 409);
}

@ApiTags('Purchase — Sister company bills')
@ApiBearerAuth()
@Controller('purchase/sister-bills')
export class PurchaseSisterController {
  constructor(private readonly service: PurchaseSisterService) {}

  @Get() @Version(API_VERSION)
  @ApiOperation({ summary: 'DOC-08: posted sale bills of sister companies raised on this company, with what would stop a pull.' })
  async list(@Query() q: SisterBillListQueryDto) {
    return { success: true, message: 'Sister company bills', data: await this.service.list(q) };
  }

  @Get('lines') @Version(API_VERSION)
  @ApiOperation({ summary: 'DOC-08: one sister sale bill in the purchase line shape (the line keeps sisterSaleItemId).' })
  async lines(@Query() q: SisterBillLinesQueryDto) {
    return { success: true, message: 'Sister bill lines', data: await this.service.lines(q) };
  }
}
