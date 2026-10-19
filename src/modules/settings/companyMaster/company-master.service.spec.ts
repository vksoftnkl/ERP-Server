import { HttpException } from '@nestjs/common';
import { Company, FiscalYear, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { CompanyMasterService } from './company-master.service';
import { SaveCompanyMasterDto } from './dto/save-company-master.dto';
import { CompanyMasterErrorCode } from './types/company-master-error-codes';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e102';
const BANK_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const STAMP = new Date('2026-10-01T04:30:00.000Z');
/** State 33 (Tamil Nadu), PAN ABCDE1234F. */
const GSTIN = '33ABCDE1234F1Z5';
const PAN = 'ABCDE1234F';
const MAIN_BRANCH = {
  brId: '019c6f6c-be87-7a11-8905-36092c46e104',
  brName: 'Main Branch',
  gdlId: '019c6f6c-be87-7a11-8905-36092c46e105',
  gdlName: 'Main Godown',
};

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const companyRow = (overrides: Partial<Company> = {}): Company => ({
  compId: COMPANY_ID,
  compCode: 'ZT',
  compName: 'Zeta Traders',
  compShort: null,
  compLegalName: null,
  compGstinNo: null,
  compGstRegType: null,
  compPanNo: null,
  compTanNo: null,
  compCinNo: null,
  compFssaiNo: null,
  compDrugLicenseNo: null,
  compAddr1: null,
  compAddr2: null,
  compAddr3: null,
  compCity: null,
  compDistrict: null,
  compState: null,
  compStateCode: '33',
  compPin: null,
  compCountry: 'India',
  compRegionAddr1: null,
  compRegionAddr2: null,
  compRegionAddr3: null,
  compRegionCity: null,
  compRegionDistrict: null,
  compRegionState: null,
  compRegionCountry: null,
  compRegionName: null,
  compTel: null,
  compPhone: null,
  compMail: null,
  compSupportEmail: null,
  compSupportPhone: null,
  compWebsiteName: null,
  compFinYearFrom: day('2026-04-01'),
  compFinYearTo: day('2027-03-31'),
  compBooksBeginFrom: day('2026-04-01'),
  compBooksLockDate: null,
  compGstApplicable: true,
  compTcsApplicable: false,
  compTdsApplicable: false,
  compAatoClass: 'LE_5CR',
  compDcPurposes: ['SUPPLY'],
  compSmsApplicable: false,
  compEinvoiceApplicable: false,
  compEwayApplicable: false,
  compEwayDate: null,
  compEwayInterLimit: null,
  compEwayIntraApl: false,
  compEwayIntraLimit: new Prisma.Decimal('50000'),
  compEinvoiceDate: null,
  compEinvoiceInclEway: null,
  compStylesheetId: null,
  compBankId: null,
  compPriceFixing: null,
  compPrefixCode: null,
  compBillGreeting: null,
  compNegStkApl: false,
  compDefault: false,
  compIsActive: true,
  compCurrencyCode: 'INR',
  compCurrencySymbol: null,
  compLocaleCode: 'en-IN',
  compRemarks: null,
  compAuthorizeSignature: null,
  compIsDeleted: false,
  compSyncDate: null,
  compCreatedOn: STAMP,
  compCreatedBy: USER_ID,
  compModifiedOn: STAMP,
  compModifiedBy: USER_ID,
  ...overrides,
});

const yearRow = (overrides: Partial<FiscalYear> = {}): FiscalYear => ({
  fyId: '019c6f6c-be87-7a11-8905-36092c46e106',
  compId: COMPANY_ID,
  fyYearName: '2026-2027',
  fyBeginDate: day('2026-04-01'),
  fyEndDate: day('2027-03-31'),
  fyBooksBeginDate: null,
  fyStatus: 'OPEN',
  fyIsCurrent: true,
  fyLockDate: null,
  fyClosedAt: null,
  fyClosedBy: null,
  fyIsCarriedForward: false,
  fyCarriedForwardAt: null,
  fyPrevFyId: null,
  fyDetached: false,
  fyRemarks: null,
  tallyGuid: null,
  tallyMasterId: null,
  tallyAlterId: null,
  isDeleted: false,
  createdAt: STAMP,
  createdBy: USER_ID,
  updatedAt: null,
  updatedBy: null,
  deletedAt: null,
  deletedBy: null,
  fySyncDate: null,
  ...overrides,
});

/** Bytes that open like the named image kind, as bare base64. */
const PNG = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(8)]).toString(
  'base64',
);
const JPEG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(8)]).toString(
  'base64',
);
const GIF = Buffer.concat([Buffer.from('GIF89a', 'latin1'), Buffer.alloc(6)]).toString('base64');
const WEBP = Buffer.concat([
  Buffer.from('RIFF', 'latin1'),
  Buffer.alloc(4),
  Buffer.from('WEBP', 'latin1'),
]).toString('base64');

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

