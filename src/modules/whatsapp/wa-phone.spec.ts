import { choosePhone, normalisePhone, phoneCandidates } from './wa-phone';

describe('normalisePhone (NexWhatsApp::normalisePhone + the India mobile check, decision 21)', () => {
  const ok = (raw: string) => normalisePhone(raw);
  it('keeps the Qt cases: digits only, 00 dropped, 0 + 10 digits, 10 digits get 91', () => {
    expect(ok('98653 22154')).toEqual({ ok: true, phone: '919865322154' });
    expect(ok('+91 98653-22154')).toEqual({ ok: true, phone: '919865322154' });
    expect(ok('0091 9865322154')).toEqual({ ok: true, phone: '919865322154' });
    expect(ok('09865322154')).toEqual({ ok: true, phone: '919865322154' });
    expect(ok('447911123456')).toEqual({ ok: true, phone: '447911123456' });
  });
  it('refuses a landline or a short number in India (91 + [6-9] + 9 digits)', () => {
    expect(ok('0422 2345678')).toEqual({ ok: false, reason: 'BAD' });
    expect(ok('4222345678')).toEqual({ ok: false, reason: 'BAD' });
    expect(ok('12345')).toEqual({ ok: false, reason: 'BAD' });
    expect(ok('9865322154123456')).toEqual({ ok: false, reason: 'BAD' });
  });
  it("lets the relay's fake numbers 916000NNNNNN through", () => {
    expect(ok('916000131026')).toEqual({ ok: true, phone: '916000131026' });
    expect(ok('916000000000')).toEqual({ ok: true, phone: '916000000000' });
  });
  it('says EMPTY for nothing at all', () => {
    expect(ok('')).toEqual({ ok: false, reason: 'EMPTY' });
    expect(normalisePhone(null)).toEqual({ ok: false, reason: 'EMPTY' });
  });
});

describe('the number order (Q4)', () => {
  const ledger = { whatsapp: '0422 2345678', phone1: '9865322154', phone2: null };
  it('master WhatsApp → phone 1 → phone 2 → typed on the document; the first usable wins', () => {
    expect(choosePhone(phoneCandidates({ ledger, docPhone: '9800012345', walkIn: false }))).toEqual({
      ok: true,
      phone: '919865322154',
      source: 'PHONE1',
    });
  });
  it('a number typed in the send popup goes first', () => {
    expect(choosePhone(phoneCandidates({ ledger, bodyPhone: '9800099999', walkIn: false }))).toMatchObject({
      phone: '919800099999',
      source: 'TYPED',
    });
  });
  it('a walk-in gets the typed number only', () => {
    expect(choosePhone(phoneCandidates({ ledger, walkIn: true }))).toEqual({ ok: false, code: 'WA_NO_NUMBER', tried: [] });
    expect(choosePhone(phoneCandidates({ ledger, docPhone: '98000 12345', walkIn: true }))).toMatchObject({
      phone: '919800012345',
      source: 'TYPED',
    });
  });
  it('only landlines → WA_BAD_NUMBER; nothing → WA_NO_NUMBER', () => {
    expect(
      choosePhone(phoneCandidates({ ledger: { whatsapp: '04222345678', phone1: null, phone2: null }, walkIn: false })),
    ).toEqual({ ok: false, code: 'WA_BAD_NUMBER', tried: ['WHATSAPP'] });
    expect(choosePhone(phoneCandidates({ ledger: null, walkIn: false }))).toMatchObject({ ok: false, code: 'WA_NO_NUMBER' });
  });
});
