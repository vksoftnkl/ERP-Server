import { GST_REG_TYPES, checkGstin } from './gst-registration';

const FIELDS = { gstin: 'compGstin', stateCode: 'compStateCode', pan: 'compPanNo' };
// Tamil Nadu (33), PAN ABCDE1234F.
const GSTIN = '33ABCDE1234F1Z5';

describe('GST_REG_TYPES', () => {
  it("lists only a business's own registrations, never Consumer or Overseas", () => {
    expect(GST_REG_TYPES).toEqual(['REGULAR', 'COMPOSITION', 'UNREGISTERED', 'SEZ']);
  });
});

describe('checkGstin', () => {
  it.each([null, undefined, ''])('passes a missing GSTIN (%p) without a word', (gstin) => {
    expect(checkGstin(gstin, '33', null, FIELDS)).toEqual({ errors: [], panFromGstin: null });
  });

  it('passes a GSTIN of the same state and PAN', () => {
    expect(checkGstin(GSTIN, '33', 'ABCDE1234F', FIELDS)).toEqual({
      errors: [],
      panFromGstin: null,
    });
  });

  it('hands back the PAN the GSTIN carries when no PAN was given', () => {
    expect(checkGstin(GSTIN, '33', null, FIELDS)).toEqual({
      errors: [],
      panFromGstin: 'ABCDE1234F',
    });
    expect(checkGstin(GSTIN, '33', '', FIELDS).panFromGstin).toBe('ABCDE1234F');
  });

  it.each([
    ['too short', '33ABCDE1234F1Z'],
    ['lower case', '33abcde1234f1z5'],
    ['a letter in the state code', '3XABCDE1234F1Z5'],
    ['a symbol', '33ABCDE1234F1Z-'],
  ])('refuses a GSTIN that is %s, on the GSTIN field, and checks nothing else', (_label, gstin) => {
    const result = checkGstin(gstin, '29', 'ZZZZZ9999Z', FIELDS);

    expect(result).toEqual({
      errors: [
        {
          field: 'compGstin',
          message:
            'compGstin must be 15 letters or digits: a 2-digit state code, the 10-character PAN, then 3 more',
        },
      ],
      panFromGstin: null,
    });
  });

  it('refuses a GSTIN registered in another state', () => {
    expect(checkGstin(GSTIN, '29', 'ABCDE1234F', FIELDS).errors).toEqual([
      {
        field: 'compGstin',
        message: 'GSTIN 33ABCDE1234F1Z5 is registered in state 33, but compStateCode is 29',
      },
    ]);
  });

  it('refuses a PAN that does not match the one in the GSTIN', () => {
    expect(checkGstin(GSTIN, '33', 'ZZZZZ9999Z', FIELDS).errors).toEqual([
      {
        field: 'compPanNo',
        message: 'compPanNo ZZZZZ9999Z does not match the PAN in GSTIN 33ABCDE1234F1Z5 (ABCDE1234F)',
      },
    ]);
  });

  it('reports a wrong state and a wrong PAN together', () => {
    expect(checkGstin(GSTIN, '29', 'ZZZZZ9999Z', FIELDS).errors.map((e) => e.field)).toEqual([
      'compGstin',
      'compPanNo',
    ]);
  });

  it('compares no PAN when the GSTIN carries something else in the PAN slot (a UIN or TAN)', () => {
    // Characters 3-12 here are not PAN-shaped.
    const uin = '3312345678901Z5';

    expect(checkGstin(uin, '33', 'ABCDE1234F', FIELDS)).toEqual({
      errors: [],
      panFromGstin: null,
    });
    expect(checkGstin(uin, '33', null, FIELDS).panFromGstin).toBeNull();
  });

  it('words its messages with the field names it is given', () => {
    const branch = { gstin: 'brGstin', stateCode: 'brStateCode', pan: 'brPanNo' };

    expect(checkGstin(GSTIN, '29', null, branch).errors).toEqual([
      {
        field: 'brGstin',
        message: 'GSTIN 33ABCDE1234F1Z5 is registered in state 33, but brStateCode is 29',
      },
    ]);
  });
});
