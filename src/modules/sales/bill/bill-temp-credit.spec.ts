import type { SaveTenderDetailDto } from '../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { TENDER_TYPE } from '../posting/sales-doc.utils';
import { decodeTempCredit, encodeTempCreditTenders, toTempCreditDto } from './bill-temp-credit';

const TEMP_CR_TENDER = '019c6f6c-be87-7a11-8905-36092c46b101';

const tempCreditRow = (tdNotes: string | null, overrides: object = {}) => ({
  tdTenderTypeId: TENDER_TYPE.TEMP_CREDIT,
  tdBankName: 'Ravi',
  tdRefNo: '9876543210',
  tdPayerVpa: 'Anna Nagar',
  tdNotes,
  ...overrides,
});

describe('encodeTempCreditTenders', () => {
  it('leaves an omitted tender list omitted', () => {
    expect(encodeTempCreditTenders(undefined)).toBeUndefined();
  });

  it('strips tempCredit and cheque, which are not columns, from every row', () => {
    const [row] = encodeTempCreditTenders([
      {
        tdTenderId: TEMP_CR_TENDER,
        tdAmount: 100,
        tempCredit: null,
        cheque: { drawerName: 'X' },
      },
    ])!;

    expect(row).toEqual({ tdTenderId: TEMP_CR_TENDER, tdAmount: 100 });
  });

  it('folds the person behind a TEMP_CR into the columns that tender never uses', () => {
    const [row] = encodeTempCreditTenders([
      {
        tdTenderId: TEMP_CR_TENDER,
        tdAmount: 500,
        tempCredit: {
          name: 'Ravi',
          mobile: '9876543210',
          place: 'Anna Nagar',
          addr: '12 Main Rd',
          idRef: 'AADHAAR-1',
          days: 7,
          notes: 'regular',
        },
      },
    ])!;

    expect(row).toEqual({
      tdTenderId: TEMP_CR_TENDER,
      tdAmount: 500,
      tdBankName: 'Ravi',
      tdRefNo: '9876543210',
      tdPayerVpa: 'Anna Nagar',
      tdNotes: 'TEMP_CR:{"addr":"12 Main Rd","idRef":"AADHAAR-1","days":7,"notes":"regular"}',
    });
  });

  it('fills the optional parts with null and zero days', () => {
    const [row] = encodeTempCreditTenders([
      { tdAmount: 50, tempCredit: { name: 'Ravi', mobile: '9876543210' } },
    ])!;

    expect(row.tdPayerVpa).toBeNull();
    expect(row.tdNotes).toBe('TEMP_CR:{"addr":null,"idRef":null,"days":0,"notes":null}');
  });

  it('cuts the notes column at its 250 characters', () => {
    const [row] = encodeTempCreditTenders([
      { tdAmount: 50, tempCredit: { name: 'Ravi', mobile: '1', notes: 'x'.repeat(400) } },
    ])!;

    expect(row.tdNotes).toHaveLength(250);
    expect(row.tdNotes?.startsWith('TEMP_CR:')).toBe(true);
  });
});

describe('decodeTempCredit', () => {
  it('reads nothing off a tender that is not a temporary credit', () => {
    expect(decodeTempCredit(tempCreditRow(null, { tdTenderTypeId: TENDER_TYPE.CASH }))).toBeNull();
  });

  it('reads nothing when the name or the mobile is missing', () => {
    expect(decodeTempCredit(tempCreditRow(null, { tdBankName: null }))).toBeNull();
    expect(decodeTempCredit(tempCreditRow(null, { tdRefNo: '' }))).toBeNull();
  });

  it('takes the tender type as text, the way a raw row can carry it', () => {
    expect(
      decodeTempCredit(tempCreditRow(null, { tdTenderTypeId: String(TENDER_TYPE.TEMP_CREDIT) })),
    ).toMatchObject({ name: 'Ravi' });
  });

  it('reads back what encodeTempCreditTenders wrote', () => {
    const tempCredit = {
      name: 'Ravi',
      mobile: '9876543210',
      place: 'Anna Nagar',
      addr: '12 Main Rd',
      idRef: 'AADHAAR-1',
      days: 7,
      notes: 'regular',
    };
    const [row] = encodeTempCreditTenders([
      { tdTenderTypeId: TENDER_TYPE.TEMP_CREDIT, tempCredit } as SaveTenderDetailDto,
    ])!;

    const decoded = decodeTempCredit({
      tdTenderTypeId: TENDER_TYPE.TEMP_CREDIT,
      tdBankName: row.tdBankName ?? null,
      tdRefNo: row.tdRefNo ?? null,
      tdPayerVpa: row.tdPayerVpa ?? null,
      tdNotes: row.tdNotes ?? null,
    });

    expect(decoded).toEqual(tempCredit);
    expect(toTempCreditDto(decoded!)).toEqual(tempCredit);
  });

  it('keeps the person when the notes are not ours or not JSON', () => {
    const expected = {
      name: 'Ravi',
      mobile: '9876543210',
      place: 'Anna Nagar',
      addr: null,
      idRef: null,
      days: 0,
      notes: null,
    };

    expect(decodeTempCredit(tempCreditRow('paid next week'))).toEqual(expected);
    expect(decodeTempCredit(tempCreditRow('TEMP_CR:{not json'))).toEqual(expected);
  });

  it('reads a days figure that is not a number as zero', () => {
    expect(decodeTempCredit(tempCreditRow('TEMP_CR:{"days":"soon"}'))?.days).toBe(0);
  });
});
