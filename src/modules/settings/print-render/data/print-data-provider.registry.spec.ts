import { Logger } from '@nestjs/common';
import {
  PTD_PROVIDER_MAX_LENGTH,
  PTD_PROVIDER_PATTERN,
} from '../../print-template/print-template.constants';
import { PrintDataProviderRegistry } from './print-data-provider.registry';
import { PrintDataProvider } from './print-data-provider.types';
import { BranchProfileProvider } from './providers/branch-profile.provider';
import { CompanyProfileProvider } from './providers/company-profile.provider';
import { PARTY_OUTSTANDING_PRINT_PROVIDERS } from './providers/party-outstanding.providers';
import { SaleBillHeaderProvider } from './providers/sale-bill-header.provider';
import { SaleBillItemsProvider } from './providers/sale-bill-items.provider';
import { SaleBillTaxSummaryProvider } from './providers/sale-bill-tax-summary.provider';
import { TILL_PRINT_PROVIDERS } from './providers/till.providers';

const providerOf = (
  code: string,
  label = code,
  cardinality: 'one' | 'many' = 'many',
): PrintDataProvider => ({
  code,
  label,
  cardinality,
  resolve: () => Promise.resolve([]),
});

/** Every provider print-render.module.ts registers, with dummy collaborators. */
const shipped = (): PrintDataProvider[] => [
  new CompanyProfileProvider({} as never),
  new BranchProfileProvider({} as never),
  new SaleBillHeaderProvider({} as never),
  new SaleBillItemsProvider({} as never),
  new SaleBillTaxSummaryProvider({} as never),
  ...TILL_PRINT_PROVIDERS.map((Provider) => new Provider({} as never)),
  ...PARTY_OUTSTANDING_PRINT_PROVIDERS.map((Provider) => new Provider({} as never)),
];

describe('PrintDataProviderRegistry', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('finds a provider by code, ignoring case and surrounding space', () => {
    const items = providerOf('sales.bill.items');
    const registry = new PrintDataProviderRegistry([items]);

    expect(registry.get('  Sales.Bill.ITEMS ')).toBe(items);
    expect(registry.has('sales.bill.items')).toBe(true);
    expect(registry.has('sales.bill.lines')).toBe(false);
    expect(registry.get('sales.bill.lines')).toBeUndefined();
  });

  it('refuses two providers claiming one code, whatever their case', () => {
    expect(
      () => new PrintDataProviderRegistry([providerOf('company.profile'), providerOf('Company.Profile')]),
    ).toThrow("Duplicate print data provider code 'Company.Profile'");
  });

  it('lists the codes and describes the providers in code order', () => {
    const registry = new PrintDataProviderRegistry([
      providerOf('sales.bill.items', 'Lines', 'many'),
      providerOf('company.profile', 'Letterhead', 'one'),
    ]);

    expect(registry.codes()).toEqual(['company.profile', 'sales.bill.items']);
    expect(registry.describe()).toEqual([
      { code: 'company.profile', label: 'Letterhead', cardinality: 'one' },
      { code: 'sales.bill.items', label: 'Lines', cardinality: 'many' },
    ]);
  });

  it('accepts an empty build', () => {
    const registry = new PrintDataProviderRegistry([]);

    expect(registry.codes()).toEqual([]);
    expect(registry.describe()).toEqual([]);
  });

  describe('the providers this build ships', () => {
    it('register without a clash', () => {
      expect(new PrintDataProviderRegistry(shipped()).codes()).toHaveLength(17);
    });

    it.each(shipped().map((provider) => [provider.code]))(
      '%s has a code ck_ptd_provider_shape accepts',
      (code) => {
        expect(code).toMatch(PTD_PROVIDER_PATTERN);
        expect(code.length).toBeLessThanOrEqual(PTD_PROVIDER_MAX_LENGTH);
      },
    );
  });
});
