import { HttpException } from '@nestjs/common';
import { SaleBill } from '@prisma/client';
import type { PrismaService } from '../../../database/prisma/prisma.service';
import { appendTxnStatusLog } from '../../../common/txn-status-log/txn-status-log.helper';
import { loadDayClosed } from '../posting/sales.guards';
import { SALES_ERROR_CODES } from '../posting/types/posting.types';
import { BillBandService } from './bill-band.service';
import type { DeliveryEvent } from './dto/bill-lifecycle.dto';

jest.mock('../posting/sales.guards', () => ({
  ...jest.requireActual<object>('../posting/sales.guards'),
  loadDayClosed: jest.fn(),
}));
jest.mock('../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(),
}));

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46b601';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b602';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b603';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b604';
const REGISTER_ID = '019c6f6c-be87-7a11-8905-36092c46b605';
const ACC_YEAR = '2026-2027';
const KEYS = { sbId: BILL_ID, sbCompanyId: COMPANY_ID, sbBranchId: BRANCH_ID, sbAccYear: ACC_YEAR };

const billOf = (overrides: Partial<SaleBill> = {}): SaleBill =>
  ({
    sbId: BILL_ID,
    sbCompanyId: COMPANY_ID,
    sbBranchId: BRANCH_ID,
    sbTenantId: null,
    sbAccYear: ACC_YEAR,
    sbBillRefno: 'BIL/0042',
    sbBillDate: new Date('2026-10-19T00:00:00.000Z'),
    sbStatus: 'POSTED',
    sbDeliveryStatus: 'NA',
    sbDeliveredOn: null,
    sbVehicleNo: 'TN01AB1234',
    sbRemarks: 'old remark',
    sbDocRegisterId: REGISTER_ID,
    sbDeviceId: null,
    sbSessionId: null,
    ...overrides,
  }) as SaleBill;

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

const dayClosed = loadDayClosed as jest.Mock;
const statusLog = appendTxnStatusLog as jest.Mock;

