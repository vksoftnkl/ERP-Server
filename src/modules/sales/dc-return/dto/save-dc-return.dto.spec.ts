import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CancelDcReturnDto, DcReturnKeysDto } from './dc-return-lifecycle.dto';
import { SaveDcReturnDto } from './save-dc-return.dto';
import { SaveDcReturnItemDto } from './save-dc-return-item.dto';

const SDR_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const DC_ID = '019c6f6c-be87-7a11-8905-36092c46b004';
const DC_ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46b005';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b008';
const LOADMAN_A = '019c6f6c-be87-7a11-8905-36092c46b010';
const LOADMAN_B = '019c6f6c-be87-7a11-8905-36092c46b011';

const HEADER = {
  sdrCompanyId: COMPANY_ID,
  sdrBranchId: BRANCH_ID,
  sdrAccYear: '2026-2027',
  sdrDeviceType: 'DESKTOP',
  sdrDeviceId: 'COUNTER-1',
  sdrDcId: DC_ID,
  sdrDcAccYear: '2026-2027',
  sdrUserId: USER_ID,
};

const LINE = {
  sdriDcItemId: DC_ITEM_ID,
  sdriItemId: '019c6f6c-be87-7a11-8905-36092c46b012',
  sdriItemUnitId: '019c6f6c-be87-7a11-8905-36092c46b013',
  sdriGodownId: '019c6f6c-be87-7a11-8905-36092c46b014',
  sdriReturnQty: 4,
};

const erroredFields = <T extends object>(cls: new () => T, plain: object): string[] =>
  validateSync(plainToInstance(cls, plain)).map((error) => error.property);

describe('SaveDcReturnDto', () => {
  it('accepts a header naming the challan it answers', () => {
    expect(erroredFields(SaveDcReturnDto, HEADER)).toEqual([]);
  });

  it('requires the keys, the device, the user and the challan', () => {
    expect(erroredFields(SaveDcReturnDto, {}).sort()).toEqual(
      [
        'sdrAccYear',
        'sdrBranchId',
        'sdrCompanyId',
        'sdrDcAccYear',
        'sdrDcId',
        'sdrDeviceId',
        'sdrDeviceType',
        'sdrUserId',
      ].sort(),
    );
  });

  it('reads loadmen sent as a comma list', () => {
    const dto = plainToInstance(SaveDcReturnDto, {
      ...HEADER,
      sdrLoadmanId: ` ${LOADMAN_A} , ${LOADMAN_B},`,
    });

    expect(dto.sdrLoadmanId).toEqual([LOADMAN_A, LOADMAN_B]);
    expect(validateSync(dto)).toEqual([]);
  });

  it('reads a null or empty loadman list as no loadmen', () => {
    expect(plainToInstance(SaveDcReturnDto, { sdrLoadmanId: null }).sdrLoadmanId).toEqual([]);
    expect(plainToInstance(SaveDcReturnDto, { sdrSalesmanId: '' }).sdrSalesmanId).toEqual([]);
  });

  it('trims the ids of a salesman array', () => {
    expect(
      plainToInstance(SaveDcReturnDto, { sdrSalesmanId: [` ${LOADMAN_A} `] }).sdrSalesmanId,
    ).toEqual([LOADMAN_A]);
  });

  it('refuses a loadman id that is not a uuid', () => {
    expect(erroredFields(SaveDcReturnDto, { ...HEADER, sdrLoadmanId: 'driver-1' })).toEqual([
      'sdrLoadmanId',
    ]);
  });

  it('validates the nested lines', () => {
    const [error] = validateSync(
      plainToInstance(SaveDcReturnDto, { ...HEADER, items: [LINE, { ...LINE, sdriItemId: 'x' }] }),
    );

    expect(error.property).toBe('items');
    expect(error.children?.[0].property).toBe('1');
  });
});

describe('SaveDcReturnItemDto', () => {
  it('requires the challan line, item, unit and godown', () => {
    expect(erroredFields(SaveDcReturnItemDto, {}).sort()).toEqual(
      ['sdriDcItemId', 'sdriGodownId', 'sdriItemId', 'sdriItemUnitId'].sort(),
    );
  });

  it('upper-cases a bucket and accepts the five the column allows', () => {
    const line = plainToInstance(SaveDcReturnItemDto, { ...LINE, sdriBucket: ' damaged ' });

    expect(line.sdriBucket).toBe('DAMAGED');
    expect(validateSync(line)).toEqual([]);
  });

  it('refuses a bucket outside the five, and refuses null for the NOT NULL column', () => {
    expect(erroredFields(SaveDcReturnItemDto, { ...LINE, sdriBucket: 'SHELF' })).toEqual([
      'sdriBucket',
    ]);
    expect(erroredFields(SaveDcReturnItemDto, { ...LINE, sdriBucket: null })).toEqual([
      'sdriBucket',
    ]);
  });

  it('lets a line leave the bucket out for SALEABLE', () => {
    expect(erroredFields(SaveDcReturnItemDto, LINE)).toEqual([]);
  });
});

describe('DC return lifecycle DTOs', () => {
  const keys = {
    sdrId: SDR_ID,
    sdrCompanyId: COMPANY_ID,
    sdrBranchId: BRANCH_ID,
    sdrAccYear: '2026-2027',
  };

  it('requires all four keys', () => {
    expect(erroredFields(DcReturnKeysDto, keys)).toEqual([]);
    expect(erroredFields(DcReturnKeysDto, { ...keys, sdrId: 'DCR-1' })).toEqual(['sdrId']);
  });

  it('wants a reason to cancel', () => {
    expect(erroredFields(CancelDcReturnDto, { ...keys, reason: '  ' })).toEqual(['reason']);
    expect(erroredFields(CancelDcReturnDto, { ...keys, reason: 'Wrong challan' })).toEqual([]);
  });
});
