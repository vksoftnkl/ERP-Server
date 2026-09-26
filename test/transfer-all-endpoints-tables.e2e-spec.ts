import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * ALL EIGHT ROUTES OF /api/v1/stock/transfer (+ /receive), asked the same
 * question as the opening and physical suites: which tables does each write?
 *
 * THE ANSWER IS DIFFERENT IN KIND HERE, and the reason is environmental rather
 * than a defect in this code. TRANSFER_OUT/IN pin postFunction
 * 'stock.fn_svh_post_transfer', and `usesInProcessPosting` is false for
 * anything but 'stock.fn_svh_post' — so unlike an opening or a count, a
 * transfer is NOT posted by stock-voucher-posting.helper.ts. It calls the
 * database function, and this deployment carries only the four trigger
 * functions from migration 20260908110000:
 *
 *     fn_create_stock_partitions, fn_sml_forbid_delete,
 *     fn_sml_freeze_guard, fn_sml_immutable
 *
 * fn_svh_post_transfer is not among them. Everything up to the despatch works
 * and is measured below; the despatch and the receive are recorded as they
 * actually answer, so the day the DDL share is deployed this file says exactly
 * what changed.
 *
 * NET EFFECT ON STOCK IS ZERO — nothing here can post, so nothing moves.
 */

const T = '/api/v1/stock/transfer';
const RCV = '/api/v1/stock/transfer/receive';
const BEARER = 'Bearer dummy-test-token';
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-09-10';
const MISSING_UUID = '00000000-0000-4000-8000-000000000000';

const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const SRC_GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01'; // Coimbatore
const DST_GODOWN = '019d2e48-7af3-7d5c-82a7-2eb57fdabf1c'; // Trichy — SAME branch
// The other half of the story: a different branch of the same company, and a
// godown that belongs to it. This is what turns one document into two.
const OTHER_BRANCH = '019d611f-1df8-7dd9-903d-777f955e2b65'; // Counter2
const OTHER_GODOWN = '019f0812-7c0b-7f5f-8478-df1d03328a19'; // karur, in Counter2
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();

const WATCHED = [
  'stock.stock_voucher',
  'stock.stock_voucher_item',
  'stock.stock_ledger',
  'stock.stock_lot',
  'stock.stock_balance',
  'stock.stock_item_cost',
  'stock.stock_transit',
  'public.txn_status_log',
  'audit.audit_log',
  'accounts.acc_voucher_seq',
  'accounts.acc_voucher_header',
];

async function snapshot(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  for (const table of WATCHED) {
    const [row] = await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(
      `SELECT count(*)::bigint AS n FROM ${table}`,
    );
    counts[table] = Number(row.n);
  }
  return counts;
}

const report: Array<Record<string, unknown>> = [];