describe('BillBandService', () => {
  let tx: { saleBill: { update: jest.Mock } };
  let bills: { lockHeader: jest.Mock };
  let salesContext: {
    settings: jest.Mock;
    setting: jest.Mock;
    actor: jest.Mock;
    actorName: jest.Mock;
  };
  let transportBand: { read: jest.Mock; write: jest.Mock };
  let audit: { logEntityChange: jest.Mock };
  let service: BillBandService;

  beforeEach(() => {
    jest.clearAllMocks();
    dayClosed.mockResolvedValue(false);
    statusLog.mockResolvedValue(undefined);
    tx = { saleBill: { update: jest.fn().mockResolvedValue({}) } };
    bills = { lockHeader: jest.fn().mockResolvedValue(billOf()) };
    salesContext = {
      settings: jest.fn().mockResolvedValue({}),
      setting: jest.fn().mockResolvedValue(null),
      actor: jest.fn().mockReturnValue(USER_ID),
      actorName: jest.fn().mockResolvedValue('raman'),
    };
    transportBand = {
      read: jest.fn().mockResolvedValue(null),
      write: jest.fn().mockResolvedValue({ lrNo: 'LR-9' }),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    const prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    service = new BillBandService(
      prisma as unknown as PrismaService,
      bills as never,
      salesContext as never,
      transportBand as never,
      audit as never,
    );
  });

  const writtenData = () =>
    (tx.saleBill.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const logEntry = () => statusLog.mock.calls[0][1] as Record<string, unknown>;
  const deliver = (event: DeliveryEvent, extra: object = {}) =>
    service.deliveryStatus({ ...KEYS, event, ...extra });

  describe('deliveryStatus', () => {
    it.each([
      ['DRAFT', SALES_ERROR_CODES.DOC_NOT_DRAFT],
      ['CANCELLED', SALES_ERROR_CODES.BILL_CANCELLED],
    ])('refuses a %s bill', async (sbStatus, code) => {
      bills.lockHeader.mockResolvedValue(billOf({ sbStatus }));

      const refusal = await refusalOf(deliver('PACKED'));

      expect(refusal).toMatchObject({ status: 409, body: { errors: [{ field: 'sbId', code }] } });
      expect(tx.saleBill.update).not.toHaveBeenCalled();
    });

    it('refuses once the books for the bill date are closed', async () => {
      dayClosed.mockResolvedValue(true);

      const refusal = await refusalOf(deliver('PACKED'));

      expect(dayClosed).toHaveBeenCalledWith(tx, COMPANY_ID, BRANCH_ID, '2026-10-19');
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'sbBillDate', code: SALES_ERROR_CODES.DAY_CLOSED }] },
      });
    });

    it('packs a bill that was never tracked, reading NA as PENDING, and logs the step', async () => {
      await expect(deliver('PACKED', { remarks: 'boxed' })).resolves.toEqual({
        sbDeliveryStatus: 'PACKED',
      });

      expect(tx.saleBill.update).toHaveBeenCalledWith({
        where: { sbId_sbAccYear: { sbId: BILL_ID, sbAccYear: ACC_YEAR } },
        data: {
          sbDeliveryStatus: 'PACKED',
          sbDeliveredOn: null,
          sbVehicleNo: 'TN01AB1234',
          sbModifiedOn: expect.any(Date),
          sbModifiedBy: 'raman',
        },
      });
      expect(logEntry()).toMatchObject({
        srcDocId: BILL_ID,
        event: 'PACKED',
        fromStatus: 'PENDING',
        toStatus: 'PACKED',
        changedBy: USER_ID,
        remarks: 'boxed',
      });
    });

    it('refuses a step that skips one', async () => {
      const refusal = await refusalOf(deliver('DISPATCHED'));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'event', code: SALES_ERROR_CODES.DELIVERY_ORDER }] },
      });
    });

    it('refuses going back a step', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbDeliveryStatus: 'PACKED' }));

      const refusal = await refusalOf(deliver('VERIFIED'));

      expect(refusal.status).toBe(409);
    });

    it('lets VERIFIED in even where the branch does not ask for it', async () => {
      await expect(deliver('VERIFIED')).resolves.toEqual({ sbDeliveryStatus: 'VERIFIED' });
    });

    describe('where the branch verifies before dispatch', () => {
      beforeEach(() => {
        salesContext.setting.mockResolvedValue(' Yes ');
      });

      it('refuses to pack an unverified bill, saying why', async () => {
        const refusal = await refusalOf(deliver('PACKED'));

        expect(salesContext.setting).toHaveBeenCalledWith(
          COMPANY_ID,
          BRANCH_ID,
          'sales.require_verification_before_dispatch',
        );
        expect(refusal).toMatchObject({
          status: 409,
          body: {
            errors: [
              {
                code: SALES_ERROR_CODES.DELIVERY_ORDER,
                message: expect.stringContaining('this branch verifies before dispatch') as string,
              },
            ],
          },
        });
      });

      it('packs a verified bill', async () => {
        bills.lockHeader.mockResolvedValue(billOf({ sbDeliveryStatus: 'VERIFIED' }));

        await expect(deliver('PACKED')).resolves.toEqual({ sbDeliveryStatus: 'PACKED' });
      });
    });

    it('stamps the delivered time and the vehicle sent on delivery', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbDeliveryStatus: 'DISPATCHED' }));

      await deliver('DELIVERED', { vehicleNo: 'TN09ZZ0001' });

      expect(writtenData()).toMatchObject({
        sbDeliveryStatus: 'DELIVERED',
        sbDeliveredOn: expect.any(Date),
        sbVehicleNo: 'TN09ZZ0001',
      });
    });

    it('opens an OUTWARD band for a new LR number', async () => {
      await deliver('PACKED', { lrNo: 'LR-9' });

      expect(transportBand.write).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docType: 'SALE_BILL', docId: BILL_ID, docRefno: 'BIL/0042' }),
        { direction: 'OUTWARD', lrNo: 'LR-9' },
        USER_ID,
        { gdrId: REGISTER_ID, now: expect.any(Date) },
      );
    });

    it('keeps the rest of the band when only the LR number changes', async () => {
      transportBand.read.mockResolvedValue({ direction: 'OUTWARD', lrNo: 'LR-1', mode: 'ROAD' });

      await deliver('PACKED', { lrNo: 'LR-9' });

      expect(transportBand.write.mock.calls[0][2]).toEqual({
        direction: 'OUTWARD',
        lrNo: 'LR-9',
        mode: 'ROAD',
      });
    });

    it('writes no band when the LR number is unchanged', async () => {
      transportBand.read.mockResolvedValue({ direction: 'OUTWARD', lrNo: 'LR-9' });

      await deliver('PACKED', { lrNo: 'LR-9' });

      expect(transportBand.write).not.toHaveBeenCalled();
    });
  });

  describe('updateRemarks', () => {
    it('refuses a bill that is not POSTED', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbStatus: 'DRAFT' }));

      const refusal = await refusalOf(
        service.updateRemarks({ ...KEYS, sbRemarks: 'x', editRemark: 'typo' }),
      );

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.DOC_NOT_DRAFT }] },
      });
    });

    it('writes the text, logs the edit and audits the before and after', async () => {
      await expect(
        service.updateRemarks({ ...KEYS, sbRemarks: 'deliver after 5', editRemark: 'customer call' }),
      ).resolves.toEqual({ sbRemarks: 'deliver after 5' });

      expect(writtenData()).toEqual({
        sbRemarks: 'deliver after 5',
        sbModifiedOn: expect.any(Date),
        sbModifiedBy: 'raman',
      });
      expect(logEntry()).toMatchObject({
        event: 'REMARKS_EDITED',
        fromStatus: 'POSTED',
        toStatus: 'POSTED',
        remarks: 'customer call',
      });
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          tableName: 'sale_bill',
          pk: BILL_ID,
          originalRecord: { sbRemarks: 'old remark' },
          modifiedRecord: { sbRemarks: 'deliver after 5' },
          notes: 'Remarks edited: customer call',
        }),
        tx,
      );
    });

    it('clears the remarks when none are sent', async () => {
      await expect(service.updateRemarks({ ...KEYS, editRemark: 'clear' })).resolves.toEqual({
        sbRemarks: null,
      });
      expect(writtenData().sbRemarks).toBeNull();
    });
  });

  describe('transport', () => {
    const band = { direction: 'OUTWARD', lrNo: 'LR-9' } as never;

    it('refuses a cancelled bill', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbStatus: 'CANCELLED' }));

      const refusal = await refusalOf(service.transport({ ...KEYS, transport: band }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: SALES_ERROR_CODES.BILL_CANCELLED }] },
      });
      expect(transportBand.write).not.toHaveBeenCalled();
    });

    it('refuses once the day is closed', async () => {
      dayClosed.mockResolvedValue(true);

      const refusal = await refusalOf(service.transport({ ...KEYS, transport: band }));

      expect(refusal.status).toBe(409);
      expect(transportBand.write).not.toHaveBeenCalled();
    });

    it('writes the band on a draft too, and logs TRANSPORT_EDITED', async () => {
      bills.lockHeader.mockResolvedValue(billOf({ sbStatus: 'DRAFT' }));

      await expect(service.transport({ ...KEYS, transport: band })).resolves.toEqual({
        lrNo: 'LR-9',
      });
      expect(transportBand.write).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ docId: BILL_ID }),
        band,
        USER_ID,
        { gdrId: REGISTER_ID, now: expect.any(Date) },
      );
      expect(logEntry()).toMatchObject({
        event: 'TRANSPORT_EDITED',
        fromStatus: 'DRAFT',
        toStatus: 'DRAFT',
      });
    });
  });
});
