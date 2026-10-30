import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import {
  AmendDeliveryChallanDto,
  CancelDeliveryChallanDto,
  ConvertPurposeDto,
  DC_PURPOSES,
  DeliveryChallanKeysDto,
  DeliveryChallanTransportDto,
  PostDeliveryChallanDto,
} from './delivery-challan-lifecycle.dto';
import {
  SDC_DATE_FIELDS,
  SDC_OPTIONAL_FIELDS,
  SDC_SERVER_OWNED,
  SaveDeliveryChallanDto,
} from './save-delivery-challan.dto';
import {
  SDI_DATE_FIELDS,
  SDI_OPTIONAL_FIELDS,
  SaveDeliveryChallanItemDto,
} from './save-delivery-challan-item.dto';

const DC_ID = '019c6f6c-be87-7a11-8905-36092c46d001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46d002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46d003';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46d004';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46d005';
const LOADMAN_A = '019c6f6c-be87-7a11-8905-36092c46d010';
const LOADMAN_B = '019c6f6c-be87-7a11-8905-36092c46d011';
const ACC_YEAR = '2026-2027';

const HEADER = {
  sdcCompanyId: COMPANY_ID,
  sdcBranchId: BRANCH_ID,
  sdcAccYear: ACC_YEAR,
  sdcDeviceType: 'DESKTOP',
  sdcDeviceId: 'COUNTER-1',
  sdcCustId: CUST_ID,
  sdcCustName: 'Acme Traders',
  sdcUserId: USER_ID,
};

const LINE = {
  sdiItemId: '019c6f6c-be87-7a11-8905-36092c46d0a1',
  sdiItemUnitId: '019c6f6c-be87-7a11-8905-36092c46d0a2',
  sdiGodownId: '019c6f6c-be87-7a11-8905-36092c46d0a3',
  sdiDcQty: 2,
};

const KEYS = {
  sdcId: DC_ID,
  sdcCompanyId: COMPANY_ID,
  sdcBranchId: BRANCH_ID,
  sdcAccYear: ACC_YEAR,
};

const erroredFields = <T extends object>(cls: new () => T, plain: object): string[] =>
  validateSync(plainToInstance(cls, plain)).map((error) => error.property);

/** Every property the class declares (ES2022 class fields make each one an own key). */
const declared = <T extends object>(cls: new () => T): string[] => Object.keys(new cls());

