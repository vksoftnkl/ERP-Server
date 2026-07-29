import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, SaleChargeDetail } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ChargeDetailService } from './charge-detail.service';
import { ChargeDocType, ChargeMethod } from './types/charge-detail-api.types';
import { SaveChargeDetailDto } from './dto/save-charge-detail.dto';

const CD_ID = '019c6f6c-be87-7a11-8905-36092c46ff01';
const DOC_ID = '019c6f6c-be87-7a11-8905-36092c46ff02';
const OTHER_DOC_ID = '019c6f6c-be87-7a11-8905-36092c46ff03';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46ff04';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46ff05';
const CHARGE_ID = '019c6f6c-be87-7a11-8905-36092c46ff06';
const LEDGER_ID = '019c6f6c-be87-7a11-8905-36092c46ff07';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46ff08';
const ACC_YEAR = '2026-2027';

const makeCharge = (overrides: Partial<SaleChargeDetail> = {}): SaleChargeDetail =>
  ({
    cdId: CD_ID,
    cdDocType: 'QUOTATION',
    cdDocId: DOC_ID,
    cdSlno: 1,
    cdCompId: COMPANY_ID,
    cdBranchId: BRANCH_ID,
    cdAccYear: ACC_YEAR,
    cdVoucherNo: 42n,
    cdChgId: CHARGE_ID,
    cdChgName: 'Freight',
    cdRole: 'FREIGHT',
    cdMethod: 'FIXED',
    cdType: 'ADD',
    cdApplyOn: 'FLAT',
    cdLedgerCode: LEDGER_ID,
    cdLandingCost: false,
    cdCostAlloc: null,
    cdBeforeTax: false,
    cdTaxApl: false,
    cdSepPost: false,
    cdUnit: null,
    cdQtyVal: null,
    cdWeight: null,
    cdRate: new Prisma.Decimal('0.0000'),
    cdAmount: new Prisma.Decimal('500.0000'),
    cdTaxCode: null,
    cdHsn: null,
    cdTaxPerc: null,
    cdTaxAmt: null,
    cdSgstPerc: null,
    cdSgstAmt: null,
    cdCgstPerc: null,
    cdCgstAmt: null,
    cdIgstPerc: null,
    cdIgstAmt: null,
    cdCessPerc: null,
    cdCessAmt: null,
    cdNetAmt: new Prisma.Decimal('500.0000'),
    cdRemarks: null,
    cdIsActive: true,
    cdIsDeleted: false,
    cdSyncDate: null,
    cdCreatedOn: new Date('2026-07-28T10:00:00.000Z'),
    cdCreatedBy: USER_ID,
    cdModifiedOn: null,
    cdModifiedBy: null,
    ...overrides,
  }) as SaleChargeDetail;

const createDto = (overrides: Partial<SaveChargeDetailDto> = {}): SaveChargeDetailDto =>
  ({
    cdDocType: ChargeDocType.QUOTATION,
    cdDocId: DOC_ID,
    cdCompId: COMPANY_ID,
    cdBranchId: BRANCH_ID,
    cdAccYear: ACC_YEAR,
    cdChgId: CHARGE_ID,
    cdLedgerCode: LEDGER_ID,
    ...overrides,
  }) as SaveChargeDetailDto;

type ChargeCreateArgs = { data: Prisma.SaleChargeDetailUncheckedCreateInput };
type ChargeUpdateArgs = {
  where: { cdId: string };
  data: Prisma.SaleChargeDetailUncheckedUpdateInput;
};

type PrismaMock = {
  saleChargeDetail: {
    findFirst: jest.Mock<Promise<SaleChargeDetail | null>, unknown[]>;
    findMany: jest.Mock<Promise<SaleChargeDetail[]>, unknown[]>;
    aggregate: jest.Mock<Promise<{ _max: { cdSlno: number | null } }>, unknown[]>;
    create: jest.Mock<Promise<SaleChargeDetail>, [ChargeCreateArgs]>;
    update: jest.Mock<Promise<SaleChargeDetail>, [ChargeUpdateArgs]>;
    updateMany: jest.Mock<Promise<Prisma.BatchPayload>, unknown[]>;
  };
  chargeMaster: { findFirst: jest.Mock<Promise<{ chgId: string } | null>, unknown[]> };
  accLedgerMaster: { findFirst: jest.Mock<Promise<{ ledName: string } | null>, unknown[]> };
  $transaction: jest.Mock<Promise<unknown>, [(tx: PrismaMock) => Promise<unknown>]>;
};

