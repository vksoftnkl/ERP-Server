import { ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import type { RequestContextService } from '../../../common/request-context/request-context.service';
import { DaySummaryService } from './day-summary.service';

/**
 * Review N8 — /reports/day-summary/voucher-types?companyId= lists that company's
 * child type names, so it checks the company as /voucher-types/* do (decision
 * 66): a company-bound user may name only theirs, a user bound to none (VKPOS)
 * any live company; else 403 VT_COMPANY_MISMATCH.
 */

const ACME = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const SUGI = '01a1679e-3f4d-70a6-8acb-4f9ae047aedd';
const USER = '019e441b-6e48-7918-b246-b857ffb35db1';

const TYPES = [
  { id: 3, code: 'Bil', name: 'Sales Bill', parent_id: null, company_id: null },
  { id: 68, code: 'Bil-RT', name: 'Retail', parent_id: 3, company_id: ACME },
  { id: 90, code: 'Bil-RT-2', name: 'Sugi Retail', parent_id: 3, company_id: SUGI },
].map((t) => ({
  ...t,
  short: t.code,
  nature: 'SALES',
  category: 'BOTH',
  sort_order: t.id,
  is_active: true,
  affects_accounts: true,
}));

const make = (tokenCompany: string | null, liveCompanies: string[] = [ACME, SUGI]) => {
  const companyReads: unknown[][] = [];
  const tx = {
    $executeRaw: jest.fn(async () => 0),
    $queryRaw: jest.fn(async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const sql = strings.join('?');
      if (sql.includes('FROM public.user_menus')) return [{ ok: true }];
      if (sql.includes('FROM public.companys')) {
        companyReads.push(values);
        return liveCompanies.includes(String(values[0])) ? [{ comp_id: values[0] }] : [];
      }
      if (sql.includes('FROM accounts.acc_voucher_types')) return TYPES;
      return [];
    }),
  };
  const prisma = {
    $transaction: jest.fn(async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx)),
  };
  const ctx = { getUserId: () => USER, getCompanyId: () => tokenCompany };
  const service = new DaySummaryService(
    prisma as unknown as PrismaService,
    ctx as unknown as RequestContextService,
  );
  return { service, companyReads };
};

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

describe('DaySummaryService.voucherTypes — the company check (review N8)', () => {
  it('a user bound to no company (VKPOS) may name any live company, and sees its children only', async () => {
    const { service } = make(null);
    const sugi = await service.voucherTypes(SUGI);
    expect(sugi.items.map((t) => t.voucherTypeId)).toEqual([3, 90]);
    const acme = await service.voucherTypes(ACME.toUpperCase());
    expect(acme.items.map((t) => t.voucherTypeId)).toEqual([3, 68]);
  });

  it('a user bound to no company naming a company that is not live: 403 VT_COMPANY_MISMATCH', async () => {
    const { service } = make(null, [ACME]);
    const r = await refusal(service.voucherTypes(SUGI));
    expect(r.error).toBeInstanceOf(ForbiddenException);
    expect(r.codes).toEqual(['VT_COMPANY_MISMATCH']);
  });

  it('a company-bound user may name only their own company', async () => {
    const { service, companyReads } = make(ACME);
    await expect(service.voucherTypes(ACME)).resolves.toMatchObject({
      items: [{ voucherTypeId: 3 }, { voucherTypeId: 68 }],
    });
    const r = await refusal(service.voucherTypes(SUGI));
    expect(r.error).toBeInstanceOf(ForbiddenException);
    expect(r.codes).toEqual(['VT_COMPANY_MISMATCH']);
    // a bound user's own company is not looked up again
    expect(companyReads).toHaveLength(0);
  });

  it('no companyId: the bases only, and no company check', async () => {
    const { service, companyReads } = make(ACME);
    const out = await service.voucherTypes(null);
    expect(out.items.map((t) => t.voucherTypeId)).toEqual([3]);
    expect(companyReads).toHaveLength(0);
  });
});
