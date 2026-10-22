import { HttpException, Type } from '@nestjs/common';
import { validateDto } from 'src/common/utils/request-payload-validation.util';
import {
  DeleteTaxRateQueryDto,
  ListTaxRateQueryDto,
  ResolveTaxRateQueryDto,
  TaxRateIdQueryDto,
} from './tax-rate-query.dto';

const TAX_ID = '019c6f6c-be87-7a11-8905-36092c46af01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46af31';

const asQuery = <T extends object>(value: Record<string, unknown>, metatype: Type<T>) =>
  validateDto(value, metatype, { type: 'query' });

/** The fields the house pipe refused; [] when it let the query through. */
async function refusedFields<T extends object>(
  value: Record<string, unknown>,
  metatype: Type<T>,
): Promise<string[]> {
  try {
    await asQuery(value, metatype);
    return [];
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return (error.getResponse() as { errors: Array<{ field: string }> }).errors.map(
      (detail) => detail.field,
    );
  }
}

describe('tax rate query DTOs (through the house pipe)', () => {
  describe('TaxRateIdQueryDto / DeleteTaxRateQueryDto', () => {
    it('wants a uuid tax_id', async () => {
      await expect(refusedFields({ tax_id: TAX_ID }, TaxRateIdQueryDto)).resolves.toEqual([]);
      await expect(refusedFields({ tax_id: 'rate-1' }, TaxRateIdQueryDto)).resolves.toEqual([
        'tax_id',
      ]);
      await expect(refusedFields({ search: 'x' }, TaxRateIdQueryDto)).resolves.toEqual([
        'search',
        'tax_id',
      ]);
    });

    it('lets a delete name its modifier, up to 50 characters', async () => {
      await expect(
        asQuery({ tax_id: TAX_ID, tax_modified_by: ' importer ' }, DeleteTaxRateQueryDto),
      ).resolves.toMatchObject({ tax_modified_by: 'importer' });
      await expect(
        refusedFields({ tax_id: TAX_ID, tax_modified_by: 'm'.repeat(51) }, DeleteTaxRateQueryDto),
      ).resolves.toEqual(['tax_modified_by']);
    });
  });

  describe('ListTaxRateQueryDto', () => {
    it('turns query strings into typed filters', async () => {
      await expect(
        asQuery(
          { search: ' 18 ', tax_taxability: 'exempt', tax_rate_perc: '0', active_only: 'false' },
          ListTaxRateQueryDto,
        ),
      ).resolves.toMatchObject({
        search: '18',
        tax_taxability: 'EXEMPT',
        tax_rate_perc: 0,
        active_only: false,
      });
    });

    it.each([
      ['a negative rate', { tax_rate_perc: '-1' }, 'tax_rate_perc'],
      ['a search over 100 characters', { search: 's'.repeat(101) }, 'search'],
      ['a taxability over 15 characters', { tax_taxability: 'NOT_A_TAXABILITY' }, 'tax_taxability'],
    ])('refuses %s', async (_label, query, field) => {
      await expect(refusedFields(query, ListTaxRateQueryDto)).resolves.toEqual([field]);
    });
  });

  describe('ResolveTaxRateQueryDto', () => {
    it('upper-cases the supply nature and takes a company and branch', async () => {
      await expect(
        asQuery(
          { tax_id: TAX_ID, supply_nature: 'inter', company_id: COMPANY_ID, branch_id: COMPANY_ID },
          ResolveTaxRateQueryDto,
        ),
      ).resolves.toMatchObject({ supply_nature: 'INTER', company_id: COMPANY_ID });
    });

    it.each([
      ['no tax_id', { supply_nature: 'INTRA' }, 'tax_id'],
      ['a company that is not a uuid', { tax_id: TAX_ID, company_id: 'zeta' }, 'company_id'],
      [
        'a supply nature over 5 characters',
        { tax_id: TAX_ID, supply_nature: 'EXPORT' },
        'supply_nature',
      ],
    ])('refuses %s', async (_label, query, field) => {
      await expect(refusedFields(query, ResolveTaxRateQueryDto)).resolves.toEqual([field]);
    });
  });
});
