import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { settleTransitShort } from '../stock-voucher/stock-voucher-posting.helper';
import { StockErrorCode } from '../types/stock-error-codes';
import { StockTransferService } from './stock-transfer.service';

// Short-settle's two collaborators that write: the engine's settle step and the
// status trail. Everything else in both modules stays real.
jest.mock('../stock-voucher/stock-voucher-posting.helper', () => ({
  ...jest.requireActual<object>('../stock-voucher/stock-voucher-posting.helper'),
  settleTransitShort: jest.fn(),
}));
jest.mock('src/common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('src/common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(),
}));
const settleMock = settleTransitShort as jest.MockedFunction<typeof settleTransitShort>;
const statusLogMock = appendTxnStatusLog as jest.MockedFunction<typeof appendTxnStatusLog>;
import { StockVoucherService } from '../stock-voucher/stock-voucher.service';
import type { SaveStockTransferDto } from './dto/save-stock-transfer.dto';
import type { SaveStockTransferReceiveDto } from './dto/save-stock-transfer-receive.dto';
import { TRANSFER_OUT_RULES } from './stock-transfer.controller';
import { TRANSFER_IN_RULES } from './stock-transfer-receive.controller';

const COMPANY_ID = '01000000-0000-7000-8000-0000000000c1';
const BRANCH_A = '01000000-0000-7000-8000-0000000000b1';
const BRANCH_B = '01000000-0000-7000-8000-0000000000b2';
const DEVICE_ID = '01000000-0000-7000-8000-0000000000d1';
const USER_ID = '01000000-0000-7000-8000-0000000000a1';
const GD_MAIN = '01000000-0000-7000-8000-0000000000e1';
const GD_COLD = '01000000-0000-7000-8000-0000000000e2';
const GD_STORE = '01000000-0000-7000-8000-0000000000e3';
const MILK = '01000000-0000-7000-8000-000000000001';
const SALT = '01000000-0000-7000-8000-000000000002';
const UOM_ID = '01000000-0000-7000-8000-000000000011';
const LOT_MILK = '01000000-0000-7000-8000-000000000021';
const LOT_SALT = '01000000-0000-7000-8000-000000000022';
const OUT_ID = '01000000-0000-7000-8000-0000000000f1';
const IN_ID = '01000000-0000-7000-8000-0000000000f2';
const ACC_YEAR = '2026-2027';

/**
 * The worked example of `20_stock_transfer_flow.md`: MILK batch B-2604, 55 on
 * hand at 28.00 in MAIN of branch A.
 */
const outPayload = (overrides: Record<string, unknown> = {}): SaveStockTransferDto =>
  ({
    header: {
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_A,
      deviceId: DEVICE_ID,
      docDate: '2026-04-01',
      fromGodownId: GD_MAIN,
      toGodownId: GD_COLD,
      userId: USER_ID,
      ...((overrides.header as object) ?? {}),
    },
    lines: (overrides.lines as unknown[]) ?? [
      { lineNo: 1, itemId: MILK, uomId: UOM_ID, godownId: GD_MAIN, lotId: LOT_MILK, qty: 20 },
    ],
  }) as SaveStockTransferDto;

const receivePayload = (overrides: Record<string, unknown> = {}): SaveStockTransferReceiveDto =>
  ({
    header: {
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_B,
      deviceId: DEVICE_ID,
      docDate: '2026-04-10',
      linkSrcDocId: OUT_ID,
      linkSrcAccYear: ACC_YEAR,
      userId: USER_ID,
      ...((overrides.header as object) ?? {}),
    },
    lines: (overrides.lines as unknown[]) ?? [
      { lineNo: 1, itemId: MILK, uomId: UOM_ID, godownId: GD_STORE, lotId: LOT_MILK, qty: 25 },
    ],
  }) as SaveStockTransferReceiveDto;

/** One stock.stock_transit row as loadTransitRows' raw SELECT returns it. */
const transitDbRow = (overrides: Record<string, unknown> = {}) => ({
  stt_id: '01000000-0000-7000-8000-000000000031',
  stt_status: 'IN_TRANSIT',
  stt_item_id: MILK,
  item_code: 'MILK',
  item_name: 'Milk 500ml',
  stt_lot_id: LOT_MILK,
  batch_no: 'B-2604',
  expiry_date: new Date('2026-06-30'),
  stt_to_godown_id: GD_STORE,
  to_godown_name: 'STORE',
  stt_bucket: 'SALEABLE',
  stt_base_uom_id: UOM_ID,
  unit_name: 'PCS',
  stt_sent_qty: new Prisma.Decimal(30),
  stt_received_qty: new Prisma.Decimal(0),
  stt_damage_qty: new Prisma.Decimal(0),
  remaining_qty: new Prisma.Decimal(30),
  stt_cost_rate: new Prisma.Decimal(28),
  stt_transit_value: new Prisma.Decimal(840),
  stt_lr_no: null,
  stt_vehicle_no: null,
  stt_expected_on: null,
  stt_sent_on: new Date('2026-04-02T06:00:00Z'),
  stt_received_on: null,
  ...overrides,
});

const outVoucherRow = (overrides: Record<string, unknown> = {}) => ({
  svh_id: OUT_ID,
  svh_acc_year: ACC_YEAR,
  svh_refno: 'TRF/2026-2027/TILL-01/2',
  svh_doc_date: new Date('2026-04-01'),
  svh_status: 'IN_TRANSIT',
  svh_branch_id: BRANCH_A,
  svh_from_godown_id: GD_MAIN,
  svh_to_branch_id: BRANCH_B,
  svh_to_godown_id: GD_STORE,
  svh_is_deleted: false,
  ...overrides,
});

/** What the shared service was handed on the Nth save — typed, not `any`. */
const savedPayload = (
  save: jest.Mock,
  call = 0,
): { header: Record<string, unknown>; lines: unknown[] } =>
  (save.mock.calls[call] as unknown[])[1] as { header: Record<string, unknown>; lines: unknown[] };

/** The status and body of the HttpException a call was refused with. */
const refusalOf = async (run: Promise<unknown>): Promise<{ status: number; body: unknown }> => {
  try {
    await run;
  } catch (error) {
    const http = error as { getStatus: () => number; getResponse: () => unknown };
    return { status: http.getStatus(), body: http.getResponse() };
  }
  throw new Error('expected the call to be refused, and it was not');
};

/** The 422 body the per-line refusals build. */
const detailsOf = async (run: Promise<unknown>): Promise<string[]> => {
  try {
    await run;
  } catch (error) {
    const body = (error as { response?: { errors?: Array<{ message: string }> } }).response;
    return (body?.errors ?? []).map((row) => row.message);
  }
  throw new Error('expected the call to be refused, and it was not');
};