describe('ChargeDetailService', () => {
  let service: ChargeDetailService;
  let prisma: PrismaMock;
  let auditLogService: { logEntityChange: jest.Mock };

  beforeEach(() => {
    prisma = {
      saleChargeDetail: {
        // Default: the line looked up by id / the slno clash probe finds nothing.
        findFirst: jest.fn(() => Promise.resolve(null)),
        findMany: jest.fn(() => Promise.resolve([makeCharge()])),
        aggregate: jest.fn(() => Promise.resolve({ _max: { cdSlno: null } })),
        create: jest.fn(({ data }: ChargeCreateArgs) =>
          Promise.resolve(makeCharge(data as unknown as Partial<SaleChargeDetail>)),
        ),
        update: jest.fn(({ where, data }: ChargeUpdateArgs) =>
          Promise.resolve(
            makeCharge({ ...(data as unknown as Partial<SaleChargeDetail>), cdId: where.cdId }),
          ),
        ),
        updateMany: jest.fn(() => Promise.resolve({ count: 1 })),
      },
      chargeMaster: { findFirst: jest.fn(() => Promise.resolve({ chgId: CHARGE_ID })) },
      accLedgerMaster: { findFirst: jest.fn(() => Promise.resolve({ ledName: 'Freight Inward' })) },
      $transaction: jest.fn((cb: (tx: PrismaMock) => Promise<unknown>) => cb(prisma)),
    };
    auditLogService = { logEntityChange: jest.fn(() => Promise.resolve(undefined)) };
    service = new ChargeDetailService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
  });

  describe('create', () => {
    it('stores the document scope, assigns the next line number and echoes the ledger name', async () => {
      prisma.saleChargeDetail.aggregate.mockResolvedValueOnce({ _max: { cdSlno: 3 } });

      const payload = await service.save(
        createDto({ cdChgName: 'Freight', cdVoucherNo: '42', cdAmount: 500 }),
      );

      expect(prisma.saleChargeDetail.create.mock.calls[0][0].data).toMatchObject({
        cdDocType: 'QUOTATION',
        cdDocId: DOC_ID,
        cdSlno: 4,
        cdCompId: COMPANY_ID,
        cdBranchId: BRANCH_ID,
        cdAccYear: ACC_YEAR,
        cdVoucherNo: 42n,
        cdChgId: CHARGE_ID,
        cdLedgerCode: LEDGER_ID,
        cdChgName: 'Freight',
        cdAmount: 500,
      });
      expect(payload.cdLedgerName).toBe('Freight Inward');
      expect(payload.cdVoucherNo).toBe('42');
      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
    });

    it('requires the references a new line cannot be created without', async () => {
      await expect(service.save(createDto({ cdChgId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ cdDocId: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.save(createDto({ cdAccYear: undefined }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prisma.saleChargeDetail.create).not.toHaveBeenCalled();
    });

    it('rejects a soft-deleted ledger or charge master', async () => {
      prisma.accLedgerMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);

      prisma.chargeMaster.findFirst.mockResolvedValueOnce(null);
      await expect(service.save(createDto())).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleChargeDetail.create).not.toHaveBeenCalled();
    });

    it('rejects a line number already used on the same document', async () => {
      prisma.saleChargeDetail.findFirst.mockResolvedValueOnce(makeCharge({ cdId: CD_ID }));
      await expect(service.save(createDto({ cdSlno: 1 }))).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('rejects the two mutually exclusive tax flags together (ck_cd_tax_apl)', async () => {
      await expect(
        service.save(createDto({ cdTaxApl: true, cdBeforeTax: true })),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a value outside the snapshot enum sets', async () => {
      // Forced past ChargeMethod: the DTO's @IsEnum stops this on the HTTP path,
      // this asserts the service guard catches it for any other caller.
      const notAMethod = 'SLAB' as unknown as ChargeMethod;
      await expect(service.save(createDto({ cdMethod: notAMethod }))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    beforeEach(() => {
      prisma.saleChargeDetail.findFirst.mockImplementation(() => Promise.resolve(makeCharge()));
    });

    it('keeps the stored scope and only writes what was sent', async () => {
      await service.save({ cdId: CD_ID, cdAmount: 750 } as SaveChargeDetailDto);

      const { where, data } = prisma.saleChargeDetail.update.mock.calls[0][0];
      expect(where).toEqual({ cdId: CD_ID });
      expect(data).toMatchObject({
        cdChgId: CHARGE_ID,
        cdLedgerCode: LEDGER_ID,
        cdSlno: 1,
        cdAmount: 750,
      });
      expect(data).not.toHaveProperty('cdDocType');
      expect(data).not.toHaveProperty('cdDocId');
    });

    it('refuses to move a saved line onto another document', async () => {
      await expect(
        service.save({ cdId: CD_ID, cdDocId: OTHER_DOC_ID } as SaveChargeDetailDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.save({ cdId: CD_ID, cdDocType: 'INVOICE' } as SaveChargeDetailDto),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.saleChargeDetail.update).not.toHaveBeenCalled();
    });

    it('judges the tax flags on the merged row, not the payload alone', async () => {
      prisma.saleChargeDetail.findFirst.mockImplementation(() =>
        Promise.resolve(makeCharge({ cdBeforeTax: true })),
      );
      await expect(
        service.save({ cdId: CD_ID, cdTaxApl: true } as SaveChargeDetailDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('404s when the line does not exist or is already deleted', async () => {
      prisma.saleChargeDetail.findFirst.mockImplementation(() => Promise.resolve(null));
      await expect(service.save({ cdId: CD_ID } as SaveChargeDetailDto)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('get', () => {
    it('reads one line by id', async () => {
      prisma.saleChargeDetail.findFirst.mockResolvedValueOnce(makeCharge());
      const payload = await service.get({ cdId: CD_ID });
      expect(Array.isArray(payload)).toBe(false);
      expect(prisma.saleChargeDetail.findFirst.mock.calls[0][0]).toMatchObject({
        where: { cdId: CD_ID, cdIsDeleted: false },
      });
    });

    it("reads a document's lines by the discriminator pair, excluding deleted rows", async () => {
      const payload = await service.get({ cdDocType: ChargeDocType.QUOTATION, cdDocId: DOC_ID });
      expect(Array.isArray(payload)).toBe(true);
      expect(prisma.saleChargeDetail.findMany.mock.calls[0][0]).toMatchObject({
        where: { cdDocType: 'QUOTATION', cdDocId: DOC_ID, cdIsDeleted: false },
      });
    });

    it('filters on cd_is_active only when asked', async () => {
      await service.get({ cdDocType: ChargeDocType.QUOTATION, cdDocId: DOC_ID, isActive: true });
      expect(prisma.saleChargeDetail.findMany.mock.calls[0][0]).toMatchObject({
        where: { cdIsActive: true },
      });
    });

    it('rejects an ambiguous or empty lookup', async () => {
      await expect(service.get({ cdId: CD_ID, cdDocId: DOC_ID })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.get({ cdDocType: ChargeDocType.QUOTATION })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.get({})).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('softDelete', () => {
    it('flags the row deleted and inactive, and audits the change', async () => {
      prisma.saleChargeDetail.findFirst.mockResolvedValueOnce(makeCharge());

      const result = await service.softDelete(CD_ID);

      expect(result).toEqual({ cdId: CD_ID, deleted: true });
      expect(prisma.saleChargeDetail.updateMany.mock.calls[0][0]).toMatchObject({
        where: { cdId: CD_ID, cdIsDeleted: false },
        data: { cdIsDeleted: true, cdIsActive: false, cdModifiedBy: USER_ID },
      });
      expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
    });

    it('404s on an unknown line', async () => {
      await expect(service.softDelete(CD_ID)).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
