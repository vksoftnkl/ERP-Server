import { DropdownDetailsController } from './dropdown-details.controller';
import { DropdownDetailsService } from './dropdown-details.service';
import { DropdownDetailPayload } from './types/dropdown-detail-api.types';

const COLUMN_ID = '019f07d3-a1e0-7d2f-9d64-1d566dec2cff';
const SQL = 'SELECT item_id, item_name FROM inventory.item_master';

const PAYLOAD = {
  dropdown_id: '7',
  dropdown_name: 'Item Master Dropdown',
} as DropdownDetailPayload;

describe('DropdownDetailsController', () => {
  let service: {
    save: jest.Mock;
    list: jest.Mock;
    run: jest.Mock;
    updateColumnWidths: jest.Mock;
    updateFilterSettings: jest.Mock;
    updateVisibilitySettings: jest.Mock;
    delete: jest.Mock;
    deleteColumn: jest.Mock;
  };
  let controller: DropdownDetailsController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      list: jest.fn().mockResolvedValue({ items: [PAYLOAD] }),
      run: jest.fn().mockResolvedValue({
        items: [{ item_id: 1 }],
        meta: { page: 1, limit: 20, total: 1 },
      }),
      updateColumnWidths: jest.fn().mockResolvedValue({ updated: 1 }),
      updateFilterSettings: jest.fn().mockResolvedValue({ updated: 2 }),
      updateVisibilitySettings: jest.fn().mockResolvedValue({ updated: 3 }),
      delete: jest.fn().mockResolvedValue({ dropdown_id: '7', deleted: true }),
      deleteColumn: jest.fn().mockResolvedValue({ dropdown_columns_id: COLUMN_ID, deleted: true }),
    };
    controller = new DropdownDetailsController(service as unknown as DropdownDetailsService);
  });

  it('words a body without dropdown_id as a create', async () => {
    const dto = { dropdown_name: 'Item Master Dropdown', dropdown_sql: SQL };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Dropdown details created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a body with dropdown_id as an update', async () => {
    const dto = { dropdown_id: '7', dropdown_name: 'Item Master Dropdown', dropdown_sql: SQL };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Dropdown details updated successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('unwraps the listed items into data', async () => {
    const query = { search: 'item' };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Dropdown details fetched successfully',
      data: [PAYLOAD],
    });
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('wraps the rows a run returns', async () => {
    const query = { dropdown_id: '7', page: 1, limit: 20 };

    await expect(controller.run(query)).resolves.toEqual({
      success: true,
      message: 'Dropdown data fetched successfully',
      data: { items: [{ item_id: 1 }], meta: { page: 1, limit: 20, total: 1 } },
    });
    expect(service.run).toHaveBeenCalledWith(query);
  });

  it('wraps the three column-setting updates', async () => {
    const widths = { columns: [{ dropdown_columns_id: COLUMN_ID, dropdown_columns_width: 120 }] };
    const filters = {
      columns: [{ dropdown_columns_id: COLUMN_ID, dropdown_columns_filter: true }],
    };
    const visibility = {
      columns: [{ dropdown_columns_id: COLUMN_ID, dropdown_columns_visiblity: false }],
    };

    await expect(controller.updateColumnWidths(widths)).resolves.toEqual({
      success: true,
      message: 'Column widths updated successfully',
      data: { updated: 1 },
    });
    await expect(controller.updateFilterSettings(filters)).resolves.toEqual({
      success: true,
      message: 'Filter settings updated successfully',
      data: { updated: 2 },
    });
    await expect(controller.updateVisibilitySettings(visibility)).resolves.toEqual({
      success: true,
      message: 'Visibility settings updated successfully',
      data: { updated: 3 },
    });
    expect(service.updateColumnWidths).toHaveBeenCalledWith(widths);
    expect(service.updateFilterSettings).toHaveBeenCalledWith(filters);
    expect(service.updateVisibilitySettings).toHaveBeenCalledWith(visibility);
  });

  it('wraps a dropdown delete and a column delete', async () => {
    await expect(controller.remove('7')).resolves.toEqual({
      success: true,
      message: 'Dropdown details deleted successfully',
      data: { dropdown_id: '7', deleted: true },
    });
    await expect(controller.removeColumn(COLUMN_ID)).resolves.toEqual({
      success: true,
      message: 'Dropdown column deleted successfully',
      data: { dropdown_columns_id: COLUMN_ID, deleted: true },
    });
    expect(service.delete).toHaveBeenCalledWith('7');
    expect(service.deleteColumn).toHaveBeenCalledWith(COLUMN_ID);
  });

  // A missing query param reaches the service as '' so its id check refuses it.
  it('hands the service an empty id when the query param is missing', async () => {
    await controller.remove(undefined);
    await controller.removeColumn(undefined);

    expect(service.delete).toHaveBeenCalledWith('');
    expect(service.deleteColumn).toHaveBeenCalledWith('');
  });
});
