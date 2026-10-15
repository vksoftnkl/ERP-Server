import {
  setErrorWording,
  withUserWording,
  withUserWordingOnNotes,
  wordingFor,
  wordingLangOf,
  type ErrorWordingRow,
} from './error-wording';

const row = (code: string, variant: string, title: string, lang = 'en'): ErrorWordingRow => ({
  code,
  variant,
  lang,
  title,
  line: `${title} line`,
  todo: `${title} todo`,
});

describe('error wording (notes 120)', () => {
  beforeEach(() =>
    setErrorWording(
      [
        row('TILL_SESSION_NOT_OPEN', '', 'plain'),
        row('TILL_SESSION_NOT_OPEN', 'status=PENDING_APPROVAL', 'pending'),
        row('TILL_SESSION_NOT_OPEN', 'status=*', 'any status'),
        row('TILL_SESSION_NOT_OPEN', 'field=tssId', 'cockpit'),
        row('HOLD_NOT_FOUND', '', 'hold not found'),
        row('HOLD_*', '', 'app'),
        row('VALIDATION_*', '', 'app'),
        row('VALIDATION_MIN', '', 'wrong amount'),
        row('HOLD_NOT_FOUND', '', 'tamil', 'ta'),
      ],
      '2026-10-15.1',
    ),
  );

  it('field= first, then <key>=<value>, then <key>=*, then the plain row', () => {
    const base = { code: 'TILL_SESSION_NOT_OPEN', message: 'dev' };
    expect(wordingFor({ ...base, field: 'tssId', status: 'PENDING_APPROVAL' })?.title).toBe(
      'cockpit',
    );
    expect(wordingFor({ ...base, field: 'sbSessionId', status: 'PENDING_APPROVAL' })?.title).toBe(
      'pending',
    );
    expect(wordingFor({ ...base, field: 'sbSessionId', status: 'COUNTING' })?.title).toBe(
      'any status',
    );
    expect(wordingFor({ ...base, field: 'sbSessionId' })?.title).toBe('plain');
  });

  it('the exact code before a prefix row; the longest prefix words the rest', () => {
    expect(wordingFor({ code: 'HOLD_NOT_FOUND' })?.title).toBe('hold not found');
    expect(wordingFor({ code: 'HOLD_DEVICE_INVALID' })?.title).toBe('app');
    expect(wordingFor({ code: 'VALIDATION_MIN' })?.title).toBe('wrong amount');
    expect(wordingFor({ code: 'VALIDATION_IS_UUID' })?.title).toBe('app');
  });

  it('no row, no code: no words — the developer sentence is never borrowed', () => {
    expect(wordingFor({ code: 'SALES_BILL_POSTED', message: 'Bill is posted' })).toBeNull();
    expect(wordingFor({ field: 'x', message: 'no code' })).toBeNull();
  });

  it('a language with the row uses it; one without falls back to English', () => {
    expect(wordingFor({ code: 'HOLD_NOT_FOUND' }, 'ta')?.title).toBe('tamil');
    expect(wordingFor({ code: 'VALIDATION_MIN' }, 'ta')?.title).toBe('wrong amount');
    expect(wordingLangOf({ headers: { 'accept-language': 'ta-IN,en;q=0.8' } })).toBe('ta');
    expect(wordingLangOf({ query: { lang: 'EN' }, headers: {} })).toBe('en');
    expect(wordingLangOf({})).toBe('en');
  });

  it('an error body gets `user` on each coded error, on a copy', () => {
    const body = {
      success: false,
      message: 'Hold not found',
      errors: [
        { field: 'txhId', code: 'HOLD_NOT_FOUND', message: 'No active hold' },
        { field: 'x', message: 'uncoded' },
      ],
    };
    const worded = withUserWording(body);
    expect(worded.errors[0]).toEqual(
      expect.objectContaining({
        code: 'HOLD_NOT_FOUND',
        message: 'No active hold',
        user: { title: 'hold not found', line: 'hold not found line', todo: 'hold not found todo' },
      }),
    );
    expect(worded.errors[1]).not.toHaveProperty('user');
    expect(body.errors[0]).not.toHaveProperty('user');
  });

  it('warnings[] / refusals[] of a success body are worded too', () => {
    const body = {
      success: true,
      data: {
        canPost: false,
        warnings: [{ code: 'VALIDATION_MIN', level: 'WARN', message: 'w' }],
        refusals: [{ code: 'SALES_BILL_POSTED', message: 'r' }],
      },
    };
    const worded = withUserWordingOnNotes(body);
    expect(worded.data.warnings[0]).toHaveProperty('user.title', 'wrong amount');
    expect(worded.data.refusals[0]).not.toHaveProperty('user');
    expect(withUserWordingOnNotes({ success: true, data: [1, 2] })).toEqual({
      success: true,
      data: [1, 2],
    });
  });
});
