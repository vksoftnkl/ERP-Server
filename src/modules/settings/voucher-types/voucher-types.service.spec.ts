import {
  ConflictException,
  ForbiddenException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AccVoucherType, VoucherNumberingMode, VoucherResetFreq } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import type { RequestContextService } from 'src/common/request-context/request-context.service';
import type { PrismaService } from 'src/database/prisma/prisma.service';
import type { AuditLogService } from '../../audit-log/audit-log.service';
import type { SaveVoucherTypeDto } from './dto/save-voucher-type.dto';
import { VoucherTypesService, uniqueRaceIssue } from './voucher-types.service';

/**
 * Voucher Types plan §7.2 — the save rules in order, on a routed stand-in for
 * Prisma: rights, online, company, child / base, numbering, print, the write
 * (code, mirror, company), offerBase, delete / inactivate.
 */

const ACME = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const OTHER = '01a1679e-3f4d-70a6-8acb-4f9ae047aedd';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';
const CBE = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const C2 = '019d611f-1df8-7dd9-903d-777f955e2b65';

const row = (over: Partial<AccVoucherType>): AccVoucherType => ({
  vchrTypeId: 0,
  vchrTypeCode: 'X',
  vchrTypeName: 'X',
  vchrTypeShort: 'X',
  vchrCategory: 'BOTH',
  vchrNature: 'SALES',
  vchrNumberingMode: VoucherNumberingMode.AUTO,
  vchrNoPrefix: 'x',
  vchrNoSuffix: '',
  vchrNoWidth: 5,
  vchrResetFreq: VoucherResetFreq.YEARLY,
  vchrAffectsAccounts: true,
  vchrAffectsInventory: true,
  vchrIsCashVoucher: false,
  vchrIsBankVoucher: false,
  vchrPrintTitle: null,
  vchrSortOrder: 300,
  vchrIsActive: true,
  vchrTallyExportEnabled: true,
  vchrTallyVoucherTypeName: 'Sales',
  vchrTallyBaseVoucherType: 'Sales',
  vchrPartyMode: 'ONE',
  vchrPartySide: 'ANY',
  vchrBillwiseMode: 'RAISE',
  vchrRaiseBillType: 'SALES',
  vchrDrGroups: [],
  vchrCrGroups: [],
  vchrGstRegister: 'GSTR1',
  vchrGstSide: 'OUTPUT',
  vchrTdsMode: 'OFF',
  vchrMenuId: null,
  vchrInRegister: false,
  vchrInstruments: false,
  vchrParentId: null,
  vchrCompanyId: null,
  vchrStartNo: 1,
  vchrPrintPurposeId: null,
  vchrPrintAfterPost: false,
  vchrDeliveryMode: null,
  vchrGstDocNo: false,
  vchrSyncDate: null,
  vchrCreatedOn: new Date('2026-08-04T00:00:00Z'),
  vchrCreatedBy: 'system',
  vchrUpdatedOn: null,
  vchrUpdatedBy: null,
  ...over,
});

const BASE3 = row({
  vchrSortOrder: 300,
  vchrTypeId: 3,
  vchrTypeCode: 'Bil',
  vchrTypeName: 'Sales Bill',
  vchrTypeShort: 'Bil',
  vchrNoPrefix: 'bil',
  vchrPrintTitle: 'TAX INVOICE',
});
const SRT = row({
  vchrSortOrder: 320,
  vchrTypeId: 18,
  vchrTypeCode: 'SRt',
  vchrTypeName: 'Sales Return',
  vchrTypeShort: 'SRt',
  vchrNoPrefix: 'srt',
  vchrNature: 'CREDIT_NOTE',
  vchrRaiseBillType: 'JOURNAL',
  vchrGstRegister: 'GSTR1_9B',
});
const JRL = row({
  vchrTypeId: 24,
  vchrTypeCode: 'Jrl',
  vchrTypeName: 'Journal',
  vchrTypeShort: 'Jrl',
  vchrNoPrefix: 'jrl',
  vchrNoSuffix: null,
  vchrGstSide: null,
  vchrGstRegister: null,
  vchrPartyMode: 'MANY',
  vchrBillwiseMode: 'OPTIONAL',
  vchrRaiseBillType: null,
  vchrInRegister: true,
  vchrMenuId: 103,
  vchrSortOrder: 30,
});

interface World {
  types: AccVoucherType[];
  rights: boolean;
  bills: number;
  used: boolean;
  counterThisYear: boolean;
  offline: boolean;
  tokenCompany: string | null;
  branches: Array<{
    br_id: string;
    br_name: string;
    br_comp_id: string;
    br_is_default: boolean;
    code: string | null;
    gstin: string | null;
  }>;
  offerBaseStored: string | null;
  /** advisory locks taken (their key values), in order */
  locks: string[][];
  /** the SQL of the clone's "code taken" read */
  takenSql: string[];
  /** the rule fragments printDesigns sent */
  designSql: Array<{ sql: string }>;
  /** an error the next accVoucherType.create throws (a race) */
  createError: unknown;
  /** what longestLiveDeviceCode reads (challan plan decision 32); null = no live device */
  longestDevice: string | null;
  /** the company each device_master read was bound to */
  deviceCompanies: unknown[];
}

const makeWorld = (over: Partial<World> = {}): World => ({
  types: [BASE3, SRT, JRL].map((t) => ({ ...t })),
  rights: true,
  bills: 0,
  used: false,
  counterThisYear: false,
  offline: false,
  tokenCompany: null,
  branches: [
    {
      br_id: CBE,
      br_name: 'Coimbatore',
      br_comp_id: ACME,
      br_is_default: true,
      code: 'CBE',
      gstin: '33AAPCA6346P1Z2',
    },
    {
      br_id: C2,
      br_name: 'Counter2',
      br_comp_id: ACME,
      br_is_default: false,
      code: 'COUNTER2',
      gstin: '33AAPCA6346P1Z2',
    },
  ],
  offerBaseStored: null,
  locks: [],
  takenSql: [],
  designSql: [],
  createError: null,
  longestDevice: null,
  deviceCompanies: [],
  ...over,
});