describe('SaveDeliveryChallanDto', () => {
  it('accepts a header with the keys, the device, the customer and the user', () => {
    expect(erroredFields(SaveDeliveryChallanDto, HEADER)).toEqual([]);
  });

  it('requires the keys, the device, the customer and the user', () => {
    expect(erroredFields(SaveDeliveryChallanDto, {}).sort()).toEqual(
      [
        'sdcAccYear',
        'sdcBranchId',
        'sdcCompanyId',
        'sdcCustId',
        'sdcCustName',
        'sdcDeviceId',
        'sdcDeviceType',
        'sdcUserId',
      ].sort(),
    );
  });

  it('reads loadmen sent as a comma list', () => {
    const dto = plainToInstance(SaveDeliveryChallanDto, {
      ...HEADER,
      sdcLoadmanId: ` ${LOADMAN_A} , ${LOADMAN_B},`,
    });

    expect(dto.sdcLoadmanId).toEqual([LOADMAN_A, LOADMAN_B]);
    expect(validateSync(dto)).toEqual([]);
  });

  it('reads a null or empty id list as nobody, never null (the column is a scalar list)', () => {
    expect(plainToInstance(SaveDeliveryChallanDto, { sdcSalesmanId: null }).sdcSalesmanId).toEqual(
      [],
    );
    expect(plainToInstance(SaveDeliveryChallanDto, { sdcPackedId: '' }).sdcPackedId).toEqual([]);
  });

  it('leaves an id list that was not sent undefined, so an update keeps it', () => {
    expect(plainToInstance(SaveDeliveryChallanDto, HEADER).sdcSalesmanId).toBeUndefined();
  });

  it('trims the ids of an array', () => {
    expect(
      plainToInstance(SaveDeliveryChallanDto, { sdcSalesmanId: [` ${LOADMAN_A} `] }).sdcSalesmanId,
    ).toEqual([LOADMAN_A]);
  });

  it('refuses an id list holding something that is not a uuid', () => {
    expect(
      erroredFields(SaveDeliveryChallanDto, { ...HEADER, sdcLoadmanId: `${LOADMAN_A},driver-1` }),
    ).toEqual(['sdcLoadmanId']);
  });

  it('takes post as a boolean and the overrides as at most 50 strings', () => {
    expect(erroredFields(SaveDeliveryChallanDto, { ...HEADER, post: true })).toEqual([]);
    expect(erroredFields(SaveDeliveryChallanDto, { ...HEADER, post: 'soon' })).toEqual(['post']);
    expect(
      erroredFields(SaveDeliveryChallanDto, { ...HEADER, overrides: ['SALES_BACKDATE'] }),
    ).toEqual([]);
    expect(
      erroredFields(SaveDeliveryChallanDto, {
        ...HEADER,
        overrides: Array.from({ length: 51 }, (_, i) => `CODE_${i}`),
      }),
    ).toEqual(['overrides']);
    expect(erroredFields(SaveDeliveryChallanDto, { ...HEADER, overrides: [7] })).toEqual([
      'overrides',
    ]);
  });

  it('validates the nested lines', () => {
    const [error] = validateSync(
      plainToInstance(SaveDeliveryChallanDto, {
        ...HEADER,
        items: [LINE, { ...LINE, sdiGodownId: 'main' }],
      }),
    );

    expect(error.property).toBe('items');
    expect(error.children?.[0].property).toBe('1');
  });

  it('wants a direction on a transport band sent with the save', () => {
    expect(erroredFields(SaveDeliveryChallanDto, { ...HEADER, transport: {} })).toEqual([
      'transport',
    ]);
    expect(
      erroredFields(SaveDeliveryChallanDto, { ...HEADER, transport: { direction: 'OUTWARD' } }),
    ).toEqual([]);
  });

  describe('the column lists the store copies by', () => {
    const props = declared(SaveDeliveryChallanDto);

    it('names only properties the DTO declares', () => {
      const unknown = [...SDC_OPTIONAL_FIELDS, ...SDC_SERVER_OWNED, ...SDC_DATE_FIELDS].filter(
        (field) => !props.includes(field),
      );

      expect(unknown).toEqual([]);
    });

    it('never copies a server-owned column', () => {
      expect(SDC_OPTIONAL_FIELDS.filter((f) => SDC_SERVER_OWNED.includes(f as never))).toEqual([]);
    });

    it('copies every date column it converts', () => {
      expect(SDC_DATE_FIELDS.filter((f) => !SDC_OPTIONAL_FIELDS.includes(f))).toEqual([]);
    });

    it('treats the one-call instructions as neither a column nor server-owned', () => {
      for (const instruction of ['post', 'overrides']) {
        expect(SDC_OPTIONAL_FIELDS).not.toContain(instruction);
        expect(SDC_SERVER_OWNED).not.toContain(instruction);
      }
    });

    it('names only item properties the line DTO declares, dates included', () => {
      const itemProps = declared(SaveDeliveryChallanItemDto);

      expect(SDI_OPTIONAL_FIELDS.filter((f) => !itemProps.includes(f))).toEqual([]);
      expect(SDI_DATE_FIELDS.filter((f) => !SDI_OPTIONAL_FIELDS.includes(f))).toEqual([]);
    });
  });
});

describe('SaveDeliveryChallanItemDto', () => {
  it('requires the item, its unit and the godown', () => {
    expect(erroredFields(SaveDeliveryChallanItemDto, {}).sort()).toEqual(
      ['sdiGodownId', 'sdiItemId', 'sdiItemUnitId'].sort(),
    );
  });

  it('upper-cases a bucket and accepts the ones the column allows', () => {
    const line = plainToInstance(SaveDeliveryChallanItemDto, { ...LINE, sdiBucket: ' damaged ' });

    expect(line.sdiBucket).toBe('DAMAGED');
    expect(validateSync(line)).toEqual([]);
  });

  it('refuses a bucket outside the list, and null for the NOT NULL column', () => {
    expect(erroredFields(SaveDeliveryChallanItemDto, { ...LINE, sdiBucket: 'SHELF' })).toEqual([
      'sdiBucket',
    ]);
    expect(erroredFields(SaveDeliveryChallanItemDto, { ...LINE, sdiBucket: null })).toEqual([
      'sdiBucket',
    ]);
  });

  it('lets a line leave the bucket out for SALEABLE', () => {
    expect(erroredFields(SaveDeliveryChallanItemDto, LINE)).toEqual([]);
  });
});

