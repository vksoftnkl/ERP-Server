import { UiTableMasterController } from './ui-table-master.controller';
import { UiTableMasterService } from './ui-table-master.service';
import { UiTableMasterPayload } from './types/ui-table-master-api.types';

const PAYLOAD = {
  uiTblId: '7',
  uiTblName: 'Sale bill items',
  columns: [],
} as unknown as UiTableMasterPayload;

describe('UiTableMasterController', () => {
  let service: {
    save: jest.Mock;
    list: jest.Mock;
    updateColumnWidths: jest.Mock;
    updateVisibilitySettings: jest.Mock;
    softDelete: jest.Mock;
    softDeleteColumn: jest.Mock;
  };
  let controller: UiTableMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      list: jest.fn().mockResolvedValue({ items: [PAYLOAD] }),
      updateColumnWidths: jest.fn().mockResolvedValue({ updated: 2 }),
      updateVisibilitySettings: jest.fn().mockResolvedValue({ updated: 3 }),
      softDelete: jest.fn().mockResolvedValue({ uiTblId: '7', deleted: true }),
      softDeleteColumn: jest.fn().mockResolvedValue({ uiTblClmId: '70', deleted: true }),
    };
    controller = new UiTableMasterController(service as unknown as UiTableMasterService);
  });

  it('words a save without uiTblId as a create', async () => {
    await expect(controller.save({ uiTblName: 'Sale bill items' })).resolves.toEqual({
      success: true,
      message: 'UI table created successfully',
      data: PAYLOAD,
    });
  });

  it('words a save with uiTblId as an update', async () => {
    await expect(controller.save({ uiTblId: '7', uiTblName: 'X' })).resolves.toMatchObject({
      message: 'UI table updated successfully',
    });
  });

  it('wraps the table list without a meta block', async () => {
    await expect(controller.list({ uiTblId: '7' })).resolves.toEqual({
      success: true,
      message: 'UI tables fetched successfully',
      data: [PAYLOAD],
    });
  });

  it('wraps the column-width and layout counts', async () => {
    const widths = { columns: [{ uiTblClmId: '70', uiTblClmPx: '90px' }] };
    const layout = { columns: [{ uiTblClmId: '70', uiTblClmColumnVisibility: false }] };

    await expect(controller.updateColumnWidths(widths)).resolves.toEqual({
      success: true,
      message: 'Column widths updated successfully',
      data: { updated: 2 },
    });
    await expect(controller.updateVisibilitySettings(layout)).resolves.toEqual({
      success: true,
      message: 'Visibility settings updated successfully',
      data: { updated: 3 },
    });
    expect(service.updateColumnWidths).toHaveBeenCalledWith(widths);
    expect(service.updateVisibilitySettings).toHaveBeenCalledWith(layout);
  });

  it('hands a missing id to the service as an empty string, which it refuses', async () => {
    await controller.remove(undefined);
    await controller.removeColumn(undefined);

    expect(service.softDelete).toHaveBeenCalledWith('');
    expect(service.softDeleteColumn).toHaveBeenCalledWith('');
  });

  it('wraps the two deletes', async () => {
    await expect(controller.remove('7')).resolves.toEqual({
      success: true,
      message: 'UI table deleted successfully',
      data: { uiTblId: '7', deleted: true },
    });
    await expect(controller.removeColumn('70')).resolves.toEqual({
      success: true,
      message: 'UI table column deleted successfully',
      data: { uiTblClmId: '70', deleted: true },
    });
  });
});
