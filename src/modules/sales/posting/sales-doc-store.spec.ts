import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { allocateVoucherNumber } from '../../../common/Sequence/voucher-sequence.helper';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
} from '../../../common/txn-status-log/txn-status-log.helper';
import { ChargeDocType } from '../../master/charge-master/types/charge-enum';
import {
  TenderDrCr,
  TenderSrcDocType,
} from '../../accountsModule/tenderDetail/types/tender-detail-api.types';
import { SalesDocStore, type DocRow, type DocSpec } from './sales-doc-store';
import { SALES_ERROR_CODES } from './types/posting.types';

jest.mock('../../../common/Sequence/voucher-sequence.helper', () => ({
  allocateVoucherNumber: jest.fn(),
}));
jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(),
}));

const allocate = allocateVoucherNumber as jest.Mock;
const appendLog = appendTxnStatusLog as jest.Mock;

const DOC_ID = '019c6f6c-be87-7a11-8905-36092c46af01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46af02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46af03';
const CUST_ID = '019c6f6c-be87-7a11-8905-36092c46af04';
const LINE_A = '019c6f6c-be87-7a11-8905-36092c46af11';
const LINE_B = '019c6f6c-be87-7a11-8905-36092c46af12';
const ACTOR = '019c6f6c-be87-7a11-8905-36092c46af99';
const NOW = new Date('2026-10-19T06:30:00.000Z');
const YEAR = '2026-2027';

/** A challan-shaped spec with tenders switched on, so every branch of the store runs. */
const SPEC: DocSpec = {
  kind: 'DELIVERY_CHALLAN',
  headerDelegate: 'saleDc',
  itemDelegate: 'saleDcItem',
  p: 'sdc',
  ip: 'sdi',
  itemFk: 'sdiDcId',
  refnoField: 'sdcDcRefno',
  slnoField: 'sdcDcSlno',
  dateField: 'sdcDcDate',
  datetimeField: 'sdcDcDatetime',
  custField: 'sdcCustId',
  custNameField: 'sdcCustName',
  revisionField: 'sdcRevisionNo',
  voucherTypeId: 19,
  menuId: 182,
  statusDocType: TxnStatusDocType.DELIVERY_CHALLAN,
  chargeDocType: ChargeDocType.DELIVERY_CHALLAN,
  tenderDocType: TenderSrcDocType.OTHER,
  tenderDrCr: TenderDrCr.DR,
  transportDocType: 'DELIVERY_CHALLAN',
  transportDirection: 'OUTWARD',
  tableName: 'sale_dc',
  itemTableName: 'sale_dc_item',
  screenName: 'Delivery Challan',
  optionalFields: ['sdcRemarks', 'sdcExpectedOn'],
  dateFields: ['sdcExpectedOn'],
  serverOwned: ['sdcStatus', 'sdcBilledAmt'],
  itemOptionalFields: ['sdiQty', 'sdiRate', 'sdiMfgDate'],
  itemDateFields: ['sdiMfgDate'],
  itemRequired: ['sdiItemId', 'sdiGodownId'],
  headerRequired: ['sdcCounterId'],
  itemDefaults: (header) => ({ sdiPriceLevel: header.sdcPriceLevel ?? 'RETAIL' }),
  headerWhereUnique: 'sdcId_sdcAccYear',
  itemWhereUnique: 'sdiId_sdiAccYear',
};

const KEYS = { id: DOC_ID, companyId: COMPANY_ID, branchId: BRANCH_ID, accYear: YEAR };

const headerRow = (overrides: DocRow = {}): DocRow => ({
  sdcId: DOC_ID,
  sdcCompanyId: COMPANY_ID,
  sdcBranchId: BRANCH_ID,
  sdcTenantId: null,
  sdcAccYear: YEAR,
  sdcStatus: 'DRAFT',
  sdcDcRefno: 'DC00007',
  sdcDcSlno: 7n,
  sdcDcDate: new Date('2026-10-19T00:00:00.000Z'),
  sdcCustId: CUST_ID,
  sdcUserId: ACTOR,
  sdcDeviceId: null,
  sdcSessionId: null,
  ...overrides,
});

