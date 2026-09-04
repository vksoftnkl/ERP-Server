import { Test, TestingModule } from '@nestjs/testing';
import { SaveItemCategoryDto } from './dto/save-item-category.dto';
import { ItemsCategoryMasterController } from './items-category-master.controller';
import { ItemsCategoryMasterService } from './items-category-master.service';

const ITEM_CATEGORY_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';

const itemCategoryPayload = {
  category_id: ITEM_CATEGORY_ID,
  category_name: 'Dairy',
  category_alias: null,
  category_short: null,
  category_description: null,
  category_parent_id: null,
  category_sort: null,
  category_level: null,
  category_path_ids_cache: [],
  category_tax_claim: null,
  category_default_tax_id: null,
  category_default_hsn: null,
  category_default_uom_id: null,
  category_photo: null,
  category_photo_url: null,
  category_sync_date: null,
  category_is_active: true,
  category_is_deleted: false,
  category_created_on: '2026-02-12T10:00:00.000Z',
  category_created_by: 'tester',
  category_modified_on: '2026-02-12T10:00:00.000Z',
  category_modified_by: 'tester',
};

describe('ItemsCategoryMasterController', () => {
  let controller: ItemsCategoryMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    toggleDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemsCategoryMasterController],
      providers: [
        {
          provide: ItemsCategoryMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemsCategoryMasterController>(ItemsCategoryMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemCategoryPayload);

    const payload: SaveItemCategoryDto = {
      category_name: 'Dairy',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item category created successfully',
      data: itemCategoryPayload,
    });
  });

  it('wraps update response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemCategoryPayload);

    const payload: SaveItemCategoryDto = {
      category_id: ITEM_CATEGORY_ID,
      category_name: 'Dairy',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item category updated successfully',
      data: itemCategoryPayload,
    });
  });
  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemCategoryPayload);

    await expect(controller.getById(ITEM_CATEGORY_ID)).resolves.toEqual({
      success: true,
      message: 'Item category fetched successfully',
      data: itemCategoryPayload,
    });
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.toggleDelete.mockResolvedValue({
      category_id: ITEM_CATEGORY_ID,
      deleted: true,
    });

    await expect(controller.remove(ITEM_CATEGORY_ID)).resolves.toEqual({
      success: true,
      message: 'Item category deleted successfully',
      data: {
        category_id: ITEM_CATEGORY_ID,
        deleted: true,
      },
    });
  });

  it('returns wrapped restore response', async () => {
    serviceMock.toggleDelete.mockResolvedValue({
      category_id: ITEM_CATEGORY_ID,
      deleted: false,
    });

    await expect(controller.remove(ITEM_CATEGORY_ID)).resolves.toEqual({
      success: true,
      message: 'Item category restored successfully',
      data: {
        category_id: ITEM_CATEGORY_ID,
        deleted: false,
      },
    });
  });

  it('maps uploaded category_photo file bytes into base64 string before service', async () => {
    serviceMock.save.mockResolvedValue(itemCategoryPayload);

    const payload: SaveItemCategoryDto = {
      category_name: 'Dairy',
    };
    const file = {
      buffer: Buffer.from('sample-image'),
    };

    await controller.save(payload, file);

    expect(serviceMock.save).toHaveBeenCalledWith({
      ...payload,
      category_photo: Buffer.from('sample-image').toString('base64'),
    });
  });
});
