import { BadRequestException } from '@nestjs/common';
import {
  AccVoucherHeader,
  DeviceType,
  Prisma,
  VoucherStatus,
} from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import {
  createAccountVoucherHeader,
  softDeleteAccountVoucherHeader,
  updateAccountVoucherHeader,
} from '../accountsModule/accountVoucherHeader/account-voucher-header.helper';
import { SaveOpeningStockDto } from './dto/save-opening-stock.dto';
import { ItemStockLedgerService } from './item-stock-ledger.service';
import { OpeningStockStatus } from './opening-stock.enums';
import { OpeningStockService } from './opening-stock.service';
jest.mock('../accountsModule/accountVoucherHeader/account-voucher-header.helper', () => ({
  createAccountVoucherHeader: jest.fn(),
  updateAccountVoucherHeader: jest.fn(),
  softDeleteAccountVoucherHeader: jest.fn(),
}));
const COMPANY_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0001';
const BRANCH_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0002';
const PARTY_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0003';
const USER_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0004';
const USER_NAME = 'admin.user';
const EMPLOYEE_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0005';
const ITEM_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0006';
const UNIT_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0007';
const BASE_UOM_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0008';
const GODOWN_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0009';
const TAX_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0010';
const VOUCHER_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0011';
const OPENING_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0012';
const DETAIL_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0013';
const SESSION_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0014';
const DEVICE_ID = '01960231-76f1-7ef5-bbb1-63d6f1df0015';
type OpeningStockTxMock = {
  openingStockHeader: {
    count: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
  };
  openingStockDetail: {
    createMany: jest.Mock;
    deleteMany: jest.Mock;
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
  itemMaster: {
    findMany: jest.Mock;
  };
  company: {
    findMany: jest.Mock;
  };
  branchMaster: {
    findMany: jest.Mock;
  };
  accLedgerMaster: {
    findMany: jest.Mock;
  };
  user: {
    findMany: jest.Mock;
  };
  unit: {
    findMany: jest.Mock;
  };
  itemPriceMaster: {
    findMany: jest.Mock;
  };
  godownLocation: {
    findMany: jest.Mock;
  };
  itemTaxMaster: {
    findMany: jest.Mock;
  };
};
type PrismaMock = OpeningStockTxMock & {
  $transaction: jest.Mock;
};
type AuditLogServiceMock = {
  logEntityChange: jest.Mock;
};
type RequestContextServiceMock = {
  getUserId: jest.Mock<string | null, []>;
};
type ItemStockLedgerServiceMock = {
  syncFromOpeningStockDocument: jest.Mock;
};
const makeSaveDto = (overrides: Partial<SaveOpeningStockDto> = {}): SaveOpeningStockDto => ({
  header: {
    osh_acc_year: '2025-2026',
    osh_company_id: COMPANY_ID,
    osh_branch_id: BRANCH_ID,
    avh_voucher_type_id: 7,
    osh_voucher_date: '2026-03-28T10:00:00.000Z',
    avh_party_id: PARTY_ID,
    osh_device_type: DeviceType.WEB,
    osh_counter_id: 'COUNTER-1',
    avh_employee_id: [EMPLOYEE_ID],
    osh_ref_no: 'PAYLOAD-REF-001',
    osh_narration: 'Opening stock import',
    osh_total_lines: 99,
    osh_total_qty: 123.456,
    osh_total_value: 789.01,
    avh_bill_date: '2026-03-28T10:00:00.000Z',
    osh_session_id: SESSION_ID,
    osh_device_id: DEVICE_ID,
    osh_user_id: USER_ID,
  },
  details: [
    {
      osl_barcode: '8901',
      osl_item_id: ITEM_ID,
      osl_unit_id: UNIT_ID,
      osl_base_uom_id: BASE_UOM_ID,
      osl_godown_id: GODOWN_ID,
      osl_tax_id: TAX_ID,
      osl_tax_perc: 18,
      osl_qty: 5,
      osl_free_qty: 1,
      osl_free_base_qty: 0,
      osl_conv_factor: 2,
      osl_cost_rate: 100,
      osl_cost_rate_wot: 84.75,
      osl_sale_rate_a_wot: 120,
      osl_markup_perc_a: 10,
      osl_sale_rate_a: 141.6,
      osl_sale_rate_b_wot: 121,
      osl_markup_perc_b: 11,
      osl_sale_rate_b: 142.6,
      osl_sale_rate_c_wot: 122,
      osl_markup_perc_c: 12,
      osl_sale_rate_c: 143.6,
      osl_sale_rate_d_wot: 123,
      osl_markup_perc_d: 13,
      osl_sale_rate_d: 144.6,
      osl_mrp_rate: 150,
      osl_min_rate: 130,
      osl_remarks: 'Line one',
    },
  ],
  ...overrides,
});
const makeVoucherHeaderRecord = (
  overrides: Partial<AccVoucherHeader> = {},
): AccVoucherHeader =>
  ({
    avhVoucherId: VOUCHER_ID,
    avhAccYear: '2025-2026',
    avhCompanyId: COMPANY_ID,
    avhBranchId: BRANCH_ID,
    avhVoucherTypeId: 7,
    avhVoucherNo: BigInt(11),
    avhVoucherSlno: BigInt(3),
    avhUserRefno: null,
    avhVoucherDate: new Date('2026-03-28T10:00:00.000Z'),
    avhVoucherRefno: 'OS-3',
    avhBillDate: null,
    avhBillRefno: 'BILL-001',
    avhBillAmount: new Prisma.Decimal('0'),
    avhAdjustAmount: new Prisma.Decimal('0'),
    avhTotalDebit: new Prisma.Decimal('0'),
    avhTotalCredit: new Prisma.Decimal('0'),
    avhPartyId: PARTY_ID,
    avhOppositeLedgerId: null,
    avhEmployeeId: [EMPLOYEE_ID],
    avhPayNotes: null,
    avhRemarks: null,
    avhVoucherStatus: VoucherStatus.DRAFT,
    avhStatusOn: null,
    avhStatusBy: null,
    avhCancelReason: null,
    avhUserId: USER_ID,
    user: {
      user_name: USER_NAME,
    },
    avhSessionId: null,
    avhDeviceType: DeviceType.WEB,
    avhDeviceId: null,
    avhCounterId: 'COUNTER-1',
    avhPrintCount: 0,
    avhWhatsappStatus: 'NA' as AccVoucherHeader['avhWhatsappStatus'],
    avhSmsStatus: 'NA' as AccVoucherHeader['avhSmsStatus'],
    avhTallyExportStatus: 'PENDING' as AccVoucherHeader['avhTallyExportStatus'],
    avhTallyExportedOn: null,
    avhTallyGuid: null,
    avhTallyErrorMsg: null,
    avhIsActive: true,
    avhIsDeleted: false,
    avhSyncDate: null,
    avhCreatedOn: new Date('2026-03-28T10:00:00.000Z'),
    avhCreatedBy: USER_ID,
    avhUpdatedOn: null,
    avhUpdatedBy: null,
    ...overrides,
  }) as AccVoucherHeader;
const makeOpeningHeaderWithVoucher = (voucherHeader: AccVoucherHeader, overrides: Record<string, unknown> = {}) =>
  ({
    oshId: OPENING_ID,
    oshVoucherId: voucherHeader.avhVoucherId,
    oshAccYear: voucherHeader.avhAccYear,
    oshCompanyId: voucherHeader.avhCompanyId,
    oshBranchId: voucherHeader.avhBranchId,
    oshVoucherNo: voucherHeader.avhVoucherNo,
    oshVoucherDate: voucherHeader.avhVoucherDate,
    oshRefNo: voucherHeader.avhVoucherRefno,
    oshNarration: 'Opening stock import',
    oshTotalLines: 1,
    oshTotalQty: new Prisma.Decimal('5.000000'),
    oshTotalValue: new Prisma.Decimal('500.00'),
    oshStatus: OpeningStockStatus.DRAFT,
    oshUserId: USER_ID,
    oshSessionId: null,
    oshDeviceType: 'WEB',
    oshDeviceId: null,
    oshCounterId: 'COUNTER-1',
    oshIsActive: true,
    oshIsDeleted: false,
    oshSyncDate: null,
    oshCreatedOn: new Date('2026-03-28T10:00:00.000Z'),
    oshCreatedBy: USER_ID,
    oshUpdatedOn: null,
    oshUpdatedBy: null,
    voucherHeader,
    ...overrides,
  }) as any;
const makeDetailRecord = (overrides: Record<string, unknown> = {}) =>
  ({
    oslId: DETAIL_ID,
    oslVoucherId: VOUCHER_ID,
    oslOpeningId: OPENING_ID,
    oslLineNo: 1,
    oslAccYear: '2025-2026',
    oslCompanyId: COMPANY_ID,
    oslBranchId: BRANCH_ID,
    oslItemId: ITEM_ID,
    oslUnitId: UNIT_ID,
    oslBaseUomId: BASE_UOM_ID,
    oslGodownId: GODOWN_ID,
    oslTrackingType: 'NONE',
    oslBatchId: null,
    oslBarcode: '8901',
    oslBatchNo: null,
    oslMfgBatchNo: null,
    oslBatchDate: null,
    oslMfgDate: null,
    oslExpiryDate: null,
    oslSerialNo: null,
    oslQty: new Prisma.Decimal('5.000000'),
    oslBaseQty: new Prisma.Decimal('10.000000'),
    oslFreeQty: new Prisma.Decimal('1.000000'),
    oslFreeBaseQty: new Prisma.Decimal('2.000000'),
    oslConvFactor: new Prisma.Decimal('2.000000'),
    oslTaxId: TAX_ID,
    oslTaxPerc: new Prisma.Decimal('18.000'),
    oslCessType: 'NONE',
    oslCessPerc: new Prisma.Decimal('0.000'),
    oslCessPerUnit: new Prisma.Decimal('0.000000'),
    oslCostRate: new Prisma.Decimal('100.000000'),
    oslCostRateWot: new Prisma.Decimal('84.750000'),
    oslStockValue: new Prisma.Decimal('500.00'),
    oslStockValueWot: new Prisma.Decimal('423.75'),
    oslMrpRate: new Prisma.Decimal('150.000000'),
    oslMinRate: new Prisma.Decimal('130.000000'),
    oslSaleRateA: new Prisma.Decimal('141.600000'),
    oslSaleRateB: new Prisma.Decimal('142.600000'),
    oslSaleRateC: new Prisma.Decimal('143.600000'),
    oslSaleRateD: new Prisma.Decimal('144.600000'),
    oslSaleRateAWot: new Prisma.Decimal('120.000000'),
    oslSaleRateBWot: new Prisma.Decimal('121.000000'),
    oslSaleRateCWot: new Prisma.Decimal('122.000000'),
    oslSaleRateDWot: new Prisma.Decimal('123.000000'),
    oslMarkupPercA: new Prisma.Decimal('10.000'),
    oslMarkupPercB: new Prisma.Decimal('11.000'),
    oslMarkupPercC: new Prisma.Decimal('12.000'),
    oslMarkupPercD: new Prisma.Decimal('13.000'),
    oslRemarks: 'Line one',
    oslIsActive: true,
    oslIsDeleted: false,
    oslSyncDate: null,
    oslCreatedOn: new Date('2026-03-28T10:00:00.000Z'),
    oslCreatedBy: USER_ID,
    oslUpdatedOn: null,
    oslUpdatedBy: null,
    ...overrides,
  }) as any;
describe('OpeningStockService', () => {
  let service: OpeningStockService;
  let tx: OpeningStockTxMock;
  let prisma: PrismaMock;
  let auditLogService: AuditLogServiceMock;
  let requestContextService: RequestContextServiceMock;
  let itemStockLedgerService: ItemStockLedgerServiceMock;
  beforeEach(() => {
    tx = {
      openingStockHeader: {
        count: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      openingStockDetail: {
        createMany: jest.fn(),
        deleteMany: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
      itemMaster: {
        findMany: jest.fn(),
      },
      company: {
        findMany: jest.fn(),
      },
      branchMaster: {
        findMany: jest.fn(),
      },
      accLedgerMaster: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn(),
      },
      unit: {
        findMany: jest.fn(),
      },
      itemPriceMaster: {
        findMany: jest.fn(),
      },
      godownLocation: {
        findMany: jest.fn(),
      },
      itemTaxMaster: {
        findMany: jest.fn(),
      },
    };
    prisma = {
      ...tx,
      $transaction: jest.fn(async (callback: (client: unknown) => Promise<unknown>) =>
        callback(tx),
      ),
    };
    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };
    requestContextService = {
      getUserId: jest.fn().mockReturnValue(USER_ID),
    };
    itemStockLedgerService = {
      syncFromOpeningStockDocument: jest.fn().mockResolvedValue({
        itemStockLedger: [],
        itemStockBalance: [],
        itemBatchStock: [],
      }),
    };
    service = new OpeningStockService(
      prisma as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      requestContextService as unknown as RequestContextService,
      itemStockLedgerService as unknown as ItemStockLedgerService,
    );
    tx.itemMaster.findMany.mockResolvedValue([
      {
        itemId: ITEM_ID,
        itemCode: 'ITEM-001',
        itemNameEn: 'Opening Item',
      },
    ]);
    tx.company.findMany.mockResolvedValue([
      {
        compId: COMPANY_ID,
      },
    ]);
    tx.branchMaster.findMany.mockResolvedValue([
      {
        brId: BRANCH_ID,
      },
    ]);
    tx.accLedgerMaster.findMany.mockResolvedValue([
      {
        ledId: PARTY_ID,
      },
    ]);
    tx.user.findMany.mockResolvedValue([
      {
        user_id: USER_ID,
      },
    ]);
    tx.unit.findMany.mockResolvedValue([
      {
        unit_id: UNIT_ID,
        unit_name: 'PCS',
      },
    ]);
    tx.itemPriceMaster.findMany.mockResolvedValue([
      {
        ipmId: BASE_UOM_ID,
        unit: {
          unit_name: 'BOX',
        },
        baseUnit: {
          unit_name: 'BOX',
        },
      },
    ]);
    tx.godownLocation.findMany.mockResolvedValue([
      {
        gdlId: GODOWN_ID,
        gdlName: 'Main Godown',
      },
    ]);
    tx.itemTaxMaster.findMany.mockResolvedValue([
      {
        taxId: TAX_ID,
        taxName: 'GST 18%',
      },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });
  it('creates opening stock by creating voucher header first and linking header/detail rows', async () => {
    const voucherHeader = makeVoucherHeaderRecord();
    (createAccountVoucherHeader as jest.MockedFunction<typeof createAccountVoucherHeader>).mockResolvedValue(
      voucherHeader,
    );
    tx.openingStockHeader.create.mockResolvedValue(makeOpeningHeaderWithVoucher(voucherHeader));
    tx.openingStockHeader.findFirst.mockResolvedValue(makeOpeningHeaderWithVoucher(voucherHeader));
    tx.openingStockDetail.createMany.mockResolvedValue({ count: 1 });
    tx.openingStockDetail.findMany.mockResolvedValue([makeDetailRecord()]);
    const result = await service.save(makeSaveDto());
    expect(createAccountVoucherHeader).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        avhAccYear: '2025-2026',
        avhPartyId: PARTY_ID,
        avhVoucherDate: new Date('2026-03-28T10:00:00.000Z'),
        avhBillDate: new Date('2026-03-28T10:00:00.000Z'),
        avhBillAmount: 789.01,
        avhTotalDebit: 789.01,
        avhUserRefno: null,
        avhPayNotes: null,
        avhRemarks: null,
        avhUserId: USER_ID,
        avhSessionId: SESSION_ID,
        avhDeviceType: DeviceType.WEB,
        avhDeviceId: DEVICE_ID,
        avhCounterId: 'COUNTER-1',
      }),
    );
    expect(tx.openingStockHeader.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        oshVoucherId: VOUCHER_ID,
        oshVoucherNo: BigInt(11),
        oshVoucherDate: new Date('2026-03-28T10:00:00.000Z'),
        oshRefNo: 'OS-3',
        oshTotalLines: 99,
        oshTotalQty: 123.456,
        oshTotalValue: 789.01,
        oshSessionId: SESSION_ID,
        oshDeviceType: 'WEB',
        oshDeviceId: DEVICE_ID,
        oshCounterId: 'COUNTER-1',
      }),
    });
    expect(tx.openingStockDetail.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          oslVoucherId: VOUCHER_ID,
          oslOpeningId: OPENING_ID,
          oslItemId: ITEM_ID,
          oslFreeBaseQty: 2,
        }),
      ],
    });
    expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'New',
        tableName: 'opening stock header',
        screenName: 'Opening Stock',
        screenType: 'transaction',
        pk: VOUCHER_ID,
        userId: USER_ID,
        branchId: BRANCH_ID,
        notes: 'Opening stock created',
      }),
      tx,
    );
    expect(result.header.avh_voucher_id).toBe(VOUCHER_ID);
    expect(result.details[0].osl_item_name).toBe('Opening Item');
    expect(result.details[0].osl_base_uom_name).toBe('BOX');
    expect(result.details[0].osl_free_base_qty).toBe(2);
  });

  it('updates opening stock by voucher id and replaces existing detail rows', async () => {
    const existingVoucherHeader = makeVoucherHeaderRecord();
    const updatedVoucherHeader = makeVoucherHeaderRecord({
      avhVoucherRefno: 'OS-4',
      avhVoucherNo: BigInt(12),
    });

    (updateAccountVoucherHeader as jest.MockedFunction<typeof updateAccountVoucherHeader>).mockResolvedValue(
      updatedVoucherHeader,
    );
    tx.openingStockHeader.findFirst
      .mockResolvedValueOnce(makeOpeningHeaderWithVoucher(existingVoucherHeader))
      .mockResolvedValueOnce(makeOpeningHeaderWithVoucher(existingVoucherHeader))
      .mockResolvedValueOnce(makeOpeningHeaderWithVoucher(updatedVoucherHeader));
    tx.openingStockHeader.update.mockResolvedValue(makeOpeningHeaderWithVoucher(updatedVoucherHeader));
    tx.openingStockDetail.findMany.mockResolvedValue([makeDetailRecord()]);
    tx.openingStockDetail.deleteMany.mockResolvedValue({ count: 1 });
    tx.openingStockDetail.createMany.mockResolvedValue({ count: 1 });

    await service.save(
      makeSaveDto({
        header: {
          ...makeSaveDto().header,
          avh_voucher_id: VOUCHER_ID,
        },
      }),
    );

    expect(updateAccountVoucherHeader).toHaveBeenCalledWith(
      tx,
      VOUCHER_ID,
      expect.objectContaining({
        avhVoucherTypeId: 7,
        avhVoucherDate: new Date('2026-03-28T10:00:00.000Z'),
        avhBillDate: new Date('2026-03-28T10:00:00.000Z'),
        avhBillAmount: 789.01,
        avhTotalDebit: 789.01,
        avhUserRefno: null,
        avhPayNotes: null,
        avhRemarks: null,
        avhUserId: USER_ID,
        avhSessionId: SESSION_ID,
        avhDeviceType: DeviceType.WEB,
        avhDeviceId: DEVICE_ID,
        avhCounterId: 'COUNTER-1',
      }),
    );
    expect(tx.openingStockHeader.update).toHaveBeenCalledWith({
      where: {
        oshId: OPENING_ID,
      },
      data: expect.objectContaining({
        oshVoucherDate: new Date('2026-03-28T10:00:00.000Z'),
        oshRefNo: 'OS-4',
        oshTotalLines: 99,
        oshTotalQty: 123.456,
        oshTotalValue: 789.01,
        oshSessionId: SESSION_ID,
        oshDeviceType: 'WEB',
        oshDeviceId: DEVICE_ID,
        oshCounterId: 'COUNTER-1',
      }),
    });
    expect(tx.openingStockDetail.deleteMany).toHaveBeenCalledWith({
      where: {
        oslVoucherId: VOUCHER_ID,
      },
    });
    expect(tx.openingStockDetail.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          oslVoucherId: VOUCHER_ID,
          oslOpeningId: OPENING_ID,
        }),
      ],
    });
    expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        tableName: 'opening stock header',
        screenName: 'Opening Stock',
        screenType: 'transaction',
        pk: VOUCHER_ID,
        userId: USER_ID,
        branchId: BRANCH_ID,
        notes: 'Opening stock updated',
      }),
      tx,
    );
  });

  it('uses request audit notes when updating opening stock', async () => {
    const existingVoucherHeader = makeVoucherHeaderRecord();
    const updatedVoucherHeader = makeVoucherHeaderRecord({
      avhVoucherRefno: 'OS-4',
      avhVoucherNo: BigInt(12),
    });

    (updateAccountVoucherHeader as jest.MockedFunction<typeof updateAccountVoucherHeader>).mockResolvedValue(
      updatedVoucherHeader,
    );
    tx.openingStockHeader.findFirst
      .mockResolvedValueOnce(makeOpeningHeaderWithVoucher(existingVoucherHeader))
      .mockResolvedValueOnce(makeOpeningHeaderWithVoucher(existingVoucherHeader))
      .mockResolvedValueOnce(makeOpeningHeaderWithVoucher(updatedVoucherHeader));
    tx.openingStockHeader.update.mockResolvedValue(makeOpeningHeaderWithVoucher(updatedVoucherHeader));
    tx.openingStockDetail.findMany.mockResolvedValue([makeDetailRecord()]);
    tx.openingStockDetail.deleteMany.mockResolvedValue({ count: 1 });
    tx.openingStockDetail.createMany.mockResolvedValue({ count: 1 });

    await service.save(
      makeSaveDto({
        header: {
          ...makeSaveDto().header,
          avh_voucher_id: VOUCHER_ID,
        },
        audit_notes: 'Adjusted opening stock after audit recount',
      }),
    );

    expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: 'Adjusted opening stock after audit recount',
      }),
      tx,
    );
  });

  it('soft deletes opening stock by avh_voucher_id', async () => {
    const voucherHeader = makeVoucherHeaderRecord();
    (softDeleteAccountVoucherHeader as jest.MockedFunction<typeof softDeleteAccountVoucherHeader>).mockResolvedValue(
      makeVoucherHeaderRecord({
        avhIsDeleted: true,
        avhIsActive: false,
        avhVoucherStatus: VoucherStatus.CANCELLED,
      }),
    );
    tx.openingStockHeader.findFirst
      .mockResolvedValueOnce(makeOpeningHeaderWithVoucher(voucherHeader))
      .mockResolvedValueOnce(makeOpeningHeaderWithVoucher(voucherHeader));
    tx.openingStockDetail.findMany.mockResolvedValue([makeDetailRecord()]);
    tx.openingStockHeader.update.mockResolvedValue(
      makeOpeningHeaderWithVoucher(voucherHeader, {
        oshIsDeleted: true,
        oshIsActive: false,
        oshStatus: OpeningStockStatus.CANCELLED,
      }),
    );
    tx.openingStockDetail.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.softDelete(VOUCHER_ID);

    expect(softDeleteAccountVoucherHeader).toHaveBeenCalledWith(
      tx,
      VOUCHER_ID,
      expect.objectContaining({
        avhUpdatedBy: USER_ID,
      }),
    );
    expect(tx.openingStockDetail.updateMany).toHaveBeenCalledWith({
      where: {
        oslVoucherId: VOUCHER_ID,
        oslIsDeleted: false,
      },
      data: expect.objectContaining({
        oslIsDeleted: true,
      }),
    });
    expect(itemStockLedgerService.syncFromOpeningStockDocument).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        header: expect.objectContaining({
          avh_voucher_id: VOUCHER_ID,
          osh_status: OpeningStockStatus.CANCELLED,
          osh_is_active: false,
          osh_is_deleted: true,
        }),
        details: [
          expect.objectContaining({
            osl_voucher_id: VOUCHER_ID,
            osl_is_active: false,
            osl_is_deleted: true,
          }),
        ],
      }),
      expect.objectContaining({
        header: expect.objectContaining({
          avh_voucher_id: VOUCHER_ID,
          osh_is_deleted: false,
        }),
      }),
    );
    expect(result).toEqual({
      avh_voucher_id: VOUCHER_ID,
      deleted: true,
    });
    expect(auditLogService.logEntityChange).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'cancel',
        tableName: 'opening stock header',
        screenName: 'Opening Stock',
        screenType: 'transaction',
        pk: VOUCHER_ID,
        userId: USER_ID,
        branchId: BRANCH_ID,
        notes: 'Opening stock deleted',
      }),
      tx,
    );
  });

  it('gets opening stock by voucher id with enriched detail labels', async () => {
    const voucherHeader = makeVoucherHeaderRecord();
    prisma.openingStockHeader.findFirst.mockResolvedValue(makeOpeningHeaderWithVoucher(voucherHeader));
    prisma.openingStockDetail.findMany.mockResolvedValue([makeDetailRecord()]);

    const result = await service.getByVoucherId(VOUCHER_ID);

    expect(result.header.avh_voucher_id).toBe(VOUCHER_ID);
    expect(result.header.avh_user_name).toBe(USER_NAME);
    expect(result.header.osh_user_name).toBe(USER_NAME);
    expect(result.details[0]).toEqual(
      expect.objectContaining({
        osl_item_code: 'ITEM-001',
        osl_item_name: 'Opening Item',
        osl_unit_name: 'PCS',
        osl_base_uom_name: 'BOX',
        osl_godown_name: 'Main Godown',
        osl_tax_name: 'GST 18%',
      }),
    );
  });

  it('gets opening stock by voucher ref no with scoped filters', async () => {
    const voucherHeader = makeVoucherHeaderRecord();
    prisma.openingStockHeader.findFirst.mockResolvedValue(makeOpeningHeaderWithVoucher(voucherHeader));
    prisma.openingStockDetail.findMany.mockResolvedValue([makeDetailRecord()]);

    const result = await service.getByVoucherRefNo({
      avh_voucher_refno: 'os-3',
      osh_acc_year: '2025-2026',
      osh_company_id: COMPANY_ID,
      osh_branch_id: BRANCH_ID,
      date_from: '2026-03-01T00:00:00.000Z',
      date_to: '2026-03-31T23:59:59.999Z',
    });

    expect(prisma.openingStockHeader.findFirst).toHaveBeenCalledWith({
      where: {
        oshIsDeleted: false,
        oshAccYear: '2025-2026',
        oshCompanyId: COMPANY_ID,
        oshBranchId: BRANCH_ID,
        oshVoucherDate: {
          gte: new Date('2026-03-01T00:00:00.000Z'),
          lte: new Date('2026-03-31T23:59:59.999Z'),
        },
        voucherHeader: {
          is: {
            avhVoucherRefno: {
              equals: 'os-3',
              mode: 'insensitive',
            },
          },
        },
      },
      include: {
        voucherHeader: {
          include: {
            user: {
              select: {
                user_name: true,
              },
            },
          },
        },
      },
      orderBy: [{ oshVoucherDate: 'desc' }, { oshVoucherNo: 'desc' }, { oshId: 'desc' }],
    });
    expect(result.header.avh_voucher_refno).toBe('OS-3');
    expect(result.header.avh_user_name).toBe(USER_NAME);
    expect(result.details[0].osl_item_name).toBe('Opening Item');
  });

  it('lists opening stock headers with resolved user names', async () => {
    const voucherHeader = makeVoucherHeaderRecord();
    prisma.openingStockHeader.count.mockResolvedValue(1);
    prisma.openingStockHeader.findMany.mockResolvedValue([makeOpeningHeaderWithVoucher(voucherHeader)]);

    const result = await service.list({
      page: 1,
      limit: 20,
      search: 'OS-3',
    });

    expect(prisma.openingStockHeader.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          voucherHeader: {
            include: {
              user: {
                select: {
                  user_name: true,
                },
              },
            },
          },
        },
        skip: 0,
        take: 20,
      }),
    );
    expect(result.items[0]).toMatchObject({
      avh_user_id: USER_ID,
      avh_user_name: USER_NAME,
      osh_user_id: USER_ID,
      osh_user_name: USER_NAME,
    });
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 1,
      total_pages: 1,
    });
  });

  it('rejects save when detail rows are empty', async () => {
    await expect(
      service.save({
        ...makeSaveDto(),
        details: [],
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects save with a field-level error when company id is invalid', async () => {
    tx.company.findMany.mockResolvedValue([]);

    try {
      await service.save(makeSaveDto());
      fail('Expected save to throw BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(createAccountVoucherHeader).not.toHaveBeenCalled();
      expect((error as BadRequestException).getResponse()).toMatchObject({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'osh_company_id',
            message: `Invalid osh_company_id reference: ${COMPANY_ID}`,
          },
        ],
      });
    }
  });

  it('rejects save when expiry date is earlier than manufacturing date', async () => {
    try {
      await service.save(
        makeSaveDto({
          details: [
            {
              ...makeSaveDto().details[0],
              osl_mfg_date: '2026-04-23T00:00:00.000Z',
              osl_expiry_date: '2026-04-20T00:00:00.000Z',
            },
          ],
        }),
      );
      fail('Expected save to throw BadRequestException');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect(createAccountVoucherHeader).not.toHaveBeenCalled();
      expect(itemStockLedgerService.syncFromOpeningStockDocument).not.toHaveBeenCalled();
      expect((error as BadRequestException).getResponse()).toMatchObject({
        success: false,
        message: 'Validation failed',
        errors: [
          {
            field: 'details[0].osl_expiry_date',
            message: 'osl_expiry_date must be greater than or equal to osl_mfg_date',
          },
        ],
      });
    }
  });
});