describe('StockTransferService', () => {
  let service: StockTransferService;
  let voucherService: { save: jest.Mock; post: jest.Mock; getById: jest.Mock };
  let prisma: { $queryRaw: jest.Mock; stockTransit: { updateMany: jest.Mock } };

  /** The lot and balance reads assertLotsAndStock makes, in order. */
  const stockReads = (
    lots = [{ slt_id: LOT_MILK, slt_item_id: MILK, slt_company_id: COMPANY_ID }],
    balances = [
      {
        sbl_godown_id: GD_MAIN,
        sbl_item_id: MILK,
        sbl_lot_id: LOT_MILK,
        sbl_bucket: 'SALEABLE',
        sbl_on_hand_qty: new Prisma.Decimal(55),
        free_available_qty: new Prisma.Decimal(0),
      },
    ],
  ) => {
    prisma.$queryRaw.mockResolvedValueOnce(lots).mockResolvedValueOnce(balances);
  };

  beforeEach(() => {
    voucherService = {
      save: jest.fn().mockResolvedValue({ header: { svhId: OUT_ID }, lines: [] }),
      post: jest.fn(),
      getById: jest.fn(),
    };
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      stockTransit: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    service = new StockTransferService(
      prisma as unknown as PrismaService,
      voucherService as unknown as StockVoucherService,
      { getUserId: () => USER_ID } as unknown as RequestContextService,
      { postShortSettlement: jest.fn().mockResolvedValue(null) } as never,
    );
  });

  // ────────────────────────────────────────────────────────────────────────
  // The rule records — §2.2
  // ────────────────────────────────────────────────────────────────────────

  describe('the rule records', () => {
    it('routes the despatch to fn_svh_post_transfer and the receipt to fn_svh_receive_transfer', () => {
      // The single most consequential field on either record. fn_svh_post
      // refuses a transfer by name (0A000) precisely so this cannot go
      // unnoticed, but a receipt wired to the OUT function would post ledger
      // rows and never settle the transit row.
      expect(TRANSFER_OUT_RULES.postShape).toBe('TRANSFER_OUT');
      expect(TRANSFER_IN_RULES.postShape).toBe('TRANSFER_IN');
    });

    it('demands a lot on both halves — a transfer moves stock, it does not create it', () => {
      expect(TRANSFER_OUT_RULES.requiresLot).toBe(true);
      expect(TRANSFER_IN_RULES.requiresLot).toBe(true);
    });

    it('strips the line cost on both halves — MUST-FIX 5', () => {
      expect(TRANSFER_OUT_RULES.zeroesLineCost).toBe(true);
      expect(TRANSFER_IN_RULES.zeroesLineCost).toBe(true);
    });

    it('lets only the despatch name another branch', () => {
      expect(TRANSFER_OUT_RULES.allowsToBranch).toBe(true);
      expect(TRANSFER_IN_RULES.allowsToBranch).toBe(false);
    });

    it('demands both godowns on both halves — ck_svh_transfer_godowns covers the IN too', () => {
      for (const rules of [TRANSFER_OUT_RULES, TRANSFER_IN_RULES]) {
        expect(rules.requiresFromGodown).toBe(true);
        expect(rules.requiresToGodown).toBe(true);
      }
    });

    it('refuses the other type on each route', () => {
      expect(TRANSFER_OUT_RULES.refuseTypes).toContain('TRANSFER_IN');
      expect(TRANSFER_IN_RULES.refuseTypes).toContain('TRANSFER_OUT');
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // §3.2 — the despatch refusals
  // ────────────────────────────────────────────────────────────────────────

  describe('save — the refusals the engine does not make', () => {
    it('refuses a same-branch transfer from a godown to itself', async () => {
      const messages = await detailsOf(
        service.save(TRANSFER_OUT_RULES, outPayload({ header: { toGodownId: GD_MAIN } })),
      );
      expect(messages.join(' ')).toMatch(/source and destination godowns are the same/i);
      expect(voucherService.save).not.toHaveBeenCalled();
    });

    it('refuses a line that takes stock from the destination godown', async () => {
      const messages = await detailsOf(
        service.save(
          TRANSFER_OUT_RULES,
          outPayload({
            lines: [
              {
                lineNo: 1,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_COLD,
                lotId: LOT_MILK,
                qty: 20,
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/cannot transfer to itself/i);
    });

    it('ALLOWS the same godown id across branches — MAIN at A and MAIN at B are two godowns', async () => {
      // A chain names its godowns identically at every shop. Refusing this
      // would make the commonest inter-branch transfer impossible.
      stockReads();
      await service.save(
        TRANSFER_OUT_RULES,
        outPayload({ header: { toBranchId: BRANCH_B, toGodownId: GD_MAIN } }),
      );
      expect(voucherService.save).toHaveBeenCalled();
    });

    it('refuses two source godowns shipping one item+lot+bucket — MUST-FIX 3', async () => {
      // ux_stt_out_line drops the source godown (the destination is
      // header-level), so both lines make one transit key and the despatch dies
      // with a bare 23505 naming a partition-local index and no line number.
      const messages = await detailsOf(
        service.save(
          TRANSFER_OUT_RULES,
          outPayload({
            header: { toBranchId: BRANCH_B },
            lines: [
              {
                lineNo: 1,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_MAIN,
                lotId: LOT_MILK,
                qty: 10,
              },
              {
                lineNo: 2,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_COLD,
                lotId: LOT_MILK,
                qty: 10,
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/same transit row|two source godowns is two transfers/i);
    });

    it('refuses one item+lot shipped in two buckets — it despatches, then the RECEIPT cannot post', async () => {
      const messages = await detailsOf(
        service.save(
          TRANSFER_OUT_RULES,
          outPayload({
            header: { toBranchId: BRANCH_B },
            lines: [
              {
                lineNo: 1,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_MAIN,
                lotId: LOT_MILK,
                qty: 10,
                bucket: 'SALEABLE',
              },
              {
                lineNo: 2,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_MAIN,
                lotId: LOT_MILK,
                qty: 3,
                bucket: 'DAMAGED',
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/different bucket/i);
      expect(messages.join(' ')).toMatch(/two transfers/i);
    });

    it('allows two buckets on a SAME-BRANCH transfer — there is no transit row to collide', async () => {
      stockReads(
        [{ slt_id: LOT_MILK, slt_item_id: MILK, slt_company_id: COMPANY_ID }],
        [
          {
            sbl_godown_id: GD_MAIN,
            sbl_item_id: MILK,
            sbl_lot_id: LOT_MILK,
            sbl_bucket: 'SALEABLE',
            sbl_on_hand_qty: new Prisma.Decimal(55),
            free_available_qty: new Prisma.Decimal(0),
          },
          {
            sbl_godown_id: GD_MAIN,
            sbl_item_id: MILK,
            sbl_lot_id: LOT_MILK,
            sbl_bucket: 'DAMAGED',
            sbl_on_hand_qty: new Prisma.Decimal(5),
            free_available_qty: new Prisma.Decimal(0),
          },
        ],
      );
      await service.save(
        TRANSFER_OUT_RULES,
        outPayload({
          lines: [
            {
              lineNo: 1,
              itemId: MILK,
              uomId: UOM_ID,
              godownId: GD_MAIN,
              lotId: LOT_MILK,
              qty: 10,
              bucket: 'SALEABLE',
            },
            {
              lineNo: 2,
              itemId: MILK,
              uomId: UOM_ID,
              godownId: GD_MAIN,
              lotId: LOT_MILK,
              qty: 3,
              bucket: 'DAMAGED',
            },
          ],
        }),
      );
      expect(voucherService.save).toHaveBeenCalled();
    });

    it('refuses a lot belonging to a different item', async () => {
      // The most dangerous payload this screen can send: a valid lot of the
      // wrong item moves one item's stock under another's identity.
      stockReads([{ slt_id: LOT_MILK, slt_item_id: SALT, slt_company_id: COMPANY_ID }]);
      const messages = await detailsOf(service.save(TRANSFER_OUT_RULES, outPayload()));
      expect(messages.join(' ')).toMatch(/belongs to a different item/i);
    });

    it('refuses a lot belonging to another company', async () => {
      stockReads([
        {
          slt_id: LOT_MILK,
          slt_item_id: MILK,
          slt_company_id: '01000000-0000-7000-8000-0000000000c9',
        },
      ]);
      const messages = await detailsOf(service.save(TRANSFER_OUT_RULES, outPayload()));
      expect(messages.join(' ')).toMatch(/another company/i);
    });

    it('refuses sending more than the godown holds — the engine will NOT under an ALLOW policy', async () => {
      stockReads(undefined, [
        {
          sbl_godown_id: GD_MAIN,
          sbl_item_id: MILK,
          sbl_lot_id: LOT_MILK,
          sbl_bucket: 'SALEABLE',
          sbl_on_hand_qty: new Prisma.Decimal(15),
          free_available_qty: new Prisma.Decimal(0),
        },
      ]);
      const messages = await detailsOf(service.save(TRANSFER_OUT_RULES, outPayload()));
      expect(messages.join(' ')).toMatch(/sends 20 but this godown holds 15/i);
    });

    it('sums the document across lines drawing on ONE holding, not line by line', async () => {
      // Two rows of 15 against a holding of 20 pass every per-line check and
      // oversend by 10. The check is against the document's total.
      stockReads(undefined, [
        {
          sbl_godown_id: GD_MAIN,
          sbl_item_id: MILK,
          sbl_lot_id: LOT_MILK,
          sbl_bucket: 'SALEABLE',
          sbl_on_hand_qty: new Prisma.Decimal(20),
          free_available_qty: new Prisma.Decimal(0),
        },
      ]);
      const messages = await detailsOf(
        service.save(
          TRANSFER_OUT_RULES,
          outPayload({
            lines: [
              {
                lineNo: 1,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_MAIN,
                lotId: LOT_MILK,
                qty: 15,
              },
              {
                lineNo: 2,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_MAIN,
                lotId: LOT_MILK,
                qty: 15,
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/sends 30 but this godown holds 20/i);
    });

    it('counts freeQty against the holding — free stock is still stock', async () => {
      stockReads(undefined, [
        {
          sbl_godown_id: GD_MAIN,
          sbl_item_id: MILK,
          sbl_lot_id: LOT_MILK,
          sbl_bucket: 'SALEABLE',
          sbl_on_hand_qty: new Prisma.Decimal(20),
          free_available_qty: new Prisma.Decimal(0),
        },
      ]);
      const messages = await detailsOf(
        service.save(
          TRANSFER_OUT_RULES,
          outPayload({
            lines: [
              {
                lineNo: 1,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_MAIN,
                lotId: LOT_MILK,
                qty: 20,
                freeQty: 5,
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/sends 25 but this godown holds 20/i);
    });

    // Notes 160 A — Free 1 on a lot that never received free stock saved, and
    // the holding read free in 0 / free out 2.
    it('refuses free quantity above the free balance, at lines.<i>.freeQty, on each line that takes it', async () => {
      stockReads(undefined, [
        {
          sbl_godown_id: GD_MAIN,
          sbl_item_id: MILK,
          sbl_lot_id: LOT_MILK,
          sbl_bucket: 'SALEABLE',
          sbl_on_hand_qty: new Prisma.Decimal(50),
          free_available_qty: new Prisma.Decimal(2),
        },
      ]);
      const line = { itemId: MILK, uomId: UOM_ID, godownId: GD_MAIN, lotId: LOT_MILK, toBaseFactor: 1 };
      const refusal = await refusalOf(
        service.save(
          TRANSFER_OUT_RULES,
          outPayload({
            lines: [
              { ...line, lineNo: 1, qty: 5, freeQty: 2 },
              { ...line, lineNo: 2, qty: 5 },
              { ...line, lineNo: 3, qty: 5, freeQty: 1 },
            ],
          }),
        ),
      );
      const errors = (refusal.body as { errors: Array<{ field: string; code: string; message: string }> }).errors;
      expect(refusal.status).toBe(422);
      expect(errors.map((e) => [e.field, e.code])).toEqual([
        ['lines.0.freeQty', StockErrorCode.FREE_QTY_EXCEEDS_FREE_STOCK],
        ['lines.2.freeQty', StockErrorCode.FREE_QTY_EXCEEDS_FREE_STOCK],
      ]);
      expect(errors[0].message).toMatch(/sends 3 free, but only 2 .* came in free/);
      expect(voucherService.save).not.toHaveBeenCalled();
    });

    it('counts free in the base unit: freeQty × the line\'s factor', async () => {
      stockReads(undefined, [
        {
          sbl_godown_id: GD_MAIN,
          sbl_item_id: MILK,
          sbl_lot_id: LOT_MILK,
          sbl_bucket: 'SALEABLE',
          sbl_on_hand_qty: new Prisma.Decimal(50),
          free_available_qty: new Prisma.Decimal(10),
        },
      ]);
      await service.save(
        TRANSFER_OUT_RULES,
        outPayload({
          lines: [
            { lineNo: 1, itemId: MILK, uomId: UOM_ID, godownId: GD_MAIN, lotId: LOT_MILK, qty: 1, freeQty: 1, toBaseFactor: 10 },
          ],
        }),
      );
      expect(voucherService.save).toHaveBeenCalled();
    });

    it('treats a holding with no balance row as zero on hand', async () => {
      stockReads(undefined, []);
      const messages = await detailsOf(service.save(TRANSFER_OUT_RULES, outPayload()));
      expect(messages.join(' ')).toMatch(/this godown holds 0/i);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Notes 153 — which half of a transfer carries which box
  // ────────────────────────────────────────────────────────────────────────

  describe('notes 153 — loading and unloading by half', () => {
    const LOADMAN = '01000000-0000-7000-8000-0000000001a1';
    const codesOf = async (run: Promise<unknown>) => {
      try {
        await run;
      } catch (error) {
        const body = (error as { response?: { errors?: Array<{ field: string; code: string }> } })
          .response;
        return (body?.errors ?? []).map((row) => [row.field, row.code]);
      }
      throw new Error('expected the call to be refused, and it was not');
    };
    const rated = (over: Record<string, unknown>) => [
      { lineNo: 1, itemId: MILK, uomId: UOM_ID, godownId: GD_MAIN, lotId: LOT_MILK, qty: 20, ...over },
    ];

    it('lets a godown transfer carry both boxes and both charges — the shared service sums them', async () => {
      stockReads();
      await service.save(
        TRANSFER_OUT_RULES,
        outPayload({
          header: { loadEnabled: true, loadmanIds: [LOADMAN], unloadEnabled: true, unloadmanIds: [LOADMAN] },
          lines: rated({ loadRate: 2, unloadRate: 1.5 }),
        }),
      );
      expect(voucherService.save).toHaveBeenCalledTimes(1);
    });

    it('refuses the unloading box on a branch despatch — the receipt records it', async () => {
      await expect(
        codesOf(
          service.save(
            TRANSFER_OUT_RULES,
            outPayload({ header: { toBranchId: BRANCH_B, unloadmanIds: [LOADMAN] } }),
          ),
        ),
      ).resolves.toEqual([['unloadmanIds', StockErrorCode.LOADING_WRONG_HALF]]);
      await expect(
        codesOf(
          service.save(
            TRANSFER_OUT_RULES,
            outPayload({ header: { toBranchId: BRANCH_B }, lines: rated({ unloadRate: 1 }) }),
          ),
        ),
      ).resolves.toEqual([['lines.0.unloadRate', StockErrorCode.LOADING_WRONG_HALF]]);
      expect(voucherService.save).not.toHaveBeenCalled();
    });

    it("notes 156 — a branch despatch carries its loading box and its loading CHARGE (it posts at despatch)", async () => {
      stockReads();
      await service.save(
        TRANSFER_OUT_RULES,
        outPayload({
          header: { toBranchId: BRANCH_B, loadEnabled: true, loadmanIds: [LOADMAN], driverId: LOADMAN },
          lines: rated({ loadRate: 2 }),
        }),
      );
      expect(voucherService.save).toHaveBeenCalledTimes(1);
      expect(savedPayload(voucherService.save).lines[0]).toMatchObject({ loadRate: 2 });
    });

    it('E4: a transfer cites a BOTH reason — TRANSIT_LOSS (OUT) is the short-settlement\'s, refused on the header and a line', async () => {
      const LOSS = '01000000-0000-7000-8000-0000000002a1';
      const REPLENISH = '01000000-0000-7000-8000-0000000002a2';
      stockReads();
      prisma.$queryRaw.mockResolvedValueOnce([
        { srm_id: LOSS, srm_code: 'TRANSIT_LOSS', srm_direction: 'OUT' },
        { srm_id: REPLENISH, srm_code: 'REPLENISH', srm_direction: 'BOTH' },
      ]);
      await expect(
        codesOf(
          service.save(
            TRANSFER_OUT_RULES,
            outPayload({ header: { reasonId: LOSS }, lines: rated({ reasonId: REPLENISH }) }),
          ),
        ),
      ).resolves.toEqual([['reasonId', StockErrorCode.REASON_WRONG_DIRECTION]]);
      expect(voucherService.save).not.toHaveBeenCalled();

      stockReads();
      prisma.$queryRaw.mockResolvedValueOnce([
        { srm_id: REPLENISH, srm_code: 'REPLENISH', srm_direction: 'BOTH' },
      ]);
      await service.save(TRANSFER_OUT_RULES, outPayload({ header: { reasonId: REPLENISH } }));
      expect(voucherService.save).toHaveBeenCalledTimes(1);
    });

    it('refuses the loading box on a receipt, and keeps its unloading box and rates (they post with the receipt); driver and vehicle stand', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([outVoucherRow()])
        .mockResolvedValueOnce([transitDbRow()]);
      await expect(
        codesOf(
          service.saveReceive(
            TRANSFER_IN_RULES,
            receivePayload({ header: { loadmanIds: [LOADMAN], unloadEnabled: true }, lines: [
              { lineNo: 1, itemId: MILK, uomId: UOM_ID, godownId: GD_STORE, lotId: LOT_MILK, qty: 25, unloadRate: 1 },
            ] }),
          ),
        ),
      ).resolves.toEqual([['loadmanIds', StockErrorCode.LOADING_WRONG_HALF]]);

      prisma.$queryRaw
        .mockResolvedValueOnce([outVoucherRow()])
        .mockResolvedValueOnce([transitDbRow()]);
      await service.saveReceive(
        TRANSFER_IN_RULES,
        receivePayload({
          header: { unloadEnabled: true, unloadmanIds: [LOADMAN], driverId: LOADMAN, vehicleNo: 'TN 28 AB 1234' },
          lines: [
            { lineNo: 1, itemId: MILK, uomId: UOM_ID, godownId: GD_STORE, lotId: LOT_MILK, qty: 25, unloadRate: 0.5 },
          ],
        }),
      );
      expect(voucherService.save).toHaveBeenCalledTimes(1);
      expect(savedPayload(voucherService.save).lines[0]).toMatchObject({ unloadRate: 0.5 });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // §4 — despatch
  // ────────────────────────────────────────────────────────────────────────

  describe('despatch', () => {
    const postResult = (overrides: Record<string, unknown> = {}) => ({
      header: {
        svhId: OUT_ID,
        branchId: BRANCH_A,
        toBranchId: BRANCH_B,
        status: 'IN_TRANSIT',
        refno: 'TRF/2026-2027/TILL-01/2',
        ...overrides,
      },
      lines: [],
      rowsPosted: 1,
      status: 'IN_TRANSIT',
      postedOn: null,
    });

    it('writes the lorry INSIDE the post transaction, not after it', async () => {
      // §0.3: fn_svh_post_transfer never sets these three columns. Written in a
      // second transaction, a despatch could commit with the lorry missing.
      let hookRan = false;
      const tx = { stockTransit: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
      voucherService.post.mockImplementation(
        async (_r, _id, _y, _c, _b, _u, afterPost?: (t: unknown, n: number) => Promise<void>) => {
          if (afterPost) {
            await afterPost(tx, 1);
            hookRan = true;
          }
          return postResult();
        },
      );
      prisma.$queryRaw.mockResolvedValue([transitDbRow()]);

      await service.despatch(TRANSFER_OUT_RULES, {
        svhId: OUT_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_A,
        lrNo: 'LR-9911',
        vehicleNo: 'TN-01-AB-1234',
        expectedOn: '2026-04-05',
      });

      expect(hookRan).toBe(true);
      const update = (tx.stockTransit.updateMany.mock.calls[0] as unknown[])[0] as {
        where: Record<string, unknown>;
        data: Record<string, unknown>;
      };
      // Keyed by the OUT and its year — stock_transit is unpartitioned and
      // carries both halves' years separately.
      expect(update.where).toEqual({
        sttOutVoucherId: OUT_ID,
        sttOutAccYear: ACC_YEAR,
        sttIsDeleted: false,
      });
      expect(update.data.sttLrNo).toBe('LR-9911');
      expect(update.data.sttVehicleNo).toBe('TN-01-AB-1234');
      expect(update.data.sttExpectedOn).toEqual(new Date('2026-04-05'));
      // And never through the request-scoped client, which is a second txn.
      expect(prisma.stockTransit.updateMany).not.toHaveBeenCalled();
    });

    it('writes only the lorry fields it was sent, and clears the expected date on a null', async () => {
      const tx = { stockTransit: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
      voucherService.post.mockImplementation(
        async (_r, _id, _y, _c, _b, _u, afterPost?: (t: unknown, n: number) => Promise<void>) => {
          await afterPost?.(tx, 1);
          return postResult();
        },
      );
      prisma.$queryRaw.mockResolvedValue([transitDbRow()]);

      await service.despatch(TRANSFER_OUT_RULES, {
        svhId: OUT_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_A,
        vehicleNo: 'KL-07-1234',
        expectedOn: null,
      });

      const { data } = (tx.stockTransit.updateMany.mock.calls[0] as unknown[])[0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        sttVehicleNo: 'KL-07-1234',
        sttExpectedOn: null,
        sttModifiedOn: expect.any(Date),
        sttModifiedBy: USER_ID,
      });
    });

    it('passes no hook when the despatch carries no lorry', async () => {
      voucherService.post.mockImplementation((...args: unknown[]) => {
        // args[6] is the afterPost hook. Absent means nothing will be written
        // to stock_transit, which is right when no lorry was given.
        expect(args[6]).toBeUndefined();
        return Promise.resolve(postResult());
      });
      prisma.$queryRaw.mockResolvedValue([transitDbRow()]);
      await service.despatch(TRANSFER_OUT_RULES, {
        svhId: OUT_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_A,
      });
      expect(voucherService.post).toHaveBeenCalled();
    });

    it('reports the shape from the DOCUMENT, never from the request', async () => {
      voucherService.post.mockResolvedValue(postResult({ toBranchId: BRANCH_A, status: 'POSTED' }));
      prisma.$queryRaw.mockResolvedValue([]);
      const result = await service.despatch(TRANSFER_OUT_RULES, {
        svhId: OUT_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_A,
      });
      // to_branch = my branch is shape A, exactly as the engine reads it.
      expect(result.sameBranch).toBe(true);
      expect(result.transitRows).toBe(0);
    });

    it('reports an inter-branch despatch as IN_TRANSIT with its transit rows', async () => {
      voucherService.post.mockResolvedValue(postResult());
      prisma.$queryRaw.mockResolvedValue([transitDbRow()]);
      const result = await service.despatch(TRANSFER_OUT_RULES, {
        svhId: OUT_ID,
        accYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_A,
      });
      expect(result.sameBranch).toBe(false);
      expect(result.status).toBe('IN_TRANSIT');
      expect(result.transitRows).toBe(1);
      expect(result.transit[0]).toMatchObject({ sentQty: 30, remainingQty: 30, costRate: 28 });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // §6 — the prefill
  // ────────────────────────────────────────────────────────────────────────

  describe('prefill', () => {
    it('opens a second receipt at the REMAINDER, not the original quantity', async () => {
      // The bug this prevents: prefilling from the OUT's lines, which still say
      // 30 after 25 have arrived, lets a clerk receive the same 30 twice.
      prisma.$queryRaw.mockResolvedValueOnce([outVoucherRow()]).mockResolvedValueOnce([
        transitDbRow({
          stt_received_qty: new Prisma.Decimal(25),
          stt_damage_qty: new Prisma.Decimal(3),
          remaining_qty: new Prisma.Decimal(2),
          stt_status: 'PARTIAL',
        }),
      ]);
      const data = await service.prefill(COMPANY_ID, BRANCH_B, OUT_ID, ACC_YEAR);
      expect(data.rows).toHaveLength(1);
      expect(data.rows[0].remainingQty).toBe(2);
      expect(data.rows[0].sentQty).toBe(30);
      expect(data.rows[0].lineNo).toBe(1);
    });

    it('notes 154 #3 — names the sending branch and both godowns on outVoucher', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          outVoucherRow({ from_branch_name: 'Coimbatore', from_godown_name: 'MAIN', to_godown_name: 'STORE' }),
        ])
        .mockResolvedValueOnce([transitDbRow()]);
      const data = await service.prefill(COMPANY_ID, BRANCH_B, OUT_ID, ACC_YEAR);
      expect(data.outVoucher).toMatchObject({
        fromBranchId: BRANCH_A,
        fromBranchName: 'Coimbatore',
        fromGodownId: GD_MAIN,
        fromGodownName: 'MAIN',
        toGodownId: GD_STORE,
        toGodownName: 'STORE',
      });
    });

    it('refuses a despatch addressed to another branch', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([outVoucherRow({ svh_to_branch_id: BRANCH_A })]);
      await expect(service.prefill(COMPANY_ID, BRANCH_B, OUT_ID, ACC_YEAR)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('refuses a despatch the sender has deleted — the engine never checks it', async () => {
      // MUST-FIX 2: fn_svh_receive_transfer does not look at svh_is_deleted.
      prisma.$queryRaw.mockResolvedValueOnce([outVoucherRow({ svh_is_deleted: true })]);
      await expect(service.prefill(COMPANY_ID, BRANCH_B, OUT_ID, ACC_YEAR)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('refuses a despatch that is not IN_TRANSIT', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([outVoucherRow({ svh_status: 'DRAFT' })]);
      await expect(service.prefill(COMPANY_ID, BRANCH_B, OUT_ID, ACC_YEAR)).rejects.toMatchObject({
        status: 409,
      });
    });

    it('404s when the despatch does not exist', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.prefill(COMPANY_ID, BRANCH_B, OUT_ID, ACC_YEAR)).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // §7.2 — the receipt refusals
  // ────────────────────────────────────────────────────────────────────────

  describe('saveReceive', () => {
    const withTransit = (rows: unknown[], out = outVoucherRow()) => {
      prisma.$queryRaw.mockResolvedValueOnce([out]).mockResolvedValueOnce(rows);
    };

    it('stamps the link module and doc type and copies the godowns from the OUT', async () => {
      withTransit([transitDbRow()]);
      await service.saveReceive(TRANSFER_IN_RULES, receivePayload());
      const sent = savedPayload(voucherService.save);
      expect(sent.header.linkSrcModule).toBe('STOCK');
      expect(sent.header.linkSrcDocType).toBe('STOCK_VOUCHER');
      // ck_svh_transfer_godowns applies to the IN, and a receipt that named its
      // own godowns would describe a movement that did not happen.
      expect(sent.header.fromGodownId).toBe(GD_MAIN);
      expect(sent.header.toGodownId).toBe(GD_STORE);
    });

    it('refuses receiving more than remains, naming all four figures', async () => {
      withTransit([
        transitDbRow({
          stt_received_qty: new Prisma.Decimal(25),
          stt_damage_qty: new Prisma.Decimal(3),
          remaining_qty: new Prisma.Decimal(2),
        }),
      ]);
      const messages = await detailsOf(service.saveReceive(TRANSFER_IN_RULES, receivePayload()));
      expect(messages.join(' ')).toMatch(/receives 25 but only 2 of that lot is still in transit/i);
    });

    it('sums two lines against ONE transit row — 25 good and 3 broken is 28', async () => {
      // The worked example's own shape. Checked per line, 25 and 3 each pass
      // against a remainder of 27 and over-receive by 1.
      withTransit([
        transitDbRow({
          stt_sent_qty: new Prisma.Decimal(27),
          remaining_qty: new Prisma.Decimal(27),
        }),
      ]);
      const messages = await detailsOf(
        service.saveReceive(
          TRANSFER_IN_RULES,
          receivePayload({
            lines: [
              {
                lineNo: 1,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_STORE,
                lotId: LOT_MILK,
                qty: 25,
                bucket: 'SALEABLE',
              },
              {
                lineNo: 2,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_STORE,
                lotId: LOT_MILK,
                qty: 3,
                bucket: 'DAMAGED',
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/receives 28 but only 27/i);
    });

    it('accepts 25 SALEABLE + 3 DAMAGED against a 30-unit shipment — the worked example', async () => {
      withTransit([transitDbRow()]);
      await service.saveReceive(
        TRANSFER_IN_RULES,
        receivePayload({
          lines: [
            {
              lineNo: 1,
              itemId: MILK,
              uomId: UOM_ID,
              godownId: GD_STORE,
              lotId: LOT_MILK,
              qty: 25,
              bucket: 'SALEABLE',
            },
            {
              lineNo: 2,
              itemId: MILK,
              uomId: UOM_ID,
              godownId: GD_STORE,
              lotId: LOT_MILK,
              qty: 3,
              bucket: 'DAMAGED',
            },
          ],
        }),
      );
      // The missing 2 get NO line — a short is what remains unkeyed.
      expect(voucherService.save).toHaveBeenCalled();
      expect(savedPayload(voucherService.save).lines).toHaveLength(2);
    });

    it('refuses a DAMAGED shipment received as SALEABLE — laundering, SHOULD-FIX', async () => {
      // The engine only checks the other direction, so this posts damaged goods
      // into the clean bucket silently.
      withTransit([transitDbRow({ stt_bucket: 'DAMAGED' })]);
      const messages = await detailsOf(
        service.saveReceive(
          TRANSFER_IN_RULES,
          receivePayload({
            lines: [
              {
                lineNo: 1,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_STORE,
                lotId: LOT_MILK,
                qty: 25,
                bucket: 'SALEABLE',
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/shipped as DAMAGED and is being received as SALEABLE/i);
    });

    it('ALLOWS a SALEABLE shipment received as DAMAGED — it broke on the lorry', async () => {
      withTransit([transitDbRow()]);
      await service.saveReceive(
        TRANSFER_IN_RULES,
        receivePayload({
          lines: [
            {
              lineNo: 1,
              itemId: MILK,
              uomId: UOM_ID,
              godownId: GD_STORE,
              lotId: LOT_MILK,
              qty: 3,
              bucket: 'DAMAGED',
            },
          ],
        }),
      );
      expect(voucherService.save).toHaveBeenCalled();
    });

    it('refuses a line matching no open transit row', async () => {
      withTransit([transitDbRow()]);
      const messages = await detailsOf(
        service.saveReceive(
          TRANSFER_IN_RULES,
          receivePayload({
            lines: [
              {
                lineNo: 1,
                itemId: SALT,
                uomId: UOM_ID,
                godownId: GD_STORE,
                lotId: LOT_SALT,
                qty: 5,
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/nothing of this lot is in transit to this godown/i);
    });

    it('refuses a line whose godown is the SOURCE — the meaning flips at the receipt', async () => {
      withTransit([transitDbRow()]);
      const messages = await detailsOf(
        service.saveReceive(
          TRANSFER_IN_RULES,
          receivePayload({
            lines: [
              {
                lineNo: 1,
                itemId: MILK,
                uomId: UOM_ID,
                godownId: GD_MAIN,
                lotId: LOT_MILK,
                qty: 25,
              },
            ],
          }),
        ),
      );
      expect(messages.join(' ')).toMatch(/godownId here is the DESTINATION/i);
    });

    it('refuses an empty receipt — nothing arrived is not a receipt', async () => {
      withTransit([transitDbRow()]);
      const messages = await detailsOf(
        service.saveReceive(TRANSFER_IN_RULES, receivePayload({ lines: [] })),
      );
      expect(messages.join(' ')).toMatch(/a short is what remains unkeyed/i);
    });

    it('refuses a receipt against a despatch shipped in two buckets — 0A000 territory', async () => {
      withTransit([transitDbRow(), transitDbRow({ stt_bucket: 'DAMAGED', stt_id: 'x' })]);
      const messages = await detailsOf(service.saveReceive(TRANSFER_IN_RULES, receivePayload()));
      expect(messages.join(' ')).toMatch(/more than one bucket/i);
    });

    it('404s when the receipt names a despatch that does not exist', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);
      await expect(service.saveReceive(TRANSFER_IN_RULES, receivePayload())).rejects.toMatchObject({
        status: 404,
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // §8 — posting the receipt
  // ────────────────────────────────────────────────────────────────────────

  describe('receive', () => {
    beforeEach(() => {
      voucherService.getById.mockResolvedValue({
        header: {
          svhId: IN_ID,
          refno: 'TRI/2026-2027/TILL-07/1',
          linkSrcDocId: OUT_ID,
          linkSrcAccYear: ACC_YEAR,
        },
        lines: [],
      });
      voucherService.post.mockResolvedValue({
        header: { svhId: IN_ID, status: 'POSTED' },
        lines: [],
        rowsPosted: 2,
        status: 'POSTED',
        postedOn: null,
      });
    });

    it('reports the despatch as STILL OPEN when a short remains', async () => {
      // B6d of the flow doc: the receipt is POSTED and the transfer is not.
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { svh_id: OUT_ID, svh_acc_year: ACC_YEAR, svh_refno: 'TRF/x', svh_status: 'IN_TRANSIT' },
        ])
        .mockResolvedValueOnce([
          transitDbRow({
            stt_received_qty: new Prisma.Decimal(25),
            stt_damage_qty: new Prisma.Decimal(3),
            remaining_qty: new Prisma.Decimal(2),
            stt_status: 'PARTIAL',
          }),
        ]);
      const result = await service.receive(
        TRANSFER_IN_RULES,
        IN_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_B,
      );
      expect(result.inVoucher.status).toBe('POSTED');
      expect(result.outVoucher.status).toBe('IN_TRANSIT');
      expect(result.outVoucher.closed).toBe(false);
      expect(result.transit[0].remainingQty).toBe(2);
    });

    it('reports the despatch as closed when nothing is left', async () => {
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { svh_id: OUT_ID, svh_acc_year: ACC_YEAR, svh_refno: 'TRF/x', svh_status: 'RECEIVED' },
        ])
        .mockResolvedValueOnce([
          transitDbRow({
            stt_received_qty: new Prisma.Decimal(27),
            stt_damage_qty: new Prisma.Decimal(3),
            remaining_qty: new Prisma.Decimal(0),
            stt_status: 'RECEIVED',
          }),
        ]);
      const result = await service.receive(
        TRANSFER_IN_RULES,
        IN_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_B,
      );
      expect(result.outVoucher.closed).toBe(true);
      expect(result.outVoucher.status).toBe('RECEIVED');
    });

    it('refuses to post a receipt that links no despatch', async () => {
      voucherService.getById.mockResolvedValue({
        header: { svhId: IN_ID, refno: 'TRI/x', linkSrcDocId: null, linkSrcAccYear: null },
        lines: [],
      });
      await expect(
        service.receive(TRANSFER_IN_RULES, IN_ID, ACC_YEAR, COMPANY_ID, BRANCH_B),
      ).rejects.toMatchObject({ status: 409 });
      expect(voucherService.post).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // save — the lot and stock reads, at their edges
  // ────────────────────────────────────────────────────────────────────────

  describe('save — lots and stock, at the edges', () => {
    const lotlessLine = { lineNo: 2, itemId: SALT, uomId: UOM_ID, godownId: GD_MAIN, qty: 4 };

    /** The codes of the 422 a save was refused with. */
    const codesOf = async (run: Promise<unknown>): Promise<string[]> => {
      const error = await run.then(
        () => null,
        (caught: unknown) => caught,
      );
      if (!(error instanceof HttpException)) throw new Error('expected an HttpException');
      expect(error.getStatus()).toBe(422);
      return (error.getResponse() as { errors: Array<{ code: string }> }).errors.map((e) => e.code);
    };

    it('reads nothing when no line names a lot — the shared service refuses those lines itself', async () => {
      await service.save(
        TRANSFER_OUT_RULES,
        outPayload({ lines: [{ ...lotlessLine, lineNo: 1 }] }),
      );

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(voucherService.save).toHaveBeenCalled();
    });

    it('checks only the lines that name a lot in a mixed document', async () => {
      stockReads();

      await service.save(
        TRANSFER_OUT_RULES,
        outPayload({
          lines: [
            { lineNo: 1, itemId: MILK, uomId: UOM_ID, godownId: GD_MAIN, lotId: LOT_MILK, qty: 20 },
            lotlessLine,
          ],
        }),
      );

      expect(voucherService.save).toHaveBeenCalled();
    });

    it('refuses a lot that does not exist, alongside the stock it cannot cover', async () => {
      stockReads([], []);

      await expect(codesOf(service.save(TRANSFER_OUT_RULES, outPayload()))).resolves.toEqual([
        StockErrorCode.LOT_NOT_FOUND,
        StockErrorCode.INSUFFICIENT_STOCK,
      ]);
      expect(voucherService.save).not.toHaveBeenCalled();
    });

    it('reports an over-sent holding once, on the first line drawing on it', async () => {
      stockReads(undefined, [
        {
          sbl_godown_id: GD_MAIN,
          sbl_item_id: MILK,
          sbl_lot_id: LOT_MILK,
          sbl_bucket: 'SALEABLE',
          sbl_on_hand_qty: new Prisma.Decimal(5),
          free_available_qty: new Prisma.Decimal(0),
        },
      ]);
      const line = { itemId: MILK, uomId: UOM_ID, godownId: GD_MAIN, lotId: LOT_MILK, qty: 3 };

      await expect(
        codesOf(
          service.save(
            TRANSFER_OUT_RULES,
            outPayload({ lines: [{ ...line, lineNo: 1 }, { ...line, lineNo: 2 }, lotlessLine] }),
          ),
        ),
      ).resolves.toEqual([StockErrorCode.INSUFFICIENT_STOCK]);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // §5 — getOne and the inbound worklist
  // ────────────────────────────────────────────────────────────────────────

  /** The bound values of the Nth raw query — the tagged template's arguments after the strings. */
  const boundValues = (call: number): unknown[] =>
    (prisma.$queryRaw.mock.calls[call] as unknown[]).slice(1);

  describe('getOne', () => {
    it('loads the document through the shared service and adds every transit row, settled ones too', async () => {
      voucherService.getById.mockResolvedValue({ header: { svhId: OUT_ID }, lines: [] });
      prisma.$queryRaw.mockResolvedValueOnce([
        transitDbRow({ stt_status: 'RECEIVED', remaining_qty: new Prisma.Decimal(0) }),
      ]);

      const result = await service.getOne(
        TRANSFER_OUT_RULES,
        OUT_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_A,
      );

      expect(voucherService.getById).toHaveBeenCalledWith(
        TRANSFER_OUT_RULES,
        OUT_ID,
        ACC_YEAR,
        COMPANY_ID,
        BRANCH_A,
      );
      expect(boundValues(0)).toEqual([OUT_ID, ACC_YEAR, false]);
      expect(result.header).toEqual({ svhId: OUT_ID });
      expect(result.transit).toEqual([
        expect.objectContaining({ status: 'RECEIVED', remainingQty: 0 }),
      ]);
    });
  });

  // Notes 154 #1 — a receipt read back under its OWN rules.
  describe('getReceipt', () => {
    it("loads under the TRANSFER_IN rules, names the despatch and its branch, and adds the despatch's transit rows", async () => {
      voucherService.getById.mockResolvedValue({
        header: { svhId: IN_ID, linkSrcDocId: OUT_ID, linkSrcAccYear: ACC_YEAR },
        lines: [],
      });
      prisma.$queryRaw
        .mockResolvedValueOnce([
          { svh_refno: 'TRF/2026-2027/TILL-01/2', svh_branch_id: BRANCH_A, branch_name: 'Coimbatore' },
        ])
        .mockResolvedValueOnce([transitDbRow({ stt_status: 'PARTIAL' })]);

      const result = await service.getReceipt(TRANSFER_IN_RULES, IN_ID, ACC_YEAR, COMPANY_ID, BRANCH_B);

      expect(voucherService.getById).toHaveBeenCalledWith(TRANSFER_IN_RULES, IN_ID, ACC_YEAR, COMPANY_ID, BRANCH_B);
      // The despatch by its link and company only — it is the other branch's document.
      expect(boundValues(0)).toEqual([OUT_ID, ACC_YEAR, COMPANY_ID]);
      expect(boundValues(1)).toEqual([OUT_ID, ACC_YEAR, false]);
      expect(result.header).toEqual({
        svhId: IN_ID,
        linkSrcDocId: OUT_ID,
        linkSrcAccYear: ACC_YEAR,
        linkSrcRefno: 'TRF/2026-2027/TILL-01/2',
        fromBranchId: BRANCH_A,
        fromBranchName: 'Coimbatore',
      });
      expect(result.transit).toEqual([expect.objectContaining({ status: 'PARTIAL' })]);
    });

    it('answers nulls and no transit for a receipt that links nothing, without reading', async () => {
      voucherService.getById.mockResolvedValue({
        header: { svhId: IN_ID, linkSrcDocId: null, linkSrcAccYear: null },
        lines: [],
      });

      const result = await service.getReceipt(TRANSFER_IN_RULES, IN_ID, ACC_YEAR, COMPANY_ID, BRANCH_B);

      expect(prisma.$queryRaw).not.toHaveBeenCalled();
      expect(result.header).toMatchObject({ linkSrcRefno: null, fromBranchId: null, fromBranchName: null });
      expect(result.transit).toEqual([]);
    });
  });

  describe('inbound', () => {
    const inboundRow = (overrides: Record<string, unknown> = {}) => ({
      ...transitDbRow(),
      stt_cost_rate_wot: new Prisma.Decimal(25),
      stt_out_voucher_id: OUT_ID,
      // character(9), as the driver hands back a padded bpchar.
      stt_out_acc_year: ACC_YEAR,
      stt_out_refno: 'TRF/2026-2027/TILL-01/2',
      stt_from_branch_id: BRANCH_A,
      from_branch_name: 'Coimbatore',
      from_godown_name: 'MAIN',
      days_in_flight: 9,
      total_count: BigInt(3),
      ...overrides,
    });

    it('maps each open transit row, with where it came from and how long it has been out', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        inboundRow({
          stt_lr_no: 'LR-77',
          stt_vehicle_no: 'KL-07-1234',
          stt_expected_on: new Date('2026-04-05T00:00:00Z'),
          stt_received_on: new Date('2026-04-06T08:00:00Z'),
          stt_received_qty: new Prisma.Decimal(10),
          remaining_qty: new Prisma.Decimal(20),
          stt_status: 'PARTIAL',
        }),
      ]);

      const result = await service.inbound(COMPANY_ID, BRANCH_B, 25, 50);

      expect(boundValues(0)).toEqual([COMPANY_ID, BRANCH_B, 25, 50]);
      expect(result).toEqual({
        items: [
          {
            sttId: '01000000-0000-7000-8000-000000000031',
            status: 'PARTIAL',
            itemId: MILK,
            itemCode: 'MILK',
            itemName: 'Milk 500ml',
            lotId: LOT_MILK,
            batchNo: 'B-2604',
            expiryDate: '2026-06-30',
            toGodownId: GD_STORE,
            toGodownName: 'STORE',
            bucket: 'SALEABLE',
            baseUomId: UOM_ID,
            unitName: 'PCS',
            sentQty: 30,
            receivedQty: 10,
            damageQty: 0,
            remainingQty: 20,
            costRate: 28,
            costRateWot: 25,
            transitValue: 840,
            lrNo: 'LR-77',
            vehicleNo: 'KL-07-1234',
            expectedOn: '2026-04-05',
            sentOn: '2026-04-02T06:00:00.000Z',
            receivedOn: '2026-04-06T08:00:00.000Z',
            // Notes 154 #2 — enough to open the prefill, and who sent it.
            outVoucherId: OUT_ID,
            outAccYear: ACC_YEAR,
            outRefno: 'TRF/2026-2027/TILL-01/2',
            fromBranchId: BRANCH_A,
            fromBranchName: 'Coimbatore',
            fromGodownName: 'MAIN',
            daysInFlight: 9,
          },
        ],
        meta: { limit: 25, offset: 50, count: 3 },
      });
      const sql = (prisma.$queryRaw.mock.calls[0][0] as TemplateStringsArray).join('?');
      expect(sql).toContain('LEFT JOIN public.branch_master fb ON fb.br_id = t.stt_from_branch_id');
      expect(sql).toContain('LEFT JOIN inventory.godown_locations fg ON fg.gdl_id = t.stt_from_godown_id');
    });

    it('pages 100 from the start by default, and reads a missing day count and dates as empty', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([
        inboundRow({ days_in_flight: null, expiry_date: null, stt_sent_on: null }),
      ]);

      const result = await service.inbound(COMPANY_ID, BRANCH_B);

      expect(boundValues(0)).toEqual([COMPANY_ID, BRANCH_B, 100, 0]);
      expect(result.items[0]).toMatchObject({ daysInFlight: 0, expiryDate: null, sentOn: null });
    });

    it('counts nothing when nothing is on its way', async () => {
      prisma.$queryRaw.mockResolvedValueOnce([]);

      await expect(service.inbound(COMPANY_ID, BRANCH_B)).resolves.toEqual({
        items: [],
        meta: { limit: 100, offset: 0, count: 0 },
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // §1.1 — short-settle
  // ────────────────────────────────────────────────────────────────────────

  describe('settleShort', () => {
    const REASON_ID = '01000000-0000-7000-8000-0000000000e9';
    const OTHER_USER = '01000000-0000-7000-8000-0000000000a2';
    let accounts: { postShortSettlement: jest.Mock };
    let tx: { $queryRaw: jest.Mock };
    let settling: StockTransferService;

    const args = (overrides: Record<string, unknown> = {}) => ({
      outVoucherId: OUT_ID,
      accYear: ACC_YEAR,
      companyId: COMPANY_ID,
      branchId: BRANCH_A,
      reasonId: REASON_ID,
      ...overrides,
    });
    const reasonRow = (overrides: Record<string, unknown> = {}) => ({
      srm_id: REASON_ID,
      srm_direction: 'OUT',
      srm_is_active: true,
      ...overrides,
    });
    const settledRow = (shortQty: number, shortValue: number) => ({
      sttId: '01000000-0000-7000-8000-000000000031',
      itemId: MILK,
      lotId: LOT_MILK,
      toGodownId: GD_STORE,
      bucket: 'SALEABLE',
      shortQty: new Prisma.Decimal(shortQty),
      costRate: new Prisma.Decimal(28),
      shortValue: new Prisma.Decimal(shortValue),
    });

    beforeEach(() => {
      settleMock.mockReset();
      statusLogMock.mockReset();
      settleMock.mockResolvedValue({
        refno: 'TRF/2026-2027/TILL-01/2',
        rows: [settledRow(2, 56), settledRow(1, 28)],
      });
      statusLogMock.mockResolvedValue({} as never);
      accounts = {
        postShortSettlement: jest.fn().mockResolvedValue({
          voucherId: 'avh-1',
          voucherRefno: 'Jrl/7',
          amount: 84,
          legCount: 2,
        }),
      };
      tx = {
        $queryRaw: jest
          .fn()
          .mockResolvedValue([
            { svh_tenant_id: 'tenant-1', svh_device_id: DEVICE_ID, svh_session_id: 'session-1' },
          ]),
      };
      Object.assign(prisma, {
        $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
      });
      settling = new StockTransferService(
        prisma as unknown as PrismaService,
        voucherService as unknown as StockVoucherService,
        { getUserId: () => USER_ID } as unknown as RequestContextService,
        accounts as never,
      );
    });

    /** The reason read, then (after the transaction) the transit reload. */
    const reads = (reason: unknown[] = [reasonRow()], transit = [transitDbRow()]) => {
      prisma.$queryRaw.mockResolvedValueOnce(reason).mockResolvedValueOnce(transit);
    };

    it.each([
      ['a reason that does not exist', [], StockErrorCode.REASON_NOT_FOUND],
      ['an inactive reason', [reasonRow({ srm_is_active: false })], StockErrorCode.REASON_INACTIVE],
      [
        'a reason for stock found, not lost',
        [reasonRow({ srm_direction: 'IN' })],
        StockErrorCode.REASON_WRONG_DIRECTION,
      ],
    ])('refuses %s before opening a transaction', async (_label, reason, code) => {
      reads(reason);

      const error = await settling.settleShort(args()).catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(422);
      expect((error as HttpException).getResponse()).toMatchObject({
        errors: [{ field: 'reasonId', code }],
      });
      expect(settleMock).not.toHaveBeenCalled();
      expect(accounts.postShortSettlement).not.toHaveBeenCalled();
    });

    it('accepts a reason that points both ways', async () => {
      reads([reasonRow({ srm_direction: 'BOTH' })]);

      await expect(settling.settleShort(args())).resolves.toMatchObject({ rowsSettled: 2 });
    });

    it('settles, posts the loss and files the CLOSED step in one transaction, then reloads the rows', async () => {
      reads();

      const result = await settling.settleShort(args({ remarks: '  lost on the ghat road  ' }));

      expect(boundValues(0)).toEqual([REASON_ID, COMPANY_ID]);
      expect(settleMock).toHaveBeenCalledWith(tx, {
        outId: OUT_ID,
        outAccYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_A,
        reasonId: REASON_ID,
        remarks: 'lost on the ghat road',
        actor: USER_ID,
        settledOn: expect.any(Date),
      });
      expect(accounts.postShortSettlement).toHaveBeenCalledWith(tx, {
        outId: OUT_ID,
        outAccYear: ACC_YEAR,
        companyId: COMPANY_ID,
        branchId: BRANCH_A,
        refno: 'TRF/2026-2027/TILL-01/2',
        reasonId: REASON_ID,
        remarks: 'lost on the ghat road',
        rows: [settledRow(2, 56), settledRow(1, 28)],
        actor: USER_ID,
        settledOn: expect.any(Date),
      });
      expect(statusLogMock).toHaveBeenCalledWith(tx, {
        companyId: COMPANY_ID,
        branchId: BRANCH_A,
        tenantId: 'tenant-1',
        accYear: ACC_YEAR,
        srcModule: TxnStatusSrcModule.INVENTORY,
        srcDocType: TxnStatusDocType.STOCK_TRANSFER,
        srcDocId: OUT_ID,
        srcDocRefno: 'TRF/2026-2027/TILL-01/2',
        event: TxnStatusEvent.CLOSED,
        fromStatus: 'IN_TRANSIT',
        toStatus: 'RECEIVED',
        changedOn: expect.any(Date),
        changedBy: USER_ID,
        remarks: 'lost on the ghat road',
        deviceId: DEVICE_ID,
        sessionId: 'session-1',
      });
      expect(result).toEqual({
        outVoucher: {
          svhId: OUT_ID,
          accYear: ACC_YEAR,
          refno: 'TRF/2026-2027/TILL-01/2',
          status: 'RECEIVED',
        },
        rowsSettled: 2,
        shortQty: 3,
        shortValue: 84,
        accountsVoucherId: 'avh-1',
        accountsVoucherRefno: 'Jrl/7',
        transit: [expect.objectContaining({ sttId: '01000000-0000-7000-8000-000000000031' })],
      });
    });

    it('stamps the same moment on the settlement, the accounts leg and the trail', async () => {
      reads();

      await settling.settleShort(args());

      const settledOn = settleMock.mock.calls[0][1].settledOn;
      expect(
        (accounts.postShortSettlement.mock.calls[0] as [unknown, { settledOn: Date }])[1].settledOn,
      ).toBe(settledOn);
      expect(statusLogMock.mock.calls[0][1].changedOn).toBe(settledOn);
    });

    it('writes a blank remark as none, and the trail says what never arrived', async () => {
      reads();

      await settling.settleShort(args({ remarks: '   ' }));

      expect(settleMock.mock.calls[0][1].remarks).toBeNull();
      expect(statusLogMock.mock.calls[0][1].remarks).toBe('Short-settled: 3 never arrived');
    });

    it('answers no accounts voucher under PERIODIC, and an empty device when the header is gone', async () => {
      reads();
      accounts.postShortSettlement.mockResolvedValue(null);
      tx.$queryRaw.mockResolvedValue([]);

      const result = await settling.settleShort(args());

      expect(result).toMatchObject({ accountsVoucherId: null, accountsVoucherRefno: null });
      expect(statusLogMock.mock.calls[0][1]).toMatchObject({
        tenantId: null,
        deviceId: null,
        sessionId: null,
      });
    });

    it('acts as the user the body names over the request user', async () => {
      reads();

      await settling.settleShort(args({ userId: OTHER_USER }));

      expect(settleMock.mock.calls[0][1].actor).toBe(OTHER_USER);
      expect(statusLogMock.mock.calls[0][1].changedBy).toBe(OTHER_USER);
    });

    it("lets the engine's refusal through and posts nothing after it", async () => {
      reads();
      const refusal = new HttpException('Transfer is RECEIVED', 409);
      settleMock.mockRejectedValue(refusal);

      await expect(settling.settleShort(args())).rejects.toBe(refusal);
      expect(accounts.postShortSettlement).not.toHaveBeenCalled();
      expect(statusLogMock).not.toHaveBeenCalled();
    });
  });
});
