import { Test, TestingModule } from '@nestjs/testing';
import { ItemPriceDetailsController } from './item-price-details.controller';
import { ItemPriceDetailsService } from './item-price-details.service';

const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const ITEM_PRICE_ID = '019c6f6c-be87-7a11-8905-36092c46fd05';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fd10';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fd11';
const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46fd14';

const itemPriceDetailPayload = {
  item: {
    item_id: ITEM_ID,
    item_company_id: ITEM_ID,
    item_branch_id: null,
    item_code: 'ITEM-001',
    item_sku: 'SKU-001',
    item_name_en: 'Sample Item',
    item_name_ta: null,
    item_alias: null,
    item_stock_type: 'FG',
    item_default_barcode: null,
    item_group_id: ITEM_ID,
    item_category_id: null,
    item_brand_id: null,
    item_section_id: null,
    item_company_category_id: null,
    item_mfgr_id: null,
    item_supplier_id: null,
    item_cust_group: null,
    item_base_unit_id: UNIT_ID,
    item_is_service: false,
    item_is_batch_based: false,
    item_is_expiry_item: false,
    item_expiry_days: null,
    item_intimate_before_days: null,
    item_allow_sales: true,
    item_allow_sales_return: true,
    item_allow_purchase: true,
    item_allow_po: true,
    item_allow_so: true,
    item_allow_neg_stock: true,
    item_allow_negative_so: true,
    item_price_list: false,
    item_weigh_scale: false,
    item_retail_item: true,
    item_is_kit: false,
    item_auto_break: false,
    item_auto_make: false,
    item_allow_loyalty: false,
    item_allow_promo: false,
    item_has_offer: false,
    item_damagable_product: false,
    item_is_demand: false,
    item_allow_loading: false,
    item_allow_freight: false,
    item_random_stock: false,
    item_barcode_sticker: false,
    item_barcode_sticker_id: null,
    item_default_tax_id: TAX_ID,
    item_hsn_code: null,
    item_batch_config: 0,
    item_sort_order: null,
    item_photo: null,
    item_image_url: null,
    item_notes: null,
    item_storage_location: null,
    item_packing_item_ids: [],
    item_incl_tax: true,
    item_is_active: true,
    item_is_deleted: false,
    item_created_on: '2026-02-20T10:00:00.000Z',
    item_created_by: USER_ID,
    item_modified_on: '2026-02-20T10:00:00.000Z',
    item_modified_by: USER_ID,
  },
  item_prices: [
    {
      ipm_id: ITEM_PRICE_ID,
      ipm_company_id: null,
      ipm_branch_id: null,
      ipm_item_id: ITEM_ID,
      ipm_uc_unit_id: UNIT_ID,
      ipm_godown_id: GODOWN_ID,
      ipm_cost_price: 0,
      ipm_cost_wot: 0,
      ipm_sales_price_a: 0,
      ipm_sales_price_b: 0,
      ipm_sales_price_c: 0,
      ipm_sales_price_d: 0,
      ipm_price_a_wot: 0,
      ipm_price_b_wot: 0,
      ipm_price_c_wot: 0,
      ipm_price_d_wot: 0,
      ipm_price_a_markup_perc: 0,
      ipm_price_b_markup_perc: 0,
      ipm_price_c_markup_perc: 0,
      ipm_price_d_markup_perc: 0,
      ipm_max_price: 0,
      ipm_min_price: 0,
      ipm_disc_perc: 0,
      ipm_disc_qty: 0,
      ipm_addl_cess: 0,
      ipm_profit_type: 'MANUAL',
      ipm_round_off: 0,
      ipm_loading_charge: 0,
      ipm_freight_charge: 0,
      ipm_loyalty_points: 0,
      ipm_uom_remarks: null,
      ipm_cost_remarks: null,
      ipm_is_active: true,
      ipm_is_deleted: false,
      ipm_sync_date: null,
      ipm_created_on: '2026-02-20T10:00:00.000Z',
      ipm_created_by: USER_ID,
      ipm_updated_on: '2026-02-20T10:00:00.000Z',
      ipm_updated_by: USER_ID,
    },
  ],
  item_tax: {
    tax_id: TAX_ID,
    tax_name: 'GST 18%',
    tax_code: 'GST18',
    tax_taxability_type: 'TAXABLE',
    tax_is_reverse_charge: false,
    tax_cgst_perc: 9,
    tax_sgst_perc: 9,
    tax_igst_perc: 18,
    tax_cgst_pur_perc: 9,
    tax_sgst_pur_perc: 9,
    tax_igst_pur_perc: 18,
    tax_cess_type: 'NONE',
    tax_cess_perc: 0,
    tax_cess_unit: 0,
    tax_cess_pur_perc: 0,
    tax_cess_pur_unit: 0,
    tax_gst_rate_total: 18,
    tax_sales_ledger_id: null,
    tax_sales_return_ledger_id: null,
    tax_purchase_ledger_id: null,
    tax_purchase_return_ledger_id: null,
    tax_cgst_output_ledger_id: null,
    tax_sgst_output_ledger_id: null,
    tax_igst_output_ledger_id: null,
    tax_cess_output_ledger_id: null,
    tax_cgst_input_ledger_id: null,
    tax_sgst_input_ledger_id: null,
    tax_igst_input_ledger_id: null,
    tax_cess_input_ledger_id: null,
    tax_is_active: true,
    tax_is_deleted: false,
    tax_sync_date: null,
    tax_created_on: '2026-02-20T10:00:00.000Z',
    tax_created_by: USER_ID,
    tax_modified_on: '2026-02-20T10:00:00.000Z',
    tax_modified_by: USER_ID,
  },
};

describe('ItemPriceDetailsController', () => {
  let controller: ItemPriceDetailsController;

  const serviceMock = {
    getByItemId: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemPriceDetailsController],
      providers: [
        {
          provide: ItemPriceDetailsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemPriceDetailsController>(ItemPriceDetailsController);
    jest.clearAllMocks();
  });

  it('wraps joined item price detail responses with success envelope', async () => {
    serviceMock.getByItemId.mockResolvedValue(itemPriceDetailPayload);

    await expect(controller.getByItemId({ item_id: ITEM_ID })).resolves.toEqual({
      success: true,
      message: 'Item price details fetched successfully',
      data: itemPriceDetailPayload,
    });
  });
});
