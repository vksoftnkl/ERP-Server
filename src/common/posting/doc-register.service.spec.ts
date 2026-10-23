import { Prisma } from '@prisma/client';
import type { PrismaService } from '../../database/prisma/prisma.service';
import { DocRegisterService } from './doc-register.service';
import type { RegisterDetailLine, RegisterDoc } from './doc-register.types';
import type { StatutoryService } from './statutory.service';

const COMPANY_ID = '019f0000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '019f0000-0000-7000-8000-0000000000c2';
const VOUCHER_ID = '019f0000-0000-7000-8000-0000000000a1';
const BILL_ID = '019f0000-0000-7000-8000-0000000000b1';
const PARTY_ID = '019f0000-0000-7000-8000-0000000000d1';
const USER_ID = '019f0000-0000-7000-8000-0000000000e1';
const GDR_ID = '019f0000-0000-7000-8000-0000000000f1';
const OLD_GDR_ID = '019f0000-0000-7000-8000-0000000000f2';

/**
 * A raw query as it would read with its values inlined: text quoted, numbers,
 * booleans and null bare. Enough to assert which value sits beside which cast.
 */
const isSql = (v: unknown): v is Prisma.Sql =>
  typeof v === 'object' && v !== null && 'strings' in v && 'values' in v;
const render = (strings: readonly string[], values: readonly unknown[]): string =>
  strings.reduce((sql, part, i) => {
    if (i >= values.length) return sql + part;
    const v = values[i];
    const text =
      isSql(v)
        ? render(v.strings, v.values)
        : typeof v === 'string'
          ? `'${v}'`
          : String(v);
    return sql + part + text;
  }, '');
const renderCall = (call: unknown[]) => {
  const [strings, ...values] = call as [TemplateStringsArray, ...unknown[]];
  return render(strings, values);
};

const line = (overrides: Partial<RegisterDetailLine> = {}): RegisterDetailLine => ({
  rowNo: 1,
  itemId: null,
  qty: 2,
  rate: 50,
  discount: 0,
  isService: false,
  taxableValue: 100,
  totalTaxRate: 18,
  cgstRate: 9,
  sgstRate: 9,
  igstRate: 18,
  cessRate: 0,
  cgstAmount: 9,
  sgstAmount: 9,
  igstAmount: 0,
  cessAmount: 0,
  otherAmount: 0,
  totalValue: 118,
  billValue: 118,
  taxability: 'TAXABLE',
  supplyNature: 'INTRA_STATE',
  ...overrides,
});

const doc = (overrides: Partial<RegisterDoc> = {}): RegisterDoc => ({
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  accYear: '2026-2027',
  voucherId: VOUCHER_ID,
  voucherTypeId: 3,
  voucherNo: BigInt(41),
  voucherDate: '2026-10-23',
  sourceDocId: BILL_ID,
  docType: 'INVOICE',
  tranNature: 'SALE',
  docFlow: 'OUTWARD',
  docSign: 1,
  docNo: 'SB/00041',
  docDate: '2026-10-23',
  taxability: 'TAXABLE',
  supplyNature: 'INTRA_STATE',
  placeOfSupplyCode: '33',
  partyId: PARTY_ID,
  grossValue: 100,
  discountValue: 0,
  taxableValue: 100,
  cgstValue: 9,
  sgstValue: 9,
  igstValue: 0,
  cessValue: 0,
  stateCessValue: 0,
  tcsValue: 0,
  otherCharge: 0,
  roundOff: 0,
  billValue: 118,
  lines: [line()],
  ...overrides,
});

