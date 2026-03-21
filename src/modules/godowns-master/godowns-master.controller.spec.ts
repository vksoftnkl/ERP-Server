import { Test, TestingModule } from '@nestjs/testing';
import { Response } from 'express';
import { DeleteGodownQueryDto } from './dto/delete-godown-query.dto';
import { ListOrGetGodownQueryDto } from './dto/list-or-get-godown-query.dto';
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
    softDelete: jest.fn(),
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

  it('wraps create response on /create route and sets 201 status', async () => {
    serviceMock.save.mockResolvedValue(godownPayload);
    const { response, statusMock } = createResponse();

    const payload: SaveGodownDto = {
      gdl_godown_id: GODOWN_ID,
      gdl_branch_id: BRANCH_ID,
      gdl_name: 'Rack A1',
    };

    await expect(controller.create(payload, response)).resolves.toEqual({
      success: true,
      message: 'Godown location created successfully',
      data: godownPayload,
    });
    expect(statusMock).toHaveBeenCalledWith(201);
  });

  it('returns list wrapper when gdl_id query is absent', async () => {
    serviceMock.list.mockResolvedValue({
      items: [godownPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListOrGetGodownQueryDto = {
      page: 1,
      limit: 20,
    };

    await expect(controller.listOrGet(query)).resolves.toEqual({
      success: true,
      message: 'Godown locations fetched successfully',
      data: [godownPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    expect(serviceMock.getById).not.toHaveBeenCalled();
  });

  it('returns single wrapper when gdl_id query is present', async () => {
    serviceMock.getById.mockResolvedValue(godownPayload);

    await expect(controller.listOrGet({ gdl_id: GDL_ID })).resolves.toEqual({
      success: true,
      message: 'Godown location fetched successfully',
      data: godownPayload,
    });

    expect(serviceMock.list).not.toHaveBeenCalled();
  });

  it('returns wrapped single response from /get endpoint with gdl_id query', async () => {
    serviceMock.getById.mockResolvedValue(godownPayload);

    await expect(controller.getByIdByQuery({ gdl_id: GDL_ID })).resolves.toEqual({
      success: true,
      message: 'Godown location fetched successfully',
      data: godownPayload,
    });

    expect(serviceMock.getById).toHaveBeenCalledWith(GDL_ID);
  });

  it('returns list wrapper from /list endpoint', async () => {
    serviceMock.getList.mockResolvedValue({
      items: [godownPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListOrGetGodownQueryDto = {
      page: 1,
      limit: 20,
    };

    await expect(controller.getList(query)).resolves.toEqual({
      success: true,
      message: 'Godown locations fetched successfully',
      data: [godownPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    expect(serviceMock.getList).toHaveBeenCalledWith(query);
    expect(serviceMock.getById).not.toHaveBeenCalled();
  });

  it('returns wrapped soft delete response', async () => {
    serviceMock.softDelete.mockResolvedValue({
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

  it('returns wrapped soft delete response from /delete endpoint with gdl_id query', async () => {
    serviceMock.softDelete.mockResolvedValue({
      gdl_id: GDL_ID,
      deleted: true,
    });

    const query: DeleteGodownQueryDto = {
      gdl_id: GDL_ID,
    };

    await expect(controller.removeByQuery(query)).resolves.toEqual({
      success: true,
      message: 'Godown location deleted successfully',
      data: {
        gdl_id: GDL_ID,
        deleted: true,
      },
    });
  });
});
