import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import { SaveTaxRateDto } from './save-tax-rate.dto';
import { SaveTaxRateLedgerDto } from './save-tax-rate-ledger.dto';

const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46af01';
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

describe('SaveTaxRateDto (through the house pipe)', () => {
  it('turns a body into a DTO with real line DTOs, upper-casing the vocabularies', async () => {
    const dto = await validateDto(
      {
        tax_name: ' GST 18% ',
        tax_taxability: 'taxable',
        tax_rate_perc: '18',
        tax_cess_basis: 'percent',
        lines: [{ ...LINE, trl_supply_nature: 'intra' }],
      },
      SaveTaxRateDto,
    );

    expect(dto).toMatchObject({
      tax_name: 'GST 18%',
      tax_taxability: 'TAXABLE',
      tax_rate_perc: 18,
      tax_cess_basis: 'PERCENT',
    });
    expect(dto.lines?.[0]).toBeInstanceOf(SaveTaxRateLedgerDto);
    expect(dto.lines?.[0]).toMatchObject({ trl_supply_nature: 'INTRA' });
  });

  it.each(['tax_cgst_perc', 'tax_sgst_perc', 'tax_igst_perc'])(
    'refuses the generated column %s on write',
    async (column) => {
      await expect(
        refusedFields({ tax_name: 'GST 18%', [column]: 9 }, SaveTaxRateDto),
      ).resolves.toEqual([column]);
    },
  );

  it('accepts "lines": [] — the request that deletes every override', async () => {
    const dto = await validateDto({ tax_id: TAX_ID, lines: [] }, SaveTaxRateDto);

    expect(dto.lines).toEqual([]);
  });

  it('lets tax_code and tax_supersedes_id be null', async () => {
    await expect(
      refusedFields({ tax_id: TAX_ID, tax_code: null, tax_supersedes_id: null }, SaveTaxRateDto),
    ).resolves.toEqual([]);
  });

  it.each([
    ['a tax_id that is not a uuid', { tax_id: 'rate-1' }, 'tax_id'],
    ['a name over 100 characters', { tax_name: 'n'.repeat(101) }, 'tax_name'],
    ['a code over 30 characters', { tax_code: 'c'.repeat(31) }, 'tax_code'],
    ['a fractional sort order', { tax_sort_order: 1.5 }, 'tax_sort_order'],
    ['a negative rate', { tax_rate_perc: -1 }, 'tax_rate_perc'],
    ['a negative cess per unit', { tax_cess_per_unit: -0.5 }, 'tax_cess_per_unit'],
    [
      'an additional-cess basis over 10 characters',
      { tax_acess_basis: 'PER_UNIT_EACH' },
      'tax_acess_basis',
    ],
    ['a superseded id that is not a uuid', { tax_supersedes_id: 'old-rate' }, 'tax_supersedes_id'],
    ['lines that are not an array', { lines: LINE }, 'lines'],
    ['a creator over 50 characters', { tax_created_by: 'c'.repeat(51) }, 'tax_created_by'],
  ])('refuses %s', async (_label, body, field) => {
    await expect(refusedFields({ tax_name: 'GST 18%', ...body }, SaveTaxRateDto)).resolves.toEqual([
      field,
    ]);
  });

  it('reports a bad line under its grid path', async () => {
    await expect(
      refusedFields(
        { tax_name: 'GST 18%', lines: [LINE, { trl_role: 'SALES', trl_ledger_id: 'ledger-1' }] },
        SaveTaxRateDto,
      ),
    ).resolves.toEqual(['lines.1.trl_ledger_id']);
  });
});
