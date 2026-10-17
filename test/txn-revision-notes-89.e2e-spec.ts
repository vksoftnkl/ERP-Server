import { Prisma, PrismaClient } from '@prisma/client';
import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { StockVoucherService } from '../src/modules/stocks/stock-voucher/stock-voucher.service';
import type { SaveStockVoucherDto } from '../src/modules/stocks/stock-voucher/dto/save-stock-voucher.dto';
import type {
  StockVoucherPayload,
  StockVoucherTypeRules,
} from '../src/modules/stocks/stock-voucher/types/stock-voucher.types';

/**
 * NOTES 89 — one BEFORE/AFTER snapshot per save, and lines that keep their id —
 * on opening stock, against the real database in one rolled-back transaction
 * (the harness of `company-branch-notes-78.e2e-spec.ts`). The four checks the
 * notes list, plus a renumber that swaps two lines:
 *
 *   1. create with 3 lines → ONE audit row, rev 1, original NULL, modified 3 lines
 *   2. edit (qty on line 1, drop line 2, add one) → ONE row, rev 2, 3 → 3 lines;
 *      line 1 keeps its sviId, line 2's is gone, the new line has a new one
 *   3. log_changed_fields names only the header fields that changed
 *   4. no "lines replaced" row any more
 *
 *     npm run test:e2e -- txn-revision-notes-89
 */

const prisma = new PrismaClient();
class Rollback extends Error {}
const ACC_YEAR = '2026-2027';

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
  statusDocType: TxnStatusDocType.OPENING_STOCK,
  postShape: 'SIMPLE',
  refuseTypes: ['TRANSFER_IN', 'TRANSFER_OUT', 'REPACK_IN', 'REPACK_OUT'],
};

function transactional(tx: Prisma.TransactionClient): PrismaService {
  const proxy: object = new Proxy(tx, {
    get(target, prop) {
      if (prop === '$transaction') {
        return (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (client: unknown) => unknown)(proxy)
            : Promise.all(arg as Array<Promise<unknown>>);
      }
      const value: unknown = Reflect.get(target, prop);
      return typeof value === 'function'
        ? (value as (...args: unknown[]) => unknown).bind(target)
        : value;
    },
  });
  return proxy as PrismaService;
}

type RevisionRow = {
  log_action: string;
  log_rev_no: number | null;
  log_entity_id: string | null;
  log_device_name: string | null;
  log_notes: string | null;
  original_is_null: boolean;
  log_original_record: StockVoucherPayload | null;
  log_modified_record: StockVoucherPayload | null;
  log_changed_fields: Record<string, { from: unknown; to: unknown }> | null;
};

