import { ConfiguredGridSqlController } from './configured-grid-sql.controller';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';

describe('ConfiguredGridSqlController', () => {
  let controller: ConfiguredGridSqlController;
  let service: {
    loadGridColumns: jest.Mock;
  };

  beforeEach(() => {
    service = {
      loadGridColumns: jest.fn(),
    };

    controller = new ConfiguredGridSqlController(service as unknown as ConfiguredGridSqlService);
  });

  it('fetches grid columns using only grid id', async () => {
    const columns = [
      {
        grid_column_serial_id: '10',
        grid_column_number: 1,
        grid_column_name: 'unit_name',
        grid_column_width: 180,
        grid_column_position: 1,
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
        grid_column_sql_field_name: 'unit_name',
      },
    ];

    service.loadGridColumns.mockResolvedValue(columns);

    await expect(controller.columns({ grid_id: '42' })).resolves.toEqual({
      success: true,
      message: 'Grid columns fetched successfully',
      data: columns,
    });
    expect(service.loadGridColumns).toHaveBeenCalledWith(42n);
  });
});
