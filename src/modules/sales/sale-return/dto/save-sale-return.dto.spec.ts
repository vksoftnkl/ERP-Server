import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  AmendSaleReturnDto,
  CancelSaleReturnDto,
  PostSaleReturnDto,
  SaleReturnKeysDto,
  SaleReturnTransportDto,
  ValidateSaleReturnDto,
} from './sale-return-lifecycle.dto';
import {
  SR_DATE_FIELDS,
  SR_OPTIONAL_FIELDS,
  SR_SERVER_OWNED,
  SaveSaleReturnDto,
} from './save-sale-return.dto';
import {
  SRI_DATE_FIELDS,
  SRI_OPTIONAL_FIELDS,
  SaveSaleReturnItemDto,
} from './save-sale-return-item.dto';

const SR_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e003';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e004';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46e005';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46e006';
const SALESMAN_A = '019c6f6c-be87-7a11-8905-36092c46e020';
const SALESMAN_B = '019c6f6c-be87-7a11-8905-36092c46e021';
const ACC_YEAR = '2026-2027';

const HEADER = {
  srCompanyId: COMPANY_ID,
  srBranchId: BRANCH_ID,
  srAccYear: ACC_YEAR,
  srDeviceType: 'DESKTOP',
  srDeviceId: 'COUNTER-1',
  srCustId: CUST_ID,
  srCustName: 'Acme Traders',
  srUserId: USER_ID,
};

const LINE = {
  sriItemId: '019c6f6c-be87-7a11-8905-36092c46e0a1',
  sriItemUnitId: '019c6f6c-be87-7a11-8905-36092c46e0a2',
  sriGodownId: '019c6f6c-be87-7a11-8905-36092c46e0a3',
  sriReturnQty: 1,
};

const KEYS = { srId: SR_ID, srCompanyId: COMPANY_ID, srBranchId: BRANCH_ID, srAccYear: ACC_YEAR };

const erroredFields = <T extends object>(cls: new () => T, plain: object): string[] =>
  validateSync(plainToInstance(cls, plain)).map((error) => error.property);

/** Every property the class declares (ES2022 class fields make each one an own key). */
const declared = <T extends object>(cls: new () => T): string[] => Object.keys(new cls());

describe('SaveSaleReturnDto', () => {
  it('accepts a header with the keys, the device, the customer and the user', () => {
    expect(erroredFields(SaveSaleReturnDto, HEADER)).toEqual([]);
  });

  it('requires the keys, the device, the customer and the user', () => {
    expect(erroredFields(SaveSaleReturnDto, {}).sort()).toEqual(
      [
        'srAccYear',
        'srBranchId',
        'srCompanyId',
        'srCustId',
        'srCustName',
        'srDeviceId',
        'srDeviceType',
        'srUserId',
      ].sort(),
    );
  });

  it('accepts the bill it is against, and refuses a bill id that is not a uuid', () => {
    expect(
      erroredFields(SaveSaleReturnDto, {
        ...HEADER,
        srIsAgainstBill: true,
        srBillId: BILL_ID,
        srBillAccYear: ACC_YEAR,
      }),
    ).toEqual([]);
    expect(erroredFields(SaveSaleReturnDto, { ...HEADER, srBillId: 'bil00101' })).toEqual([
      'srBillId',
    ]);
  });

  it('reads salesmen sent as a comma list, and null or empty as nobody', () => {
    expect(
      plainToInstance(SaveSaleReturnDto, { srSalesmanId: `${SALESMAN_A}, ${SALESMAN_B}` })
        .srSalesmanId,
    ).toEqual([SALESMAN_A, SALESMAN_B]);
    expect(plainToInstance(SaveSaleReturnDto, { srSalesmanId: null }).srSalesmanId).toEqual([]);
    expect(plainToInstance(SaveSaleReturnDto, { srLoadmanId: '' }).srLoadmanId).toEqual([]);
    expect(plainToInstance(SaveSaleReturnDto, HEADER).srLoadmanId).toBeUndefined();
  });

  it('refuses a salesman id that is not a uuid', () => {
    expect(erroredFields(SaveSaleReturnDto, { ...HEADER, srSalesmanId: ['ravi'] })).toEqual([
      'srSalesmanId',
    ]);
  });

  it('validates the nested lines', () => {
    const [error] = validateSync(
      plainToInstance(SaveSaleReturnDto, { ...HEADER, items: [{ ...LINE, sriItemId: 'x' }] }),
    );

    expect(error.property).toBe('items');
    expect(error.children?.[0].property).toBe('0');
  });

  it('has no one-call post: a save is always a draft', () => {
    expect(declared(SaveSaleReturnDto)).not.toContain('post');
    expect(erroredFields(SaveSaleReturnDto, { ...HEADER, srSettleMode: 'CASH' })).toEqual([]);
  });

  describe('the column lists the store copies by', () => {
    const props = declared(SaveSaleReturnDto);

    it('names only properties the DTO declares', () => {
      expect(
        [...SR_OPTIONAL_FIELDS, ...SR_SERVER_OWNED, ...SR_DATE_FIELDS].filter(
          (field) => !props.includes(field),
        ),
      ).toEqual([]);
    });

    it('never copies a server-owned column, the settlement figures among them', () => {
      expect(SR_OPTIONAL_FIELDS.filter((f) => SR_SERVER_OWNED.includes(f as never))).toEqual([]);
      expect(SR_SERVER_OWNED).toEqual(
        expect.arrayContaining([
          'srRefundAmt',
          'srAdjustedAmt',
          'srCreditAmt',
          'srSettleStatus',
          'srLoyaltyReversePoints',
          'srPromoClawbackAmt',
        ]),
      );
    });

    it('copies every date column it converts', () => {
      expect(SR_DATE_FIELDS.filter((f) => !SR_OPTIONAL_FIELDS.includes(f))).toEqual([]);
    });

    it('names only item properties the line DTO declares, dates included', () => {
      const itemProps = declared(SaveSaleReturnItemDto);

      expect(SRI_OPTIONAL_FIELDS.filter((f) => !itemProps.includes(f))).toEqual([]);
      expect(SRI_DATE_FIELDS.filter((f) => !SRI_OPTIONAL_FIELDS.includes(f))).toEqual([]);
    });
  });
});

