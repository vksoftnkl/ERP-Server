import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AccTenderDetail, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { TenderDetailService } from './tender-detail.service';
import { SaveTenderDetailDto } from './dto/save-tender-detail.dto';
import {
  TenderDocumentScope,
  TenderDrCr,
  TenderSettleStatus,
  TenderSrcDocType,
  TenderSrcModule,
} from './types/tender-detail-api.types';

const TD_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const OTHER_TD_ID = '019c6f6c-be87-7a11-8905-36092c46fe02';
const DOC_ID = '019c6f6c-be87-7a11-8905-36092c46fe03';
const OTHER_DOC_ID = '019c6f6c-be87-7a11-8905-36092c46fe04';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46fe05';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46fe06';
const TENDER_ID = '019c6f6c-be87-7a11-8905-36092c46fe07';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fe08';
const PARTY_LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46fe09';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46fe0a';
const ACC_YEAR = '2026-2027';
const DOC_DATE = new Date('2026-07-28T00:00:00.000Z');

const makeTender = (overrides: Partial<AccTenderDetail> = {}): AccTenderDetail =>
  ({
    tdId: TD_ID,
    tdCompanyId: COMPANY_ID,
    tdBranchId: BRANCH_ID,
    tdTenantId: null,
    tdAccYear: ACC_YEAR,
    tdSrcModule: 'SALES',
    tdSrcDocType: 'SALE_BILL',
    tdSrcDocId: DOC_ID,
    tdRowNo: 1,
    tdDocDate: DOC_DATE,
    tdPartyLedgerId: PARTY_LEDGER_ID,
    tdVoucherId: null,
    tdTenderId: TENDER_ID,
    tdTenderTypeId: 1,
    tdTenderLedgerId: LEDGER_ID,
    tdDrCr: 'DR',
    tdAmount: new Prisma.Decimal('500.00'),
    tdSurchargePerc: new Prisma.Decimal('0.000'),
    tdSurchargeAmt: new Prisma.Decimal('0.00'),
    tdTotalAmt: new Prisma.Decimal('500.00'),
    tdReceivedAmt: new Prisma.Decimal('0.00'),
    tdChangeAmt: new Prisma.Decimal('0.00'),
    tdUnitsUsed: new Prisma.Decimal('0.0000'),
    tdConversionRate: new Prisma.Decimal('1.0000'),
    tdRefNo: null,
    tdAuthCode: null,
    tdCardLast4: null,
    tdBankName: null,
    tdPayerVpa: null,
    tdInstrumentDate: null,
    tdIsPdc: false,
    tdSettleStatus: 'NA',
    tdSettleLedgerId: null,
    tdExpectedSettleOn: null,
    tdSettledOn: null,
    tdSettleAmount: null,
    tdMdrAmt: new Prisma.Decimal('0.00'),
    tdSettleRefNo: null,
    tdSettleVoucherId: null,
    tdSessionId: null,
    tdDeviceId: null,
    tdUserId: USER_ID,
    tdNotes: null,
    tdIsDeleted: false,
    tdSyncDate: null,
    tdCreatedOn: new Date('2026-07-28T10:00:00.000Z'),
    tdCreatedBy: USER_ID,
    tdModifiedOn: null,
    tdModifiedBy: null,
    ...overrides,
  }) as AccTenderDetail;

const createDto = (overrides: Partial<SaveTenderDetailDto> = {}): SaveTenderDetailDto =>
  ({
    tdSrcModule: TenderSrcModule.SALES,
    tdSrcDocType: TenderSrcDocType.SALE_BILL,
    tdSrcDocId: DOC_ID,
    tdCompanyId: COMPANY_ID,
    tdBranchId: BRANCH_ID,
    tdAccYear: ACC_YEAR,
    tdDocDate: '2026-07-28',
    tdPartyLedgerId: PARTY_LEDGER_ID,
    tdUserId: USER_ID,
    tdDrCr: TenderDrCr.DR,
    tdTenderId: TENDER_ID,
    ...overrides,
  }) as SaveTenderDetailDto;

