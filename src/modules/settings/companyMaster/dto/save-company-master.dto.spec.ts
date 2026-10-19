import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { SaveCompanyMasterDto } from './save-company-master.dto';

const BASE = { compName: 'Zeta Traders', compStateCode: '33' };

const dtoOf = (extra: object) => plainToInstance(SaveCompanyMasterDto, { ...BASE, ...extra });
const erroredFields = (extra: object): string[] =>
  validateSync(dtoOf(extra)).map((error) => error.property);

describe('SaveCompanyMasterDto', () => {
  it('accepts the bare minimum and upper-cases the state code', () => {
    const dto = dtoOf({ compStateCode: ' tn ' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.compStateCode).toBe('TN');
  });

  it('requires a name and a two-character state code', () => {
    expect(validateSync(plainToInstance(SaveCompanyMasterDto, {})).map((e) => e.property)).toEqual(
      ['compName', 'compStateCode'],
    );
    expect(erroredFields({ compStateCode: '330' })).toEqual(['compStateCode']);
  });

  it('takes the four GST registration types in any case, and nothing else (C3)', () => {
    const dto = dtoOf({ compGstRegType: 'Regular' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.compGstRegType).toBe('REGULAR');
    expect(erroredFields({ compGstRegType: 'Consumer' })).toEqual(['compGstRegType']);
    expect(erroredFields({ compGstRegType: null })).toEqual([]);
  });

  it('takes an AATO class from the list and refuses null, since the column is not nullable (A2)', () => {
    expect(erroredFields({ compAatoClass: 'GT_10CR' })).toEqual([]);
    expect(erroredFields({ compAatoClass: 'HUGE' })).toEqual(['compAatoClass']);
    expect(erroredFields({ compAatoClass: null })).toEqual(['compAatoClass']);
  });

  it('upper-cases the DC purposes and wants at least one, none twice, all known (A3)', () => {
    const dto = dtoOf({ compDcPurposes: ['supply', ' Job_Work '] });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.compDcPurposes).toEqual(['SUPPLY', 'JOB_WORK']);
    expect(erroredFields({ compDcPurposes: [] })).toEqual(['compDcPurposes']);
    expect(erroredFields({ compDcPurposes: ['SUPPLY', 'supply'] })).toEqual(['compDcPurposes']);
    expect(erroredFields({ compDcPurposes: ['SUPPLY', 'SMUGGLING'] })).toEqual([
      'compDcPurposes',
    ]);
    expect(erroredFields({ compDcPurposes: null })).toEqual(['compDcPurposes']);
  });

  it('upper-cases the GSTIN and PAN and holds them to their exact lengths', () => {
    const dto = dtoOf({ compGstinNo: '33abcde1234f1z5', compPanNo: 'abcde1234f' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto).toMatchObject({ compGstinNo: '33ABCDE1234F1Z5', compPanNo: 'ABCDE1234F' });
    expect(erroredFields({ compGstinNo: '33ABCDE1234F1Z' })).toEqual(['compGstinNo']);
    expect(erroredFields({ compPanNo: 'ABCDE1234' })).toEqual(['compPanNo']);
  });

  it('reads the year dates as dates', () => {
    const dto = dtoOf({ compFinYearFrom: '2026-04-01', compBooksBeginFrom: '' });

    expect(validateSync(dto)).toEqual([]);
    expect(dto.compFinYearFrom).toEqual(new Date('2026-04-01T00:00:00.000Z'));
    expect(dto.compBooksBeginFrom).toBeNull();
  });

  it('refuses a mail address that is not one', () => {
    expect(erroredFields({ compMail: 'office-at-zeta' })).toEqual(['compMail']);
  });

  it('refuses a negative intra-state e-way limit', () => {
    expect(erroredFields({ compEwayIntraLimit: -1 })).toEqual(['compEwayIntraLimit']);
  });
});
