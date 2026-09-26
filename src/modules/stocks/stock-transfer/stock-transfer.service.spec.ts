import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { StockTransferService } from './stock-transfer.service';
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
      expect(TRANSFER_OUT_RULES.postFunction).toBe('stock.fn_svh_post_transfer');
      expect(TRANSFER_IN_RULES.postFunction).toBe('stock.fn_svh_receive_transfer');
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
          },
          {
            sbl_godown_id: GD_MAIN,
            sbl_item_id: MILK,
            sbl_lot_id: LOT_MILK,
            sbl_bucket: 'DAMAGED',
            sbl_on_hand_qty: new Prisma.Decimal(5),
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

    it('treats a holding with no balance row as zero on hand', async () => {
      stockReads(undefined, []);
      const messages = await detailsOf(service.save(TRANSFER_OUT_RULES, outPayload()));
      expect(messages.join(' ')).toMatch(/this godown holds 0/i);
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
});
