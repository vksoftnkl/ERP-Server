import { Injectable } from '@nestjs/common';
import { PrintDataProvider, PrintDataProviderField, PrintRow } from '../print-data-provider.types';

/**
 * `stickers.label` — the ONE field list every label design reads (sticker
 * printing S-P1, plan §4.2, STK-08).
 *
 * A label design's body is one REPORT_HEADER band reading the MASTER dataset
 * `label` (decision 23); the label path (PrintRenderService.renderLabels) lays
 * it out once per sticker line with `label` = that line's row. The real rows
 * come from the sticker job's line builder (src/modules/Inventory/stickers),
 * which writes exactly the keys below. Run outside a job — the designer's
 * Preview, a plain render — the provider answers with SAMPLE rows built here
 * in code (a sugar, a rice and an oil line), so a design can be looked at
 * before any item is chosen.
 *
 * A field with no value prints blank (null). Money is a number with 2 dp,
 * `packed_on` / `use_by` are ISO `YYYY-MM-DD` (for the `date` transform),
 * `printed_on` is display text dd/MM/yyyy hh:mm AM.
 */

export const STICKER_LABEL_PROVIDER_CODE = 'stickers.label';

/** The label dataset's name in a label design (plan §4.1). */
export const STICKER_LABEL_DATASET_NAME = 'label';

export const STICKER_LABEL_FIELDS: readonly PrintDataProviderField[] = [
  { name: 'item_name', group: 'Item', label: 'Item name' },
  { name: 'item_name_ta', group: 'Item', label: 'Item name (Tamil)' },
  { name: 'item_code', group: 'Item', label: 'Item code' },
  { name: 'brand', group: 'Item', label: 'Brand' },
  { name: 'group_name', group: 'Item', label: 'Item group' },
  { name: 'size', group: 'Item', label: 'Size' },
  { name: 'colour', group: 'Item', label: 'Colour' },
  { name: 'model', group: 'Item', label: 'Model' },
  { name: 'unit', group: 'Unit', label: 'Unit' },
  { name: 'barcode', group: 'Unit', label: 'Barcode' },
  { name: 'net_qty', group: 'Unit', label: 'Net qty' },
  { name: 'mrp', group: 'Prices', label: 'MRP' },
  { name: 'price', group: 'Prices', label: 'Our price' },
  { name: 'price_level', group: 'Prices', label: 'Price level' },
  { name: 'saving', group: 'Prices', label: 'Saving (MRP - Our price)' },
  { name: 'unit_price', group: 'Prices', label: 'Unit sale price' },
  { name: 'cost_code', group: 'Prices', label: 'Cost code' },
  { name: 'price_code', group: 'Prices', label: 'Price code' },
  { name: 'batch', group: 'Lot', label: 'Batch' },
  { name: 'packed_on', group: 'Lot', label: 'Packed on' },
  { name: 'use_by', group: 'Lot', label: 'Use by' },
  { name: 'packer_name', group: 'Packer / food', label: 'Packer name' },
  { name: 'packer_address', group: 'Packer / food', label: 'Packer address' },
  { name: 'fssai_no', group: 'Packer / food', label: 'FSSAI no' },
  { name: 'care_phone', group: 'Packer / food', label: 'Customer care phone' },
  { name: 'care_email', group: 'Packer / food', label: 'Customer care email' },
  { name: 'food_mark', group: 'Packer / food', label: 'Food mark (veg / non-veg)' },
  { name: 'label_note', group: 'Packer / food', label: 'Label note' },
  { name: 'branch', group: 'Packer / food', label: 'Branch' },
  { name: 'company', group: 'Packer / food', label: 'Company' },
  { name: 'printed_on', group: 'Print', label: 'Printed on' },
  { name: 'copy_no', group: 'Print', label: 'Copy no' },
  { name: 'copy_count', group: 'Print', label: 'Copies' },
  { name: 'job_no', group: 'Print', label: 'Job no' },
  { name: 'doc_no', group: 'Print', label: 'Document no' },
  { name: 'supplier_code', group: 'Print', label: 'Supplier code' },
];

