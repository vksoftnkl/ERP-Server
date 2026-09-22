import '../src/env.preload';

import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient } from '@prisma/client';
import * as request from 'supertest';

import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { TokenService, type AccessTokenPayload } from '../src/modules/auth/token.service';
import { AuthSessionService } from '../src/modules/auth/auth-session.service';
import { StockTransferService } from '../src/modules/stocks/stock-transfer/stock-transfer.service';
import type { StockVoucherTypeRules } from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';
import { TxnStatusDocType } from '../src/common/txn-status-log/txn-status-log.helper';

/**
 * STATEMENT-LEVEL TRACE of every /stock/transfer route, plus a probe that
 * isolates the SECOND blocker on the despatch path.
 *
 * Taps Prisma's `query` event on the app's own PrismaService, so what is
 * printed is what the request actually issued.
 *
 * TWO BLOCKERS STACK ON DESPATCH, and this file separates them:
 *   1. `validate()`'s opening-uniqueness guard runs on TRANSFER_OUT, because it
 *      is gated on `!rules.allowsRepeatHolding` and only PHYSICAL sets that.
 *      Every holding on this database was opened, so every line is refused.
 *   2. Behind it, stock.fn_svh_post_transfer does not exist on this deployment.
 *
 * The last test calls StockTransferService.despatch DIRECTLY with a rules
 * record carrying allowsRepeatHolding: true — a test-only bypass of blocker 1,
 * which is the only way to see blocker 2 without editing production code.
 */

const T = '/api/v1/stock/transfer';
const RCV = '/api/v1/stock/transfer/receive';
const BEARER = 'Bearer dummy-test-token';
const ACC_YEAR = '2026-2027';
const DOC_DATE = '2026-09-10';

const SCOPE = {
  companyId: '019c8ea6-19e9-78a8-b15f-749e1cde7292',
  branchId: '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab',
  deviceId: '019e4e4c-9f08-7211-afe0-409b88a62180',
};
const SRC_GODOWN = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const DST_GODOWN = '019d2e48-7af3-7d5c-82a7-2eb57fdabf1c';
const OTHER_BRANCH = '019d611f-1df8-7dd9-903d-777f955e2b65';
const OTHER_GODOWN = '019f0812-7c0b-7f5f-8478-df1d03328a19';
const ACTOR = '019e4f64-1d3f-7717-b252-cbe2b6ce0f8d';

const prisma = new PrismaClient();

/** As pinned in stock-transfer.controller.ts. */
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

