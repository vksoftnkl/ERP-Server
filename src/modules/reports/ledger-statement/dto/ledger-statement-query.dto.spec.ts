import { HttpException } from '@nestjs/common';
import { validateDto } from '../../../../common/utils/request-payload-validation.util';
import {
  LedgerStatementExportDto,
  LedgerStatementLedgersDto,
  LedgerStatementRangeDto,
  LedgerStatementScopeDto,
  LedgerStatementVoucherLegsDto,
  LedgerStatementVouchersDto,
} from './ledger-statement-query.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b102';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b104';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46b105';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46b111';

const SCOPE = { companyId: COMPANY_ID, accYear: '2026-2027', ledgerId: LEDGER_ID };
const RANGE = { ...SCOPE, fromDate: '2026-08-01', toDate: '2026-09-25' };

type Metatype = new () => object;

/** The query as the house ValidationPipe hands it to the route (every value a string). */
const parse = <T extends object>(query: object, metatype: new () => T) =>
  validateDto(query, metatype, { type: 'query' });

/** The fields the house ValidationPipe refuses, or [] when the query passes. */
async function refusedFields(query: object, metatype: Metatype): Promise<string[]> {
  try {
    await validateDto(query, metatype, { type: 'query' });
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: { field: string }[] }).errors.map((e) => e.field);
  }
}

describe('ledger statement query DTOs', () => {
  // ── the scope every route shares ──────────────────────────────────────────
  describe('LedgerStatementScopeDto', () => {
    it('takes a company, a year and a ledger, the branch optional', async () => {
      await expect(refusedFields(SCOPE, LedgerStatementScopeDto)).resolves.toEqual([]);
      await expect(
        refusedFields({ ...SCOPE, branchId: BRANCH_ID }, LedgerStatementScopeDto),
      ).resolves.toEqual([]);
    });

    it('requires the company, the year and the ledger', async () => {
      // class-validator reports the subclass's own field before the inherited ones.
      await expect(
        refusedFields({ branchId: BRANCH_ID }, LedgerStatementScopeDto),
      ).resolves.toEqual(['ledgerId', 'companyId', 'accYear']);
    });

    it('refuses an empty query as a whole, under request', async () => {
      await expect(refusedFields({}, LedgerStatementScopeDto)).resolves.toEqual(['request']);
    });

    it.each([
      ['a year that is not YYYY-YYYY', { accYear: '2026-27' }, 'accYear'],
      ['a year longer than 9 characters', { accYear: '2026-20270' }, 'accYear'],
      ['a ledger id that is not a uuid', { ledgerId: 'cash' }, 'ledgerId'],
      ['a branch id that is not a uuid', { branchId: 'main' }, 'branchId'],
    ])('refuses %s', async (_label, overrides, field) => {
      await expect(
        refusedFields({ ...SCOPE, ...overrides }, LedgerStatementScopeDto),
      ).resolves.toEqual([field]);
    });
  });

  describe('LedgerStatementRangeDto', () => {
    it('takes the two dates as YYYY-MM-DD text, never as Dates', async () => {
      const dto = await parse(RANGE, LedgerStatementRangeDto);

      expect(dto.fromDate).toBe('2026-08-01');
      expect(dto.toDate).toBe('2026-09-25');
    });

    it.each([
      ['a date in another format', { fromDate: '01-08-2026' }, ['fromDate']],
      ['a date with a time', { toDate: '2026-09-25T10:00' }, ['toDate']],
      ['no dates at all', { fromDate: undefined, toDate: undefined }, ['fromDate', 'toDate']],
    ])('refuses %s', async (_label, overrides, fields) => {
      await expect(
        refusedFields({ ...RANGE, ...overrides }, LedgerStatementRangeDto),
      ).resolves.toEqual(fields);
    });
  });

  // ── the flags ─────────────────────────────────────────────────────────────
  describe('LedgerStatementExportDto', () => {
    it('leaves the three flags unset when they are not sent', async () => {
      const dto = await parse(RANGE, LedgerStatementExportDto);

      expect(dto.includeCancelled).toBeUndefined();
      expect(dto.withBillRefs).toBeUndefined();
      expect(dto.withLegs).toBeUndefined();
    });

    it.each([
      ['false', false],
      ['0', false],
      ['true', true],
      ['1', true],
    ])('reads the query text %p as %p', async (text, flag) => {
      const dto = await parse(
        { ...RANGE, includeCancelled: text, withBillRefs: text, withLegs: text },
        LedgerStatementExportDto,
      );

      expect([dto.includeCancelled, dto.withBillRefs, dto.withLegs]).toEqual([flag, flag, flag]);
    });
  });

  describe('LedgerStatementVouchersDto', () => {
    it('turns the paging text into numbers', async () => {
      const dto = await parse({ ...RANGE, page: '3', pageSize: '50' }, LedgerStatementVouchersDto);

      expect(dto.page).toBe(3);
      expect(dto.pageSize).toBe(50);
    });

    it.each([
      ['page 0', { page: '0' }, 'page'],
      ['a page size over 1000', { pageSize: '1001' }, 'pageSize'],
      ['a page size of 0', { pageSize: '0' }, 'pageSize'],
    ])('refuses %s', async (_label, overrides, field) => {
      await expect(
        refusedFields({ ...RANGE, ...overrides }, LedgerStatementVouchersDto),
      ).resolves.toEqual([field]);
    });
  });

  // ── the picker and the legs ───────────────────────────────────────────────
  describe('LedgerStatementLedgersDto', () => {
    it('needs only the company; the search is trimmed and the limit read as a number', async () => {
      const dto = await parse(
        { companyId: COMPANY_ID, search: '  ravi ', limit: '10' },
        LedgerStatementLedgersDto,
      );

      expect(dto).toMatchObject({ companyId: COMPANY_ID, search: 'ravi', limit: 10 });
    });

    it.each([
      ['a limit over 100', { limit: '101' }, 'limit'],
      ['a group id that is not a uuid', { groupId: 'debtors' }, 'groupId'],
      ['a search over 100 characters', { search: 'x'.repeat(101) }, 'search'],
    ])('refuses %s', async (_label, overrides, field) => {
      await expect(
        refusedFields({ companyId: COMPANY_ID, ...overrides }, LedgerStatementLedgersDto),
      ).resolves.toEqual([field]);
    });
  });

  describe('LedgerStatementVoucherLegsDto', () => {
    const LEGS = {
      companyId: COMPANY_ID,
      accYear: '2026-2027',
      voucherId: VOUCHER_ID,
      ledgerId: LEDGER_ID,
    };

    it('takes the company, year, voucher and ledger', async () => {
      await expect(refusedFields(LEGS, LedgerStatementVoucherLegsDto)).resolves.toEqual([]);
    });

    it('requires every one of them', async () => {
      // Every key named but unset: an empty {} is refused as a whole, under request.
      const unset = { companyId: undefined, accYear: undefined, voucherId: undefined, ledgerId: undefined };
      await expect(refusedFields(unset, LedgerStatementVoucherLegsDto)).resolves.toEqual([
        'companyId',
        'accYear',
        'voucherId',
        'ledgerId',
      ]);
    });
  });
});