/** Every field, blank. A row starts from this so no key is ever missing. */
export function blankLabelRow(): PrintRow {
  return Object.fromEntries(STICKER_LABEL_FIELDS.map((field) => [field.name, null]));
}

const SAMPLE_PACKER = {
  packer_name: 'SAMPLE TRADERS PVT LTD',
  packer_address: '12, Market Road, Coimbatore 641001',
  fssai_no: '12345678901234',
  care_phone: '0422 1234567',
  care_email: 'care@example.com',
  branch: 'SAMPLE',
  company: 'SAMPLE TRADERS',
  printed_on: '25/11/2026 10:30 AM',
  job_no: 'D1-000001',
};

/**
 * The three SAMPLE rows (plan §4.4): fixed values, no database. Two labels
 * each in the designer's Preview. They fill the S-P3 pack fields too (net
 * qty, unit sale price, food mark, label note) so a pack design can be seen
 * whole; a real sticker job leaves those blank until the kit's Made from tab.
 */
export function stickerSampleRows(): PrintRow[] {
  const base = { ...blankLabelRow(), ...SAMPLE_PACKER };
  return [
    {
      ...base,
      item_name: 'SAMPLE Sugar 1 kg',
      item_name_ta: 'சர்க்கரை 1 கிலோ',
      item_code: 'S0001',
      brand: 'Sample',
      group_name: 'Grocery',
      unit: 'PKT',
      barcode: '8901234567890',
      mrp: 52,
      price: 48,
      price_level: 'RET',
      saving: 4,
      cost_code: 'KH',
      price_code: 'KS',
      batch: 'B2611',
      packed_on: '2026-11-01',
      use_by: '2027-04-30',
      net_qty: '1 kg',
      unit_price: '0.05 per g',
      food_mark: 'VEG',
      label_note: 'Store in a cool, dry place.',
    },
    {
      ...base,
      item_name: 'SAMPLE Ponni Rice 5 kg',
      item_name_ta: 'பொன்னி அரிசி 5 கிலோ',
      item_code: 'S0002',
      brand: 'Sample',
      group_name: 'Grocery',
      unit: 'BAG',
      barcode: 'R000123',
      mrp: 365,
      price: 340,
      price_level: 'RET',
      saving: 25,
      cost_code: 'CAB',
      price_code: 'CKB',
      batch: 'R2611',
      packed_on: '2026-11-10',
      use_by: '2027-11-09',
      net_qty: '5 kg',
      unit_price: '68.00 per kg',
      food_mark: 'VEG',
      label_note: 'Store in a cool, dry place.',
    },
    {
      ...base,
      item_name: 'SAMPLE Groundnut Oil 1 litre',
      item_name_ta: 'கடலை எண்ணெய் 1 லிட்டர்',
      item_code: 'S0003',
      brand: 'Sample',
      group_name: 'Oil',
      unit: 'LTR',
      barcode: '4006381333931',
      mrp: 210,
      price: 196.5,
      price_level: 'RET',
      saving: 13.5,
      cost_code: 'LSH',
      price_code: 'LER',
      batch: 'O2611',
      packed_on: '2026-11-15',
      use_by: '2027-05-14',
      net_qty: '1 litre',
      unit_price: '0.20 per ml',
      food_mark: 'VEG',
      label_note: 'Keep away from direct sunlight.',
    },
  ];
}

@Injectable()
export class StickerLabelProvider implements PrintDataProvider {
  readonly code = STICKER_LABEL_PROVIDER_CODE;

  readonly label = 'Sticker label (one label line)';

  readonly cardinality = 'one' as const;

  readonly fields = STICKER_LABEL_FIELDS;

  /**
   * Outside a sticker job there is no line, so the first SAMPLE row stands in.
   * The label path never calls this: it binds each job line itself.
   */
  resolve(): Promise<PrintRow> {
    return Promise.resolve(stickerSampleRows()[0]);
  }
}
