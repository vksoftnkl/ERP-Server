import {
  EffectiveDataset,
  EffectiveTemplate,
  EffectiveVersion,
  collectDatasetInvariantErrors,
  collectDatasetSetInvariantErrors,
  collectTemplateInvariantErrors,
  collectVersionInvariantErrors,
} from './print-template-invariants';

const fields = (errors: Array<{ field: string }>): string[] => errors.map((error) => error.field);

// === §2 print_template =====================================================

/** A header that satisfies every constraint; each test breaks exactly one thing. */
const template: EffectiveTemplate = {
  ptlId: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
  ptlCode: 'SALE_INVOICE_A4',
  ptlSortOrder: 100,
  ptlForkedFromId: null,
  ptlForkedFromRev: null,
};

describe('collectTemplateInvariantErrors', () => {
  it('accepts a valid header', () => {
    expect(collectTemplateInvariantErrors(template)).toEqual([]);
  });

  it('ck_ptl_code_shape — refuses a space in the code', () => {
    expect(
      fields(collectTemplateInvariantErrors({ ...template, ptlCode: 'SALE INVOICE' })),
    ).toEqual(['ptlCode']);
  });

  it('ck_ptl_not_own_fork — a template cannot be forked from itself', () => {
    expect(
      fields(
        collectTemplateInvariantErrors({
          ...template,
          ptlForkedFromId: template.ptlId,
          ptlForkedFromRev: 2,
        }),
      ),
    ).toEqual(['ptlForkedFromId']);
  });

  it('ck_ptl_fork_pair — half a provenance record is refused, in both directions', () => {
    expect(
      fields(collectTemplateInvariantErrors({ ...template, ptlForkedFromId: 'other-id' })),
    ).toEqual(['ptlForkedFromRev']);
    expect(fields(collectTemplateInvariantErrors({ ...template, ptlForkedFromRev: 3 }))).toEqual([
      'ptlForkedFromId',
    ]);
  });

  it('ck_ptl_sort — refuses a negative sort order', () => {
    expect(fields(collectTemplateInvariantErrors({ ...template, ptlSortOrder: -1 }))).toEqual([
      'ptlSortOrder',
    ]);
  });
});

// === §3 print_template_version =============================================

const version: EffectiveVersion = {
  ptvRevNo: 1,
  ptvStatus: 'DRAFT',
  ptvEngine: 'JSON_BANDS',
  ptvBody: '{"bands":[]}',
  ptvPaperCode: 'A4',
  ptvOrientation: 'PORTRAIT',
  ptvWidthMm: null,
  ptvHeightMm: null,
  ptvMarginTopMm: 0,
  ptvMarginBottomMm: 0,
  ptvMarginLeftMm: 0,
  ptvMarginRightMm: 0,
  ptvColumns: null,
  ptvLang: 'en-IN',
  ptvParams: null,
  ptvApprovedBy: null,
};