const makeService = (w: World) => {
  let nextId = 100;
  const matches = (t: AccVoucherType, where: Record<string, unknown> = {}): boolean => {
    if (Array.isArray(where.OR)) {
      if (!(where.OR as Record<string, unknown>[]).some((c) => matches(t, c))) return false;
    }
    if ('vchrCompanyId' in where && t.vchrCompanyId !== where.vchrCompanyId) return false;
    if ('vchrIsActive' in where && t.vchrIsActive !== where.vchrIsActive) return false;
    const code = where.vchrTypeCode as { startsWith?: string } | undefined;
    if (code?.startsWith && !t.vchrTypeCode.toLowerCase().startsWith(code.startsWith.toLowerCase()))
      return false;
    return true;
  };
  const executeRaw = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join('?');
    if (sql.includes('UPDATE public.app_setting_value')) {
      if (w.offerBaseStored === null) return 0;
      w.offerBaseStored = String(values[0]);
      return 1;
    }
    if (sql.includes('INSERT INTO public.app_setting_value')) {
      w.offerBaseStored = String(values[2]);
      return 1;
    }
    return 0;
  });
  const queryRaw = jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = strings.join('?');
    if (sql.includes('FROM public.user_menus')) {
      return w.rights
        ? [
            {
              um_can_view: true,
              um_can_create: true,
              um_can_edit: true,
              um_can_delete: true,
              um_can_print: true,
              um_can_export: true,
            },
          ]
        : [];
    }
    if (sql.includes('pg_advisory_xact_lock')) {
      w.locks.push(values.map(String));
      return [{ locked: 1 }];
    }
    if (sql.includes('FOR UPDATE')) return [{ vchr_type_id: 1 }];
    if (sql.includes('FROM public.companys')) return [{ comp_id: ACME }];
    if (sql.includes('AS used')) return [{ used: w.used }];
    if (sql.includes('n FROM sales.sale_bill')) return [{ n: w.bills }];
    if (sql.includes('n FROM accounts.acc_voucher_seq')) return [{ n: w.counterThisYear ? 1 : 0 }];
    if (sql.includes('last_refno')) return [];
    if (sql.includes('AS has_counter')) {
      return w.branches
        .filter((b) => b.br_comp_id === ACME)
        .map((b) => ({
          br_id: b.br_id,
          br_name: b.br_name,
          br_is_default: b.br_is_default,
          code: b.code,
          has_counter: b.br_id === CBE,
          refno: b.br_id === CBE ? 'SRT/2026-2027/D9/00056' : null,
        }));
    }
    if (sql.includes('n FROM accounts.acc_voucher_header')) return [{ n: 620 }];
    if (sql.includes('AS refno, avh_voucher_date AS vdate')) {
      return [{ refno: 'SRT/2026-2027/D9/00056', vdate: new Date('2026-11-14T00:00:00.000Z') }];
    }
    if (sql.includes('FROM fixed.device_master')) {
      w.deviceCompanies.push(values[0]);
      return w.longestDevice ? [{ dev_code: w.longestDevice }] : [];
    }
    if (sql.includes('FROM public.branch_master b')) return w.branches;
    if (sql.includes('FROM public.print_purpose p')) {
      // values: the layout rule (Sql), the assignment rule (Sql), docType, sharedOnly, company
      const sharedOnly = values.find((v) => typeof v === 'boolean') === true;
      w.designSql.push(
        ...values.filter((v): v is { sql: string } => typeof v === 'object' && v !== null && 'sql' in v),
      );
      return [
        {
          ppo_id: 'ppo-sale',
          ppo_code: 'SALE_INVOICE',
          ppo_name: 'Tax Invoice',
          ppo_copy_count: 3,
          ppo_copy_labels: 'O,D,T',
          is_shared: true,
          has_layout: true,
          has_assignment: true,
        },
        {
          ppo_id: 'ppo-own',
          ppo_code: 'RETAIL',
          ppo_name: 'Retail',
          ppo_copy_count: 3,
          ppo_copy_labels: 'O,D,T',
          is_shared: false,
          // drawn and published in menu 62, nothing in menu 248 yet (S2)
          has_layout: true,
          has_assignment: false,
        },
      ].filter((p) => !sharedOnly || p.is_shared);
    }
    if (sql.includes('ppo_allow_reprint')) {
      return values.includes('SALE_INVOICE')
        ? [
            {
              ppo_id: 'ppo-sale',
              ppo_src_module: 'SALES',
              ppo_doc_type: 'SALE_BILL',
              ppo_copy_count: 3,
              ppo_copy_labels: 'O,D,T',
              ppo_allow_reprint: true,
              ppo_sort_order: 10,
              ppo_name: 'Tax Invoice',
            },
          ]
        : [];
    }
    if (sql.includes('SELECT ppo_id FROM public.print_purpose')) {
      w.takenSql.push(sql);
      // SALE_INVOICE is shared; ZT_SUGI_ONLY belongs to another company (S1)
      return values.includes('SALE_INVOICE') || values.includes('ZT_SUGI_ONLY')
        ? [{ ppo_id: 'ppo-x' }]
        : [];
    }
    if (sql.includes('AS v')) return [{ v: w.offerBaseStored }];
    return [];
  });
  const accVoucherType = {
    findUnique: jest.fn(
      async ({ where }: { where: { vchrTypeId: number } }) =>
        w.types.find((t) => t.vchrTypeId === where.vchrTypeId) ?? null,
    ),
    findMany: jest.fn(async ({ where }: { where?: Record<string, unknown> } = {}) =>
      w.types
        .filter((t) => matches(t, where))
        .sort((a, b) => a.vchrSortOrder - b.vchrSortOrder || a.vchrTypeId - b.vchrTypeId),
    ),
    create: jest.fn(async ({ data }: { data: Partial<AccVoucherType> }) => {
      if (w.createError) {
        throw w.createError;
      }
      const r = row({ ...data, vchrTypeId: nextId++ });
      w.types.push(r);
      return r;
    }),
    update: jest.fn(
      async ({ where, data }: { where: { vchrTypeId: number }; data: Partial<AccVoucherType> }) => {
        const i = w.types.findIndex((t) => t.vchrTypeId === where.vchrTypeId);
        w.types[i] = { ...w.types[i], ...data };
        return w.types[i];
      },
    ),
    delete: jest.fn(async ({ where }: { where: { vchrTypeId: number } }) => {
      w.types = w.types.filter((t) => t.vchrTypeId !== where.vchrTypeId);
    }),
  };
  const tx = {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
    accVoucherType,
    printPurpose: {
      findUnique: jest.fn(async () => null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
        ppoId: 'ppo-new',
        ...data,
      })),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const audit = { logEntityChange: jest.fn(async () => undefined) };
  const ctx = { getUserId: () => USER, getCompanyId: () => w.tokenCompany };
  const config = {
    get: jest.fn((key: string) => (key === 'cloudSync.enabled' ? w.offline : undefined)),
  };
  const service = new VoucherTypesService(
    prisma as unknown as PrismaService,
    ctx as unknown as RequestContextService,
    audit as unknown as AuditLogService,
    config as unknown as ConfigService,
  );
  return { service, prisma, audit, accVoucherType, executeRaw, printPurpose: tx.printPurpose };
};

