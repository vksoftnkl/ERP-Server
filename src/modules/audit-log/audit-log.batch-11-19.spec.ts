import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService, extractSelectList, maskAuditValue } from './audit-log.service';
import { getAuditScreenSql } from './audit-screen-sql.constants';

/**
 * Review list 11-19, build step 3 (the audit batch): the G1 parser fix, the new label maps
 * (users, devices, charges, settings, print templates / assignments, ledger map), names
 * for ids, the H9 mask, the theme template digest and the same-screen history widening.
 */

const PK = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
const COMPANY_ID = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH_ID = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const EMPLOYEE_ID = '019d6f6c-be87-7a11-8905-36092c46fd21';
const USER_ID = '019d6f6c-be87-7a11-8905-36092c46fd22';
const DEVICE_ID = '019d6f6c-be87-7a11-8905-36092c46fd23';
const LEDGER_ID = '019d6f6c-be87-7a11-8905-36092c46fd24';

type Mock = jest.Mock;
type PrismaMock = Record<string, Record<string, Mock>>;

const labelsOf = (screenName: string): string[] =>
  [...(getAuditScreenSql(screenName) ?? '').matchAll(/AS "([^"]+)"/g)].map((match) => match[1]);

describe('AuditLogService — audit batch (review list 11-19 step 3)', () => {
  let prisma: PrismaMock;
  let service: AuditLogService;

  beforeEach(() => {
    const findMany = () => jest.fn().mockResolvedValue([]);
    prisma = {
      auditScreen: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}), count: jest.fn(), findMany: jest.fn() },
      userMaster: { findMany: findMany() },
      branchMaster: { findMany: findMany() },
      company: { findMany: findMany() },
      employeeMaster: { findMany: findMany() },
      deviceMaster: { findMany: findMany(), findUnique: jest.fn() },
      accLedgerMaster: { findMany: findMany() },
      printTemplateVersion: { findMany: findMany() },
      printTemplateDataset: { findMany: findMany() },
      appSettingValue: { findMany: findMany(), findUnique: jest.fn() },
      accLedgerMap: { findMany: findMany(), findUnique: jest.fn() },
    };
    const requestContext = {
      getIpAddress: jest.fn().mockReturnValue(null),
      getUserId: jest.fn().mockReturnValue(null),
      getDeviceId: jest.fn().mockReturnValue(null),
    };
    service = new AuditLogService(
      prisma as unknown as PrismaService,
      requestContext as unknown as RequestContextService,
    );
  });

  const createdData = (): Record<string, unknown> =>
    (prisma.auditLog.create.mock.calls[0] as [{ data: Record<string, unknown> }])[0].data;

  const logUpdate = async (
    screenName: string,
    originalRecord: Record<string, unknown>,
    modifiedRecord: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 30,
      screenName,
      screenAuditSql: getAuditScreenSql(screenName),
    });
    await service.logEntityChange({
      action: 'update',
      tableName: screenName,
      screenName,
      originalRecord: originalRecord,
      modifiedRecord: modifiedRecord,
      pk: PK,
    });
    return createdData();
  };

  const listOne = async (
    screenName: string,
    row: { original?: unknown; modified?: unknown; changed?: unknown },
  ) => {
    prisma.auditLog.findMany.mockResolvedValue([
      {
        logId: '019c6f6c-be87-7a11-8905-36092c46fd06',
        logDate: new Date('2026-11-19T11:00:00.000Z'),
        logAction: 'update',
        logScreenId: 30,
        logTableName: screenName,
        logPk: PK,
        logDisplayName: 'ZT row',
        logOriginalRecord: row.original ?? null,
        logModifiedRecord: row.modified ?? null,
        logChangedFields: row.changed ?? null,
        logUserId: null,
        logBranchId: null,
        logNotes: null,
        logEntityId: null,
        logRevNo: null,
        logDeviceName: null,
        auditScreen: { screenName },
      },
    ]);
    const result = await service.list({ page: 1, limit: 20 });
    return result.items[0];
  };

  describe('G1: the select list ends at the first FROM outside quotes and brackets', () => {
    it('skips a quoted "… From" label, a string literal and a sub-query', () => {
      const sql = [
        'SELECT',
        '    a.valid_from AS "Valid From",',
        '    (SELECT max(x.d) FROM t x WHERE x.k = a.k) AS "Latest",',
        '    \'from\' AS "Word",',
        '    a.from_rev AS "Fin Year From"',
        'FROM s a',
        'WHERE a.k IN (SELECT k FROM u);',
      ].join('\n');
      expect(extractSelectList(sql)).toBe(
        [
          'a.valid_from AS "Valid From",',
          '    (SELECT max(x.d) FROM t x WHERE x.k = a.k) AS "Latest",',
          '    \'from\' AS "Word",',
          '    a.from_rev AS "Fin Year From"',
        ].join('\n'),
      );
      expect(extractSelectList('SELECT a FROM_x, b FROM t')).toBe('a FROM_x, b');
      expect(extractSelectList('UPDATE t SET a = 1')).toBeNull();
      expect(extractSelectList('SELECT a, b')).toBeNull();
    });

    it('Company Master records every label, the 13 from "Fin Year From" on included', async () => {
      const labels = labelsOf('Company Master');
      const fromFinYear = labels.slice(labels.indexOf('Fin Year From'));
      expect(fromFinYear).toEqual([
        'Fin Year From',
        'Fin Year To',
        'GST Applicable',
        'E-Invoice Applicable',
        'E-Way Applicable',
        'Currency Code',
        'Currency Symbol',
        'Locale Code',
        'Is Default',
        'Is Active',
        'Is Deleted',
        // No Sync Date / Modified On / Modified By since the follow-up (user 11-19).
        'Created On',
        'Created By',
      ]);
      // Neither image is audited: the base64 logo and signature never reach the row.
      expect(getAuditScreenSql('Company Master')).not.toMatch(/comp_logo|comp_authorize_signature/);

      const data = await logUpdate(
        'Company Master',
        {
          compName: 'ZT Traders',
          compFinYearFrom: '2026-04-01',
          compCurrencyCode: 'INR',
          compIsActive: true,
          compAuthorizeSignature: 'data:image/png;base64,AAAA',
        },
        {
          compName: 'ZT Traders',
          compFinYearFrom: '2027-04-01',
          compCurrencyCode: 'USD',
          compIsActive: false,
          compAuthorizeSignature: 'data:image/png;base64,BBBB',
        },
      );
      expect(Object.keys(data.logModifiedRecord as object)).toEqual(labels);
      expect(data.logChangedFields).toEqual({
        'Fin Year From': { from: '2026-04-01', to: '2027-04-01' },
        'Currency Code': { from: 'INR', to: 'USD' },
        'Is Active': { from: true, to: false },
      });
      expect(JSON.stringify(data)).not.toContain('base64');
    });

    it('Item Customer Rate Master records the 10 labels from "Valid From" on', async () => {
      const labels = labelsOf('Item Customer Rate Master');
      // 12 before the follow-up dropped Modified On / Modified By (user 11-19).
      expect(labels.slice(labels.indexOf('Valid From'))).toHaveLength(10);
      const data = await logUpdate(
        'Item Customer Rate Master',
        { csrValidFrom: '2026-01-01', csrValidTo: null, csrRemarks: 'a' },
        { csrValidFrom: '2026-02-01', csrValidTo: '2026-12-31', csrRemarks: 'b' },
      );
      expect(Object.keys(data.logModifiedRecord as object)).toEqual(labels);
      expect(data.logChangedFields).toEqual({
        'Valid From': { from: '2026-01-01', to: '2026-02-01' },
        'Valid To': { from: null, to: '2026-12-31' },
        Remarks: { from: 'a', to: 'b' },
      });
    });

    it('Item Tax History records the 5 labels from "Effective From" on', async () => {
      const labels = labelsOf('Item Tax History');
      expect(labels.slice(labels.indexOf('Effective From'))).toEqual([
        'Effective From',
        'Effective To',
        'Reason',
        'Created On',
        'Created By',
      ]);
      const data = await logUpdate(
        'Item Tax History',
        { ithEffectiveFrom: '2026-01-01', ithReason: null },
        { ithEffectiveFrom: '2026-04-01', ithReason: 'GST change' },
      );
      expect(Object.keys(data.logModifiedRecord as object)).toEqual(labels);
      expect(data.logChangedFields).toEqual({
        'Effective From': { from: '2026-01-01', to: '2026-04-01' },
        Reason: { from: null, to: 'GST change' },
      });
    });
  });

  describe('User Administration (58.12)', () => {
    it('records PIN Set and the rights by menu name, never a hash or the per-save stamps', async () => {
      const labels = labelsOf('User Administration');
      // The sub-query that says what "Menu Rights" holds is parsed as one field.
      expect(labels[labels.length - 1]).toBe('Menu Rights');
      expect(labels).not.toEqual(
        expect.arrayContaining(['Sync Date', 'Modified On', 'Modified By']),
      );

      const data = await logUpdate(
        'User Administration',
        {
          usrLoginName: 'ZT-USER',
          usrCompanyId: COMPANY_ID,
          usrPasswordHash: 'scrypt$salt$hash',
          usrPinHash: 'scrypt$salt$pin',
          pinSet: false,
          usrSyncDate: '2026-11-18T10:00:00.000Z',
          usrModifiedOn: '2026-11-18T10:00:00.000Z',
          menuRights: { 'Sales Bill': 'View, Create, Edit', 'Old Report': 'View' },
        },
        {
          usrLoginName: 'ZT-USER',
          usrCompanyId: COMPANY_ID,
          usrPasswordHash: 'scrypt$salt$hash2',
          usrPinHash: 'scrypt$salt$pin2',
          pinSet: true,
          usrSyncDate: '2026-11-19T10:00:00.000Z',
          usrModifiedOn: '2026-11-19T10:00:00.000Z',
          menuRights: { 'Sales Bill': 'View, Create, Post', 'Day Book': 'View' },
        },
      );
      expect(data.logChangedFields).toEqual({
        'PIN Set': { from: false, to: true },
        'Menu Rights': {
          'Sales Bill': { from: 'View, Create, Edit', to: 'View, Create, Post' },
          'Old Report': { from: 'View', to: null },
          'Day Book': { from: null, to: 'View' },
        },
      });
      expect(JSON.stringify(data)).not.toContain('scrypt');
    });

    it('reads Company / Branch / Employee / Created By as names on the history', async () => {
      prisma.company.findMany.mockResolvedValue([{ compId: COMPANY_ID, compName: 'Acme Foods' }]);
      prisma.branchMaster.findMany.mockResolvedValue([{ brId: BRANCH_ID, brName: 'Coimbatore' }]);
      prisma.employeeMaster.findMany.mockResolvedValue([
        { empId: EMPLOYEE_ID, empName: 'ZT Ravi', empCode: 'ZTR' },
      ]);
      prisma.userMaster.findMany.mockResolvedValue([
        { usrId: USER_ID, usrDisplayName: '', usrLoginName: 'VKPOS' },
      ]);
      const item = await listOne('User Administration', {
        original: {
          'Company ID': COMPANY_ID,
          'Branch ID': BRANCH_ID,
          'Employee ID': EMPLOYEE_ID,
          'Created By': USER_ID,
        },
        changed: { 'Employee ID': { from: null, to: EMPLOYEE_ID } },
      });
      expect(item.log_original_record).toEqual({
        'Company ID': 'Acme Foods',
        'Branch ID': 'Coimbatore',
        'Employee ID': 'ZT Ravi',
        // A blank display name falls back to the login name.
        'Created By': 'VKPOS',
      });
      expect(item.log_changed_fields).toEqual({ 'Employee ID': { from: null, to: 'ZT Ravi' } });
    });
  });

  it('Device List Master shows Company / Branch / User / Device by name', async () => {
    prisma.company.findMany.mockResolvedValue([{ compId: COMPANY_ID, compName: 'Acme Foods' }]);
    prisma.userMaster.findMany.mockResolvedValue([
      { usrId: USER_ID, usrDisplayName: 'Cashier One', usrLoginName: 'C1' },
    ]);
    const item = await listOne('Device List Master', {
      changed: {
        'Company ID': { from: null, to: COMPANY_ID },
        'User ID': { from: null, to: USER_ID },
        'Is Blocked': { from: false, to: true },
      },
    });
    expect(item.log_changed_fields).toEqual({
      'Company ID': { from: null, to: 'Acme Foods' },
      'User ID': { from: null, to: 'Cashier One' },
      'Is Blocked': { from: false, to: true },
    });
    expect(labelsOf('Device List Master')).not.toEqual(
      expect.arrayContaining(['Last IP', 'Last Login', 'Modified On']),
    );
  });

  it('H9: Employee Master history shows PAN and Aadhaar as the last 4 only', async () => {
    expect(maskAuditValue('ABCDE1234F')).toBe('XXXXXX234F');
    expect(maskAuditValue('123412341234')).toBe('XXXXXXXX1234');
    expect(maskAuditValue('123')).toBe('XXX');
    prisma.accLedgerMaster.findMany.mockResolvedValue([
      { ledId: LEDGER_ID, ledName: 'ZT Ravi - Staff Advance' },
    ]);
    const item = await listOne('Employee Master', {
      original: { 'Employee Name': 'ZT Ravi', PAN: 'ABCDE1234F', Aadhaar: null },
      modified: {
        'Employee Name': 'ZT Ravi',
        PAN: 'ABCDE9876F',
        Aadhaar: '123412341234',
        'Staff Advance Ledger': LEDGER_ID,
      },
      changed: {
        PAN: { from: 'ABCDE1234F', to: 'ABCDE9876F' },
        Aadhaar: { from: null, to: '123412341234' },
        'Staff Advance Ledger': { from: null, to: LEDGER_ID },
      },
    });
    expect(item.log_original_record).toEqual({
      'Employee Name': 'ZT Ravi',
      PAN: 'XXXXXX234F',
      Aadhaar: null,
    });
    expect(item.log_changed_fields).toEqual({
      PAN: { from: 'XXXXXX234F', to: 'XXXXXX876F' },
      Aadhaar: { from: null, to: 'XXXXXXXX1234' },
      'Staff Advance Ledger': { from: null, to: 'ZT Ravi - Staff Advance' },
    });
    expect(JSON.stringify(item)).not.toMatch(/ABCDE1234F|ABCDE9876F|123412341234/);
  });

  it('HR step 5: the bank account number is masked like PAN; Is Default is no designation label', async () => {
    const item = await listOne('Employee Master', {
      original: { 'Employee Name': 'ZT Ravi', 'Bank Account No': null, IFSC: null },
      modified: {
        'Employee Name': 'ZT Ravi',
        'Bank Account No': '00112233445566',
        IFSC: 'SBIN0001234',
      },
      changed: {
        'Bank Account No': { from: null, to: '00112233445566' },
        IFSC: { from: null, to: 'SBIN0001234' },
      },
    });
    expect(item.log_changed_fields).toEqual({
      'Bank Account No': { from: null, to: 'XXXXXXXXXX5566' },
      IFSC: { from: null, to: 'SBIN0001234' },
    });
    expect(JSON.stringify(item)).not.toMatch(/00112233445566/);
    expect(labelsOf('Employee Master')).toEqual(
      expect.arrayContaining([
        'UAN',
        'Bank Name',
        'Bank Account No',
        'IFSC',
        'Emergency Contact Name',
        'Emergency Contact Phone',
      ]),
    );
    expect(labelsOf('Employee Designation Master')).not.toContain('Is Default');
  });

  it('HR audit SQL names the real public tables', () => {
    expect(getAuditScreenSql('Employee Master')).toMatch(/FROM public\.employee_master;/);
    expect(getAuditScreenSql('Employee Department Master')).toMatch(
      /FROM public\.employee_departments;/,
    );
    expect(getAuditScreenSql('Employee Designation Master')).toMatch(
      /FROM public\.employee_designations;/,
    );
  });

  describe('Print Template: three tables on one screen', () => {
    it('a revision row records only revision labels; shared stamps come through COALESCE', async () => {
      prisma.auditScreen.findFirst.mockResolvedValue({
        screenId: 90,
        screenName: 'Print Template',
        screenAuditSql: getAuditScreenSql('Print Template'),
      });
      await service.logEntityChange({
        action: 'New',
        tableName: 'print template version',
        screenName: 'Print Template',
        originalRecord: null,
        modifiedRecord: {
          ptvId: PK,
          ptvRevNo: 3,
          ptvStatus: 'DRAFT',
          ptvApprovedBy: null,
          ptvIsDeleted: false,
          ptvCreatedOn: '2026-11-19T10:00:00.000Z',
          ptvCreatedBy: USER_ID,
          ptvModifiedOn: null,
          datasets: [{ ptdId: 'x', ptdSql: 'SELECT 1' }],
        },
        pk: PK,
      });
      expect(createdData().logOriginalRecord).toEqual({
        Revision: 3,
        'Revision Status': 'DRAFT',
        'Approved By': null,
        'Is Deleted': false,
        'Created On': '2026-11-19T10:00:00.000Z',
        'Created By': USER_ID,
      });
    });

    it('History by template id also brings its revisions and datasets (screen_id path)', async () => {
      const ptvId = '019d6f6c-be87-7a11-8905-36092c46fd31';
      const ptdId = '019d6f6c-be87-7a11-8905-36092c46fd32';
      prisma.auditScreen.findFirst.mockResolvedValue({ screenName: 'Print Template' });
      prisma.printTemplateVersion.findMany.mockResolvedValue([{ ptvId }]);
      prisma.printTemplateDataset.findMany.mockResolvedValue([{ ptdId }]);
      prisma.auditLog.findMany.mockResolvedValue([]);
      await service.list({ screen_id: 90, record_pk: PK, page: 1, limit: 20 });
      const where = (prisma.auditLog.findMany.mock.calls[0] as [{ where: unknown }])[0].where;
      expect(where).toEqual({ logScreenId: 90, AND: [{ logPk: { in: [PK, ptvId, ptdId] } }] });
    });
  });

  it('App Settings History takes a setting key and brings every override of it', async () => {
    const a = '019d6f6c-be87-7a11-8905-36092c46fd41';
    const b = '019d6f6c-be87-7a11-8905-36092c46fd42';
    prisma.auditScreen.findFirst.mockResolvedValue({ screenName: 'App Settings' });
    prisma.appSettingValue.findMany.mockResolvedValue([{ asvId: a }, { asvId: b }]);
    prisma.auditLog.findMany.mockResolvedValue([]);
    await service.list({ screen_id: 88, record_pk: 'sales.round_off_step', page: 1, limit: 20 });
    expect(prisma.appSettingValue.findMany).toHaveBeenCalledWith({
      where: { asvSettingKey: 'sales.round_off_step' },
      select: { asvId: true },
    });
    const where = (prisma.auditLog.findMany.mock.calls[0] as [{ where: unknown }])[0].where;
    expect(where).toEqual({
      logScreenId: 88,
      AND: [{ logPk: { in: ['sales.round_off_step', a, b] } }],
    });
  });

  it('Ledger Mapping History takes a role code; the ledger reads as its name', async () => {
    const almId = '019d6f6c-be87-7a11-8905-36092c46fd51';
    prisma.auditScreen.findFirst.mockResolvedValue({ screenName: 'Posting Ledger Map' });
    prisma.accLedgerMap.findMany.mockResolvedValue([{ almId }]);
    prisma.auditLog.findMany.mockResolvedValue([]);
    await service.list({ screen_id: 98, record_pk: 'sales', page: 1, limit: 20 });
    expect(prisma.accLedgerMap.findMany).toHaveBeenCalledWith({
      where: { almRole: 'SALES' },
      select: { almId: true },
    });

    prisma.auditLog.findMany.mockReset();
    prisma.accLedgerMaster.findMany.mockResolvedValue([{ ledId: LEDGER_ID, ledName: 'Sales A/c' }]);
    const item = await listOne('Posting Ledger Map', {
      changed: { Ledger: { from: null, to: LEDGER_ID } },
    });
    expect(item.log_changed_fields).toEqual({ Ledger: { from: null, to: 'Sales A/c' } });
  });

  it('a screen with no same-screen widening keeps the plain record filter', async () => {
    prisma.auditScreen.findFirst.mockResolvedValue({ screenName: 'Device List Master' });
    prisma.auditLog.findMany.mockResolvedValue([]);
    await service.list({ screen_id: 71, record_pk: DEVICE_ID, page: 1, limit: 20 });
    const where = (prisma.auditLog.findMany.mock.calls[0] as [{ where: unknown }])[0].where;
    expect(where).toEqual({ logScreenId: 71, AND: [{ logPk: DEVICE_ID }] });
  });

  it('App Theme Template keeps the stylesheet hash, size and lines, not the text', async () => {
    const labels = labelsOf('App Theme Template');
    expect(labels).toEqual(
      expect.arrayContaining(['Stylesheet Hash', 'Stylesheet Size', 'Stylesheet Lines']),
    );
    expect(labels).not.toContain('Stylesheet');
    const data = await logUpdate(
      'App Theme Template',
      { tplName: 'NEXERP', tplQss: 'x'.repeat(1000), stylesheetHash: 'aa', stylesheetSize: 10 },
      { tplName: 'NEXERP', tplQss: 'y'.repeat(1000), stylesheetHash: 'bb', stylesheetSize: 10 },
    );
    expect(data.logChangedFields).toEqual({ 'Stylesheet Hash': { from: 'aa', to: 'bb' } });
    expect(JSON.stringify(data)).not.toContain('xxxx');
  });
});