const itemRow = (id: string, lineNo: number, overrides: DocRow = {}): DocRow => ({
  sdiId: id,
  sdiAccYear: YEAR,
  sdiLineNo: lineNo,
  sdiDcId: DOC_ID,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

type Delegate = {
  findFirst: jest.Mock;
  findMany: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  updateMany: jest.Mock;
  count: jest.Mock;
};

const delegate = (): Delegate => ({
  findFirst: jest.fn().mockResolvedValue(null),
  findMany: jest.fn().mockResolvedValue([]),
  create: jest.fn(async ({ data }: { data: DocRow }) => ({ ...data })),
  update: jest.fn(async ({ data }: { data: DocRow }) => ({ ...headerRow(), ...data })),
  updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  count: jest.fn().mockResolvedValue(0),
});

describe('SalesDocStore', () => {
  let header: Delegate;
  let items: Delegate;
  let tx: { saleDc: Delegate; saleDcItem: Delegate; $queryRaw: jest.Mock };
  let audit: { logEntityChange: jest.Mock };
  let charges: { syncDocumentCharges: jest.Mock; getByDocument: jest.Mock };
  let tenders: { syncDocumentTenders: jest.Mock; getByDocument: jest.Mock };
  let transportBand: { read: jest.Mock; write: jest.Mock; remove: jest.Mock };
  let store: SalesDocStore;

  const asTx = () => tx as unknown as Prisma.TransactionClient;

  beforeEach(() => {
    allocate.mockReset().mockResolvedValue({ lastNo: 8n, refno: 'DC00008' });
    appendLog.mockReset().mockResolvedValue({});
    header = delegate();
    items = delegate();
    items.update.mockImplementation(async ({ where, data }: { where: DocRow; data: DocRow }) => ({
      ...(where.sdiId_sdiAccYear as DocRow),
      ...data,
    }));
    tx = { saleDc: header, saleDcItem: items, $queryRaw: jest.fn().mockResolvedValue([]) };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    charges = {
      syncDocumentCharges: jest.fn().mockResolvedValue(undefined),
      getByDocument: jest.fn().mockResolvedValue([]),
    };
    tenders = {
      syncDocumentTenders: jest.fn().mockResolvedValue(undefined),
      getByDocument: jest.fn().mockResolvedValue([]),
    };
    transportBand = {
      read: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
    };
    store = new SalesDocStore(
      SPEC,
      audit as never,
      charges as never,
      tenders as never,
      transportBand as never,
    );
  });

  describe('naming and reads', () => {
    it('prefixes header and item fields, and reads the keys, status and refno off a row', () => {
      expect(store.f('Status')).toBe('sdcStatus');
      expect(store.fi('LineNo')).toBe('sdiLineNo');
      expect(store.keysOf(headerRow())).toEqual(KEYS);
      expect(store.status(headerRow({ sdcStatus: 'POSTED' }))).toBe('POSTED');
      expect(store.refno(headerRow({ sdcDcRefno: undefined }))).toBeNull();
    });

    it('finds a live document inside its company, branch and year', async () => {
      await store.find(asTx(), KEYS);

      expect(header.findFirst).toHaveBeenCalledWith({
        where: {
          sdcId: DOC_ID,
          sdcCompanyId: COMPANY_ID,
          sdcBranchId: BRANCH_ID,
          sdcAccYear: YEAR,
          sdcIsDeleted: false,
        },
      });
    });

    it('answers 404 SALES_NOT_FOUND for a document that is not there', async () => {
      const refusal = await refusalOf(store.findOrThrow(asTx(), KEYS));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'sdcId', code: SALES_ERROR_CODES.NOT_FOUND }] },
      });
    });

    it('locks the header row FOR UPDATE with bound keys, then re-reads it', async () => {
      tx.$queryRaw.mockResolvedValue([{ id: DOC_ID }]);
      header.findFirst.mockResolvedValue(headerRow());

      await expect(store.lock(asTx(), KEYS)).resolves.toEqual(headerRow());

      const [strings, ...values] = tx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
      const query = Prisma.sql(strings, ...values);
      expect(query.sql).toContain('FROM sales.sale_dc');
      expect(query.sql).toContain('FOR UPDATE');
      expect(query.values).toEqual([DOC_ID, YEAR, COMPANY_ID, BRANCH_ID]);
    });

    it('answers 404 when the row to lock is gone', async () => {
      const refusal = await refusalOf(store.lock(asTx(), KEYS));

      expect(refusal.status).toBe(404);
      expect(header.findFirst).not.toHaveBeenCalled();
    });

    it('loads the live lines in line order', async () => {
      await store.loadItems(asTx(), headerRow());

      expect(items.findMany).toHaveBeenCalledWith({
        where: { sdiDcId: DOC_ID, sdiAccYear: YEAR, sdiIsDeleted: false },
        orderBy: { sdiLineNo: 'asc' },
      });
    });

    it('reads charges, tenders and the transport band of the document', async () => {
      await store.loadCharges(headerRow(), asTx());
      await store.loadTenders(headerRow(), asTx());
      await store.loadTransport(asTx(), headerRow());

      expect(charges.getByDocument).toHaveBeenCalledWith(
        ChargeDocType.DELIVERY_CHALLAN,
        DOC_ID,
        undefined,
        tx,
      );
      expect(tenders.getByDocument).toHaveBeenCalledWith('SALES', TenderSrcDocType.OTHER, DOC_ID, tx);
      expect(transportBand.read).toHaveBeenCalledWith(
        { docType: 'DELIVERY_CHALLAN', docId: DOC_ID, accYear: YEAR },
        tx,
      );
    });

    it('reads no charges or tenders for a document type that has none', async () => {
      const bare = new SalesDocStore(
        { ...SPEC, chargeDocType: null, tenderDocType: null },
        audit as never,
        charges as never,
        tenders as never,
        transportBand as never,
      );

      await expect(bare.loadCharges(headerRow())).resolves.toEqual([]);
      await expect(bare.loadTenders(headerRow())).resolves.toEqual([]);
      expect(charges.getByDocument).not.toHaveBeenCalled();
      expect(tenders.getByDocument).not.toHaveBeenCalled();
    });
  });

  describe('saveDraft — create', () => {
    const newDraft = (overrides: DocRow = {}): DocRow => ({
      sdcId: DOC_ID,
      sdcCompanyId: COMPANY_ID,
      sdcBranchId: BRANCH_ID,
      sdcAccYear: YEAR,
      sdcCounterId: 'counter-1',
      sdcCustId: CUST_ID,
      sdcCustName: 'Ravi Traders',
      sdcUserId: ACTOR,
      sdcDcDate: '2026-10-19',
      sdcRemarks: 'urgent',
      sdcExpectedOn: '2026-10-21',
      sdcStatus: 'POSTED',
      sdcBilledAmt: 999,
      ...overrides,
    });

    it('draws the number from the voucher type and writes a DRAFT with the client id', async () => {
      const row = await store.saveDraft(asTx(), newDraft(), ACTOR, NOW);

      expect(allocate).toHaveBeenCalledWith(tx, {
        vchrTypeId: 19,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: YEAR,
        documentDate: new Date('2026-10-19'),
      });
      const data = header.create.mock.calls[0][0].data as DocRow;
      expect(data).toMatchObject({
        sdcId: DOC_ID,
        sdcCompanyId: COMPANY_ID,
        sdcCounterId: 'counter-1',
        sdcCustId: CUST_ID,
        sdcCustName: 'Ravi Traders',
        sdcDcSlno: 8n,
        sdcDcRefno: 'DC00008',
        sdcDcDate: new Date('2026-10-19'),
        sdcStatus: 'DRAFT',
        sdcRevisionNo: 1,
        sdcRemarks: 'urgent',
        sdcExpectedOn: new Date('2026-10-21'),
        sdcCreatedOn: NOW,
        sdcCreatedBy: ACTOR,
      });
      // Server-owned columns never come from the body.
      expect(data).not.toHaveProperty('sdcBilledAmt');
      expect(row.sdcDcRefno).toBe('DC00008');
    });

    it('dates a draft sent with no date at the moment of the save', async () => {
      await store.saveDraft(asTx(), newDraft({ sdcDcDate: undefined }), ACTOR, NOW);

      expect(allocate.mock.calls[0][1].documentDate).toBe(NOW);
      expect(header.create.mock.calls[0][0].data.sdcDcDate).toBe(NOW);
    });

    it.each([undefined, null, ''])(
      'refuses a create whose required header field is %p, before drawing a number',
      async (value) => {
        const refusal = await refusalOf(
          store.saveDraft(asTx(), newDraft({ sdcCounterId: value }), ACTOR, NOW),
        );

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field: 'sdcCounterId', code: SALES_ERROR_CODES.FIELD_REQUIRED }] },
        });
        expect(allocate).not.toHaveBeenCalled();
        expect(header.create).not.toHaveBeenCalled();
      },
    );

    it('runs the hooks around the write, and leaves a CREATED trail and a New audit line', async () => {
      const beforeWrite = jest.fn();
      const afterWrite = jest.fn();

      await store.saveDraft(asTx(), newDraft(), ACTOR, NOW, { beforeWrite, afterWrite });

      expect(beforeWrite).toHaveBeenCalledWith(expect.objectContaining({ sdcStatus: 'DRAFT' }), null);
      expect(afterWrite).toHaveBeenCalledWith(expect.objectContaining({ sdcId: DOC_ID }), []);
      expect(appendLog).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          srcModule: 'SALES',
          srcDocType: TxnStatusDocType.DELIVERY_CHALLAN,
          srcDocId: DOC_ID,
          srcDocRefno: 'DC00008',
          event: TxnStatusEvent.CREATED,
          fromStatus: null,
          toStatus: 'DRAFT',
          changedBy: ACTOR,
        }),
      );
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'New',
          tableName: 'sale_dc',
          pk: DOC_ID,
          displayName: 'DC00008',
          originalRecord: null,
          userId: ACTOR,
          notes: 'Delivery Challan created',
        }),
        tx,
      );
    });

    it('syncs charges always, and tenders only when the body sends them', async () => {
      await store.saveDraft(asTx(), newDraft(), ACTOR, NOW);

      expect(charges.syncDocumentCharges).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          cdDocType: ChargeDocType.DELIVERY_CHALLAN,
          cdDocId: DOC_ID,
          cdVoucherNo: 8n,
        }),
        undefined,
        ACTOR,
        expect.objectContaining({ tableName: 'txn_charge_detail' }),
      );
      expect(tenders.syncDocumentTenders).not.toHaveBeenCalled();

      await store.saveDraft(asTx(), newDraft({ tenders: [] }), ACTOR, NOW);

      expect(tenders.syncDocumentTenders).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({
          tdSrcModule: 'SALES',
          tdSrcDocType: TenderSrcDocType.OTHER,
          tdSrcDocId: DOC_ID,
          tdPartyLedgerId: CUST_ID,
          tdDrCr: TenderDrCr.DR,
        }),
        [],
        ACTOR,
        expect.objectContaining({ tableName: 'acc_tender_detail' }),
      );
    });

    it('writes a transport band with content, defaulting its direction to the document’s', async () => {
      await store.saveDraft(
        asTx(),
        newDraft({ transport: { mode: 'ROAD', from: {}, to: {} } }),
        ACTOR,
        NOW,
      );

      expect(transportBand.write).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docType: 'DELIVERY_CHALLAN', docId: DOC_ID, docRefno: 'DC00008' }),
        expect.objectContaining({ mode: 'ROAD', direction: 'OUTWARD' }),
        ACTOR,
        { gdrId: null, now: NOW },
      );
    });

    it('writes no transport band for an empty one', async () => {
      await store.saveDraft(
        asTx(),
        newDraft({ transport: { from: { name: '' }, to: {} } }),
        ACTOR,
        NOW,
      );

      expect(transportBand.write).not.toHaveBeenCalled();
    });
  });

  describe('saveDraft — update', () => {
    it.each([
      ['POSTED', SALES_ERROR_CODES.DOC_POSTED],
      ['CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED],
    ])('refuses a %s id with a 409', async (status, code) => {
      header.findFirst.mockResolvedValue(headerRow({ sdcStatus: status }));

      const refusal = await refusalOf(
        store.saveDraft(asTx(), { sdcId: DOC_ID, sdcAccYear: YEAR }, ACTOR, NOW),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sdcId', code }] },
      });
      expect(header.update).not.toHaveBeenCalled();
    });

    it('updates a DRAFT in place, never moving its keys or its number', async () => {
      const existing = headerRow();
      header.findFirst.mockResolvedValue(existing);
      const beforeWrite = jest.fn();

      await store.saveDraft(
        asTx(),
        {
          sdcId: DOC_ID,
          sdcCompanyId: 'other-company',
          sdcAccYear: YEAR,
          sdcRemarks: 'changed',
          sdcStatus: 'POSTED',
        },
        ACTOR,
        NOW,
        { beforeWrite },
      );

      expect(header.findFirst).toHaveBeenCalledWith({
        where: { sdcId: DOC_ID, sdcIsDeleted: false },
      });
      expect(allocate).not.toHaveBeenCalled();
      expect(header.update).toHaveBeenCalledWith({
        where: { sdcId_sdcAccYear: { sdcId: DOC_ID, sdcAccYear: YEAR } },
        data: { sdcRemarks: 'changed', sdcModifiedOn: NOW, sdcModifiedBy: ACTOR },
      });
      expect(beforeWrite).toHaveBeenCalledWith(expect.any(Object), existing);
      // A save that leaves the document DRAFT is not a status step.
      expect(appendLog).not.toHaveBeenCalled();
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          originalRecord: expect.objectContaining({ sdcDcSlno: '7' }),
          notes: 'Delivery Challan updated',
        }),
        tx,
      );
    });

    it('does not ask for the create-only header fields on an update', async () => {
      header.findFirst.mockResolvedValue(headerRow());

      await expect(
        store.saveDraft(asTx(), { sdcId: DOC_ID, sdcAccYear: YEAR }, ACTOR, NOW),
      ).resolves.toBeDefined();
    });
  });

  describe('saveDraft — lines', () => {
    const save = (lines: DocRow[] | undefined) =>
      store.saveDraft(asTx(), { sdcId: DOC_ID, sdcAccYear: YEAR, items: lines }, ACTOR, NOW);

    beforeEach(() => {
      header.findFirst.mockResolvedValue(headerRow({ sdcPriceLevel: 'WHOLESALE' }));
      header.update.mockImplementation(async ({ data }: { data: DocRow }) => ({
        ...headerRow({ sdcPriceLevel: 'WHOLESALE' }),
        ...data,
      }));
    });

    it('leaves the lines alone when the body sends none', async () => {
      items.findMany.mockResolvedValue([itemRow(LINE_A, 1)]);

      await save(undefined);

      expect(items.create).not.toHaveBeenCalled();
      expect(items.update).not.toHaveBeenCalled();
    });

    it('creates a new line from the header, numbering by position, with the header’s defaults', async () => {
      await save([{ sdiItemId: 'item-1', sdiGodownId: 'gd-1', sdiQty: 2, sdiMfgDate: '2026-01-05' }]);

      expect(items.create).toHaveBeenCalledWith({
        data: {
          sdiItemId: 'item-1',
          sdiGodownId: 'gd-1',
          sdiQty: 2,
          sdiMfgDate: new Date('2026-01-05'),
          sdiPriceLevel: 'WHOLESALE',
          sdiDcId: DOC_ID,
          sdiCompanyId: COMPANY_ID,
          sdiBranchId: BRANCH_ID,
          sdiTenantId: null,
          sdiAccYear: YEAR,
          sdiLineNo: 1,
          sdiCreatedOn: NOW,
          sdiCreatedBy: ACTOR,
        },
      });
    });

    it('refuses a new line missing a required field, naming the line', async () => {
      const refusal = await refusalOf(save([{ sdiItemId: 'item-1' }]));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'sdiGodownId', code: SALES_ERROR_CODES.LINE_FIELD_REQUIRED, line: 1 }],
        },
      });
    });

    it('refuses one line number sent twice', async () => {
      const refusal = await refusalOf(
        save([
          { sdiLineNo: 3, sdiItemId: 'a', sdiGodownId: 'g' },
          { sdiLineNo: 3, sdiItemId: 'b', sdiGodownId: 'g' },
        ]),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'sdiLineNo', code: SALES_ERROR_CODES.LINE_NO_DUPLICATE, line: 3 }] },
      });
      expect(items.create).not.toHaveBeenCalled();
    });

    it('refuses a line id that is not a live line of this document', async () => {
      items.findMany.mockResolvedValue([itemRow(LINE_A, 1)]);

      const refusal = await refusalOf(save([{ sdiId: LINE_B, sdiQty: 1 }]));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'sdiId', code: SALES_ERROR_CODES.LINE_NOT_FOUND }] },
      });
      expect(items.update).not.toHaveBeenCalled();
    });

    it('soft-deletes the lines the body left out and updates the ones it kept', async () => {
      items.findMany.mockResolvedValue([itemRow(LINE_A, 1), itemRow(LINE_B, 2)]);

      const out = await save([{ sdiId: LINE_A, sdiQty: 5, sdiItemId: 'item-x' }]);

      expect(items.update).toHaveBeenNthCalledWith(1, {
        where: { sdiId_sdiAccYear: { sdiId: LINE_B, sdiAccYear: YEAR } },
        data: { sdiIsDeleted: true, sdiModifiedOn: NOW, sdiModifiedBy: ACTOR },
      });
      expect(items.update).toHaveBeenNthCalledWith(2, {
        where: { sdiId_sdiAccYear: { sdiId: LINE_A, sdiAccYear: YEAR } },
        data: {
          sdiQty: 5,
          sdiLineNo: 1,
          sdiModifiedOn: NOW,
          sdiModifiedBy: ACTOR,
          sdiItemId: 'item-x',
        },
      });
      // Nothing moved, so nothing was parked.
      expect(items.updateMany).not.toHaveBeenCalled();
      expect(out).toBeDefined();
    });

    it('parks the surviving lines above every requested number before renumbering them', async () => {
      items.findMany.mockResolvedValue([itemRow(LINE_A, 1), itemRow(LINE_B, 2)]);

      await save([
        { sdiId: LINE_B, sdiLineNo: 1 },
        { sdiId: LINE_A, sdiLineNo: 2 },
      ]);

      expect(items.updateMany).toHaveBeenCalledWith({
        where: { sdiId: { in: [LINE_B, LINE_A] } },
        data: { sdiLineNo: { increment: 3 } },
      });
      expect(items.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
        items.update.mock.invocationCallOrder[0],
      );
      expect(items.update.mock.calls.map(([c]) => [c.where.sdiId_sdiAccYear.sdiId, c.data.sdiLineNo])).toEqual([
        [LINE_B, 1],
        [LINE_A, 2],
      ]);
    });

    it('answers the written lines in line order', async () => {
      items.findMany.mockResolvedValue([itemRow(LINE_A, 1)]);
      const afterWrite = jest.fn();
      header.findFirst.mockResolvedValue(headerRow());

      await store.saveDraft(
        asTx(),
        {
          sdcId: DOC_ID,
          sdcAccYear: YEAR,
          items: [
            { sdiLineNo: 2, sdiItemId: 'new', sdiGodownId: 'g' },
            { sdiId: LINE_A, sdiLineNo: 1 },
          ],
        },
        ACTOR,
        NOW,
        { afterWrite },
      );

      const written = afterWrite.mock.calls[0][1] as DocRow[];
      expect(written.map((l) => l.sdiLineNo)).toEqual([1, 2]);
    });
  });

  describe('deleteDraft', () => {
    beforeEach(() => {
      tx.$queryRaw.mockResolvedValue([{ id: DOC_ID }]);
    });

    it.each([
      ['POSTED', SALES_ERROR_CODES.DOC_POSTED, 'use /cancel'],
      ['CANCELLED', SALES_ERROR_CODES.DOC_CANCELLED, 'CANCELLED'],
    ])('refuses to delete a %s document with a 409', async (status, code, words) => {
      header.findFirst.mockResolvedValue(headerRow({ sdcStatus: status }));

      const refusal = await refusalOf(store.deleteDraft(asTx(), KEYS, ACTOR, NOW));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sdcId', code, message: expect.stringContaining(words) }] },
      });
      expect(header.update).not.toHaveBeenCalled();
    });

    it('soft-deletes the lines, clears the charges and the band, then the header', async () => {
      header.findFirst.mockResolvedValue(headerRow());

      await store.deleteDraft(asTx(), KEYS, ACTOR, NOW);

      expect(items.updateMany).toHaveBeenCalledWith({
        where: { sdiDcId: DOC_ID, sdiAccYear: YEAR, sdiIsDeleted: false },
        data: { sdiIsDeleted: true, sdiModifiedOn: NOW, sdiModifiedBy: ACTOR },
      });
      expect(charges.syncDocumentCharges).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ cdDocId: DOC_ID, cdVoucherNo: null }),
        [],
        ACTOR,
        expect.any(Object),
      );
      expect(transportBand.remove).toHaveBeenCalledWith(
        tx,
        { docType: 'DELIVERY_CHALLAN', docId: DOC_ID, accYear: YEAR },
        ACTOR,
      );
      expect(header.update).toHaveBeenCalledWith({
        where: { sdcId_sdcAccYear: { sdcId: DOC_ID, sdcAccYear: YEAR } },
        data: { sdcIsDeleted: true, sdcModifiedOn: NOW, sdcModifiedBy: ACTOR },
      });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          modifiedRecord: null,
          notes: 'Draft delivery challan deleted',
        }),
        tx,
      );
    });
  });

  describe('status writes, the trail and the wire shape', () => {
    it('setStatus writes the status, the extras and the modifier', async () => {
      await store.setStatus(asTx(), headerRow(), 'POSTED', { sdcPostedOn: NOW }, ACTOR, NOW);

      expect(header.update).toHaveBeenCalledWith({
        where: { sdcId_sdcAccYear: { sdcId: DOC_ID, sdcAccYear: YEAR } },
        data: {
          sdcStatus: 'POSTED',
          sdcPostedOn: NOW,
          sdcModifiedOn: NOW,
          sdcModifiedBy: ACTOR,
        },
      });
    });

    it('updateItem keys the line by its id and year', async () => {
      await store.updateItem(asTx(), itemRow(LINE_A, 1), { sdiBilledQty: 1 });

      expect(items.update).toHaveBeenCalledWith({
        where: { sdiId_sdiAccYear: { sdiId: LINE_A, sdiAccYear: YEAR } },
        data: { sdiBilledQty: 1 },
      });
    });

    it('trail writes nothing when told not to', async () => {
      await store.trail(asTx(), headerRow(), 'POSTED', 'DRAFT', 'POSTED', ACTOR, NOW, null, false);

      expect(appendLog).not.toHaveBeenCalled();
    });

    it('auditChange files the change under the document', async () => {
      await store.auditChange(asTx(), headerRow(), 'approve', { a: 1 }, { a: 2 }, ACTOR, 'Posted');

      expect(audit.logEntityChange).toHaveBeenCalledWith(
        {
          action: 'approve',
          tableName: 'sale_dc',
          screenName: 'Delivery Challan',
          screenType: 'transaction',
          pk: DOC_ID,
          displayName: 'DC00007',
          originalRecord: { a: 1 },
          modifiedRecord: { a: 2 },
          userId: ACTOR,
          notes: 'Posted',
        },
        tx,
      );
    });

    it('plain turns dates, bigints and decimals into what the wire can carry', () => {
      expect(
        store.plain({
          d: new Date('2026-10-19T00:00:00.000Z'),
          n: 7n,
          m: new Prisma.Decimal('118.25'),
          s: 'x',
          z: null,
        }),
      ).toEqual({ d: '2026-10-19T00:00:00.000Z', n: '7', m: 118.25, s: 'x', z: null });
    });
  });
});