const child = (over: Partial<SaveVoucherTypeDto> = {}): SaveVoucherTypeDto => ({
  companyId: ACME,
  vchrParentId: 3,
  vchrTypeName: 'Retail Sales',
  vchrTypeShort: 'RT',
  vchrNumberingMode: VoucherNumberingMode.AUTO,
  vchrNoPrefix: 'RT{BR}',
  vchrNoSuffix: null,
  vchrNoWidth: 4,
  vchrStartNo: 1,
  branchId: CBE,
  accYear: '2026-2027',
  ...over,
});

const base3 = (over: Partial<SaveVoucherTypeDto> = {}): SaveVoucherTypeDto => ({
  companyId: ACME,
  vchrTypeId: 3,
  vchrParentId: null,
  vchrTypeName: 'Sales Bill',
  vchrTypeShort: 'Bil',
  vchrIsActive: true,
  vchrNumberingMode: VoucherNumberingMode.AUTO,
  vchrNoPrefix: 'bil',
  vchrNoSuffix: null,
  vchrNoWidth: 5,
  vchrResetFreq: VoucherResetFreq.YEARLY,
  vchrStartNo: 1,
  vchrPrintTitle: 'TAX INVOICE',
  vchrPrintPurposeId: null,
  vchrPrintAfterPost: false,
  vchrSortOrder: 300,
  vchrTallyVoucherTypeName: 'Sales',
  ...over,
});

async function refusal(p: Promise<unknown>): Promise<{ error: unknown; codes: string[] }> {
  try {
    await p;
  } catch (error) {
    const body = (
      error as { getResponse?: () => { errors?: Array<{ code: string }> } }
    ).getResponse?.();
    return { error, codes: (body?.errors ?? []).map((e) => e.code) };
  }
  throw new Error('expected a refusal');
}

