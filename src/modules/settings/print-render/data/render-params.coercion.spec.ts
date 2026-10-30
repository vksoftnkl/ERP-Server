import { PrintRenderErrorCode } from '../types/print-render-error-codes';
import {
  RenderParamError,
  hasContextDefault,
  isServerOwnedParam,
  readParamSpecs,
  resolveRenderParams,
} from './render-params';

/** The details a refused resolve carried. */
function refusalOf(call: () => unknown): RenderParamError['details'] {
  try {
    call();
  } catch (error) {
    if (error instanceof RenderParamError) return error.details;
    throw error;
  }
  throw new Error('expected the answers to be refused');
}

const one = (type: string, extra: object = {}) => [{ name: 'p', type, label: 'Prompt', ...extra }];

describe('render-params — the prompt declaration', () => {
  it('reads an absent declaration as no prompts', () => {
    expect(readParamSpecs(null)).toEqual({ specs: [], errors: [] });
    expect(readParamSpecs(undefined)).toEqual({ specs: [], errors: [] });
  });

  it('drops an entry that is not an object', () => {
    const { specs, errors } = readParamSpecs(['from_date', null, [], { name: 'ok' }]);

    expect(specs.map((spec) => spec.name)).toEqual(['ok']);
    expect(errors.map((error) => [error.field, error.code])).toEqual([
      ['ptvParams[0]', PrintRenderErrorCode.PARAM_NOT_OBJECT],
      ['ptvParams[1]', PrintRenderErrorCode.PARAM_NOT_OBJECT],
      ['ptvParams[2]', PrintRenderErrorCode.PARAM_NOT_OBJECT],
    ]);
  });

  it.each([['FromDate'], ['1st'], ['from-date'], [''], [undefined]])(
    'refuses %p as a prompt name',
    (name) => {
      const { specs, errors } = readParamSpecs([{ name, type: 'TEXT' }]);

      expect(specs).toEqual([]);
      expect(errors[0]).toMatchObject({
        field: 'ptvParams[0].name',
        code: PrintRenderErrorCode.PARAM_NAME_INVALID,
      });
    },
  );

  it('trims the name, upper-cases the type and defaults a missing type to TEXT', () => {
    const { specs } = readParamSpecs([{ name: ' from_date ', type: 'date' }, { name: 'note' }]);

    expect(specs).toEqual([
      { name: 'from_date', type: 'DATE', required: false, label: 'from_date', defaultValue: null },
      { name: 'note', type: 'TEXT', required: false, label: 'note', defaultValue: null },
    ]);
  });

  it('is required only for a literal true, and reads either default key', () => {
    const { specs } = readParamSpecs([
      { name: 'a', required: 'true', default: 'x' },
      { name: 'b', required: true, defaultValue: 'y', label: 'Bee' },
    ]);

    expect(specs).toEqual([
      expect.objectContaining({ name: 'a', required: false, defaultValue: 'x' }),
      expect.objectContaining({ name: 'b', required: true, defaultValue: 'y', label: 'Bee' }),
    ]);
  });

  it('knows the context names and which of them stays the server’s', () => {
    expect(hasContextDefault('doc_id')).toBe(true);
    expect(hasContextDefault('from_date')).toBe(false);
    expect(isServerOwnedParam('company_id')).toBe(true);
    expect(isServerOwnedParam('branch_id')).toBe(false);
  });
});

describe('render-params — coercing each answer', () => {
  it.each([
    ['12.5', 12.5],
    [' 7 ', 7],
    [3, 3],
  ])('reads NUMBER %p as %p', (answer, value) => {
    expect(resolveRenderParams(one('NUMBER'), { p: answer })).toEqual({ p: value });
  });

  it('refuses a NUMBER that is not one, quoting the label and the answer', () => {
    expect(refusalOf(() => resolveRenderParams(one('NUMBER'), { p: 'ten' }))).toEqual([
      {
        field: 'params.p',
        code: PrintRenderErrorCode.PARAM_NOT_NUMBER,
        message: "'Prompt' expects a number; got 'ten'.",
      },
    ]);
  });

  it.each([
    ['yes', true],
    ['Y', true],
    ['1', true],
    ['no', false],
    ['off', false],
    [true, true],
    [false, false],
  ])('reads BOOLEAN %p as %p', (answer, value) => {
    expect(resolveRenderParams(one('BOOLEAN'), { p: answer })).toEqual({ p: value });
  });

  it('reads a DATETIME with an offset as its UTC instant', () => {
    expect(resolveRenderParams(one('DATETIME'), { p: '2026-10-19T10:00:00+05:30' })).toEqual({
      p: '2026-10-19T04:30:00.000Z',
    });
  });

  it('refuses a DATETIME that does not parse', () => {
    expect(refusalOf(() => resolveRenderParams(one('DATETIME'), { p: 'tomorrow' }))).toEqual([
      expect.objectContaining({ code: PrintRenderErrorCode.PARAM_NOT_DATETIME }),
    ]);
  });

  it('accepts a UUID in either case, trimmed', () => {
    const id = ' 019C6F6C-BE87-7A11-8905-36092C46E301 ';

    expect(resolveRenderParams(one('UUID'), { p: id })).toEqual({ p: id.trim() });
  });

  it('refuses a UUID that is not one', () => {
    expect(refusalOf(() => resolveRenderParams(one('UUID'), { p: 'godown-1' }))).toEqual([
      expect.objectContaining({
        code: PrintRenderErrorCode.PARAM_NOT_UUID,
        message: "'Prompt' expects an id; got 'godown-1'.",
      }),
    ]);
  });

  it('refuses a DATE without the YYYY-MM-DD shape', () => {
    expect(refusalOf(() => resolveRenderParams(one('DATE'), { p: '19-10-2026' }))).toEqual([
      expect.objectContaining({ code: PrintRenderErrorCode.PARAM_NOT_DATE }),
    ]);
  });

  it('reads TEXT as text, a json answer included', () => {
    expect(resolveRenderParams([{ name: 'a' }, { name: 'b' }], { a: 42, b: { x: 1 } })).toEqual({
      a: '42',
      b: '{"x":1}',
    });
  });

  it('treats an empty answer as no answer', () => {
    expect(resolveRenderParams(one('NUMBER'), { p: '' })).toEqual({ p: null });
    expect(refusalOf(() => resolveRenderParams(one('TEXT', { required: true }), { p: '' }))).toEqual([
      expect.objectContaining({ code: PrintRenderErrorCode.PARAM_REQUIRED }),
    ]);
  });

  it('reports every problem in one refusal, a broken declaration included', () => {
    const details = refusalOf(() =>
      resolveRenderParams(
        [
          { name: 'qty', type: 'NUMBER' },
          { name: 'Bad Name' },
          { name: 'from_date', type: 'DATE', required: true },
        ],
        { qty: 'many', typo: 1 },
      ),
    );

    expect(details.map((detail) => detail.code)).toEqual([
      PrintRenderErrorCode.PARAM_NAME_INVALID,
      PrintRenderErrorCode.PARAM_UNKNOWN,
      PrintRenderErrorCode.PARAM_NOT_NUMBER,
      PrintRenderErrorCode.PARAM_REQUIRED,
    ]);
  });

  it('names what the revision does ask for when an answer matches nothing', () => {
    expect(refusalOf(() => resolveRenderParams(one('TEXT'), { q: 'x' }))[0].message).toBe(
      "This revision has no prompt named 'q'. It asks for: p.",
    );
  });
});
