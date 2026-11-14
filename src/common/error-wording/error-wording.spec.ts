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

describe('error wording — {name} placeholders (Sale Return P2a)', () => {
  beforeEach(() =>
    setErrorWording(
      [
        {
          code: 'SALES_RETURN_SCHEME_SHORT',
          variant: '',
          lang: 'en',
          title: 'Scheme broken',
          line: 'After this return the customer keeps a scheme benefit they no longer earn ({value}).',
          todo: 'Ask for it back, or carry on.',
        },
        {
          code: 'SALES_RETURN_LOT_EXPIRED',
          variant: '',
          lang: 'en',
          title: 'Lot past expiry',
          line: 'Lot {lot} expired {n} days ago.',
          todo: 'Make it a Claim, or tick to carry on.',
        },
        {
          code: 'SALES_RETURN_ON_DRAFTS',
          variant: '',
          lang: 'en',
          title: 'On other drafts',
          line: '{qty} of this line are on other draft returns ({refnos}).',
          todo: 'Only the first return to post gets them.',
        },
        {
          code: 'SALES_RETURN_NOT_ON_BILL',
          variant: '',
          lang: 'en',
          title: 'Not on this bill',
          line: 'This item is not on bill {bill}.',
          todo: 'Return it on a separate return with no bill.',
        },
        row('TILL_SESSION_NOT_OPEN', '', 'plain'),
      ],
      '2026-11-13.1',
    ),
  );

  it("fills each {name} from the error's params", () => {
    expect(
      wordingFor({ code: 'SALES_RETURN_LOT_EXPIRED', params: { lot: 'SX1026', n: 13 } })?.line,
    ).toBe('Lot SX1026 expired 13 days ago.');
    expect(
      wordingFor({
        code: 'SALES_RETURN_ON_DRAFTS',
        params: { qty: '3', refnos: 'SRT/2026-2027/D8/00001, SRT/2026-2027/D8/00002' },
      })?.line,
    ).toBe(
      '3 of this line are on other draft returns (SRT/2026-2027/D8/00001, SRT/2026-2027/D8/00002).',
    );
  });

  it('falls back to a plain value on the error itself', () => {
    expect(wordingFor({ code: 'SALES_RETURN_NOT_ON_BILL', bill: 'bil00142' })?.line).toBe(
      'This item is not on bill bil00142.',
    );
  });

  it('never shows a brace: a placeholder with no value goes, with the brackets it sat in', () => {
    expect(wordingFor({ code: 'SALES_RETURN_SCHEME_SHORT' })?.line).toBe(
      'After this return the customer keeps a scheme benefit they no longer earn.',
    );
    expect(wordingFor({ code: 'SALES_RETURN_NOT_ON_BILL' })?.line).toBe(
      'This item is not on bill.',
    );
    expect(JSON.stringify(wordingFor({ code: 'SALES_RETURN_LOT_EXPIRED' }))).not.toMatch(
      /[{}]\w|\w[{}]/,
    );
  });

  it('words the refusals of a /validate answer with their params, and leaves plain rows as they were', () => {
    const body = withUserWordingOnNotes({
      success: true,
      data: {
        warnings: [{ code: 'SALES_RETURN_LOT_EXPIRED', params: { lot: 'B-7', n: 2 } }],
        refusals: [{ code: 'TILL_SESSION_NOT_OPEN' }],
      },
    });

    expect(body.data.warnings[0]).toMatchObject({ user: { line: 'Lot B-7 expired 2 days ago.' } });
    expect(body.data.refusals[0]).toMatchObject({ user: { title: 'plain', line: 'plain line' } });
  });
});
