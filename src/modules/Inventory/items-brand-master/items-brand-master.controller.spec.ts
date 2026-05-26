import { Test, TestingModule } from '@nestjs/testing';
import { SaveItemBrandDto } from './dto/save-item-brand.dto';
import { ItemsBrandMasterController } from './items-brand-master.controller';
import { ItemsBrandMasterService } from './items-brand-master.service';

const BRAND_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';

const itemBrandPayload = {
  brand_id: BRAND_ID,
  brand_name: 'Acme',
  brand_alias: null,
  brand_short: null,
  brand_description: null,
  brand_photo: null,
  brand_photo_url: null,
  brand_parent_id: null,
  brand_sort: null,
  brand_level: null,
  brand_path_ids: [],
  brand_is_active: true,
  brand_is_deleted: false,
  brand_sync_date: null,
  brand_created_on: '2026-02-12T10:00:00.000Z',
  brand_created_by: 'tester',
  brand_modified_on: '2026-02-12T10:00:00.000Z',
  brand_modified_by: 'tester',
};

describe('ItemsBrandMasterController', () => {
  let controller: ItemsBrandMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemsBrandMasterController],
      providers: [
        {
          provide: ItemsBrandMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemsBrandMasterController>(ItemsBrandMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemBrandPayload);

    const payload: SaveItemBrandDto = {
      brand_name: 'Acme',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item brand created successfully',
      data: itemBrandPayload,
    });
  });

  it('wraps update response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemBrandPayload);

    const payload: SaveItemBrandDto = {
      brand_id: BRAND_ID,
      brand_name: 'Acme',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Item brand updated successfully',
      data: itemBrandPayload,
    });
  });
  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemBrandPayload);

    await expect(controller.getById(BRAND_ID)).resolves.toEqual({
      success: true,
      message: 'Item brand fetched successfully',
      data: itemBrandPayload,
    });
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.softDelete.mockResolvedValue({
      brand_id: BRAND_ID,
      deleted: true,
    });

    await expect(controller.remove(BRAND_ID)).resolves.toEqual({
      success: true,
      message: 'Item brand deleted successfully',
      data: {
        brand_id: BRAND_ID,
        deleted: true,
      },
    });
  });

  it('maps uploaded brand_photo file to base64 before calling service', async () => {
    serviceMock.save.mockResolvedValue(itemBrandPayload);

    const payload: SaveItemBrandDto = {
      brand_name: 'Acme',
    };
    const file = {
      buffer: Buffer.from('sample-image'),
    };

    await controller.save(payload, file);

    expect(serviceMock.save).toHaveBeenCalledWith({
      ...payload,
      brand_photo: Buffer.from('sample-image').toString('base64'),
    });
  });
});