describe('VoucherTypesService.save', () => {
  it('refuses 403 VT_OFFLINE on an offline site before anything else (Q16, decision 41)', async () => {
    const w = makeWorld({ offline: true });
    const { service, prisma } = makeService(w);

    const r = await refusal(service.save(child()));

    expect(r.error).toBeInstanceOf(ForbiddenException);
    expect(r.codes).toEqual(['VT_OFFLINE']);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses 403 VT_RIGHT_CREATE without the Create right on menu 303', async () => {
    const { service, accVoucherType } = makeService(makeWorld({ rights: false }));

    const r = await refusal(service.save(child()));

    expect(r.error).toBeInstanceOf(ForbiddenException);
    expect(r.codes).toEqual(['VT_RIGHT_CREATE']);
    expect(accVoucherType.create).not.toHaveBeenCalled();
  });

  it('refuses 403 VT_COMPANY_MISMATCH for a body naming another company than the token’s', async () => {
    const { service } = makeService(makeWorld({ tokenCompany: OTHER }));

    expect((await refusal(service.save(child()))).codes).toEqual(['VT_COMPANY_MISMATCH']);
  });

  it('creates a child: server code, company, parent, the base’s accounting mirrored (decisions 31 / 32)', async () => {
    const w = makeWorld();
    const { service, accVoucherType, audit } = makeService(w);

    const out = await service.save(child());

    const data = accVoucherType.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      vchrTypeCode: 'Bil-RT',
      vchrTypeName: 'Retail Sales',
      vchrTypeShort: 'RT',
      vchrParentId: 3,
      vchrCompanyId: ACME,
      vchrNoPrefix: 'RT{BR}',
      vchrNoWidth: 4,
      vchrStartNo: 1,
      vchrTallyVoucherTypeName: 'Retail Sales',
      // the mirror
      vchrNature: 'SALES',
      vchrCategory: 'BOTH',
      vchrPartyMode: 'ONE',
      vchrPartySide: 'ANY',
      vchrBillwiseMode: 'RAISE',
      vchrRaiseBillType: 'SALES',
      vchrGstRegister: 'GSTR1',
      vchrGstSide: 'OUTPUT',
      vchrTallyBaseVoucherType: 'Sales',
    });
    expect(audit.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'New',
        tableName: 'accounts.acc_voucher_types',
        screenName: 'Voucher Types',
      }),
      expect.anything(),
    );
    expect(out.type.vchrTypeCode).toBe('Bil-RT');
    expect(out).toMatchObject({
      isBase: false,
      numberedBy: 'COUNTER',
      allowedMethods: ['AUTO'],
      offerBase: null,
      warnings: [],
    });
    expect(out.preview).toMatchObject({ sample: 'RT' + 'CBE0001', gstLimit: 16 });
  });

  it('takes -2 when another company already holds Bil-RT', async () => {
    const w = makeWorld();
    w.types.push(
      row({
        vchrTypeId: 90,
        vchrTypeCode: 'Bil-RT',
        vchrTypeName: 'Retail',
        vchrTypeShort: 'RT',
        vchrParentId: 3,
        vchrCompanyId: OTHER,
        vchrNoPrefix: 'R{BR}',
      }),
    );
    const { service, accVoucherType } = makeService(w);

    await service.save(child());

    expect(accVoucherType.create.mock.calls[0][0].data.vchrTypeCode).toBe('Bil-RT-2');
  });

  it('refuses 422 with every numbering refusal at once, writing nothing', async () => {
    const { service, accVoucherType } = makeService(makeWorld());

    const r = await refusal(
      service.save(
        child({
          vchrNumberingMode: VoucherNumberingMode.MANUAL,
          vchrNoPrefix: 'RT/{YY}/',
          vchrNoWidth: 10,
          vchrStartNo: 0,
        }),
      ),
    );

    expect(r.error).toBeInstanceOf(UnprocessableEntityException);
    expect(r.codes).toEqual([
      'VT_WIDTH_INVALID',
      'VT_START_NO_INVALID',
      'VT_METHOD_GST_AUTO_ONLY',
      'VT_BR_REQUIRED',
    ]);
    expect(accVoucherType.create).not.toHaveBeenCalled();
  });

  it('refuses a new type with no parent or a parent other than Sales Bill (VT_PARENT_NOT_ALLOWED)', async () => {
    const { service } = makeService(makeWorld());

    expect((await refusal(service.save(child({ vchrParentId: null })))).codes).toContain(
      'VT_PARENT_NOT_ALLOWED',
    );
    expect((await refusal(service.save(child({ vchrParentId: 18 })))).codes).toContain(
      'VT_PARENT_NOT_ALLOWED',
    );
  });

  it('refuses VT_PARENT_LOCKED for a child with bills whose parent changes', async () => {
    const w = makeWorld({ bills: 3 });
    w.types.push(
      row({
        vchrTypeId: 91,
        vchrTypeCode: 'Bil-RT',
        vchrTypeName: 'Retail Sales',
        vchrTypeShort: 'RT',
        vchrParentId: 3,
        vchrCompanyId: ACME,
        vchrNoPrefix: 'RT{BR}',
        vchrNoWidth: 4,
      }),
    );
    const { service } = makeService(w);

    expect(
      (await refusal(service.save(child({ vchrTypeId: 91, vchrParentId: 18 })))).codes,
    ).toEqual(expect.arrayContaining(['VT_PARENT_LOCKED', 'VT_PARENT_NOT_ALLOWED']));
  });

  it('refuses a design that is not a SALE_BILL design of this company or shared (VT_PURPOSE_INVALID)', async () => {
    const { service } = makeService(makeWorld());

    expect(
      (
        await refusal(
          service.save(child({ vchrPrintPurposeId: '01a041fa-d3c1-79ce-9276-fff34490863d' })),
        )
      ).codes,
    ).toEqual(['VT_PURPOSE_INVALID']);
  });

  it('lets a child name a company design; a base only a shared one', async () => {
    const { service } = makeService(makeWorld());
    await expect(service.save(child({ vchrPrintPurposeId: 'ppo-own' }))).resolves.toBeDefined();
    expect((await refusal(service.save(base3({ vchrPrintPurposeId: 'ppo-own' })))).codes).toEqual([
      'VT_PURPOSE_INVALID',
    ]);
  });

  describe('a base type (Q17, OP-2)', () => {
    it.each([
      ['vchrTypeName', { vchrTypeName: 'Sales Invoice' }],
      ['vchrTypeShort', { vchrTypeShort: 'SI' }],
      ['vchrIsActive', { vchrIsActive: false }],
      ['vchrTallyVoucherTypeName', { vchrTallyVoucherTypeName: 'Sales 2' }],
      ['vchrParentId', { vchrParentId: 3 }],
    ])('refuses a changed %s (VT_BASE_FIELD_LOCKED)', async (field, change) => {
      const { service, accVoucherType } = makeService(makeWorld());

      const r = await refusal(service.save(base3(change)));

      expect(r.codes).toEqual(['VT_BASE_FIELD_LOCKED']);
      expect(accVoucherType.update).not.toHaveBeenCalled();
      void field;
    });

    it('saves unchanged numbering on a company whose branches share a GSTIN (C7: the check fires on the next numbering edit)', async () => {
      const { service, accVoucherType } = makeService(makeWorld());

      await service.save(base3());

      // '' stored vs null sent is no change: nothing is written to the shared row.
      expect(accVoucherType.update).not.toHaveBeenCalled();
    });

    it('refuses a numbering edit without {BR} there (VT_BR_REQUIRED)', async () => {
      const { service } = makeService(makeWorld());

      expect((await refusal(service.save(base3({ vchrNoPrefix: 'BL/' })))).codes).toEqual([
        'VT_BR_REQUIRED',
      ]);
    });

    it('writes only what differs on a base, and warns C5 when a counter of this year exists', async () => {
      const { service, accVoucherType } = makeService(makeWorld({ counterThisYear: true }));

      const out = await service.save(base3({ vchrNoPrefix: 'bil{BR}', vchrPrintAfterPost: true }));

      const data = accVoucherType.update.mock.calls[0][0].data;
      expect(data).toMatchObject({ vchrNoPrefix: 'bil{BR}', vchrPrintAfterPost: true });
      expect(Object.keys(data).sort()).toEqual([
        'vchrNoPrefix',
        'vchrPrintAfterPost',
        'vchrUpdatedBy',
        'vchrUpdatedOn',
      ]);
      expect(out.warnings.map((x) => x.code)).toEqual(['VT_FORMAT_NEXT_COUNTER']);
    });

    it('writes offerBase as the company’s COMPANY-scope setting (decision 33)', async () => {
      const w = makeWorld();
      const { service, executeRaw } = makeService(w);

      const out = await service.save(base3({ offerBase: true }));

      expect(executeRaw).toHaveBeenCalledTimes(2); // UPDATE found nothing, then INSERT
      expect(w.offerBaseStored).toBe('true');
      expect(out.offerBase).toBe(true);
    });

    it('keeps a screen-numbered row’s numbering (Q26)', async () => {
      const { service } = makeService(makeWorld());

      const r = await refusal(
        service.save({
          companyId: ACME,
          vchrTypeId: 18,
          vchrNoPrefix: 'SR/',
        }),
      );

      expect(r.codes).toEqual(['VT_BASE_FIELD_LOCKED']);
    });

    it('lets a non-GST base go over 16 with a VT_NO_OVER_16 warning', async () => {
      const { service } = makeService(makeWorld());

      const out = await service.save({
        companyId: ACME,
        vchrTypeId: 24,
        vchrNoPrefix: 'JRL/{FY}/{BR}/',
      });

      expect(out.warnings.map((x) => x.code)).toEqual(['VT_NO_OVER_16']);
    });
  });
});

