import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { DeleteGodownQueryDto } from './dto/delete-godown-query.dto';
import { SaveGodownDto } from './dto/save-godown.dto';
import { GodownsMasterController } from './godowns-master.controller';
import { GodownsMasterService } from './godowns-master.service';

const GDL_ID = '019c6f6c-be87-7a11-8905-36092c46fd06';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46fd07';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fd08';

const godownPayload = {
  gdl_id: GDL_ID,
  gdl_godown_id: GODOWN_ID,
  gdl_branch_id: BRANCH_ID,
  gdl_name: 'Rack A1',
  gdl_short: 'A1',
  gdl_code: 'RACK-A1',
  gdl_type: 'BIN',
  gdl_parent_id: null,
  gdl_sort: 1,
  gdl_level: 0,
  gdl_path_ids_cache: [],
  gdl_del_sheet: false,
  gdl_split_stock: false,
  gdl_negative_stock: false,
  gdl_volume: 10,
  gdl_is_active: true,
  gdl_is_deleted: false,
  gdl_created_on: '2026-02-20T10:15:30.000Z',
  gdl_created_by: 'system',
  gdl_modified_on: '2026-02-20T10:15:30.000Z',
  gdl_modified_by: 'system',
  gdl_remarks: null,
};

describe('GodownsMasterController', () => {
  let controller: GodownsMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getList: jest.fn(),
    getById: jest.fn(),
    toggleDelete: jest.fn(),
  };

  const createResponse = (): { response: Response; statusMock: jest.Mock } => {
    const statusMock = jest.fn().mockReturnThis();
    return {
      response: {
        status: statusMock,
      } as unknown as Response,
      statusMock,
    };
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [GodownsMasterController],
      providers: [
        {
          provide: GodownsMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<GodownsMasterController>(GodownsMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response and sets 201 status', async () => {
    serviceMock.save.mockResolvedValue(godownPayload);
    const { response, statusMock } = createResponse();

    const payload: SaveGodownDto = {
      gdl_godown_id: GODOWN_ID,
      gdl_branch_id: BRANCH_ID,
      gdl_name: 'Rack A1',
    };

    await expect(controller.save(payload, response)).resolves.toEqual({
      success: true,
      message: 'Godown location created successfully',
      data: godownPayload,
    });
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('wraps update response and sets 200 status', async () => {
    serviceMock.save.mockResolvedValue(godownPayload);
    const { response, statusMock } = createResponse();

    const payload: SaveGodownDto = {
      gdl_id: GDL_ID,
      gdl_name: 'Rack A1',
    };

    await expect(controller.save(payload, response)).resolves.toEqual({
      success: true,
      message: 'Godown location updated successfully',
      data: godownPayload,
    });
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.toggleDelete.mockResolvedValue({
      gdl_id: GDL_ID,
      deleted: true,
    });

    const query: DeleteGodownQueryDto = {
      gdl_id: GDL_ID,
    };

    await expect(controller.remove(query)).resolves.toEqual({
      success: true,
      message: 'Godown location deleted successfully',
      data: {
        gdl_id: GDL_ID,
        deleted: true,
      },
    });
  });

  it('returns wrapped restore response', async () => {
    serviceMock.toggleDelete.mockResolvedValue({
      gdl_id: GDL_ID,
      deleted: false,
    });

    const query: DeleteGodownQueryDto = {
      gdl_id: GDL_ID,
    };

    await expect(controller.remove(query)).resolves.toEqual({
      success: true,
      message: 'Godown location restored successfully',
      data: {
        gdl_id: GDL_ID,
        deleted: false,
      },
    });
  });
});
