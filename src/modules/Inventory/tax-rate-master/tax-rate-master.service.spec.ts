import { ConflictException, HttpException } from '@nestjs/common';
import { Prisma, TaxRateLedger, TaxRateMaster } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import {
  resolveRoleLedgers,
  type ResolvedRoleLedger,
} from '../../accountsModule/ledgerRole/ledger-map.helper';
import { assertNoLiveReferences } from '../utils/master-tree.helper';
import { SaveTaxRateDto } from './dto/save-tax-rate.dto';
import { TaxRateMasterService } from './tax-rate-master.service';
import { TaxRateErrorCode } from './types/tax-rate-error-codes';
import { collectTaxRateLedgerErrors } from './utils/tax-rate-ledger.guard';

// The grid's rules, the reference counter and the resolver each have their own
// tests; here they only have to be asked, and their answers passed on.
jest.mock('./utils/tax-rate-ledger.guard', () => ({ collectTaxRateLedgerErrors: jest.fn() }));
jest.mock('../utils/master-tree.helper', () => ({
  ...jest.requireActual('../utils/master-tree.helper'),
  assertNoLiveReferences: jest.fn(),
}));
jest.mock('../../accountsModule/ledgerRole/ledger-map.helper', () => ({
  ...jest.requireActual('../../accountsModule/ledgerRole/ledger-map.helper'),
  resolveRoleLedgers: jest.fn(),
}));

const lineGuard = collectTaxRateLedgerErrors as jest.MockedFunction<
  typeof collectTaxRateLedgerErrors
>;
const liveReferences = assertNoLiveReferences as jest.MockedFunction<typeof assertNoLiveReferences>;
const resolver = resolveRoleLedgers as jest.MockedFunction<typeof resolveRoleLedgers>;

const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46af01';
const NEW_TAX_ID = '019c6f6c-be87-7a11-8905-36092c46af02';
const B_ID = '019c6f6c-be87-7a11-8905-36092c46af03';
const C_ID = '019c6f6c-be87-7a11-8905-36092c46af04';
const D_ID = '019c6f6c-be87-7a11-8905-36092c46af05';
const MISSING_ID = '019c6f6c-be87-7a11-8905-36092c46af06';
const LINE_1 = '019c6f6c-be87-7a11-8905-36092c46af11';
const LINE_2 = '019c6f6c-be87-7a11-8905-36092c46af12';
const LINE_GONE = '019c6f6c-be87-7a11-8905-36092c46af13';
const OTHER_RATE_LINE = '019c6f6c-be87-7a11-8905-36092c46af14';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46af21';
const OTHER_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46af22';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46af31';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46af32';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46af41';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');

const rateRow = (overrides: Partial<TaxRateMaster> = {}): TaxRateMaster => ({
  taxId: TAX_ID,
  taxName: 'GST 18%',
  taxCode: 'GST18',
  taxSortOrder: 0,
  taxTaxability: 'TAXABLE',
  taxIsReverseCharge: false,
  taxRatePerc: new Prisma.Decimal(18),
  taxCgstPerc: new Prisma.Decimal(9),
  taxSgstPerc: new Prisma.Decimal(9),
  taxIgstPerc: new Prisma.Decimal(18),
  taxCessBasis: 'NONE',
  taxCessPerc: new Prisma.Decimal(0),
  taxCessPerUnit: new Prisma.Decimal(0),
  taxAcessBasis: 'NONE',
  taxAcessPerc: new Prisma.Decimal(0),
  taxAcessPerUnit: new Prisma.Decimal(0),
  taxSupersedesId: null,
  taxIsActive: true,
  taxIsDeleted: false,
  taxSyncDate: null,
  taxCreatedOn: CREATED_ON,
  taxCreatedBy: USER_ID,
  taxModifiedOn: null,
  taxModifiedBy: null,
  ...overrides,
});

const lineRow = (overrides: Partial<TaxRateLedger> = {}): TaxRateLedger => ({
  trlId: LINE_1,
  trlTaxId: TAX_ID,
  trlRole: 'OUTPUT_CGST',
  trlSupplyNature: null,
  trlLedgerId: LEDGER_ID,
  trlRemarks: null,
  trlIsActive: true,
  trlIsDeleted: false,
  trlSyncDate: null,
  trlCreatedOn: CREATED_ON,
  trlCreatedBy: USER_ID,
  trlModifiedOn: null,
  trlModifiedBy: null,
  ...overrides,
});

/** The body as the ValidationPipe hands it over: DTO instances all the way down. */
const dtoOf = (plain: Record<string, unknown>) => plainToInstance(SaveTaxRateDto, plain);

const defined = (data: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined));

const knownError = (code: string, meta?: Record<string, unknown>) =>
  new Prisma.PrismaClientKnownRequestError(`Prisma ${code}`, {
    code,
    clientVersion: 'test',
    meta,
  });

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

const errorsOf = (refusal: { body: unknown }) =>
  (refusal.body as { errors: Array<{ field: string; code: string; message: string }> }).errors;

/**
 * Prisma over two maps — enough of tax_rate_master and tax_rate_ledger for the
 * service to read back what it wrote, inside one "transaction".
 */