describe('Transaction audit: one revision per save, stable line ids — notes 89 (e2e, rolled back)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let service: StockVoucherService;
  let scope: {
    company_id: string;
    branch_id: string;
    device_id: string;
    godown_id: string;
    user_id: string;
  };
  const items: Array<{ itemId: string; iucId: string }> = [];
  const stamp = Date.now().toString(36).toUpperCase();

  beforeAll(async () => {
    await new Promise<void>((ready, fail) => {
      txDone = prisma
        .$transaction(
          async (client) => {
            tx = client;
            ready();
            await new Promise<void>((resolve) => {
              release = resolve;
            });
            throw new Rollback();
          },
          { maxWait: 30_000, timeout: 10 * 60_000 },
        )
        .then(
          () => undefined,
          (error: unknown) => {
            if (error instanceof Rollback) return;
            fail(error instanceof Error ? error : new Error(String(error)));
            throw error;
          },
        );
    });
    [scope] = await tx.$queryRaw<(typeof scope)[]>`
      SELECT br.br_comp_id AS company_id, br.br_id AS branch_id, dev.dev_id AS device_id,
             gdl.gdl_id AS godown_id, usr.usr_id AS user_id
        FROM public.branch_master br
        JOIN fixed.device_master dev        ON dev.dev_branch_id = br.br_id AND dev.dev_is_deleted = false
        JOIN inventory.godown_locations gdl ON gdl.gdl_branch_id = br.br_id AND gdl.gdl_is_deleted = false
        JOIN public.user_master usr         ON usr.usr_is_deleted = false
       WHERE br.br_is_deleted = false
       LIMIT 1`;
    const [group] = await tx.$queryRaw<Array<{ itg_id: string }>>`
      SELECT itg_id FROM inventory.item_group_master LIMIT 1`;
    const [unit] = await tx.$queryRaw<Array<{ unit_id: string }>>`
      SELECT unit_id FROM inventory.item_unit_master ORDER BY unit_name LIMIT 1`;
    for (const n of [1, 2, 3, 4]) {
      const item = await tx.itemMaster.create({
        data: {
          itemCode: `ZT89-${stamp}-${n}`,
          itemNameEn: `ZT89 item ${n} (e2e)`,
          itemGroupId: group.itg_id,
          itemCompanyId: scope.company_id,
          itemBranchId: scope.branch_id,
        },
        select: { itemId: true },
      });
      const iuc = await tx.itemUnitConversion.create({
        data: {
          iucItemId: item.itemId,
          iucUnitId: unit.unit_id,
          iucBaseUnitId: unit.unit_id,
          iucToBaseFactor: 1,
          iucUnitSlno: 1,
          iucIsBaseUnit: true,
        },
        select: { iucId: true },
      });
      items.push({ itemId: item.itemId, iucId: iuc.iucId });
    }
    const ctx = {
      getUserId: () => scope.user_id,
      getCompanyId: () => scope.company_id,
      getBranchId: () => scope.branch_id,
      getDeviceId: () => null,
      getIpAddress: () => null,
    } as unknown as RequestContextService;
    const db = transactional(tx);
    // The REAL audit service: the revision rows are what this suite checks.
    service = new StockVoucherService(db, new AuditLogService(db, ctx), ctx, {} as never);
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  const line = (n: number, itemIndex: number, qty: number, sviId?: string) => ({
    ...(sviId ? { sviId } : {}),
    lineNo: n,
    itemId: items[itemIndex].itemId,
    uomId: items[itemIndex].iucId,
    baseUomId: items[itemIndex].iucId,
    toBaseFactor: 1,
    qty,
    baseQty: qty,
    godownId: scope.godown_id,
    costRate: 10,
    taxPerc: 0,
  });
  const header = (over: Record<string, unknown> = {}) => ({
    accYear: ACC_YEAR,
    companyId: scope.company_id,
    branchId: scope.branch_id,
    deviceId: scope.device_id,
    docDate: '2026-04-01',
    toGodownId: scope.godown_id,
    rateSource: 'MANUAL',
    userId: scope.user_id,
    ...over,
  });
  const save = (body: { header: Record<string, unknown>; lines: unknown[] }) =>
    service.save(OPENING_RULES, body as unknown as SaveStockVoucherDto);
  const revisions = (svhId: string) =>
    tx.$queryRaw<RevisionRow[]>`
      SELECT l.log_action::text AS log_action, l.log_rev_no, l.log_entity_id::text AS log_entity_id,
             l.log_device_name, l.log_notes, l.log_original_record IS NULL AS original_is_null,
             l.log_original_record, l.log_modified_record, l.log_changed_fields
        FROM audit.audit_log l
        JOIN audit.audit_screen s ON s.screen_id = l.log_screen_id
       WHERE s.screen_name = 'Opening Stock' AND l.log_pk = ${svhId}
       ORDER BY l.log_rev_no NULLS FIRST, l.log_date`;

  it('1–4. create, then edit: one revision each, ids kept, only changed header fields, no line rows', async () => {
    const created = await save({
      header: header({ remarks: 'first count', totalValue: 60 }),
      lines: [line(1, 0, 1), line(2, 1, 2), line(3, 2, 3)],
    });
    const svhId = created.header.svhId;
    const [a, b, c] = created.lines;

    // 1 — the create.
    let rows = await revisions(svhId);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      log_action: 'insert',
      log_rev_no: 1,
      log_entity_id: svhId,
      original_is_null: true,
      log_changed_fields: null,
      log_notes: 'Opening stock created',
    });
    expect(rows[0].log_device_name).toBeTruthy();
    expect(rows[0].log_modified_record?.lines).toHaveLength(3);
    expect(rows[0].log_modified_record?.lines.map((l) => l.sviId)).toEqual([
      a.sviId,
      b.sviId,
      c.sviId,
    ]);

    // 2 — change qty on line 1, drop line 2, add a new line; new remarks + total.
    const edited = await save({
      header: header({ svhId, remarks: 'recount', totalValue: 75 }),
      lines: [line(1, 0, 5, a.sviId), line(2, 2, 3, c.sviId), line(3, 3, 4)],
    });
    expect(edited.lines.map((l) => l.sviId)).toEqual([a.sviId, c.sviId, expect.any(String)]);
    const added = edited.lines[2].sviId;
    expect([a.sviId, b.sviId, c.sviId]).not.toContain(added);
    expect(edited.lines[0].qty).toBe(5);

    rows = await revisions(svhId);
    expect(rows).toHaveLength(2);
    const rev2 = rows[1];
    expect(rev2).toMatchObject({ log_action: 'update', log_rev_no: 2, original_is_null: false });
    expect(rev2.log_original_record?.lines.map((l) => l.sviId)).toEqual([
      a.sviId,
      b.sviId,
      c.sviId,
    ]);
    expect(rev2.log_modified_record?.lines.map((l) => l.sviId)).toEqual([a.sviId, c.sviId, added]);
    expect(rev2.log_original_record?.lines[0].qty).toBe(1);
    expect(rev2.log_modified_record?.lines[0].qty).toBe(5);
    // The BEFORE of rev 2 is the AFTER of rev 1.
    expect(rev2.log_original_record).toEqual(rows[0].log_modified_record);

    // 3 — the header diff names what changed and nothing the save did not touch.
    const changed = Object.keys(rev2.log_changed_fields ?? {});
    expect(changed).toEqual(expect.arrayContaining(['remarks', 'totalValue']));
    expect(changed).not.toContain('svhId');
    expect(changed).not.toContain('docDate');
    expect(changed).not.toContain('toGodownId');
    expect(rev2.log_changed_fields?.remarks).toEqual({ from: 'first count', to: 'recount' });

    // 4 — no per-line row, no header-only row: every row on this document is a revision.
    expect(rows.every((r) => r.log_rev_no !== null)).toBe(true);
    const [{ n }] = await tx.$queryRaw<Array<{ n: number }>>`
      SELECT count(*)::int AS n FROM audit.audit_log
       WHERE log_pk = ${svhId} AND log_table_name = 'stock_voucher_item'`;
    expect(n).toBe(0);
  });

  it('a renumber that swaps two lines keeps both ids, and the stored rows follow', async () => {
    const created = await save({
      header: header(),
      lines: [line(1, 0, 1), line(2, 1, 2)],
    });
    const [a, b] = created.lines;
    const swapped = await save({
      header: header({ svhId: created.header.svhId }),
      lines: [line(1, 1, 2, b.sviId), line(2, 0, 1, a.sviId)],
    });
    expect(swapped.lines.map((l) => [l.lineNo, l.sviId])).toEqual([
      [1, b.sviId],
      [2, a.sviId],
    ]);
    const rows = await revisions(created.header.svhId);
    expect(rows.map((r) => r.log_rev_no)).toEqual([1, 2]);
  });

  it('refuses a line id this document does not hold, and writes no revision for it', async () => {
    const created = await save({ header: header(), lines: [line(1, 0, 1)] });
    const before = (await revisions(created.header.svhId)).length;
    let refused: unknown;
    try {
      await tx.$executeRawUnsafe('SAVEPOINT sp_foreign');
      await save({
        header: header({ svhId: created.header.svhId }),
        lines: [line(1, 0, 1, '019f0000-0000-7000-8000-000000000089')],
      });
    } catch (error) {
      refused = error;
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT sp_foreign');
    }
    expect((refused as { status?: number }).status).toBe(422);
    expect(JSON.stringify((refused as { response?: unknown }).response)).toContain(
      'not a line of this document',
    );
    expect(await revisions(created.header.svhId)).toHaveLength(before);
  });
});