function classify(sql: string): { verb: string; target: string } {
  const s = sql.replace(/\s+/g, ' ').trim();
  const verb = (
    s.match(
      /^(SELECT|INSERT INTO|UPDATE|DELETE FROM|WITH|BEGIN|COMMIT|ROLLBACK|SET|DEALLOCATE)/i,
    )?.[1] ?? '?'
  ).toUpperCase();
  const tables = [
    ...s.matchAll(/\b(?:FROM|INTO|UPDATE|JOIN)\s+"?([a-z_]+)"?\."?([a-z_]+)"?/gi),
  ].map((m) => `${m[1]}.${m[2]}`);
  const fns = [...s.matchAll(/\b(stock|accounts|public)\.(fn_[a-z_]+)\s*\(/gi)].map(
    (m) => `${m[1]}.${m[2]}()`,
  );
  return { verb, target: [...new Set([...fns, ...tables])].join(', ') || '—' };
}

describe('TRACE /stock/transfer — statements, tables, functions', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;
  let capture: Array<{ verb: string; target: string }> | null = null;
  const out: string[] = [];

  beforeAll(async () => {
    const claims: AccessTokenPayload = {
      sub: ACTOR,
      user_name: 'tester1',
      sid: 'e2e-trf-trace',
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

    const svc = app.get(PrismaService);
    svc.$on('query', (ev) => {
      if (capture) capture.push(classify(ev.query));
    });
  }, 120_000);

  afterAll(async () => {
    require('fs').writeFileSync(process.env.TRACE_OUT ?? '/dev/null', out.join('\n') + '\n');
    await app?.close();
    await prisma.$disconnect();
  }, 60_000);

  async function trace<T>(label: string, run: () => Promise<T>): Promise<T> {
    capture = [];
    let result: T;
    try {
      result = await run();
    } finally {
      await new Promise((r) => setTimeout(r, 200));
    }
    const steps = capture;
    capture = null;
    out.push(`##### ${label} — ${steps.length} statements`);
    steps.forEach((s, i) =>
      out.push(`  ${String(i + 1).padStart(2)}. ${s.verb.padEnd(11)} ${s.target}`),
    );
    out.push('');
    return result!;
  }

  const scopeQuery = { accYear: ACC_YEAR, companyId: SCOPE.companyId, branchId: SCOPE.branchId };
  let lot: {
    lotId: string;
    itemId: string;
    uomId: string;
    batchNo: string | null;
    expiryDate: string | null;
  };
  let outId = '';
  let interId = '';

  beforeAll(async () => {
    const [row] = await prisma.$queryRaw<Array<{ lot: string; item: string; uom: string }>>`
      SELECT sbl_lot_id AS lot, sbl_item_id AS item, sbl_base_uom_id AS uom
        FROM stock.stock_balance
       WHERE sbl_godown_id = ${SRC_GODOWN}::uuid AND sbl_on_hand_qty > 10
       ORDER BY sbl_on_hand_qty DESC LIMIT 1`;
    const [id] = await prisma.$queryRaw<Array<{ batch: string | null; exp: Date | null }>>`
      SELECT slt_batch_no AS batch, slt_expiry_date AS exp FROM stock.stock_lot WHERE slt_id = ${row.lot}::uuid`;
    lot = {
      lotId: row.lot,
      itemId: row.item,
      uomId: row.uom,
      batchNo: id?.batch ?? null,
      expiryDate: id?.exp ? new Date(id.exp).toISOString().slice(0, 10) : null,
    };
  }, 60_000);

  function outBody(interBranch = false) {
    return {
      header: {
        accYear: ACC_YEAR,
        companyId: SCOPE.companyId,
        branchId: SCOPE.branchId,
        deviceId: SCOPE.deviceId,
        docDate: DOC_DATE,
        fromGodownId: SRC_GODOWN,
        toGodownId: interBranch ? OTHER_GODOWN : DST_GODOWN,
        ...(interBranch ? { toBranchId: OTHER_BRANCH } : {}),
        userId: ACTOR,
        remarks: 'E2E-TRF sql trace',
      },
      lines: [
        {
          lineNo: 1,
          splitNo: 1,
          itemId: lot.itemId,
          godownId: SRC_GODOWN,
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
    };
  }

  it('traces every route that runs', async () => {
    const created = await trace('POST /transfer — create a same-branch DRAFT', () =>
      http.post(T).set('Authorization', BEARER).send(outBody()),
    );
    expect(created.status).toBe(201);
    outId = created.body.data.header.svhId;

    const inter = await trace('POST /transfer — create an inter-branch DRAFT', () =>
      http.post(T).set('Authorization', BEARER).send(outBody(true)),
    );
    expect(inter.status).toBe(201);
    interId = inter.body.data.header.svhId;

    await trace('GET /transfer — list', () =>
      http
        .get(T)
        .set('Authorization', BEARER)
        .query({ ...scopeQuery, limit: 5 }),
    );

    await trace('GET /transfer — load one (with transit rows)', () =>
      http
        .get(T)
        .set('Authorization', BEARER)
        .query({ ...scopeQuery, svhId: outId }),
    );

    await trace('GET /transfer/validate — the preflight', () =>
      http
        .get(`${T}/validate`)
        .set('Authorization', BEARER)
        .query({ ...scopeQuery, svhId: outId }),
    );

    await trace('POST /transfer/despatch — refused by the opening guard (422)', () =>
      http
        .post(`${T}/despatch`)
        .set('Authorization', BEARER)
        .send({
          svhId: outId,
          ...scopeQuery,
          userId: ACTOR,
          lrNo: 'LR-1',
          vehicleNo: 'TN-99',
          expectedOn: DOC_DATE,
        }),
    );

    await trace('POST /transfer/cancel — refused, a DRAFT is deleted not cancelled (409)', () =>
      http
        .post(`${T}/cancel`)
        .set('Authorization', BEARER)
        .send({ svhId: outId, ...scopeQuery, userId: ACTOR, reason: 'E2E-TRF sql trace' }),
    );

    await trace('GET /transfer/receive/inbound — the receiving branch worklist', () =>
      http
        .get(`${RCV}/inbound`)
        .set('Authorization', BEARER)
        .query({ companyId: SCOPE.companyId, branchId: OTHER_BRANCH, limit: 10, offset: 0 }),
    );

    await trace('GET /transfer/receive/prefill — against a DRAFT despatch (409)', () =>
      http.get(`${RCV}/prefill`).set('Authorization', BEARER).query({
        companyId: SCOPE.companyId,
        branchId: OTHER_BRANCH,
        accYear: ACC_YEAR,
        outVoucherId: interId,
      }),
    );

    await trace('POST /transfer/receive — the TRANSFER_IN half (409, nothing despatched)', () =>
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
            linkSrcModule: 'STOCK',
            linkSrcDocType: 'TRANSFER_OUT',
            linkSrcDocId: interId,
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
    );

    await trace('DELETE /transfer — soft delete a DRAFT', () =>
      http
        .delete(T)
        .set('Authorization', BEARER)
        .query({ svhId: outId, ...scopeQuery }),
    );
  }, 180_000);

  // ── Blocker 2, isolated ─────────────────────────────────────────────────
  it('with the opening guard bypassed, the despatch reaches the missing engine', async () => {
    const service = app.get(StockTransferService);
    // TEST-ONLY. The one field that turns the opening-uniqueness guard off, so
    // the call gets past blocker 1 and hits whatever is actually behind it.
    const bypassed: StockVoucherTypeRules = { ...TRANSFER_OUT_RULES, allowsRepeatHolding: true };

    let caught: unknown;
    await trace('StockTransferService.despatch — opening guard bypassed', async () => {
      try {
        await service.despatch(bypassed, {
          svhId: interId,
          accYear: ACC_YEAR,
          companyId: SCOPE.companyId,
          branchId: SCOPE.branchId,
          userId: ACTOR,
          lrNo: 'LR-2',
          vehicleNo: 'TN-88',
          expectedOn: DOC_DATE,
        });
      } catch (e) {
        caught = e;
      }
    });

    const message = (caught as { message?: string })?.message ?? '';
    const meta = (caught as { meta?: { message?: string; code?: string } })?.meta;
    out.push('##### The error behind the guard');
    out.push(`  name:  ${(caught as Error)?.constructor?.name}`);
    out.push(`  code:  ${(caught as { code?: string })?.code}`);
    out.push(`  meta:  ${JSON.stringify(meta)}`);
    out.push(`  msg:   ${message.replace(/\s+/g, ' ').slice(0, 300)}`);
    out.push('');

    expect(caught).toBeTruthy();
    // The whole point: the second wall is the missing DDL share, not this code.
    const text = `${message} ${JSON.stringify(meta)}`;
    expect(text).toMatch(/fn_svh_post_transfer|does not exist/i);
  }, 120_000);

  it('leaves the source holding exactly as it found it', async () => {
    const [row] = await prisma.$queryRaw<Array<{ qty: string }>>`
      SELECT sbl_on_hand_qty::text AS qty FROM stock.stock_balance
       WHERE sbl_lot_id = ${lot.lotId}::uuid AND sbl_godown_id = ${SRC_GODOWN}::uuid`;
    out.push(`source holding ended at ${row.qty}`);
    expect(Number(row.qty)).toBe(1202);
  }, 60_000);
});