const makeStore = () => {
  const rates = new Map<string, TaxRateMaster>();
  const lines = new Map<string, TaxRateLedger>();
  let nextLine = 0;
  const clashes: { name: object | null; code: object | null } = { name: null, code: null };

  const liveLinesOf = (taxId: string) =>
    [...lines.values()].filter((line) => line.trlTaxId === taxId && !line.trlIsDeleted);

  const prisma = {
    taxRateMaster: {
      findFirst: jest.fn(
        async ({
          where,
          include,
        }: {
          where: { taxId: string; taxIsDeleted?: boolean };
          include?: unknown;
        }) => {
          const row = rates.get(where.taxId);
          if (!row || (where.taxIsDeleted === false && row.taxIsDeleted)) return null;
          return include
            ? { ...row, supersedes: null, ledgerOverrides: liveLinesOf(row.taxId) }
            : row;
        },
      ),
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = rateRow({ taxId: NEW_TAX_ID, ...defined(data) } as Partial<TaxRateMaster>);
        rates.set(row.taxId, row);
        return row;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { taxId: string }; data: Record<string, unknown> }) => {
          const row = { ...rates.get(where.taxId)!, ...defined(data) } as TaxRateMaster;
          rates.set(row.taxId, row);
          return row;
        },
      ),
    },
    taxRateLedger: {
      findFirst: jest.fn(
        async ({ where }: { where: { trlId: string; trlTaxId: string } }) =>
          liveLinesOf(where.trlTaxId).find((line) => line.trlId === where.trlId) ?? null,
      ),
      findMany: jest.fn(
        async ({ where }: { where: { trlTaxId: string; trlId: { notIn: string[] } } }) =>
          liveLinesOf(where.trlTaxId).filter((line) => !where.trlId.notIn.includes(line.trlId)),
      ),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        nextLine += 1;
        const row = lineRow({
          trlId: `019c6f6c-be87-7a11-8905-36092c46b0${String(nextLine).padStart(2, '0')}`,
          ...defined(data),
        } as Partial<TaxRateLedger>);
        lines.set(row.trlId, row);
        return row;
      }),
      update: jest.fn(
        async ({ where, data }: { where: { trlId: string }; data: Record<string, unknown> }) => {
          const row = { ...lines.get(where.trlId)!, ...defined(data) } as TaxRateLedger;
          lines.set(row.trlId, row);
          return row;
        },
      ),
    },
    accLedgerRole: { findMany: jest.fn().mockResolvedValue([]) },
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('lower(tax_name)')) {
        return clashes.name ? [clashes.name] : [];
      }
      if (sql.includes('lower(tax_code)')) {
        return clashes.code ? [clashes.code] : [];
      }
      throw new Error(`unexpected raw query with ${values.length} values`);
    }),
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) =>
    callback(prisma),
  );
  return { prisma, rates, lines, clashes };
};