describe('VoucherTypesService.save — the challan 19 / return 20 (challan plan decision 32)', () => {
  const DCH = row({
    vchrTypeId: 19,
    vchrTypeCode: 'DCh',
    vchrTypeName: 'Delivery Challan',
    vchrTypeShort: 'DCh',
    vchrNature: 'SALES',
    vchrNoPrefix: 'dc',
    vchrNoSuffix: null,
    vchrGstSide: null,
    vchrGstRegister: null,
    vchrGstDocNo: true,
    vchrSortOrder: 190,
  });
  const DCR = row({
    ...DCH,
    vchrTypeId: 20,
    vchrTypeCode: 'DCR',
    vchrTypeName: 'Delivery Challan Return',
    vchrTypeShort: 'DCR',
    vchrNoPrefix: 'dcr',
    vchrSortOrder: 200,
  });
  const world = (over: Partial<World> = {}) =>
    makeWorld({ types: [BASE3, SRT, JRL, DCH, DCR].map((t) => ({ ...t })), ...over });

  it.each([
    [19, 'DC{FYC}{DV}-', 'DC2627D14-00001'],
    [20, 'DR{FYC}{DV}-', 'DR2627D14-00001'],
  ])(
    'saves type %p with %p, width 5, at a company whose branches share a GSTIN (no {BR} asked)',
    async (vchrTypeId, prefix, sample) => {
      const w = world({ longestDevice: 'D14' });
      const { service, accVoucherType } = makeService(w);

      const out = await service.save({
        companyId: ACME,
        vchrTypeId,
        vchrNoPrefix: prefix,
        vchrNoWidth: 5,
        accYear: '2026-2027',
      });

      expect(accVoucherType.update.mock.calls[0][0].data).toMatchObject({ vchrNoPrefix: prefix });
      expect(out.preview).toMatchObject({ sample, length: 15, gstLimit: 16, deviceCode: 'D14' });
      expect(out.warnings).toEqual([]);
      // A base numbers in every company: its devices are judged across all of them.
      expect(w.deviceCompanies.length).toBeGreaterThan(0);
      expect(w.deviceCompanies.every((c) => c === null)).toBe(true);
    },
  );

  it('refuses 422 VT_NO_TOO_LONG while a live device has a 5-character code, writing nothing', async () => {
    const { service, accVoucherType } = makeService(world({ longestDevice: 'ZTA-5' }));

    const r = await refusal(
      service.save({
        companyId: ACME,
        vchrTypeId: 19,
        vchrNoPrefix: 'DC{FYC}{DV}-',
        vchrNoWidth: 5,
        accYear: '2026-2027',
      }),
    );

    expect(r.error).toBeInstanceOf(UnprocessableEntityException);
    expect(r.codes).toEqual(['VT_NO_TOO_LONG']);
    expect(accVoucherType.update).not.toHaveBeenCalled();
  });

  it('refuses a width that takes D14 past 16 (VT_NO_TOO_LONG); a 4-character code at 16 saves', async () => {
    const wide = makeService(world({ longestDevice: 'D14' }));
    expect(
      (
        await refusal(
          wide.service.save({ companyId: ACME, vchrTypeId: 19, vchrNoPrefix: 'DC{FYC}{DV}-', vchrNoWidth: 7 }),
        )
      ).codes,
    ).toEqual(['VT_NO_TOO_LONG']);

    const four = makeService(world({ longestDevice: 'D999' }));
    const out = await four.service.save({
      companyId: ACME,
      vchrTypeId: 19,
      vchrNoPrefix: 'DC{FYC}{DV}-',
      vchrNoWidth: 5,
      accYear: '2026-2027',
    });
    expect(out.preview).toMatchObject({ sample: 'DC2627D999-00001', length: 16 });
  });

  it('answers the flag on /get: type.vchrGstDocNo and the 16 limit on the strip', async () => {
    const { service } = makeService(world({ longestDevice: 'D14' }));

    const out = await service.get({
      companyId: ACME,
      branchId: CBE,
      accYear: '2026-2027',
      vchrTypeId: 19,
    });

    expect(out.type.vchrGstDocNo).toBe(true);
    expect(out.preview.gstLimit).toBe(16);
  });
});

describe('VoucherTypesService.validate', () => {
  it('lists every refusal without writing, with the preview', async () => {
    const { service, accVoucherType } = makeService(makeWorld());

    const v = await service.validate(
      child({
        vchrTypeName: 'sales bill',
        vchrTypeShort: 'bil',
        vchrNoPrefix: 'ZT/{FY}/',
        vchrNoWidth: 5,
      }),
    );

    expect(v.ok).toBe(false);
    expect(v.errors.map((e) => e.code)).toEqual([
      'VT_NAME_TAKEN',
      'VT_ABBR_TAKEN',
      'VT_NO_TOO_LONG',
      'VT_BR_REQUIRED',
    ]);
    expect(v.preview).toMatchObject({ sample: 'ZT/2026-2027/00001', length: 18, gstLimit: 16 });
    expect(accVoucherType.create).not.toHaveBeenCalled();
    expect(accVoucherType.update).not.toHaveBeenCalled();
  });
});

