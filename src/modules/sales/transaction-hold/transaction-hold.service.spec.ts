import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, TransactionHold } from '@prisma/client';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TransactionHoldService } from './transaction-hold.service';
import { SaveTransactionHoldDto } from './dto/save-transaction-hold.dto';
import {
  TransactionHoldDeviceType,
  TransactionHoldDocType,
  TransactionHoldStatus,
} from './types/transaction-hold-api.types';

const TH_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const OTHER_TH_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46fe07';
const COUNTER_ID = '019c6f6c-be87-7a11-8905-36092c46fe08';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const ACC_YEAR = 2026;
const HOLD_DATE = new Date('2026-08-04T10:00:00.000Z');
const CONVERTED_AT = new Date('2026-08-04T11:30:00.000Z');

const makeHold = (overrides: Partial<TransactionHold> = {}): TransactionHold =>
  ({
    thId: TH_ID,
    thCompanyId: COMPANY_ID,
    thBranchId: BRANCH_ID,
    thAccYear: ACC_YEAR,
    thHoldNo: 'HLD-001',
    thHoldDate: HOLD_DATE,
    thDocType: 'SALE_INVOICE',
    thCounterId: COUNTER_ID,
    thSessionId: null,
    thUserId: USER_ID,
    thDeviceId: 'TILL-01',
    thDeviceType: 'POS_TERMINAL',
    thCustomerName: null,
    thItemCount: 0,
    thTotalQty: new Prisma.Decimal('0.000'),
    thTotalAmount: new Prisma.Decimal('0.00'),
    thStatus: 'HELD',
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
    thUiState: null,
    thIsDeleted: false,
    thCreatedBy: USER_ID,
    thCreatedAt: HOLD_DATE,
    thModifiedBy: null,
    thModifiedAt: null,
    ...overrides,
  }) as TransactionHold;

const createDto = (overrides: Partial<SaveTransactionHoldDto> = {}): SaveTransactionHoldDto =>
  ({
    thCompanyId: COMPANY_ID,
    thBranchId: BRANCH_ID,
    thAccYear: ACC_YEAR,
    thHoldNo: 'HLD-001',
    thDeviceId: 'TILL-01',
    thDeviceType: 'POS_TERMINAL',
    ...overrides,
  }) as SaveTransactionHoldDto;

type HoldCreateArgs = { data: Prisma.TransactionHoldUncheckedCreateInput };
type HoldUpdateArgs = {
  where: { thId: string };
  data: Prisma.TransactionHoldUncheckedUpdateInput;
};

