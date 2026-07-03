import { Test, TestingModule } from '@nestjs/testing';
import { ItemUnitConversionController } from './item-unit-conversion.controller';
import { ItemUnitConversionService } from './item-unit-conversion.service';

const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fd09';
const UNIT_CONVERSION_ID = '019c6f6c-be87-7a11-8905-36092c46fd10';

const itemUnitConversionPayload = {
  iuc_id: UNIT_CONVERSION_ID,
  iuc_company_id: ITEM_ID,
  iuc_item_id: ITEM_ID,
  iuc_unit_id: UNIT_ID,
  iuc_base_unit_id: UNIT_ID,
  iuc_to_base_factor: 1,
  iuc_unit_slno: 0,
  iuc_unit_factor: 1,
  iuc_is_default_unit: true,
  iuc_is_base_unit: true,
  iuc_is_big_unit: false,
  iuc_uom_weight: 0,
  iuc_uom_remarks: null,
  iuc_is_active: true,
  iuc_is_deleted: false,
  iuc_sync_date: null,
  iuc_created_on: '2026-02-20T10:00:00.000Z',
  iuc_created_by: USER_ID,
  iuc_updated_on: '2026-02-20T10:00:00.000Z',
  iuc_updated_by: USER_ID,
};

describe('ItemUnitConversionController', () => {
  let controller: ItemUnitConversionController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    toggleDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemUnitConversionController],
      providers: [
        {
          provide: ItemUnitConversionService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemUnitConversionController>(ItemUnitConversionController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemUnitConversionPayload);

    await expect(
      controller.save({
        iuc_company_id: ITEM_ID,
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: UNIT_ID,
      }),
    ).resolves.toEqual({
      success: true,
      message: 'Item unit conversion created successfully',
      data: itemUnitConversionPayload,
    });
  });

  it('accepts payloads when iuc_base_unit_id is an empty string', async () => {
    serviceMock.save.mockResolvedValue(itemUnitConversionPayload);

    await expect(
      controller.save({
        iuc_company_id: ITEM_ID,
        iuc_item_id: ITEM_ID,
        iuc_unit_id: UNIT_ID,
        iuc_base_unit_id: '',
      }),
    ).resolves.toEqual({
      success: true,
      message: 'Item unit conversion created successfully',
      data: itemUnitConversionPayload,
    });
  });

  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemUnitConversionPayload);

    await expect(controller.getById({ iuc_id: UNIT_CONVERSION_ID })).resolves.toEqual({
      success: true,
      message: 'Item unit conversion fetched successfully',
      data: itemUnitConversionPayload,
    });
  });

  it('supports delete with body arrays', async () => {
    serviceMock.toggleDelete.mockResolvedValue([
      {
        iuc_id: UNIT_CONVERSION_ID,
        deleted: true,
      },
    ]);

    await expect(controller.remove([{ iuc_id: UNIT_CONVERSION_ID }], {})).resolves.toEqual({
      success: true,
      message: 'Item unit conversions deleted successfully',
      data: [
        {
          iuc_id: UNIT_CONVERSION_ID,
          deleted: true,
        },
      ],
    });
  });
});
