import { Test, TestingModule } from '@nestjs/testing';
import { ListItemSectionQueryDto } from './dto/list-item-section-query.dto';
import { SaveItemSectionDto } from './dto/save-item-section.dto';
import { ItemsSectionMasterController } from './items-section-master.controller';
import { ItemsSectionMasterService } from './items-section-master.service';

const ITEM_SECTION_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';

const itemSectionPayload = {
  sec_id: ITEM_SECTION_ID,
  sec_name: 'Dairy',
  sec_alias: null,
  sec_short: null,
  sec_description: null,
  sec_parent_id: null,
  sec_sort: null,
  sec_level: null,
  sec_path_ids: [],
  sec_position: null,
  sec_color_code: null,
  sec_icon: null,
  sec_photo: null,
  sec_photo_url: null,
  sec_sync_date: null,
  sec_is_active: true,
  sec_is_deleted: false,
  sec_created_on: '2026-02-12T10:00:00.000Z',
  sec_created_by: 'tester',
  sec_modified_on: '2026-02-12T10:00:00.000Z',
  sec_modified_by: 'tester',
};

describe('ItemsSectionMasterController', () => {
  let controller: ItemsSectionMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemsSectionMasterController],
      providers: [
        {
          provide: ItemsSectionMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemsSectionMasterController>(ItemsSectionMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemSectionPayload);

    const payload: SaveItemSectionDto = {
      sec_name: 'Dairy',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item section created successfully',
      data: itemSectionPayload,
    });
  });

  it('wraps update response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemSectionPayload);

    const payload: SaveItemSectionDto = {
      sec_id: ITEM_SECTION_ID,
      sec_name: 'Dairy',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item section updated successfully',
      data: itemSectionPayload,
    });
  });

  it('returns list wrapper with pagination meta', async () => {
    serviceMock.list.mockResolvedValue({
      items: [itemSectionPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListItemSectionQueryDto = {
      page: 1,
      limit: 20,
    };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Item sections fetched successfully',
      data: [itemSectionPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemSectionPayload);

    await expect(controller.getById(ITEM_SECTION_ID)).resolves.toEqual({
      success: true,
      message: 'Item section fetched successfully',
      data: itemSectionPayload,
    });
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.softDelete.mockResolvedValue({
      sec_id: ITEM_SECTION_ID,
      deleted: true,
    });

    await expect(controller.remove(ITEM_SECTION_ID)).resolves.toEqual({
      success: true,
      message: 'Item section deleted successfully',
      data: {
        sec_id: ITEM_SECTION_ID,
        deleted: true,
      },
    });
  });

  it('maps uploaded sec_photo file bytes before calling service', async () => {
    serviceMock.save.mockResolvedValue(itemSectionPayload);

    const payload: SaveItemSectionDto = {
      sec_name: 'Dairy',
    };
    const file = {
      buffer: Buffer.from('sample-image'),
    };

    await controller.save(payload, file);

    expect(serviceMock.save).toHaveBeenCalledWith({
      ...payload,
      sec_photo: Buffer.from('sample-image'),
    });
  });
});
