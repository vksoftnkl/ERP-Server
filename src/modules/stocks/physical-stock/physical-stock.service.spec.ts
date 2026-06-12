import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { CreatePhysicalStockDto } from './dto/create-physical-stock.dto';
import { PhysicalStockService } from './physical-stock.service';
const COMPANY_ID = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1';
const BRANCH_ID = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac2';
const GODOWN_ID = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac3';
const USER_ID = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac4';
const ITEM_ID = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac5';
const UNIT_ID = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac6';
const HEADER_ID = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac7';
const DETAIL_ID = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac8';
describe('PhysicalStockService', () => {
  let service: PhysicalStockService;
  let prisma: {
    $transaction: jest.Mock;
    physicalStockHeader: { findFirst: jest.Mock };
  };
  let tx: {
    company: { findFirst: jest.Mock };
    branchMaster: { findFirst: jest.Mock };
    godownLocation: { findFirst: jest.Mock };
    physicalStockHeader: { create: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    physicalStockDetail: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      findMany: jest.Mock;
      updateMany: jest.Mock;
    };
    physicalStockBatchDetail: {
      create: jest.Mock;
      deleteMany: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  beforeEach(async () => {
    tx = {
      company: {
        findFirst: jest.fn().mockResolvedValue({ compId: COMPANY_ID }),
      },
      branchMaster: {
        findFirst: jest.fn().mockResolvedValue({ brId: BRANCH_ID }),
      },
      godownLocation: {
        findFirst: jest.fn().mockResolvedValue({ gdlId: GODOWN_ID }),
      },
      physicalStockHeader: {
        create: jest.fn().mockResolvedValue({ psId: HEADER_ID }),
        findFirst: jest.fn((args?: { include?: unknown }) =>
          Promise.resolve(args?.include ? makeDocumentRecord() : makeHeaderRecord()),
        ),
        update: jest.fn().mockResolvedValue(makeHeaderRecord()),
      },
      physicalStockDetail: {
        create: jest.fn().mockResolvedValue({ psdId: DETAIL_ID }),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        findMany: jest.fn().mockResolvedValue([{ psdId: DETAIL_ID }]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      physicalStockBatchDetail: {
        create: jest.fn().mockResolvedValue({}),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    prisma = {
      $transaction: jest.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
      physicalStockHeader: tx.physicalStockHeader,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhysicalStockService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuditLogService,
          useValue: { logEntityChange: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    service = module.get<PhysicalStockService>(PhysicalStockService);
  });
  it('should be defined', () => {
    expect(service).toBeDefined();
  });
  it('rejects an inactive or missing company before creating the header', async () => {
    tx.company.findFirst.mockResolvedValue(null);
    await expect(service.create(makeCreateDto())).rejects.toMatchObject({
      response: {
        message: 'Validation failed',
        errors: expect.arrayContaining([
          {
            field: 'psCompanyId',
            message: `No active company found with id ${COMPANY_ID}`,
          },
        ]),
      },
    });
    expect(tx.physicalStockHeader.create).not.toHaveBeenCalled();
  });
  it('maps physical stock header company FK errors to a bad request', async () => {
    tx.physicalStockHeader.create.mockRejectedValue({
      code: 'P2003',
      meta: {
        constraint: 'fk_physical_stock_header_company',
      },
    });
    await expect(service.create(makeCreateDto())).rejects.toMatchObject({
      response: {
        message: 'Validation failed',
        errors: [
          {
            field: 'psCompanyId',
            message: 'Referenced master record was not found or is inactive',
          },
        ],
      },
    });
  });
  it('saves as a new document when psId is not provided', async () => {
    await service.save(makeCreateDto());
    expect(tx.physicalStockHeader.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        psCompanyId: COMPANY_ID,
        psBranchId: BRANCH_ID,
        psGodownId: GODOWN_ID,
      }),
    });
    expect(tx.physicalStockHeader.update).not.toHaveBeenCalled();
  });
  it('saves as an update when psId is provided', async () => {
    await service.save({
      ...makeCreateDtoWithRows(),
      psId: HEADER_ID,
    });
    expect(tx.physicalStockHeader.create).not.toHaveBeenCalled();
    expect(tx.physicalStockHeader.update).toHaveBeenCalledWith({
      where: {
        psId: HEADER_ID,
      },
      data: expect.objectContaining({
        psAccYear: '2026-2027',
        psCompanyId: COMPANY_ID,
        psBranchId: BRANCH_ID,
        psGodownId: GODOWN_ID,
      }),
    });
  });
  it('calculates variance fields for detail and batch rows before insert', async () => {
    await service.create(makeCreateDtoWithRows());
    expect(tx.physicalStockDetail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        psdDiffQty: -2,
        psdDiffBaseQty: -2,
        psdBookValueWot: 1000,
        psdPhysicalValueWot: 800,
        psdDiffValueWot: -200,
        psdDiffValueWithTax: -200,
      }),
    });
    expect(tx.physicalStockBatchDetail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        psbPshId: HEADER_ID,
        psbDiffQty: -2,
        psbDiffBaseQty: -2,
        psbBookValueWot: 1000,
        psbPhysicalValueWot: 800,
        psbDiffValueWot: -200,
        psbDiffValueWithTax: -200,
      }),
    });
  });
  it('fetches an active physical stock document by psId', async () => {
    await expect(service.findOne(HEADER_ID)).resolves.toMatchObject({
      header: {
        psc_id: HEADER_ID,
      },
    });
    expect(tx.physicalStockHeader.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          psId: HEADER_ID,
          psIsDeleted: false,
        },
      }),
    );
  });
  it('updates a header and replaces detail rows when details are provided', async () => {
    await service.update(HEADER_ID, makeCreateDtoWithRows());
    expect(tx.physicalStockHeader.update).toHaveBeenCalledWith({
      where: {
        psId: HEADER_ID,
      },
      data: expect.objectContaining({
        psAccYear: '2026-2027',
        psCompanyId: COMPANY_ID,
        psBranchId: BRANCH_ID,
        psGodownId: GODOWN_ID,
        psModifiedBy: USER_ID,
      }),
    });
    expect(tx.physicalStockBatchDetail.deleteMany).toHaveBeenCalledWith({
      where: {
        psbPsdId: {
          in: [DETAIL_ID],
        },
      },
    });
    expect(tx.physicalStockDetail.deleteMany).toHaveBeenCalledWith({
      where: {
        psdPscId: HEADER_ID,
      },
    });
    expect(tx.physicalStockBatchDetail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        psbPshId: HEADER_ID,
      }),
    });
  });
  it('soft deletes header, detail, and batch rows by psId', async () => {
    await expect(service.remove(HEADER_ID)).resolves.toEqual({
      ps_id: HEADER_ID,
      deleted: true,
    });
    expect(tx.physicalStockBatchDetail.updateMany).toHaveBeenCalledWith({
      where: {
        psbPsdId: {
          in: [DETAIL_ID],
        },
        psbIsDeleted: false,
      },
      data: expect.objectContaining({
        psbIsActive: false,
        psbIsDeleted: true,
        psbModifiedBy: USER_ID,
      }),
    });
    expect(tx.physicalStockDetail.updateMany).toHaveBeenCalledWith({
      where: {
        psdPscId: HEADER_ID,
        psdIsDeleted: false,
      },
      data: expect.objectContaining({
        psdIsActive: false,
        psdIsDeleted: true,
        psdModifiedBy: USER_ID,
      }),
    });
    expect(tx.physicalStockHeader.update).toHaveBeenCalledWith({
      where: {
        psId: HEADER_ID,
      },
      data: expect.objectContaining({
        psStatus: 'CANCELLED',
        psIsActive: false,
        psIsDeleted: true,
        psCancelledBy: USER_ID,
        psModifiedBy: USER_ID,
      }),
    });
  });
});
function makeCreateDto(): CreatePhysicalStockDto {
  return {
    psAccYear: '2026-2027',
    psCompanyId: COMPANY_ID,
    psBranchId: BRANCH_ID,
    psGodownId: GODOWN_ID,
    psDocNo: 1001,
    psCreatedBy: USER_ID,
    details: [],
  };
}
function makeCreateDtoWithRows(): CreatePhysicalStockDto {
  return {
    ...makeCreateDto(),
    details: [
      {
        psdAccYear: '2026-2027',
        psdCompanyId: COMPANY_ID,
        psdBranchId: BRANCH_ID,
        psdGodownId: GODOWN_ID,
        psdItemId: ITEM_ID,
        psdUnitId: UNIT_ID,
        psdBaseUnitId: UNIT_ID,
        psdBookQty: 10,
        psdBookBaseQty: 10,
        psdPhysicalQty: 8,
        psdPhysicalBaseQty: 8,
        psdStockRateWot: 100,
        psdStockRateWithTax: 100,
        batchDetails: [
          {
            psbAccYear: '2026-2027',
            psbCompanyId: COMPANY_ID,
            psbBranchId: BRANCH_ID,
            psbGodownId: GODOWN_ID,
            psbItemId: ITEM_ID,
            psbUnitId: UNIT_ID,
            psbBaseUnitId: UNIT_ID,
            psbBookQty: 10,
            psbBookBaseQty: 10,
            psbPhysicalQty: 8,
            psbPhysicalBaseQty: 8,
            psbStockRateWot: 100,
            psbStockRateWithTax: 100,
          },
        ],
      },
    ],
  };
}
function makeHeaderRecord() {
  return {
    psId: HEADER_ID,
    psAccYear: '2026-2027',
    psCompanyId: COMPANY_ID,
    psBranchId: BRANCH_ID,
    psGodownId: GODOWN_ID,
    psCreatedBy: USER_ID,
    psModifiedBy: null,
  };
}
function makeDocumentRecord() {
  return {
    psId: HEADER_ID,
    psDocRefNo: 'PHY-STK-TEST-001',
    psDocNo: 1001n,
    psDocDate: new Date('2026-05-09T00:00:00.000Z'),
    details: [
      {
        psdId: DETAIL_ID,
        psdPscId: HEADER_ID,
        psdRowNo: 1,
        batchDetails: [
          {
            psbId: '019cc885-d0f4-771b-a7d1-7c98f9ff3ac9',
            psbPsdId: DETAIL_ID,
            psbRowNo: 1,
          },
        ],
      },
    ],
  };
}
