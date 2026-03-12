import { Test, TestingModule } from '@nestjs/testing';
import { ListItemEanCodeQueryDto } from './dto/list-item-ean-code-query.dto';
import { SaveItemEanCodeDto } from './dto/save-item-ean-code.dto';
import { ItemsEanCodeMasterController } from './items-ean-code-master.controller';
import { ItemsEanCodeMasterService } from './items-ean-code-master.service';

const EAN_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';

const itemEanCodePayload = {
  ean_id: EAN_ID,
  ean_item_id: ITEM_ID,
  ean_unit_id: UNIT_ID,
  ean_code: '8901234567890',
  ean_godown_id: null,
  ean_is_default: false,
  ean_is_active: true,
  ean_is_deleted: false,
  ean_created_on: '2026-02-20T10:00:00.000Z',
  ean_created_by: 'tester',
  ean_modified_on: '2026-02-20T10:00:00.000Z',
  ean_modified_by: 'tester',
  ean_remarks: null,
};

describe('ItemsEanCodeMasterController', () => {
  let controller: ItemsEanCodeMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemsEanCodeMasterController],
      providers: [
        {
          provide: ItemsEanCodeMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemsEanCodeMasterController>(ItemsEanCodeMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemEanCodePayload);

    const payload: SaveItemEanCodeDto = {
      ean_item_id: ITEM_ID,
      ean_unit_id: UNIT_ID,
      ean_code: '8901234567890',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item EAN code created successfully',
      data: itemEanCodePayload,
    });
  });

  it('wraps update response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemEanCodePayload);

    const payload: SaveItemEanCodeDto = {
      ean_id: EAN_ID,
      ean_item_id: ITEM_ID,
      ean_unit_id: UNIT_ID,
      ean_code: '8901234567890',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item EAN code updated successfully',
      data: itemEanCodePayload,
    });
  });

  it('wraps array save response with success envelope', async () => {
    serviceMock.save.mockResolvedValue([itemEanCodePayload]);

    await expect(
      controller.save([
        {
          ean_item_id: ITEM_ID,
          ean_unit_id: UNIT_ID,
          ean_code: '8901234567890',
        },
      ]),
    ).resolves.toEqual({
      success: true,
      message: 'Item EAN codes saved successfully',
      data: [itemEanCodePayload],
    });
  });

  it('returns list wrapper with pagination meta', async () => {
    serviceMock.list.mockResolvedValue({
      items: [itemEanCodePayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListItemEanCodeQueryDto = {
      page: 1,
      limit: 20,
    };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Item EAN codes fetched successfully',
      data: [itemEanCodePayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemEanCodePayload);

    await expect(controller.getById(EAN_ID)).resolves.toEqual({
      success: true,
      message: 'Item EAN code fetched successfully',
      data: itemEanCodePayload,
    });
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.softDelete.mockResolvedValue({
      ean_id: EAN_ID,
      deleted: true,
    });

    await expect(controller.remove(undefined, EAN_ID)).resolves.toEqual({
      success: true,
      message: 'Item EAN code deleted successfully',
      data: {
        ean_id: EAN_ID,
        deleted: true,
      },
    });
  });

  it('supports delete with body arrays', async () => {
    serviceMock.softDelete.mockResolvedValue([
      {
        ean_id: EAN_ID,
        deleted: true,
      },
    ]);

    await expect(controller.remove([{ ean_id: EAN_ID }])).resolves.toEqual({
      success: true,
      message: 'Item EAN codes deleted successfully',
      data: [
        {
          ean_id: EAN_ID,
          deleted: true,
        },
      ],
    });
  });
});
