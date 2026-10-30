import { HttpException, Type } from '@nestjs/common';
import { createHouseValidationPipe } from 'src/common/validation/house-validation';
import { DeleteLedgerMapQueryDto, SaveLedgerMapDto } from './save-ledger-map.dto';

const ALM_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46e103';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e104';
const BODY = { role: 'DISCOUNT_ALLOWED', ledgerId: LEDGER_ID };
const pipe = createHouseValidationPipe();

const transform = <T extends object>(value: unknown, metatype: Type<T>, type: 'body' | 'query') =>
  pipe.transform(value, { type, metatype }) as Promise<T>;

/** The refusals the house pipe raised as field → message; {} when it let the value through. */
async function refusals<T extends object>(
  value: unknown,
  metatype: Type<T>,
  type: 'body' | 'query' = 'body',
): Promise<Record<string, string>> {
  try {
    await transform(value, metatype, type);
    return {};
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    const { errors } = error.getResponse() as { errors: Array<{ field: string; message: string }> };
    return Object.fromEntries(errors.map((detail) => [detail.field, detail.message]));
  }
}

describe('SaveLedgerMapDto (through the house pipe)', () => {
  it('accepts a role and a ledger', async () => {
    await expect(refusals(BODY, SaveLedgerMapDto)).resolves.toEqual({});
  });

  it('accepts a re-point carrying every optional field', async () => {
    await expect(
      refusals({ ...BODY, almId: ALM_ID, isActive: false, remarks: null }, SaveLedgerMapDto),
    ).resolves.toEqual({});
  });

  it('upper-cases and trims the role', async () => {
    const dto = await transform({ ...BODY, role: ' discount_allowed ' }, SaveLedgerMapDto, 'body');

    expect(dto.role).toBe('DISCOUNT_ALLOWED');
  });

  // The reserved scope columns are refused by name, saying why — not as a typo.
  it.each([
    ['almCompanyId', COMPANY_ID, /shared mapping only, the one every company uses/],
    ['almBranchId', COMPANY_ID, /shared mapping only, the one every branch uses/],
    ['almSupplyNature', 'INTER', /answers for INTRA and INTER alike/],
  ])('refuses %s with the reason', async (field, value, reason) => {
    const refused = await refusals({ ...BODY, [field]: value }, SaveLedgerMapDto);

    expect(Object.keys(refused)).toEqual([field]);
    expect(refused[field]).toMatch(reason);
  });

  it.each([
    ['no role', { ledgerId: LEDGER_ID }, 'role'],
    ['a blank role', { ...BODY, role: '  ' }, 'role'],
    ['a role over 30 characters', { ...BODY, role: 'R'.repeat(31) }, 'role'],
    ['no ledger', { role: 'DISCOUNT_ALLOWED' }, 'ledgerId'],
    ['a ledger that is not a uuid', { ...BODY, ledgerId: 'ledger-1' }, 'ledgerId'],
    ['an almId that is not a uuid', { ...BODY, almId: 'map-1' }, 'almId'],
    ['remarks over 250 characters', { ...BODY, remarks: 'r'.repeat(251) }, 'remarks'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusals(body, SaveLedgerMapDto).then(Object.keys)).resolves.toEqual([field]);
  });
});

describe('DeleteLedgerMapQueryDto (through the house pipe)', () => {
  it('accepts an almId', async () => {
    await expect(refusals({ almId: ALM_ID }, DeleteLedgerMapQueryDto, 'query')).resolves.toEqual(
      {},
    );
  });

  it.each([
    ['no almId', {}],
    ['an almId that is not a uuid', { almId: 'map-1' }],
  ])('refuses %s', async (_label, query) => {
    await expect(
      refusals(query, DeleteLedgerMapQueryDto, 'query').then(Object.keys),
    ).resolves.not.toEqual([]);
  });
});
