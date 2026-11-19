import { ForbiddenException } from '@nestjs/common';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogAccessService } from './audit-log-access.service';
import { AuditLogService } from './audit-log.service';
import { AUDIT_SCREEN_SQL_BY_NAME, getAuditScreenSql } from './audit-screen-sql.constants';
import { auditScreenMenusOf } from './audit-screen-menus.constants';
import { stylesheetDigest } from './audit-text-digest';
import { ListAuditLogQueryDto } from './dto/list-audit-log-query.dto';

/**
 * Review list 11-19 step 3, the server follow-up (user 2026-11-19): audit read rights,
 * the noise stamps dropped house-wide, the 5 broken label maps, no empty print-template
 * update row, old theme rows read as a hash.
 */

const USER = '019d6f6c-be87-7a11-8905-36092c46fd22';
const PK = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
type Mock = jest.Mock;

const forbiddenCode = async (promise: Promise<unknown>): Promise<string | undefined> => {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(ForbiddenException);
    const body = (error as ForbiddenException).getResponse() as {
      errors?: { code?: string; field?: string }[];
    };
    expect(body.errors?.[0]?.field).toBe('userId');
    return body.errors?.[0]?.code;
  }
  throw new Error('expected a 403');
};

describe('AuditLogAccessService — who may read the audit log', () => {
  let prisma: {
    $queryRaw: Mock;
    auditScreen: { findFirst: Mock; findMany: Mock };
    userMaster: { findFirst: Mock };
  };
  let requestContext: { getUserId: Mock };
  let access: AuditLogAccessService;
  /** menu id → um_can_view, as user_menus holds it for USER. */
  let viewRights: Map<number, boolean>;
  let userType: string;
  const SCREENS = [
    { screenId: 6, screenName: 'Company Master' },
    { screenId: 87, screenName: 'Sale Order' },
    { screenId: 86, screenName: 'Transaction Hold' },
    { screenId: 25, screenName: 'Item Master' },
  ];

  beforeEach(() => {
    viewRights = new Map();
    userType = 'USER';
    prisma = {
      // loadRights (one menu) and the report's "every menu I may view" read.
      $queryRaw: jest.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
        const sql = strings.join('?');
        if (sql.includes('um_menu_id AS menu_id')) {
          return Promise.resolve(
            [...viewRights.entries()].filter(([, v]) => v).map(([menu_id]) => ({ menu_id })),
          );
        }
        const menuId = values[1] as number;
        return Promise.resolve(
          viewRights.has(menuId) ? [{ um_can_view: viewRights.get(menuId) }] : [],
        );
      }),
      auditScreen: {
        findFirst: jest.fn(({ where }: { where: { screenId: number } }) =>
          Promise.resolve(SCREENS.find((s) => s.screenId === where.screenId) ?? null),
        ),
        findMany: jest.fn().mockResolvedValue(SCREENS),
      },
      userMaster: { findFirst: jest.fn(() => Promise.resolve({ usrType: userType })) },
    };
    requestContext = { getUserId: jest.fn().mockReturnValue(USER) };
    access = new AuditLogAccessService(
      prisma as unknown as PrismaService,
      requestContext as unknown as RequestContextService,
    );
  });

  const query = (q: Partial<ListAuditLogQueryDto>): ListAuditLogQueryDto => q;

  it('a History button needs View on the screen menu, not on Audit Logs', async () => {
    viewRights.set(56, true);
    await expect(access.resolveReadScope(query({ screen_id: 6, record_pk: PK }))).resolves.toEqual({
      screenIds: null,
    });
  });

  it('refuses a History button without View on the screen menu: 403 AUDIT_LOG_RIGHT_VIEW', async () => {
    viewRights.set(56, false).set(106, true);
    expect(
      await forbiddenCode(access.resolveReadScope(query({ screen_id: 6, record_pk: PK }))),
    ).toBe('AUDIT_LOG_RIGHT_VIEW');
  });

  it('a SUPER ADMIN without the View row is refused too (no bypass on a menu right)', async () => {
    userType = 'SUPER ADMIN';
    expect(
      await forbiddenCode(access.resolveReadScope(query({ screen_id: 6, record_pk: PK }))),
    ).toBe('AUDIT_LOG_RIGHT_VIEW');
  });

  it('no signed-in user reads nothing', async () => {
    requestContext.getUserId.mockReturnValue(null);
    viewRights.set(56, true);
    expect(
      await forbiddenCode(access.resolveReadScope(query({ screen_id: 6, record_pk: PK }))),
    ).toBe('AUDIT_LOG_RIGHT_VIEW');
  });

  it('a screen on two menus opens with View on either (Sale Order: 11 or 299)', async () => {
    viewRights.set(299, true);
    await expect(access.resolveReadScope(query({ screen_id: 87, record_pk: PK }))).resolves.toEqual(
      { screenIds: null },
    );
    viewRights.set(299, false).set(11, true);
    await expect(access.resolveReadScope(query({ screen_id: 87, record_pk: PK }))).resolves.toEqual(
      { screenIds: null },
    );
    viewRights.set(11, false);
    expect(
      await forbiddenCode(access.resolveReadScope(query({ screen_id: 87, record_pk: PK }))),
    ).toBe('AUDIT_LOG_RIGHT_VIEW');
  });

  it('screen_name is checked like screen_id (the web Item Master trail)', async () => {
    expect(
      await forbiddenCode(
        access.resolveReadScope(query({ screen_name: 'Item Master', record_pk: PK })),
      ),
    ).toBe('AUDIT_LOG_RIGHT_VIEW');
    viewRights.set(29, true);
    await expect(
      access.resolveReadScope(query({ screen_name: 'Item Master', record_pk: PK })),
    ).resolves.toEqual({ screenIds: null });
  });

  it('a screen no menu shows: ADMIN / SUPER ADMIN only', async () => {
    expect(
      await forbiddenCode(access.resolveReadScope(query({ screen_id: 86, record_pk: PK }))),
    ).toBe('AUDIT_LOG_RIGHT_VIEW');
    for (const role of ['ADMIN', 'SUPER ADMIN']) {
      userType = role;
      await expect(
        access.resolveReadScope(query({ screen_id: 86, record_pk: PK })),
      ).resolves.toEqual({ screenIds: null });
    }
    // An unknown screen id is a screen no menu shows.
    userType = 'USER';
    expect(
      await forbiddenCode(access.resolveReadScope(query({ screen_id: 999, record_pk: PK }))),
    ).toBe('AUDIT_LOG_RIGHT_VIEW');
  });

  it('the Audit Logs report needs View on menu 106', async () => {
    viewRights.set(56, true);
    expect(await forbiddenCode(access.resolveReadScope(query({})))).toBe('AUDIT_LOG_RIGHT_VIEW');
  });

  it('the report lists only the screens the caller holds View on; unmapped ones for admins', async () => {
    viewRights.set(106, true).set(56, true).set(299, true);
    await expect(access.resolveReadScope(query({}))).resolves.toEqual({ screenIds: [6, 87] });
    userType = 'ADMIN';
    await expect(access.resolveReadScope(query({}))).resolves.toEqual({ screenIds: [6, 87, 86] });
  });

  it('the report on one screen needs both 106 and the screen menu', async () => {
    viewRights.set(106, true);
    expect(await forbiddenCode(access.resolveReadScope(query({ screen_id: 6 })))).toBe(
      'AUDIT_LOG_RIGHT_VIEW',
    );
    viewRights.set(56, true);
    await expect(access.resolveReadScope(query({ screen_id: 6 }))).resolves.toEqual({
      screenIds: null,
    });
    viewRights.set(106, false);
    expect(await forbiddenCode(access.resolveReadScope(query({ screen_id: 6 })))).toBe(
      'AUDIT_LOG_RIGHT_VIEW',
    );
  });

  it('maps every NexERP History button screen to its menu', () => {
    const expected: [string, number[]][] = [
      ['Item Group Master', [35]],
      ['Item Brand Master', [36]],
      ['Account Group Master', [54]],
      ['Category Master', [240]],
      ['Company Master', [56]],
      ['Branch Master', [191]],
      ['Account Ledger Master', [53]],
      ['State Master', [18]],
      ['City Master', [19]],
      ['Area Master', [20]],
      ['Units Master', [38]],
      ['Item Section Master', [37]],
      ['Godown Location Master', [39]],
      ['Supplier Group Master', [27]],
      ['Employee Designation Master', [71]],
      ['Employee Master', [57]],
      ['Customer Group Master', [21]],
      ['Customer Master', [10]],
      ['Supplier Master', [22]],
      ['Employee Department Master', [70]],
      ['Item Master', [29]],
      ['UI Table Master', [242]],
      ['Opening Stock', [44]],
      ['Promotion Loyalty Points', [67]],
      ['User Administration', [58]],
      ['Device List Master', [239]],
      ['Grid Details', [73]],
      ['Dropdown Details', [77]],
      ['Sale Freight Charges', [130]],
      ['Sale Loading Charges', [177]],
      ['Charge Master', [245]],
      ['Tender Master', [95]],
      ['Sale Order', [11, 299]],
      ['App Settings', [246]],
      ['Promotion Scheme', [247]],
      ['Print Template', [62]],
      ['Print Template Assignments', [248]],
      ['Posting Ledger Map', [250]],
      ['Delivery Challan', [182]],
      ['DC Return', [251]],
      ['Sale Return', [13]],
      ['Item Size Master', [291]],
      ['Item Colour Master', [292]],
      ['Vehicle Master', [125]],
      ['Transporter Master', [149]],
      ['Voucher Types', [303]],
      ['Delivery Note', [305]],
    ];
    for (const [screenName, menus] of expected) {
      expect([screenName, auditScreenMenusOf(screenName)]).toEqual([screenName, menus]);
    }
    expect(auditScreenMenusOf('Transaction Hold')).toBeUndefined();
  });
});