type Where = Record<string, unknown>;
type PrismaMock = {
  company: {
    findFirst: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  fiscalYear: { create: jest.Mock; findFirst: jest.Mock };
  accLedgerMaster: { findUnique: jest.Mock };
  appThemeMaster: { findFirst: jest.Mock };
  $queryRaw: jest.Mock;
  $transaction: jest.Mock;
};

describe('CompanyMasterService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let branches: { seedMainBranch: jest.Mock };
  let service: CompanyMasterService;
  /** What the existence reads (get / update / delete / restore) find. */
  let stored: Company | null;
  /** Which uniqueness reads find another company. */
  let clash: { name: boolean; code: boolean; gstin: boolean };

  beforeEach(() => {
    stored = null;
    clash = { name: false, code: false, gstin: false };
    prisma = {
      company: {
        findFirst: jest.fn(async ({ where }: { where: Where }) => {
          if ('compName' in where) return clash.name ? { compId: 'other' } : null;
          if ('compCode' in where) return clash.code ? { compId: 'other' } : null;
          if ('compGstinNo' in where) return clash.gstin ? { compId: 'other' } : null;
          return stored;
        }),
        create: jest.fn(async ({ data }: { data: Partial<Company> }) => companyRow(data)),
        update: jest.fn(async ({ data }: { data: Partial<Company> }) => ({
          ...(stored ?? companyRow()),
          ...data,
        })),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      fiscalYear: {
        create: jest.fn(async ({ data }: { data: Partial<FiscalYear> }) => yearRow(data)),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      accLedgerMaster: { findUnique: jest.fn().mockResolvedValue({ ledName: 'HDFC Current' }) },
      appThemeMaster: { findFirst: jest.fn().mockResolvedValue({ thmId: 4 }) },
      // countLiveReferences: one row per reference that has any.
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    branches = { seedMainBranch: jest.fn().mockResolvedValue(MAIN_BRANCH) };
    service = new CompanyMasterService(
      prisma as unknown as PrismaService,
      audit as never,
      context as never,
      branches as never,
    );
  });

  const create = (extra: Partial<SaveCompanyMasterDto> = {}) =>
    service.save({ compName: 'Zeta Traders', compStateCode: '33', ...extra });
  const update = (extra: Partial<SaveCompanyMasterDto> = {}) =>
    service.save({ compId: COMPANY_ID, compName: 'Zeta Traders', compStateCode: '33', ...extra });
  const createdData = () =>
    (prisma.company.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.company.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const yearData = () =>
    (prisma.fiscalYear.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;
  const errorsOf = (refusal: { body: unknown }) =>
    (refusal.body as { errors: Array<{ field: string; code: string; message: string }> }).errors;

  describe('create', () => {
    it('writes the company, its first year and its Main Branch in one transaction', async () => {
      const payload = await create({
        compName: '  Zeta Traders ',
        compFinYearFrom: day('2026-04-01'),
        compShort: 'ZT',
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(createdData()).toEqual({
        compName: 'Zeta Traders',
        compStateCode: '33',
        compStylesheetId: undefined,
        compFinYearFrom: day('2026-04-01'),
        compFinYearTo: day('2027-03-31'),
        compBooksBeginFrom: day('2026-04-01'),
        compCreatedOn: expect.any(Date),
        compCreatedBy: USER_ID,
        compShort: 'ZT',
      });
      expect(yearData()).toEqual({
        compId: COMPANY_ID,
        fyYearName: '2026-2027',
        fyBeginDate: day('2026-04-01'),
        fyEndDate: day('2027-03-31'),
        fyBooksBeginDate: day('2026-04-01'),
        fyStatus: 'OPEN',
        fyIsCurrent: true,
        createdBy: USER_ID,
        fyRemarks: 'Seeded on company create',
      });
      expect(branches.seedMainBranch).toHaveBeenCalledWith(
        prisma,
        expect.objectContaining({ compId: COMPANY_ID, compName: 'Zeta Traders' }),
        USER_ID,
        expect.any(Date),
      );
      expect(payload).toMatchObject({
        compId: COMPANY_ID,
        compFinYearFrom: day('2026-04-01').toISOString(),
        compEwayIntraLimit: 50000,
        compStylesheetName: null,
        compBankName: null,
        compMainBranch: MAIN_BRANCH,
      });
      expect(auditEntry()).toMatchObject({
        action: 'New',
        tableName: 'companys',
        pk: COMPANY_ID,
        originalRecord: null,
        modifiedRecord: payload,
        userId: USER_ID,
      });
    });

    it('upper-cases the state code and stamps the default actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await create({ compStateCode: ' tn ' });

      expect(createdData()).toMatchObject({ compStateCode: 'TN', compCreatedBy: DEFAULT_ACTOR });
    });

    it('never writes the lock date, which belongs to the fiscal year', async () => {
      await create({ compBooksLockDate: day('2026-06-30') });

      expect(createdData()).not.toHaveProperty('compBooksLockDate');
    });

    it('refuses a blank name', async () => {
      const refusal = await refusalOf(create({ compName: '   ' }));

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'compName', code: CompanyMasterErrorCode.NAME_REQUIRED }),
      ]);
    });

    it('refuses a state code that is not two characters', async () => {
      const refusal = await refusalOf(create({ compStateCode: '330' }));

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'compStateCode',
          code: CompanyMasterErrorCode.STATE_CODE_INVALID,
        }),
      ]);
    });

    it.each([
      ['name', 'compName', CompanyMasterErrorCode.NAME_DUPLICATE],
      ['code', 'compCode', CompanyMasterErrorCode.CODE_DUPLICATE],
      ['gstin', 'compGstinNo', CompanyMasterErrorCode.GSTIN_DUPLICATE],
    ] as const)('refuses a %s another company holds', async (key, field, code) => {
      clash[key] = true;

      const refusal = await refusalOf(create({ compCode: 'ZT', compGstinNo: GSTIN }));

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([expect.objectContaining({ field, code })]);
      expect(prisma.company.create).not.toHaveBeenCalled();
    });

    it('compares name, code and GSTIN case-insensitively', async () => {
      await create({ compCode: 'zt', compGstinNo: GSTIN });

      const wheres = prisma.company.findFirst.mock.calls.map(([args]) => (args as { where: Where }).where);
      expect(wheres).toEqual([
        { compName: { equals: 'Zeta Traders', mode: 'insensitive' } },
        { compCode: { equals: 'zt', mode: 'insensitive' } },
        { compGstinNo: { equals: GSTIN, mode: 'insensitive' } },
      ]);
    });

    it('skips the code and GSTIN checks when neither is sent', async () => {
      await create();

      expect(prisma.company.findFirst).toHaveBeenCalledTimes(1);
    });

    it('answers a unique-index race (P2002) with a 409', async () => {
      prisma.company.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const refusal = await refusalOf(create());

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'compName', code: CompanyMasterErrorCode.DUPLICATE }),
      ]);
    });

    it('rethrows any other failure untouched', async () => {
      const failure = new Error('connection reset');
      branches.seedMainBranch.mockRejectedValue(failure);

      await expect(create()).rejects.toBe(failure);
    });

    it('moves the default flag off every other company when this one is the default', async () => {
      await create({ compDefault: true });

      expect(prisma.company.updateMany).toHaveBeenCalledWith({
        where: { compIsDeleted: false, compDefault: true },
        data: { compDefault: false, compModifiedOn: expect.any(Date), compModifiedBy: USER_ID },
      });
      expect(createdData().compDefault).toBe(true);
    });

    it('leaves the other companies alone when this one is not the default', async () => {
      await create({ compDefault: false });

      expect(prisma.company.updateMany).not.toHaveBeenCalled();
    });

    it('refuses a theme that is inactive or deleted', async () => {
      prisma.appThemeMaster.findFirst.mockResolvedValue(null);

      const refusal = await refusalOf(create({ compStylesheetId: 4 }));

      expect(prisma.appThemeMaster.findFirst).toHaveBeenCalledWith({
        where: { thmId: 4, thmIsActive: true, thmIsDeleted: false },
        select: { thmId: true },
      });
      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'compStylesheetId',
          code: CompanyMasterErrorCode.THEME_INACTIVE,
        }),
      ]);
    });
  });

  describe('create — the first fiscal year (notes 72 A1)', () => {
    it('seeds the year the dates name, with the books beginning inside it', async () => {
      await create({
        compFinYearFrom: day('2026-04-01'),
        compFinYearTo: day('2027-03-31'),
        compBooksBeginFrom: day('2026-06-15'),
      });

      expect(yearData()).toMatchObject({
        fyYearName: '2026-2027',
        fyBooksBeginDate: day('2026-06-15'),
      });
      expect(createdData().compBooksBeginFrom).toEqual(day('2026-06-15'));
    });

    it('takes the year that compFinYearTo ends, books from its 1 April', async () => {
      await create({ compFinYearTo: day('2028-03-31') });

      expect(yearData()).toMatchObject({
        fyYearName: '2027-2028',
        fyBeginDate: day('2027-04-01'),
        fyBooksBeginDate: day('2027-04-01'),
      });
    });

    it('takes the year containing compBooksBeginFrom when no year dates are sent', async () => {
      await create({ compBooksBeginFrom: day('2026-02-10') });

      expect(yearData()).toMatchObject({
        fyYearName: '2025-2026',
        fyBeginDate: day('2025-04-01'),
        fyEndDate: day('2026-03-31'),
        fyBooksBeginDate: day('2026-02-10'),
      });
    });

    describe('with no dates at all', () => {
      afterEach(() => jest.useRealTimers());

      it.each([
        // 23:30 IST on 31 March: still the old year.
        ['2026-03-31T18:00:00.000Z', '2025-2026'],
        // 00:30 IST on 1 April, while it is still 31 March in UTC: the new year.
        ['2026-03-31T19:00:00.000Z', '2026-2027'],
      ])('at %s takes the Indian financial year of that moment (%s)', async (now, name) => {
        jest.useFakeTimers({ now: new Date(now), doNotFake: ['nextTick', 'queueMicrotask'] });

        await create();

        expect(yearData().fyYearName).toBe(name);
      });
    });

    it.each([
      [
        'a start that is not 1 April',
        { compFinYearFrom: day('2026-03-20') },
        'compFinYearFrom',
        CompanyMasterErrorCode.FIN_YEAR_FROM_INVALID,
        'A financial year begins on 1 April; compFinYearFrom is 2026-03-20',
      ],
      [
        'an end that is not 31 March',
        { compFinYearTo: day('2026-12-31') },
        'compFinYearTo',
        CompanyMasterErrorCode.FIN_YEAR_TO_INVALID,
        'A financial year ends on 31 March; compFinYearTo is 2026-12-31',
      ],
      [
        'an end before the start',
        { compFinYearFrom: day('2026-04-01'), compFinYearTo: day('2026-03-31') },
        'compFinYearTo',
        CompanyMasterErrorCode.FIN_YEAR_SPAN_INVALID,
        'A year from 2026-04-01 ends on 2027-03-31; compFinYearTo is 2026-03-31',
      ],
      [
        'a two-year span',
        { compFinYearFrom: day('2026-04-01'), compFinYearTo: day('2028-03-31') },
        'compFinYearTo',
        CompanyMasterErrorCode.FIN_YEAR_SPAN_INVALID,
        'A year from 2026-04-01 ends on 2027-03-31; compFinYearTo is 2028-03-31',
      ],
      [
        'books beginning after the year',
        { compFinYearFrom: day('2026-04-01'), compBooksBeginFrom: day('2027-05-01') },
        'compBooksBeginFrom',
        CompanyMasterErrorCode.BOOKS_BEGIN_OUTSIDE_YEAR,
        'compBooksBeginFrom must fall inside the first year, 2026-04-01 to 2027-03-31',
      ],
    ])('refuses %s before writing anything', async (_label, dates, field, code, message) => {
      const refusal = await refusalOf(create(dates));

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([{ field, code, message }]);
      expect(prisma.company.create).not.toHaveBeenCalled();
      expect(prisma.fiscalYear.create).not.toHaveBeenCalled();
    });
  });

  describe('GSTIN against state and PAN (notes 72 C7)', () => {
    it('fills a blank PAN from the GSTIN', async () => {
      await create({ compGstinNo: GSTIN });

      expect(createdData()).toMatchObject({ compGstinNo: GSTIN, compPanNo: PAN });
    });

    it('accepts the matching PAN as sent', async () => {
      await create({ compGstinNo: GSTIN, compPanNo: PAN });

      expect(createdData().compPanNo).toBe(PAN);
    });

    it('neither compares nor fills a PAN slot that is not PAN-shaped', async () => {
      await create({ compGstinNo: '331234567890123', compPanNo: 'ZZZZZ9999Z' });

      expect(createdData().compPanNo).toBe('ZZZZZ9999Z');
    });

    it('refuses a GSTIN that is not GSTIN-shaped', async () => {
      const refusal = await refusalOf(create({ compGstinNo: '33-ABCDE' }));

      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'compGstinNo', code: CompanyMasterErrorCode.GSTIN_INVALID }),
      ]);
    });

    it('reports another state and another PAN together, each under its own code', async () => {
      const refusal = await refusalOf(
        create({ compGstinNo: `29${GSTIN.slice(2)}`, compPanNo: 'ZZZZZ9999Z' }),
      );

      expect(refusal.status).toBe(400);
      expect(errorsOf(refusal)).toEqual([
        {
          field: 'compGstinNo',
          code: CompanyMasterErrorCode.GSTIN_STATE_MISMATCH,
          message: `GSTIN 29${GSTIN.slice(2)} is registered in state 29, but compStateCode is 33`,
        },
        expect.objectContaining({
          field: 'compPanNo',
          code: CompanyMasterErrorCode.PAN_GSTIN_MISMATCH,
        }),
      ]);
    });

    it('checks an update that omits the GSTIN against the stored one', async () => {
      stored = companyRow({ compGstinNo: GSTIN, compPanNo: PAN });

      const refusal = await refusalOf(update({ compStateCode: '29' }));

      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'compGstinNo',
          code: CompanyMasterErrorCode.GSTIN_STATE_MISMATCH,
        }),
      ]);
      expect(prisma.company.update).not.toHaveBeenCalled();
    });

    it('lets an update clear the GSTIN and move state in the same save', async () => {
      stored = companyRow({ compGstinNo: GSTIN, compPanNo: PAN });

      await update({ compStateCode: '29', compGstinNo: null });

      expect(updatedData()).toMatchObject({ compStateCode: '29', compGstinNo: null });
    });
  });

  describe('the authorised signature (notes 72 C5)', () => {
    it.each([
      ['PNG', PNG, 'image/png'],
      ['JPEG', JPEG, 'image/jpeg'],
      ['GIF', GIF, 'image/gif'],
      ['WebP', WEBP, 'image/webp'],
    ])('stores bare %s base64 as a data URL of its kind', async (_label, base64, type) => {
      await create({ compAuthorizeSignature: base64 });

      expect(createdData().compAuthorizeSignature).toBe(`data:${type};base64,${base64}`);
    });

    it('reads the kind from the bytes, not from the label', async () => {
      await create({ compAuthorizeSignature: `data:image/jpeg;base64,${PNG}` });

      expect(createdData().compAuthorizeSignature).toBe(`data:image/png;base64,${PNG}`);
    });

    it('ignores whitespace inside the base64', async () => {
      await create({ compAuthorizeSignature: `${PNG.slice(0, 8)}\n ${PNG.slice(8)}` });

      expect(createdData().compAuthorizeSignature).toBe(`data:image/png;base64,${PNG}`);
    });

    it.each([
      ['a data URL that is not base64', 'data:image/png,abc', 'must be base64-encoded'],
      ['characters outside base64', `${PNG.slice(0, -4)}@@@@`, 'must be valid base64 content'],
      ['a length that is not a multiple of four', 'abcde', 'must be valid base64 content'],
    ])('refuses %s', async (_label, value, message) => {
      const refusal = await refusalOf(create({ compAuthorizeSignature: value }));

      expect(errorsOf(refusal)).toEqual([
        {
          field: 'compAuthorizeSignature',
          code: CompanyMasterErrorCode.SIGNATURE_NOT_BASE64,
          message: `compAuthorizeSignature ${message}`,
        },
      ]);
    });

    it('refuses an image over 512 KB', async () => {
      const big = Buffer.concat([
        Buffer.from('89504e470d0a1a0a', 'hex'),
        Buffer.alloc(512 * 1024),
      ]).toString('base64');

      const refusal = await refusalOf(create({ compAuthorizeSignature: big }));

      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ code: CompanyMasterErrorCode.SIGNATURE_TOO_LARGE }),
      ]);
    });

    it('refuses bytes that are no supported image', async () => {
      const refusal = await refusalOf(
        create({ compAuthorizeSignature: Buffer.from('hello world!').toString('base64') }),
      );

      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          code: CompanyMasterErrorCode.SIGNATURE_NOT_IMAGE,
          message: 'compAuthorizeSignature must be a PNG, JPEG, GIF or WebP image',
        }),
      ]);
    });

    it.each([null, '', '  '])('clears the signature for %p', async (value) => {
      stored = companyRow({ compAuthorizeSignature: `data:image/png;base64,${PNG}` });

      await update({ compAuthorizeSignature: value });

      expect(updatedData().compAuthorizeSignature).toBeNull();
    });

    it('keeps the stored signature when the update does not send one', async () => {
      stored = companyRow({ compAuthorizeSignature: `data:image/png;base64,${PNG}` });

      await update();

      expect(updatedData()).not.toHaveProperty('compAuthorizeSignature');
    });
  });

  describe('update', () => {
    it('refuses an id with no live company', async () => {
      const refusal = await refusalOf(update());

      expect(refusal.status).toBe(404);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ field: 'compId', code: CompanyMasterErrorCode.NOT_FOUND }),
      ]);
    });

    it('ignores the year dates and lock date, and reports the current year instead (C2)', async () => {
      stored = companyRow();
      prisma.fiscalYear.findFirst.mockResolvedValue(
        yearRow({ fyBooksBeginDate: day('2026-05-01'), fyLockDate: day('2026-06-30') }),
      );

      const payload = await update({
        compFinYearFrom: day('2020-01-01'),
        compFinYearTo: day('2020-12-31'),
        compBooksBeginFrom: day('2020-02-01'),
        compBooksLockDate: day('2020-01-31'),
      });

      expect(updatedData()).toEqual({
        compName: 'Zeta Traders',
        compStateCode: '33',
        compStylesheetId: undefined,
        compModifiedOn: expect.any(Date),
        compModifiedBy: USER_ID,
      });
      expect(prisma.fiscalYear.create).not.toHaveBeenCalled();
      expect(prisma.fiscalYear.findFirst).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID, fyIsCurrent: true, isDeleted: false },
      });
      expect(payload).toMatchObject({
        compFinYearFrom: day('2026-04-01').toISOString(),
        compFinYearTo: day('2027-03-31').toISOString(),
        compBooksBeginFrom: day('2026-05-01').toISOString(),
        compBooksLockDate: day('2026-06-30').toISOString(),
      });
    });

    it('checks name, code and GSTIN against every company but itself', async () => {
      stored = companyRow();

      await update({ compCode: 'ZT', compGstinNo: GSTIN });

      const wheres = prisma.company.findFirst.mock.calls
        .slice(1)
        .map(([args]) => (args as { where: Where }).where);
      expect(wheres).toEqual([
        { compName: { equals: 'Zeta Traders', mode: 'insensitive' }, compId: { not: COMPANY_ID } },
        { compCode: { equals: 'ZT', mode: 'insensitive' }, compId: { not: COMPANY_ID } },
        { compGstinNo: { equals: GSTIN, mode: 'insensitive' }, compId: { not: COMPANY_ID } },
      ]);
    });

    it('clears the default on every other company, not itself', async () => {
      stored = companyRow();

      await update({ compDefault: true });

      expect(prisma.company.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { compIsDeleted: false, compDefault: true, compId: { not: COMPANY_ID } },
        }),
      );
    });

    it('checks a changed theme but not one the company already points at', async () => {
      stored = companyRow({ compStylesheetId: 4 });
      prisma.appThemeMaster.findFirst.mockResolvedValue(null);

      await update({ compStylesheetId: 4 });
      expect(prisma.appThemeMaster.findFirst).not.toHaveBeenCalled();

      const refusal = await refusalOf(update({ compStylesheetId: 5 }));
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ code: CompanyMasterErrorCode.THEME_INACTIVE }),
      ]);
    });

    it('audits the before and after against the current year', async () => {
      stored = companyRow();
      prisma.fiscalYear.findFirst.mockResolvedValue(yearRow());

      const payload = await update({ compName: 'Zeta Traders Pvt' });

      expect(auditEntry()).toMatchObject({
        action: 'update',
        pk: COMPANY_ID,
        displayName: 'Zeta Traders Pvt',
        originalRecord: expect.objectContaining({ compName: 'Zeta Traders' }),
        modifiedRecord: payload,
        notes: 'Company updated',
      });
    });
  });

  describe('getById', () => {
    it('refuses an id with no live company', async () => {
      const refusal = await refusalOf(service.getById(COMPANY_ID));

      expect(refusal.status).toBe(404);
    });

    it('names the theme and bank and reports the current year', async () => {
      stored = {
        ...companyRow({ compBankId: BANK_ID, compStylesheetId: 4 }),
        stylesheet: { thmName: 'Ocean' },
      } as Company;
      prisma.fiscalYear.findFirst.mockResolvedValue(yearRow());

      const payload = await service.getById(COMPANY_ID);

      expect(prisma.company.findFirst).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID, compIsDeleted: false },
        include: { stylesheet: { select: { thmName: true } } },
      });
      expect(prisma.accLedgerMaster.findUnique).toHaveBeenCalledWith({
        where: { ledId: BANK_ID },
        select: { ledName: true },
      });
      expect(payload).toMatchObject({
        compStylesheetName: 'Ocean',
        compBankName: 'HDFC Current',
        // No books-begin on the year: its begin date stands in.
        compBooksBeginFrom: day('2026-04-01').toISOString(),
        compBooksLockDate: null,
      });
    });

    it('looks up no bank when none is set, and reports stored dates without a year', async () => {
      stored = companyRow({ compBooksLockDate: day('2026-07-31') });

      const payload = await service.getById(COMPANY_ID);

      expect(prisma.accLedgerMaster.findUnique).not.toHaveBeenCalled();
      expect(payload).toMatchObject({
        compBankName: null,
        compStylesheetName: null,
        compBooksLockDate: day('2026-07-31').toISOString(),
      });
    });
  });

  describe('softDelete (notes 72 B2)', () => {
    it('refuses an id with no live company', async () => {
      const refusal = await refusalOf(service.softDelete(COMPANY_ID));

      expect(refusal.status).toBe(404);
    });

    it('refuses the default company without counting its references', async () => {
      stored = companyRow({ compDefault: true });

      const refusal = await refusalOf(service.softDelete(COMPANY_ID));

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({
          field: 'compId',
          code: CompanyMasterErrorCode.DEFAULT_UNDELETABLE,
        }),
      ]);
      expect(prisma.$queryRaw).not.toHaveBeenCalled();
    });

    it('refuses while live branches, ledgers or vouchers use it, naming each', async () => {
      stored = companyRow();
      prisma.$queryRaw.mockResolvedValue([
        { ord: 0, n: 2n },
        { ord: 2, n: 5n },
      ]);

      const refusal = await refusalOf(service.softDelete(COMPANY_ID));

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        {
          field: 'compId',
          code: CompanyMasterErrorCode.IN_USE,
          message:
            'Used by 2 live branches, 5 vouchers. Delete those first; a deleted company would ' +
            'leave them under books nobody can open.',
        },
      ]);
      expect(prisma.company.updateMany).not.toHaveBeenCalled();
    });

    it('refuses when the row was deleted between the read and the write', async () => {
      stored = companyRow();
      prisma.company.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.softDelete(COMPANY_ID));

      expect(refusal.status).toBe(404);
      expect(audit.logEntityChange).not.toHaveBeenCalled();
    });

    it('marks the company deleted, inactive and not default, and audits a cancel', async () => {
      stored = companyRow();

      await expect(service.softDelete(COMPANY_ID)).resolves.toEqual({
        compId: COMPANY_ID,
        deleted: true,
      });
      expect(prisma.company.updateMany).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID, compIsDeleted: false },
        data: {
          compIsDeleted: true,
          compIsActive: false,
          compDefault: false,
          compModifiedOn: expect.any(Date),
          compModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({
        action: 'cancel',
        displayName: 'Zeta Traders',
        modifiedRecord: expect.objectContaining({ compIsDeleted: true, compIsActive: false }),
      });
    });
  });

  describe('restore (notes 72 B1)', () => {
    it('refuses an id that names no company at all', async () => {
      const refusal = await refusalOf(service.restore(COMPANY_ID));

      expect(refusal.status).toBe(404);
      expect(errorsOf(refusal)).toEqual([
        {
          field: 'compId',
          code: CompanyMasterErrorCode.NOT_FOUND,
          message: `No company found with id ${COMPANY_ID}`,
        },
      ]);
    });

    it('refuses a company that is not deleted', async () => {
      stored = companyRow();

      const refusal = await refusalOf(service.restore(COMPANY_ID));

      expect(refusal.status).toBe(409);
      expect(errorsOf(refusal)).toEqual([
        expect.objectContaining({ code: CompanyMasterErrorCode.NOT_DELETED }),
      ]);
    });

    it('brings the company back active, without touching the default flag', async () => {
      stored = companyRow({ compIsDeleted: true, compIsActive: false });

      await expect(service.restore(COMPANY_ID)).resolves.toEqual({
        compId: COMPANY_ID,
        deleted: false,
      });
      expect(prisma.company.findFirst).toHaveBeenCalledWith({ where: { compId: COMPANY_ID } });
      expect(prisma.company.updateMany).toHaveBeenCalledWith({
        where: { compId: COMPANY_ID, compIsDeleted: true },
        data: {
          compIsDeleted: false,
          compIsActive: true,
          compModifiedOn: expect.any(Date),
          compModifiedBy: USER_ID,
        },
      });
      expect(auditEntry()).toMatchObject({ action: 'update', notes: 'Company restored' });
    });

    it('refuses when another request restored it first', async () => {
      stored = companyRow({ compIsDeleted: true });
      prisma.company.updateMany.mockResolvedValue({ count: 0 });

      const refusal = await refusalOf(service.restore(COMPANY_ID));

      expect(refusal.status).toBe(404);
    });
  });
});
