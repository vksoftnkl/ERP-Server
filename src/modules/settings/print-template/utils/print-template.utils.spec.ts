import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrintTemplateErrorCode } from '../types/print-template-error-codes';
import {
  DatasetRow,
  TemplateRow,
  VersionRow,
  handlePrintTemplateWriteError,
  toDatasetPayload,
  toTemplatePayload,
  toVersionPayload,
} from './print-template.utils';

const TEMPLATE_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const CREATED_ON = new Date('2026-01-01T00:00:00.000Z');
const MODIFIED_ON = new Date('2026-02-01T10:00:00.000Z');

const datasetRow = (overrides: Partial<DatasetRow> = {}): DatasetRow => ({
  ptdId: 'd1',
  ptdVersionId: 'v1',
  ptdRole: 'DETAIL',
  ptdDatasetNo: 1,
  ptdSortOrder: 0,
  ptdName: 'items',
  ptdLabel: null,
  ptdSourceKind: 'PROVIDER',
  ptdProviderCode: 'sales.bill.items',
  ptdSql: null,
  ptdSqlNorm: null,
  ptdParentNo: null,
  ptdLinkFields: null,
  ptdRowLimit: 5000,
  ptdTimeoutMs: 15000,
  ptdRemarks: null,
  ptdIsDeleted: false,
  ptdSyncDate: null,
  ptdCreatedOn: CREATED_ON,
  ptdCreatedBy: null,
  ptdModifiedOn: null,
  ptdModifiedBy: null,
  ...overrides,
});

const versionRow = (overrides: Partial<VersionRow> = {}): VersionRow => ({
  ptvId: 'v1',
  ptvTemplateId: TEMPLATE_ID,
  ptvRevNo: 1,
  ptvStatus: 'DRAFT',
  ptvEngine: 'JSON_BANDS',
  ptvBody: '{"bands":[]}',
  ptvSchemaVer: 1,
  ptvPaperCode: 'A4',
  ptvOrientation: 'PORTRAIT',
  ptvWidthMm: null,
  ptvHeightMm: null,
  ptvMarginTopMm: new Prisma.Decimal(0),
  ptvMarginBottomMm: new Prisma.Decimal(0),
  ptvMarginLeftMm: new Prisma.Decimal(0),
  ptvMarginRightMm: new Prisma.Decimal(0),
  ptvColumns: null,
  ptvLang: 'en-IN',
  ptvFontFamily: null,
  ptvParams: null,
  ptvNote: null,
  ptvApprovedOn: null,
  ptvApprovedBy: null,
  ptvIsDeleted: false,
  ptvSyncDate: null,
  ptvCreatedOn: CREATED_ON,
  ptvCreatedBy: null,
  ptvModifiedOn: null,
  ptvModifiedBy: null,
  ...overrides,
});