type PrismaMock = {
  transactionHold: {
    findFirst: jest.Mock<Promise<TransactionHold | null>, unknown[]>;
    findMany: jest.Mock<Promise<TransactionHold[]>, unknown[]>;
    count: jest.Mock<Promise<number>, unknown[]>;
    create: jest.Mock<Promise<TransactionHold>, [HoldCreateArgs]>;
    update: jest.Mock<Promise<TransactionHold>, [HoldUpdateArgs]>;
  };
  company: { findFirst: jest.Mock<Promise<{ compId: string } | null>, unknown[]> };
  branchMaster: { findFirst: jest.Mock<Promise<{ brId: string } | null>, unknown[]> };
  userMaster: { findFirst: jest.Mock<Promise<{ usrId: string } | null>, unknown[]> };
  userLoginSession: { findFirst: jest.Mock<Promise<{ ulsId: string } | null>, unknown[]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

describe('TransactionHoldService', () => {
  let service: TransactionHoldService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock };
  let configuredGridSqlService: { loadCandidates: jest.Mock };

  beforeEach(() => {
    prisma = {
      transactionHold: {
        // Default: the hold looked up by id / the hold-no clash probe finds nothing.
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([makeHold()])),
        count: jest.fn(() => Promise.resolve(1)),
        create: jest.fn(({ data }: HoldCreateArgs) =>
          Promise.resolve(makeHold(data as unknown as Partial<TransactionHold>)),
        ),
        update: jest.fn(({ where, data }: HoldUpdateArgs) =>
          Promise.resolve(
            makeHold({ ...(data as unknown as Partial<TransactionHold>), thId: where.thId }),
          ),
        ),
      },
      company: { findFirst: jest.fn(() => Promise.resolve({ compId: COMPANY_ID })) },
      branchMaster: { findFirst: jest.fn(() => Promise.resolve({ brId: BRANCH_ID })) },
      userMaster: { findFirst: jest.fn(() => Promise.resolve({ usrId: USER_ID })) },
      userLoginSession: { findFirst: jest.fn(() => Promise.resolve({ ulsId: SESSION_ID })) },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
    // No configured grid for transaction_hold, so list() falls through to Prisma.
    configuredGridSqlService = { loadCandidates: jest.fn(() => Promise.resolve([])) };
    service = new TransactionHoldService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      configuredGridSqlService as unknown as ConfiguredGridSqlService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  describe('create', () => {
    it('stores the scope, stamps the hold date and audits the write', async () => {
      const payload = await service.save(
        createDto({ thCounterId: COUNTER_ID, thUserId: USER_ID, thItemCount: 3 }),
      );

      const { data } = prisma.transactionHold.create.mock.calls[0][0];
      expect(data).toMatchObject({
        thCompanyId: COMPANY_ID,
        thBranchId: BRANCH_ID,
        thAccYear: ACC_YEAR,
        thHoldNo: 'HLD-001',
        thDeviceId: 'TILL-01',
        thDeviceType: 'POS_TERMINAL',
        thCounterId: COUNTER_ID,
        thItemCount: 3,
        thCreatedBy: USER_ID,
      });
      // Not sent — filled in rather than left to the column default.
      expect(data.thHoldDate).toBeInstanceOf(Date);
      expect(payload.thStatus).toBe(TransactionHoldStatus.HELD);
      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
    });

    it('requires the fields a new hold cannot be created without', async () => {
      await expect(service.save(createDto({ thHoldNo: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ thCompanyId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ thAccYear: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ thDeviceId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.transactionHold.create).not.toHaveBeenCalled();
    });

    it('rejects a missing company, branch, user or session', async () => {
      prisma.company.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.branchMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.userMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto({ thUserId: USER_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );

      prisma.userLoginSession.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto({ thSessionId: SESSION_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.transactionHold.create).not.toHaveBeenCalled();
    });

    it('rejects a hold number already live in the same company / branch / year', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold({ thId: OTHER_TH_ID }));

      await expect(service.save(createDto())).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.transactionHold.create).not.toHaveBeenCalled();
    });

    // ux_th_hold_no keys on the document type too, so the probe has to resolve
    // an omitted thDocType to the column default rather than ignore the column.
    it('probes the hold number per document type, defaulting to SALE_INVOICE', async () => {
      await service.save(createDto());

      expect(prisma.transactionHold.findFirst.mock.calls[0][0]).toMatchObject({
        where: {
          thIsDeleted: false,
          thCompanyId: COMPANY_ID,
          thBranchId: BRANCH_ID,
          thAccYear: ACC_YEAR,
          thDocType: TransactionHoldDocType.SALE_INVOICE,
          thHoldNo: 'HLD-001',
        },
      });

      prisma.transactionHold.findFirst.mockClear();
      await service.save(createDto({ thDocType: TransactionHoldDocType.SALE_ORDER }));

      expect(prisma.transactionHold.findFirst.mock.calls[0][0]).toMatchObject({
        where: { thDocType: TransactionHoldDocType.SALE_ORDER },
      });
    });

    it('rejects an expiry that is not after the hold date', async () => {
      await expect(
        service.save(
          createDto({ thHoldDate: HOLD_DATE, thExpiresAt: new Date('2026-08-04T09:00:00.000Z') }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    // ck_th_converted — CONVERTED needs both the document it became and when.
    it('rejects a conversion trace that names no document', async () => {
      await expect(
        service.save(createDto({ thStatus: TransactionHoldStatus.CONVERTED })),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.save(
          createDto({
            thStatus: TransactionHoldStatus.CONVERTED,
            thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
            thConvertedDocId: BILL_ID,
          }),
        ),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(service.save(createDto({ thConvertedDocId: BILL_ID }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    // ck_th_status / ck_th_doc_type / ck_th_device_type
    it('rejects a value outside the enum sets', async () => {
      await expect(
        service.save(createDto({ thStatus: 'PARKED' as TransactionHoldStatus })),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.save(createDto({ thDocType: 'QUOTATION' as TransactionHoldDocType })),
      ).rejects.toBeInstanceOf(BadRequestException);

      await expect(
        service.save(createDto({ thDeviceType: 'POS' as TransactionHoldDeviceType })),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.transactionHold.create).not.toHaveBeenCalled();
    });

    // ck_th_total_amount — gross, never negative, while th_total_qty stays signed.
    it('rejects a negative total amount but allows a negative quantity', async () => {
      await expect(service.save(createDto({ thTotalAmount: -1 }))).rejects.toBeInstanceOf(
        BadRequestException,
      );

      await service.save(
        createDto({ thDocType: TransactionHoldDocType.SALE_RETURN, thTotalQty: -2 }),
      );
      expect(prisma.transactionHold.create.mock.calls[0][0].data.thTotalQty).toBe(-2);
    });

    it('clears th_ui_state to SQL NULL rather than a JSON null', async () => {
      await service.save(createDto({ thUiState: null }));

      expect(prisma.transactionHold.create.mock.calls[0][0].data.thUiState).toBe(Prisma.DbNull);
    });
  });

  describe('update', () => {
    it('writes only the fields the request carries', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());

      await service.save({ thId: TH_ID, thRemarks: 'Customer stepped out' });

      const { where, data } = prisma.transactionHold.update.mock.calls[0][0];
      expect(where).toEqual({ thId: TH_ID });
      expect(data).toMatchObject({ thRemarks: 'Customer stepped out', thModifiedBy: USER_ID });
      expect(data.thHoldNo).toBeUndefined();
      expect(data.thStatus).toBeUndefined();
    });

    it('re-checks the hold number when only the document type moves', async () => {
      prisma.transactionHold.findFirst
        .mockResolvedValueOnce(makeHold())
        // A SALE_ORDER hold already carries HLD-001 in this scope.
        .mockResolvedValueOnce(makeHold({ thId: OTHER_TH_ID, thDocType: 'SALE_ORDER' }));

      await expect(
        service.save({ thId: TH_ID, thDocType: TransactionHoldDocType.SALE_ORDER }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.transactionHold.update).not.toHaveBeenCalled();
    });

    it('skips the hold-number probe when neither half of the pair changes', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());

      await service.save({ thId: TH_ID, thHoldNo: 'HLD-001', thRemarks: 'same number' });

      // Only the lookup of the stored hold — no uniqueness probe.
      expect(prisma.transactionHold.findFirst).toHaveBeenCalledTimes(1);
      expect(prisma.transactionHold.update).toHaveBeenCalledTimes(1);
    });

    it('refuses to re-scope a stored hold', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());

      await expect(
        service.save({ thId: TH_ID, thCompanyId: OTHER_COMPANY_ID }),
      ).rejects.toBeInstanceOf(BadRequestException);

      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());
      await expect(service.save({ thId: TH_ID, thAccYear: 2027 })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.transactionHold.update).not.toHaveBeenCalled();
    });

    it('refuses to reopen a hold that was already converted', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(
        makeHold({
          thStatus: 'CONVERTED',
          thConvertedDocType: 'SALE_INVOICE',
          thConvertedDocId: BILL_ID,
        }),
      );

      await expect(
        service.save({ thId: TH_ID, thStatus: TransactionHoldStatus.HELD }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.transactionHold.update).not.toHaveBeenCalled();
    });

    it('stamps the conversion trace when the hold becomes a document', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold());

      const payload = await service.save({
        thId: TH_ID,
        thStatus: TransactionHoldStatus.CONVERTED,
        thConvertedDocType: TransactionHoldDocType.SALE_INVOICE,
        thConvertedDocId: BILL_ID,
        thConvertedNo: 'INV-101',
        thConvertedAt: CONVERTED_AT,
      });

      expect(payload.thStatus).toBe(TransactionHoldStatus.CONVERTED);
      expect(payload.thConvertedDocId).toBe(BILL_ID);
      expect(payload.thConvertedNo).toBe('INV-101');
      expect(payload.thConvertedAt).toBe(CONVERTED_AT.toISOString());
    });

    // The stored row supplies whatever the payload leaves out, so a hold already
    // carrying its trace can be flipped to CONVERTED on its own.
    it('accepts CONVERTED when the stored row already carries the trace', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(
        makeHold({
          thConvertedDocType: 'SALE_INVOICE',
          thConvertedDocId: BILL_ID,
          thConvertedAt: CONVERTED_AT,
        }),
      );

      const payload = await service.save({
        thId: TH_ID,
        thStatus: TransactionHoldStatus.CONVERTED,
      });

      expect(payload.thStatus).toBe(TransactionHoldStatus.CONVERTED);
    });

    it('404s on an unknown or already deleted hold', async () => {
      await expect(service.save({ thId: TH_ID, thRemarks: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('read and delete', () => {
    it('404s when getById finds nothing live', async () => {
      await expect(service.getById(TH_ID)).rejects.toBeInstanceOf(NotFoundException);
    });

    it('filters the list on the query and never returns deleted holds', async () => {
      await service.list({ thCounterId: COUNTER_ID, thStatus: TransactionHoldStatus.HELD });

      const { where } = prisma.transactionHold.findMany.mock.calls[0][0] as {
        where: Prisma.TransactionHoldWhereInput;
      };
      expect(where.thIsDeleted).toBe(false);
      expect(where.AND).toEqual([
        { thCounterId: COUNTER_ID },
        { thStatus: TransactionHoldStatus.HELD },
      ]);
      // A filtered request must not be answered from the configured grid.
      expect(configuredGridSqlService.loadCandidates).not.toHaveBeenCalled();
    });

    it('treats a hold with no expiry as still valid', async () => {
      await service.list({ expired: false });

      const { where } = prisma.transactionHold.findMany.mock.calls[0][0] as {
        where: Prisma.TransactionHoldWhereInput;
      };
      const expiryFilter = (where.AND as Prisma.TransactionHoldWhereInput[])[0];
      expect(expiryFilter.OR).toHaveLength(2);
      expect((expiryFilter.OR as Prisma.TransactionHoldWhereInput[])[0]).toEqual({
        thExpiresAt: null,
      });
    });

    it('soft deletes without rewriting the status', async () => {
      prisma.transactionHold.findFirst.mockResolvedValueOnce(makeHold({ thStatus: 'CONVERTED' }));

      const result = await service.softDelete(TH_ID);

      const { data } = prisma.transactionHold.update.mock.calls[0][0];
      expect(data).toMatchObject({ thIsDeleted: true, thModifiedBy: USER_ID });
      expect(data.thStatus).toBeUndefined();
      expect(result).toEqual({ thId: TH_ID, deleted: true });
    });

    it('404s when deleting a hold that is not live', async () => {
      await expect(service.softDelete(TH_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
