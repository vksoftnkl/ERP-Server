import { AccountLedgerMastersService } from './account-ledger-masters.service';

describe('AccountLedgerMastersService', () => {
  const createService = (): AccountLedgerMastersService =>
    new AccountLedgerMastersService({} as never, {} as never, {} as never);

  it('filters configured grid SQL using quoted output aliases', () => {
    const service = createService();
    const baseSql = [
      'SELECT',
      '  led_id AS "ledId",',
      '  led_company_id AS "ledCompanyId",',
      '  led_group_id AS ledGroupId,',
      '  led_category AS "Category",',
      '  led_is_active AS isActive',
      'FROM accounts.acc_ledger_master',
      'WHERE led_is_deleted = false',
    ].join('\n');

    const result = (service as any).buildConfiguredGridListSql(
      baseSql,
      {
        ledCompanyId: 'company-1',
        ledGroupId: 'group-1',
        ledCategory: 'Customer',
        ledIsActive: true,
      },
      [],
    );

    expect(result).toEqual({
      sql:
        `SELECT * FROM (${baseSql}) AS account_ledger_grid WHERE ` +
        'account_ledger_grid."ledCompanyId" = $1 AND ' +
        'account_ledger_grid."ledgroupid" = $2 AND ' +
        'account_ledger_grid."Category" = $3 AND ' +
        'account_ledger_grid."isactive" = $4',
      params: ['company-1', 'group-1', 'Customer', true],
    });
  });

  it('uses physical column names for wildcard configured grid SQL', () => {
    const service = createService();
    const baseSql = 'SELECT * FROM accounts.acc_ledger_master WHERE led_is_deleted = false';

    const result = (service as any).buildConfiguredGridListSql(
      baseSql,
      {
        ledCompanyId: 'company-1',
        ledIsActive: true,
      },
      [],
    );

    expect(result?.sql).toContain('account_ledger_grid."led_company_id" = $1');
    expect(result?.sql).toContain('account_ledger_grid."led_is_active" = $2');
    expect(result?.params).toEqual(['company-1', true]);
  });

  it('skips configured grid SQL when a required filter column is not exposed', () => {
    const service = createService();
    const baseSql =
      'SELECT led_id AS "ledId", led_name AS "Ledger Name" FROM accounts.acc_ledger_master';

    const result = (service as any).buildConfiguredGridListSql(
      baseSql,
      {
        ledCompanyId: 'company-1',
      },
      [],
    );

    expect(result).toBeNull();
  });

  it('skips configured grid SQL when projection has no usable filter fields', () => {
    const service = createService();
    const baseSql = 'SELECT count(*) AS total FROM accounts.acc_ledger_master';

    const result = (service as any).buildConfiguredGridListSql(
      baseSql,
      {
        ledCompanyId: 'company-1',
      },
      [],
    );

    expect(result).toBeNull();
  });
});
