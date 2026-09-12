// Preload .env exactly like src/main.ts so API_VERSION, DATABASE_URL, JWT_SECRET
// etc. are present before the AppModule graph (and API-version decorators) load.
import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';

/**
 * REGRESSION — a cancelled opening must free its holding.
 *
 * The bug: cancel an opening entered by mistake and the corrected one could
 * never be entered. `/stock/opening/validate` and the post guard both answered
 * "this holding already has an opening in this year" for ever, because they
 * read the ledger's FORWARD rows only. A cancel does not touch the forward
 * row — the ledger is append-only — it writes a mirror beside it, so the
 * original was still there, still live, still `sml_is_reversal = false`. The
 * only workaround was to invent a batch number, permanently corrupting lot
 * identity to get round a query.
 *
 * The fix is `unreversedLedgerRow()` in stock-voucher-posting.helper: live,
 * forward AND not reversed.
 *
 * This drives the SAME database the live server uses, like the cancel e2e
 * beside it. It finds a posted-then-cancelled opening, builds a DRAFT on that
 * exact holding, preflights it, and deletes the draft again — the cancelled
 * voucher and the ledger are only ever READ.
 *
 * See memory: erp-server-http-testing-without-credentials.
 */

const VALIDATE = '/api/v1/stock/opening/validate';
const LOOKUP = '/api/v1/stock/opening/item-lookup';
const CREATE = '/api/v1/stock/opening/create';
const BEARER = 'Bearer dummy-test-token';
const ALREADY_OPENED = 'already has an opening';

const prisma = new PrismaClient();

/** One line of a posted-then-cancelled opening: the holding to re-open. */
interface CancelledHolding {
  svhId: string;
  accYear: string;
  companyId: string;
  branchId: string;
  refno: string;
  itemId: string;
  uomId: string;
  baseUomId: string;
  toBaseFactor: number;
  godownId: string;
  batchNo: string | null;
  expiryDate: string | null;
  mfgDate: string | null;
  mrp: number | null;
  salePrice: number | null;
  serialNo: string | null;
  supplierId: string | null;
  qty: number;
  baseQty: number;
  costRate: number;
  bucket: string;
  deviceId: string;
  docDate: string;
}

/**
 * A holding whose opening was POSTED and then CANCELLED — the forward row and
 * its mirror both present. That pair is the whole precondition of the bug; a
 * cancelled DRAFT never blocked, because it never reached the ledger.
 */