describe('VoucherTypesService delete / inactivate (Q8, C4)', () => {
  const withChild = (over: Partial<World> = {}) => {
    const w = makeWorld(over);
    w.types.push(
      row({
        vchrTypeId: 92,
        vchrTypeCode: 'Bil-RT',
        vchrTypeName: 'Retail Sales',
        vchrTypeShort: 'RT',
        vchrParentId: 3,
        vchrCompanyId: ACME,
      }),
    );
    return w;
  };

  it('deletes an unused child', async () => {
    const { service, accVoucherType } = makeService(withChild());

    await expect(service.remove({ companyId: ACME, vchrTypeId: 92 })).resolves.toEqual({
      vchrTypeId: 92,
      deleted: true,
      name: 'Retail Sales',
    });
    expect(accVoucherType.delete).toHaveBeenCalled();
  });

  it('refuses 409 VT_IN_USE for a used child', async () => {
    const { service, accVoucherType } = makeService(withChild({ used: true }));

    const r = await refusal(service.remove({ companyId: ACME, vchrTypeId: 92 }));

    expect(r.error).toBeInstanceOf(ConflictException);
    expect(r.codes).toEqual(['VT_IN_USE']);
    expect(accVoucherType.delete).not.toHaveBeenCalled();
  });

  it('refuses a base (VT_BASE_FIELD_LOCKED) for delete and inactivate', async () => {
    const { service } = makeService(withChild());

    expect((await refusal(service.remove({ companyId: ACME, vchrTypeId: 3 }))).codes).toEqual([
      'VT_BASE_FIELD_LOCKED',
    ]);
    expect((await refusal(service.inactivate({ companyId: ACME, vchrTypeId: 3 }))).codes).toEqual([
      'VT_BASE_FIELD_LOCKED',
    ]);
  });

  it('makes a used child inactive', async () => {
    const w = withChild({ used: true });
    const { service } = makeService(w);

    await expect(service.inactivate({ companyId: ACME, vchrTypeId: 92 })).resolves.toEqual({
      vchrTypeId: 92,
      vchrIsActive: false,
      name: 'Retail Sales',
    });
    expect(w.types.find((t) => t.vchrTypeId === 92)?.vchrIsActive).toBe(false);
  });

  it('answers 403 VT_COMPANY_MISMATCH for another company’s child', async () => {
    const { service } = makeService(withChild());

    expect((await refusal(service.remove({ companyId: OTHER, vchrTypeId: 92 }))).codes).toEqual([
      'VT_COMPANY_MISMATCH',
    ]);
  });

  it('answers 404 VT_NOT_FOUND for no such type', async () => {
    const { service } = makeService(withChild());

    expect((await refusal(service.remove({ companyId: ACME, vchrTypeId: 999 }))).codes).toEqual([
      'VT_NOT_FOUND',
    ]);
  });
});

describe('VoucherTypesService.tree', () => {
  it('lists bases and this company’s children only, each child after its base', async () => {
    const w = makeWorld();
    w.types.push(
      row({
        vchrTypeId: 93,
        vchrTypeCode: 'Bil-RT',
        vchrTypeName: 'Retail',
        vchrParentId: 3,
        vchrCompanyId: ACME,
        vchrSortOrder: 301,
      }),
    );
    w.types.push(
      row({
        vchrTypeId: 94,
        vchrTypeCode: 'Bil-WS',
        vchrTypeName: 'Wholesale',
        vchrParentId: 3,
        vchrCompanyId: OTHER,
        vchrSortOrder: 301,
      }),
    );
    const { service } = makeService(w);

    const { nodes } = await service.tree(ACME);

    expect(nodes.map((n) => n.vchrTypeId)).toEqual([24, 3, 93, 18]);
    expect(nodes.find((n) => n.vchrTypeId === 3)).toMatchObject({
      childCount: 1,
      canHaveChildren: true,
      kind: 'DOCUMENT',
    });
    expect(nodes.find((n) => n.vchrTypeId === 18)).toMatchObject({ numberedBy: 'SCREEN' });
    expect(nodes.find((n) => n.vchrTypeId === 24)).toMatchObject({ kind: 'VOUCHER_REGISTER' });
  });
});

describe('VoucherTypesService.clonePrintDesign (Alt+C, decision 36)', () => {
  it('copies a shared design as the company’s own: same kind, copies and labels, no layout', async () => {
    const { service, printPurpose } = makeService(makeWorld());

    const out = await service.clonePrintDesign({
      companyId: ACME,
      fromPpoCode: 'SALE_INVOICE',
      ppoCode: 'retail_invoice',
      ppoName: ' Retail Invoice ',
    });

    expect(printPurpose.create.mock.calls[0][0].data).toMatchObject({
      ppoCompanyId: ACME,
      ppoCode: 'RETAIL_INVOICE',
      ppoName: 'Retail Invoice',
      ppoSrcModule: 'SALES',
      ppoDocType: 'SALE_BILL',
      ppoCopyCount: 3,
      ppoCopyLabels: 'O,D,T',
      ppoAllowReprint: true,
      ppoSortOrder: 11,
      ppoCreatedBy: USER,
    });
    expect(out).toEqual({
      ppoId: 'ppo-new',
      ppoCode: 'RETAIL_INVOICE',
      ppoName: 'Retail Invoice',
      ppoCopyCount: 3,
      ppoCopyLabels: 'O,D,T',
      isShared: false,
      hasLayout: false,
      hasAssignment: false,
    });
  });

  it('refuses a code already used (409 VT_PURPOSE_CODE_TAKEN) and an unknown source (422 VT_PURPOSE_INVALID)', async () => {
    const { service, printPurpose } = makeService(makeWorld());

    const taken = await refusal(
      service.clonePrintDesign({
        companyId: ACME,
        fromPpoCode: 'SALE_INVOICE',
        ppoCode: 'sale_invoice',
        ppoName: 'X',
      }),
    );
    expect(taken.error).toBeInstanceOf(ConflictException);
    expect(taken.codes).toEqual(['VT_PURPOSE_CODE_TAKEN']);
    const unknown = await refusal(
      service.clonePrintDesign({
        companyId: ACME,
        fromPpoCode: 'NOPE',
        ppoCode: 'ZT_X',
        ppoName: 'X',
      }),
    );
    expect(unknown.codes).toEqual(['VT_PURPOSE_INVALID']);
    expect(printPurpose.create).not.toHaveBeenCalled();
  });

  it('refuses VT_OFFLINE on an offline site', async () => {
    const { service } = makeService(makeWorld({ offline: true }));

    expect(
      (
        await refusal(
          service.clonePrintDesign({
            companyId: ACME,
            fromPpoCode: 'SALE_INVOICE',
            ppoCode: 'ZT_X',
            ppoName: 'X',
          }),
        )
      ).codes,
    ).toEqual(['VT_OFFLINE']);
  });
});

