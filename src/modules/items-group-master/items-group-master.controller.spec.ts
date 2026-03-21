import { Test, TestingModule } from '@nestjs/testing';
import { ListItemGroupQueryDto } from './dto/list-item-group-query.dto';
import { SaveItemGroupDto } from './dto/save-item-group.dto';
import { ItemsGroupMasterController } from './items-group-master.controller';
import { ItemsGroupMasterService } from './items-group-master.service';

const ITEM_GROUP_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';

const itemGroupPayload = {
  itg_id: ITEM_GROUP_ID,
  itg_name: 'Raw Materials',
  itg_alias: null,
  itg_short: null,
  itg_description: null,
  itg_parent_id: null,
  itg_sort: null,
  itg_level: null,
  itg_path_ids_cache: [],
  itg_tax_claim: null,
  itg_default_tax_id: null,
  itg_default_hsn: null,
  itg_default_uom_id: null,
  itg_photo: null,
  itg_photo_url: null,
  itg_sync_date: null,
  itg_is_active: true,
  itg_is_deleted: false,
  itg_created_on: '2026-02-12T10:00:00.000Z',
  itg_created_by: 'tester',
  itg_modified_on: '2026-02-12T10:00:00.000Z',
  itg_modified_by: 'tester',
};

describe('ItemsGroupMasterController', () => {
  let controller: ItemsGroupMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemsGroupMasterController],
      providers: [
        {
          provide: ItemsGroupMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemsGroupMasterController>(ItemsGroupMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemGroupPayload);

    const payload: SaveItemGroupDto = {
      itg_name: 'Raw Materials',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item group created successfully',
      data: itemGroupPayload,
    });
  });

  it('wraps update response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemGroupPayload);

    const payload: SaveItemGroupDto = {
      itg_id: ITEM_GROUP_ID,
      itg_name: 'Raw Materials',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item group updated successfully',
      data: itemGroupPayload,
    });
  });

  it('returns list wrapper with pagination meta', async () => {
    serviceMock.list.mockResolvedValue({
      items: [itemGroupPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListItemGroupQueryDto = {
      page: 1,
      limit: 20,
    };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Item groups fetched successfully',
      data: [itemGroupPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemGroupPayload);

    await expect(controller.getById(ITEM_GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Item group fetched successfully',
      data: itemGroupPayload,
    });
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.softDelete.mockResolvedValue({
      itg_id: ITEM_GROUP_ID,
      deleted: true,
    });

    await expect(controller.remove(ITEM_GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Item group deleted successfully',
      data: {
        itg_id: ITEM_GROUP_ID,
        deleted: true,
      },
    });
  });

  it('maps uploaded itg_photo file to base64 before calling service', async () => {
    serviceMock.save.mockResolvedValue(itemGroupPayload);

    const payload: SaveItemGroupDto = {
      itg_name: 'Raw Materials',
    };
    const file = {
      buffer: Buffer.from('sample-image'),
    };

    await controller.save(payload, file);

    expect(serviceMock.save).toHaveBeenCalledWith({
      ...payload,
      itg_photo: Buffer.from('sample-image').toString('base64'),
    });
  });
});
