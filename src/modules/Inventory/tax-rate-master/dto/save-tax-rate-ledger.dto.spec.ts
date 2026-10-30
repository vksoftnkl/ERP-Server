import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveTaxRateLedgerDto } from './save-tax-rate-ledger.dto';

const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46af21';
const LINE = { trl_role: 'OUTPUT_CGST', trl_ledger_id: LEDGER_ID };

/** The fields the house pipe refused, by their dotted path; [] when it let the body through. */
async function refusedFields<T extends object>(
  value: unknown,
  metatype: Type<T>,
): Promise<string[]> {
  try {
    await validateDto(value, metatype);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('SaveTaxRateLedgerDto (through the house pipe)', () => {
  it('accepts a line naming only its role and ledger', async () => {
    await expect(refusedFields(LINE, SaveTaxRateLedgerDto)).resolves.toEqual([]);
  });

  // Only shape is checked here; whether it is INTRA or INTER is the guard's call.
  it('upper-cases the supply nature and leaves INTRA/INTER to the guard', async () => {
    const dto = await validateDto({ ...LINE, trl_supply_nature: 'xx' }, SaveTaxRateLedgerDto);

    expect(dto.trl_supply_nature).toBe('XX');
  });

  it.each([
    ['no role', { trl_ledger_id: LEDGER_ID }, 'trl_role'],
    ['a role over 30 characters', { ...LINE, trl_role: 'R'.repeat(31) }, 'trl_role'],
    ['no ledger', { trl_role: 'SALES' }, 'trl_ledger_id'],
    [
      'a supply nature over 5 characters',
      { ...LINE, trl_supply_nature: 'INTRASTATE' },
      'trl_supply_nature',
    ],
    ['a trl_id that is not a uuid', { ...LINE, trl_id: 'line-1' }, 'trl_id'],
    ['remarks over 250 characters', { ...LINE, trl_remarks: 'r'.repeat(251) }, 'trl_remarks'],
    ['a key the line does not have', { ...LINE, trl_tax_id: LEDGER_ID }, 'trl_tax_id'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields(body, SaveTaxRateLedgerDto)).resolves.toEqual([field]);
  });
});