describe('VoucherTypesService.get — added 11-15 round 2', () => {
  it('answers the voucher count, the last number at the branch, the branches and the strip’s branch name', async () => {
    const { service } = makeService(makeWorld());

    const d = await service.get({
      companyId: ACME,
      branchId: CBE,
      accYear: '2026-2027',
      vchrTypeId: 18,
    });

    expect(d).toMatchObject({
      numberedBy: 'SCREEN',
      voucherCount: 620,
      lastVoucherRefno: 'SRT/2026-2027/D9/00056',
      lastVoucherDate: '2026-11-14',
      branches: [
        {
          branchId: CBE,
          branchName: 'Coimbatore',
          branchCode: 'CBE',
          isDefault: true,
          hasCounter: true,
          lastVoucherRefno: 'SRT/2026-2027/D9/00056',
        },
        {
          branchId: C2,
          branchName: 'Counter2',
          branchCode: 'COUNTER2',
          isDefault: false,
          hasCounter: false,
          lastVoucherRefno: null,
        },
      ],
    });
    expect(d.preview).toMatchObject({ branchName: 'Coimbatore', branchCode: 'CBE', sample: null });
  });

  it('puts the prefix and suffix on every tree node', async () => {
    const { service } = makeService(makeWorld());

    const { nodes } = await service.tree(ACME);

    expect(nodes.find((n) => n.vchrTypeId === 3)).toMatchObject({
      vchrNoPrefix: 'bil',
      vchrNoSuffix: '',
    });
    expect(nodes.find((n) => n.vchrTypeId === 24)).toMatchObject({
      vchrNoPrefix: 'jrl',
      vchrNoSuffix: null,
    });
  });
});

describe('review round 11-15', () => {
  describe('S1 / decision 61 — Alt+C codes are unique across every company', () => {
    it('refuses 409 VT_PURPOSE_CODE_TAKEN for a code another company holds', async () => {
      const w = makeWorld();
      const { service, printPurpose } = makeService(w);

      const taken = await refusal(
        service.clonePrintDesign({
          companyId: ACME,
          fromPpoCode: 'SALE_INVOICE',
          ppoCode: 'zt_sugi_only',
          ppoName: 'X',
        }),
      );
      expect(taken.error).toBeInstanceOf(ConflictException);
      expect(taken.codes).toEqual(['VT_PURPOSE_CODE_TAKEN']);
      expect(printPurpose.create).not.toHaveBeenCalled();
      // the read looks at every company: no company filter left
      expect(w.takenSql).toHaveLength(1);
      expect(w.takenSql[0]).not.toContain('ppo_company_id');
    });

    it('takes the code lock before it reads, so two companies cloning one code take turns', async () => {
      const w = makeWorld();
      const { service } = makeService(w);

      await service.clonePrintDesign({
        companyId: ACME,
        fromPpoCode: 'SALE_INVOICE',
        ppoCode: 'retail_invoice',
        ppoName: 'Retail Invoice',
      });
      expect(w.locks).toContainEqual(['public.print_purpose.clone_code', 'RETAIL_INVOICE']);
    });

    it('answers VT_PURPOSE_CODE_TAKEN, not a 500, when ux_ppo_code still fires', async () => {
      const w = makeWorld();
      const { service, printPurpose } = makeService(w);
      printPurpose.create.mockRejectedValueOnce(
        Object.assign(new Error('unique'), { code: 'P2002', meta: { target: 'ux_ppo_code' } }),
      );

      const r = await refusal(
        service.clonePrintDesign({
          companyId: ACME,
          fromPpoCode: 'SALE_INVOICE',
          ppoCode: 'ZT_RACE',
          ppoName: 'X',
        }),
      );
      expect(r.error).toBeInstanceOf(ConflictException);
      expect(r.codes).toEqual(['VT_PURPOSE_CODE_TAKEN']);
    });
  });

  describe('S2 / decision 62 — printDesigns say "no assignment yet"', () => {
    it('answers hasAssignment beside hasLayout, from the shared rule with the company bound', async () => {
      const w = makeWorld({ types: [BASE3, SRT, JRL, row({ ...BASE3, vchrTypeId: 68, vchrTypeCode: 'Bil-RT', vchrTypeName: 'Retail', vchrTypeShort: 'RT', vchrParentId: 3, vchrCompanyId: ACME })] });
      const { service } = makeService(w);

      const d = await service.get({
        companyId: ACME,
        branchId: CBE,
        accYear: '2026-2027',
        vchrTypeId: 68,
      });
      expect(d.printDesigns.map((p) => [p.ppoCode, p.hasLayout, p.hasAssignment])).toEqual([
        ['SALE_INVOICE', true, true],
        ['RETAIL', true, false],
      ]);
      const rules = w.designSql.map((f) => f.sql);
      expect(rules.some((s) => s.includes('FROM public.print_template dl'))).toBe(true);
      expect(
        rules.some(
          (s) =>
            s.includes('FROM public.print_template_assignment da') &&
            s.includes('da.pta_branch_id IS NULL AND da.pta_device_id IS NULL'),
        ),
      ).toBe(true);
    });
  });

  describe('N1 — a race on the system code answers its own code', () => {
    it('maps each unique index to its own field and code', () => {
      expect(uniqueRaceIssue('uq_acc_voucher_types_code')).toMatchObject({
        code: 'VT_CODE_TAKEN',
        field: 'vchrTypeShort',
      });
      expect(uniqueRaceIssue('vchr_type_code')).toMatchObject({ code: 'VT_CODE_TAKEN' });
      expect(uniqueRaceIssue(null)).toMatchObject({ code: 'VT_CODE_TAKEN' });
      expect(uniqueRaceIssue('ux_vchr_company_short')).toMatchObject({
        code: 'VT_ABBR_TAKEN',
        field: 'vchrTypeShort',
      });
      expect(uniqueRaceIssue('vchr_company_id,vchr_type_name')).toMatchObject({
        code: 'VT_NAME_TAKEN',
        field: 'vchrTypeName',
      });
      expect(uniqueRaceIssue('uq_acc_voucher_types_code').message).toContain('Save again');
    });

    it('a create that loses the race on uq_acc_voucher_types_code is 409 VT_CODE_TAKEN, not VT_NAME_TAKEN', async () => {
      const w = makeWorld({
        createError: Object.assign(new Error('unique'), {
          code: 'P2002',
          meta: { target: 'uq_acc_voucher_types_code' },
        }),
      });
      const { service } = makeService(w);

      const r = await refusal(service.save(child()));
      expect(r.error).toBeInstanceOf(ConflictException);
      expect(r.codes).toEqual(['VT_CODE_TAKEN']);
    });

    it('picks the code under a lock held across companies (per base), after the per-company save lock', async () => {
      const w = makeWorld();
      const { service } = makeService(w);

      await service.save(child());
      const names = w.locks.map((l) => l[0]);
      expect(names).toEqual(['accounts.acc_voucher_types.save', 'accounts.acc_voucher_types.code']);
      expect(w.locks[1]).toEqual(['accounts.acc_voucher_types.code', 'Bil']);
    });
  });
});

