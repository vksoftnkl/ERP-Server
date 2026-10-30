import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConvertTxnHoldDto, LockTxnHoldDto } from './dto/lock-txn-hold.dto';
import { SaveTxnHoldDto } from './dto/save-txn-hold.dto';
import { TxnHoldController } from './txn-hold.controller';
import { TxnHoldService } from './txn-hold.service';
import {
  TxnHoldDocType,
  TxnHoldKind,
  TxnHoldPayload,
  TxnHoldSrcModule,
  TxnHoldStatus,
} from './types/txn-hold-api.types';

const TXH_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const LOCK_TOKEN = '019c6f6c-be87-7a11-8905-36092c46fe0a';
const DEVICE_A = '019c6f6c-be87-7a11-8905-36092c46fe11';
const ACC_YEAR = '2026-2027';

const holdPayload: TxnHoldPayload = {
  txhId: TXH_ID,
  txhCompanyId: COMPANY_ID,
  txhBranchId: BRANCH_ID,
  txhTenantId: null,
  txhAccYear: ACC_YEAR,
  txhKind: TxnHoldKind.HOLD,
  txhSrcModule: TxnHoldSrcModule.POS,
  txhDocType: TxnHoldDocType.SALE_BILL,
  txhHoldNo: 'HLD-001',
  txhHoldSlno: 1,
  txhHoldOn: '2026-08-04T10:00:00.000Z',
  txhDeviceId: DEVICE_A,
  txhCounterId: null,
  txhSessionId: null,
  txhHeldBy: USER_ID,
  txhPartyType: null,
  txhPartyId: null,
  txhPartyName: 'Walk-in',
  txhPartyMobile: null,
  txhStaffId: null,
  txhRefLabel: 'table 7',
  txhItemCount: 2,
  txhTotalQty: 3,
  txhNetAmount: 250,
  txhPayload: { cart: [{ item: 'PEN', qty: 2 }] },
  txhPayloadVersion: 1,
  txhRevision: 1,
  txhStatus: TxnHoldStatus.HELD,
  txhHoldReason: null,
  txhRemarks: null,
  txhExpiresOn: null,
  txhLockedBy: null,
  txhLockedDeviceId: null,
  txhLockedOn: null,
  txhLockExpiresOn: null,
  txhLockToken: null,
  txhResumedBy: null,
  txhResumedOn: null,
  txhResumeCount: 0,
  txhConvertedDocId: null,
  txhConvertedAccYear: null,
  txhConvertedRefno: null,
  txhConvertedOn: null,
  txhConvertedBy: null,
  txhIsStockReserved: false,
  txhPrintCount: 0,
  txhLastPrintedOn: null,
  txhIsDeleted: false,
  txhSyncDate: null,
  txhCreatedOn: '2026-08-04T10:00:00.000Z',
  txhCreatedBy: USER_ID,
  txhModifiedOn: null,
  txhModifiedBy: null,
};

const leasedPayload: TxnHoldPayload = {
  ...holdPayload,
  txhStatus: TxnHoldStatus.LOCKED,
  txhLockedBy: USER_ID,
  txhLockedDeviceId: DEVICE_A,
  txhLockedOn: '2026-08-05T09:00:00.000Z',
  txhLockExpiresOn: '2026-08-05T09:15:00.000Z',
  txhLockToken: LOCK_TOKEN,
  txhResumedBy: USER_ID,
  txhResumedOn: '2026-08-05T09:00:00.000Z',
  txhResumeCount: 1,
};

const convertedPayload: TxnHoldPayload = {
  ...holdPayload,
  txhStatus: TxnHoldStatus.CONVERTED,
  txhConvertedDocId: BILL_ID,
  txhConvertedAccYear: ACC_YEAR,
  txhConvertedRefno: 'INV-101',
  txhConvertedOn: '2026-08-05T09:05:00.000Z',
  txhConvertedBy: USER_ID,
};

const scope: LockTxnHoldDto = { txhCompanyId: COMPANY_ID, txhBranchId: BRANCH_ID };

