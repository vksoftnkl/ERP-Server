import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService, extractSelectList } from './audit-log.service';
import {
  AUDIT_SCREENS_RECORDING_PRESENT_FIELDS_ONLY,
  getAuditScreenSql,
} from './audit-screen-sql.constants';
import { auditScreenMenusOf } from './audit-screen-menus.constants';

/**
 * Inventory masters review (user, 2026-11-20): Created / Modified By read as a person on
 * every screen (raw keys too), label maps for GST Rates (rate + ledger lines), Tracking
 * Presets and Stock Reasons, their menus, and a rate's History bringing its lines.
 */

const PK = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
const USER_ID = '019d6f6c-be87-7a11-8905-36092c46fd22';
const OTHER_USER_ID = '019d6f6c-be87-7a11-8905-36092c46fd25';
const LEDGER_ID = '019d6f6c-be87-7a11-8905-36092c46fd24';
const TAX_ID = '019d6f6c-be87-7a11-8905-36092c46fd26';
const LINE_ID = '019d6f6c-be87-7a11-8905-36092c46fd27';

type Mock = jest.Mock;
type PrismaMock = Record<string, Record<string, Mock>>;

const labelsOf = (screenName: string): string[] =>
  [...(getAuditScreenSql(screenName) ?? '').matchAll(/AS "([^"]+)"/g)].map((match) => match[1]);

