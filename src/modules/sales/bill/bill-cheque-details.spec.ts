import { Prisma } from '@prisma/client';
import { TENDER_TYPE } from '../posting/sales-doc.utils';
import {
  buildDraftCheques,
  chequeDetailsFor,
  readDraftCheques,
  toDraftChequesJson,
} from './bill-cheque-details';

const CHEQUE_A = '019c6f6c-be87-7a11-8905-36092c46b201';
const CHEQUE_B = '019c6f6c-be87-7a11-8905-36092c46b202';
const CASH_ROW = '019c6f6c-be87-7a11-8905-36092c46b203';

const DETAIL = { drawerName: 'Ravi', bankBranch: 'T Nagar', ifsc: 'SBIN0001', micr: '600002' };

describe('readDraftCheques', () => {
  it.each([null, undefined, 'text', 12, ['a']])('reads %p as no drafts', (value) => {
    expect(readDraftCheques(value as Prisma.JsonValue)).toEqual({});
  });

  it('keeps a null entry ("sent, and empty") and blanks out empty or non-text parts', () => {
    expect(
      readDraftCheques({
        [CHEQUE_A]: null,
        [CHEQUE_B]: { drawerName: 'Ravi', bankBranch: '  ', ifsc: 7, micr: null },
      }),
    ).toEqual({
      [CHEQUE_A]: null,
      [CHEQUE_B]: { drawerName: 'Ravi', bankBranch: null, ifsc: null, micr: null },
    });
  });

  it('drops an entry that is neither null nor an object', () => {
    expect(readDraftCheques({ [CHEQUE_A]: 'x', [CHEQUE_B]: [1] })).toEqual({});
  });
});

describe('buildDraftCheques', () => {
  const persisted = [
    { tdId: CHEQUE_A, tdRowNo: 1, tdTenderTypeId: TENDER_TYPE.CHEQUE },
    { tdId: CASH_ROW, tdRowNo: 2, tdTenderTypeId: TENDER_TYPE.CASH },
    { tdId: CHEQUE_B, tdRowNo: 3, tdTenderTypeId: String(TENDER_TYPE.CHEQUE) },
  ];

  it('changes nothing when the save omitted tenders', () => {
    expect(buildDraftCheques(undefined, persisted, { [CHEQUE_A]: DETAIL })).toBeUndefined();
  });

  it('matches a new row to the persisted cheque by its position', () => {
    expect(
      buildDraftCheques(
        [{ tdAmount: 100, cheque: DETAIL }, { tdAmount: 50 }, { tdAmount: 10, cheque: null }],
        persisted,
        {},
      ),
    ).toEqual({ [CHEQUE_A]: DETAIL, [CHEQUE_B]: null });
  });

  it('keeps the earlier draft of a cheque the save did not touch', () => {
    expect(buildDraftCheques([{ tdId: CHEQUE_A }], persisted, { [CHEQUE_B]: DETAIL })).toEqual({
      [CHEQUE_B]: DETAIL,
    });
  });

  it('forgets the draft of a row that is no longer a live cheque', () => {
    const gone = persisted.map((row) =>
      row.tdId === CHEQUE_A ? { ...row, tdIsDeleted: true } : row,
    );

    expect(buildDraftCheques([], gone, { [CHEQUE_A]: DETAIL, [CASH_ROW]: DETAIL })).toEqual({});
  });
});

describe('toDraftChequesJson', () => {
  it('stores NULL rather than an empty object', () => {
    expect(toDraftChequesJson({})).toBe(Prisma.DbNull);
  });

  it('stores the drafts as they are', () => {
    expect(toDraftChequesJson({ [CHEQUE_A]: DETAIL })).toEqual({ [CHEQUE_A]: DETAIL });
  });
});

describe('chequeDetailsFor', () => {
  let findMany: jest.Mock;
  const client = () => ({ accPdcRegister: { findMany } }) as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([]);
  });

  it('reads nothing for a bill without cheques', async () => {
    const out = await chequeDetailsFor(
      client(),
      [{ tdId: CASH_ROW, tdTenderTypeId: TENDER_TYPE.CASH }],
      null,
    );

    expect(out.size).toBe(0);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("prefers the register row's details, falls back to the draft, else null", async () => {
    findMany.mockResolvedValue([
      {
        apdTenderId: CHEQUE_A,
        apdDrawerName: 'From register',
        apdBankBranch: null,
        apdIfsc: null,
        apdMicr: null,
      },
    ]);
    const third = '019c6f6c-be87-7a11-8905-36092c46b204';

    const out = await chequeDetailsFor(
      client(),
      [
        { tdId: CHEQUE_A, tdTenderTypeId: TENDER_TYPE.CHEQUE },
        { tdId: CHEQUE_B, tdTenderTypeId: TENDER_TYPE.CHEQUE },
        { tdId: third, tdTenderTypeId: TENDER_TYPE.CHEQUE },
        { tdId: CASH_ROW, tdTenderTypeId: TENDER_TYPE.CASH },
      ],
      { [CHEQUE_A]: DETAIL, [CHEQUE_B]: { drawerName: 'From draft' } },
    );

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ apdTenderId: { in: [CHEQUE_A, CHEQUE_B, third] } }) as object,
      }),
    );
    expect(Object.fromEntries(out)).toEqual({
      [CHEQUE_A]: { drawerName: 'From register', bankBranch: null, ifsc: null, micr: null },
      [CHEQUE_B]: { drawerName: 'From draft', bankBranch: null, ifsc: null, micr: null },
      [third]: null,
    });
  });
});
