import { PgService } from 'src/database/pg/pg.service';
import { ProviderRequest } from '../print-data-provider.types';
import { BranchProfileProvider } from './branch-profile.provider';
import { CompanyProfileProvider } from './company-profile.provider';
import { providerQuery, requireDocument } from './provider.utils';
import { SaleBillHeaderProvider } from './sale-bill-header.provider';
import { SaleBillItemsProvider } from './sale-bill-items.provider';
import { SaleBillTaxSummaryProvider } from './sale-bill-tax-summary.provider';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e002';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46e003';

// PostgreSQL type OIDs the result carries; value-coercion keys off these.
const NUMERIC = 1700;
const TEXT = 25;

/** A node-pg result with the columns declared, as queryReadOnly hands it back. */
const resultOf = (
  fields: Array<{ name: string; oid: number }>,
  rows: Record<string, unknown>[],
) => ({
  rows,
  fields: fields.map((field) => ({ name: field.name, dataTypeID: field.oid })),
});

const requestFor = (overrides: Partial<ProviderRequest['context']> = {}, extra: object = {}) =>
  ({
    context: {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: '2026-2027',
      docId: BILL_ID,
      userId: null,
      deviceId: null,
      ...overrides,
    },
    params: {},
    lang: 'en-IN',
    rowLimit: 500,
    ...extra,
  }) as ProviderRequest;

describe('print data providers that read a document or a profile', () => {
  let queryReadOnly: jest.Mock;
  let pg: PgService;

  beforeEach(() => {
    queryReadOnly = jest.fn().mockResolvedValue(resultOf([], []));
    pg = { queryReadOnly } as unknown as PgService;
  });

  const boundParams = () => queryReadOnly.mock.calls[0][1] as unknown[];

  describe('providerQuery', () => {
    it('coerces numeric columns by their declared type and leaves numeric-looking text alone', async () => {
      queryReadOnly.mockResolvedValue(
        resultOf(
          [
            { name: 'bill_amt', oid: NUMERIC },
            { name: 'bill_refno', oid: TEXT },
          ],
          [{ bill_amt: '14750.25', bill_refno: '0012' }],
        ),
      );

      await expect(providerQuery(pg, 'SELECT 1', [])).resolves.toEqual([
        { bill_amt: 14750.25, bill_refno: '0012' },
      ]);
    });
  });

  describe('requireDocument', () => {
    it('hands back the document id and its own year', () => {
      expect(requireDocument(requestFor(), 'sales.bill.header')).toEqual({
        docId: BILL_ID,
        accYear: '2026-2027',
      });
    });

    it('refuses a render that names no document, naming the provider', () => {
      expect(() => requireDocument(requestFor({ docId: null }), 'sales.bill.items')).toThrow(
        /^sales\.bill\.items prints one document and the render named none\. Send docId/,
      );
    });

    it('refuses a render that names no accounting year', () => {
      expect(() => requireDocument(requestFor({ accYear: null }), 'sales.bill.items')).toThrow(
        /reads a table partitioned by accounting year.*Send accYear/,
      );
    });
  });

  describe('company.profile', () => {
    it('reads the company the render is scoped to, as one row', async () => {
      queryReadOnly.mockResolvedValue(
        resultOf([{ name: 'company_name', oid: TEXT }], [{ company_name: 'Vknex Traders' }]),
      );

      const provider = new CompanyProfileProvider(pg);

      await expect(provider.resolve(requestFor())).resolves.toEqual({
        company_name: 'Vknex Traders',
      });
      expect(boundParams()).toEqual([COMPANY_ID]);
      expect(provider).toMatchObject({ code: 'company.profile', cardinality: 'one' });
    });

    it('answers {} rather than undefined when the company row is missing', async () => {
      await expect(new CompanyProfileProvider(pg).resolve(requestFor())).resolves.toEqual({});
    });
  });

  describe('branch.profile', () => {
    it('binds the branch AND the company, so a foreign branch id resolves to nothing', async () => {
      await new BranchProfileProvider(pg).resolve(requestFor());

      expect(boundParams()).toEqual([BRANCH_ID, COMPANY_ID]);
      expect(queryReadOnly.mock.calls[0][0]).toMatch(/WHERE br_id = \$1 AND br_comp_id = \$2/);
    });

    it('prints an empty block, without a query, when the render has no branch', async () => {
      await expect(
        new BranchProfileProvider(pg).resolve(requestFor({ branchId: null })),
      ).resolves.toEqual({});
      expect(queryReadOnly).not.toHaveBeenCalled();
    });
  });

  describe('sales.bill.header', () => {
    it('reads one bill by id, year and company — the partition key included', async () => {
      queryReadOnly.mockResolvedValue(
        resultOf([{ name: 'bill_amt', oid: NUMERIC }], [{ bill_amt: '100.50' }]),
      );

      await expect(new SaleBillHeaderProvider(pg).resolve(requestFor())).resolves.toEqual({
        bill_amt: 100.5,
      });
      expect(boundParams()).toEqual([BILL_ID, '2026-2027', COMPANY_ID]);
    });

    it('refuses before querying when the year is missing', async () => {
      await expect(
        new SaleBillHeaderProvider(pg).resolve(requestFor({ accYear: null })),
      ).rejects.toThrow(/sales\.bill\.header reads a table partitioned/);
      expect(queryReadOnly).not.toHaveBeenCalled();
    });
  });

  describe('sales.bill.items', () => {
    it('binds the bill, year, company, the language switch and the row cap', async () => {
      await new SaleBillItemsProvider(pg).resolve(requestFor({}, { rowLimit: 40 }));

      expect(boundParams()).toEqual([BILL_ID, '2026-2027', COMPANY_ID, false, 40]);
    });

    it.each(['ta', 'ta-IN', 'TA'])('asks for the Tamil item name when the revision is %s', async (lang) => {
      await new SaleBillItemsProvider(pg).resolve(requestFor({}, { lang }));

      expect(boundParams()[3]).toBe(true);
    });

    it('hands back every line, coerced', async () => {
      queryReadOnly.mockResolvedValue(
        resultOf(
          [
            { name: 'line_no', oid: 23 },
            { name: 'net_amt', oid: NUMERIC },
          ],
          [
            { line_no: 1, net_amt: '6844.00' },
            { line_no: 2, net_amt: '6018.00' },
          ],
        ),
      );

      await expect(new SaleBillItemsProvider(pg).resolve(requestFor())).resolves.toEqual([
        { line_no: 1, net_amt: 6844 },
        { line_no: 2, net_amt: 6018 },
      ]);
    });
  });

  describe('sales.bill.tax_summary', () => {
    it('binds the bill, year, company and the row cap', async () => {
      await new SaleBillTaxSummaryProvider(pg).resolve(requestFor({}, { rowLimit: 12 }));

      expect(boundParams()).toEqual([BILL_ID, '2026-2027', COMPANY_ID, 12]);
      // Rule 46: one HSN can carry two rates, so the rate is part of the group.
      expect(queryReadOnly.mock.calls[0][0]).toMatch(/GROUP BY 1, 2, 3, 4, 5, 6/);
    });

    it('refuses before querying when the render names no document', async () => {
      await expect(
        new SaleBillTaxSummaryProvider(pg).resolve(requestFor({ docId: null })),
      ).rejects.toThrow(/sales\.bill\.tax_summary prints one document/);
      expect(queryReadOnly).not.toHaveBeenCalled();
    });
  });
});
