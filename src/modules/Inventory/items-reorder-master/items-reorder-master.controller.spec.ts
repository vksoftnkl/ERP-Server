import { Test, TestingModule } from '@nestjs/testing';
import { ItemsReorderMasterController } from './items-reorder-master.controller';
import { ItemsReorderMasterService } from './items-reorder-master.service';

const REORDER_ID = '019c6f6c-be87-7a11-8905-36092c46fd11';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46fd12';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46fd13';

const itemReorderPayload = {
  ir_id: REORDER_ID,
  ir_branch_id: null,
  ir_item_id: ITEM_ID,
  ir_unit_id: UNIT_ID,
  ir_godown_id: null,
  ir_min_level: 0,
  ir_max_level: 0,
  ir_reorder_level: 0,
  ir_reorder_qty: 0,
  ir_lead_time_days: 0,
  ir_review_cycle_days: 0,
  ir_reorder_days: 0,
  ir_expiry_buffer_days: 0,
  ir_reorder_type: 'MIN_MAX',
  ir_is_active: true,
  ir_is_deleted: false,
  ir_remarks: null,
  ir_created_on: '2026-02-20T10:00:00.000Z',
  ir_created_by: 'tester',
  ir_modified_on: '2026-02-20T10:00:00.000Z',
  ir_modified_by: 'tester',
};

describe('ItemsReorderMasterController', () => {
  let controller: ItemsReorderMasterController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    toggleDelete: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [ItemsReorderMasterController],
      providers: [
        {
          provide: ItemsReorderMasterService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<ItemsReorderMasterController>(ItemsReorderMasterController);
    jest.clearAllMocks();
  });

  it('wraps create response with success envelope', async () => {
    serviceMock.save.mockResolvedValue(itemReorderPayload);

    await expect(
      controller.save({
        ir_item_id: ITEM_ID,
        ir_unit_id: UNIT_ID,
      }),
    ).resolves.toEqual({
      success: true,
      message: 'Item reorder created successfully',
      data: itemReorderPayload,
    });
  });

  it('wraps array save response with success envelope', async () => {
    serviceMock.save.mockResolvedValue([itemReorderPayload]);

    await expect(
      controller.save([
        {
          ir_item_id: ITEM_ID,
          ir_unit_id: UNIT_ID,
        },
      ]),
    ).resolves.toEqual({
      success: true,
      message: 'Item reorders saved successfully',
      data: [itemReorderPayload],
    });
  });
  it('returns wrapped getById response', async () => {
    serviceMock.getById.mockResolvedValue(itemReorderPayload);

    await expect(controller.getById(REORDER_ID)).resolves.toEqual({
      success: true,
      message: 'Item reorder fetched successfully',
      data: itemReorderPayload,
    });
  });

  it('supports delete with body arrays', async () => {
    serviceMock.toggleDelete.mockResolvedValue([
      {
        ir_id: REORDER_ID,
        deleted: true,
      },
    ]);

    await expect(controller.remove([{ ir_id: REORDER_ID }])).resolves.toEqual({
      success: true,
      message: 'Item reorders deleted successfully',
      data: [
        {
          ir_id: REORDER_ID,
          deleted: true,
        },
      ],
    });
  });

  it('reports a restored message when all array items were restored', async () => {
    serviceMock.toggleDelete.mockResolvedValue([
      {
        ir_id: REORDER_ID,
        deleted: false,
      },
    ]);

    await expect(controller.remove([{ ir_id: REORDER_ID }])).resolves.toEqual({
      success: true,
      message: 'Item reorders restored successfully',
      data: [
        {
          ir_id: REORDER_ID,
          deleted: false,
        },
      ],
    });
  });
});
