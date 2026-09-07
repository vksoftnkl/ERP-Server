import { ArgumentsHost, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { StockVoucherService } from './stock-voucher.service';
import { StockVoucherExceptionFilter } from './stock-voucher-exception.filter';
import { SaveStockVoucherDto } from './dto/save-stock-voucher.dto';
import type { StockVoucherTypeRules } from './types/stock-voucher.types';
import { buildStockVoucherRefno } from './stock-voucher-numbering.helper';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_ID = '01000000-0000-7000-8000-0000000000b1';
const DEVICE_ID = '01000000-0000-7000-8000-0000000000d1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const GODOWN_ID = '01000000-0000-7000-8000-0000000000e1';
const ITEM_ID = '01000000-0000-7000-8000-000000000001';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const BASE_UOM_ID = '01000000-0000-7000-8000-000000000012';
const SVH_ID = '01000000-0000-7000-8000-0000000000f1';
const ACC_YEAR = '2026-2027';

const OPENING_RULES: StockVoucherTypeRules = {
  voucherType: 'OPENING',
  typeCode: 'OPN',
  displayName: 'Opening stock',
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: true,
  ledgerTxnType: 'OPENING',
  auditScreenName: 'Opening Stock',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

/**
 * SALT: 10 BOX @ 12 per box, 20.00 a base unit — line 1 of the worked example
 * in 19_opening_stock_flow.md, whose captured figures this module is measured
 * against.
 */
const payload = (overrides: Partial<SaveStockVoucherDto> = {}): SaveStockVoucherDto =>
  ({
    header: {
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      deviceId: DEVICE_ID,
      docDate: '2026-04-01',
      toGodownId: GODOWN_ID,
      rateSource: 'MANUAL',
      userId: USER_ID,
      ...(overrides.header ?? {}),
    },
    lines: overrides.lines ?? [
      {
        lineNo: 1,
        itemId: ITEM_ID,
        uomId: UOM_ID,
        godownId: GODOWN_ID,
        qty: 10,
        costRate: 20,
        taxPerc: 5,
      },
    ],
  }) as SaveStockVoucherDto;

/** What Prisma hands back when a PL/pgSQL function RAISEs inside a raw query. */
const engineError = (sqlState: string, message: string) =>
  Object.assign(new Error('Raw query failed'), {
    code: 'P2010',
    meta: { code: sqlState, message },
  });

describe('StockVoucherService', () => {
  let service: StockVoucherService;
  let client: {
    deviceMaster: { findFirst: jest.Mock };
    itemUnitConversion: { findMany: jest.Mock };
    stockVoucher: { create: jest.Mock; update: jest.Mock; findUnique: jest.Mock };
    stockVoucherItem: { deleteMany: jest.Mock; createMany: jest.Mock; updateMany: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
  };
  let auditLogService: { logEntityChange: jest.Mock };

  const conversionRow = (overrides: Record<string, unknown> = {}) => ({
    iucId: UOM_ID,
    iucItemId: ITEM_ID,
    // 1 BOX = 12 base units.
    iucToBaseFactor: new Prisma.Decimal(12),
    iucBaseUnitId: BASE_UOM_ID,
    item: { unitConversions: [{ iucId: BASE_UOM_ID }] },
    ...overrides,
  });

  beforeEach(() => {
    client = {
      deviceMaster: {
        findFirst: jest.fn().mockResolvedValue({
          devDeviceUid: 'TILL-01',
          devDeviceName: 'Till 1',
          devIsActive: true,
          devIsBlocked: false,
          devBlockReason: null,
        }),
      },
      itemUnitConversion: { findMany: jest.fn().mockResolvedValue([conversionRow()]) },
      stockVoucher: {
        create: jest.fn().mockResolvedValue({
          svhId: SVH_ID,
          svhAccYear: ACC_YEAR,
          svhRefno: 'OPN/2026-2027/TILL-01/1',
        }),
        update: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn().mockResolvedValue(null),
      },
      stockVoucherItem: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
      // The numbering helper's advisory lock, then MAX(slno) + 1.
      $queryRaw: jest.fn().mockResolvedValue([{ locked: 1, next_slno: BigInt(1) }]),
    };
    auditLogService = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    service = new StockVoucherService(
      client as unknown as PrismaService,
      auditLogService as unknown as AuditLogService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
    );
    // Every save reloads the document at the end; the reload itself is raw SQL
    // against tables a unit test has no business standing up.
    jest
      .spyOn(service, 'getById')
      .mockResolvedValue({ header: { svhId: SVH_ID } as never, lines: [] });
  });

  const createdLine = () => client.stockVoucherItem.createMany.mock.calls[0][0].data[0];

  describe('save — what the service computes and must not trust', () => {
    it('reads to_base_factor from item_unit_conversion, not from the payload', async () => {
      await service.save(OPENING_RULES, payload());

      const line = createdLine();
      // 10 BOX × 12 = 120 base units — the flow doc's line 1. A factor sent by
      // the client would not have been consulted at all.
      expect(Number(line.sviToBaseFactor)).toBe(12);
      expect(Number(line.sviBaseQty)).toBe(120);
    });

    it('multiplies free quantity by the same factor — free goods are stock', async () => {
      await service.save(
        OPENING_RULES,
        payload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              godownId: GODOWN_ID,
              qty: 10,
              freeQty: 5,
              costRate: 20,
            },
          ],
        }),
      );

      expect(Number(createdLine().sviFreeBaseQty)).toBe(60);
    });

    it('never sends a generated column in the line payload', async () => {
      await service.save(OPENING_RULES, payload());

      const line = createdLine();
      // GENERATED ALWAYS ... STORED — Postgres rejects any write, including a
      // write of the value it would itself compute.
      expect(line).not.toHaveProperty('sviValue');
      expect(line).not.toHaveProperty('sviValueWot');
      expect(line).not.toHaveProperty('sviDiffQty');
    });

    it('never sends a header total — the triggers own all four', async () => {
      await service.save(OPENING_RULES, payload());

      const header = client.stockVoucher.create.mock.calls[0][0].data;
      expect(header).not.toHaveProperty('svhLineCount');
      expect(header).not.toHaveProperty('svhTotalQty');
      expect(header).not.toHaveProperty('svhTotalValue');
      expect(header).not.toHaveProperty('svhTotalValueWot');
    });

    it('always saves DRAFT and never a lot id', async () => {
      await service.save(OPENING_RULES, payload());

      expect(client.stockVoucher.create.mock.calls[0][0].data.svhStatus).toBe('DRAFT');
      // fn_slt_resolve owns lot identity, and only at post time.
      expect(createdLine().sviLotId).toBeNull();
    });

    it('copies company, branch and year onto the line from the HEADER', async () => {
      await service.save(OPENING_RULES, payload());

      const line = createdLine();
      expect(line.sviCompanyId).toBe(COMPANY_ID);
      expect(line.sviBranchId).toBe(BRANCH_ID);
      expect(line.sviAccYear).toBe(ACC_YEAR);
    });

    it('replaces the lines rather than merging them on update', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhRefno: 'OPN/2026-2027/TILL-01/1',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        svhVoucherType: 'OPENING',
        svhCancelledOn: null,
      });

      await service.save(OPENING_RULES, payload({ header: { svhId: SVH_ID } as never }));

      expect(client.stockVoucherItem.deleteMany).toHaveBeenCalledWith({
        where: { sviVoucherId: SVH_ID, sviAccYear: ACC_YEAR },
      });
    });
  });

  describe('save — what the service refuses before the engine does', () => {
    const expectRefusal = async (dto: SaveStockVoucherDto, fragment: string) => {
      await expect(service.save(OPENING_RULES, dto)).rejects.toMatchObject({
        response: {
          success: false,
          errors: expect.arrayContaining([
            expect.objectContaining({ message: expect.stringContaining(fragment) }),
          ]),
        },
      });
      expect(client.stockVoucher.create).not.toHaveBeenCalled();
    };

    it('refuses an OPENING with no to-godown — ck_svh_godowns will not', async () => {
      await expectRefusal(
        payload({ header: { toGodownId: null } as never }),
        'godown the stock arrives in',
      );
    });

    it('refuses a document with no lines', async () => {
      await expectRefusal(payload({ lines: [] }), 'at least one line');
    });

    it('refuses a line with neither quantity nor free quantity', async () => {
      await expectRefusal(
        payload({
          lines: [
            { lineNo: 1, itemId: ITEM_ID, uomId: UOM_ID, godownId: GODOWN_ID, qty: 0, costRate: 20 },
          ],
        }),
        'has no quantity',
      );
    });

    it('refuses a negative quantity — a negative opening is an ADJUSTMENT', async () => {
      await expectRefusal(
        payload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              godownId: GODOWN_ID,
              qty: -5,
              costRate: 20,
            },
          ],
        }),
        'ADJUSTMENT',
      );
    });

    it('refuses a split above 1 with no batch number — ck_svi_batch_split', async () => {
      await expectRefusal(
        payload({
          lines: [
            {
              lineNo: 1,
              splitNo: 2,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              godownId: GODOWN_ID,
              qty: 1,
              costRate: 20,
            },
          ],
        }),
        'needs a batch number',
      );
    });

    it('refuses an expiry before its manufacture date — ck_svi_expiry_order', async () => {
      await expectRefusal(
        payload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              godownId: GODOWN_ID,
              qty: 1,
              costRate: 20,
              mfgDate: '2026-06-30',
              expiryDate: '2026-01-01',
            },
          ],
        }),
        'is before manufacture',
      );
    });

    it('refuses a duplicate (lineNo, splitNo) — a cleaner message than ux_svi_line', async () => {
      await expectRefusal(
        payload({
          lines: [
            { lineNo: 1, itemId: ITEM_ID, uomId: UOM_ID, godownId: GODOWN_ID, qty: 1, costRate: 20 },
            { lineNo: 1, itemId: ITEM_ID, uomId: UOM_ID, godownId: GODOWN_ID, qty: 2, costRate: 20 },
          ],
        }),
        'already used by row 1',
      );
    });

    it('refuses an inward at cost 0 with no rate source', async () => {
      await expectRefusal(
        payload({
          header: { rateSource: null } as never,
          lines: [
            { lineNo: 1, itemId: ITEM_ID, uomId: UOM_ID, godownId: GODOWN_ID, qty: 1, costRate: 0 },
          ],
        }),
        'names no rate source',
      );
    });

    it('refuses a unit that belongs to another item', async () => {
      client.itemUnitConversion.findMany.mockResolvedValue([
        conversionRow({ iucItemId: '01000000-0000-7000-8000-000000000099' }),
      ]);

      await expect(service.save(OPENING_RULES, payload())).rejects.toMatchObject({
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('the unit does not belong to this item'),
            }),
          ]),
        },
      });
    });

    it('refuses a uomId that is a unit_id rather than an iuc_id', async () => {
      client.itemUnitConversion.findMany.mockResolvedValue([]);

      await expect(service.save(OPENING_RULES, payload())).rejects.toMatchObject({
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('not a unit_id'),
            }),
          ]),
        },
      });
    });
  });

  describe('editing and deleting a posted document', () => {
    const posted = {
      svhId: SVH_ID,
      svhRefno: 'OPN/2026-2027/TILL-01/1',
      svhStatus: 'POSTED',
      svhIsDeleted: false,
      svhVoucherType: 'OPENING',
      svhCompanyId: COMPANY_ID,
      svhBranchId: BRANCH_ID,
      svhCancelledOn: null,
    };

    it('answers 409 on an update of a POSTED voucher instead of a trigger 500', async () => {
      client.stockVoucher.findUnique.mockResolvedValue(posted);

      await expect(
        service.save(OPENING_RULES, payload({ header: { svhId: SVH_ID } as never })),
      ).rejects.toMatchObject({ status: 409 });
      expect(client.stockVoucher.update).not.toHaveBeenCalled();
    });

    it('answers 409 on a DELETE of a POSTED voucher and points at cancel', async () => {
      client.stockVoucher.findUnique.mockResolvedValue(posted);

      await expect(
        service.softDelete(OPENING_RULES, SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID),
      ).rejects.toMatchObject({
        status: 409,
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({ message: expect.stringContaining('Cancel it') }),
          ]),
        },
      });
      expect(client.stockVoucher.update).not.toHaveBeenCalled();
    });

    it('soft deletes the LINES too — the FK cascade is not a soft delete', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({ ...posted, svhStatus: 'DRAFT' });

      await service.softDelete(OPENING_RULES, SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID);

      expect(client.stockVoucherItem.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { sviVoucherId: SVH_ID, sviAccYear: ACC_YEAR },
          data: expect.objectContaining({ sviIsDeleted: true }),
        }),
      );
    });

    it('refuses to cancel a DRAFT — there is nothing in the ledger to reverse', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({ ...posted, svhStatus: 'DRAFT' });

      await expect(
        service.cancel(OPENING_RULES, SVH_ID, ACC_YEAR, 'wrong figures', COMPANY_ID, BRANCH_ID),
      ).rejects.toMatchObject({ status: 409 });
    });

    it('refuses to cancel with no reason', async () => {
      await expect(
        service.cancel(OPENING_RULES, SVH_ID, ACC_YEAR, '   ', COMPANY_ID, BRANCH_ID),
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('post', () => {
    it('refuses without calling fn_svh_post when the preflight found a problem', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhRefno: 'OPN/2026-2027/TILL-01/1',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        svhVoucherType: 'OPENING',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
        svhCancelledOn: null,
      });
      jest.spyOn(service, 'validate').mockResolvedValue([
        {
          sviId: 'svi1',
          lineNo: 3,
          splitNo: 1,
          itemId: ITEM_ID,
          itemCode: 'SALT',
          itemName: 'Salt',
          problem: 'this holding already has an opening in this year',
        },
      ]);

      await expect(
        service.post(OPENING_RULES, SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID),
      ).rejects.toMatchObject({ status: 422 });
      expect(client.$transaction).not.toHaveBeenCalled();
    });
  });
});