describe('collectVersionInvariantErrors', () => {
  it('accepts a valid draft', () => {
    expect(collectVersionInvariantErrors(version)).toEqual([]);
  });

  it('ck_ptv_body_is_json — a JSON_BANDS body must be an OBJECT, not an array', () => {
    expect(fields(collectVersionInvariantErrors({ ...version, ptvBody: '[]' }))).toEqual([
      'ptvBody',
    ]);
    expect(fields(collectVersionInvariantErrors({ ...version, ptvBody: 'not json' }))).toEqual([
      'ptvBody',
    ]);
  });

  it('leaves a non-JSON engine body alone — it is text and nothing should read it', () => {
    expect(
      collectVersionInvariantErrors({
        ...version,
        ptvEngine: 'ESCPOS_TEXT',
        ptvBody: '@Hello',
        ptvColumns: 48,
      }),
    ).toEqual([]);
  });

  it('ck_ptv_published — publishing takes a signature', () => {
    expect(fields(collectVersionInvariantErrors({ ...version, ptvStatus: 'PUBLISHED' }))).toEqual([
      'ptvApprovedBy',
    ]);
    expect(
      collectVersionInvariantErrors({
        ...version,
        ptvStatus: 'PUBLISHED',
        ptvApprovedBy: '01963d86-caf0-7b26-89f0-58ac380a2d5e',
      }),
    ).toEqual([]);
  });

  it('ck_ptv_geometry — names which of the six numbers is wrong', () => {
    expect(
      fields(
        collectVersionInvariantErrors({
          ...version,
          ptvWidthMm: 0,
          ptvMarginLeftMm: -1,
          ptvColumns: 10,
        }),
      ),
    ).toEqual(['ptvWidthMm', 'ptvMarginLeftMm', 'ptvColumns']);
  });

  it('ck_ptv_lang_shape — accepts en and ta-IN, refuses en_IN', () => {
    expect(collectVersionInvariantErrors({ ...version, ptvLang: 'en' })).toEqual([]);
    expect(collectVersionInvariantErrors({ ...version, ptvLang: 'ta-IN' })).toEqual([]);
    expect(fields(collectVersionInvariantErrors({ ...version, ptvLang: 'en_IN' }))).toEqual([
      'ptvLang',
    ]);
  });

  it('ck_ptv_params_is_array — an object is not an array of prompts', () => {
    expect(
      fields(collectVersionInvariantErrors({ ...version, ptvParams: { from_date: 'DATE' } })),
    ).toEqual(['ptvParams']);
  });

  it('accepts a well-formed prompt list', () => {
    expect(
      collectVersionInvariantErrors({
        ...version,
        ptvParams: [
          { name: 'from_date', type: 'DATE', required: true, label: 'From date' },
          { name: 'godown_id', type: 'UUID', required: false },
        ],
      }),
    ).toEqual([]);
  });

  it('accepts a context name declared as an operator prompt', () => {
    // ptv_params is the whole declaration now: an author who wants :doc_id to
    // come from the operator rather than from the print request says so here,
    // and the context value is only the default for what is left out.
    expect(
      collectVersionInvariantErrors({
        ...version,
        ptvParams: [
          { name: 'doc_id', type: 'UUID', required: true, label: 'Document' },
          { name: 'company_id', type: 'UUID' },
        ],
      }),
    ).toEqual([]);
  });

  it('refuses two prompts with the same name — the operator is asked once', () => {
    expect(
      fields(
        collectVersionInvariantErrors({
          ...version,
          ptvParams: [
            { name: 'from_date', type: 'DATE' },
            { name: 'from_date', type: 'TEXT' },
          ],
        }),
      ),
    ).toEqual(['ptvParams[1].name']);
  });

  it('prefixes every field with the caller path into the payload', () => {
    expect(
      fields(collectVersionInvariantErrors({ ...version, ptvLang: 'nope' }, 'versions[2]')),
    ).toEqual(['versions[2].ptvLang']);
  });
});

// === §4 print_template_dataset =============================================

const dataset: EffectiveDataset = {
  ptdRole: 'DETAIL',
  ptdDatasetNo: 1,
  ptdName: 'items',
  ptdSourceKind: 'PROVIDER',
  ptdProviderCode: 'sales.bill.items',
  ptdSql: null,
  ptdRequiresCompany: true,
  ptdParentNo: null,
  ptdLinkFields: null,
  ptdRowLimit: 5000,
  ptdTimeoutMs: 15000,
};