type TenderCreateArgs = { data: Prisma.AccTenderDetailUncheckedCreateInput };
type TenderUpdateArgs = {
  where: { tdId_tdAccYear: { tdId: string; tdAccYear: string } };
  data: Prisma.AccTenderDetailUncheckedUpdateInput;
};

type PrismaMock = {
  accTenderDetail: {
    findFirst: jest.Mock<Promise<AccTenderDetail | null>, unknown[]>;
    findMany: jest.Mock<Promise<AccTenderDetail[]>, unknown[]>;
    aggregate: jest.Mock<Promise<{ _max: { tdRowNo: number | null } }>, unknown[]>;
    create: jest.Mock<Promise<AccTenderDetail>, [TenderCreateArgs]>;
    update: jest.Mock<Promise<AccTenderDetail>, [TenderUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  accTenderMaster: {
    findFirst: jest.Mock<
      Promise<{ tndName: string; tndTypeId: number; tndLedgerId: string } | null>,
      unknown[]
    >;
  };
  accTenderType: { findFirst: jest.Mock<Promise<{ ttmTypeId: number } | null>, unknown[]> };
  accLedgerMaster: { findFirst: jest.Mock<Promise<{ ledName: string } | null>, unknown[]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

const containing = (value: Record<string, unknown>): unknown => expect.objectContaining(value);

describe('TenderDetailService', () => {
  let service: TenderDetailService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock };

  beforeEach(() => {
    prisma = {
      accTenderDetail: {
        // Default: the line looked up by id / the row-no clash probe finds nothing.
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([makeTender()])),
        aggregate: jest.fn(() => Promise.resolve({ _max: { tdRowNo: null } })),
        create: jest.fn(({ data }: TenderCreateArgs) =>
          Promise.resolve(makeTender(data as unknown as Partial<AccTenderDetail>)),
        ),
        update: jest.fn(({ where, data }: TenderUpdateArgs) =>
          Promise.resolve(
            makeTender({
              ...(data as unknown as Partial<AccTenderDetail>),
              tdId: where.tdId_tdAccYear.tdId,
            }),
          ),
        ),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      accTenderMaster: {
        findFirst: jest.fn(() =>
          Promise.resolve({ tndName: 'HDFC Card', tndTypeId: 2, tndLedgerId: LEDGER_ID }),
        ),
      },
      accTenderType: { findFirst: jest.fn(() => Promise.resolve({ ttmTypeId: 2 })) },
      accLedgerMaster: { findFirst: jest.fn(() => Promise.resolve({ ledName: 'Card Clearing' })) },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
    service = new TenderDetailService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  describe('create', () => {
    it('stores the document scope, assigns the next row number and snapshots the tender master', async () => {
      prisma.accTenderDetail.aggregate.mockResolvedValueOnce({ _max: { tdRowNo: 2 } });

      const payload = await service.save(createDto({ tdAmount: 500, tdSurchargeAmt: 10 }));

      expect(prisma.accTenderDetail.create.mock.calls[0][0].data).toMatchObject({
        tdSrcModule: 'SALES',
        tdSrcDocType: 'SALE_BILL',
        tdSrcDocId: DOC_ID,
        tdRowNo: 3,
        tdCompanyId: COMPANY_ID,
        tdBranchId: BRANCH_ID,
        tdAccYear: ACC_YEAR,
        tdPartyLedgerId: PARTY_LEDGER_ID,
        tdUserId: USER_ID,
        tdDrCr: 'DR',
        tdTenderId: TENDER_ID,
        // Not sent — taken from acc_tender_master.
        tdTenderTypeId: 2,
        tdTenderLedgerId: LEDGER_ID,
      });
      expect(payload.tdTenderName).toBe('HDFC Card');
      expect(payload.tdTenderLedgerName).toBe('Card Clearing');
      // Date-only column, not a UTC midnight timestamp.
      expect(payload.tdDocDate).toBe('2026-07-28');
      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
    });

    it('requires the scope a new line cannot be created without', async () => {
      await expect(service.save(createDto({ tdTenderId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ tdSrcDocId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ tdDocDate: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ tdPartyLedgerId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.accTenderDetail.create).not.toHaveBeenCalled();
    });

    it('rejects an inactive tender master or a soft-deleted ledger', async () => {
      prisma.accTenderMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accTenderDetail.create).not.toHaveBeenCalled();
    });

    it('rejects a row number already used on the same document', async () => {
      prisma.accTenderDetail.findFirst.mockResolvedValueOnce(makeTender());
      await expect(service.save(createDto({ tdRowNo: 1 }))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('enforces the remaining CHECK constraints app-side', async () => {
      // ck_td_pdc
      await expect(service.save(createDto({ tdIsPdc: true }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // ck_td_settled_on
      await expect(
        service.save(createDto({ tdSettleStatus: TenderSettleStatus.SETTLED })),
      ).rejects.toBeInstanceOf(BadRequestException);
      // ck_td_card_last4
      await expect(service.save(createDto({ tdCardLast4: '12X4' }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      // ck_td_units
      await expect(service.save(createDto({ tdConversionRate: 0 }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.accTenderDetail.findFirst.mockImplementation(() => Promise.resolve(makeTender()));
    });

    it('addresses the partitioned compound key and only writes what was sent', async () => {
      await service.save({ tdId: TD_ID, tdAmount: 750 } as SaveTenderDetailDto);

      const { where, data } = prisma.accTenderDetail.update.mock.calls[0][0];
      expect(where).toEqual({ tdId_tdAccYear: { tdId: TD_ID, tdAccYear: ACC_YEAR } });
      expect(data).toMatchObject({ tdRowNo: 1, tdAmount: 750, tdTenderId: TENDER_ID });
      expect(data).not.toHaveProperty('tdSrcDocId');
      // tdTotalAmt is re-derived from the merged row, not left stale.
      expect((data.tdTotalAmt as Prisma.Decimal).toString()).toBe('750');
    });

    it('refuses to move a saved line onto another document', async () => {
      await expect(
        service.save({ tdId: TD_ID, tdSrcDocId: OTHER_DOC_ID } as SaveTenderDetailDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accTenderDetail.update).not.toHaveBeenCalled();
    });

    it('judges the cash-change rule on the merged row, not the payload alone', async () => {
      prisma.accTenderDetail.findFirst.mockImplementation(() =>
        Promise.resolve(makeTender({ tdReceivedAmt: new Prisma.Decimal('100.00') })),
      );
      await expect(
        service.save({ tdId: TD_ID, tdChangeAmt: 500 } as SaveTenderDetailDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s when the line does not exist or is already deleted', async () => {
      prisma.accTenderDetail.findFirst.mockImplementation(() => Promise.resolve(null));
      await expect(service.save({ tdId: TD_ID } as SaveTenderDetailDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('get', () => {
    it("reads a document's lines by the discriminator triple, excluding deleted rows", async () => {
      const payload = await service.get({
        tdSrcModule: TenderSrcModule.SALES,
        tdSrcDocType: TenderSrcDocType.SALE_BILL,
        tdSrcDocId: DOC_ID,
      });

      expect(Array.isArray(payload)).toBe(true);
      expect(prisma.accTenderDetail.findMany.mock.calls[0][0]).toMatchObject({
        where: {
          tdSrcModule: 'SALES',
          tdSrcDocType: 'SALE_BILL',
          tdSrcDocId: DOC_ID,
          tdIsDeleted: false,
        },
      });
    });

    it('rejects an ambiguous or incomplete lookup', async () => {
      await expect(service.get({ tdId: TD_ID, tdSrcDocId: DOC_ID })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.get({ tdSrcModule: TenderSrcModule.SALES })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.get({})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  // What an owning document (a bill) calls inside its own transaction instead of
  // writing acc_tender_detail itself.
  describe('syncDocumentTenders', () => {
    const scope: TenderDocumentScope = {
      tdSrcModule: TenderSrcModule.SALES,
      tdSrcDocType: TenderSrcDocType.SALE_BILL,
      tdSrcDocId: DOC_ID,
      tdCompanyId: COMPANY_ID,
      tdBranchId: BRANCH_ID,
      tdTenantId: null,
      tdAccYear: ACC_YEAR,
      tdDocDate: DOC_DATE,
      tdPartyLedgerId: PARTY_LEDGER_ID,
      tdUserId: USER_ID,
      tdSessionId: null,
      tdDeviceId: 'till-1',
      tdDrCr: TenderDrCr.DR,
    };
    const tx = (): never => prisma as never;

    it('creates a line under the parent scope, numbering it by position', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValueOnce([]);

      await service.syncDocumentTenders(
        tx(),
        scope,
        [{ tdTenderId: TENDER_ID, tdAmount: 300 }],
        USER_ID,
      );

      expect(prisma.accTenderDetail.create.mock.calls[0][0].data).toMatchObject({
        tdSrcDocId: DOC_ID,
        tdRowNo: 1,
        tdDocDate: DOC_DATE,
        tdPartyLedgerId: PARTY_LEDGER_ID,
        tdDeviceId: 'till-1',
        tdDrCr: 'DR',
        tdAmount: 300,
      });
    });

    it('updates a line carrying tdId and soft deletes the ones the payload dropped', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValueOnce([
        makeTender(),
        makeTender({ tdId: OTHER_TD_ID, tdRowNo: 2 }),
      ]);

      await service.syncDocumentTenders(tx(), scope, [{ tdId: TD_ID, tdAmount: 750 }], USER_ID);

      expect(prisma.accTenderDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tdId_tdAccYear: { tdId: TD_ID, tdAccYear: ACC_YEAR } },
          data: containing({ tdRowNo: 1, tdAmount: 750 }),
        }),
      );
      expect(prisma.accTenderDetail.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tdId_tdAccYear: { tdId: OTHER_TD_ID, tdAccYear: ACC_YEAR } },
          data: containing({ tdIsDeleted: true }),
        }),
      );
    });

    it('leaves the stored lines untouched when the array is omitted', async () => {
      const payloads = await service.syncDocumentTenders(tx(), scope, undefined, USER_ID);

      expect(payloads).toHaveLength(1);
      expect(prisma.accTenderDetail.create).not.toHaveBeenCalled();
      expect(prisma.accTenderDetail.update).not.toHaveBeenCalled();
    });

    it('refuses a line pointing at another document', async () => {
      await expect(
        service.syncDocumentTenders(
          tx(),
          scope,
          [{ tdTenderId: TENDER_ID, tdSrcDocId: OTHER_DOC_ID }],
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.accTenderDetail.create).not.toHaveBeenCalled();
    });

    it('rejects a duplicate tdRowNo within one payload', async () => {
      await expect(
        service.syncDocumentTenders(
          tx(),
          scope,
          [
            { tdTenderId: TENDER_ID, tdRowNo: 1 },
            { tdTenderId: TENDER_ID, tdRowNo: 1 },
          ],
          USER_ID,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('404s on a tdId that is not a line of this document', async () => {
      prisma.accTenderDetail.findMany.mockResolvedValueOnce([]);

      await expect(
        service.syncDocumentTenders(tx(), scope, [{ tdId: TD_ID }], USER_ID),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('softDelete', () => {
    it('flags the row deleted and audits the change', async () => {
      prisma.accTenderDetail.findFirst.mockResolvedValueOnce(makeTender());

      const result = await service.softDelete(TD_ID);

      expect(result).toEqual({ tdId: TD_ID, deleted: true });
      expect(prisma.accTenderDetail.update.mock.calls[0][0]).toMatchObject({
        where: { tdId_tdAccYear: { tdId: TD_ID, tdAccYear: ACC_YEAR } },
        data: { tdIsDeleted: true, tdModifiedBy: USER_ID },
      });
      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
    });

    it('404s on an unknown line', async () => {
      await expect(service.softDelete(TD_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