const convertDto = (): ConvertTxnHoldDto => ({
  ...scope,
  txhConvertedDocId: BILL_ID,
  txhConvertedAccYear: ACC_YEAR,
  txhConvertedRefno: 'INV-101',
  txhConvertedBy: USER_ID,
});

describe('TxnHoldController', () => {
  let controller: TxnHoldController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    softDelete: jest.fn(),
    resumeHold: jest.fn(),
    releaseHold: jest.fn(),
    forceReleaseHold: jest.fn(),
    convertHold: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TxnHoldController],
      providers: [{ provide: TxnHoldService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get<TxnHoldController>(TxnHoldController);
    jest.clearAllMocks();
  });

  describe('crud', () => {
    it('wraps create and update with the message the request implies', async () => {
      serviceMock.save.mockResolvedValue(holdPayload);

      const create: SaveTxnHoldDto = {
        txhCompanyId: COMPANY_ID,
        txhBranchId: BRANCH_ID,
        txhAccYear: ACC_YEAR,
        txhSrcModule: TxnHoldSrcModule.POS,
        txhDocType: TxnHoldDocType.SALE_BILL,
        txhHoldNo: 'HLD-001',
        txhHoldSlno: 1,
        txhDeviceId: DEVICE_A,
        txhHeldBy: USER_ID,
        txhPayload: { cart: [] },
      };
      await expect(controller.save(create)).resolves.toEqual({
        success: true,
        message: 'Hold created successfully',
        data: holdPayload,
      });

      await expect(
        controller.save({
          txhId: TXH_ID,
          txhPayload: { cart: [] },
          txhRemarks: 'back in a minute',
        }),
      ).resolves.toEqual({
        success: true,
        message: 'Hold updated successfully',
        data: holdPayload,
      });
    });

    it('wraps the list with its paging meta', async () => {
      const meta = { page: 1, limit: 20, total: 1, total_pages: 1 };
      serviceMock.list.mockResolvedValue({ items: [holdPayload], meta });

      await expect(controller.list({ txhCompanyId: COMPANY_ID })).resolves.toEqual({
        success: true,
        message: 'Holds fetched successfully',
        data: [holdPayload],
        meta,
      });
    });

    // The accounting year is half the primary key, so the single-row routes
    // hand it down when the caller knows it — Postgres then prunes to one
    // partition instead of scanning every year on record.
    it('wraps get and delete responses, passing the partition hint down', async () => {
      serviceMock.getById.mockResolvedValue(holdPayload);
      serviceMock.softDelete.mockResolvedValue({ txhId: TXH_ID, deleted: true });

      await expect(controller.getById(TXH_ID, ACC_YEAR)).resolves.toEqual({
        success: true,
        message: 'Hold fetched successfully',
        data: holdPayload,
      });
      expect(serviceMock.getById).toHaveBeenCalledWith(TXH_ID, ACC_YEAR);

      await expect(controller.remove(TXH_ID)).resolves.toEqual({
        success: true,
        message: 'Hold deleted successfully',
        data: { txhId: TXH_ID, deleted: true },
      });
      expect(serviceMock.softDelete).toHaveBeenCalledWith(TXH_ID, undefined);
    });
  });

  describe('lease endpoints', () => {
    it('resumes with the id, the X-Device-Id header and the body scope', async () => {
      serviceMock.resumeHold.mockResolvedValue(leasedPayload);

      await expect(controller.resume(TXH_ID, DEVICE_A, scope)).resolves.toEqual({
        success: true,
        message: 'Hold resumed successfully',
        data: leasedPayload,
      });
      expect(serviceMock.resumeHold).toHaveBeenCalledWith(TXH_ID, DEVICE_A, scope);
      // The till needs the parked screen back and the token to prove the lease
      // later, so both have to survive the envelope untouched.
      expect(leasedPayload.txhPayload).toEqual({ cart: [{ item: 'PEN', qty: 2 }] });
      expect(leasedPayload.txhLockToken).toBe(LOCK_TOKEN);
    });

    it('releases and converts through the same header', async () => {
      serviceMock.releaseHold.mockResolvedValue(holdPayload);
      serviceMock.convertHold.mockResolvedValue(convertedPayload);

      await expect(controller.release(TXH_ID, DEVICE_A, scope)).resolves.toEqual({
        success: true,
        message: 'Hold released successfully',
        data: holdPayload,
      });
      expect(serviceMock.releaseHold).toHaveBeenCalledWith(TXH_ID, DEVICE_A, scope);

      await expect(controller.convert(TXH_ID, DEVICE_A, convertDto())).resolves.toEqual({
        success: true,
        message: 'Hold converted successfully',
        data: convertedPayload,
      });
    });

    // A separate route from /release, and it must stay separate: it takes the
    // lease off another device rather than giving back one of its own.
    it('force-releases through its own route and service method', async () => {
      serviceMock.forceReleaseHold.mockResolvedValue(holdPayload);

      await expect(controller.forceRelease(TXH_ID, DEVICE_A, scope)).resolves.toEqual({
        success: true,
        message: 'Hold lease released successfully',
        data: holdPayload,
      });
      expect(serviceMock.forceReleaseHold).toHaveBeenCalledWith(TXH_ID, DEVICE_A, scope);
      expect(serviceMock.releaseHold).not.toHaveBeenCalled();
    });

    // The conversion trail is a separate argument from the tenant scope, so the
    // scope cannot be written onto the row as part of the trail.
    it('hands convert the document, not the whole body', async () => {
      serviceMock.convertHold.mockResolvedValue(convertedPayload);

      await controller.convert(TXH_ID, DEVICE_A, convertDto());

      expect(serviceMock.convertHold).toHaveBeenCalledWith(TXH_ID, DEVICE_A, convertDto(), {
        txhConvertedDocId: BILL_ID,
        txhConvertedAccYear: ACC_YEAR,
        txhConvertedRefno: 'INV-101',
        txhConvertedBy: USER_ID,
      });
      const [, , , conversion] = serviceMock.convertHold.mock.calls[0] as [
        string,
        string,
        LockTxnHoldDto,
        Record<string, unknown>,
      ];
      expect(conversion).not.toHaveProperty('txhCompanyId');
      expect(conversion).not.toHaveProperty('txhBranchId');
    });

    // A device that sends no header must not be silently given one: the service
    // is what answers 400, so the controller has to pass the absence through.
    it('passes a missing device header straight through', async () => {
      serviceMock.resumeHold.mockResolvedValue(leasedPayload);
      serviceMock.releaseHold.mockResolvedValue(holdPayload);
      serviceMock.convertHold.mockResolvedValue(convertedPayload);

      await controller.resume(TXH_ID, undefined, scope);
      await controller.release(TXH_ID, undefined, scope);
      await controller.convert(TXH_ID, undefined, convertDto());

      expect(serviceMock.resumeHold).toHaveBeenCalledWith(TXH_ID, undefined, scope);
      expect(serviceMock.releaseHold).toHaveBeenCalledWith(TXH_ID, undefined, scope);
      expect(serviceMock.convertHold).toHaveBeenCalledWith(
        TXH_ID,
        undefined,
        convertDto(),
        expect.objectContaining({ txhConvertedDocId: BILL_ID }),
      );
    });

    it('lets the lease refusals reach the filter unchanged', async () => {
      serviceMock.resumeHold.mockRejectedValue(
        new ConflictException({
          success: false,
          message: 'Hold is LOCKED by another device',
          errors: [{ field: 'txhLockedDeviceId', message: 'In use elsewhere' }],
        }),
      );
      serviceMock.releaseHold.mockRejectedValue(
        new ForbiddenException({
          success: false,
          message: 'Not leased by this device',
          errors: [{ field: 'txhLockedDeviceId', message: 'Leased elsewhere' }],
        }),
      );

      await expect(controller.resume(TXH_ID, DEVICE_A, scope)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(controller.release(TXH_ID, DEVICE_A, scope)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