describe('collectDatasetInvariantErrors', () => {
  it('accepts a valid provider dataset', () => {
    expect(collectDatasetInvariantErrors(dataset)).toEqual([]);
  });

  it('ck_ptd_master_is_zero — the master is dataset 0 and nothing else is', () => {
    expect(fields(collectDatasetInvariantErrors({ ...dataset, ptdRole: 'MASTER' }))).toEqual([
      'ptdDatasetNo',
    ]);
    expect(fields(collectDatasetInvariantErrors({ ...dataset, ptdDatasetNo: 0 }))).toEqual([
      'ptdDatasetNo',
    ]);
    expect(
      collectDatasetInvariantErrors({ ...dataset, ptdRole: 'MASTER', ptdDatasetNo: 0 }),
    ).toEqual([]);
  });

  it('ck_ptd_source_biconditional — a PROVIDER may not also carry SQL', () => {
    expect(fields(collectDatasetInvariantErrors({ ...dataset, ptdSql: 'SELECT 1' }))).toEqual([
      'ptdSql',
    ]);
  });

  it('ck_ptd_source_biconditional — a SQL dataset must carry SQL and no provider code', () => {
    expect(fields(collectDatasetInvariantErrors({ ...dataset, ptdSourceKind: 'SQL' }))).toEqual([
      'ptdProviderCode',
      'ptdSql',
    ]);
  });

  it('ck_ptd_name_shape — refuses a capital', () => {
    expect(fields(collectDatasetInvariantErrors({ ...dataset, ptdName: 'Items' }))).toEqual([
      'ptdName',
    ]);
  });

  it('ck_ptd_parent — a MASTER has no parent, and nothing parents itself', () => {
    expect(
      fields(
        collectDatasetInvariantErrors({
          ...dataset,
          ptdParentNo: 1,
          ptdLinkFields: 'a=b',
        }),
      ),
    ).toEqual(['ptdParentNo']);
  });

  it('ck_ptd_parent_pair — a parent needs link fields, and link fields need a parent', () => {
    expect(fields(collectDatasetInvariantErrors({ ...dataset, ptdParentNo: 0 }))).toEqual([
      'ptdLinkFields',
    ]);
    expect(fields(collectDatasetInvariantErrors({ ...dataset, ptdLinkFields: 'a=b' }))).toEqual([
      'ptdParentNo',
    ]);
  });

  it('ck_ptd_link_fields_shape — no spaces, parent=child, comma separated', () => {
    expect(
      collectDatasetInvariantErrors({
        ...dataset,
        ptdParentNo: 0,
        ptdLinkFields: 'sb_id=bill_id,sbi_slno=slno',
      }),
    ).toEqual([]);
    expect(
      fields(
        collectDatasetInvariantErrors({
          ...dataset,
          ptdParentNo: 0,
          ptdLinkFields: 'sb_id = bill_id',
        }),
      ),
    ).toEqual(['ptdLinkFields']);
  });

  it('ck_ptd_limits — bounds both numbers', () => {
    expect(
      fields(collectDatasetInvariantErrors({ ...dataset, ptdRowLimit: 0, ptdTimeoutMs: 99 })),
    ).toEqual(['ptdRowLimit', 'ptdTimeoutMs']);
  });

  it('runs the SQL guards for a SQL dataset', () => {
    const errors = collectDatasetInvariantErrors(
      {
        ...dataset,
        ptdSourceKind: 'SQL',
        ptdProviderCode: null,
        ptdSql: 'SELECT a FROM t WHERE x = 1 ORDER BY a',
      },
      'versions[0].datasets[1]',
    );
    expect(fields(errors)).toEqual(['versions[0].datasets[1].ptdSql']);
    expect(errors[0].message).toContain('company-scoped');
  });
});

describe('collectDatasetSetInvariantErrors', () => {
  const set = (...datasets: EffectiveDataset[]) =>
    collectDatasetSetInvariantErrors(
      datasets.map((entry, index) => ({ dataset: entry, path: `datasets[${index}]` })),
    );

  it('accepts a master with two details', () => {
    expect(
      set(
        { ...dataset, ptdRole: 'MASTER', ptdDatasetNo: 0, ptdName: 'bill' },
        { ...dataset, ptdDatasetNo: 1, ptdName: 'items' },
        { ...dataset, ptdDatasetNo: 2, ptdName: 'taxes' },
      ),
    ).toEqual([]);
  });

  it('ux_ptd_dataset_no — two rows may not claim one number', () => {
    expect(fields(set({ ...dataset, ptdName: 'items' }, { ...dataset, ptdName: 'taxes' }))).toEqual(
      ['datasets[1].ptdDatasetNo'],
    );
  });

  it('ux_ptd_name — two rows may not share a name', () => {
    expect(fields(set(dataset, { ...dataset, ptdDatasetNo: 2 }))).toEqual(['datasets[1].ptdName']);
  });

  it('ux_ptd_one_master — at most one master per version', () => {
    expect(
      fields(
        set(
          { ...dataset, ptdRole: 'MASTER', ptdDatasetNo: 0, ptdName: 'bill' },
          { ...dataset, ptdRole: 'MASTER', ptdDatasetNo: 0, ptdName: 'header' },
        ),
      ),
    ).toContain('datasets[1].ptdRole');
  });

  it('allows a version with no master at all — a report with no header context', () => {
    expect(set(dataset)).toEqual([]);
  });

  it('refuses a parent number that names nothing', () => {
    expect(fields(set({ ...dataset, ptdParentNo: 7, ptdLinkFields: 'a=b' }))).toEqual([
      'datasets[0].ptdParentNo',
    ]);
  });

  it('refuses a nesting cycle — every per-row rule passes and the renderer hangs', () => {
    const errors = set(
      { ...dataset, ptdDatasetNo: 1, ptdName: 'a', ptdParentNo: 2, ptdLinkFields: 'x=y' },
      { ...dataset, ptdDatasetNo: 2, ptdName: 'b', ptdParentNo: 1, ptdLinkFields: 'x=y' },
    );
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain('nested inside itself');
  });
});
