import { RenderParamError, readParamSpecs, resolveRenderParams } from './render-params';

/**
 * §3's operator prompts, checked at RENDER as well as at save.
 *
 * The re-check is not belt and braces. A revision published by an older build
 * is still expected to print, and `ck_ptv_params_is_array` only ever proved the
 * column was an array — everything about an ENTRY is the service layer's to
 * enforce, and this is the moment it matters.
 */

const prompts = [
  { name: 'from_date', type: 'DATE', required: true, label: 'From date' },
  { name: 'godown_id', type: 'UUID', required: false, label: 'Godown' },
  { name: 'show_cost', type: 'BOOLEAN', required: false, label: 'Show cost' },
];

describe('readParamSpecs', () => {
  it('reads a well-formed declaration', () => {
    const { specs, errors } = readParamSpecs(prompts);
    expect(errors).toEqual([]);
    expect(specs.map((spec) => spec.name)).toEqual(['from_date', 'godown_id', 'show_cost']);
    expect(specs[0].required).toBe(true);
  });

  it('refuses a prompt that shadows a context parameter', () => {
    // "Declaring one as a USER prompt is a mistake worth naming, because the
    // render would then ask the operator for something it already knows."
    const { errors } = readParamSpecs([{ name: 'company_id', type: 'UUID' }]);
    expect(errors[0].message).toContain('CONTEXT parameter');
    expect(errors[0].message).toContain('company_id');
  });

  it('refuses an unknown prompt type rather than guessing a coercion', () => {
    const { errors } = readParamSpecs([{ name: 'x', type: 'MONEY' }]);
    expect(errors[0].field).toBe('ptvParams[0].type');
  });

  it('treats a non-array declaration as the malformed column it is', () => {
    const { errors } = readParamSpecs({ from_date: 'DATE' });
    expect(errors[0].field).toBe('ptvParams');
  });
});

describe('resolveRenderParams', () => {
  it('coerces each answer to its declared type', () => {
    const values = resolveRenderParams(prompts, {
      from_date: '2026-04-01T00:00:00.000Z',
      show_cost: 'yes',
    });

    // A calendar date names no instant, so the text form is the whole value —
    // parsing it into a Date only invites a timezone to move it a day.
    expect(values.from_date).toBe('2026-04-01');
    expect(values.show_cost).toBe(true);
    expect(values.godown_id).toBeNull();
  });

  it('refuses a missing required answer', () => {
    expect(() => resolveRenderParams(prompts, {})).toThrow(RenderParamError);
  });

  it('refuses an answer to a prompt that does not exist', () => {
    // Almost always a spelling mistake. Dropping it quietly means the query
    // binds the default instead and the report comes back subtly wrong with
    // nothing anywhere saying why.
    try {
      resolveRenderParams(prompts, { from_date: '2026-04-01', form_date: '2026-04-02' });
      throw new Error('should have refused');
    } catch (error) {
      expect(error).toBeInstanceOf(RenderParamError);
      const detail = (error as RenderParamError).details.find(
        (entry) => entry.field === 'params.form_date',
      );
      expect(detail?.message).toContain('no prompt named');
    }
  });

  it('refuses an attempt to supply a context parameter with the request', () => {
    try {
      resolveRenderParams(prompts, { from_date: '2026-04-01', company_id: 'other-company' });
      throw new Error('should have refused');
    } catch (error) {
      const detail = (error as RenderParamError).details.find(
        (entry) => entry.field === 'params.company_id',
      );
      expect(detail?.message).toContain('supplies itself');
    }
  });

  it('refuses a malformed date rather than binding something PostgreSQL will read differently', () => {
    try {
      resolveRenderParams(prompts, { from_date: '01/04/2026' });
      throw new Error('should have refused');
    } catch (error) {
      expect((error as RenderParamError).details[0].message).toContain('YYYY-MM-DD');
    }
  });

  it('falls back to a declared default when the answer is absent', () => {
    const values = resolveRenderParams(
      [{ name: 'copies_note', type: 'TEXT', required: true, default: 'ORIGINAL' }],
      {},
    );
    expect(values.copies_note).toBe('ORIGINAL');
  });

  it('asks for nothing when the revision declares nothing', () => {
    expect(resolveRenderParams(null, {})).toEqual({});
  });
});
