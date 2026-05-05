import { Test, TestingModule } from '@nestjs/testing';
import { ListUnitQueryDto } from './dto/list-unit-query.dto';
import { SaveUnitDto } from './dto/save-unit.dto';
import { UnitsMasterController } from './units-master.controller';
import { UnitsMasterService } from './units-master.service';

const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';

const unitPayload = {
  unit_id: UNIT_ID,
  unit_name: 'PCS',
  unit_alias: null,
  unit_code: null,
  unit_description: null,
  unit_decimal_count: 0,
  unit_weight: null,
  unit_loading: null,
  unit_unloading: null,
  unit_attach_charge: null,
  unit_is_pack_unit: false,
  unit_base_unit_id: null,
  unit_conversion: null,
  unit_is_active: true,
  unit_is_deleted: false,
  unit_sync_date: null,
  unit_created_on: '2026-02-14T10:00:00.000Z',
  unit_created_by: 'tester',
  unit_modified_on: '2026-02-14T10:00:00.000Z',
  unit_modified_by: 'tester',
};

describe('UnitsMasterController', () => {
  let controller: UnitsMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    softDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [UnitsMasterController],
      providers: [
        {
          provide: UnitsMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<UnitsMasterController>(UnitsMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(unitPayload);

    const payload: SaveUnitDto = {
      unit_name: 'PCS',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Unit created successfully',
      data: unitPayload,
    });
  });

  it('wraps update response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(unitPayload);

    const payload: SaveUnitDto = {
      unit_id: UNIT_ID,
      unit_name: 'PCS',
    };

    await expect(controller.save(payload)).resolves.toEqual({
      success: true,
      message: 'Unit updated successfully',
      data: unitPayload,
    });
  });

  it('returns list wrapper with pagination meta', async () => {
    serviceMock.list.mockResolvedValue({
      items: [unitPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListUnitQueryDto = {
      page: 1,
      limit: 20,
    };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Units fetched successfully',
      data: [unitPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('returns styles when the list service provides grid column metadata', async () => {
    serviceMock.list.mockResolvedValue({
      items: [unitPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
      styles: [
        {
          grid_column_number: 1,
          grid_column_name: 'unit_name',
          grid_column_width: 180,
          grid_column_alignment: 'left',
          grid_column_visibility: true,
          grid_column_filter: true,
          grid_column_condition: null,
          grid_column_condition_color: null,
          grid_column_group: false,
          grid_column_total: false,
          grid_column_data_type: 'text',
          grid_column_color: null,
          grid_column_notes: null,
        },
      ],
    });

    await expect(controller.list({ page: 1, limit: 20 })).resolves.toEqual({
      success: true,
      message: 'Units fetched successfully',
      data: [unitPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
      styles: [
        {
          grid_column_number: 1,
          grid_column_name: 'unit_name',
          grid_column_width: 180,
          grid_column_alignment: 'left',
          grid_column_visibility: true,
          grid_column_filter: true,
          grid_column_condition: null,
          grid_column_condition_color: null,
          grid_column_group: false,
          grid_column_total: false,
          grid_column_data_type: 'text',
          grid_column_color: null,
          grid_column_notes: null,
        },
      ],
    });
  });

  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(unitPayload);

    await expect(controller.getById(UNIT_ID)).resolves.toEqual({
      success: true,
      message: 'Unit fetched successfully',
      data: unitPayload,
    });
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.softDelete.mockResolvedValue({
      unit_id: UNIT_ID,
      deleted: true,
    });

    await expect(controller.remove(UNIT_ID)).resolves.toEqual({
      success: true,
      message: 'Unit deleted successfully',
      data: {
        unit_id: UNIT_ID,
        deleted: true,
      },
    });
  });
});