describe('TaxRateMasterService', () => {
  let store: ReturnType<typeof makeStore>;
  let prisma: ReturnType<typeof makeStore>['prisma'];
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: TaxRateMasterService;

  beforeEach(() => {
    store = makeStore();
    prisma = store.prisma;
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    lineGuard.mockReset();
    lineGuard.mockResolvedValue([]);
    liveReferences.mockReset();
    liveReferences.mockResolvedValue(undefined);
    resolver.mockReset();
    service = new TaxRateMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
    );
  });

  const audits = () =>
    audit.logEntityChange.mock.calls.map(([entry]) => entry as Record<string, unknown>);
  const rawQueryValues = (column: 'tax_name' | 'tax_code') =>
    prisma.$queryRaw.mock.calls
      .filter(([strings]) => (strings as TemplateStringsArray).join('?').includes(column))
      .map(([, ...values]) => values);

  // ── §1 read ───────────────────────────────────────────────────────────────
  describe('getById', () => {
    it('answers the live rate with its editable lines, a deactivated one included', async () => {
      store.rates.set(TAX_ID, rateRow());
      store.lines.set(LINE_1, lineRow());
      store.lines.set(LINE_2, lineRow({ trlId: LINE_2, trlRole: 'SALES', trlIsActive: false }));
      store.lines.set(LINE_GONE, lineRow({ trlId: LINE_GONE, trlIsDeleted: true }));

      const payload = await service.getById(TAX_ID);

      expect(prisma.taxRateMaster.findFirst).toHaveBeenCalledWith({
        where: { taxId: TAX_ID, taxIsDeleted: false },
        include: {
          supersedes: { select: { taxName: true } },
          ledgerOverrides: {
            where: { trlIsDeleted: false },
            orderBy: [{ trlRole: 'asc' }, { trlSupplyNature: 'asc' }, { trlId: 'asc' }],
            include: {
              role: { select: { alrLabel: true } },
              ledger: { select: { ledName: true } },
            },
          },
        },
      });
      expect(payload).toMatchObject({ tax_id: TAX_ID, tax_rate_perc: 18, tax_cgst_perc: 9 });
      expect(payload.lines.map((line) => [line.trl_id, line.trl_is_active])).toEqual([
        [LINE_1, true],
        [LINE_2, false],
      ]);
    });

    it.each([
      ['a rate that does not exist', null],
      ['a deleted rate', rateRow({ taxIsDeleted: true })],
    ])('refuses %s with a 404', async (_label, row) => {
      if (row) store.rates.set(TAX_ID, row);

      const refusal = await refusalOf(service.getById(TAX_ID));

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Tax rate not found',
          errors: [
            {
              field: 'tax_id',
              code: TaxRateErrorCode.NOT_FOUND,
              message: `tax_id ${TAX_ID} was not found`,
            },
          ],
        },
      });
    });
  });

  describe('list', () => {
    const findManyArgs = () =>
      prisma.taxRateMaster.findMany.mock.calls[0][0] as {
        where: Record<string, unknown>;
        orderBy: unknown;
        include: Record<string, unknown>;
      };

    it('offers live, active rates with their live, active lines by default', async () => {
      prisma.taxRateMaster.findMany.mockResolvedValue([
        { ...rateRow(), ledgerOverrides: [lineRow()] },
      ]);

      const payloads = await service.list({});

      expect(findManyArgs()).toEqual({
        where: { taxIsDeleted: false, taxIsActive: true },
        orderBy: [{ taxSortOrder: 'asc' }, { taxName: 'asc' }, { taxId: 'asc' }],
        include: {
          supersedes: { select: { taxName: true } },
          ledgerOverrides: {
            where: { trlIsDeleted: false, trlIsActive: true },
            orderBy: [{ trlRole: 'asc' }, { trlSupplyNature: 'asc' }, { trlId: 'asc' }],
            include: {
              role: { select: { alrLabel: true } },
              ledger: { select: { ledName: true } },
            },
          },
        },
      });
      expect(payloads).toEqual([
        expect.objectContaining({
          tax_id: TAX_ID,
          lines: [expect.objectContaining({ trl_id: LINE_1 })],
        }),
      ]);
    });

    it('lets a maintenance screen see inactive rates, but never deleted ones', async () => {
      await service.list({ active_only: false });

      expect(findManyArgs().where).toEqual({ taxIsDeleted: false });
    });

    it('narrows by taxability, by rate (0 included) and by a trimmed search', async () => {
      await service.list({ tax_taxability: 'EXEMPT', tax_rate_perc: 0, search: '  18  ' });

      expect(findManyArgs().where).toEqual({
        taxIsDeleted: false,
        taxIsActive: true,
        taxTaxability: 'EXEMPT',
        taxRatePerc: 0,
        OR: [
          { taxName: { contains: '18', mode: 'insensitive' } },
          { taxCode: { contains: '18', mode: 'insensitive' } },
        ],
      });
    });

    it('ignores a blank search', async () => {
      await service.list({ search: '   ' });

      expect(findManyArgs().where).not.toHaveProperty('OR');
    });
  });

  describe('resolveLedgers', () => {
    const ROLES = [
      { alrRole: 'SALES', alrLabel: 'Sales', alrGroup: 'REVENUE' },
      { alrRole: 'OUTPUT_CGST', alrLabel: 'Output CGST', alrGroup: 'TAX' },
      { alrRole: 'OUTPUT_CESS', alrLabel: 'Output cess', alrGroup: 'TAX' },
    ];
    const answer = (
      role: string,
      source: ResolvedRoleLedger['source'],
      ledgerName: string,
    ): ResolvedRoleLedger => ({
      role,
      roleLabel: role,
      ledgerId: LEDGER_ID,
      ledgerName,
      supplyNature: null,
      source,
      sourceRowId: `${role}-row`,
    });

    beforeEach(() => {
      store.rates.set(TAX_ID, rateRow());
      prisma.accLedgerRole.findMany.mockResolvedValue(ROLES);
    });

    it('answers every per-rate role: OVERRIDE, DEFAULT, or UNMAPPED when nothing answers', async () => {
      resolver.mockResolvedValue(
        new Map([
          [`SALES|${TAX_ID}|*`, answer('SALES', 'LEDGER_MAP', 'Sales Account')],
          [`OUTPUT_CGST|${TAX_ID}|*`, answer('OUTPUT_CGST', 'TAX_RATE', 'CGST Output 9%')],
          [`OUTPUT_CESS|${TAX_ID}|*`, null],
        ]),
      );

      const resolution = await service.resolveLedgers({ tax_id: TAX_ID });

      expect(prisma.accLedgerRole.findMany).toHaveBeenCalledWith({
        where: { alrByRate: true, alrIsActive: true },
        orderBy: [{ alrSortOrder: 'asc' }, { alrRole: 'asc' }],
        select: { alrRole: true, alrLabel: true, alrGroup: true },
      });
      expect(resolver).toHaveBeenCalledWith(
        prisma,
        ROLES.map((role) => ({
          role: role.alrRole,
          taxId: TAX_ID,
          supplyNature: null,
          field: role.alrRole,
        })),
        { companyId: null, branchId: null, where: 'tax_rate_master' },
      );
      expect(resolution).toEqual({
        tax_id: TAX_ID,
        tax_name: 'GST 18%',
        supply_nature: null,
        roles: [
          {
            role: 'SALES',
            role_label: 'Sales',
            role_group: 'REVENUE',
            supply_nature: null,
            ledger_id: LEDGER_ID,
            ledger_name: 'Sales Account',
            source: 'DEFAULT',
            source_row_id: 'SALES-row',
          },
          expect.objectContaining({
            role: 'OUTPUT_CGST',
            ledger_name: 'CGST Output 9%',
            source: 'OVERRIDE',
          }),
          {
            role: 'OUTPUT_CESS',
            role_label: 'Output cess',
            role_group: 'TAX',
            supply_nature: null,
            ledger_id: null,
            ledger_name: null,
            source: 'UNMAPPED',
            source_row_id: null,
          },
        ],
      });
    });

    it('asks about the supply nature and scope it was given, and echoes the nature back', async () => {
      resolver.mockResolvedValue(new Map());

      const resolution = await service.resolveLedgers({
        tax_id: TAX_ID,
        supply_nature: 'INTRA',
        company_id: COMPANY_ID,
        branch_id: BRANCH_ID,
      });

      expect(resolver).toHaveBeenCalledWith(
        prisma,
        expect.arrayContaining([expect.objectContaining({ supplyNature: 'INTRA' })]),
        { companyId: COMPANY_ID, branchId: BRANCH_ID, where: 'tax_rate_master' },
      );
      expect(resolution.supply_nature).toBe('INTRA');
      expect(resolution.roles.every((role) => role.source === 'UNMAPPED')).toBe(true);
    });

    it('refuses a supply nature that is neither INTRA nor INTER before resolving anything', async () => {
      const refusal = await refusalOf(
        service.resolveLedgers({ tax_id: TAX_ID, supply_nature: 'EXPORT' }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'supply_nature', code: TaxRateErrorCode.SUPPLY_NATURE_INVALID }],
        },
      });
      expect(prisma.accLedgerRole.findMany).not.toHaveBeenCalled();
      expect(resolver).not.toHaveBeenCalled();
    });

    it('refuses a rate that is missing or deleted', async () => {
      store.rates.set(TAX_ID, rateRow({ taxIsDeleted: true }));

      const refusal = await refusalOf(service.resolveLedgers({ tax_id: TAX_ID }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: TaxRateErrorCode.NOT_FOUND }] },
      });
    });
  });

  // ── §2 create ─────────────────────────────────────────────────────────────
  describe('save — create (no tax_id)', () => {
    it('writes the header, audits it before each line it carries, and answers re-read', async () => {
      const payload = await service.save(
        dtoOf({
          tax_name: 'GST 18%',
          tax_code: 'GST18',
          tax_rate_perc: 18,
          lines: [{ trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID }],
        }),
      );

      expect(prisma.taxRateMaster.create).toHaveBeenCalledWith({
        data: {
          taxName: 'GST 18%',
          taxCreatedBy: USER_ID,
          taxCode: 'GST18',
          taxRatePerc: 18,
        },
      });
      expect(lineGuard).toHaveBeenCalledWith(
        prisma,
        [expect.objectContaining({ trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID })],
        { companyId: null },
      );
      expect(prisma.taxRateLedger.create).toHaveBeenCalledWith({
        data: {
          trlTaxId: NEW_TAX_ID,
          trlRole: 'OUTPUT_CGST',
          trlSupplyNature: null,
          trlLedgerId: LEDGER_ID,
          trlRemarks: null,
          trlCreatedBy: USER_ID,
        },
        include: expect.any(Object),
      });
      expect(audits()).toEqual([
        expect.objectContaining({
          action: 'insert',
          tableName: 'tax rate master',
          screenName: 'Tax Rate Master',
          screenType: 'master',
          pk: NEW_TAX_ID,
          displayName: 'GST 18%',
          originalRecord: null,
          modifiedRecord: expect.objectContaining({ tax_id: NEW_TAX_ID, lines: [] }),
          userId: USER_ID,
          notes: 'Tax rate created',
        }),
        expect.objectContaining({
          action: 'insert',
          tableName: 'tax rate ledger',
          displayName: 'OUTPUT_CGST',
          originalRecord: null,
          notes: 'Tax rate ledger line created',
        }),
      ]);
      expect(payload).toMatchObject({ tax_id: NEW_TAX_ID, tax_name: 'GST 18%' });
      expect(payload.lines).toEqual([
        expect.objectContaining({ trl_tax_id: NEW_TAX_ID, trl_role: 'OUTPUT_CGST' }),
      ]);
    });

    it('checks the name and the code against every live rate', async () => {
      await service.save(dtoOf({ tax_name: 'GST 18%', tax_code: 'gst18' }));

      expect(rawQueryValues('tax_name')).toEqual([['GST 18%', null, null]]);
      expect(rawQueryValues('tax_code')).toEqual([['gst18', null, null]]);
    });

    it('does not look for a code clash when no code is sent', async () => {
      await service.save(dtoOf({ tax_name: 'GST 18%' }));

      expect(rawQueryValues('tax_code')).toEqual([]);
    });

    it('refuses a name another live rate holds, and writes nothing', async () => {
      store.clashes.name = { taxId: B_ID, taxName: 'gst 18%' };

      const refusal = await refusalOf(service.save(dtoOf({ tax_name: 'GST 18%' })));

      expect(refusal).toEqual({
        status: 409,
        body: {
          success: false,
          message: 'Tax rate name already exists',
          errors: [
            {
              field: 'tax_name',
              code: TaxRateErrorCode.NAME_TAKEN,
              message: `"gst 18%" is already in use by rate ${B_ID}`,
            },
          ],
        },
      });
      expect(prisma.taxRateMaster.create).not.toHaveBeenCalled();
    });

    it('refuses a code another live rate holds', async () => {
      store.clashes.code = { taxId: B_ID, taxCode: 'GST18' };

      const refusal = await refusalOf(
        service.save(dtoOf({ tax_name: 'GST 18%', tax_code: 'GST18' })),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          message: 'Tax rate code already exists',
          errors: [{ field: 'tax_code', code: TaxRateErrorCode.CODE_TAKEN }],
        },
      });
    });

    it('refuses a superseded rate that does not exist', async () => {
      const refusal = await refusalOf(
        service.save(dtoOf({ tax_name: 'GST 18%', tax_supersedes_id: MISSING_ID })),
      );

      expect(refusal).toEqual({
        status: 404,
        body: {
          success: false,
          message: 'Superseded tax rate not found',
          errors: [
            {
              field: 'tax_supersedes_id',
              code: TaxRateErrorCode.SUPERSEDED_NOT_FOUND,
              message: `tax_supersedes_id ${MISSING_ID} was not found`,
            },
          ],
        },
      });
    });

    it('may name a deleted rate as the one it replaced', async () => {
      store.rates.set(B_ID, rateRow({ taxId: B_ID, taxName: 'GST 12%', taxIsDeleted: true }));

      await service.save(dtoOf({ tax_name: 'GST 18%', tax_supersedes_id: B_ID }));

      expect(prisma.taxRateMaster.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ taxSupersedesId: B_ID }) as object,
      });
    });

    it('writes every header field it is sent', async () => {
      await service.save(
        dtoOf({
          tax_name: 'GST 28% + cess',
          tax_code: 'GST28C',
          tax_sort_order: 7,
          tax_taxability: 'taxable',
          tax_is_reverse_charge: true,
          tax_rate_perc: 28,
          tax_cess_basis: 'PERCENT',
          tax_cess_perc: 12,
          tax_cess_per_unit: 0,
          tax_acess_basis: 'BOTH',
          tax_acess_perc: 1,
          tax_acess_per_unit: 400,
          tax_is_active: false,
        }),
      );

      expect(prisma.taxRateMaster.create).toHaveBeenCalledWith({
        data: {
          taxName: 'GST 28% + cess',
          taxCreatedBy: USER_ID,
          taxCode: 'GST28C',
          taxSortOrder: 7,
          taxTaxability: 'TAXABLE',
          taxIsReverseCharge: true,
          taxRatePerc: 28,
          taxCessBasis: 'PERCENT',
          taxCessPerc: 12,
          taxCessPerUnit: 0,
          taxAcessBasis: 'BOTH',
          taxAcessPerc: 1,
          taxAcessPerUnit: 400,
          taxIsActive: false,
        },
      });
    });

    it('takes the creator named in the body, and audits as the request user', async () => {
      await service.save(dtoOf({ tax_name: 'GST 18%', tax_created_by: 'importer' }));

      expect(prisma.taxRateMaster.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ taxCreatedBy: 'importer' }) as object,
      });
      expect(audits()[0].userId).toBe(USER_ID);
    });

    it('audits as the default actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.save(dtoOf({ tax_name: 'GST 18%' }));

      expect(prisma.taxRateMaster.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ taxCreatedBy: DEFAULT_ACTOR }) as object,
      });
      expect(audits()[0].userId).toBe(DEFAULT_ACTOR);
    });

    it('ignores an explicit null on a column that has a default', async () => {
      await service.save(dtoOf({ tax_name: 'GST 18%', tax_is_active: null, tax_taxability: null }));

      const { data } = prisma.taxRateMaster.create.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).not.toHaveProperty('taxIsActive');
      expect(data).not.toHaveProperty('taxTaxability');
    });

    it('returns header and grid errors together, and writes nothing', async () => {
      const lineError = {
        field: 'lines.0.trl_role',
        code: TaxRateErrorCode.LINE_ROLE_NOT_PER_RATE,
        message: 'Round off has one answer',
      };
      lineGuard.mockResolvedValue([lineError]);

      const refusal = await refusalOf(
        service.save(
          dtoOf({
            tax_rate_perc: 150,
            lines: [{ trl_role: 'ROUND_OFF', trl_ledger_id: LEDGER_ID }],
          }),
        ),
      );

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal).map((error) => error.code)).toEqual([
        TaxRateErrorCode.NAME_REQUIRED,
        TaxRateErrorCode.PERC_OUT_OF_RANGE,
        TaxRateErrorCode.LINE_ROLE_NOT_PER_RATE,
      ]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(prisma.taxRateMaster.create).not.toHaveBeenCalled();
    });

    // ── the header's CHECKs, restated ──
    it.each([
      ['no name', { tax_name: '   ' }, 'tax_name', TaxRateErrorCode.NAME_REQUIRED],
      [
        'an unknown taxability',
        { tax_taxability: 'mixed' },
        'tax_taxability',
        TaxRateErrorCode.TAXABILITY_INVALID,
      ],
      [
        'a rate above 100',
        { tax_rate_perc: 100.5 },
        'tax_rate_perc',
        TaxRateErrorCode.PERC_OUT_OF_RANGE,
      ],
      [
        'a negative rate',
        { tax_rate_perc: -1 },
        'tax_rate_perc',
        TaxRateErrorCode.PERC_OUT_OF_RANGE,
      ],
      [
        'an unknown cess basis',
        { tax_cess_basis: 'sometimes' },
        'tax_cess_basis',
        TaxRateErrorCode.CESS_BASIS_INVALID,
      ],
      [
        'an unknown additional-cess basis',
        { tax_acess_basis: 'x' },
        'tax_acess_basis',
        TaxRateErrorCode.CESS_BASIS_INVALID,
      ],
      [
        'a negative cess percentage',
        { tax_cess_basis: 'PERCENT', tax_cess_perc: -1 },
        'tax_cess_perc',
        TaxRateErrorCode.CESS_NEGATIVE,
      ],
      [
        'a negative additional cess per unit',
        { tax_acess_basis: 'PER_UNIT', tax_acess_per_unit: -2 },
        'tax_acess_per_unit',
        TaxRateErrorCode.CESS_NEGATIVE,
      ],
      [
        'a PERCENT cess with no percentage',
        { tax_cess_basis: 'PERCENT' },
        'tax_cess_perc',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
      [
        'a cess percentage with basis NONE',
        { tax_cess_perc: 2 },
        'tax_cess_perc',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
      [
        'a PER_UNIT cess with no per-unit figure',
        { tax_cess_basis: 'PER_UNIT' },
        'tax_cess_per_unit',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
      [
        'a PER_UNIT cess that also has a percentage',
        { tax_cess_basis: 'PER_UNIT', tax_cess_per_unit: 1, tax_cess_perc: 2 },
        'tax_cess_perc',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
      [
        'a BOTH cess missing its per-unit figure',
        { tax_cess_basis: 'BOTH', tax_cess_perc: 2 },
        'tax_cess_per_unit',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
      [
        'a PERCENT additional cess with no percentage',
        { tax_acess_basis: 'PERCENT' },
        'tax_acess_perc',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
      [
        'an additional cess per unit with basis NONE',
        { tax_acess_per_unit: 1 },
        'tax_acess_per_unit',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
      [
        'an EXEMPT rate that charges a rate',
        { tax_taxability: 'EXEMPT', tax_rate_perc: 5 },
        'tax_taxability',
        TaxRateErrorCode.EXEMPT_NOT_ZERO,
      ],
      [
        'a NIL_RATED rate that charges cess',
        {
          tax_taxability: 'NIL_RATED',
          tax_rate_perc: 0,
          tax_cess_basis: 'PERCENT',
          tax_cess_perc: 1,
        },
        'tax_taxability',
        TaxRateErrorCode.EXEMPT_NOT_ZERO,
      ],
      [
        'a NON_GST rate that charges additional cess',
        {
          tax_taxability: 'NON_GST',
          tax_rate_perc: 0,
          tax_acess_basis: 'PER_UNIT',
          tax_acess_per_unit: 1,
        },
        'tax_taxability',
        TaxRateErrorCode.EXEMPT_NOT_ZERO,
      ],
    ])('refuses %s', async (_label, overrides, field, code) => {
      const refusal = await refusalOf(service.save(dtoOf({ tax_name: 'GST X', ...overrides })));

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toContainEqual(expect.objectContaining({ field, code }));
      expect(prisma.taxRateMaster.create).not.toHaveBeenCalled();
    });

    it.each([
      [
        'a ZERO_RATED export rate that still carries cess',
        {
          tax_taxability: 'ZERO_RATED',
          tax_rate_perc: 0,
          tax_cess_basis: 'PERCENT',
          tax_cess_perc: 1,
        },
      ],
      ['an EXEMPT rate that charges nothing', { tax_taxability: 'exempt', tax_rate_perc: 0 }],
      [
        'a BOTH cess with both figures',
        { tax_cess_basis: 'both', tax_cess_perc: 1, tax_cess_per_unit: 0.5 },
      ],
      ['the top rate of 100', { tax_rate_perc: 100 }],
    ])('accepts %s', async (_label, overrides) => {
      await expect(service.save(dtoOf({ tax_name: 'GST X', ...overrides }))).resolves.toMatchObject(
        {
          tax_id: NEW_TAX_ID,
        },
      );
    });

    it.each([
      ['tax_code', { target: ['tax_code'] }, 409, TaxRateErrorCode.DUPLICATE],
      [
        'tax_supersedes_id',
        { target: 'fk_tax_supersedes' },
        400,
        TaxRateErrorCode.REFERENCE_NOT_FOUND,
      ],
    ])('turns a database refusal on %s into a coded answer', async (field, meta, status, code) => {
      prisma.taxRateMaster.create.mockRejectedValue(
        knownError(status === 409 ? 'P2002' : 'P2003', meta),
      );

      const refusal = await refusalOf(service.save(dtoOf({ tax_name: 'GST 18%' })));

      expect(refusal).toMatchObject({ status, body: { errors: [{ field, code }] } });
    });

    it('rethrows any other database failure untouched', async () => {
      const failure = new Error('connection reset');
      prisma.taxRateMaster.create.mockRejectedValue(failure);

      await expect(service.save(dtoOf({ tax_name: 'GST 18%' }))).rejects.toBe(failure);
    });
  });

  // ── §2 update ─────────────────────────────────────────────────────────────
  describe('save — update (tax_id present)', () => {
    beforeEach(() => {
      store.rates.set(TAX_ID, rateRow());
    });

    const updatedData = () =>
      (prisma.taxRateMaster.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;

    it.each([
      ['a rate that does not exist', MISSING_ID],
      ['a deleted rate', 'deleted'],
    ])('refuses %s with a 404', async (_label, id) => {
      if (id === 'deleted') store.rates.set(TAX_ID, rateRow({ taxIsDeleted: true }));

      const refusal = await refusalOf(
        service.save(dtoOf({ tax_id: id === 'deleted' ? TAX_ID : id, tax_name: 'X' })),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'tax_id', code: TaxRateErrorCode.NOT_FOUND }] },
      });
      expect(prisma.taxRateMaster.update).not.toHaveBeenCalled();
    });

    it('writes only what the body carries, as the request user, and audits before and after', async () => {
      const payload = await service.save(
        dtoOf({ tax_id: TAX_ID, tax_rate_perc: 28, tax_name: 'GST 28%' }),
      );

      expect(prisma.taxRateMaster.update).toHaveBeenCalledWith({
        where: { taxId: TAX_ID },
        data: {
          taxModifiedOn: expect.any(Date),
          taxModifiedBy: USER_ID,
          taxName: 'GST 28%',
          taxRatePerc: 28,
        },
      });
      expect(audits()).toEqual([
        expect.objectContaining({
          action: 'update',
          tableName: 'tax rate master',
          pk: TAX_ID,
          displayName: 'GST 28%',
          originalRecord: expect.objectContaining({ tax_rate_perc: 18, tax_name: 'GST 18%' }),
          modifiedRecord: expect.objectContaining({ tax_rate_perc: 28, tax_name: 'GST 28%' }),
          notes: 'Tax rate updated',
        }),
      ]);
      expect(payload).toMatchObject({ tax_id: TAX_ID, tax_rate_perc: 28 });
    });

    it('checks the name and code against every live rate but itself', async () => {
      await service.save(dtoOf({ tax_id: TAX_ID }));

      // Neither was sent: the stored values are what must stay unique.
      expect(rawQueryValues('tax_name')).toEqual([['GST 18%', TAX_ID, TAX_ID]]);
      expect(rawQueryValues('tax_code')).toEqual([['GST18', TAX_ID, TAX_ID]]);
    });

    it('takes the modifier named in the body', async () => {
      await service.save(dtoOf({ tax_id: TAX_ID, tax_modified_by: 'importer' }));

      expect(updatedData().taxModifiedBy).toBe('importer');
    });

    // The merged record is what the CHECKs see, so one end of a paired rule
    // cannot be moved without the other.
    it.each([
      [
        'a cess percentage of 0 against a stored PERCENT basis',
        { taxCessBasis: 'PERCENT', taxCessPerc: new Prisma.Decimal(1) },
        { tax_cess_perc: 0 },
        'tax_cess_perc',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
      [
        'a rate on a stored EXEMPT taxability',
        { taxTaxability: 'EXEMPT', taxRatePerc: new Prisma.Decimal(0) },
        { tax_rate_perc: 5 },
        'tax_taxability',
        TaxRateErrorCode.EXEMPT_NOT_ZERO,
      ],
      [
        'an additional-cess basis whose stored figure is 0',
        {},
        { tax_acess_basis: 'PER_UNIT' },
        'tax_acess_per_unit',
        TaxRateErrorCode.CESS_BASIS_MISMATCH,
      ],
    ])('refuses %s', async (_label, stored, sent, field, code) => {
      store.rates.set(TAX_ID, rateRow(stored));

      const refusal = await refusalOf(service.save(dtoOf({ tax_id: TAX_ID, ...sent })));

      expect(errorsOf(refusal)).toContainEqual(expect.objectContaining({ field, code }));
      expect(prisma.taxRateMaster.update).not.toHaveBeenCalled();
    });

    it('accepts moving both ends of a paired rule together', async () => {
      store.rates.set(
        TAX_ID,
        rateRow({ taxCessBasis: 'PERCENT', taxCessPerc: new Prisma.Decimal(1) }),
      );

      await service.save(dtoOf({ tax_id: TAX_ID, tax_cess_basis: 'NONE', tax_cess_perc: 0 }));

      expect(updatedData()).toMatchObject({ taxCessBasis: 'NONE', taxCessPerc: 0 });
    });

    describe('code and supersession: omitted keeps, null clears', () => {
      beforeEach(() => {
        store.rates.set(B_ID, rateRow({ taxId: B_ID, taxName: 'GST 12%', taxCode: 'GST12' }));
        store.rates.set(TAX_ID, rateRow({ taxSupersedesId: B_ID }));
      });

      it('keeps the stored code and chain when the body leaves them out', async () => {
        const payload = await service.save(dtoOf({ tax_id: TAX_ID, tax_rate_perc: 18 }));

        expect(updatedData().taxCode).toBeUndefined();
        expect(updatedData()).not.toHaveProperty('taxSupersedesId');
        expect(payload).toMatchObject({ tax_code: 'GST18', tax_supersedes_id: B_ID });
      });

      it('clears both on an explicit null, and a blank code too', async () => {
        await service.save(dtoOf({ tax_id: TAX_ID, tax_code: '  ', tax_supersedes_id: null }));

        expect(updatedData()).toMatchObject({ taxCode: null, taxSupersedesId: null });
        expect(rawQueryValues('tax_code')).toEqual([]);
      });
    });

    describe('the supersession chain', () => {
      it('refuses a rate superseding itself', async () => {
        const refusal = await refusalOf(
          service.save(dtoOf({ tax_id: TAX_ID, tax_supersedes_id: TAX_ID })),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [{ field: 'tax_supersedes_id', code: TaxRateErrorCode.SELF_SUPERSEDE }],
          },
        });
      });

      it('refuses a chain that would loop back to this rate', async () => {
        // B already supersedes A, so A superseding B closes A → B → A.
        store.rates.set(B_ID, rateRow({ taxId: B_ID, taxName: 'B', taxSupersedesId: TAX_ID }));

        const refusal = await refusalOf(
          service.save(dtoOf({ tax_id: TAX_ID, tax_supersedes_id: B_ID })),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [
              {
                field: 'tax_supersedes_id',
                code: TaxRateErrorCode.SUPERSEDE_LOOP,
                message: 'That rate already supersedes this one — the chain would loop',
              },
            ],
          },
        });
        expect(prisma.taxRateMaster.update).not.toHaveBeenCalled();
      });

      it('accepts a long chain that never comes back', async () => {
        store.rates.set(B_ID, rateRow({ taxId: B_ID, taxName: 'B', taxSupersedesId: C_ID }));
        store.rates.set(C_ID, rateRow({ taxId: C_ID, taxName: 'C', taxSupersedesId: D_ID }));
        store.rates.set(D_ID, rateRow({ taxId: D_ID, taxName: 'D' }));

        await service.save(dtoOf({ tax_id: TAX_ID, tax_supersedes_id: B_ID }));

        expect(updatedData().taxSupersedesId).toBe(B_ID);
      });

      it('stops walking a loop elsewhere in the chain instead of hanging', async () => {
        // B → C → B never reaches A; the walk gives up at its depth limit.
        store.rates.set(B_ID, rateRow({ taxId: B_ID, taxName: 'B', taxSupersedesId: C_ID }));
        store.rates.set(C_ID, rateRow({ taxId: C_ID, taxName: 'C', taxSupersedesId: B_ID }));

        await service.save(dtoOf({ tax_id: TAX_ID, tax_supersedes_id: B_ID }));

        const walkReads = prisma.taxRateMaster.findFirst.mock.calls.filter(
          ([args]) => (args as { select?: Record<string, unknown> }).select?.taxSupersedesId,
        );
        expect(walkReads).toHaveLength(50);
        expect(prisma.taxRateMaster.update).toHaveBeenCalled();
      });
    });

    describe('the grid', () => {
      beforeEach(() => {
        store.lines.set(LINE_1, lineRow());
        store.lines.set(
          LINE_2,
          lineRow({
            trlId: LINE_2,
            trlRole: 'SALES',
            trlSupplyNature: 'INTRA',
            trlRemarks: 'kept',
          }),
        );
      });

      it('leaves the grid alone when the body has no lines key', async () => {
        await service.save(dtoOf({ tax_id: TAX_ID, tax_rate_perc: 18 }));

        expect(prisma.taxRateLedger.create).not.toHaveBeenCalled();
        expect(prisma.taxRateLedger.update).not.toHaveBeenCalled();
        expect(prisma.taxRateLedger.findMany).not.toHaveBeenCalled();
      });

      it('deletes every override for "lines": [], auditing each as a cancel', async () => {
        const payload = await service.save(
          dtoOf({ tax_id: TAX_ID, lines: [], tax_modified_by: 'importer' }),
        );

        expect(prisma.taxRateLedger.update).toHaveBeenCalledTimes(2);
        expect(prisma.taxRateLedger.update).toHaveBeenCalledWith({
          where: { trlId: LINE_1 },
          data: {
            trlIsDeleted: true,
            trlIsActive: false,
            trlModifiedOn: expect.any(Date),
            trlModifiedBy: 'importer',
          },
          include: expect.any(Object),
        });
        expect(audits().filter((entry) => entry.action === 'cancel')).toEqual([
          expect.objectContaining({
            tableName: 'tax rate ledger',
            displayName: 'OUTPUT_CGST',
            notes: 'Tax rate ledger line soft deleted',
          }),
          expect.objectContaining({ tableName: 'tax rate ledger', displayName: 'SALES / INTRA' }),
        ]);
        expect(payload.lines).toEqual([]);
      });

      it('updates the lines it names, inserts the new ones and deletes the ones left out', async () => {
        await service.save(
          dtoOf({
            tax_id: TAX_ID,
            lines: [
              {
                trl_id: LINE_1,
                trl_role: 'OUTPUT_CGST',
                trl_ledger_id: OTHER_LEDGER_ID,
                trl_remarks: ' changed ',
              },
              { trl_role: 'OUTPUT_SGST', trl_ledger_id: LEDGER_ID, trl_is_active: false },
            ],
          }),
        );

        expect(prisma.taxRateLedger.update).toHaveBeenCalledWith({
          where: { trlId: LINE_1 },
          data: {
            trlModifiedOn: expect.any(Date),
            trlModifiedBy: USER_ID,
            trlRole: 'OUTPUT_CGST',
            trlSupplyNature: null,
            trlLedgerId: OTHER_LEDGER_ID,
            trlRemarks: 'changed',
          },
          include: expect.any(Object),
        });
        expect(prisma.taxRateLedger.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            trlTaxId: TAX_ID,
            trlRole: 'OUTPUT_SGST',
            trlIsActive: false,
          }) as object,
          include: expect.any(Object),
        });
        // LINE_2 was on the rate and is not in the array.
        expect(store.lines.get(LINE_2)).toMatchObject({ trlIsDeleted: true, trlIsActive: false });
        expect(audits().map((entry) => [entry.action, entry.tableName])).toEqual([
          ['update', 'tax rate ledger'],
          ['insert', 'tax rate ledger'],
          ['cancel', 'tax rate ledger'],
          ['update', 'tax rate master'],
        ]);
      });

      // "null (the default) = both natures": a line resent without its nature
      // covers both again, as it would on insert.
      it('writes a null supply nature for a line updated without one, and keeps its remarks', async () => {
        await service.save(
          dtoOf({
            tax_id: TAX_ID,
            lines: [
              { trl_id: LINE_2, trl_role: 'SALES', trl_ledger_id: LEDGER_ID, trl_is_active: null },
            ],
          }),
        );

        const { data } = prisma.taxRateLedger.update.mock.calls[0][0] as {
          data: Record<string, unknown>;
        };
        expect(data.trlSupplyNature).toBeNull();
        expect(data.trlRemarks).toBeUndefined();
        expect(data).not.toHaveProperty('trlIsActive');
        expect(store.lines.get(LINE_2)).toMatchObject({
          trlSupplyNature: null,
          trlRemarks: 'kept',
        });
      });

      it('switches a line back on, as the modifier the line names', async () => {
        store.lines.set(LINE_1, lineRow({ trlIsActive: false }));

        await service.save(
          dtoOf({
            tax_id: TAX_ID,
            lines: [
              {
                trl_id: LINE_1,
                trl_role: 'OUTPUT_CGST',
                trl_ledger_id: LEDGER_ID,
                trl_is_active: true,
                trl_modified_by: 'importer',
              },
            ],
          }),
        );

        expect(prisma.taxRateLedger.update).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { trlId: LINE_1 },
            data: expect.objectContaining({
              trlIsActive: true,
              trlModifiedBy: 'importer',
            }) as object,
          }),
        );
      });

      it('refuses a trl_id that is not a live line of this rate', async () => {
        store.lines.set(OTHER_RATE_LINE, lineRow({ trlId: OTHER_RATE_LINE, trlTaxId: B_ID }));

        const refusal = await refusalOf(
          service.save(
            dtoOf({
              tax_id: TAX_ID,
              lines: [
                { trl_id: OTHER_RATE_LINE, trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID },
              ],
            }),
          ),
        );

        expect(refusal).toEqual({
          status: 404,
          body: {
            success: false,
            message: 'Tax rate ledger line not found on this rate',
            errors: [
              {
                field: 'trl_id',
                code: TaxRateErrorCode.LINE_NOT_FOUND,
                message: `trl_id ${OTHER_RATE_LINE} was not found`,
              },
            ],
          },
        });
      });
    });

    it('turns a unique-index race on the name into a 409 on tax_name', async () => {
      prisma.taxRateMaster.update.mockRejectedValue(knownError('P2002', { target: 'ux_tax_name' }));

      const refusal = await refusalOf(service.save(dtoOf({ tax_id: TAX_ID, tax_name: 'GST 18%' })));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'tax_name', code: TaxRateErrorCode.DUPLICATE }] },
      });
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────
  describe('softDelete', () => {
    beforeEach(() => {
      store.rates.set(TAX_ID, rateRow());
      store.lines.set(LINE_1, lineRow());
      store.lines.set(LINE_2, lineRow({ trlId: LINE_2, trlRole: 'SALES', trlIsActive: false }));
    });

    it('refuses a rate that is missing or already deleted', async () => {
      store.rates.set(TAX_ID, rateRow({ taxIsDeleted: true }));

      const refusal = await refusalOf(service.softDelete(TAX_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: TaxRateErrorCode.NOT_FOUND }] },
      });
      expect(liveReferences).not.toHaveBeenCalled();
    });

    it('asks whether any live master still points at the rate', async () => {
      await service.softDelete(TAX_ID);

      expect(liveReferences).toHaveBeenCalledWith(prisma, expect.any(Array), TAX_ID, {
        label: 'tax rate',
        idField: 'tax_id',
        inUseCode: TaxRateErrorCode.IN_USE,
      });
      const references = liveReferences.mock.calls[0][1];
      expect(references.map((ref) => `${ref.table}.${ref.column}`)).toEqual([
        'inventory.item_master.item_default_tax_id',
        'inventory.item_tax_history.ith_tax_id',
        'accounts.acc_ledger_master.led_tax_id',
        'public.charge_master.chg_tax_id',
        'inventory.item_group_master.itg_default_tax_id',
        'inventory.item_category_master.category_default_tax_id',
      ]);
    });

    it('deletes nothing while the rate is in use', async () => {
      liveReferences.mockRejectedValue(
        new ConflictException({ success: false, message: 'in use', errors: [] }),
      );

      const refusal = await refusalOf(service.softDelete(TAX_ID));

      expect(refusal.status).toBe(409);
      expect(prisma.taxRateLedger.update).not.toHaveBeenCalled();
      expect(prisma.taxRateMaster.update).not.toHaveBeenCalled();
    });

    it('takes every line down first, deactivated ones included, then the header', async () => {
      const result = await service.softDelete(TAX_ID);

      expect(result).toEqual({ tax_id: TAX_ID, deleted: true, lines_deleted: 2 });
      expect(prisma.taxRateMaster.update).toHaveBeenCalledWith({
        where: { taxId: TAX_ID },
        data: {
          taxIsDeleted: true,
          taxIsActive: false,
          taxModifiedOn: expect.any(Date),
          taxModifiedBy: USER_ID,
        },
      });
      const headerWrite = prisma.taxRateMaster.update.mock.invocationCallOrder[0];
      prisma.taxRateLedger.update.mock.invocationCallOrder.forEach((lineWrite) =>
        expect(lineWrite).toBeLessThan(headerWrite),
      );
      expect(audits().map((entry) => [entry.action, entry.tableName])).toEqual([
        ['cancel', 'tax rate ledger'],
        ['cancel', 'tax rate ledger'],
        ['cancel', 'tax rate master'],
      ]);
      expect(audits()[2]).toMatchObject({
        notes: 'Tax rate soft deleted',
        originalRecord: expect.objectContaining({ tax_is_deleted: false }),
        modifiedRecord: expect.objectContaining({
          tax_is_deleted: true,
          tax_is_active: false,
          lines: [],
        }),
      });
    });

    it('stamps the modifier it was given on the header and the lines', async () => {
      await service.softDelete(TAX_ID, 'importer');

      expect(prisma.taxRateMaster.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ taxModifiedBy: 'importer' }) as object,
        }),
      );
      expect(store.lines.get(LINE_1)?.trlModifiedBy).toBe('importer');
    });

    it('reports no lines deleted for a rate with none', async () => {
      store.lines.clear();

      await expect(service.softDelete(TAX_ID)).resolves.toEqual({
        tax_id: TAX_ID,
        deleted: true,
        lines_deleted: 0,
      });
    });
  });
});
