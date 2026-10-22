import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertDocPdcHeld,
  cancelDocPdcRegister,
  CHEQUE_TENDER_TYPE_ID,
  findDocPdcRows,
  matchChequeDetails,
  PDC_STATUS_CANCELLED,
  PDC_STATUS_HELD,
  readPdcChequeDetails,
  syncDocPdcRegister,
  type PdcDocument,
  type PdcDocumentRules,
  type PdcTenderLine,
  type StoredPdcRow,
} from './pdc-register.helper';
import { SALES_ERROR_CODES } from './types/posting.types';

const DOC_ID = '019c6f6c-be87-7a11-8905-36092c46ae01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46ae02';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46ae03';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46ae04';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46ae05';
const BANK_LEDGER = '019c6f6c-be87-7a11-8905-36092c46ae06';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46ae07';
const TD_1 = '019c6f6c-be87-7a11-8905-36092c46ae11';
const TD_2 = '019c6f6c-be87-7a11-8905-36092c46ae12';
const TD_OLD = '019c6f6c-be87-7a11-8905-36092c46ae13';
const APD_1 = '019c6f6c-be87-7a11-8905-36092c46ae21';
const APD_OLD = '019c6f6c-be87-7a11-8905-36092c46ae23';
const NOW = new Date('2026-10-19T09:15:00.000Z');
const ACTOR = 'actor-1';

const DOC: PdcDocument = {
  srcModule: 'SALES',
  srcDocType: 'SALE_BILL',
  docId: DOC_ID,
  companyId: COMPANY_ID,
  branchId: BRANCH_ID,
  tenantId: null,
  accYear: '2026-2027',
  refno: 'bil00042',
  // An evening receipt: the register keeps the UTC day.
  docDate: new Date('2026-10-19T13:45:00.000Z'),
  partyId: PARTY_ID,
  partyName: 'Ravi Traders',
  salesmanId: null,
  userId: USER_ID,
};

const BILL_RULES: PdcDocumentRules = {
  label: 'bill',
  refuseBackdated: false,
  checkDateWindow: true,
};

const cheque = (overrides: Partial<PdcTenderLine> = {}): PdcTenderLine => ({
  tdId: TD_1,
  tdRowNo: 1,
  tdTenderTypeId: CHEQUE_TENDER_TYPE_ID,
  tdTotalAmt: new Prisma.Decimal('2500.00'),
  tdRefNo: ' 004512 ',
  tdInstrumentDate: new Date('2026-10-25T00:00:00.000Z'),
  tdBankName: 'Canara Bank',
  tdSettleLedgerId: BANK_LEDGER,
  tdNotes: null,
  ...overrides,
});