describe('AuditLogService — the follow-up batch', () => {
  let prisma: Record<string, Record<string, Mock>>;
  let service: AuditLogService;

  beforeEach(() => {
    const findMany = () => jest.fn().mockResolvedValue([]);
    prisma = {
      auditScreen: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
      auditLog: { create: jest.fn().mockResolvedValue({}), count: jest.fn(), findMany: jest.fn() },
      userMaster: { findMany: findMany() },
      branchMaster: { findMany: findMany() },
      itemUnitConversion: { findMany: findMany() },
      accTenderType: { findMany: findMany() },
      accLedgerMaster: { findMany: findMany() },
      itemMaster: { findMany: findMany() },
    };
    service = new AuditLogService(
      prisma as unknown as PrismaService,
      {
        getIpAddress: jest.fn().mockReturnValue(null),
        getUserId: jest.fn().mockReturnValue(null),
        getDeviceId: jest.fn().mockReturnValue(null),
      } as unknown as RequestContextService,
    );
  });

  const screenRow = (screenName: string, screenType = 'master') => ({
    screenId: 30,
    screenName,
    screenType,
    screenAuditSql: getAuditScreenSql(screenName) ?? null,
  });
  const created = (): Record<string, unknown> | undefined =>
    (prisma.auditLog.create.mock.calls[0] as [{ data: Record<string, unknown> }] | undefined)?.[0]
      .data;
  const logUpdate = async (
    screenName: string,
    originalRecord: Record<string, unknown>,
    modifiedRecord: Record<string, unknown>,
    extra: { screenType?: string; skipWhenUnchanged?: boolean } = {},
  ) => {
    prisma.auditScreen.findFirst.mockResolvedValue(screenRow(screenName, extra.screenType));
    await service.logEntityChange({
      action: 'update',
      tableName: screenName,
      screenName,
      pk: PK,
      originalRecord,
      modifiedRecord,
      ...(extra.skipWhenUnchanged ? { skipWhenUnchanged: true } : {}),
    });
    return created();
  };
  const listOne = async (
    screenName: string,
    row: { original?: unknown; modified?: unknown; changed?: unknown },
    screenType = 'master',
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
        auditScreen: { screenName, screenType },
      },
    ]);
    const result = await service.list({ page: 1, limit: 20 });
    return result.items[0];
  };

  describe('noise stamps (Sync Date / Modified On / Modified By) are no change', () => {
    it('no label map records them any more; Created On / By stay', () => {
      for (const [screenName, sql] of AUDIT_SCREEN_SQL_BY_NAME) {
        expect([screenName, sql]).toEqual([
          screenName,
          expect.not.stringMatching(/AS "(Sync Date|Modified On|Modified By)"/),
        ]);
      }
      expect(getAuditScreenSql('Company Master')).toContain('AS "Created On"');
      expect(getAuditScreenSql('Company Master')).toContain('AS "Created By"');
    });

    it('a Company save records no stamp, in the records nor in the changed fields', async () => {
      const data = await logUpdate(
        'Company Master',
        { compName: 'ZT A', compSyncDate: 'x1', compModifiedOn: 'm1', compModifiedBy: 'u1' },
        { compName: 'ZT B', compSyncDate: 'x2', compModifiedOn: 'm2', compModifiedBy: 'u2' },
      );
      expect(data?.logChangedFields).toEqual({ 'Company Name': { from: 'ZT A', to: 'ZT B' } });
      expect(JSON.stringify(data?.logModifiedRecord)).not.toMatch(
        /Sync Date|Modified On|Modified By/,
      );
    });

    it('a screen with no label map drops the raw stamps from its changed fields', async () => {
      const data = await logUpdate(
        'Till Masters',
        { tcName: 'A', tcModifiedOn: 'm1', tcUpdatedBy: 'u1', tcSyncDate: 's1' },
        { tcName: 'B', tcModifiedOn: 'm2', tcUpdatedBy: 'u2', tcSyncDate: 's2' },
      );
      expect(data?.logChangedFields).toEqual({ tcName: { from: 'A', to: 'B' } });
    });

    it('a document screen keeps its changed fields whole (History reads its status keys)', async () => {
      const data = await logUpdate(
        'Sale Bill',
        { sbStatus: 'DRAFT', sbModifiedOn: 'm1' },
        { sbStatus: 'POSTED', sbModifiedOn: 'm2' },
        { screenType: 'transaction' },
      );
      expect(data?.logChangedFields).toEqual({
        sbStatus: { from: 'DRAFT', to: 'POSTED' },
        sbModifiedOn: { from: 'm1', to: 'm2' },
      });
    });

    it('the read drops them from older master rows (label or raw), not from documents', async () => {
      const changed = {
        'Company Name': { from: 'A', to: 'B' },
        'Sync Date': { from: 's1', to: 's2' },
        'Modified On': { from: 'm1', to: 'm2' },
        'Modified By': { from: 'u1', to: 'u2' },
        compSyncDate: { from: 's1', to: 's2' },
      };
      const master = await listOne('Company Master', { changed });
      expect(master.log_changed_fields).toEqual({ 'Company Name': { from: 'A', to: 'B' } });
      const doc = await listOne(
        'Sale Bill',
        { changed: { sbModifiedOn: { from: 1, to: 2 } } },
        'transaction',
      );
      expect(doc.log_changed_fields).toEqual({ sbModifiedOn: { from: 1, to: 2 } });
    });
  });

  describe('the 5 broken label maps name real columns and record their field', () => {
    it('Item EAN Code / Item Reorder read the unit from the *_uc_unit_id column', async () => {
      expect(getAuditScreenSql('Item EAN Code Master')).toContain('ean_uc_unit_id AS "Unit ID"');
      expect(getAuditScreenSql('Item Reorder Master')).toContain('ir_uc_unit_id AS "Unit ID"');
      const unit = '019d6f6c-be87-7a11-8905-36092c46fd30';
      const data = await logUpdate(
        'Item EAN Code Master',
        { ean_uc_unit_id: unit, ean_code: '1' },
        { ean_uc_unit_id: unit, ean_code: '2' },
      );
      expect((data?.logModifiedRecord as Record<string, unknown>)['Unit ID']).toBe(unit);
    });

    it('Account Ledger Master names no bank column the ledger table lacks', () => {
      expect(getAuditScreenSql('Account Ledger Master')).not.toMatch(
        /led_holder_name|led_bank_|led_upi_id/,
      );
    });

    it('Tender Master records the tender type (it recorded null for every label)', async () => {
      const data = await logUpdate(
        'Tender Master',
        { tndTypeId: '1', tndName: 'Cash', tndLedgerId: null },
        { tndTypeId: '3', tndName: 'Card', tndLedgerId: null },
      );
      expect(data?.logChangedFields).toEqual({
        'Tender Type ID': { from: '1', to: '3' },
        'Tender Name': { from: 'Cash', to: 'Card' },
      });
    });

    it('Tender Type Master records its name and display name', async () => {
      const data = await logUpdate(
        'Tender Type Master',
        { ttmTypeName: 'CARD', ttmDisplayName: 'Card' },
        { ttmTypeName: 'CARD', ttmDisplayName: 'Card / UPI' },
      );
      expect(data?.logChangedFields).toEqual({
        'Display Name': { from: 'Card', to: 'Card / UPI' },
      });
    });
  });

  describe('skipWhenUnchanged: no changed field, no row', () => {
    it('writes no update row when no recorded label moved', async () => {
      await logUpdate(
        'Print Template',
        { ptlName: 'A4', ptlModifiedOn: 'm1', ptlPublishedRevId: 'r1' },
        { ptlName: 'A4', ptlModifiedOn: 'm2', ptlPublishedRevId: 'r2' },
        { screenType: 'settings', skipWhenUnchanged: true },
      );
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it('still writes the row when a label moved', async () => {
      const data = await logUpdate(
        'Print Template',
        { ptlName: 'A4' },
        { ptlName: 'A4 new' },
        { screenType: 'settings', skipWhenUnchanged: true },
      );
      expect(data?.logChangedFields).toEqual({ 'Template Name': { from: 'A4', to: 'A4 new' } });
    });

    it('without the flag an unchanged save is still logged (every other master)', async () => {
      await logUpdate('Company Master', { compName: 'A' }, { compName: 'A' });
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('old App Theme Template rows read as a hash', () => {
    const OLD = 'QWidget { color: red; }\nQLabel { color: ₹; }\n';
    const NEW = 'QWidget { color: blue; }\nQLabel { color: ₹; }\n';

    it('the whole text in a record reads as Stylesheet Hash / Size / Lines', async () => {
      const row = await listOne('App Theme Template', {
        original: { Template: 'seed', Stylesheet: OLD, Remarks: 'v1' },
        modified: { Template: 'seed', Stylesheet: NEW, Remarks: 'v2' },
        changed: { Remarks: { from: 'v1', to: 'v2' }, Stylesheet: { from: OLD, to: NEW } },
      });
      const digest = stylesheetDigest(NEW);
      expect(row.log_modified_record).toEqual({
        Template: 'seed',
        'Stylesheet Hash': digest.stylesheetHash,
        'Stylesheet Size': digest.stylesheetSize,
        'Stylesheet Lines': digest.stylesheetLines,
        Remarks: 'v2',
      });
      // Only what moved: the hash (and the size, one byte longer); the lines did not.
      expect(row.log_changed_fields).toEqual({
        Remarks: { from: 'v1', to: 'v2' },
        'Stylesheet Hash': {
          from: stylesheetDigest(OLD).stylesheetHash,
          to: digest.stylesheetHash,
        },
        'Stylesheet Size': {
          from: stylesheetDigest(OLD).stylesheetSize,
          to: digest.stylesheetSize,
        },
      });
      expect(JSON.stringify(row)).not.toContain('QWidget');
    });

    it('a new row (already a digest) reads unchanged', async () => {
      const digest = stylesheetDigest(NEW);
      const modified = {
        Template: 'seed',
        'Stylesheet Hash': digest.stylesheetHash,
        'Stylesheet Size': digest.stylesheetSize,
        'Stylesheet Lines': digest.stylesheetLines,
      };
      const row = await listOne('App Theme Template', { modified });
      expect(row.log_modified_record).toEqual(modified);
    });
  });

  it('list(scope) narrows the rows to the screens the caller may read (AND)', async () => {
    prisma.auditLog.findMany.mockResolvedValue([]);
    await service.list(
      { page: 1, limit: 20, search: 'x' },
      {
        screenIds: [6, 87],
      },
    );
    const [args] = prisma.auditLog.findMany.mock.calls[0] as [
      { where: { AND: unknown[]; OR: unknown[] } },
    ];
    expect(args.where.AND).toContainEqual({ logScreenId: { in: [6, 87] } });
    expect(args.where.OR).toBeDefined();
  });
});
