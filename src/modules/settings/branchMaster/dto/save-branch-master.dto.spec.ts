import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveBranchMasterDto } from './save-branch-master.dto';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e202';
const BASE = { brCompId: COMPANY_ID, brName: 'Anna Nagar', brStateCode: '33' };

const dtoOf = (extra: object) => plainToInstance(SaveBranchMasterDto, { ...BASE, ...extra });
const erroredFields = (extra: object): string[] =>
  validateSync(dtoOf(extra)).map((error) => error.property);

describe('SaveBranchMasterDto', () => {
  it('accepts the bare minimum and upper-cases the state code', () => {
    const dto = dtoOf({ brStateCode: 'tn' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.brStateCode).toBe('TN');
  });

  it('requires a company, a name and a two-character state code', () => {
    expect(validateSync(plainToInstance(SaveBranchMasterDto, {})).map((e) => e.property)).toEqual([
      'brCompId',
      'brName',
      'brStateCode',
    ]);
    expect(erroredFields({ brCompId: 'company-1' })).toEqual(['brCompId']);
    expect(erroredFields({ brStateCode: 'T' })).toEqual(['brStateCode']);
  });

  it('refuses a name over 150 characters and a brId that is not a uuid', () => {
    expect(erroredFields({ brName: 'x'.repeat(151) })).toEqual(['brName']);
    expect(erroredFields({ brId: '42' })).toEqual(['brId']);
  });

  it('takes the four GST registration types in any case, and nothing else (C3)', () => {
    const dto = dtoOf({ brGstRegType: 'sez' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.brGstRegType).toBe('SEZ');
    expect(erroredFields({ brGstRegType: 'Overseas' })).toEqual(['brGstRegType']);
  });

  it('upper-cases the GSTIN and PAN and holds them to their exact lengths', () => {
    const dto = dtoOf({ brGstinNo: '33abcde1234f1z5', brPanNo: 'abcde1234f' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ brGstinNo: '33ABCDE1234F1Z5', brPanNo: 'ABCDE1234F' });
    expect(erroredFields({ brGstinNo: '33ABCDE1234F1Z55' })).toEqual(['brGstinNo']);
  });

  it('reads the FSSAI expiry as a date and refuses a bad default godown id', () => {
    const dto = dtoOf({ brFssaiValidUpto: '2027-01-31' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.brFssaiValidUpto).toEqual(new Date('2027-01-31T00:00:00.000Z'));
    expect(erroredFields({ brDefaultGodownId: 'main' })).toEqual(['brDefaultGodownId']);
  });
});