describe('SaveSaleReturnItemDto', () => {
  it('requires the item, its unit and the godown', () => {
    expect(erroredFields(SaveSaleReturnItemDto, {}).sort()).toEqual(
      ['sriGodownId', 'sriItemId', 'sriItemUnitId'].sort(),
    );
  });

  it('upper-cases a bucket and refuses one outside the list', () => {
    const line = plainToInstance(SaveSaleReturnItemDto, { ...LINE, sriBucket: 'expired' });

    expect(line.sriBucket).toBe('EXPIRED');
    expect(validateSync(line)).toEqual([]);
    expect(erroredFields(SaveSaleReturnItemDto, { ...LINE, sriBucket: 'BIN' })).toEqual([
      'sriBucket',
    ]);
    expect(erroredFields(SaveSaleReturnItemDto, { ...LINE, sriBucket: null })).toEqual([
      'sriBucket',
    ]);
  });

  it('lets a line name its condition and leave the bucket to it', () => {
    expect(erroredFields(SaveSaleReturnItemDto, { ...LINE, sriCondition: 'DAMAGED' })).toEqual([]);
  });
});

describe('Sale return lifecycle DTOs', () => {
  it('requires all four keys, the id a uuid', () => {
    expect(erroredFields(SaleReturnKeysDto, KEYS)).toEqual([]);
    expect(erroredFields(SaleReturnKeysDto, { ...KEYS, srId: 'SRT-9' })).toEqual(['srId']);
    expect(erroredFields(SaleReturnKeysDto, { ...KEYS, srAccYear: '' })).toEqual(['srAccYear']);
  });

  it('lets validate and post carry at most 50 override codes', () => {
    const many = Array.from({ length: 51 }, (_, i) => `CODE_${i}`);

    expect(
      erroredFields(ValidateSaleReturnDto, { ...HEADER, overrides: ['SALES_RETURN_WINDOW'] }),
    ).toEqual([]);
    expect(erroredFields(ValidateSaleReturnDto, { ...HEADER, overrides: many })).toEqual([
      'overrides',
    ]);
    expect(erroredFields(PostSaleReturnDto, { ...KEYS, overrides: many })).toEqual(['overrides']);
    expect(erroredFields(PostSaleReturnDto, { ...KEYS, printAfter: true })).toEqual([]);
  });

  it('wants a reason to cancel', () => {
    expect(erroredFields(CancelSaleReturnDto, { ...KEYS, reason: ' ' })).toEqual(['reason']);
    expect(erroredFields(CancelSaleReturnDto, { ...KEYS, reason: 'Posted twice' })).toEqual([]);
  });

  describe('AmendSaleReturnDto', () => {
    const amend = { ...HEADER, srId: SR_ID, baseRevision: 1, editRemark: 'Wrong quantity' };

    it('accepts a full amend body', () => {
      expect(erroredFields(AmendSaleReturnDto, amend)).toEqual([]);
    });

    it('refuses a base revision below 1', () => {
      expect(erroredFields(AmendSaleReturnDto, { ...amend, baseRevision: 0 })).toEqual([
        'baseRevision',
      ]);
    });

    it('wants an edit remark', () => {
      expect(erroredFields(AmendSaleReturnDto, { ...amend, editRemark: '   ' })).toEqual([
        'editRemark',
      ]);
    });

    it('refuses an id that is not a uuid', () => {
      expect(erroredFields(AmendSaleReturnDto, { ...amend, srId: 'SRT-9' })).toEqual(['srId']);
    });
  });

  it('wants a direction on the band the transport verb carries', () => {
    expect(erroredFields(SaleReturnTransportDto, { ...KEYS, transport: {} })).toEqual([
      'transport',
    ]);
    expect(
      erroredFields(SaleReturnTransportDto, { ...KEYS, transport: { direction: 'INWARD' } }),
    ).toEqual([]);
  });
});
