import { ConflictException, ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConvertTransactionHoldDto, LockTransactionHoldDto } from './dto/lock-transaction-hold.dto';
import { SaveTransactionHoldDto } from './dto/save-transaction-hold.dto';
import { TransactionHoldController } from './transaction-hold.controller';
import { TransactionHoldService } from './transaction-hold.service';
import {
  TransactionHoldDeviceType,
  TransactionHoldDocType,
  TransactionHoldPayload,
  TransactionHoldStatus,
} from './types/transaction-hold-api.types';

const TH_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const DEVICE_A = 'TILL-01';

const holdPayload: TransactionHoldPayload = {
  thId: TH_ID,
  thCompanyId: COMPANY_ID,
  thBranchId: BRANCH_ID,
  thAccYear: 2026,
  thHoldNo: 'HLD-001',
  thHoldDate: '2026-08-04T10:00:00.000Z',
  thDocType: TransactionHoldDocType.SALE_INVOICE,
  thCounterId: null,
  thSessionId: null,
  thUserId: USER_ID,
  thDeviceId: DEVICE_A,
  thDeviceType: TransactionHoldDeviceType.DESKTOP,
  thCustomerName: null,
  thItemCount: 2,
  thTotalQty: 3,
  thTotalAmount: 250,
  thStatus: TransactionHoldStatus.HELD,
  thHoldReason: null,
  thRemarks: null,
  thExpiresAt: null,
  thLockedBy: null,
  thLockedAt: null,
  thResumedBy: null,
  thResumedAt: null,
  thResumeCount: 0,
  thConvertedDocType: null,
  thConvertedDocId: null,
  thConvertedNo: null,
  thConvertedAt: null,
  thConvertedBy: null,
  thIsStockReserved: false,
  thUiState: { cart: [{ item: 'PEN', qty: 2 }] },
  thIsDeleted: false,
  thCreatedBy: USER_ID,
  thCreatedAt: '2026-08-04T10:00:00.000Z',
  thModifiedBy: null,
  thModifiedAt: null,
};

const lockedPayload: TransactionHoldPayload = {
  ...holdPayload,
  thStatus: TransactionHoldStatus.LOCKED,
  thLockedBy: DEVICE_A,
  thLockedAt: '2026-08-05T09:00:00.000Z',
  thResumedBy: DEVICE_A,
  thResumedAt: '2026-08-05T09:00:00.000Z',
  thResumeCount: 1,
};

const convertedPayload: TransactionHoldPayload = {
  ...holdPayload,
  thStatus: TransactionHoldStatus.CONVERTED,
  thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
  thConvertedDocId: BILL_ID,
  thConvertedNo: 'INV-101',
  thConvertedAt: '2026-08-05T09:05:00.000Z',
  thConvertedBy: USER_ID,
};

const scope: LockTransactionHoldDto = { thCompanyId: COMPANY_ID, thBranchId: BRANCH_ID };

const convertDto = (): ConvertTransactionHoldDto => ({
  ...scope,
  thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
  thConvertedDocId: BILL_ID,
  thConvertedNo: 'INV-101',
  thConvertedBy: USER_ID,
});

