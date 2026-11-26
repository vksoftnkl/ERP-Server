import { Prisma } from '@prisma/client';
import { blankLabelRow } from '../../settings/print-render/data/providers/sticker-label.provider';
import { istDateTimeText, money, savingOf } from './sticker.rules';

/**
 * One sticker line as the `label` dataset row a label design reads (plan
 * §4.2). Pure: the job service hands it what the line builder resolved (a new
 * job) or what the job froze (a reprint / resend), plus the shop and the job.
 *
 * The keys are exactly STICKER_LABEL_FIELDS (print-render's stickers.label
 * provider, which the designer's Data panel lists): a key with no value is
 * null and prints blank. The S-P3 fields (net_qty, unit_price, food_mark,
 * label_note) and the S-P2 ones (doc_no, supplier_code) stay blank in S-P1.
 */

export interface LabelShop {
  companyName: string | null;
  legalName: string | null;
  companyFssai: string | null;
  carePhone: string | null;
  careEmail: string | null;
  branchName: string | null;
  branchShort: string | null;
  branchAddress: string | null;
  branchFssai: string | null;
}

export interface LabelRowInput {
  itemName: string | null;
  itemNameTa: string | null;
  itemCode: string | null;
  brand: string | null;
  groupName: string | null;
  size: string | null;
  colour: string | null;
  model: string | null;
  unitName: string | null;
  barcode: string | null;
  mrp: Prisma.Decimal | null;
  price: Prisma.Decimal | null;
  /** The level's short name (RET). */
  priceLevel: string | null;
  costCode: string | null;
  priceCode: string | null;
  batchNo: string | null;
  /** 'YYYY-MM-DD'. */
  mfgDate: string | null;
  expiryDate: string | null;
}

export function labelRow(
  line: LabelRowInput,
  shop: LabelShop,
  job: { jobNo: string | null; printedOn: Date | null },
): Record<string, unknown> {
  return {
    ...blankLabelRow(),
    item_name: line.itemName,
    item_name_ta: line.itemNameTa,
    item_code: line.itemCode,
    brand: line.brand,
    group_name: line.groupName,
    size: line.size,
    colour: line.colour,
    model: line.model,
    unit: line.unitName,
    barcode: line.barcode,
    mrp: money(line.mrp),
    price: money(line.price),
    price_level: line.priceLevel,
    saving: money(savingOf(line.mrp, line.price)),
    cost_code: line.costCode,
    price_code: line.priceCode,
    batch: line.batchNo,
    packed_on: line.mfgDate,
    use_by: line.expiryDate,
    packer_name: shop.legalName ?? shop.companyName,
    packer_address: shop.branchAddress,
    fssai_no: shop.branchFssai ?? shop.companyFssai,
    care_phone: shop.carePhone,
    care_email: shop.careEmail,
    branch: shop.branchShort ?? shop.branchName,
    company: shop.companyName,
    printed_on: istDateTimeText(job.printedOn),
    job_no: job.jobNo,
  };
}
