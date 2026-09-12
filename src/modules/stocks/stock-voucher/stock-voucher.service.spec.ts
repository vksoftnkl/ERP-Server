import { ArgumentsHost, HttpException } from '@nestjs/common';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { StockVoucherService } from './stock-voucher.service';
import { StockVoucherExceptionFilter } from './stock-voucher-exception.filter';
import { SaveStockVoucherDto } from './dto/save-stock-voucher.dto';
import type { StockVoucherTypeRules } from './types/stock-voucher.types';
import { buildStockVoucherRefno } from './stock-voucher-numbering.helper';
import { allocateVoucherNumber } from 'src/common/Sequence/voucher-sequence.helper';

// The accounts counter is a real table walk (voucher type, sequence row,
// company, branch) that a unit test has no business standing up. What is under
// test is WHICH allocator a type's rules route the refno to, and with what scope.
jest.mock('src/common/Sequence/voucher-sequence.helper', () => ({
  allocateVoucherNumber: jest.fn().mockResolvedValue({
    lastNo: BigInt(1),
    refno: 'OPN0001',
    periodKey: '2026-2027',
  }),
}));

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
const LOT_ID = '01000000-0000-7000-8000-000000000021';
const OTHER_ITEM_ID = '01000000-0000-7000-8000-000000000002';
const OTHER_GODOWN_ID = '01000000-0000-7000-8000-0000000000e2';