describe('TransactionHoldController', () => {
  let controller: TransactionHoldController;

  const serviceMock = {
    save: jest.fn(),
    list: jest.fn(),
    getById: jest.fn(),
    softDelete: jest.fn(),
    resumeHold: jest.fn(),
    releaseHold: jest.fn(),
    convertHold: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [TransactionHoldController],
      providers: [{ provide: TransactionHoldService, useValue: serviceMock }],
    }).compile();

    controller = moduleRef.get<TransactionHoldController>(TransactionHoldController);
    jest.clearAllMocks();
  });

  describe('crud', () => {
    it('wraps create and update with the message the request implies', async () => {
      serviceMock.save.mockResolvedValue(holdPayload);

      const create: SaveTransactionHoldDto = {
        thCompanyId: COMPANY_ID,
        thBranchId: BRANCH_ID,
        thAccYear: 2026,
        thHoldNo: 'HLD-001',
        thDeviceId: DEVICE_A,
        thDeviceType: TransactionHoldDeviceType.DESKTOP,
      };
      await expect(controller.save(create)).resolves.toEqual({
        success: true,
        message: 'Hold created successfully',
        data: holdPayload,
      });

      await expect(
        controller.save({ thId: TH_ID, thRemarks: 'back in a minute' }),
      ).resolves.toEqual({
        success: true,
        message: 'Hold updated successfully',
        data: holdPayload,
      });
    });

    it('wraps the list with its paging meta', async () => {
      const meta = { page: 1, limit: 20, total: 1, total_pages: 1 };
      serviceMock.list.mockResolvedValue({ items: [holdPayload], meta });

      await expect(controller.list({ thCompanyId: COMPANY_ID })).resolves.toEqual({
        success: true,
        message: 'Holds fetched successfully',
        data: [holdPayload],
        meta,
      });
    });

    it('wraps get and delete responses', async () => {
      serviceMock.getById.mockResolvedValue(holdPayload);
      serviceMock.softDelete.mockResolvedValue({ thId: TH_ID, deleted: true });

      await expect(controller.getById(TH_ID)).resolves.toEqual({
        success: true,
        message: 'Hold fetched successfully',
        data: holdPayload,
      });
      await expect(controller.remove(TH_ID)).resolves.toEqual({
        success: true,
        message: 'Hold deleted successfully',
        data: { thId: TH_ID, deleted: true },
      });
    });
  });

  describe('lock endpoints', () => {
    it('resumes with the id, the X-Device-Id header and the body scope', async () => {
      serviceMock.resumeHold.mockResolvedValue(lockedPayload);

      await expect(controller.resume(TH_ID, DEVICE_A, scope)).resolves.toEqual({
        success: true,
        message: 'Hold resumed successfully',
        data: lockedPayload,
      });
      expect(serviceMock.resumeHold).toHaveBeenCalledWith(TH_ID, DEVICE_A, scope);
      // The till needs the parked screen back, so thUiState has to survive the
      // envelope untouched.
      expect(lockedPayload.thUiState).toEqual({ cart: [{ item: 'PEN', qty: 2 }] });
    });

    it('releases and converts through the same header', async () => {
      serviceMock.releaseHold.mockResolvedValue(holdPayload);
      serviceMock.convertHold.mockResolvedValue(convertedPayload);

      await expect(controller.release(TH_ID, DEVICE_A, scope)).resolves.toEqual({
        success: true,
        message: 'Hold released successfully',
        data: holdPayload,
      });
      expect(serviceMock.releaseHold).toHaveBeenCalledWith(TH_ID, DEVICE_A, scope);

      await expect(controller.convert(TH_ID, DEVICE_A, convertDto())).resolves.toEqual({
        success: true,
        message: 'Hold converted successfully',
        data: convertedPayload,
      });
    });

    // The conversion trace is a separate argument from the tenant scope, so the
    // scope cannot be written onto the row as part of the trace.
    it('hands convert the document, not the whole body', async () => {
      serviceMock.convertHold.mockResolvedValue(convertedPayload);

      await controller.convert(TH_ID, DEVICE_A, convertDto());

      expect(serviceMock.convertHold).toHaveBeenCalledWith(TH_ID, DEVICE_A, convertDto(), {
        thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
        thConvertedDocId: BILL_ID,
        thConvertedNo: 'INV-101',
        thConvertedBy: USER_ID,
      });
      const [, , , conversion] = serviceMock.convertHold.mock.calls[0] as [
        string,
        string,
        LockTransactionHoldDto,
        Record<string, unknown>,
      ];
      expect(conversion).not.toHaveProperty('thCompanyId');
      expect(conversion).not.toHaveProperty('thBranchId');
    });

    // A device that sends no header must not be silently given one: the service
    // is what answers 400, so the controller has to pass the absence through.
    it('passes a missing device header straight through', async () => {
      serviceMock.resumeHold.mockResolvedValue(lockedPayload);
      serviceMock.releaseHold.mockResolvedValue(holdPayload);
      serviceMock.convertHold.mockResolvedValue(convertedPayload);

      await controller.resume(TH_ID, undefined, scope);
      await controller.release(TH_ID, undefined, scope);
      await controller.convert(TH_ID, undefined, convertDto());

      expect(serviceMock.resumeHold).toHaveBeenCalledWith(TH_ID, undefined, scope);
      expect(serviceMock.releaseHold).toHaveBeenCalledWith(TH_ID, undefined, scope);
      expect(serviceMock.convertHold).toHaveBeenCalledWith(
        TH_ID,
        undefined,
        convertDto(),
        expect.objectContaining({ thConvertedDocId: BILL_ID }),
      );
    });

    it('lets the lock refusals reach the filter unchanged', async () => {
      serviceMock.resumeHold.mockRejectedValue(
        new ConflictException({
          success: false,
          message: 'Hold is LOCKED by device TILL-02',
          errors: [{ field: 'thLockedBy', message: 'In use on TILL-02' }],
        }),
      );
      serviceMock.releaseHold.mockRejectedValue(
        new ForbiddenException({
          success: false,
          message: 'Not locked by this device',
          errors: [{ field: 'thLockedBy', message: 'Locked by TILL-02' }],
        }),
      );

      await expect(controller.resume(TH_ID, DEVICE_A, scope)).rejects.toBeInstanceOf(
        ConflictException,
      );
      await expect(controller.release(TH_ID, DEVICE_A, scope)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });
});