describe('DocRegisterService', () => {
  let statutory: { einvoiceApplicable: jest.Mock; ewayApplicable: jest.Mock };
  let tx: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
  let service: DocRegisterService;

  beforeEach(() => {
    statutory = {
      einvoiceApplicable: jest.fn(async () => ({ applicable: true })),
      ewayApplicable: jest.fn(async () => ({ applicable: false })),
    };
    tx = {
      $queryRaw: jest.fn(async (..._args: unknown[]) => [{ gdr_id: GDR_ID }]),
      $executeRaw: jest.fn(async (..._args: unknown[]) => 1),
    };
    service = new DocRegisterService(
      {} as PrismaService,
      statutory as unknown as StatutoryService,
    );
  });

  const client = () => tx as unknown as Prisma.TransactionClient;
  const insertSql = () => renderCall(tx.$queryRaw.mock.calls[0]);
  const detailSql = () => renderCall(tx.$executeRaw.mock.calls[0]);

  describe('write', () => {
    it("asks the statutory rules on the document's own date, inside the transaction", async () => {
      await service.write(client(), doc(), { companyEinvoiceFlag: true, aatoAmount: 6e7 });

      expect(statutory.einvoiceApplicable).toHaveBeenCalledWith(
        COMPANY_ID,
        '2026-10-23',
        { aatoAmount: 6e7, companyFlag: true },
        tx,
      );
      expect(statutory.ewayApplicable).toHaveBeenCalledWith(
        COMPANY_ID,
        118,
        '2026-10-23',
        { interState: false, stateCode: '33' },
        tx,
      );
    });

    it('defaults the turnover to null and the company flag to off', async () => {
      await service.write(client(), doc());

      expect(statutory.einvoiceApplicable.mock.calls[0][2]).toEqual({
        aatoAmount: null,
        companyFlag: false,
      });
    });

    it('reads inter-state from the supply nature unless the caller says otherwise', async () => {
      await service.write(client(), doc({ supplyNature: 'INTER_STATE' }));
      await service.write(client(), doc({ supplyNature: 'INTER_STATE' }), { interState: false });

      expect(statutory.ewayApplicable.mock.calls.map((c) => c[3].interState)).toEqual([
        true,
        false,
      ]);
    });

    it('returns the new row id, both flags and the line count', async () => {
      await expect(
        service.write(client(), doc({ lines: [line(), line({ rowNo: 2 })] })),
      ).resolves.toEqual({
        gdrId: GDR_ID,
        einvoiceApplicable: true,
        ewaybillApplicable: false,
        lineCount: 1,
      });
    });

    it.each(['BILL_OF_SUPPLY', 'DELIVERY_CHALLAN', 'CHALLAN'] as const)(
      'never marks a %s as an e-invoice, whatever the rules say',
      async (docType) => {
        statutory.ewayApplicable.mockResolvedValue({ applicable: true });

        const result = await service.write(client(), doc({ docType }));

        expect(result).toMatchObject({ einvoiceApplicable: false, ewaybillApplicable: true });
        expect(insertSql()).toContain(`false, false, true,`);
      },
    );

    it('files the row POSTED, as SALES and against a CUSTOMER by default', async () => {
      await service.write(client(), doc());

      const sql = insertSql();
      expect(sql).toContain(`'SALES'::accounts."GdrSourceModule"`);
      expect(sql).toContain(`'POSTED'::accounts."GdrDocStatus"`);
      expect(sql).toContain(`'CUSTOMER'::accounts."GdrPartyType"`);
      expect(sql).toContain(`'INVOICE'::accounts."GdrDocType"`);
      expect(sql).toContain('41::bigint');
    });

    it('takes the source module and party type a caller names', async () => {
      await service.write(client(), doc({ sourceModule: 'ACCOUNTS', partyType: 'VENDOR' }));

      expect(insertSql()).toContain(`'ACCOUNTS'::accounts."GdrSourceModule"`);
      expect(insertSql()).toContain(`'VENDOR'::accounts."GdrPartyType"`);
    });

    it('snapshots the party off the document', async () => {
      await service.write(
        client(),
        doc({ partyName: 'Walk-in', partyGstin: '33ABCDE1234F1Z5', partyStateCode: '33' }),
      );

      expect(insertSql()).toContain(`'Walk-in'`);
      expect(insertSql()).toContain(`'33ABCDE1234F1Z5'`);
    });

    it('sends every money figure as text rounded to the paisa', async () => {
      await service.write(client(), doc({ grossValue: 1234.005, roundOff: -0.005, billValue: 0 }));

      const sql = insertSql();
      expect(sql).toContain(`'1234.01'::numeric`);
      expect(sql).toContain(`'-0.01'::numeric`);
      expect(sql).toContain(`'0.00'::numeric`);
    });

    it.each([
      ['a login name', 'VKPOS', 'null::uuid'],
      ['SYSTEM', 'SYSTEM', 'null::uuid'],
      ['the nil uuid', '00000000-0000-0000-0000-000000000000', 'null::uuid'],
      ['a user id', USER_ID, `'${USER_ID}'::uuid`],
    ])('stores %s as the creator %s', async (_label, createdBy, expected) => {
      await service.write(client(), doc({ createdBy }));

      expect(insertSql()).toMatch(new RegExp(`${expected.replace(/[()]/g, '\\$&')}\\s*\\)\\s*RETURNING`));
    });

    describe('detail lines', () => {
      it('writes no detail insert for a document without lines', async () => {
        await expect(service.write(client(), doc({ lines: [] }))).resolves.toMatchObject({
          lineCount: 0,
        });

        expect(tx.$executeRaw).not.toHaveBeenCalled();
      });

      it('writes every line in one insert under the new register row', async () => {
        tx.$executeRaw.mockResolvedValue(2);

        const result = await service.write(
          client(),
          doc({ lines: [line(), line({ rowNo: 2 })] }),
        );

        expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
        expect(result.lineCount).toBe(2);
        expect(detailSql().match(new RegExp(`'${GDR_ID}'::uuid`, 'g'))).toHaveLength(2);
      });

      // chk_acc_voucher_doc_detail_supply_tax_logic
      it('zeroes the IGST rate on an intra-state line', async () => {
        await service.write(client(), doc());

        expect(detailSql()).toMatch(
          /'9\.00'::numeric, '9\.00'::numeric,\s*'0\.00'::numeric, '0\.00'::numeric/,
        );
      });

      it('zeroes the CGST and SGST rates on an inter-state line', async () => {
        await service.write(
          client(),
          doc({
            supplyNature: 'INTER_STATE',
            lines: [
              line({ supplyNature: 'INTER_STATE', cgstAmount: 0, sgstAmount: 0, igstAmount: 18 }),
            ],
          }),
        );

        expect(detailSql()).toMatch(
          /'0\.00'::numeric, '0\.00'::numeric,\s*'18\.00'::numeric, '0\.00'::numeric/,
        );
      });

      it('sums the four tax amounts into the line total tax and keeps qty to 4 places', async () => {
        await service.write(
          client(),
          doc({ lines: [line({ qty: 1.23456, cgstAmount: 4.5, sgstAmount: 4.5, cessAmount: 1 })] }),
        );

        const sql = detailSql();
        expect(sql).toContain(`'1.2346'::numeric`);
        expect(sql).toContain(`'10.00'::numeric`);
      });

      it('casts to the detail table’s own enums, not the register’s', async () => {
        await service.write(client(), doc());

        expect(detailSql()).toContain(`'TAXABLE'::accounts."VoucherDocDetailTaxability"`);
        expect(detailSql()).toContain(`'INTRA_STATE'::accounts."VoucherDocDetailSupplyNature"`);
      });
    });
  });

  describe('registerIdOf / registerIdOfVoucher', () => {
    it('returns the first row the query ranks — the live one before a cancelled one', async () => {
      await expect(service.registerIdOf(client(), BILL_ID, '2026-2027')).resolves.toBe(GDR_ID);

      const sql = insertSql();
      expect(sql).toContain(`gdr_source_doc_id = '${BILL_ID}'::uuid`);
      expect(sql).toMatch(/ORDER BY \(gdr_doc_status <> 'CANCELED'.*\) DESC/);
    });

    it('keys the voucher lookup on gdr_voucher_id', async () => {
      await expect(service.registerIdOfVoucher(client(), VOUCHER_ID, '2026-2027')).resolves.toBe(
        GDR_ID,
      );

      expect(insertSql()).toContain(`gdr_voucher_id = '${VOUCHER_ID}'::uuid`);
    });

    it('is null when the document has no register row', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(service.registerIdOf(client(), BILL_ID, '2026-2027')).resolves.toBeNull();
      await expect(
        service.registerIdOfVoucher(client(), VOUCHER_ID, '2026-2027'),
      ).resolves.toBeNull();
    });
  });

  describe('liveInwardHolderOf', () => {
    const key = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: '2026-2027',
      docType: 'INVOICE' as const,
      partyId: PARTY_ID,
      docNo: 'SUP-77',
      docDate: '2026-10-20',
    };

    it('names the voucher already holding the supplier’s number', async () => {
      tx.$queryRaw.mockResolvedValue([
        { gdr_id: GDR_ID, gdr_voucher_id: VOUCHER_ID, gdr_voucher_refno: 'PV/0003' },
      ]);

      await expect(service.liveInwardHolderOf(client(), key)).resolves.toEqual({
        gdrId: GDR_ID,
        voucherId: VOUCHER_ID,
        voucherRefno: 'PV/0003',
      });
      const sql = insertSql();
      expect(sql).toContain(`gdr_party_id   = '${PARTY_ID}'::uuid`);
      expect(sql).toContain(`gdr_doc_no     = 'SUP-77'`);
      expect(sql).toContain(`'INWARD'::accounts."GdrDocFlow"`);
      // A cancelled booking of the number may be made again (notes 104).
      expect(sql).toContain(`gdr_doc_status <> 'CANCELED'`);
    });

    it('is null when the number is free', async () => {
      tx.$queryRaw.mockResolvedValue([]);

      await expect(service.liveInwardHolderOf(client(), key)).resolves.toBeNull();
    });
  });

  describe('cancel', () => {
    it('sets the row CANCELED with the reason and a cancel date', async () => {
      await expect(
        service.cancel(client(), GDR_ID, '2026-2027', 'Wrong party', USER_ID),
      ).resolves.toBe(1);

      const sql = detailSql();
      expect(sql).toContain(`gdr_doc_status        = 'CANCELED'`);
      expect(sql).toContain(`gdr_doc_cancel_reason = 'Wrong party'`);
      expect(sql).toContain('gdr_doc_canceled_on   = now()');
      expect(sql).toContain(`gdr_updated_by        = '${USER_ID}'::uuid`);
      expect(sql).toContain(`gdr_id       = '${GDR_ID}'::uuid`);
    });

    it('records the SYSTEM actor as null', async () => {
      await service.cancel(client(), GDR_ID, '2026-2027', 'x');

      expect(detailSql()).toContain('gdr_updated_by        = null::uuid');
    });
  });

  describe('retire', () => {
    it('soft-deletes the row instead of cancelling it', async () => {
      await expect(service.retire(client(), GDR_ID, '2026-2027', USER_ID)).resolves.toBe(1);

      const sql = detailSql();
      expect(sql).toContain('SET gdr_is_deleted = true');
      expect(sql).not.toContain('CANCELED');
      expect(sql).toContain('AND gdr_is_deleted = false');
    });
  });

  describe('reissue', () => {
    it('cancels the old row, then writes the new one', async () => {
      const result = await service.reissue(client(), OLD_GDR_ID, doc(), { actor: USER_ID });

      const cancelSql = renderCall(tx.$executeRaw.mock.calls[0]);
      expect(cancelSql).toContain(`gdr_id       = '${OLD_GDR_ID}'::uuid`);
      expect(cancelSql).toContain(`'Superseded by an amendment'`);
      expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
        tx.$queryRaw.mock.invocationCallOrder[0],
      );
      expect(result.gdrId).toBe(GDR_ID);
    });

    it('records the reason given', async () => {
      await service.reissue(client(), OLD_GDR_ID, doc(), { reason: 'Rate corrected' });

      expect(renderCall(tx.$executeRaw.mock.calls[0])).toContain(`'Rate corrected'`);
    });
  });
});