async function findCancelledHolding(): Promise<CancelledHolding | null> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT h.svh_id, h.svh_acc_year, h.svh_company_id, h.svh_branch_id, h.svh_refno,
           h.svh_device_id, to_char(h.svh_doc_date, 'YYYY-MM-DD') AS doc_date,
           i.svi_item_id, i.svi_uom_id, i.svi_base_uom_id, i.svi_to_base_factor,
           i.svi_godown_id, i.svi_batch_no, i.svi_qty, i.svi_base_qty,
           i.svi_cost_rate, i.svi_bucket,
           -- EVERY identity dimension, or the re-entered line trips an earlier
           -- branch of the CASE (a missing expiry date, say) and never reaches
           -- the already-opened check this suite exists to test.
           to_char(i.svi_expiry_date, 'YYYY-MM-DD') AS expiry_date,
           to_char(i.svi_mfg_date,    'YYYY-MM-DD') AS mfg_date,
           i.svi_mrp, i.svi_sale_price, i.svi_serial_no, i.svi_supplier_id
      FROM stock.stock_voucher h
      JOIN stock.stock_voucher_item i
        ON i.svi_voucher_id = h.svh_id AND i.svi_acc_year = h.svh_acc_year
     WHERE h.svh_voucher_type = 'OPENING'
       AND h.svh_status       = 'CANCELLED'
       AND i.svi_is_deleted   = false
       -- Posted, then cancelled: both sides of the pair are in the ledger.
       AND EXISTS (SELECT 1 FROM stock.stock_ledger f
                    WHERE f.sml_src_doc_id = h.svh_id AND f.sml_is_reversal = false
                      AND f.sml_is_deleted = false)
       AND EXISTS (SELECT 1 FROM stock.stock_ledger r
                    WHERE r.sml_src_doc_id = h.svh_id AND r.sml_is_reversal = true
                      AND r.sml_is_deleted = false)
     ORDER BY h.svh_created_on DESC
     LIMIT 1
  `;
  const r = rows[0];
  if (!r) return null;
  return {
    svhId: r.svh_id as string,
    accYear: r.svh_acc_year as string,
    companyId: r.svh_company_id as string,
    branchId: r.svh_branch_id as string,
    refno: r.svh_refno as string,
    itemId: r.svi_item_id as string,
    uomId: r.svi_uom_id as string,
    baseUomId: r.svi_base_uom_id as string,
    toBaseFactor: Number(r.svi_to_base_factor),
    godownId: r.svi_godown_id as string,
    batchNo: (r.svi_batch_no as string | null) ?? null,
    expiryDate: (r.expiry_date as string | null) ?? null,
    mfgDate: (r.mfg_date as string | null) ?? null,
    mrp: r.svi_mrp === null ? null : Number(r.svi_mrp),
    salePrice: r.svi_sale_price === null ? null : Number(r.svi_sale_price),
    serialNo: (r.svi_serial_no as string | null) ?? null,
    supplierId: (r.svi_supplier_id as string | null) ?? null,
    qty: Number(r.svi_qty),
    baseQty: Number(r.svi_base_qty),
    costRate: Number(r.svi_cost_rate),
    bucket: r.svi_bucket as string,
    // The device and the document date the cancelled one used: the re-entry is
    // meant to be the SAME document, keyed again.
    deviceId: r.svh_device_id as string,
    docDate: r.doc_date as string,
  };
}

describe('a cancelled opening frees its holding (e2e — live DB)', () => {
  let app: INestApplication;
  let holding: CancelledHolding | null;
  /** The DRAFT this suite creates, and removes again in afterAll. */
  let draftId: string | null = null;
  let draftAccYear: string | null = null;
  // tester1 (SUPER ADMIN) — a real public.user_master row, used as the actor.
  const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

  beforeAll(async () => {
    holding = await findCancelledHolding();

    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-test-session',
      user_type: 'SUPER ADMIN',
      company_id: holding?.companyId ?? null,
      branch_id: holding?.branchId ?? null,
      device_id: null,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
      typ: 'access',
    };

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(TokenService)
      .useValue({ verifyAccessToken: (_t: string): AccessTokenPayload => claims })
      .overrideProvider(AuthSessionService)
      .useValue({ assertAccessTokenIsActive: async (): Promise<void> => undefined })
      .compile();

    app = moduleRef.createNestApplication();
    // Mirror src/main.ts so the route, validation and errors behave as live.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: process.env.API_VERSION ?? '1',
    });
    app.setGlobalPrefix((process.env.API_PREFIX ?? 'api').replace(/^\/+|\/+$/g, ''));
    await app.init();

    // eslint-disable-next-line no-console
    console.log(
      `\n[free-holding e2e] cancelled opening: ${
        holding
          ? `${holding.refno} item=${holding.itemId} batch=${holding.batchNo ?? '(none)'}`
          : 'NONE'
      }\n`,
    );
  }, 60_000);

  afterAll(async () => {
    // The draft this suite made, and nothing else. It never posted, so it wrote
    // no ledger row and there is nothing to reverse.
    if (draftId && draftAccYear) {
      await prisma.$executeRaw`
        DELETE FROM stock.stock_voucher_item
         WHERE svi_voucher_id = ${draftId}::uuid AND svi_acc_year = ${draftAccYear}::bpchar`;
      await prisma.$executeRaw`
        DELETE FROM stock.stock_voucher
         WHERE svh_id = ${draftId}::uuid AND svh_acc_year = ${draftAccYear}::bpchar`;
    }
    await app?.close();
    await prisma.$disconnect();
  });

  it('the ledger shows one forward row and one reversal, netting to zero', async () => {
    if (!holding) return;
    const [net] = await prisma.$queryRaw<
      Array<{ forward: bigint; reversed: bigint; on_hand: string }>
    >`
      SELECT count(*) FILTER (WHERE sml_is_reversal = false)     AS forward,
             count(*) FILTER (WHERE sml_is_reversal = true)      AS reversed,
             COALESCE(SUM(sml_signed_base_qty), 0)::text         AS on_hand
        FROM stock.stock_ledger
       WHERE sml_src_doc_id = ${holding.svhId}::uuid AND sml_is_deleted = false
    `;
    expect(Number(net.forward)).toBeGreaterThan(0);
    // Every forward row reversed, and the holding therefore empty.
    expect(Number(net.reversed)).toBe(Number(net.forward));
    expect(Number(net.on_hand)).toBe(0);
  });

  /**
   * The badge is ITEM-level, not holding-level, so it can only discriminate on
   * an item whose ONLY opening was cancelled. No such item exists on this DB —
   * every cancelled holding's item has at least one other live opening — so
   * this asserts AGREEMENT rather than a specific value: the badge must say
   * exactly what the corrected ledger predicate says. It would catch the badge
   * drifting away from the preflight, which is the failure that matters; it is
   * NOT the regression guard for the bug. The validate case below is.
   */
  it('the item picker agrees with the corrected ledger predicate', async () => {
    if (!holding) return;
    const res = await request(app.getHttpServer())
      .get(LOOKUP)
      .set('Authorization', BEARER)
      .query({
        itemId: holding.itemId,
        uomId: holding.uomId,
        companyId: holding.companyId,
        branchId: holding.branchId,
        // The tracking policy is resolved against the DOCUMENT's date, so the
        // picker requires one.
        onDate: new Date().toISOString().slice(0, 10),
      });
    expect(res.status).toBe(200);
    // True only if some OTHER, still-live opening exists for this item; for the
    // item whose only opening was cancelled it must be false.
    const [{ live }] = await prisma.$queryRaw<Array<{ live: bigint }>>`
      SELECT count(*) AS live
        FROM stock.stock_ledger sml
       WHERE sml.sml_item_id = ${holding.itemId}::uuid
         AND sml.sml_company_id = ${holding.companyId}::uuid
         AND sml.sml_branch_id  = ${holding.branchId}::uuid
         AND sml.sml_txn_type = 'OPENING'
         AND sml.sml_is_deleted = false AND sml.sml_is_reversal = false
         AND NOT EXISTS (SELECT 1 FROM stock.stock_ledger rev
                          WHERE rev.sml_reverses_id = sml.sml_id
                            AND rev.sml_acc_year    = sml.sml_acc_year
                            AND rev.sml_is_reversal = true
                            AND rev.sml_is_deleted  = false)
    `;
    expect(res.body.data.alreadyOpened).toBe(Number(live) > 0);
  });

  /**
   * THE REGRESSION GUARD. Reverting `unreversedLedgerRow()` in the `opened` CTE
   * turns this red with exactly the reported message.
   *
   * There is no separate post case because `assertPostable` IS this call:
   * it runs `validate()` with the same rules and refuses on any non-null
   * problem, which is what stops the preflight and the post disagreeing. The
   * draft is deliberately never posted — that would write real stock.
   */
  it('re-opening the same holding preflights clean — the bug itself', async () => {
    if (!holding) return;

    const created = await request(app.getHttpServer())
      .post(CREATE)
      .set('Authorization', BEARER)
      .send({
        header: {
          accYear: holding.accYear,
          companyId: holding.companyId,
          branchId: holding.branchId,
          deviceId: holding.deviceId,
          docDate: holding.docDate,
          toGodownId: holding.godownId,
          status: 'DRAFT',
          rateSource: 'MANUAL',
          remarks: 'E2E re-open after cancel — deleted by the suite',
          userId: ACTOR,
        },
        lines: [
          {
            lineNo: 1,
            itemId: holding.itemId,
            uomId: holding.uomId,
            baseUomId: holding.baseUomId,
            toBaseFactor: holding.toBaseFactor,
            godownId: holding.godownId,
            bucket: holding.bucket,
            batchNo: holding.batchNo,
            expiryDate: holding.expiryDate,
            mfgDate: holding.mfgDate,
            mrp: holding.mrp,
            salePrice: holding.salePrice,
            serialNo: holding.serialNo,
            supplierId: holding.supplierId,
            qty: holding.qty,
            baseQty: holding.baseQty,
            costRate: holding.costRate,
          },
        ],
      });
    expect(created.status).toBe(201);
    draftId = created.body.data.header.svhId;
    draftAccYear = created.body.data.header.accYear;

    const res = await request(app.getHttpServer())
      .get(VALIDATE)
      .set('Authorization', BEARER)
      .query({
        svhId: draftId,
        accYear: draftAccYear,
        companyId: holding.companyId,
        branchId: holding.branchId,
      });
    expect(res.status).toBe(200);

    const problems: Array<{ problem: string | null }> = res.body.data;
    expect(problems.length).toBe(1);
    // The assertion the fix exists for. Printed on failure, because the whole
    // point is WHICH problem came back.
    expect(problems.map((p) => p.problem ?? '').join(' | ')).not.toContain(ALREADY_OPENED);
  }, 60_000);
});