const templateRow = (overrides: Partial<TemplateRow> = {}): TemplateRow => ({
  ptlId: TEMPLATE_ID,
  ptlCompanyId: null,
  ptlPurposeId: 'purpose-1',
  ptlCode: 'SALE_INVOICE_A4',
  ptlName: 'Tax Invoice A4',
  ptlDescription: null,
  ptlPublishedRevId: null,
  ptlForkedFromId: null,
  ptlForkedFromRev: null,
  ptlSortOrder: 100,
  ptlCompanyKey: '00000000-0000-0000-0000-000000000000',
  ptlIsActive: true,
  ptlIsDeleted: false,
  ptlSyncDate: null,
  ptlCreatedOn: CREATED_ON,
  ptlCreatedBy: null,
  ptlModifiedOn: null,
  ptlModifiedBy: null,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
function refusalOf(run: () => void): { status: number; body: unknown } {
  try {
    run();
  } catch (error) {
    if (!(error instanceof HttpException)) throw error;
    return { status: error.getStatus(), body: error.getResponse() };
  }
  throw new Error('expected the call to be refused');
}

const knownError = (code: string, meta: Record<string, unknown>, message = 'failed') =>
  new Prisma.PrismaClientKnownRequestError(message, { code, clientVersion: '6.19.2', meta });

describe('toDatasetPayload', () => {
  it('copies the row and renders the dates as ISO text', () => {
    const payload = toDatasetPayload(
      datasetRow({ ptdModifiedOn: MODIFIED_ON, ptdSyncDate: MODIFIED_ON }),
    );

    expect(payload).toMatchObject({
      ptdId: 'd1',
      ptdProviderCode: 'sales.bill.items',
      ptdCreatedOn: CREATED_ON.toISOString(),
      ptdModifiedOn: MODIFIED_ON.toISOString(),
      ptdSyncDate: MODIFIED_ON.toISOString(),
    });
  });

  it('keeps an unset modified or sync date null', () => {
    expect(toDatasetPayload(datasetRow())).toMatchObject({
      ptdModifiedOn: null,
      ptdSyncDate: null,
    });
  });
});

describe('toVersionPayload', () => {
  it('turns the decimal geometry into numbers and keeps unset sizes null', () => {
    const payload = toVersionPayload(
      versionRow({
        ptvWidthMm: new Prisma.Decimal('80.5'),
        ptvMarginTopMm: new Prisma.Decimal('12.25'),
      }),
      null,
    );

    expect(payload).toMatchObject({
      ptvWidthMm: 80.5,
      ptvHeightMm: null,
      ptvMarginTopMm: 12.25,
      ptvMarginBottomMm: 0,
    });
  });

  it('marks only the revision the template points at as the published one', () => {
    expect(toVersionPayload(versionRow(), 'v1').ptvIsPublishedRev).toBe(true);
    expect(toVersionPayload(versionRow(), 'v2').ptvIsPublishedRev).toBe(false);
    expect(toVersionPayload(versionRow(), null).ptvIsPublishedRev).toBe(false);
  });

  it.each([
    ['DRAFT', true],
    ['PUBLISHED', false],
    ['RETIRED', false],
  ])('reports a %s revision as editable: %s', (status, editable) => {
    expect(toVersionPayload(versionRow({ ptvStatus: status }), null).ptvIsEditable).toBe(editable);
  });

  it('maps the datasets it carries, and answers an empty list when it carries none', () => {
    const withDatasets = toVersionPayload({ ...versionRow(), datasets: [datasetRow()] }, null);

    expect(withDatasets.datasets).toEqual([toDatasetPayload(datasetRow())]);
    expect(toVersionPayload(versionRow(), null).datasets).toEqual([]);
  });

  it('answers null params rather than undefined', () => {
    expect(toVersionPayload(versionRow({ ptvParams: null }), null).ptvParams).toBeNull();
  });
});

describe('toTemplatePayload', () => {
  it('lifts the related names and leaves them null when the relation is absent', () => {
    expect(toTemplatePayload(templateRow())).toMatchObject({
      ptlCompanyName: null,
      ptlPurposeCode: null,
      ptlPurposeName: null,
      ptlPublishedRevNo: null,
      ptlForkedFromCode: null,
      versions: [],
    });

    expect(
      toTemplatePayload({
        ...templateRow({ ptlPublishedRevId: 'v2' }),
        company: { compName: 'Acme Foods' },
        purpose: { ppoCode: 'SALE_INVOICE', ppoName: 'Sale Invoice' },
        forkedFrom: { ptlCode: 'BASE_A4' },
        publishedRev: { ptvRevNo: 2 },
      }),
    ).toMatchObject({
      ptlCompanyName: 'Acme Foods',
      ptlPurposeCode: 'SALE_INVOICE',
      ptlPurposeName: 'Sale Invoice',
      ptlForkedFromCode: 'BASE_A4',
      ptlPublishedRevNo: 2,
    });
  });

  it('hands every version the template pointer, so exactly one reads as published', () => {
    const payload = toTemplatePayload({
      ...templateRow({ ptlPublishedRevId: 'v2' }),
      versions: [
        { ...versionRow({ ptvId: 'v2', ptvRevNo: 2, ptvStatus: 'PUBLISHED' }), datasets: [] },
        { ...versionRow({ ptvId: 'v1' }), datasets: [] },
      ],
    });

    expect(payload.versions.map((version) => version.ptvIsPublishedRev)).toEqual([true, false]);
  });
});

describe('handlePrintTemplateWriteError', () => {
  it.each([
    [['ptv_template_id', 'ptv_rev_no'], 'ptvRevNo', PrintTemplateErrorCode.REV_NO_TAKEN],
    [['ptd_version_id', 'ptd_dataset_no'], 'ptdDatasetNo', PrintTemplateErrorCode.DATASET_NO_TAKEN],
    [['ptd_version_id', 'ptd_name'], 'ptdName', PrintTemplateErrorCode.DATASET_NAME_TAKEN],
    ['ux_ptd_one_master', 'ptdRole', PrintTemplateErrorCode.DATASET_MASTER_TWICE],
    ['ux_ptl_code', 'ptlCode', PrintTemplateErrorCode.CODE_TAKEN],
  ])('names the field a unique index on %p guards', (target, field, code) => {
    const refusal = refusalOf(() => handlePrintTemplateWriteError(knownError('P2002', { target })));

    expect(refusal).toMatchObject({ status: 409, body: { errors: [{ field, code }] } });
  });

  it('falls back to a generic duplicate when the index is not one it knows', () => {
    const refusal = refusalOf(() =>
      handlePrintTemplateWriteError(knownError('P2002', { target: ['something_else'] })),
    );

    expect(refusal).toMatchObject({
      status: 409,
      body: { errors: [{ field: 'request', code: PrintTemplateErrorCode.DUPLICATE }] },
    });
  });

  it('reads the target out of the message when Prisma reports none', () => {
    const refusal = refusalOf(() =>
      handlePrintTemplateWriteError(
        knownError('P2002', {}, 'Unique constraint failed on the constraint: `ux_ptd_name`'),
      ),
    );

    expect(refusal).toMatchObject({
      body: { errors: [{ code: PrintTemplateErrorCode.DATASET_NAME_TAKEN }] },
    });
  });

  it.each([
    ['fk_ptl_purpose', 'ptlPurposeId'],
    ['fk_ptl_published_rev', 'ptlPublishedRevId'],
    ['fk_ptv_approved_by', 'ptvApprovedBy'],
    ['fk_ptd_version', 'ptdVersionId'],
    ['fk_somewhere_else', 'request'],
  ])('answers a foreign key failure on %s with a 400 on %s', (constraint, field) => {
    const refusal = refusalOf(() =>
      handlePrintTemplateWriteError(
        knownError('P2003', {}, `Foreign key constraint violated: \`${constraint}\``),
      ),
    );

    expect(refusal).toMatchObject({
      status: 400,
      body: { errors: [{ field, code: PrintTemplateErrorCode.REFERENCE_INVALID }] },
    });
  });

  it.each([
    ['ck_ptl_code_shape', 'ptlCode'],
    ['ck_ptv_body_is_json', 'ptvBody'],
    ['ck_ptd_sql_size', 'ptdSql'],
    ['ck_ptd_name_shape', 'ptdName'],
  ])('answers the CHECK %s with a 400 naming it, on %s', (constraint, field) => {
    const refusal = refusalOf(() =>
      handlePrintTemplateWriteError(
        new Error(`new row violates check constraint "${constraint}" (23514)`),
      ),
    );

    expect(refusal).toMatchObject({
      status: 400,
      body: {
        errors: [
          {
            field,
            code: PrintTemplateErrorCode.DB_REFUSED,
            message: expect.stringContaining(constraint) as unknown,
          },
        ],
      },
    });
  });

  it('lets any other failure through for the caller to rethrow', () => {
    expect(() => handlePrintTemplateWriteError(new Error('connection reset'))).not.toThrow();
    expect(() => handlePrintTemplateWriteError('not even an error')).not.toThrow();
  });
});
