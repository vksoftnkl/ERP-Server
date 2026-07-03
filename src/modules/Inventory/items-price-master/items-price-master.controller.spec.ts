import { Test, TestingModule } from '@nestjs/testing';
import { ItemsPriceMasterController } from './items-price-master.controller';
import { ItemsPriceMasterService } from './items-price-master.service';

const ITEM_PRICE_ID = '019c6f6c-be87-7a11-8905-36092c46fd05';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fd09';

const itemPricePayload = {
  ipm_id: ITEM_PRICE_ID,
  ipm_company_id: null,
  ipm_branch_id: null,
  ipm_item_id: ITEM_ID,
  ipm_unit_id: UNIT_ID,
  ipm_godown_id: GODOWN_ID,
  ipm_base_unit_id: null,
  ipm_to_base_factor: 1,
  ipm_unit_slno: 0,
  ipm_unit_factor: 1,
  ipm_is_default_unit: false,
  ipm_is_big_unit: false,
  ipm_is_base_unit: false,
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
};

describe('ItemsPriceMasterController', () => {
  let controller: ItemsPriceMasterController;

  const serviceMock = {
    save: jest.fn(),
    listPrices: jest.fn(),
    getById: jest.fn(),
    toggleDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemsPriceMasterController],
      providers: [
        {
          provide: ItemsPriceMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemsPriceMasterController>(ItemsPriceMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemPricePayload);

    await expect(
      controller.save({
        ipm_item_id: ITEM_ID,
        ipm_unit_id: UNIT_ID,
        ipm_godown_id: GODOWN_ID,
        ipm_profit_type: 'MANUAL',
      }),
    ).resolves.toEqual({
      success: true,
      message: 'Item price created successfully',
      data: itemPricePayload,
    });
  });

  it('wraps array save response with success envelope', async () => {
    serviceMock.save.mockResolvedValue([itemPricePayload]);

    await expect(
      controller.save([
        {
          ipm_item_id: ITEM_ID,
          ipm_unit_id: UNIT_ID,
          ipm_godown_id: GODOWN_ID,
          ipm_profit_type: 'MANUAL',
        },
      ]),
    ).resolves.toEqual({
      success: true,
      message: 'Item prices saved successfully',
      data: [itemPricePayload],
    });
  });

  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemPricePayload);

    await expect(controller.getById({ ipm_id: ITEM_PRICE_ID })).resolves.toEqual({
      success: true,
      message: 'Item price fetched successfully',
      data: itemPricePayload,
    });
  });

  it('supports delete with body arrays', async () => {
    serviceMock.toggleDelete.mockResolvedValue([
      {
        ipm_id: ITEM_PRICE_ID,
        deleted: true,
      },
    ]);

    await expect(controller.remove([{ ipm_id: ITEM_PRICE_ID }], {})).resolves.toEqual({
      success: true,
      message: 'Item prices deleted successfully',
      data: [
        {
          ipm_id: ITEM_PRICE_ID,
          deleted: true,
        },
      ],
    });
  });

  it('reports a restored message when prices were restored', async () => {
    serviceMock.toggleDelete.mockResolvedValue([
      {
        ipm_id: ITEM_PRICE_ID,
        deleted: false,
      },
    ]);

    await expect(controller.remove([{ ipm_id: ITEM_PRICE_ID }], {})).resolves.toEqual({
      success: true,
      message: 'Item prices restored successfully',
      data: [
        {
          ipm_id: ITEM_PRICE_ID,
          deleted: false,
        },
      ],
    });
  });
});