describe('buildStockVoucherRefno', () => {
  it('builds the observed format', () => {
    expect(buildStockVoucherRefno('OPN', ACC_YEAR, 'TILL-01', BigInt(1))).toBe(
      'OPN/2026-2027/TILL-01/1',
    );
  });
});

describe('StockVoucherExceptionFilter — the SQLSTATE map', () => {
  let filter: StockVoucherExceptionFilter;
  let status: jest.Mock;
  let json: jest.Mock;
  let host: ArgumentsHost;

  beforeEach(() => {
    filter = new StockVoucherExceptionFilter();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    host = {
      switchToHttp: () => ({
        getResponse: () => ({ status }),
        getRequest: () => ({ method: 'POST', url: '/api/v1/stock/opening/post' }),
      }),
    } as unknown as ArgumentsHost;
  });

  // One case per row of §12 of the plan. Every one of these arrives from Prisma
  // as code P2010 — a filter switching on error.code would answer 500 to all of
  // them with the same useless message.
  it.each([
    ['P0002', 'voucher OPN/2026-2027/TILL-01/9 not found in 2026-2027', 404],
    ['23001', 'voucher OPN/2026-2027/TILL-01/1 is POSTED; only a DRAFT voucher can be posted', 409],
    ['23505', 'this holding already has an OPENING in this year', 409],
    ['23514', 'line 3 has no quantity', 422],
    ['23502', 'an OPENING voucher must name svh_to_godown_id', 422],
    ['23503', 'no item_unit_conversion row for svi_uom_id', 422],
    ['0A000', 'TRANSFER_OUT cannot be posted through fn_svh_post', 409],
  ])('maps meta.code %s to HTTP %i', (sqlState, message, expected) => {
    filter.catch(engineError(sqlState as string, message as string), host);

    expect(status).toHaveBeenCalledWith(expected);
    // The engine's own wording is passed through: it already names the refno
    // and the line number, and paraphrasing it in TypeScript is how the message
    // the user reads and the message in the log drift apart.
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ success: false, message }),
    );
  });

  it("answers 409, not 422, when fn_sml_apply refuses to go negative on a cancel", () => {
    filter.catch(
      engineError('23514', 'stock for item SALT in godown MAIN would go negative'),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
  });

  it('lets an unrecognised failure fall through to 500 rather than dressing it up', () => {
    filter.catch(engineError('42P01', 'relation "stock.stock_voucher" does not exist'), host);

    expect(status).toHaveBeenCalledWith(500);
  });

  it('passes an HttpException the service already built through untouched', () => {
    filter.catch(
      new HttpException({ success: false, message: 'nope', errors: [] }, 409),
      host,
    );

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'nope', errors: [] });
  });
});