const stored = (overrides: Partial<StoredPdcRow> = {}): StoredPdcRow => ({
  apdId: APD_1,
  apdAccYear: '2026-2027',
  apdTenderId: TD_1,
  apdInstrumentNo: '004512',
  apdStatus: PDC_STATUS_HELD,
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

type TxMock = {
  accTenderDetail: { findMany: jest.Mock };
  accPdcRegister: { findMany: jest.Mock; update: jest.Mock; create: jest.Mock };
};

/**
 * A client holding `own` register rows for the document (found through its
 * tenders) and `clashes` for the instrument-number check.
 */
function txWith(opts: {
  tenderIds?: string[];
  own?: StoredPdcRow[];
  clashes?: { apdInstrumentNo: string; apdTenderId: string | null }[];
}): TxMock {
  return {
    accTenderDetail: {
      findMany: jest
        .fn()
        .mockResolvedValue((opts.tenderIds ?? [TD_1]).map((tdId) => ({ tdId }))),
    },
    accPdcRegister: {
      findMany: jest.fn(async ({ where }: { where: Record<string, unknown> }) =>
        'apdInstrumentNo' in where ? (opts.clashes ?? []) : (opts.own ?? []),
      ),
      update: jest.fn().mockResolvedValue({}),
      create: jest.fn().mockResolvedValue({ apdId: 'apd-new' }),
    },
  };
}

const asTx = (tx: TxMock) => tx as unknown as Prisma.TransactionClient;

const sync = (
  tx: TxMock,
  tenders: PdcTenderLine[],
  opts: {
    rules?: PdcDocumentRules;
    voucher?: { voucherId: string; accYear: string } | null;
    keepStoredVoucher?: boolean;
  } = {},
) =>
  syncDocPdcRegister(
    asTx(tx),
    DOC,
    opts.rules ?? BILL_RULES,
    tenders,
    opts.voucher === undefined ? { voucherId: VOUCHER_ID, accYear: '2026-2027' } : opts.voucher,
    ACTOR,
    NOW,
    { keepStoredVoucher: opts.keepStoredVoucher, removedReason: 'Tender removed on edit' },
  );

describe('pdc-register.helper', () => {
  describe('syncDocPdcRegister', () => {
    it('does nothing for a document with no cheque and no register row', async () => {
      const tx = txWith({ tenderIds: [] });

      await expect(
        sync(tx, [cheque({ tdTenderTypeId: 1 }), cheque({ tdTotalAmt: new Prisma.Decimal(0) })]),
      ).resolves.toEqual([]);
      expect(tx.accPdcRegister.create).not.toHaveBeenCalled();
      expect(tx.accPdcRegister.update).not.toHaveBeenCalled();
    });

    it('opens a HELD receivable row for a new cheque, keyed by its tender row', async () => {
      const tx = txWith({});

      await expect(sync(tx, [cheque({ tdNotes: '  post-dated  ' })])).resolves.toEqual([
        'apd-new',
      ]);

      expect(tx.accPdcRegister.create).toHaveBeenCalledWith({
        data: {
          apdCompanyId: COMPANY_ID,
          apdBranchId: BRANCH_ID,
          apdTenantId: null,
          apdTraType: 'R',
          apdPartyId: PARTY_ID,
          apdSalesmanId: null,
          apdInstrumentType: 'CHEQUE',
          apdInstrumentNo: '004512',
          apdInstrumentDate: new Date('2026-10-25T00:00:00.000Z'),
          apdAmount: new Prisma.Decimal('2500.00'),
          apdBankName: 'Canara Bank',
          apdReceivedOn: new Date('2026-10-19T00:00:00.000Z'),
          apdBankLedgerId: BANK_LEDGER,
          apdTenderId: TD_1,
          apdRemarks: 'Cheque tendered against bill bil00042 (post-dated)',
          // No details sent: the party is the drawer.
          apdDrawerName: 'Ravi Traders',
          apdBankBranch: null,
          apdIfsc: null,
          apdMicr: null,
          apdPostingMode: 'ON_RECEIPT',
          apdVoucherId: VOUCHER_ID,
          apdVoucherAccYear: '2026-2027',
          apdAccYear: '2026-2027',
          apdStatus: PDC_STATUS_HELD,
          apdStatusOn: NOW,
          apdStatusBy: USER_ID,
          apdCreatedOn: NOW,
          apdCreatedBy: ACTOR,
        },
        select: { apdId: true },
      });
    });

    it('registers a cheque taken with no voucher as ON_CLEARING, naming none', async () => {
      const tx = txWith({});

      await sync(tx, [cheque()], { voucher: null });

      expect(tx.accPdcRegister.create.mock.calls[0][0].data).toMatchObject({
        apdPostingMode: 'ON_CLEARING',
        apdVoucherId: null,
        apdVoucherAccYear: null,
      });
    });

    it('writes the drawer details sent with the cheque, tidied to the column shapes', async () => {
      const tx = txWith({});

      await sync(tx, [
        cheque({
          cheque: {
            drawerName: '  Third Party Ltd ',
            bankBranch: ' Anna Nagar ',
            ifsc: ' cnrb0001234 ',
            micr: '  ',
          },
        }),
      ]);

      expect(tx.accPdcRegister.create.mock.calls[0][0].data).toMatchObject({
        apdDrawerName: 'Third Party Ltd',
        apdBankBranch: 'Anna Nagar',
        apdIfsc: 'CNRB0001234',
        apdMicr: null,
      });
    });

    it('cuts the instrument number and bank name to their column widths', async () => {
      const tx = txWith({});

      await sync(tx, [cheque({ tdRefNo: '9'.repeat(40), tdBankName: 'B'.repeat(120) })]);

      const data = tx.accPdcRegister.create.mock.calls[0][0].data;
      expect(data.apdInstrumentNo).toHaveLength(30);
      expect(data.apdBankName).toHaveLength(100);
    });

    it('re-syncs a cheque that already has a row, keeping details the edit did not send', async () => {
      const tx = txWith({ own: [stored()] });

      await expect(sync(tx, [cheque({ tdTotalAmt: new Prisma.Decimal('3000') })])).resolves.toEqual(
        [APD_1],
      );

      expect(tx.accPdcRegister.create).not.toHaveBeenCalled();
      const call = tx.accPdcRegister.update.mock.calls[0][0];
      expect(call.where).toEqual({ apdId_apdAccYear: { apdId: APD_1, apdAccYear: '2026-2027' } });
      expect(call.data).toMatchObject({
        apdAmount: new Prisma.Decimal('3000'),
        apdVoucherId: VOUCHER_ID,
        apdModifiedOn: NOW,
        apdModifiedBy: ACTOR,
      });
      expect(call.data).not.toHaveProperty('apdDrawerName');
      expect(call.data).not.toHaveProperty('apdStatus');
    });

    it('overwrites the details on an existing row when the edit sends them, null included', async () => {
      const tx = txWith({ own: [stored()] });

      await sync(tx, [cheque({ cheque: null })]);

      expect(tx.accPdcRegister.update.mock.calls[0][0].data).toMatchObject({
        apdDrawerName: 'Ravi Traders',
        apdBankBranch: null,
        apdIfsc: null,
        apdMicr: null,
      });
    });

    it('keeps the stored voucher when asked to', async () => {
      const tx = txWith({ own: [stored()] });

      await sync(tx, [cheque()], { keepStoredVoucher: true });

      const data = tx.accPdcRegister.update.mock.calls[0][0].data;
      expect(data).not.toHaveProperty('apdVoucherId');
      expect(data).not.toHaveProperty('apdPostingMode');
    });

    it('cancels the row of a cheque that left the document BEFORE registering the new one', async () => {
      const tx = txWith({
        tenderIds: [TD_OLD, TD_2],
        own: [stored({ apdId: APD_OLD, apdTenderId: TD_OLD })],
      });

      await sync(tx, [cheque({ tdId: TD_2 })]);

      expect(tx.accPdcRegister.update).toHaveBeenCalledWith({
        where: { apdId_apdAccYear: { apdId: APD_OLD, apdAccYear: '2026-2027' } },
        data: {
          apdStatus: PDC_STATUS_CANCELLED,
          apdCancelReason: 'Tender removed on edit',
          apdCancelDate: new Date('2026-10-19T00:00:00.000Z'),
          apdStatusOn: NOW,
          apdStatusBy: USER_ID,
          apdIsActive: false,
          apdModifiedOn: NOW,
          apdModifiedBy: ACTOR,
        },
      });
      expect(tx.accPdcRegister.update.mock.invocationCallOrder[0]).toBeLessThan(
        tx.accPdcRegister.create.mock.invocationCallOrder[0],
      );
    });

    it('gives up the row of a cheque line that no longer carries money', async () => {
      const tx = txWith({ own: [stored()] });

      await expect(sync(tx, [cheque({ tdTotalAmt: new Prisma.Decimal(0) })])).resolves.toEqual([]);

      expect(tx.accPdcRegister.update.mock.calls[0][0].data.apdStatus).toBe(PDC_STATUS_CANCELLED);
      expect(tx.accPdcRegister.create).not.toHaveBeenCalled();
    });

    it('registers the cheques in row order', async () => {
      const tx = txWith({});
      tx.accPdcRegister.create
        .mockResolvedValueOnce({ apdId: 'first' })
        .mockResolvedValueOnce({ apdId: 'second' });

      await expect(
        sync(tx, [
          cheque({ tdId: TD_2, tdRowNo: 2, tdRefNo: '000002' }),
          cheque({ tdId: TD_1, tdRowNo: 1, tdRefNo: '000001' }),
        ]),
      ).resolves.toEqual(['first', 'second']);
      expect(tx.accPdcRegister.create.mock.calls[0][0].data.apdTenderId).toBe(TD_1);
    });

    describe('refusals — 400 on tenders, naming the cheque', () => {
      it.each([
        ['no cheque number', { tdRefNo: '   ' }, SALES_ERROR_CODES.CHEQUE_NUMBER_MISSING],
        ['no cheque date', { tdInstrumentDate: null }, SALES_ERROR_CODES.CHEQUE_DATE_MISSING],
        [
          'a date more than three months before the document',
          { tdInstrumentDate: new Date('2026-07-18T00:00:00.000Z') },
          SALES_ERROR_CODES.CHEQUE_STALE,
        ],
        [
          'a date more than a year after the document',
          { tdInstrumentDate: new Date('2027-10-20T00:00:00.000Z') },
          SALES_ERROR_CODES.CHEQUE_DATE_TOO_FAR,
        ],
      ])('refuses %s', async (_label, overrides, code) => {
        const tx = txWith({});

        const refusal = await refusalOf(sync(tx, [cheque(overrides)]));

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field: 'tenders', code }] },
        });
        expect(tx.accPdcRegister.create).not.toHaveBeenCalled();
      });

      it('lets a bill take a cheque at the edges of the table window', async () => {
        const tx = txWith({});

        await sync(tx, [
          cheque({ tdId: TD_1, tdRefNo: '1', tdInstrumentDate: new Date('2026-07-19') }),
          cheque({ tdId: TD_2, tdRowNo: 2, tdRefNo: '2', tdInstrumentDate: new Date('2027-10-19') }),
        ]);

        expect(tx.accPdcRegister.create).toHaveBeenCalledTimes(2);
      });

      it('lets a bill take a cheque written a few days earlier', async () => {
        const tx = txWith({});

        await sync(tx, [cheque({ tdInstrumentDate: new Date('2026-10-15T00:00:00.000Z') })]);

        expect(tx.accPdcRegister.create).toHaveBeenCalledTimes(1);
      });

      it('refuses a backdated cheque where the document says so (the order)', async () => {
        const tx = txWith({});

        const refusal = await refusalOf(
          sync(tx, [cheque({ tdInstrumentDate: new Date('2026-10-18T00:00:00.000Z') })], {
            rules: { label: 'order', refuseBackdated: true, checkDateWindow: false },
          }),
        );

        expect(refusal.body).toMatchObject({
          errors: [{ code: SALES_ERROR_CODES.CHEQUE_BACKDATED }],
        });
      });

      it('skips the table window when the document does not check it', async () => {
        const tx = txWith({});

        await sync(tx, [cheque({ tdInstrumentDate: new Date('2028-01-01T00:00:00.000Z') })], {
          rules: { label: 'order', refuseBackdated: true, checkDateWindow: false },
        });

        expect(tx.accPdcRegister.create).toHaveBeenCalledTimes(1);
      });

      it('refuses one cheque number tendered twice on the document, before any read', async () => {
        const tx = txWith({ tenderIds: [] });

        const refusal = await refusalOf(
          sync(tx, [cheque(), cheque({ tdId: TD_2, tdRowNo: 2, tdRefNo: '004512' })]),
        );

        expect(refusal.body).toMatchObject({
          errors: [{ code: SALES_ERROR_CODES.CHEQUE_REPEATED }],
        });
        expect(tx.accPdcRegister.update).not.toHaveBeenCalled();
      });

      it('refuses a cheque already registered for the customer on another document', async () => {
        const tx = txWith({
          clashes: [{ apdInstrumentNo: '004512', apdTenderId: 'someone-elses-tender' }],
        });

        const refusal = await refusalOf(sync(tx, [cheque()]));

        expect(refusal.body).toMatchObject({
          errors: [{ code: SALES_ERROR_CODES.CHEQUE_ALREADY_REGISTERED }],
        });
        const clashQuery = tx.accPdcRegister.findMany.mock.calls.find(
          ([args]) => 'apdInstrumentNo' in args.where,
        )?.[0];
        expect(clashQuery.where).toMatchObject({
          apdCompanyId: COMPANY_ID,
          apdAccYear: '2026-2027',
          apdPartyId: PARTY_ID,
          apdInstrumentType: 'CHEQUE',
          apdInstrumentNo: { in: ['004512'] },
          apdStatus: { not: PDC_STATUS_CANCELLED },
        });
      });

      it('reads the document’s own registered cheque as an edit, not a clash', async () => {
        const tx = txWith({
          own: [stored()],
          clashes: [{ apdInstrumentNo: '004512', apdTenderId: TD_1 }],
        });

        await expect(sync(tx, [cheque()])).resolves.toEqual([APD_1]);
      });

      it('refuses to change a cheque the bank already has, with its status', async () => {
        const tx = txWith({ own: [stored({ apdStatus: 'DEPOSITED' })] });

        const refusal = await refusalOf(sync(tx, [cheque()]));

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [
              {
                field: 'tenders',
                code: SALES_ERROR_CODES.CHEQUE_LOCKED_IN_REGISTER,
                status: 'DEPOSITED',
              },
            ],
          },
        });
        expect(tx.accPdcRegister.update).not.toHaveBeenCalled();
      });

      it('lets the caller word the moved-cheque refusal itself', async () => {
        const tx = txWith({ tenderIds: [TD_OLD], own: [stored({ apdStatus: 'CLEARED' })] });
        const onMoved = jest.fn(() => {
          throw new Error('custom refusal');
        });

        await expect(sync(tx, [], { rules: { ...BILL_RULES, onMoved } })).rejects.toThrow(
          'custom refusal',
        );
        expect(onMoved).toHaveBeenCalledWith(expect.objectContaining({ apdId: APD_1 }), 'removed');
      });
    });
  });

  describe('cancelDocPdcRegister', () => {
    const cancel = (tx: TxMock, deleted: boolean) =>
      cancelDocPdcRegister(asTx(tx), DOC, BILL_RULES, 'Bill cancelled', deleted, USER_ID, ACTOR, NOW);

    it('cancels every live instrument, keeping the rows', async () => {
      const tx = txWith({ tenderIds: [TD_1, TD_2], own: [stored(), stored({ apdId: 'apd-2' })] });

      await expect(cancel(tx, false)).resolves.toEqual([APD_1, 'apd-2']);

      expect(tx.accPdcRegister.update).toHaveBeenCalledTimes(2);
      expect(tx.accPdcRegister.update.mock.calls[0][0].data).toMatchObject({
        apdStatus: PDC_STATUS_CANCELLED,
        apdCancelReason: 'Bill cancelled',
        apdIsActive: false,
      });
      expect(tx.accPdcRegister.update.mock.calls[0][0].data).not.toHaveProperty('apdIsDeleted');
    });

    it('also retires the rows of a deleted document', async () => {
      const tx = txWith({ own: [stored()] });

      await cancel(tx, true);

      expect(tx.accPdcRegister.update.mock.calls[0][0].data.apdIsDeleted).toBe(true);
    });

    it('cuts a long reason to the column width', async () => {
      const tx = txWith({ own: [stored()] });

      await cancelDocPdcRegister(
        asTx(tx),
        DOC,
        BILL_RULES,
        'x'.repeat(300),
        false,
        USER_ID,
        ACTOR,
        NOW,
      );

      expect(tx.accPdcRegister.update.mock.calls[0][0].data.apdCancelReason).toHaveLength(250);
    });

    it('checks every row before cancelling any, so a refusal leaves nothing half-done', async () => {
      const tx = txWith({
        tenderIds: [TD_1, TD_2],
        own: [stored(), stored({ apdId: 'apd-2', apdStatus: 'BOUNCED' })],
      });

      const refusal = await refusalOf(cancel(tx, false));

      expect(refusal.body).toMatchObject({
        errors: [{ code: SALES_ERROR_CODES.CHEQUE_LOCKED_IN_REGISTER, status: 'BOUNCED' }],
      });
      expect(tx.accPdcRegister.update).not.toHaveBeenCalled();
    });
  });

  describe('assertDocPdcHeld', () => {
    it('passes while every instrument is HELD and refuses once one has moved', async () => {
      await expect(
        assertDocPdcHeld(asTx(txWith({ own: [stored()] })), DOC, BILL_RULES),
      ).resolves.toBeUndefined();

      const refusal = await refusalOf(
        assertDocPdcHeld(asTx(txWith({ own: [stored({ apdStatus: 'DEPOSITED' })] })), DOC, BILL_RULES),
      );
      expect(refusal.status).toBe(400);
    });
  });

  describe('findDocPdcRows', () => {
    it('reads no register when the document has no tender rows', async () => {
      const tx = txWith({ tenderIds: [] });

      await expect(findDocPdcRows(asTx(tx), DOC)).resolves.toEqual([]);
      expect(tx.accTenderDetail.findMany).toHaveBeenCalledWith({
        where: { tdSrcModule: 'SALES', tdSrcDocType: 'SALE_BILL', tdSrcDocId: DOC_ID },
        select: { tdId: true },
      });
      expect(tx.accPdcRegister.findMany).not.toHaveBeenCalled();
    });

    it('reads the live rows hanging off the tenders, on the document’s year', async () => {
      const tx = txWith({
        tenderIds: [TD_1, TD_2],
        own: [stored(), { ...stored({ apdId: 'orphan' }), apdTenderId: null as unknown as string }],
      });

      await expect(findDocPdcRows(asTx(tx), DOC)).resolves.toEqual([stored()]);
      expect(tx.accPdcRegister.findMany.mock.calls[0][0].where).toEqual({
        apdAccYear: '2026-2027',
        apdTenderId: { in: [TD_1, TD_2] },
        apdIsDeleted: false,
        apdStatus: { not: PDC_STATUS_CANCELLED },
      });
    });
  });

  describe('matchChequeDetails', () => {
    const persisted = [
      { tdId: TD_1, tdRowNo: 1, tdTenderTypeId: CHEQUE_TENDER_TYPE_ID },
      { tdId: TD_2, tdRowNo: 2, tdTenderTypeId: String(CHEQUE_TENDER_TYPE_ID) },
      { tdId: 'cash', tdRowNo: 3, tdTenderTypeId: 1 },
      { tdId: 'gone', tdRowNo: 4, tdTenderTypeId: CHEQUE_TENDER_TYPE_ID, tdIsDeleted: true },
    ];

    it('matches by td id when sent, else by row number or position', () => {
      const out = matchChequeDetails(
        [
          { tdId: TD_2, cheque: { drawerName: 'A' } },
          { cheque: { ifsc: 'X' } }, // position 2 → row 2
          { tdRowNo: 1, cheque: null },
        ],
        persisted,
      );

      expect(out).toEqual({
        [TD_2]: { drawerName: null, bankBranch: null, ifsc: 'X', micr: null },
        [TD_1]: null,
      });
    });

    it('ignores rows that sent no details, non-cheque rows and deleted rows', () => {
      const out = matchChequeDetails(
        [
          { tdId: TD_1 },
          { tdRowNo: 3, cheque: { drawerName: 'cash?' } },
          { tdId: 'gone', cheque: { drawerName: 'deleted' } },
        ],
        persisted,
      );

      expect(out).toEqual({});
    });
  });

  describe('readPdcChequeDetails', () => {
    it('reads nothing for no tender ids', async () => {
      const client = { accPdcRegister: { findMany: jest.fn() } };

      await expect(
        readPdcChequeDetails(client as unknown as Prisma.TransactionClient, []),
      ).resolves.toEqual(new Map());
      expect(client.accPdcRegister.findMany).not.toHaveBeenCalled();
    });

    it('maps the live rows by tender id', async () => {
      const client = {
        accPdcRegister: {
          findMany: jest.fn().mockResolvedValue([
            {
              apdTenderId: TD_1,
              apdDrawerName: 'Ravi',
              apdBankBranch: 'Main',
              apdIfsc: 'CNRB0001',
              apdMicr: '600015002',
            },
            { apdTenderId: null, apdDrawerName: 'x', apdBankBranch: null, apdIfsc: null, apdMicr: null },
          ]),
        },
      };

      const out = await readPdcChequeDetails(client as unknown as Prisma.TransactionClient, [TD_1]);

      expect([...out.entries()]).toEqual([
        [TD_1, { drawerName: 'Ravi', bankBranch: 'Main', ifsc: 'CNRB0001', micr: '600015002' }],
      ]);
      expect(client.accPdcRegister.findMany.mock.calls[0][0].where).toEqual({
        apdTenderId: { in: [TD_1] },
        apdIsDeleted: false,
        apdStatus: { not: PDC_STATUS_CANCELLED },
      });
    });
  });
});