const OPENING_RULES: StockVoucherTypeRules = {
  voucherType: 'OPENING',
  typeCode: 'OPN',
  displayName: 'Opening stock',
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: true,
  ledgerTxnTypes: ['OPENING'],
  quantityMode: 'QTY',
  allowsCount: false,
  allowsToBranch: false,
  auditScreenName: 'Opening Stock',
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  postFunction: 'stock.fn_svh_post',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

/**
 * The count's rules record, as physical-stock-voucher.controller.ts pins it.
 * Kept in the shared spec because what it is really testing is that the six
 * §3 changes are GATED — the opening record beside it must keep behaving.
 */
const PHYSICAL_RULES: StockVoucherTypeRules = {
  voucherType: 'PHYSICAL',
  typeCode: 'PHY',
  displayName: 'Physical stock count',
  requiresToGodown: true,
  requiresFromGodown: false,
  isInward: false,
  ledgerTxnTypes: ['PHYSICAL_PLUS', 'PHYSICAL_MINUS'],
  quantityMode: 'COUNT',
  defaultRateSource: 'AVG_COST',
  allowsRepeatHolding: true,
  allowsCount: true,
  allowsToBranch: false,
  auditScreenName: 'Physical Stock Count',
  statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
  postFunction: 'stock.fn_svh_post',
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
        baseUomId: BASE_UOM_ID,
        toBaseFactor: 12,
        baseQty: 120,
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
    stockReasonMaster: { findMany: jest.Mock };
    txnStatusLog: { findFirst: jest.Mock; create: jest.Mock };
    $transaction: jest.Mock;
    $queryRaw: jest.Mock;
    $executeRaw: jest.Mock;
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
      stockReasonMaster: { findMany: jest.fn().mockResolvedValue([]) },
      // public.txn_status_log — every status STEP appends one row. findFirst is
      // the helper reading the last tsl_seq_no for this document.
      txnStatusLog: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(client)),
      // The numbering helper's advisory lock, then MAX(slno) + 1.
      $queryRaw: jest.fn().mockResolvedValue([{ locked: 1, next_slno: BigInt(1) }]),
      // The in-process posting engine's seven set-based statements.
      $executeRaw: jest.fn().mockResolvedValue(2),
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

  describe('numbering — where the printed number comes from', () => {
    beforeEach(() => {
      (allocateVoucherNumber as jest.Mock).mockClear();
    });

    it('builds the self-contained device refno when the rules name no accounts voucher type', async () => {
      await service.save(OPENING_RULES, payload());

      expect(allocateVoucherNumber).not.toHaveBeenCalled();
      expect(client.stockVoucher.create.mock.calls[0][0].data.svhRefno).toBe(
        buildStockVoucherRefno('OPN', ACC_YEAR, 'TILL-01', BigInt(1)),
      );
    });

    it('draws the refno from accounts.acc_voucher_seq under the named acc_voucher_types row', async () => {
      // The opening screen pins row 1, "Opening Stock": prefix opn, suffix st,
      // width 12 — the format the mocked allocator answers with.
      await service.save({ ...OPENING_RULES, refnoVchrTypeId: 1 }, payload());

      expect(allocateVoucherNumber).toHaveBeenCalledTimes(1);
      const scope = (allocateVoucherNumber as jest.Mock).mock.calls[0][1];
      expect(scope).toEqual({
        vchrTypeId: 1,
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        accYear: ACC_YEAR,
      });
      // No deviceCode: ux_svh_refno is per (company, branch, acc_year), so a
      // per-device accounts counter would let two tills print the same number.
      expect(scope).not.toHaveProperty('deviceCode');
      const data = client.stockVoucher.create.mock.calls[0][0].data;
      expect(data.svhRefno).toBe('OPN0001');
      // The serial is untouched by the switch: still MAX(slno) + 1 per device.
      expect(data.svhSlno).toBe(BigInt(1));
    });

    it('honours a client-supplied refno without consuming an accounts number', async () => {
      await service.save(
        { ...OPENING_RULES, refnoVchrTypeId: 1 },
        payload({ header: { refno: 'OPN0040' } as never }),
      );

      expect(allocateVoucherNumber).not.toHaveBeenCalled();
      expect(client.stockVoucher.create.mock.calls[0][0].data.svhRefno).toBe('OPN0040');
    });
  });

  describe('save — what the service computes and must not trust', () => {
    it('writes to_base_factor and base_qty from the PAYLOAD, unread and unrecomputed', async () => {
      await service.save(OPENING_RULES, payload());

      const line = createdLine();
      // 10 BOX × 12 = 120 base units — the flow doc's line 1, now sent by the
      // screen rather than derived here.
      expect(Number(line.sviToBaseFactor)).toBe(12);
      expect(Number(line.sviBaseQty)).toBe(120);
      // The lookup is gone outright: nothing on the save path opens
      // item_unit_conversion any more.
      expect(client.itemUnitConversion.findMany).not.toHaveBeenCalled();
    });

    it('does NOT recompute base_qty as qty × factor — the payload wins even when they disagree', async () => {
      await service.save(
        OPENING_RULES,
        payload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              // 10 × 12 would be 120. The server multiplies nothing, so what
              // the client sent is what is stored — this is the whole point of
              // the change, and the assertion that would catch a reintroduced
              // multiplication.
              baseQty: 97,
              godownId: GODOWN_ID,
              qty: 10,
              costRate: 20,
            },
          ],
        }),
      );

      expect(Number(createdLine().sviBaseQty)).toBe(97);
    });

    it('takes free_base_qty from the payload rather than multiplying free qty', async () => {
      await service.save(
        OPENING_RULES,
        payload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
              godownId: GODOWN_ID,
              qty: 10,
              freeQty: 5,
              freeBaseQty: 60,
              costRate: 20,
            },
          ],
        }),
      );

      expect(Number(createdLine().sviFreeBaseQty)).toBe(60);
    });

    it('omits free_base_qty entirely when the payload does not send it, leaving the column default', async () => {
      await service.save(OPENING_RULES, payload());

      // Not `?? 0` — absent, so NOT NULL DEFAULT 0 applies. A server-side
      // fallback here would mask a grid that forgot to fill it.
      expect(createdLine()).not.toHaveProperty('sviFreeBaseQty');
    });

    it('writes base_uom_id from the payload, never resolved from the item', async () => {
      await service.save(OPENING_RULES, payload());

      expect(createdLine().sviBaseUomId).toBe(BASE_UOM_ID);
      expect(client.itemUnitConversion.findMany).not.toHaveBeenCalled();
    });

    it('writes createdBy from the payload, on the header and on every line', async () => {
      await service.save(
        OPENING_RULES,
        payload({
          header: { createdBy: 'TILL-01 operator' } as never,
          lines: [{ ...payload().lines[0], createdBy: 'row author' }] as never,
        }),
      );

      expect(client.stockVoucher.create.mock.calls[0][0].data.svhCreatedBy).toBe(
        'TILL-01 operator',
      );
      expect(createdLine().sviCreatedBy).toBe('row author');
    });

    it('falls back to the header author, then the actor, when a line names none', async () => {
      await service.save(OPENING_RULES, payload({ header: { createdBy: 'import job' } as never }));
      expect(createdLine().sviCreatedBy).toBe('import job');

      client.stockVoucherItem.createMany.mockClear();
      await service.save(OPENING_RULES, payload());
      // Neither level named one, so the resolved actor stands — exactly what
      // every caller got before these fields existed.
      expect(createdLine().sviCreatedBy).toBe(USER_ID);
    });

    it('does not stamp the original author on lines an UPDATE rewrites', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhAccYear: ACC_YEAR,
        svhRefno: 'OPN/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        svhVoucherType: 'OPENING',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
      });

      await service.save(
        OPENING_RULES,
        payload({
          header: {
            svhId: SVH_ID,
            createdBy: 'the original author',
            modifiedBy: 'the editor',
          } as never,
        }),
      );

      // A save REPLACES the lines, so this row was inserted by the EDITOR. The
      // header keeps its own created_by; the lines must not quietly re-credit
      // the original author for an edit somebody else made.
      expect(createdLine().sviCreatedBy).toBe('the editor');
    });

    it('never writes modified_by on a line the save is inserting fresh', async () => {
      await service.save(OPENING_RULES, payload({ header: { createdBy: 'x' } as never }));

      // Absent, not null: a line created by this save has not been modified,
      // and a modified_by on it would claim an edit that never happened.
      expect(createdLine()).not.toHaveProperty('sviModifiedBy');
    });

    it('writes modifiedBy on an update and leaves created_by alone', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhAccYear: ACC_YEAR,
        svhRefno: 'OPN/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        svhVoucherType: 'OPENING',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
      });

      await service.save(
        OPENING_RULES,
        payload({
          header: { svhId: SVH_ID, createdBy: 'ignored', modifiedBy: 'the editor' } as never,
        }),
      );

      const data = client.stockVoucher.update.mock.calls[0][0].data;
      expect(data.svhModifiedBy).toBe('the editor');
      // Who raised the document is not something a later edit gets to change.
      expect(data).not.toHaveProperty('svhCreatedBy');
    });

    it('saves a DRAFT and posts nothing when the payload names no status', async () => {
      await service.save(OPENING_RULES, payload());

      expect(client.stockVoucher.create.mock.calls[0][0].data.svhStatus).toBe('DRAFT');
      // The posting statements never ran.
      expect(client.$executeRaw).not.toHaveBeenCalled();
    });

    it('saves and posts in ONE transaction when the payload says status POSTED', async () => {
      jest.spyOn(service, 'validate').mockResolvedValue([]);

      const result = await service.save(
        OPENING_RULES,
        payload({ header: { status: 'POSTED' } as never }),
      );

      // The row is still WRITTEN as a draft — post is a step that follows, not
      // a value the insert takes. Nothing may create a POSTED document.
      expect(client.stockVoucher.create.mock.calls[0][0].data.svhStatus).toBe('DRAFT');
      // ...and then the same transaction posts it: lots, lines, ledger,
      // balances, the moving average and its stamp, lot totals.
      expect(client.$executeRaw).toHaveBeenCalledTimes(7);
      expect(client.stockVoucher.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ svhStatus: 'POSTED' }) }),
      );
      // One transaction, not a save followed by a separate post.
      expect(client.$transaction).toHaveBeenCalledTimes(1);
      expect(result.rowsPosted).not.toBeNull();
    });

    it('writes both trail steps when one request saves and posts', async () => {
      jest.spyOn(service, 'validate').mockResolvedValue([]);

      await service.save(OPENING_RULES, payload({ header: { status: 'POSTED' } as never }));

      const events = client.txnStatusLog.create.mock.calls.map(
        (call: [{ data: { tslEvent: string; tslToStatus: string } }]) => [
          call[0].data.tslEvent,
          call[0].data.tslToStatus,
        ],
      );
      // The document was created and then posted, and the trail says both —
      // collapsing them into one POSTED row would lose who created it.
      expect(events).toEqual([
        ['CREATED', 'DRAFT'],
        ['POSTED', 'POSTED'],
      ]);
    });

    it('refuses the whole save when status is POSTED and a line fails the preflight', async () => {
      jest.spyOn(service, 'validate').mockResolvedValue([
        {
          sviId: 'x',
          lineNo: 1,
          splitNo: 1,
          itemId: ITEM_ID,
          itemCode: 'X',
          itemName: 'Widget',
          problem: 'this holding already has an opening in this year',
        },
      ]);

      await expect(
        service.save(OPENING_RULES, payload({ header: { status: 'POSTED' } as never })),
      ).rejects.toMatchObject({
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('already has an opening'),
            }),
          ]),
        },
      });

      // The refusal happens INSIDE the transaction, so the draft rolls back
      // with it: a save asked to post either does both or does neither.
      expect(client.$executeRaw).not.toHaveBeenCalled();
    });

    it("opens the voucher's status trail with a CREATED step", async () => {
      await service.save(OPENING_RULES, payload());

      // First row of the trail: fromStatus NULL says the document did not exist
      // before this step, and tslToStatus says what it was born as.
      expect(client.txnStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tslSrcModule: 'INVENTORY',
            tslEvent: 'CREATED',
            tslFromStatus: null,
            tslToStatus: 'DRAFT',
            tslSeqNo: 1,
          }),
        }),
      );
    });

    it('adds no status row to an ordinary save that leaves the voucher DRAFT', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhAccYear: ACC_YEAR,
        svhRefno: 'OPN/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        svhVoucherType: 'OPENING',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
      });
      client.txnStatusLog.create.mockClear();

      await service.save(OPENING_RULES, payload({ header: { svhId: SVH_ID } as never }));

      // txn_status_log holds one row per status STEP. An edit that leaves the
      // voucher DRAFT is not a step — what changed field by field is
      // audit.audit_log's job. Same rule the bill and order screens follow.
      expect(client.txnStatusLog.create).not.toHaveBeenCalled();
    });

    it('never logs a line write as an update with no originalRecord', async () => {
      await service.save(OPENING_RULES, payload());

      // AuditLogService rejects an 'update' whose originalRecord is null, and
      // it does so INSIDE the save transaction — a create whose lines were
      // logged that way 400s with "originalRecord and modifiedRecord are
      // required for update audit log" before the header is ever logged.
      // The audit service is mocked here, so only this assertion catches it.
      for (const [entry] of auditLogService.logEntityChange.mock.calls as Array<
        [{ action: string; originalRecord: unknown; modifiedRecord: unknown }]
      >) {
        if (entry.action.trim().toLowerCase() === 'update') {
          expect(entry.originalRecord).not.toBeNull();
          expect(entry.modifiedRecord).not.toBeNull();
        }
      }
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

    it('writes the four header totals from the payload, and sums nothing itself', async () => {
      await service.save(
        OPENING_RULES,
        payload({
          header: {
            lineCount: 3,
            totalQty: 120,
            totalValue: 2400.5,
            totalValueWot: 2286.19,
          } as SaveStockVoucherDto['header'],
        }),
      );

      // They are not on the CREATE — they go on their own UPDATE after the
      // lines, so that tr_svi_refresh_header cannot clobber them where the
      // engine DDL is installed.
      const created = client.stockVoucher.create.mock.calls[0][0].data;
      expect(created).not.toHaveProperty('svhLineCount');

      const totals = client.stockVoucher.update.mock.calls.at(-1)[0].data;
      expect(totals.svhLineCount).toBe(3);
      expect(Number(totals.svhTotalQty)).toBe(120);
      expect(Number(totals.svhTotalValue)).toBe(2400.5);
      expect(Number(totals.svhTotalValueWot)).toBe(2286.19);
      // One line in the payload, lineCount 3 in the header: the service does
      // not count the grid, so it does not correct it either.
      expect(client.stockVoucherItem.createMany.mock.calls[0][0].data).toHaveLength(1);
    });

    it('issues no totals update at all when the payload sends none', async () => {
      await service.save(OPENING_RULES, payload());

      // Nothing written means the columns keep their NOT NULL DEFAULT 0 on a
      // create — not a server-side zero standing in for a missing value.
      expect(client.stockVoucher.update).not.toHaveBeenCalled();
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
      });

      await service.save(OPENING_RULES, payload({ header: { svhId: SVH_ID } as never }));

      expect(client.stockVoucherItem.deleteMany).toHaveBeenCalledWith({
        where: { sviVoucherId: SVH_ID, sviAccYear: ACC_YEAR },
      });
    });
  });

  /**
   * The three §1 changes the transfer screens needed from the SHARED service.
   * Tested here rather than in the transfer spec because what they really
   * guarantee is that the OPENING and PHYSICAL records beside them keep
   * behaving — each one is a rule that used to be a constant.
   */
  describe('the per-type rules the transfer screens added', () => {
    const TRANSFER_OUT_RULES: StockVoucherTypeRules = {
      voucherType: 'TRANSFER_OUT',
      typeCode: 'TRF',
      displayName: 'Stock transfer',
      requiresToGodown: true,
      requiresFromGodown: true,
      isInward: false,
      ledgerTxnTypes: ['TRANSFER_OUT'],
      quantityMode: 'QTY',
      requiresLot: true,
      zeroesLineCost: true,
      allowsCount: false,
      allowsToBranch: true,
      postFunction: 'stock.fn_svh_post_transfer',
      auditScreenName: 'Stock Transfer',
      statusDocType: TxnStatusDocType.STOCK_TRANSFER,
      refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_IN', 'REPACK_IN', 'REPACK_OUT'],
    };

    const transferPayload = (overrides: Record<string, unknown> = {}) =>
      payload({
        header: {
          fromGodownId: GODOWN_ID,
          toGodownId: OTHER_GODOWN_ID,
          ...((overrides.header as object) ?? {}),
        } as never,
        lines: (overrides.lines as never) ?? [
          {
            lineNo: 1,
            itemId: ITEM_ID,
            uomId: UOM_ID,
            baseUomId: BASE_UOM_ID,
            toBaseFactor: 12,
            baseQty: 120,
            godownId: GODOWN_ID,
            lotId: LOT_ID,
            qty: 10,
          } as never,
        ],
      });

    it('REQUIRES a lot where the opening REFUSES one — the same column, inverted', async () => {
      // fn_slt_resolve owns lot identity on an opening; a transfer moves stock
      // that already has one, and the destination must keep the same slt_id or
      // ageing resets.
      await expect(
        service.save(
          TRANSFER_OUT_RULES,
          transferPayload({
            lines: [
              {
                lineNo: 1,
                itemId: ITEM_ID,
                uomId: UOM_ID,
                baseUomId: BASE_UOM_ID,
                toBaseFactor: 12,
                baseQty: 120,
                godownId: GODOWN_ID,
                qty: 10,
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({ message: expect.stringContaining('names no lot') }),
          ]),
        },
      });
    });

    it('still refuses a lot on an OPENING', async () => {
      await expect(
        service.save(
          OPENING_RULES,
          payload({
            lines: [
              {
                lineNo: 1,
                itemId: ITEM_ID,
                uomId: UOM_ID,
                baseUomId: BASE_UOM_ID,
                toBaseFactor: 12,
                baseQty: 120,
                godownId: GODOWN_ID,
                qty: 10,
                costRate: 20,
                lotId: LOT_ID,
              },
            ] as never,
          }),
        ),
      ).rejects.toMatchObject({
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('does not choose its own lot'),
            }),
          ]),
        },
      });
    });

    it('writes the supplied lot through to the line on a transfer', async () => {
      await service.save(TRANSFER_OUT_RULES, transferPayload());
      expect(createdLine().sviLotId).toBe(LOT_ID);
    });

    it('refuses a typed cost on a transfer line — MUST-FIX 5, and it is not silently zeroed', async () => {
      // Silently zeroing would leave the screen showing a cost the document
      // does not have. There is nothing to type: the engine stamps the policy
      // cost and it travels to the IN row and the transit row.
      await expect(
        service.save(
          TRANSFER_OUT_RULES,
          transferPayload({
            lines: [
              {
                lineNo: 1,
                itemId: ITEM_ID,
                uomId: UOM_ID,
                baseUomId: BASE_UOM_ID,
                toBaseFactor: 12,
                baseQty: 120,
                godownId: GODOWN_ID,
                lotId: LOT_ID,
                qty: 10,
                costRate: 555,
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({ message: expect.stringContaining('carries no cost rate') }),
          ]),
        },
      });
    });

    it('stores a transfer line at cost 0 so fn_sml_cost_default can stamp it', async () => {
      await service.save(TRANSFER_OUT_RULES, transferPayload());
      const line = createdLine();
      expect(Number(line.sviCostRate)).toBe(0);
      expect(Number(line.sviCostRateWot)).toBe(0);
    });

    it('does NOT demand a cost on an inward whose rate the engine supplies', async () => {
      // A TRANSFER_IN is inward — it is why isInward is true on it — but its
      // rate comes from stt_cost_rate. Left ungated the "inward at cost 0"
      // check refuses every receipt line.
      const TRANSFER_IN_RULES: StockVoucherTypeRules = {
        ...TRANSFER_OUT_RULES,
        voucherType: 'TRANSFER_IN',
        typeCode: 'TRI',
        displayName: 'Transfer receipt',
        isInward: true,
        allowsToBranch: false,
        ledgerTxnTypes: ['TRANSFER_IN'],
        postFunction: 'stock.fn_svh_receive_transfer',
        refuseTypes: ['OPENING', 'PHYSICAL', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
      };
      await service.save(TRANSFER_IN_RULES, transferPayload({ header: { rateSource: null } }));
      expect(client.stockVoucher.create).toHaveBeenCalled();
    });

    it('still demands a cost on an OPENING, which derives nothing from MANUAL', async () => {
      await expect(
        service.save(
          OPENING_RULES,
          payload({
            lines: [
              {
                lineNo: 1,
                itemId: ITEM_ID,
                uomId: UOM_ID,
                baseUomId: BASE_UOM_ID,
                toBaseFactor: 12,
                baseQty: 120,
                godownId: GODOWN_ID,
                qty: 10,
                costRate: 0,
              },
            ] as never,
          }),
        ),
      ).rejects.toMatchObject({
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({
              message: expect.stringContaining('brings stock in at cost 0'),
            }),
          ]),
        },
      });
    });

    it('posts an OPENING in process, without ever naming a stock engine function', async () => {
      jest.spyOn(service, 'validate').mockResolvedValue([]);
      jest.spyOn(service, 'getById').mockResolvedValue({
        header: { svhId: SVH_ID, refno: 'OPN/x', status: 'POSTED', postedOn: null } as never,
        lines: [],
      });
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhRefno: 'OPN/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        svhVoucherType: 'OPENING',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
        svhTenantId: null,
        svhDeviceId: DEVICE_ID,
        svhSessionId: null,
      });
      client.$queryRaw.mockClear();

      await service.post(OPENING_RULES, SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID, USER_ID);

      // stock.fn_svh_post does not exist on this deployment. The whole point of
      // stock-voucher-posting.helper is that the generic path no longer calls
      // it, so a $queryRaw carrying a function name is the regression.
      const named = client.$queryRaw.mock.calls.some((call: unknown[]) =>
        JSON.stringify(call).includes('fn_svh_post'),
      );
      expect(named).toBe(false);
      // Lots, lines, ledger, balances, the moving average and its stamp, lot
      // totals — seven set-based statements.
      expect(client.$executeRaw).toHaveBeenCalledTimes(7);
      expect(client.stockVoucher.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ svhStatus: 'POSTED' }) }),
      );
    });

    it('appends the POSTED step to txn_status_log inside the post transaction', async () => {
      jest.spyOn(service, 'validate').mockResolvedValue([]);
      jest.spyOn(service, 'getById').mockResolvedValue({
        header: { svhId: SVH_ID, refno: 'OPN/x', status: 'POSTED', postedOn: null } as never,
        lines: [],
      });
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhRefno: 'OPN/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        svhVoucherType: 'OPENING',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
        svhTenantId: null,
        svhDeviceId: DEVICE_ID,
        svhSessionId: null,
      });

      await service.post(OPENING_RULES, SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID, USER_ID);

      expect(client.txnStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            // INVENTORY, never the ledger's 'STOCK' — the two tables allow
            // different module vocabularies and ck_tsl_src_module has no STOCK.
            tslSrcModule: 'INVENTORY',
            tslSrcDocType: 'STOCK_ADJUSTMENT',
            tslEvent: 'POSTED',
            tslFromStatus: 'DRAFT',
            tslToStatus: 'POSTED',
            tslSrcDocId: SVH_ID,
          }),
        }),
      );
    });

    it('calls the function the rule record names, not fn_svh_post', async () => {
      jest.spyOn(service, 'validate').mockResolvedValue([]);
      jest.spyOn(service, 'getById').mockResolvedValue({
        header: { svhId: SVH_ID, refno: 'TRF/x', status: 'IN_TRANSIT', postedOn: null } as never,
        lines: [],
      });
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhRefno: 'TRF/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        // loadHeaderOrThrow re-checks the document's identity against the rule
        // record and the scope — a mock missing these 404s.
        svhVoucherType: 'TRANSFER_OUT',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
      });
      client.$queryRaw.mockResolvedValue([{ rows: 1 }]);

      await service.post(TRANSFER_OUT_RULES, SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID, USER_ID);

      // $queryRaw is a tagged template: [strings, ...values]. The function
      // name is a Prisma.raw VALUE, not part of the static text — which is the
      // whole point, and why the allowlist below matters.
      const call = client.$queryRaw.mock.calls.at(-1) as unknown[];
      expect(JSON.stringify(call)).toContain('fn_svh_post_transfer');
      expect(JSON.stringify(call)).not.toContain('fn_svh_post(');
    });

    it('refuses a rule record wired to a function that is not one of the three', async () => {
      // Prisma.raw does not escape. The allowlist is what keeps the function
      // name unreachable from anything but a controller's own literal.
      jest.spyOn(service, 'validate').mockResolvedValue([]);
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhRefno: 'TRF/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        // loadHeaderOrThrow re-checks the document's identity against the rule
        // record and the scope — a mock missing these 404s.
        svhVoucherType: 'TRANSFER_OUT',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
      });
      await expect(
        service.post(
          { ...TRANSFER_OUT_RULES, postFunction: 'stock.fn_drop_everything' },
          SVH_ID,
          ACC_YEAR,
          COMPANY_ID,
          BRANCH_ID,
          USER_ID,
        ),
      ).rejects.toThrow(/not one of/);
    });

    it('runs the afterPost hook inside the post transaction', async () => {
      jest.spyOn(service, 'validate').mockResolvedValue([]);
      jest.spyOn(service, 'getById').mockResolvedValue({
        header: { svhId: SVH_ID, refno: 'TRF/x', status: 'IN_TRANSIT', postedOn: null } as never,
        lines: [],
      });
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhRefno: 'TRF/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        // loadHeaderOrThrow re-checks the document's identity against the rule
        // record and the scope — a mock missing these 404s.
        svhVoucherType: 'TRANSFER_OUT',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
      });
      client.$queryRaw.mockResolvedValue([{ rows: 3 }]);

      const hook = jest.fn().mockResolvedValue(undefined);
      await service.post(
        TRANSFER_OUT_RULES,
        SVH_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_ID,
        USER_ID,
        hook,
      );
      // The transaction client, and the row count the engine returned.
      expect(hook).toHaveBeenCalledWith(client, 3);
    });

    it('rolls the post back when the afterPost hook throws', async () => {
      // The reason the hook exists at all: a despatch must not commit with the
      // lorry missing.
      jest.spyOn(service, 'validate').mockResolvedValue([]);
      client.stockVoucher.findUnique.mockResolvedValue({
        svhId: SVH_ID,
        svhRefno: 'TRF/x',
        svhStatus: 'DRAFT',
        svhIsDeleted: false,
        // loadHeaderOrThrow re-checks the document's identity against the rule
        // record and the scope — a mock missing these 404s.
        svhVoucherType: 'TRANSFER_OUT',
        svhCompanyId: COMPANY_ID,
        svhBranchId: BRANCH_ID,
      });
      client.$queryRaw.mockResolvedValue([{ rows: 1 }]);
      await expect(
        service.post(TRANSFER_OUT_RULES, SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID, USER_ID, () => {
          throw new Error('transit update failed');
        }),
      ).rejects.toThrow('transit update failed');
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
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
              godownId: GODOWN_ID,
              qty: 0,
              costRate: 20,
            },
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
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
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
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
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
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
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
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
              godownId: GODOWN_ID,
              qty: 1,
              costRate: 20,
            },
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
              godownId: GODOWN_ID,
              qty: 2,
              costRate: 20,
            },
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
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
              godownId: GODOWN_ID,
              qty: 1,
              costRate: 0,
            },
          ],
        }),
        'names no rate source',
      );
    });

    // MANUAL means the storekeeper types the rate. There is nothing behind it
    // for the engine to read, so it must not excuse a zero the way the four
    // derivable sources do — otherwise a whole branch opens at zero value with
    // the check reporting itself satisfied.
    it('refuses an inward at cost 0 when the rate source is MANUAL', async () => {
      await expectRefusal(
        payload({
          header: { rateSource: 'MANUAL' } as never,
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
              godownId: GODOWN_ID,
              qty: 1,
              costRate: 0,
            },
          ],
        }),
        'which derives nothing',
      );
    });

    it.each(['AVG_COST', 'LAST_PURCHASE', 'LOT_COST', 'MRP'])(
      'allows an inward at cost 0 when the rate source is %s',
      async (rateSource) => {
        await service.save(
          OPENING_RULES,
          payload({
            header: { rateSource } as never,
            lines: [
              {
                lineNo: 1,
                itemId: ITEM_ID,
                uomId: UOM_ID,
                baseUomId: BASE_UOM_ID,
                toBaseFactor: 12,
                baseQty: 120,
                godownId: GODOWN_ID,
                qty: 1,
                costRate: 0,
              },
            ],
          }),
        );

        expect(client.stockVoucher.create).toHaveBeenCalled();
      },
    );

    // THE UNIT CROSS-CHECKS ARE GONE, deliberately and with a cost. The API
    // used to read item_unit_conversion on every save and refuse a unit
    // belonging to another item, or a uomId that was really a unit_id, as a
    // per-line 422. Both lived on the lookup that resolved the factor, and the
    // factor now comes from the payload, so the lookup went with it.
    //
    // What still refuses these: fk_svi_uom and fk_svi_base_uom reject an
    // iuc_id that does not exist — as a 23503 the filter maps to a 422, which
    // the engine-error table below still covers. NOTHING refuses a unit that
    // exists but belongs to a DIFFERENT item; that is the client's to get
    // right now.
    it('no longer opens item_unit_conversion on the save path', async () => {
      await service.save(OPENING_RULES, payload());

      expect(client.itemUnitConversion.findMany).not.toHaveBeenCalled();
    });
  });

  describe('the rest of the writable payload', () => {
    it('persists the header fields the first cut of this DTO left out', async () => {
      await service.save(
        OPENING_RULES,
        payload({
          header: {
            docDatetime: '2026-04-01T09:15:00+05:30',
            partyRef: 'DOCKET-77',
            usrRefno: 'OPEN-A',
            syncDate: '2026-04-02T04:00:00Z',
            linkSrcModule: 'STOCK',
            linkSrcDocType: 'MIGRATION',
            linkSrcDocId: SVH_ID,
            linkSrcAccYear: '2025-2026',
          } as never,
        }),
      );

      const header = client.stockVoucher.create.mock.calls[0][0].data;
      // A device syncing a week of offline documents must say when each was
      // keyed, or they all land at the same instant and their order is gone.
      expect(header.svhDocDatetime).toEqual(new Date('2026-04-01T09:15:00+05:30'));
      expect(header.svhPartyRef).toBe('DOCKET-77');
      expect(header.svhSyncDate).toEqual(new Date('2026-04-02T04:00:00Z'));
      expect(header).toMatchObject({
        svhLinkSrcModule: 'STOCK',
        svhLinkSrcDocType: 'MIGRATION',
        svhLinkSrcDocId: SVH_ID,
        svhLinkSrcAccYear: '2025-2026',
      });
    });

    it('omits docDatetime entirely when the caller names none, leaving the DB default', async () => {
      await service.save(OPENING_RULES, payload());

      expect(client.stockVoucher.create.mock.calls[0][0].data).not.toHaveProperty('svhDocDatetime');
    });

    it('persists the line fields the first cut left out', async () => {
      await service.save(
        OPENING_RULES,
        payload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              uomId: UOM_ID,
              baseUomId: BASE_UOM_ID,
              toBaseFactor: 12,
              baseQty: 120,
              godownId: GODOWN_ID,
              qty: 10,
              costRate: 20,
              weightQty: 9.7,
              landedRate: 22.5,
              syncDate: '2026-04-02T04:00:00Z',
            },
          ],
        }),
      );

      const line = createdLine();
      // Weight is carried, never derived: a 10kg bag that weighs 9.7kg opens at
      // what the scale said, and no conversion factor knows that.
      expect(Number(line.sviWeightQty)).toBe(9.7);
      expect(Number(line.sviLandedRate)).toBe(22.5);
      expect(line.sviSyncDate).toEqual(new Date('2026-04-02T04:00:00Z'));
    });

    it('refuses a negative weight — it is a magnitude like every other quantity', async () => {
      await expect(
        service.save(
          OPENING_RULES,
          payload({
            lines: [
              {
                lineNo: 1,
                itemId: ITEM_ID,
                uomId: UOM_ID,
                baseUomId: BASE_UOM_ID,
                toBaseFactor: 12,
                baseQty: 120,
                godownId: GODOWN_ID,
                qty: 1,
                costRate: 20,
                weightQty: -1,
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ status: 422 });
    });

    it('refuses a partial link-source triple — ck_svh_link is all four or none', async () => {
      await expect(
        service.save(
          OPENING_RULES,
          payload({ header: { linkSrcModule: 'STOCK', linkSrcDocType: 'MIGRATION' } as never }),
        ),
      ).rejects.toMatchObject({ status: 422 });
    });
  });

  describe('fields that belong to another voucher type', () => {
    // The DTO is shared by all eleven types, so these are gated by the rules
    // record rather than being absent from it.
    it('refuses toBranchId on a document that never leaves the branch', async () => {
      await expect(
        service.save(OPENING_RULES, payload({ header: { toBranchId: BRANCH_ID } as never })),
      ).rejects.toMatchObject({ status: 422 });
    });

    it('refuses a freeze window on a document that counts nothing', async () => {
      await expect(
        service.save(OPENING_RULES, payload({ header: { freezeStock: true } as never })),
      ).rejects.toMatchObject({ status: 422 });
    });

    it.each(['bookQty', 'countedQty'])(
      'refuses %s on a document that reconciles nothing',
      async (field) => {
        await expect(
          service.save(
            OPENING_RULES,
            payload({
              lines: [
                {
                  lineNo: 1,
                  itemId: ITEM_ID,
                  uomId: UOM_ID,
                  baseUomId: BASE_UOM_ID,
                  toBaseFactor: 12,
                  baseQty: 120,
                  godownId: GODOWN_ID,
                  qty: 1,
                  costRate: 20,
                  [field]: 5,
                } as never,
              ],
            }),
          ),
        ).rejects.toMatchObject({ status: 422 });
      },
    );

    // svi_lot_id is resolved by fn_slt_resolve at post. A client-chosen lot on
    // an opening would let two documents open the same holding under two lots.
    it('refuses a client-chosen lotId on a QTY document, and never writes one', async () => {
      await expect(
        service.save(
          OPENING_RULES,
          payload({
            lines: [
              {
                lineNo: 1,
                itemId: ITEM_ID,
                uomId: UOM_ID,
                baseUomId: BASE_UOM_ID,
                toBaseFactor: 12,
                baseQty: 120,
                godownId: GODOWN_ID,
                qty: 1,
                costRate: 20,
                lotId: SVH_ID,
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({ status: 422 });
      expect(client.stockVoucherItem.createMany).not.toHaveBeenCalled();
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

    it('reverses an OPENING in process, without ever naming fn_svh_cancel', async () => {
      client.stockVoucher.findUnique.mockResolvedValue(posted);
      // The header lock re-reads the status under FOR UPDATE; the moving-
      // average phase's advisory lock and the policy check share the mock.
      client.$queryRaw.mockResolvedValue([{ status: 'POSTED', refno: posted.svhRefno, locked: 1 }]);
      jest.spyOn(service, 'getById').mockResolvedValue({
        header: { svhId: SVH_ID, refno: posted.svhRefno, status: 'CANCELLED' } as never,
        lines: [],
      });

      const result = await service.cancel(
        OPENING_RULES,
        SVH_ID,
        ACC_YEAR,
        'wrong figures',
        COMPANY_ID,
        BRANCH_ID,
        USER_ID,
      );

      // stock.fn_svh_cancel does not exist on this deployment any more than
      // fn_svh_post does; a $queryRaw naming it is the 500 this path used to be.
      const named = client.$queryRaw.mock.calls.some((call: unknown[]) =>
        JSON.stringify(call).includes('fn_svh_cancel'),
      );
      expect(named).toBe(false);
      // Reversal rows, balances, the moving average and its stamp, lot totals
      // — five set-based statements.
      expect(client.$executeRaw).toHaveBeenCalledTimes(5);
      // The header moves to CANCELLED and carries NOTHING else about the
      // cancellation: who did it, when, and why are the trail's, and writing
      // them twice is what this asserts against.
      const [[headerUpdate]] = client.stockVoucher.update.mock.calls;
      expect(headerUpdate.data).toEqual(
        expect.objectContaining({ svhStatus: 'CANCELLED', svhVersionNo: { increment: 1 } }),
      );
      expect(Object.keys(headerUpdate.data)).toEqual(
        expect.not.arrayContaining(['svhCancelledOn', 'svhCancelledBy', 'svhCancelReason']),
      );
      expect(result.rowsReversed).toBe(2);
      expect(client.txnStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tslToStatus: 'CANCELLED',
            tslRemarks: 'wrong figures',
            tslChangedBy: USER_ID,
          }),
        }),
      );
    });

    it('refuses under the header lock when a concurrent cancel got there first', async () => {
      client.stockVoucher.findUnique.mockResolvedValue(posted);
      client.$queryRaw.mockResolvedValue([{ status: 'CANCELLED', refno: posted.svhRefno }]);

      await expect(
        service.cancel(OPENING_RULES, SVH_ID, ACC_YEAR, 'wrong figures', COMPANY_ID, BRANCH_ID),
      ).rejects.toMatchObject({ status: 409 });
      expect(client.$executeRaw).not.toHaveBeenCalled();
      expect(client.stockVoucher.update).not.toHaveBeenCalled();
    });

    it('still hands a transfer to stock.fn_svh_cancel — transit is not reversed here', async () => {
      const transferRules: StockVoucherTypeRules = {
        ...OPENING_RULES,
        voucherType: 'TRANSFER_OUT',
        displayName: 'Stock transfer',
        postFunction: 'stock.fn_svh_post_transfer',
      };
      client.stockVoucher.findUnique.mockResolvedValue({
        ...posted,
        svhVoucherType: 'TRANSFER_OUT',
        svhRefno: 'TRF/x',
      });
      client.$queryRaw.mockResolvedValue([{ rows: 1 }]);
      jest.spyOn(service, 'getById').mockResolvedValue({
        header: { svhId: SVH_ID, refno: 'TRF/x', status: 'CANCELLED' } as never,
        lines: [],
      });

      await service.cancel(
        transferRules,
        SVH_ID,
        ACC_YEAR,
        'sent by mistake',
        COMPANY_ID,
        BRANCH_ID,
      );

      const call = client.$queryRaw.mock.calls.at(-1) as unknown[];
      expect(JSON.stringify(call)).toContain('fn_svh_cancel');
      expect(client.$executeRaw).not.toHaveBeenCalled();
    });

    it('cancels a DRAFT by moving the header alone — no ledger, no engine', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({ ...posted, svhStatus: 'DRAFT' });
      // The draft path's only read is the header lock, which must see DRAFT.
      client.$queryRaw.mockResolvedValue([{ status: 'DRAFT', refno: posted.svhRefno }]);
      jest.spyOn(service, 'getById').mockResolvedValue({
        header: { svhId: SVH_ID, refno: posted.svhRefno, status: 'CANCELLED' } as never,
        lines: [],
      });

      const result = await service.cancel(
        OPENING_RULES,
        SVH_ID,
        ACC_YEAR,
        'raised by mistake',
        COMPANY_ID,
        BRANCH_ID,
        USER_ID,
      );

      // Nothing was written to stock_ledger, so nothing may be reversed: the
      // five set-based statements of a posted cancellation must not run.
      expect(client.$executeRaw).not.toHaveBeenCalled();
      expect(result.rowsReversed).toBe(0);
      const [[headerUpdate]] = client.stockVoucher.update.mock.calls;
      expect(headerUpdate.data).toEqual(
        expect.objectContaining({ svhStatus: 'CANCELLED', svhVersionNo: { increment: 1 } }),
      );
      // The reason is the whole difference between this and a soft delete, so
      // the trail row carries it and says CANCELLED, not DELETED.
      expect(client.txnStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tslFromStatus: 'DRAFT',
            tslToStatus: 'CANCELLED',
            tslRemarks: 'raised by mistake',
          }),
        }),
      );
    });

    it('refuses under the header lock when a DRAFT was posted mid-flight', async () => {
      client.stockVoucher.findUnique.mockResolvedValue({ ...posted, svhStatus: 'DRAFT' });
      client.$queryRaw.mockResolvedValue([{ status: 'POSTED', refno: posted.svhRefno }]);

      await expect(
        service.cancel(OPENING_RULES, SVH_ID, ACC_YEAR, 'raised by mistake', COMPANY_ID, BRANCH_ID),
      ).rejects.toMatchObject({ status: 409 });
      expect(client.stockVoucher.update).not.toHaveBeenCalled();
    });

    it('still refuses a DRAFT TRANSFER — cancelling it would strand the despatch', async () => {
      const transferRules: StockVoucherTypeRules = {
        ...OPENING_RULES,
        voucherType: 'TRANSFER_IN',
        displayName: 'Stock transfer receipt',
        postFunction: 'stock.fn_svh_receive_transfer',
      };
      client.stockVoucher.findUnique.mockResolvedValue({
        ...posted,
        svhStatus: 'DRAFT',
        svhVoucherType: 'TRANSFER_IN',
      });

      await expect(
        service.cancel(transferRules, SVH_ID, ACC_YEAR, 'sent by mistake', COMPANY_ID, BRANCH_ID),
      ).rejects.toMatchObject({ status: 409 });
      expect(client.stockVoucher.update).not.toHaveBeenCalled();
      expect(client.$queryRaw).not.toHaveBeenCalled();
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

  // ══════════════════════════════════════════════════════════════════════════
  //  §15 — PHYSICAL: a count is not an opening
  //
  //  Every assertion below is a rule the OPENING satisfied by accident, so
  //  each one is paired with the opening suite above rather than replacing it:
  //  the FIRST test of this module is that opening-stock-voucher still behaves.
  // ══════════════════════════════════════════════════════════════════════════
  describe('PHYSICAL — the six shared-service changes', () => {
    /**
     * The three holdings of 19_physical_stock_flow.md, as stock_balance holds
     * them: MILK 55 batch B-2604, SALT 120, SUGAR 60.
     */
    const balanceRow = (overrides: Record<string, unknown> = {}) => ({
      sbl_lot_id: LOT_ID,
      sbl_item_id: ITEM_ID,
      sbl_godown_id: GODOWN_ID,
      sbl_bucket: 'SALEABLE',
      sbl_base_uom_id: BASE_UOM_ID,
      sbl_on_hand_qty: new Prisma.Decimal(120),
      sbl_batch_no: 'B-2604',
      sbl_expiry_date: new Date('2027-04-01T00:00:00Z'),
      sbl_mrp: new Prisma.Decimal(25),
      sbl_sale_price: new Prisma.Decimal(24),
      sbl_supplier_id: null,
      slt_mfg_date: new Date('2026-04-01T00:00:00Z'),
      slt_serial_no: null,
      ...overrides,
    });

    /**
     * A COUNT save makes TWO raw calls inside the transaction — the numbering
     * helper's advisory lock, then the balance read — so the mock has to
     * dispatch on the statement rather than answer both the same way.
     */
    const stubBalance = (rows: Array<Record<string, unknown>> = [balanceRow()]) => {
      client.$queryRaw.mockImplementation((strings: TemplateStringsArray) =>
        Promise.resolve(
          strings.join(' ').includes('stock_balance')
            ? rows
            : [{ locked: 1, next_slno: BigInt(1) }],
        ),
      );
    };

    const countPayload = (overrides: Partial<SaveStockVoucherDto> = {}): SaveStockVoucherDto =>
      ({
        header: {
          accYear: ACC_YEAR,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          deviceId: DEVICE_ID,
          docDate: '2026-06-30',
          toGodownId: GODOWN_ID,
          userId: USER_ID,
          ...(overrides.header ?? {}),
        },
        lines: overrides.lines ?? [
          { lineNo: 1, itemId: ITEM_ID, godownId: GODOWN_ID, lotId: LOT_ID, countedQty: 118 },
        ],
      }) as SaveStockVoucherDto;

    const expectCountRefusal = async (dto: SaveStockVoucherDto, fragment: string) => {
      await expect(service.save(PHYSICAL_RULES, dto)).rejects.toMatchObject({
        response: {
          success: false,
          errors: expect.arrayContaining([
            expect.objectContaining({ message: expect.stringContaining(fragment) }),
          ]),
        },
      });
    };

    beforeEach(() => stubBalance());

    it('leaves the OPENING zero-quantity refusal alone — §3.2 gates, it does not relax', async () => {
      // The rule INVERTS under COUNT, so the proof that it was gated rather
      // than deleted is that an opening still trips it.
      await expect(
        service.save(
          OPENING_RULES,
          payload({
            lines: [
              {
                lineNo: 1,
                itemId: ITEM_ID,
                uomId: UOM_ID,
                baseUomId: BASE_UOM_ID,
                toBaseFactor: 12,
                baseQty: 120,
                godownId: GODOWN_ID,
                qty: 0,
                costRate: 20,
              },
            ],
          }),
        ),
      ).rejects.toMatchObject({
        response: {
          errors: expect.arrayContaining([
            expect.objectContaining({ message: 'Line 1 has no quantity.' }),
          ]),
        },
      });
    });

    it('accepts a count line with no quantity at all — every one of them has none', async () => {
      await service.save(PHYSICAL_RULES, countPayload());

      const line = createdLine();
      expect(Number(line.sviQty)).toBe(0);
      expect(Number(line.sviBaseQty)).toBe(0);
      expect(Number(line.sviFreeQty)).toBe(0);
      expect(Number(line.sviFreeBaseQty)).toBe(0);
      // §3.3 — 0 in BOTH directions, on purpose: the overage is valued from
      // the rate source, the shortage by fn_sml_cost_default.
      expect(Number(line.sviCostRate)).toBe(0);
    });

    it('refuses a count line that states a quantity to move — that is an ADJUSTMENT', async () => {
      await expectCountRefusal(
        countPayload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              godownId: GODOWN_ID,
              lotId: LOT_ID,
              countedQty: 118,
              qty: 5,
            },
          ] as never,
        }),
        'a count line states what was FOUND',
      );
    });

    it('refuses a client-supplied book quantity — a book figure the client chose is a wish', async () => {
      await expectCountRefusal(
        countPayload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              godownId: GODOWN_ID,
              lotId: LOT_ID,
              countedQty: 118,
              bookQty: 118,
            },
          ] as never,
        }),
        'bookQty is read from stock_balance',
      );
    });

    it('refuses an absent countedQty — absent is NOT COUNTED YET, not "0 found"', async () => {
      await expectCountRefusal(
        countPayload({
          lines: [{ lineNo: 7, itemId: ITEM_ID, godownId: GODOWN_ID, lotId: LOT_ID }] as never,
        }),
        'Line 7 has not been counted yet',
      );
    });

    it('accepts countedQty 0 — nothing found is a full shortage, and a real answer', async () => {
      await service.save(
        PHYSICAL_RULES,
        countPayload({
          lines: [
            { lineNo: 1, itemId: ITEM_ID, godownId: GODOWN_ID, lotId: LOT_ID, countedQty: 0 },
          ] as never,
        }),
      );

      const line = createdLine();
      expect(Number(line.sviCountedQty)).toBe(0);
      // svi_diff_qty is GENERATED as counted − book, so the shortage of 120 is
      // the DATABASE's arithmetic, never ours.
      expect(Number(line.sviBookQty)).toBe(120);
    });

    it('refuses a negative count — only the derived difference is signed', async () => {
      await expectCountRefusal(
        countPayload({
          lines: [
            { lineNo: 1, itemId: ITEM_ID, godownId: GODOWN_ID, lotId: LOT_ID, countedQty: -2 },
          ] as never,
        }),
        'countedQty is a count and cannot be negative',
      );
    });

    it('stores the book quantity stock_balance answered, not the one that was sent', async () => {
      // The line says 118 was counted; the shelf record says 120 was expected.
      // Nothing in the payload could have told the server 120.
      await service.save(PHYSICAL_RULES, countPayload());

      const line = createdLine();
      expect(Number(line.sviBookQty)).toBe(120);
      expect(Number(line.sviCountedQty)).toBe(118);
    });

    it('copies the holding onto the line, so the printed sheet and the document agree', async () => {
      await service.save(PHYSICAL_RULES, countPayload());

      const line = createdLine();
      expect(line.sviBatchNo).toBe('B-2604');
      expect(Number(line.sviMrp)).toBe(25);
      expect(Number(line.sviSalePrice)).toBe(24);
      expect(line.sviExpiryDate).toEqual(new Date('2027-04-01T00:00:00Z'));
      expect(line.sviMfgDate).toEqual(new Date('2026-04-01T00:00:00Z'));
    });

    it('writes the lot the sheet named, and counts in the base unit with factor 1', async () => {
      await service.save(PHYSICAL_RULES, countPayload());

      const line = createdLine();
      // The one place a count breaks the opening's iron rule: the lot is WHERE
      // THE BOOK FIGURE CAME FROM, and re-resolving would find a different one.
      expect(line.sviLotId).toBe(LOT_ID);
      expect(line.sviUomId).toBe(BASE_UOM_ID);
      expect(line.sviBaseUomId).toBe(BASE_UOM_ID);
      expect(Number(line.sviToBaseFactor)).toBe(1);
    });

    it('never sends the generated difference, on a document that is entirely about it', async () => {
      await service.save(PHYSICAL_RULES, countPayload());

      expect(createdLine()).not.toHaveProperty('sviDiffQty');
    });

    it('refuses a lot with no live balance row — the sheet is out of date', async () => {
      stubBalance([]);

      await expectCountRefusal(countPayload(), 'regenerate the count sheet');
    });

    it('refuses a lot that belongs to another item', async () => {
      stubBalance([balanceRow({ sbl_item_id: OTHER_ITEM_ID })]);

      await expectCountRefusal(countPayload(), 'belongs to another item');
    });

    it('refuses a line in a godown the count does not name — a count is per godown', async () => {
      await expectCountRefusal(
        countPayload({
          lines: [
            {
              lineNo: 1,
              itemId: ITEM_ID,
              godownId: OTHER_GODOWN_ID,
              lotId: LOT_ID,
              countedQty: 118,
            },
          ] as never,
        }),
        'is in a different godown',
      );
    });

    it('stores AVG_COST when the payload names no rate source — §3.3', async () => {
      await service.save(PHYSICAL_RULES, countPayload());

      // MANUAL, the honest default for an opening, makes the engine refuse an
      // overage line: there is nothing behind "the storekeeper types it" on a
      // count sheet.
      expect(client.stockVoucher.create.mock.calls[0][0].data.svhRateSource).toBe('AVG_COST');
    });

    it('honours an explicit rate source over the type default', async () => {
      await service.save(
        PHYSICAL_RULES,
        countPayload({ header: { rateSource: 'LAST_PURCHASE' } as never }),
      );

      expect(client.stockVoucher.create.mock.calls[0][0].data.svhRateSource).toBe('LAST_PURCHASE');
    });

    it('leaves the OPENING default alone — no defaultRateSource, no substitution', async () => {
      await service.save(OPENING_RULES, payload({ header: { rateSource: undefined } as never }));

      expect(client.stockVoucher.create.mock.calls[0][0].data.svhRateSource).toBeNull();
    });

    it('refuses a freeze with no window, before ck_svh_freeze fires', async () => {
      await expectCountRefusal(
        countPayload({ header: { freezeStock: true } as never }),
        'A freeze needs both freezeFrom and freezeTo',
      );
    });

    it('accepts a freeze with a window, and stores both instants', async () => {
      await service.save(
        PHYSICAL_RULES,
        countPayload({
          header: {
            freezeStock: true,
            freezeFrom: '2026-06-30T20:00:00+05:30',
            freezeTo: '2026-06-30T23:00:00+05:30',
          } as never,
        }),
      );

      const header = client.stockVoucher.create.mock.calls[0][0].data;
      expect(header.svhFreezeStock).toBe(true);
      expect(header.svhFreezeFrom).toEqual(new Date('2026-06-30T20:00:00+05:30'));
    });

    it('refuses a freeze window that ends before it starts, comparing INSTANTS', async () => {
      await expectCountRefusal(
        countPayload({
          header: {
            freezeStock: true,
            // Lexically '…20:00+05:30' sorts AFTER '…23:00Z'; in fact it is
            // 14:30Z and comes three and a half hours earlier.
            freezeFrom: '2026-06-30T23:00:00Z',
            freezeTo: '2026-06-30T20:00:00+05:30',
          } as never,
        }),
        'freezeTo must be after freezeFrom',
      );
    });

    // ── §5.3 — the reason, and the ledger's vocabulary ────────────────────
    //
    // srm_allowed_txn_types holds sml_txn_type values. Compared against the
    // DOCUMENT type, every reason the seed ships for counts would be refused —
    // a bug that stayed invisible because OPENING, the one type whose document
    // and ledger names coincide, cites no reasons at all.
    describe('the header reason', () => {
      const REASON_ID = '01000000-0000-7000-8000-000000000031';

      const stubReason = (overrides: Record<string, unknown> = {}) =>
        client.stockReasonMaster.findMany.mockResolvedValue([
          {
            srmId: REASON_ID,
            srmCode: 'SHRINK',
            srmName: 'Shrinkage',
            srmIsActive: true,
            srmAllowedTxnTypes: ['PHYSICAL_PLUS', 'PHYSICAL_MINUS'],
            srmRequireRemarks: false,
            ...overrides,
          },
        ]);

      it('accepts a reason scoped to the LEDGER types this document posts', async () => {
        stubReason();

        await service.save(
          PHYSICAL_RULES,
          countPayload({ header: { reasonId: REASON_ID } as never }),
        );

        expect(client.stockVoucher.create.mock.calls[0][0].data.svhReasonId).toBe(REASON_ID);
      });

      it('refuses a reason scoped to another movement entirely', async () => {
        stubReason({ srmAllowedTxnTypes: ['ADJUST_MINUS'], srmCode: 'WRITEOFF' });

        await expectCountRefusal(
          countPayload({ header: { reasonId: REASON_ID } as never }),
          'it is restricted to ADJUST_MINUS',
        );
      });

      it('treats an empty allowed-types array as permissive — it is the column default', async () => {
        stubReason({ srmAllowedTxnTypes: [] });

        await expect(
          service.save(PHYSICAL_RULES, countPayload({ header: { reasonId: REASON_ID } as never })),
        ).resolves.toBeDefined();
      });

      it('honours srm_require_remarks rather than inventing a second rule here', async () => {
        stubReason({ srmRequireRemarks: true, srmCode: 'DAMAGE', srmName: 'Damage' });

        await expectCountRefusal(
          countPayload({ header: { reasonId: REASON_ID } as never }),
          'requires a remark saying what happened',
        );
      });

      it('lets a line inherit the document remark for a reason that needs one', async () => {
        stubReason({ srmRequireRemarks: true });

        await expect(
          service.save(
            PHYSICAL_RULES,
            countPayload({
              header: { reasonId: REASON_ID, remarks: 'Half-yearly count, aisle 3' } as never,
              lines: [
                {
                  lineNo: 1,
                  itemId: ITEM_ID,
                  godownId: GODOWN_ID,
                  lotId: LOT_ID,
                  countedQty: 118,
                  reasonId: REASON_ID,
                },
              ] as never,
            }),
          ),
        ).resolves.toBeDefined();
      });

      it('refuses an inactive reason — retiring one was a decision', async () => {
        stubReason({ srmIsActive: false });

        await expectCountRefusal(
          countPayload({ header: { reasonId: REASON_ID } as never }),
          'is inactive',
        );
      });
    });

    it('refuses a count sheet for a document type that states its own lines', async () => {
      await expect(
        service.countSheet(OPENING_RULES, {
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          accYear: ACC_YEAR,
          godownId: GODOWN_ID,
        }),
      ).rejects.toMatchObject({ status: 422 });
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
    expect(json).toHaveBeenCalledWith(expect.objectContaining({ success: false, message }));
  });

  it('answers 409, not 422, when fn_sml_apply refuses to go negative on a cancel', () => {
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
    filter.catch(new HttpException({ success: false, message: 'nope', errors: [] }, 409), host);

    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({ success: false, message: 'nope', errors: [] });
  });
});
