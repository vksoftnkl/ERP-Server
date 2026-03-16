import { Test, TestingModule } from '@nestjs/testing';
import { ListItemPriceQueryDto } from './dto/list-item-price-query.dto';
import { ItemsPriceMasterController } from './items-price-master.controller';
import { ItemsPriceMasterService } from './items-price-master.service';

const ITEM_PRICE_ID = '019c6f6c-be87-7a11-8905-36092c46fd05';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';

const itemPricePayload = {
  ipm_unit_rate_id: ITEM_PRICE_ID,
  ipm_item_id: ITEM_ID,
  ipm_unit_id: UNIT_ID,
  ipm_godown_id: null,
  ipm_unit_slno: 0,
  ipm_conversion_factor: 1,
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
  ipm_price_a_margin: 0,
  ipm_price_b_margin: 0,
  ipm_price_c_margin: 0,
  ipm_price_d_margin: 0,
  ipm_max_price: 0,
  ipm_min_price: 0,
  ipm_disc_perc: 0,
  ipm_disc_qty: 0,
  ipm_addl_cess: 0,
  ipm_profit_type: 'BY %',
  ipm_round_off: 0,
  ipm_big_unit: false,
  ipm_uom_weight: 0,
  ipm_loading_charge: 0,
  ipm_freight_charge: 0,
  ipm_points: 0,
  ipm_remarks: null,
  ipm_is_active: true,
  ipm_created_on: '2026-02-20T10:00:00.000Z',
  ipm_created_by: 'tester',
  ipm_modified_on: '2026-02-20T10:00:00.000Z',
  ipm_modified_by: 'tester',
};

describe('ItemsPriceMasterController', () => {
  let controller: ItemsPriceMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    delete: jest.fn(),
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
        ipm_profit_type: 'BY %',
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
          ipm_profit_type: 'BY %',
        },
      ]),
    ).resolves.toEqual({
      success: true,
      message: 'Item prices saved successfully',
      data: [itemPricePayload],
    });
  });

  it('returns list wrapper with pagination meta', async () => {
    serviceMock.list.mockResolvedValue({
      items: [itemPricePayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListItemPriceQueryDto = {
      page: 1,
      limit: 20,
    };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Item prices fetched successfully',
      data: [itemPricePayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemPricePayload);

    await expect(controller.getById(ITEM_PRICE_ID)).resolves.toEqual({
      success: true,
      message: 'Item price fetched successfully',
      data: itemPricePayload,
    });
  });

  it('supports delete with body arrays', async () => {
    serviceMock.delete.mockResolvedValue([
      {
        ipm_unit_rate_id: ITEM_PRICE_ID,
        deleted: true,
      },
    ]);

    await expect(controller.remove([{ ipm_unit_rate_id: ITEM_PRICE_ID }])).resolves.toEqual({
      success: true,
      message: 'Item prices deleted successfully',
      data: [
        {
          ipm_unit_rate_id: ITEM_PRICE_ID,
          deleted: true,
        },
      ],
    });
  });
});
