import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  ItemLedgerExportDto,
  ItemLedgerMonthsDto,
  ItemLedgerOptionsDto,
  ItemLedgerQueryDto,
  ItemLedgerScopeDto,
} from './dto/item-ledger-query.dto';
import {
  COUNTER_CASH,
  REPORT_TYPES,
  REPORT_TYPE_CODES,
  byTypeLabel,
  dayBefore,
  docKindOf,
  isRealIsoDate,
  monthEnd,
  monthLabel,
  monthsBetween,
  partyOf,
  printedAsOf,
  qtyIn,
  rateIn,
  rateOf,
  reportTypeOf,
  revisionOf,
  rowTypeLabel,
  sameId,
  tileLabel,
  transitText,
} from './item-ledger.rules';

const WALK = '019f659c-3942-7237-89b0-c4899603dd7a';
const CUST = '01a0d242-5562-7686-b162-81ecbfa54efd';
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
const ITEM = '01a0d242-5613-71ef-93af-d41e1cca9f16';

describe('item-ledger rules', () => {
  describe('reportTypeOf (§5.3 — the same table as the SQL reportTypeCase)', () => {
    it.each([
      ['OPENING', 'OPENING', {}, 'OPENING'],
      ['PURCHASE', 'GRN', {}, 'GRN'],
      ['PURCHASE', 'PURCHASE_BILL', {}, 'PURCHASE'],
      ['PURCHASE', 'SHORTAGE_RECEIPT', {}, 'SHORTAGE_RECEIPT'],
      ['PURCHASE_RETURN', 'PURCHASE_RETURN', {}, 'PURCHASE_RETURN'],
      ['SALE', 'SALE_BILL', {}, 'SALE'],
      ['SALE_RETURN', 'SALE_RETURN', {}, 'SALE_RETURN'],
      ['DC_ISSUE', 'DELIVERY_CHALLAN', {}, 'DC'],
      ['DC_RETURN', 'DC_RETURN', {}, 'DC_RETURN'],
      ['ADJUST_PLUS', 'ADJUSTMENT', {}, 'ADJUST_PLUS'],
      ['ADJUST_MINUS', 'ISSUE', {}, 'ADJUST_MINUS'],
      ['PHYSICAL_PLUS', 'PHYSICAL', {}, 'COUNT_EXCESS'],
      ['PHYSICAL_MINUS', 'PHYSICAL', {}, 'COUNT_SHORT'],
      ['DAMAGE', 'ADJUSTMENT', {}, 'DAMAGE'],
      ['EXPIRY_WRITEOFF', 'ADJUSTMENT', {}, 'EXPIRED'],
      ['SAMPLE_ISSUE', 'ISSUE', {}, 'SAMPLE'],
      ['GIFT_ISSUE', 'ISSUE', {}, 'GIFT'],
      ['BUCKET_OUT', 'ADJUSTMENT', {}, 'BUCKET_MOVE'],
      ['BUCKET_IN', 'ADJUSTMENT', {}, 'BUCKET_MOVE'],
      ['REPACK_IN', 'ADJUSTMENT', {}, 'REPACK'],
      ['TRANSFER_IN', 'TRANSFER_IN', {}, 'BRANCH_IN'],
      ['TRANSFER_IN', 'TRANSFER_OUT', {}, 'GODOWN_TRANSFER'],
      ['TRANSFER_OUT', 'TRANSFER_OUT', { toOtherBranch: true }, 'BRANCH_OUT'],
      ['TRANSFER_OUT', 'TRANSFER_OUT', { toOtherBranch: false }, 'GODOWN_TRANSFER'],
      ['TRANSFER_OUT', 'TRANSFER_OUT', { internal: true }, 'GODOWN_TRANSFER'],
      ['BUCKET_IN', 'ADJUSTMENT', { internal: true }, 'BUCKET_MOVE'],
    ])('%s / %s %j → %s', (txn, src, opts, expected) => {
      expect(reportTypeOf(txn, src, opts)).toBe(expected);
    });

    it('every code it yields is a known report type', () => {
      for (const code of ['OPENING', 'GRN', 'DC', 'COUNT_EXCESS', 'BRANCH_OUT', 'REVALUED']) {
        expect(REPORT_TYPE_CODES).toContain(code);
      }
    });
  });

  describe('labels', () => {
    it('words a one-leg move by its direction and the other bucket', () => {
      expect(rowTypeLabel('GODOWN_TRANSFER', 'INTERNAL')).toBe('Godown transfer');
      expect(rowTypeLabel('GODOWN_TRANSFER', 'OUT')).toBe('Godown transfer out');
      expect(rowTypeLabel('GODOWN_TRANSFER', 'IN')).toBe('Godown transfer in');
      expect(rowTypeLabel('BUCKET_MOVE', 'OUT', 'DAMAGED')).toBe('To Damaged');
      expect(rowTypeLabel('BUCKET_MOVE', 'IN', 'SALEABLE')).toBe('From Saleable');
      expect(rowTypeLabel('BUCKET_MOVE', 'INTERNAL')).toBe('Bucket move');
      expect(rowTypeLabel('SALE', 'OUT')).toBe('Sale');
      expect(rowTypeLabel('REPACK', 'OUT')).toBe('Repack out');
    });

    it('tile words ("41 sales · 1 branch out · 1 to damaged")', () => {
      expect(tileLabel('SALE', 'OUT', null)).toBe('sales');
      expect(tileLabel('BRANCH_OUT', 'OUT', null)).toBe('branch out');
      expect(tileLabel('BUCKET_MOVE', 'OUT', 'DAMAGED')).toBe('to damaged');
      expect(tileLabel('PURCHASE', 'IN', null)).toBe('purchases');
    });

    it('By voucher type lines name the pair class', () => {
      expect(byTypeLabel('SALE', 'LIVE')).toBe('Sale');
      expect(byTypeLabel('SALE', 'CANCELLED')).toBe('Sale cancelled (pair)');
      expect(byTypeLabel('SALE', 'AMENDED')).toBe('Sale amended (pair, old lines)');
    });

    it('every report type has a label and a kind', () => {
      for (const code of REPORT_TYPE_CODES) {
        expect(REPORT_TYPES[code].label).toBeTruthy();
        expect(['IN', 'OUT', 'INTERNAL', 'VALUE', 'MIXED']).toContain(REPORT_TYPES[code].kind);
      }
    });
  });

  describe('partyOf (D5 / D6)', () => {
    const base = {
      docKind: 'SALE_BILL' as const,
      srcModule: 'SALES',
      partyId: WALK,
      ledgerName: 'MADHAVAN',
      billCustomerId: WALK,
      billCustomerName: 'MADHAVAN',
      walkInId: WALK,
      walkInName: 'MADHAVAN',
    };

    it('a walk-in bill with no typed name is "Counter (cash)"', () => {
      expect(partyOf(base)).toEqual({ id: WALK, label: COUNTER_CASH, walkIn: true });
    });

    it('a walk-in bill with a typed name shows that name', () => {
      expect(partyOf({ ...base, billCustomerName: '  Kavitha ' })).toEqual({
        id: WALK,
        label: 'Kavitha',
        walkIn: true,
      });
    });

    it('a bill with no customer at all is a walk-in', () => {
      expect(
        partyOf({ ...base, billCustomerId: null, partyId: null, billCustomerName: '' }),
      ).toEqual({ id: null, label: COUNTER_CASH, walkIn: true });
    });

    it('a named customer keeps the bill’s name, else the ledger’s', () => {
      const named = { ...base, partyId: CUST, billCustomerId: CUST, ledgerName: 'ZT-CUST-CREDIT' };
      expect(partyOf({ ...named, billCustomerName: 'Deepan' })).toEqual({
        id: CUST,
        label: 'Deepan',
        walkIn: false,
      });
      expect(partyOf({ ...named, billCustomerName: ' ' })?.label).toBe('ZT-CUST-CREDIT');
    });

    it('no walk-in configured: the walk-in ledger is just a customer', () => {
      expect(partyOf({ ...base, walkInId: null, walkInName: null })).toEqual({
        id: WALK,
        label: 'MADHAVAN',
        walkIn: false,
      });
    });

    it('other sales docs: the ledger, or Counter (cash) for the walk-in', () => {
      expect(
        partyOf({
          ...base,
          docKind: 'DELIVERY_CHALLAN',
          billCustomerId: null,
          billCustomerName: null,
        }),
      ).toEqual({ id: WALK, label: COUNTER_CASH, walkIn: true });
      expect(
        partyOf({
          ...base,
          docKind: 'SALE_RETURN',
          partyId: CUST,
          ledgerName: 'ZT-CUST',
          billCustomerId: null,
        }),
      ).toEqual({ id: CUST, label: 'ZT-CUST', walkIn: false });
    });

    it('purchase docs: the supplier; stock vouchers: no party', () => {
      expect(
        partyOf({
          ...base,
          docKind: 'GRN',
          srcModule: 'PURCHASE',
          partyId: CUST,
          ledgerName: 'Sup',
        }),
      ).toEqual({ id: CUST, label: 'Sup', walkIn: false });
      expect(
        partyOf({
          ...base,
          docKind: 'ADJUSTMENT',
          srcModule: 'STOCK',
          partyId: null,
          ledgerName: null,
        }),
      ).toBeNull();
    });

    it('the walk-in setting matches whatever its case (the database answers lower case)', () => {
      const upperWalk = { ...base, walkInId: WALK.toUpperCase() };
      expect(partyOf(upperWalk)).toEqual({ id: WALK, label: COUNTER_CASH, walkIn: true });
      expect(
        partyOf({
          ...upperWalk,
          docKind: 'DELIVERY_CHALLAN',
          billCustomerId: null,
          billCustomerName: null,
        }),
      ).toEqual({ id: WALK, label: COUNTER_CASH, walkIn: true });
      // The walk-in's own name, found through the ledger when the setting gave none.
      expect(partyOf({ ...upperWalk, walkInName: null, billCustomerName: 'madhavan' })?.label).toBe(
        COUNTER_CASH,
      );
    });

    it('sameId: case aside, never equal when one side is absent', () => {
      expect(sameId(WALK, WALK.toUpperCase())).toBe(true);
      expect(sameId(` ${WALK} `, WALK)).toBe(true);
      expect(sameId(WALK, CUST)).toBe(false);
      expect(sameId(null, null)).toBe(false);
      expect(sameId(WALK, null)).toBe(false);
      expect(sameId('', '')).toBe(false);
    });
  });

  describe('docKindOf — the bill through the shadow’s link, else the voucher', () => {
    it.each([
      [{ linkDocType: 'SALE_BILL', voucherType: 'ISSUE' }, 'SALE_BILL'],
      [{ linkDocType: 'PURCHASE_BILL', voucherType: 'RECEIPT' }, 'PURCHASE_BILL'],
      [{ linkDocType: 'PURCHASE_RETURN', voucherType: 'ISSUE' }, 'PURCHASE_RETURN'],
      [{ linkDocType: null, voucherType: 'ISSUE' }, 'ISSUE'],
      [{ linkDocType: null, voucherType: 'OPENING' }, 'OPENING'],
      [{ linkDocType: null, voucherType: 'TRANSFER_OUT', toBranchId: BRANCH }, 'BRANCH_OUTWARD'],
      [{ linkDocType: null, voucherType: 'TRANSFER_OUT' }, 'GODOWN_TRANSFER'],
      [{ linkDocType: 'STOCK_VOUCHER', voucherType: 'TRANSFER_IN' }, 'BRANCH_INWARD'],
      [{ linkDocType: null, voucherType: null, srcDocType: 'PURCHASE_BILL' }, 'PURCHASE_BILL'],
    ])('%j → %s', (input, expected) => {
      const blank: Parameters<typeof docKindOf>[0] = {
        linkDocType: null,
        voucherType: null,
        toBranchId: null,
        srcDocType: null,
      };
      expect(docKindOf({ ...blank, ...input })).toBe(expected);
    });
  });

  it('revisionOf reads /rN, N > 1 only', () => {
    expect(revisionOf('SALE_BILL/bil00060/r2')).toBe(2);
    expect(revisionOf('SALE_BILL/bil00060/r1')).toBeNull();
    expect(revisionOf('ADJ/2026-2027/D1/00033')).toBeNull();
    expect(revisionOf(null)).toBeNull();
  });

  it('transit words', () => {
    expect(transitText('RECEIVED', '2026-10-26')).toBe('received 26/10/2026');
    expect(transitText('PARTIAL', null)).toBe('part received');
    expect(transitText('IN_TRANSIT', null)).toBe('in transit');
    expect(transitText('CANCELLED', null)).toBe('recalled');
    expect(transitText(null, null)).toBeNull();
  });

  describe('units and formats (IL-27)', () => {
    it('quantity ÷ factor, rate × factor, in Decimal', () => {
      expect(qtyIn('3420', '10')).toBe('342.000');
      expect(qtyIn('-1', '3')).toBe('-0.333');
      expect(rateIn('23.835', '10')).toBe('238.35');
      expect(rateOf('-89020.33', '-1314', '1')).toBe('67.75');
      expect(rateOf('100', '0', '1')).toBeNull();
      expect(rateOf('0.1', '3', '12')).toBe('0.40');
    });

    it('dates and months', () => {
      expect(dayBefore('2026-11-01')).toBe('2026-10-31');
      expect(dayBefore('2024-03-01')).toBe('2024-02-29');
      expect(monthsBetween('2026-04-01', '2026-11-10')).toEqual([
        '2026-04',
        '2026-05',
        '2026-06',
        '2026-07',
        '2026-08',
        '2026-09',
        '2026-10',
        '2026-11',
      ]);
      expect(monthsBetween('2026-12-01', '2027-02-02')).toEqual(['2026-12', '2027-01', '2027-02']);
      expect(monthEnd('2026-11')).toBe('2026-11-30');
      expect(monthEnd('2028-02')).toBe('2028-02-29');
      expect(monthLabel('2026-04')).toBe('Apr-2026');
      expect(isRealIsoDate('2026-02-30')).toBe(false);
      expect(isRealIsoDate('2026-02-28')).toBe(true);
    });

    it('printedAs names every applied filter', () => {
      expect(
        printedAsOf({
          itemName: 'ZT-ITEM-A',
          branchName: 'Coimbatore',
          from: '2026-11-01',
          to: '2026-11-10',
          godownName: null,
          bucket: 'SALEABLE',
          batchNo: null,
          unitName: 'PCS',
          valueAt: 'WITHOUT_TAX',
          types: ['SALE'],
          showReversed: false,
        }),
      ).toBe(
        'ZT-ITEM-A · Coimbatore · 01/11/2026 to 10/11/2026 · All godowns · Saleable · All batches · ' +
          'Types: Sale · Qty in PCS · Cost without tax · Cancelled & amended hidden',
      );
    });
  });

  describe('the query DTOs (house ValidationPipe → 400 VALIDATION_*)', () => {
    const base = {
      companyId: COMPANY,
      branchId: BRANCH,
      itemId: ITEM,
      from: '2026-11-01',
      to: '2026-11-10',
    };
    const check = async (
      cls: typeof ItemLedgerQueryDto | typeof ItemLedgerMonthsDto,
      plain: object,
    ) => {
      const dto = plainToInstance(cls, plain);
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      return {
        dto,
        errors: errors.map((e) => `${e.property}:${Object.keys(e.constraints ?? {})[0]}`),
      };
    };

    it('splits and upper-cases the types list, comma or repeated', async () => {
      expect(
        (await check(ItemLedgerQueryDto, { ...base, types: 'sale, purchase,SALE' })).dto.types,
      ).toEqual(['SALE', 'PURCHASE']);
      expect(
        (await check(ItemLedgerQueryDto, { ...base, types: ['SALE', 'GRN,DC'] })).dto.types,
      ).toEqual(['SALE', 'GRN', 'DC']);
    });

    it.each([
      [{ bucket: 'foo' }, 'bucket:isIn'],
      [{ order: 'up' }, 'order:isIn'],
      [{ valueAt: 'GROSS' }, 'valueAt:isIn'],
      [{ types: 'SALE,NOPE' }, 'types:isIn'],
      [{ from: '2026-02-30' }, 'from:isIso8601'],
      [{ to: '10-11-2026' }, 'to:matches'],
      [{ limit: 5001 }, 'limit:max'],
      [{ page: 0 }, 'page:min'],
      [{ godownId: 'x' }, 'godownId:isHouseUuid'],
    ])('%j is refused (%s)', async (extra, expected) => {
      const { errors } = await check(ItemLedgerQueryDto, { ...base, ...extra });
      expect(errors.map((e) => e.split(':')[0])).toEqual([expected.split(':')[0]]);
    });

    it('accepts the defaults and lower / upper case enums', async () => {
      const { dto, errors } = await check(ItemLedgerQueryDto, {
        ...base,
        bucket: 'all',
        order: 'DESC',
        valueAt: 'with_tax',
        showReversed: 'false',
      });
      expect(errors).toEqual([]);
      expect(dto).toMatchObject({
        bucket: 'ALL',
        order: 'desc',
        valueAt: 'WITH_TAX',
        showReversed: false,
      });
    });

    it('lower-cases every id on all five routes’ DTOs (an upper-case uuid is the same id)', async () => {
      const GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
      const LOT = 'dd08de2b-18f1-575d-b653-df1765055465';
      const UNIT = '01a161d8-5006-718f-a119-460512239ea9';
      const ids = { companyId: COMPANY, branchId: BRANCH, itemId: ITEM };
      const scoped = { ...ids, godownId: GODOWN, lotId: LOT, unitId: UNIT };
      const shout = (o: Record<string, string>) =>
        Object.fromEntries(Object.entries(o).map(([k, v]) => [k, ` ${v.toUpperCase()} `]));
      const dates = { from: base.from, to: base.to };
      for (const [cls, want, extra] of [
        [ItemLedgerOptionsDto, ids, {}],
        [ItemLedgerMonthsDto, scoped, { to: base.to }],
        [ItemLedgerScopeDto, scoped, dates],
        [ItemLedgerExportDto, scoped, dates],
        [ItemLedgerQueryDto, scoped, dates],
      ] as const) {
        const dto = plainToInstance(cls, { ...shout(want), ...extra });
        const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
        expect(errors).toEqual([]);
        expect(dto).toMatchObject(want);
      }
    });

    it('a blank optional id is still absent, a malformed one still refused', async () => {
      const blank = await check(ItemLedgerQueryDto, { ...base, godownId: '  ', lotId: '' });
      expect(blank.errors).toEqual([]);
      expect(blank.dto.godownId).toBeUndefined();
      expect(blank.dto.lotId).toBeUndefined();
      const bad = await check(ItemLedgerQueryDto, { ...base, companyId: 'NOT-A-UUID' });
      expect(bad.errors.map((e) => e.split(':')[0])).toEqual(['companyId']);
    });

    it('the months DTO has no `from`', async () => {
      const { errors } = await check(ItemLedgerMonthsDto, base);
      expect(errors).toEqual(['from:whitelistValidation']);
    });
  });
});