describe('delivery mode (delivery tracking plan §8.4 item 11, Q3)', () => {
  it('saves a child’s mode, and keeps null (the base’s) when the key is left out', async () => {
    const { service, accVoucherType } = makeService(makeWorld());

    await service.save(child({ vchrDeliveryMode: 'PICKUP' }));
    expect(accVoucherType.create.mock.calls[0][0].data.vchrDeliveryMode).toBe('PICKUP');

    const { service: s2, accVoucherType: a2 } = makeService(makeWorld());
    const out = await s2.save(child());
    expect(a2.create.mock.calls[0][0].data.vchrDeliveryMode).toBeNull();
    expect(out).toMatchObject({
      deliveryModeApplies: true,
      inheritedDeliveryMode: null,
      effectiveDeliveryMode: 'INSTANT',
    });
  });

  it('answers the base’s mode as inherited and the effective one on a child', async () => {
    const w = makeWorld();
    w.types[0].vchrDeliveryMode = 'INSTANT';
    const { service } = makeService(w);

    const out = await service.save(child({ vchrDeliveryMode: 'DISPATCH' }));

    expect(out.type.vchrDeliveryMode).toBe('DISPATCH');
    expect(out).toMatchObject({
      deliveryModeApplies: true,
      inheritedDeliveryMode: 'INSTANT',
      effectiveDeliveryMode: 'DISPATCH',
    });
  });

  it('refuses a cleared mode on a Sales Bill type (VT_DELIVERY_MODE_REQUIRED), child and base', async () => {
    const { service, accVoucherType } = makeService(makeWorld());
    expect((await refusal(service.save(child({ vchrDeliveryMode: null })))).codes).toEqual([
      'VT_DELIVERY_MODE_REQUIRED',
    ]);
    expect((await refusal(service.save(base3({ vchrDeliveryMode: null })))).codes).toEqual([
      'VT_DELIVERY_MODE_REQUIRED',
    ]);
    expect(accVoucherType.create).not.toHaveBeenCalled();
    expect(accVoucherType.update).not.toHaveBeenCalled();
  });

  it('refuses a mode on any other type (VT_DELIVERY_MODE_NOT_ALLOWED); null there is fine', async () => {
    const { service } = makeService(makeWorld());

    const r = await refusal(
      service.save({ companyId: ACME, vchrTypeId: 24, vchrDeliveryMode: 'PICKUP' }),
    );
    expect(r.codes).toEqual(['VT_DELIVERY_MODE_NOT_ALLOWED']);

    const v = await service.validate({ companyId: ACME, vchrTypeId: 24, vchrDeliveryMode: null });
    expect(v.errors).toEqual([]);
    expect(v).toMatchObject({
      deliveryModeApplies: false,
      vchrDeliveryMode: null,
      inheritedDeliveryMode: null,
      effectiveDeliveryMode: null,
    });
  });

  it('writes the base’s new mode on Sales Bill itself, only that column', async () => {
    const w = makeWorld();
    w.types[0].vchrDeliveryMode = 'INSTANT';
    const { service, accVoucherType } = makeService(w);

    await service.save(base3({ vchrDeliveryMode: 'PICKUP' }));

    const data = accVoucherType.update.mock.calls[0][0].data;
    expect(Object.keys(data).sort()).toEqual(['vchrDeliveryMode', 'vchrUpdatedBy', 'vchrUpdatedOn']);
    expect(data.vchrDeliveryMode).toBe('PICKUP');
  });

  it('validate answers the mode the save would store', async () => {
    const w = makeWorld();
    w.types[0].vchrDeliveryMode = 'INSTANT';
    const { service } = makeService(w);

    const v = await service.validate(child({ vchrDeliveryMode: 'PICKUP' }));

    expect(v).toMatchObject({
      ok: true,
      vchrDeliveryMode: 'PICKUP',
      deliveryModeApplies: true,
      inheritedDeliveryMode: 'INSTANT',
      effectiveDeliveryMode: 'PICKUP',
    });
  });
});