describe('AuditLogService — inventory masters review 11-20', () => {
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
      accLedgerMaster: { findMany: findMany() },
      taxRateMaster: { findMany: findMany() },
      taxRateLedger: { findMany: findMany() },
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

  const logInsert = async (
    screenName: string,
    modifiedRecord: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    prisma.auditScreen.findFirst.mockResolvedValue({
      screenId: 96,
      screenName,
      screenType: 'master',
      screenAuditSql: getAuditScreenSql(screenName),
    });
    await service.logEntityChange({
      action: 'New',
      tableName: screenName,
      screenName,
      originalRecord: null,
      modifiedRecord,
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
        logDate: new Date('2026-11-20T11:00:00.000Z'),
        logAction: 'update',
        logScreenId: 96,
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
        auditScreen: { screenName, screenType: 'master' },
      },
    ]);
    const result = await service.list({ page: 1, limit: 20 });
    return result.items[0];
  };

  describe('Created / Modified By read as a person, raw keys included', () => {
    beforeEach(() => {
      prisma.userMaster.findMany.mockResolvedValue([
        { usrId: USER_ID, usrDisplayName: 'VK Pos', usrLoginName: 'VKPOS' },
        { usrId: OTHER_USER_ID, usrDisplayName: '', usrLoginName: 'CASHIER2' },
      ]);
    });

    it('an older GST rate row (raw tax_* / trl* keys) shows user names, nested lines too', async () => {
      const item = await listOne('Tax Rate Master', {
        original: {
          tax_name: 'GST 5%',
          tax_created_by: USER_ID,
          tax_modified_by: OTHER_USER_ID,
          lines: [{ trl_role: 'OUTPUT_CGST', trlCreatedBy: USER_ID, trlModifiedBy: 'system' }],
        },
      });
      expect(item.log_original_record).toEqual({
        'Tax Name': 'GST 5%',
        // Labelled by the new map, then named.
        'Created By': 'VK Pos',
        // No label: the raw key stays, its user id reads as a name (login when no display name).
        tax_modified_by: 'CASHIER2',
        lines: [{ trl_role: 'OUTPUT_CGST', trlCreatedBy: 'VK Pos', trlModifiedBy: 'system' }],
      });
    });

    it('works on a screen with no label map, for every *_by stamp the rule names', async () => {
      const item = await listOne('Some Unmapped Screen', {
        original: {
          xyz_approved_by: USER_ID,
          sptCreatedBy: USER_ID,
          abcLockedBy: OTHER_USER_ID,
          row_deleted_by: USER_ID,
          row_cancelled_by: USER_ID,
          standby: USER_ID,
          created_by_device: USER_ID,
        },
      });
      expect(item.log_original_record).toEqual({
        xyz_approved_by: 'VK Pos',
        sptCreatedBy: 'VK Pos',
        abcLockedBy: 'CASHIER2',
        row_deleted_by: 'VK Pos',
        row_cancelled_by: 'VK Pos',
        // Not a stamp: left as stored.
        standby: USER_ID,
        created_by_device: USER_ID,
      });
    });

    it('a stamp that is no user uuid stays as stored', async () => {
      const item = await listOne('Some Unmapped Screen', {
        original: { abc_created_by: 'system', def_modified_by: '019d6f6c-be87-7a11-8905-36092c46fd99' },
      });
      expect(item.log_original_record).toEqual({
        abc_created_by: 'system',
        def_modified_by: '019d6f6c-be87-7a11-8905-36092c46fd99',
      });
    });
  });

  describe('GST Rates: a rate and its ledger lines on one screen', () => {
    it('records each table only under its own labels, no lines array, no modified stamps', async () => {
      expect(AUDIT_SCREENS_RECORDING_PRESENT_FIELDS_ONLY.has('Tax Rate Master')).toBe(true);
      const header = await logInsert('Tax Rate Master', {
        tax_id: TAX_ID,
        tax_name: 'GST 5%',
        tax_code: 'G5',
        tax_rate_perc: 5,
        tax_supersedes_id: null,
        tax_supersedes_name: null,
        tax_is_active: true,
        tax_is_deleted: false,
        tax_sync_date: null,
        tax_created_on: '2026-11-20T05:00:00.000Z',
        tax_created_by: USER_ID,
        tax_modified_on: null,
        tax_modified_by: null,
        lines: [{ trl_id: LINE_ID }],
      });
      expect(header.logOriginalRecord).toEqual({
        'Tax Name': 'GST 5%',
        'Tax Code': 'G5',
        'GST Rate %': 5,
        Supersedes: null,
        'Is Active': true,
        'Is Deleted': false,
        'Created On': '2026-11-20T05:00:00.000Z',
        'Created By': USER_ID,
      });

      prisma.auditLog.create.mockClear();
      const line = await logInsert('Tax Rate Master', {
        trl_id: LINE_ID,
        trl_tax_id: TAX_ID,
        trl_role: 'OUTPUT_CGST',
        trl_role_label: 'Output CGST',
        trl_supply_nature: null,
        trl_ledger_id: LEDGER_ID,
        trl_ledger_name: 'CGST Output',
        trl_remarks: null,
        trl_is_active: false,
        trl_is_deleted: false,
        trl_created_on: '2026-11-20T05:00:00.000Z',
        trl_created_by: USER_ID,
        trl_modified_by: null,
      });
      expect(line.logOriginalRecord).toEqual({
        'Ledger Role': 'OUTPUT_CGST',
        'Supply Nature': null,
        Ledger: LEDGER_ID,
        Remarks: null,
        'Is Active': false,
        'Is Deleted': false,
        'Created On': '2026-11-20T05:00:00.000Z',
        'Created By': USER_ID,
      });
    });

    it('reads Supersedes as the rate name and Ledger as the ledger name', async () => {
      prisma.taxRateMaster.findMany.mockResolvedValue([{ taxId: TAX_ID, taxName: 'GST 5% (old)' }]);
      prisma.accLedgerMaster.findMany.mockResolvedValue([{ ledId: LEDGER_ID, ledName: 'CGST Output' }]);
      const item = await listOne('Tax Rate Master', {
        changed: {
          Supersedes: { from: null, to: TAX_ID },
          Ledger: { from: null, to: LEDGER_ID },
        },
      });
      expect(item.log_changed_fields).toEqual({
        Supersedes: { from: null, to: 'GST 5% (old)' },
        Ledger: { from: null, to: 'CGST Output' },
      });
    });

    it("a rate's History (screen_id path) also brings its lines' rows, removed ones included", async () => {
      prisma.auditScreen.findFirst.mockResolvedValue({ screenName: 'Tax Rate Master' });
      prisma.taxRateLedger.findMany.mockResolvedValue([{ trlId: LINE_ID }]);
      prisma.auditLog.findMany.mockResolvedValue([]);
      await service.list({ screen_id: 96, record_pk: TAX_ID, page: 1, limit: 20 });
      expect(prisma.taxRateLedger.findMany).toHaveBeenCalledWith({
        where: { trlTaxId: TAX_ID },
        select: { trlId: true },
      });
      const where = (prisma.auditLog.findMany.mock.calls[0] as [{ where: unknown }])[0].where;
      expect(where).toEqual({ logScreenId: 96, AND: [{ logPk: { in: [TAX_ID, LINE_ID] } }] });
    });
  });

  describe('Tracking Presets and Stock Reasons', () => {
    it('a preset records its labels from the spt_* columns, never the modified stamps', async () => {
      const data = await logInsert('Stock Track Preset', {
        spt_id: PK,
        spt_code: 'DAIRY',
        spt_name: 'Dairy',
        spt_track_batch: true,
        spt_ageing_basis: 'INWARD_DATE',
        spt_is_active: true,
        spt_created_by: USER_ID,
        spt_modified_by: USER_ID,
      });
      const record = data.logOriginalRecord as Record<string, unknown>;
      expect(record).toMatchObject({
        Code: 'DAIRY',
        Name: 'Dairy',
        'Track Batch': true,
        'Ageing Basis': 'INWARD_DATE',
        'Is Active': true,
        'Created By': USER_ID,
      });
      expect(Object.keys(record)).not.toContain('Modified By');
    });

    it('a stock reason records its labels; the Ledger reads as its name', async () => {
      const data = await logInsert('Stock Reason Master', {
        srm_id: PK,
        srm_code: 'THEFT',
        srm_name: 'Theft',
        srm_direction: 'OUT',
        srm_allowed_txn_types: ['DAMAGE'],
        srm_gl_ledger_id: LEDGER_ID,
        srm_require_remarks: true,
        srm_remarks: 'Shop floor',
        srm_created_by: USER_ID,
      });
      expect(data.logOriginalRecord).toMatchObject({
        Code: 'THEFT',
        Name: 'Theft',
        Way: 'OUT',
        'Used On': ['DAMAGE'],
        Ledger: LEDGER_ID,
        'Remarks Required': true,
        Notes: 'Shop floor',
        'Created By': USER_ID,
      });
      prisma.accLedgerMaster.findMany.mockResolvedValue([{ ledId: LEDGER_ID, ledName: 'Shrinkage' }]);
      const item = await listOne('Stock Reason Master', {
        changed: { Ledger: { from: null, to: LEDGER_ID } },
      });
      expect(item.log_changed_fields).toEqual({ Ledger: { from: null, to: 'Shrinkage' } });
    });

    it('every new label map parses whole (no label holds "from") and names no stamp it drops', () => {
      for (const screen of ['Tax Rate Master', 'Stock Track Preset', 'Stock Reason Master']) {
        const sql = getAuditScreenSql(screen) ?? '';
        const labels = labelsOf(screen);
        expect(labels.length).toBeGreaterThan(8);
        // The parser's select list holds every label.
        const selectList = extractSelectList(sql) ?? '';
        for (const label of labels) {
          expect(selectList).toContain(`"${label}"`);
          expect(label.toLowerCase()).not.toMatch(/\bfrom\b/);
        }
        expect(labels).not.toEqual(
          expect.arrayContaining(['Modified By', 'Modified On', 'Sync Date']),
        );
        expect(labels).toEqual(expect.arrayContaining(['Created On', 'Created By']));
      }
    });

    it('the History buttons read on menus 40, 249 and 293', () => {
      expect(auditScreenMenusOf('Tax Rate Master')).toEqual([40]);
      expect(auditScreenMenusOf('Stock Track Preset')).toEqual([249]);
      expect(auditScreenMenusOf('Stock Reason Master')).toEqual([293]);
    });
  });
});