describe('Delivery challan lifecycle DTOs', () => {
  it('requires all four keys, the id a uuid', () => {
    expect(erroredFields(DeliveryChallanKeysDto, KEYS)).toEqual([]);
    expect(erroredFields(DeliveryChallanKeysDto, { ...KEYS, sdcId: 'DC-12' })).toEqual(['sdcId']);
    expect(erroredFields(DeliveryChallanKeysDto, { ...KEYS, sdcAccYear: '   ' })).toEqual([
      'sdcAccYear',
    ]);
  });

  it('caps the overrides a post may carry at 50', () => {
    expect(
      erroredFields(PostDeliveryChallanDto, { ...KEYS, overrides: ['SALES_BACKDATE'] }),
    ).toEqual([]);
    expect(
      erroredFields(PostDeliveryChallanDto, {
        ...KEYS,
        overrides: Array.from({ length: 51 }, (_, i) => `CODE_${i}`),
      }),
    ).toEqual(['overrides']);
  });

  it('wants a reason to cancel', () => {
    expect(erroredFields(CancelDeliveryChallanDto, { ...KEYS, reason: '  ' })).toEqual(['reason']);
    expect(erroredFields(CancelDeliveryChallanDto, { ...KEYS, reason: 'Wrong customer' })).toEqual(
      [],
    );
  });

  describe('AmendDeliveryChallanDto', () => {
    const amend = { ...HEADER, sdcId: DC_ID, baseRevision: 1, editRemark: 'Qty corrected' };

    it('accepts a full amend body', () => {
      expect(erroredFields(AmendDeliveryChallanDto, amend)).toEqual([]);
    });

    it('refuses a base revision below 1 or not a whole number', () => {
      expect(erroredFields(AmendDeliveryChallanDto, { ...amend, baseRevision: 0 })).toEqual([
        'baseRevision',
      ]);
      expect(erroredFields(AmendDeliveryChallanDto, { ...amend, baseRevision: 1.5 })).toEqual([
        'baseRevision',
      ]);
    });

    it('wants an edit remark', () => {
      expect(erroredFields(AmendDeliveryChallanDto, { ...amend, editRemark: '' })).toEqual([
        'editRemark',
      ]);
    });

    it('refuses an id that is not a uuid', () => {
      expect(erroredFields(AmendDeliveryChallanDto, { ...amend, sdcId: 'DC-12' })).toEqual([
        'sdcId',
      ]);
    });
  });

  describe('ConvertPurposeDto', () => {
    it.each(DC_PURPOSES)('accepts %s', (purpose) => {
      expect(erroredFields(ConvertPurposeDto, { ...KEYS, purpose, remark: 'r' })).toEqual([]);
    });

    it('refuses a purpose outside the list, and a lower-cased one', () => {
      expect(erroredFields(ConvertPurposeDto, { ...KEYS, purpose: 'GIFT', remark: 'r' })).toEqual([
        'purpose',
      ]);
      expect(
        erroredFields(ConvertPurposeDto, { ...KEYS, purpose: 'job_work', remark: 'r' }),
      ).toEqual(['purpose']);
    });

    it('wants a remark', () => {
      expect(erroredFields(ConvertPurposeDto, { ...KEYS, purpose: 'SUPPLY' })).toEqual(['remark']);
    });
  });

  it('wants a direction on the band the transport verb carries', () => {
    expect(erroredFields(DeliveryChallanTransportDto, { ...KEYS, transport: {} })).toEqual([
      'transport',
    ]);
    expect(
      erroredFields(DeliveryChallanTransportDto, {
        ...KEYS,
        transport: { direction: 'SIDEWAYS' },
      }),
    ).toEqual(['transport']);
    expect(
      erroredFields(DeliveryChallanTransportDto, {
        ...KEYS,
        transport: { direction: 'OUTWARD', transporterName: 'VRL' },
      }),
    ).toEqual([]);
  });
});