describe('/stock/transfer — all 8 routes, which tables each one writes', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-transfer-all',
      user_type: 'SUPER ADMIN',
      company_id: SCOPE.companyId,
      branch_id: SCOPE.branchId,
      device_id: SCOPE.deviceId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (): AccessTokenPayload => claims })
      .overrideProvider(AuthSessionService)
      .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableVersioning({ type: VersioningType.URI });
    app.setGlobalPrefix('api');
    await app.init();
    http = request(app.getHttpServer());
  }, 120_000);

  afterAll(async () => {
    // eslint-disable-next-line no-console
    console.log('\n===== TABLES WRITTEN, BY ROUTE =====\n' + JSON.stringify(report, null, 2));
    await app?.close();
    await prisma.$disconnect();
  }, 120_000);

  async function probe(
    route: string,
    label: string,
    send: () => request.Test,
    note?: string,
  ): Promise<{ status: number; body: any }> {
    const before = await snapshot();
    const res = await send();
    const after = await snapshot();
    const wrote: Record<string, number> = {};
    for (const table of WATCHED) {
      const d = after[table] - before[table];
      if (d !== 0) wrote[table] = d;
    }
    report.push({
      route,
      case: label,
      status: res.status,
      message: res.body?.message,
      ...(res.body?.errors ? { errors: res.body.errors } : {}),
      wrote,
      ...(note ? { note } : {}),
    });
    return { status: res.status, body: res.body };
  }

  const scopeQuery = { accYear: ACC_YEAR, companyId: SCOPE.companyId, branchId: SCOPE.branchId };
  const ref = (svhId: string) => ({ svhId, ...scopeQuery, userId: ACTOR });

  let lot: {
    lotId: string;
    itemId: string;
    uomId: string;
    onHand: number;
    batchNo: string | null;
    expiryDate: string | null;
  };
  let draftId = '';
  let interBranchId = '';
  let receiptId = '';
  const sameBranchDespatched = false;
  const interBranchDespatched = false;

  beforeAll(async () => {
    const [row] = await prisma.$queryRaw<
      Array<{ lot: string; item: string; uom: string; qty: string }>
    >`
      SELECT sbl_lot_id AS lot, sbl_item_id AS item, sbl_base_uom_id AS uom,
             sbl_on_hand_qty::text AS qty
        FROM stock.stock_balance
       WHERE sbl_godown_id = ${SRC_GODOWN}::uuid AND sbl_on_hand_qty > 10
       ORDER BY sbl_on_hand_qty DESC LIMIT 1`;
    if (!row) throw new Error('No holding with stock in the source godown — seed one first.');
    // The lot's own identity. This holding is batch+expiry tracked
    // (slt_track_signature 'BE'), and a line that omits them is refused by the
    // preflight BEFORE the despatch is ever attempted — which is what hid the
    // engine question on the first run of this file.
    const [id] = await prisma.$queryRaw<Array<{ batch: string | null; exp: Date | null }>>`
      SELECT slt_batch_no AS batch, slt_expiry_date AS exp
        FROM stock.stock_lot WHERE slt_id = ${row.lot}::uuid`;
    lot = {
      lotId: row.lot,
      itemId: row.item,
      uomId: row.uom,
      onHand: Number(row.qty),
      batchNo: id?.batch ?? null,
      expiryDate: id?.exp ? new Date(id.exp).toISOString().slice(0, 10) : null,
    };
  }, 60_000);

  /**
   * ONE ENDPOINT, TWO DOCUMENTS. `interBranch` is the only difference between a
   * godown-to-godown move and a branch-to-branch consignment on the way in —
   * everything else about the payload is identical, and the engine decides the
   * shape from `svh_to_branch_id` at despatch time.
   */
  function outBody(qty: number, opts: { lotId?: string; interBranch?: boolean } = {}) {
    const lotId = opts.lotId ?? lot.lotId;
    return {
      header: {
        accYear: ACC_YEAR,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        deviceId: SCOPE.deviceId,
        docDate: DOC_DATE,
        fromGodownId: SRC_GODOWN,
        // Same branch: a godown of THIS branch, and no toBranchId at all.
        // Inter-branch: the receiving branch, and a godown that belongs to it.
        toGodownId: opts.interBranch ? OTHER_GODOWN : DST_GODOWN,
        ...(opts.interBranch ? { toBranchId: OTHER_BRANCH } : {}),
        userId: ACTOR,
        remarks: `E2E-TRF ${opts.interBranch ? 'branch-to-branch' : 'godown-to-godown'} probe`,
      },
      lines: [
        {
          lineNo: 1,
          splitNo: 1,
          itemId: lot.itemId,
          godownId: SRC_GODOWN,
          lotId,
          bucket: 'SALEABLE',
          uomId: lot.uomId,
          baseUomId: lot.uomId,
          toBaseFactor: 1,
          // The lot is batch+expiry tracked, so the line has to say which lot
          // it means in the lot's own terms, not only by id.
          ...(lot.batchNo ? { batchNo: lot.batchNo } : {}),
          ...(lot.expiryDate ? { expiryDate: lot.expiryDate } : {}),
          qty,
          baseQty: qty,
        },
      ],
    };
  }

  // ── 1. POST /stock/transfer (create) ────────────────────────────────────
  it('POST / — saves a same-branch TRANSFER_OUT draft', async () => {
    const res = await probe(
      'POST /transfer',
      'create a same-branch DRAFT (Coimbatore → Trichy, 4 units)',
      () => http.post(T).set('Authorization', BEARER).send(outBody(4)),
      'the line names the lot and the SOURCE godown; the destination is on the header',
    );
    expect(res.status).toBe(201);
    expect(res.body.data.header.voucherType).toBe('TRANSFER_OUT');
    expect(res.body.data.header.status).toBe('DRAFT');
    draftId = res.body.data.header.svhId;
  }, 60_000);

  it('POST / — a line that names no live lot, and one that moves more than is held', async () => {
    const noLot = await probe('POST /transfer', 'lotId that does not exist', () =>
      http
        .post(T)
        .set('Authorization', BEARER)
        .send(outBody(1, { lotId: MISSING_UUID })),
    );
    expect(noLot.status).toBe(422);

    const tooMuch = await probe(
      'POST /transfer',
      'moves more than the lot holds',
      () =>
        http
          .post(T)
          .set('Authorization', BEARER)
          .send(outBody(lot.onHand + 1000)),
      'refused at SAVE, not left for the despatch to discover',
    );
    expect(tooMuch.status).toBe(422);

    const noCost = await probe(
      'POST /transfer',
      'a line carrying a costRate',
      () =>
        http
          .post(T)
          .set('Authorization', BEARER)
          .send({
            ...outBody(1),
            lines: [{ ...outBody(1).lines[0], costRate: 25 }],
          }),
      'a transfer carries no cost — the engine stamps what it cost where it came from',
    );
    expect(noCost.status).toBe(422);
  }, 60_000);

  // ── 2. GET /stock/transfer (list / load) ────────────────────────────────
  it('GET / — lists without svhId, loads with it', async () => {
    const list = await probe('GET /transfer', 'list transfers for the scope', () =>
      http
        .get(T)
        .set('Authorization', BEARER)
        .query({ ...scopeQuery, limit: 5 }),
    );
    expect(list.status).toBe(200);

    const one = await probe(
      'GET /transfer',
      'load the draft with its transit rows',
      () =>
        http
          .get(T)
          .set('Authorization', BEARER)
          .query({ ...scopeQuery, svhId: draftId }),
      'transit is empty until the despatch writes it',
    );
    expect(one.status).toBe(200);
    expect(one.body.data.transit).toEqual([]);
  }, 60_000);

  // ── 3. GET /stock/transfer/validate ─────────────────────────────────────
  it('GET /validate — advisory preflight, writes nothing', async () => {
    const res = await probe('GET /transfer/validate', 'preflight the draft', () =>
      http
        .get(`${T}/validate`)
        .set('Authorization', BEARER)
        .query({ ...scopeQuery, svhId: draftId }),
    );
    expect(res.status).toBe(200);
    // NOT CLEAN, AND THE REASON IS A BUG IN THE SHARED PREFLIGHT — see the
    // despatch case below for the whole story.
    expect(res.body.data[0].problem).toBe('this holding already has an opening in this year');
  }, 60_000);

  // ── 4. POST /despatch — the same-branch (godown → godown) form ──────────
  it('POST /despatch — godown to godown', async () => {
    const res = await probe(
      'POST /transfer/despatch',
      'despatch the same-branch draft (no toBranchId)',
      () =>
        http
          .post(`${T}/despatch`)
          .set('Authorization', BEARER)
          .send({
            ...ref(draftId),
            lrNo: 'LR-E2E-1',
            vehicleNo: 'TN-99-9999',
            expectedOn: DOC_DATE,
          }),
      'BLOCKED by the opening-uniqueness guard — see below',
    );
    // ── THE TRANSFER SCREEN CANNOT DESPATCH ORDINARY STOCK ─────────────────
    //
    // `validate()` refuses every line whose holding already carries an OPENING
    // ledger row this year in this godown. That guard exists so a branch cannot
    // open the same holding twice — it has nothing to say about a transfer,
    // which moves stock that by definition already came from somewhere.
    //
    // It runs here because of how it is gated. stock-voucher.service.ts:1712:
    //
    //     CASE WHEN ${!rules.allowsRepeatHolding}::boolean THEN EXISTS (...)
    //
    // `allowsRepeatHolding` is set on exactly ONE rules record — PHYSICAL. On
    // TRANSFER_OUT it is undefined, so `!undefined` is true and the opening
    // guard runs. Every other type this service is built to serve (RECEIPT,
    // ISSUE, ADJUSTMENT, DAMAGE, EXPIRY_WRITEOFF, REPACK_*) inherits it too.
    //
    // The flag is named for the wrong question. The guard belongs to OPENING
    // alone, so the gate wants to be `rules.voucherType === 'OPENING'` — or a
    // dedicated flag set on the opening rules — not the ABSENCE of a
    // count-specific one.
    //
    // Consequence: on a go-live year, when every holding was opened, no lot can
    // ever be transferred out of the godown it was opened in.
    expect(res.status).toBe(422);
    expect(JSON.stringify(res.body.errors)).toContain('already has an opening in this year');
  }, 90_000);

  // ── 5. The branch-to-branch form ────────────────────────────────────────
  it('POST / then /despatch — branch to branch', async () => {
    const created = await probe(
      'POST /transfer',
      'create an inter-branch DRAFT (toBranchId = Counter2, godown karur)',
      () =>
        http
          .post(T)
          .set('Authorization', BEARER)
          .send(outBody(4, { interBranch: true })),
      'same payload as the same-branch form plus toBranchId — nothing else differs at save time',
    );
    expect(created.status).toBe(201);
    interBranchId = created.body.data.header.svhId;
    // AT SAVE TIME THE TWO ARE THE SAME DOCUMENT. Both are TRANSFER_OUT, both
    // are DRAFT, both wrote the same tables. The shape only diverges at post.
    expect(created.body.data.header.voucherType).toBe('TRANSFER_OUT');
    expect(created.body.data.header.status).toBe('DRAFT');
    expect(created.body.data.header.toBranchId).toBe(OTHER_BRANCH);

    const res = await probe(
      'POST /transfer/despatch',
      'despatch the inter-branch draft',
      () =>
        http
          .post(`${T}/despatch`)
          .set('Authorization', BEARER)
          .send({
            ...ref(interBranchId),
            lrNo: 'LR-E2E-2',
            vehicleNo: 'TN-88-8888',
            expectedOn: DOC_DATE,
          }),
      'would write stock_transit and end IN_TRANSIT — blocked by the same guard',
    );
    // Same wall, and it is reached BEFORE the engine: whether
    // stock.fn_svh_post_transfer exists on this database is not yet the
    // question, because the preflight never lets the call through. (It does
    // not exist — asserted below — so the despatch has two blockers stacked,
    // one a code defect and one a missing DDL share.)
    expect(res.status).toBe(422);
    const [fn] = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*)::bigint AS n FROM pg_proc p JOIN pg_namespace n2 ON n2.oid = p.pronamespace
       WHERE n2.nspname = 'stock' AND p.proname = 'fn_svh_post_transfer'`;
    expect(Number(fn.n)).toBe(0);
  }, 90_000);

  // ── 6. POST /cancel ─────────────────────────────────────────────────────
  it('POST /cancel — refuses a DRAFT transfer by design', async () => {
    const res = await probe(
      'POST /transfer/cancel',
      'cancel a DRAFT',
      () =>
        http
          .post(`${T}/cancel`)
          .set('Authorization', BEARER)
          .send({ ...ref(draftId), reason: 'E2E-TRF table-fill probe' }),
      'a draft TRANSFER_IN settles a despatch already in transit — cancelling would strand it',
    );
    expect([409, 201]).toContain(res.status);

    const missing = await probe('POST /transfer/cancel', 'an svhId that does not exist', () =>
      http
        .post(`${T}/cancel`)
        .set('Authorization', BEARER)
        .send({ ...ref(MISSING_UUID), reason: 'E2E-TRF nonexistent' }),
    );
    expect(missing.status).toBe(404);
  }, 60_000);

  // ── 7. GET /receive/inbound — asked as the RECEIVING branch ─────────────
  it('GET /receive/inbound — what is on a lorry to the other branch', async () => {
    const mine = await probe(
      'GET /transfer/receive/inbound',
      'inbound to the SENDING branch (should be empty)',
      () =>
        http
          .get(`${RCV}/inbound`)
          .set('Authorization', BEARER)
          .query({ companyId: SCOPE.companyId, branchId: SCOPE.branchId, limit: 10, offset: 0 }),
    );
    expect(mine.status).toBe(200);

    const theirs = await probe(
      'GET /transfer/receive/inbound',
      'inbound to the RECEIVING branch (Counter2)',
      () =>
        http
          .get(`${RCV}/inbound`)
          .set('Authorization', BEARER)
          .query({ companyId: SCOPE.companyId, branchId: OTHER_BRANCH, limit: 10, offset: 0 }),
      'reads stock_transit, takes NO accYear — a March despatch is received in April',
    );
    expect(theirs.status).toBe(200);
    // Only true once a despatch has actually written transit rows.
    expect(theirs.body.data.meta.count).toBe(interBranchDespatched ? 1 : 0);
  }, 60_000);

  // ── 8. GET /receive/prefill ─────────────────────────────────────────────
  it('GET /receive/prefill — opens the receipt at the remainder', async () => {
    const wrongBranch = await probe(
      'GET /transfer/receive/prefill',
      'prefill a same-branch transfer (there is no receiving branch)',
      () =>
        http.get(`${RCV}/prefill`).set('Authorization', BEARER).query({
          companyId: SCOPE.companyId,
          branchId: SCOPE.branchId,
          accYear: ACC_YEAR,
          outVoucherId: draftId,
        }),
      'a godown-to-godown move is never received — it has no second half',
    );
    expect(wrongBranch.status).toBeGreaterThanOrEqual(400);

    const right = await probe(
      'GET /transfer/receive/prefill',
      'prefill the inter-branch despatch, as Counter2',
      () =>
        http.get(`${RCV}/prefill`).set('Authorization', BEARER).query({
          companyId: SCOPE.companyId,
          branchId: OTHER_BRANCH,
          accYear: ACC_YEAR,
          outVoucherId: interBranchId,
        }),
      'read from stock_transit, never from the despatch lines — that is what stops a double receipt',
    );
    if (interBranchDespatched) expect(right.status).toBe(200);
  }, 60_000);

  // ── 9. POST /receive — the receipt draft ────────────────────────────────
  it('POST /receive — creates the TRANSFER_IN half', async () => {
    const res = await probe(
      'POST /transfer/receive',
      'create a receipt against the despatch',
      () =>
        http
          .post(RCV)
          .set('Authorization', BEARER)
          .send({
            header: {
              accYear: ACC_YEAR,
              companyId: SCOPE.companyId,
              branchId: OTHER_BRANCH,
              deviceId: SCOPE.deviceId,
              docDate: DOC_DATE,
              toGodownId: OTHER_GODOWN,
              userId: ACTOR,
              remarks: 'E2E-TRF receipt probe',
              linkSrcModule: 'STOCK',
              linkSrcDocType: 'TRANSFER_OUT',
              linkSrcDocId: interBranchId,
              linkSrcAccYear: ACC_YEAR,
            },
            lines: [
              {
                lineNo: 1,
                splitNo: 1,
                itemId: lot.itemId,
                godownId: OTHER_GODOWN,
                lotId: lot.lotId,
                bucket: 'SALEABLE',
                uomId: lot.uomId,
                baseUomId: lot.uomId,
                toBaseFactor: 1,
                ...(lot.batchNo ? { batchNo: lot.batchNo } : {}),
                ...(lot.expiryDate ? { expiryDate: lot.expiryDate } : {}),
                qty: 4,
                baseQty: 4,
              },
            ],
          }),
      'godownId on a line is the DESTINATION godown; the link to the despatch is mandatory',
    );
    if (res.status === 201) receiptId = res.body.data.header.svhId;
  }, 60_000);

  // ── 10. POST /receive/post ──────────────────────────────────────────────
  it('POST /receive/post — takes a REF, not a document', async () => {
    const wrongShape = await probe(
      'POST /transfer/receive/post',
      'sent header+lines (the shape POST /receive takes)',
      () =>
        http
          .post(`${RCV}/post`)
          .set('Authorization', BEARER)
          .send({ header: { accYear: ACC_YEAR }, lines: [] }),
      'this route posts an EXISTING receipt — it takes svhId, not a payload',
    );
    expect(wrongShape.status).toBe(400);

    const res = await probe('POST /transfer/receive/post', 'post the receipt by svhId', () =>
      http
        .post(`${RCV}/post`)
        .set('Authorization', BEARER)
        .send(ref(receiptId || MISSING_UUID)),
    );
    expect(res.status).toBeGreaterThanOrEqual(receiptId ? 200 : 400);
  }, 60_000);

  // ── 11. DELETE /receive and DELETE /transfer ────────────────────────────
  it('DELETE — a draft is deleted, never cancelled', async () => {
    if (receiptId) {
      const res = await probe(
        'DELETE /transfer/receive',
        'soft delete the DRAFT receipt',
        () =>
          http
            .delete(RCV)
            .set('Authorization', BEARER)
            .query({ svhId: receiptId, ...scopeQuery, branchId: OTHER_BRANCH }),
        'tr_svh_transfer_cancel_guard refuses cancelling any linked TRANSFER_IN, draft included',
      );
      expect(res.status).toBeLessThan(500);
    }

    const out = await probe('DELETE /transfer', 'soft delete a DRAFT transfer', () =>
      http
        .delete(T)
        .set('Authorization', BEARER)
        .query({ svhId: draftId, ...scopeQuery }),
    );
    expect(out.status).toBeLessThan(500);
  }, 60_000);

  it('leaves the source holding exactly as it found it', async () => {
    // Anything that actually despatched is put back before this runs.
    for (const [id, done] of [
      [draftId, sameBranchDespatched],
      [interBranchId, interBranchDespatched],
    ] as const) {
      if (!done) continue;
      await http
        .post(`${T}/cancel`)
        .set('Authorization', BEARER)
        .send({ ...ref(id), reason: 'E2E-TRF probe — reversing so the branch nets to zero' });
    }
    const [row] = await prisma.$queryRaw<Array<{ qty: string }>>`
      SELECT sbl_on_hand_qty::text AS qty FROM stock.stock_balance
       WHERE sbl_lot_id = ${lot.lotId}::uuid AND sbl_godown_id = ${SRC_GODOWN}::uuid`;
    // eslint-disable-next-line no-console
    console.log(`\n  source holding: started ${lot.onHand}, ended ${row.qty}`);
    expect(Number(row.qty)).toBe(lot.onHand);
  }, 90_000);
});
