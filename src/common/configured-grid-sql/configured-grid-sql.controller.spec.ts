import { BadRequestException } from '@nestjs/common';
import { ConfiguredGridSqlController } from './configured-grid-sql.controller';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';

describe('ConfiguredGridSqlController', () => {
  let controller: ConfiguredGridSqlController;
  let service: {
    loadGridColumns: jest.Mock;
    loadCandidates: jest.Mock;
    extractTopLevelFromTableName: jest.Mock;
    validateBaseSql: jest.Mock;
    bindGridParams: jest.Mock;
    runPagedQuery: jest.Mock;
    findUnboundParamTokens: jest.Mock;
  };

  beforeEach(() => {
    service = {
      loadGridColumns: jest.fn(),
      loadCandidates: jest.fn(),
      extractTopLevelFromTableName: jest.fn(),
      validateBaseSql: jest.fn(),
      bindGridParams: jest.fn(),
      runPagedQuery: jest.fn(),
      findUnboundParamTokens: jest.fn().mockReturnValue([]),
    };

    controller = new ConfiguredGridSqlController(service as unknown as ConfiguredGridSqlService);
  });

  it('fetches grid columns using only grid id', async () => {
    const columns = [
      {
        grid_column_id: '10',
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

  it('reports an unbound parameter token as a bad request naming the missing grid_param key', async () => {
    // Grid 84: its SQL scopes on `sq_company_id = 'icompany_id'::uuid`, and this request sends no
    // grid_param, so the token reaches Postgres as a literal and the cast fails (SQLSTATE 22P02).
    const baseSql =
      "SELECT sq_id FROM sales.sale_quotation WHERE sq_company_id = 'icompany_id'::uuid";
    service.loadCandidates.mockResolvedValue([{ gridId: 84n, gridSql: baseSql }]);
    service.extractTopLevelFromTableName.mockReturnValue('sale_quotation');
    service.validateBaseSql.mockReturnValue({ isValid: true, normalizedSql: baseSql });
    service.findUnboundParamTokens.mockReturnValue(['icompany_id']);
    service.runPagedQuery.mockRejectedValue(
      Object.assign(new Error('invalid input syntax for type uuid: "icompany_id"'), {
        code: '22P02',
      }),
    );

    await expect(controller.run({ grid_id: '84', page: 1, limit: 15 })).rejects.toThrow(
      new BadRequestException(
        'Grid 84 configured SQL failed: invalid input syntax for type uuid: "icompany_id".' +
          ' Pass a value for icompany_id in grid_param.',
      ),
    );
    expect(service.findUnboundParamTokens).toHaveBeenCalledWith(baseSql);
  });

  it('rethrows a failure that is neither a data nor an access-rule error', async () => {
    const baseSql = 'SELECT sq_id FROM sales.sale_quotation';
    service.loadCandidates.mockResolvedValue([{ gridId: 84n, gridSql: baseSql }]);
    service.extractTopLevelFromTableName.mockReturnValue('sale_quotation');
    service.validateBaseSql.mockReturnValue({ isValid: true, normalizedSql: baseSql });
    const connectionError = Object.assign(new Error('connection terminated'), { code: '08006' });
    service.runPagedQuery.mockRejectedValue(connectionError);

    await expect(controller.run({ grid_id: '84', page: 1, limit: 15 })).rejects.toBe(
      connectionError,
    );
  });
});
