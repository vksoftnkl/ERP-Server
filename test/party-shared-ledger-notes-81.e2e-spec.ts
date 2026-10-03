import { Prisma, PrismaClient } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { AccountLedgerMastersService } from '../src/modules/accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { CustomerService } from '../src/modules/sales/customer/customer.service';
import { SaveCustomerDto } from '../src/modules/sales/customer/dto/save-customer.dto';
import { SuppliersService } from '../src/modules/purchase/suppliers/suppliers.service';
import { SaveSupplierDto } from '../src/modules/purchase/suppliers/dto/save-supplier.dto';

/**
 * NOTES 81 — one party as both customer and supplier, on one ledger — against the real
 * database, in one rolled-back transaction like `company-branch-notes-78.e2e-spec.ts`.
 * Covers acceptance 1–5: the link create (both directions), the 409 on a repeat, edits that
 * leave the shared ledger's group alone, and deletes that keep the ledger while the other
 * role lives. Acceptance 6 (posting) needs no change: every document already names led_id.
 *
 *     npm run test:e2e -- party-shared-ledger-notes-81
 */

const prisma = new PrismaClient();
class Rollback extends Error {}
const SUPPLIERS_GROUP_ID = '019f081c-98cc-757a-9346-4cfba810c47f';

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

describe('One party as customer and supplier on one ledger, notes 81 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let customers: CustomerService;
  let suppliers: SuppliersService;
  let userId: string;
  let areaIds: [string, string];
  let custGroupId: string;
  let priceLevelId: number;
  let supplierGroupId: string;
  let spSeq = 0;
  const stamp = Date.now().toString(36).toUpperCase();
  const name = (what: string) => `ZT81-${what}-${stamp}`;

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
    const [user] = await tx.$queryRaw<Array<{ usr_id: string }>>`
      SELECT usr_id FROM public.user_master WHERE usr_is_deleted = false LIMIT 1`;
    userId = user.usr_id;
    // Two live areas that are mirrored as account groups, so a customer's ledger can hang
    // under either and an area change has somewhere to (wrongly) move it.
    const areas = await tx.$queryRaw<Array<{ arm_id: string }>>`
      SELECT a.arm_id FROM sales.area_master a
        JOIN accounts.acc_group_master g ON g.acc_group_id = a.arm_id AND NOT g.acc_group_is_deleted
       WHERE NOT a.arm_is_deleted ORDER BY a.arm_id LIMIT 2`;
    expect(areas).toHaveLength(2);
    areaIds = [areas[0].arm_id, areas[1].arm_id];
    custGroupId = (await tx.custGroup.findFirstOrThrow({ where: { cgrIsDeleted: false } })).cgrId;
    priceLevelId = (await tx.itemPriceLevel.findFirstOrThrow({ where: { iplIsDeleted: false } }))
      .iplId;
    supplierGroupId = (await tx.supplierGroup.findFirstOrThrow({ where: { spgIsDeleted: false } }))
      .spgId;

    const ctx = {
      getUserId: () => userId,
      getCompanyId: () => null,
      getIpAddress: () => null,
    } as unknown as RequestContextService;
    const db = transactional(tx);
    const audit = new AuditLogService(db, ctx);
    const ledgers = new AccountLedgerMastersService(db, audit, ctx);
    customers = new CustomerService(db, audit, ctx, ledgers);
    suppliers = new SuppliersService(db, audit, ctx, ledgers);
  });

  afterAll(async () => {
    if (release) {
      release();
      await txDone;
    }
    await prisma.$disconnect();
  });

  /** Runs `fn` inside a SAVEPOINT and rolls back to it on failure, then rethrows. */
  async function attempt<T>(fn: () => Promise<T>): Promise<T> {
    const sp = `sp_${++spSeq}`;
    await tx.$executeRawUnsafe(`SAVEPOINT ${sp}`);
    try {
      const out = await fn();
      await tx.$executeRawUnsafe(`RELEASE SAVEPOINT ${sp}`);
      return out;
    } catch (error) {
      await tx.$executeRawUnsafe(`ROLLBACK TO SAVEPOINT ${sp}`);
      throw error;
    }
  }
  const refusal = async (promise: Promise<unknown>) => {
    try {
      await promise;
    } catch (error) {
      return {
        status: (error as { status?: number }).status,
        body: JSON.stringify((error as { response?: unknown }).response ?? String(error)),
      };
    }
    throw new Error('expected a refusal, got a result');
  };
  /** The DTO as the controller builds it: transformed and validated like main.ts does. */
  async function asDto<T extends object>(cls: new () => T, body: Record<string, unknown>) {
    const dto = plainToInstance(cls, body, { enableImplicitConversion: true });
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    return { dto, errors: errors.map((e) => e.property) };
  }
  async function saveCustomer(body: Record<string, unknown>) {
    const { dto, errors } = await asDto(SaveCustomerDto, body);
    expect(errors).toEqual([]);
    return attempt(() => customers.save(dto));
  }
  async function saveSupplier(body: Record<string, unknown>) {
    const { dto, errors } = await asDto(SaveSupplierDto, body);
    expect(errors).toEqual([]);
    return attempt(() => suppliers.save(dto));
  }
  const customerBody = (what: string, extra: Record<string, unknown> = {}) => ({
    cusName: name(what),
    cusStateName: 'Tamil Nadu',
    cusStateCode: '33',
    cusAreaId: areaIds[0],
    cusGroupId: custGroupId,
    cusPriceLevelId: priceLevelId,
    cusAddr1: '12 Mount Road',
    cusCity: 'Chennai',
    cusGstNo: '33ZTABC1234Z1Z5',
    cusPanNo: 'ZTABC1234Z',
    ...extra,
  });
  const supplierBody = (what: string, extra: Record<string, unknown> = {}) => ({
    supName: name(what),
    supGroupId: supplierGroupId,
    supPurchaseType: 'LOCAL',
    supStateName: 'Tamil Nadu',
    supStateCode: '33',
    supGstType: 'REGULAR',
    supAddr1: '7 Market Street',
    supCity: 'Salem',
    supGstNo: '33ZTSUP1234Z1Z9',
    supPanNo: 'ZTSUP1234Z',
    ...extra,
  });
  const ledgerOf = (ledId: string) => tx.accLedgerMaster.findUniqueOrThrow({ where: { ledId } });

  // ── 1 / 2 — customer first, then the supplier on its ledger ──────────────
  it('1. a customer made a supplier keeps exactly one ledger, in its own group', async () => {
    const customer = await saveCustomer(customerBody('C2S'));
    const before = await ledgerOf(customer.cusId);
    expect(before.ledGroupId).toBe(areaIds[0]);

    // Only what a supplier has and a ledger lacks: name, state, address, GSTIN, PAN come along.
    const supplier = await saveSupplier({
      supLinkLedId: customer.cusId,
      supGroupId: supplierGroupId,
      supPurchaseType: 'LOCAL',
      supGstType: 'REGULAR',
    });
    expect(supplier.supId).toBe(customer.cusId);
    expect(supplier).toMatchObject({
      supName: name('C2S'),
      supStateName: 'Tamil Nadu',
      supStateCode: '33',
      supAddr1: '12 Mount Road',
      supCity: 'Chennai',
      supGstNo: '33ZTABC1234Z1Z5',
      supPanNo: 'ZTABC1234Z',
      supIsActive: true,
    });

    const named = await tx.accLedgerMaster.count({
      where: { ledName: name('C2S'), ledIsDeleted: false },
    });
    expect(named).toBe(1);
    const after = await ledgerOf(customer.cusId);
    expect(after.ledGroupId).toBe(before.ledGroupId);
    expect(after.ledModifiedOn).toEqual(before.ledModifiedOn); // not written at all

    const audit = await tx.auditLog.findFirst({
      where: { logTableName: 'suppliers', logPk: customer.cusId },
      orderBy: { logId: 'desc' },
    });
    expect(audit).toMatchObject({ logAction: 'insert' });
  });

  it('2. linking the same ledger again is a 409 naming supLinkLedId', async () => {
    const customer = await saveCustomer(customerBody('TWICE'));
    await saveSupplier(supplierBody('TWICE', { supLinkLedId: customer.cusId }));
    const { dto } = await asDto(
      SaveSupplierDto,
      supplierBody('TWICE', { supLinkLedId: customer.cusId }),
    );
    const refused = await refusal(attempt(() => suppliers.save(dto)));
    expect(refused.status).toBe(409);
    expect(refused.body).toContain('supLinkLedId');
    expect(refused.body).toContain('already a supplier');
  });

  it('2b. without the link the same name is still refused — that is what the link is for', async () => {
    await saveCustomer(customerBody('NOLINK'));
    const { dto } = await asDto(SaveSupplierDto, supplierBody('NOLINK'));
    const refused = await refusal(attempt(() => suppliers.save(dto)));
    expect(refused.status).toBe(409);
    expect(refused.body).toContain('ledName');
  });

  // ── 3 — edits leave the shared ledger's group alone ──────────────────────
  it('3. editing the supplier, then the customer (even to another area), leaves led_group_id', async () => {
    const customer = await saveCustomer(customerBody('EDIT'));
    const groupId = (await ledgerOf(customer.cusId)).ledGroupId;
    await saveSupplier(supplierBody('EDIT', { supLinkLedId: customer.cusId }));

    await saveSupplier(
      supplierBody('EDIT', { supId: customer.cusId, supAddr1: '9 New Street', supTel: '0427' }),
    );
    let ledger = await ledgerOf(customer.cusId);
    expect(ledger.ledGroupId).toBe(groupId);
    expect(ledger.ledAddr1).toBe('9 New Street'); // last save wins on the shared fields

    await saveCustomer(customerBody('EDIT', { cusId: customer.cusId, cusAreaId: areaIds[1] }));
    ledger = await ledgerOf(customer.cusId);
    expect(ledger.ledGroupId).toBe(groupId);
    expect(ledger.ledAddr1).toBe('12 Mount Road');
    const stored = await tx.customer.findUniqueOrThrow({ where: { cusId: customer.cusId } });
    expect(stored.cusAreaId).toBe(areaIds[1]); // the beat moves, the ledger does not
  });

  it('3b. the ledger stays active while either role is active', async () => {
    const customer = await saveCustomer(customerBody('ACTIVE'));
    await saveSupplier(supplierBody('ACTIVE', { supLinkLedId: customer.cusId }));

    await saveSupplier(supplierBody('ACTIVE', { supId: customer.cusId, supIsActive: false }));
    expect((await ledgerOf(customer.cusId)).ledIsActive).toBe(true);

    await saveCustomer(customerBody('ACTIVE', { cusId: customer.cusId, cusIsActive: false }));
    expect((await ledgerOf(customer.cusId)).ledIsActive).toBe(false);

    await saveSupplier(supplierBody('ACTIVE', { supId: customer.cusId, supIsActive: true }));
    expect((await ledgerOf(customer.cusId)).ledIsActive).toBe(true);
  });

  it('3c. a customer-only ledger still follows its area, as before', async () => {
    const customer = await saveCustomer(customerBody('SOLO'));
    await saveCustomer(customerBody('SOLO', { cusId: customer.cusId, cusAreaId: areaIds[1] }));
    expect((await ledgerOf(customer.cusId)).ledGroupId).toBe(areaIds[1]);
  });

  // ── 4 — deleting one role keeps the other's ledger ───────────────────────
  it('4. deleting the supplier keeps ledger and customer; deleting the customer then drops the ledger', async () => {
    const customer = await saveCustomer(customerBody('DEL'));
    await saveSupplier(supplierBody('DEL', { supLinkLedId: customer.cusId }));

    await attempt(() => suppliers.softDelete(customer.cusId));
    let ledger = await ledgerOf(customer.cusId);
    expect(ledger).toMatchObject({ ledIsDeleted: false, ledIsActive: true });
    await expect(customers.getById(customer.cusId)).resolves.toMatchObject({
      cusIsActive: true,
      cusIsDeleted: false,
    });

    await attempt(() => customers.softDelete(customer.cusId));
    ledger = await ledgerOf(customer.cusId);
    expect(ledger).toMatchObject({ ledIsDeleted: true, ledIsActive: false });
  });

  it('4b. a supplier deleted off a shared ledger can be made again, on the same row', async () => {
    const customer = await saveCustomer(customerBody('AGAIN'));
    const first = await saveSupplier(supplierBody('AGAIN', { supLinkLedId: customer.cusId }));
    await attempt(() => suppliers.softDelete(customer.cusId));

    const again = await saveSupplier(
      supplierBody('AGAIN', { supLinkLedId: customer.cusId, supCreditDays: 30 }),
    );
    expect(again).toMatchObject({
      supId: customer.cusId,
      supIsDeleted: false,
      supIsActive: true,
      supCreditDays: 30,
      supCreatedOn: first.supCreatedOn,
    });
  });

  // ── 5 — the reverse direction ────────────────────────────────────────────
  it('5. a supplier made a customer keeps its ledger under Suppliers, through edits and deletes', async () => {
    const supplier = await saveSupplier(supplierBody('S2C'));
    expect((await ledgerOf(supplier.supId)).ledGroupId).toBe(SUPPLIERS_GROUP_ID);

    const customer = await saveCustomer({
      cusLinkLedId: supplier.supId,
      cusAreaId: areaIds[0],
      cusGroupId: custGroupId,
      cusPriceLevelId: priceLevelId,
    });
    expect(customer).toMatchObject({
      cusId: supplier.supId,
      cusName: name('S2C'),
      cusStateCode: '33',
      cusAddr1: '7 Market Street',
      cusGstNo: '33ZTSUP1234Z1Z9',
      cusAreaId: areaIds[0],
    });
    expect((await ledgerOf(supplier.supId)).ledGroupId).toBe(SUPPLIERS_GROUP_ID);

    const repeat = await asDto(
      SaveCustomerDto,
      customerBody('S2C', { cusLinkLedId: supplier.supId }),
    );
    const refused = await refusal(attempt(() => customers.save(repeat.dto)));
    expect(refused.status).toBe(409);

    await saveCustomer(customerBody('S2C', { cusId: supplier.supId, cusAreaId: areaIds[1] }));
    await saveSupplier(supplierBody('S2C', { supId: supplier.supId }));
    expect((await ledgerOf(supplier.supId)).ledGroupId).toBe(SUPPLIERS_GROUP_ID);

    await attempt(() => customers.softDelete(supplier.supId));
    expect(await ledgerOf(supplier.supId)).toMatchObject({ ledIsDeleted: false });
    await expect(suppliers.getById(supplier.supId)).resolves.toMatchObject({ supIsActive: true });

    await attempt(() => suppliers.softDelete(supplier.supId));
    expect(await ledgerOf(supplier.supId)).toMatchObject({ ledIsDeleted: true });
  });

  // ── refusals ─────────────────────────────────────────────────────────────
  it('refuses a ledger that is missing, deleted or not a party', async () => {
    const missing = await asDto(SaveSupplierDto, {
      ...supplierBody('MISSING'),
      supLinkLedId: '019f0000-0000-7000-8000-000000000000',
    });
    const a = await refusal(attempt(() => suppliers.save(missing.dto)));
    expect(a.status).toBe(400);
    expect(a.body).toContain('supLinkLedId');

    const cash = await tx.accLedgerMaster.findFirstOrThrow({
      where: { ledLedgerType: 'CASH', ledIsDeleted: false },
    });
    const notParty = await asDto(
      SaveCustomerDto,
      customerBody('CASH', { cusLinkLedId: cash.ledId }),
    );
    const b = await refusal(attempt(() => customers.save(notParty.dto)));
    expect(b.status).toBe(400);
    expect(b.body).toContain('only a PARTY ledger');

    const gone = await saveCustomer(customerBody('GONE'));
    await attempt(() => customers.softDelete(gone.cusId));
    const deleted = await asDto(
      SaveSupplierDto,
      supplierBody('GONE', { supLinkLedId: gone.cusId }),
    );
    const c = await refusal(attempt(() => suppliers.save(deleted.dto)));
    expect(c.status).toBe(400);
  });

  it('refuses bank accounts on a link create, and a link to another ledger on an edit', async () => {
    const customer = await saveCustomer(customerBody('BANK'));
    const withBank = await asDto(
      SaveSupplierDto,
      supplierBody('BANK', {
        supLinkLedId: customer.cusId,
        ledgerBankAccount: [{ lbaAccountHolder: 'ZT81', lbaBankName: 'KVB', lbaAccountNo: '123' }],
      }),
    );
    const a = await refusal(attempt(() => suppliers.save(withBank.dto)));
    expect(a.status).toBe(400);
    expect(a.body).toContain('ledgerBankAccount');

    const supplier = await saveSupplier(supplierBody('OTHER'));
    const mismatched = await asDto(
      SaveSupplierDto,
      supplierBody('OTHER', { supId: supplier.supId, supLinkLedId: customer.cusId }),
    );
    const b = await refusal(attempt(() => suppliers.save(mismatched.dto)));
    expect(b.status).toBe(400);
    expect(b.body).toContain('create only');
  });

  it('the name and state may be left out only with a link', async () => {
    const bare = { supGroupId: supplierGroupId, supPurchaseType: 'LOCAL', supGstType: 'REGULAR' };
    const unlinked = await asDto(SaveSupplierDto, bare);
    expect(unlinked.errors.sort()).toEqual(['supName', 'supStateCode', 'supStateName']);
    const linked = await asDto(SaveSupplierDto, {
      ...bare,
      supLinkLedId: '019f0000-0000-7000-8000-000000000000',
    });
    expect(linked.errors).toEqual([]);

    const cusBare = {
      cusAreaId: areaIds[0],
      cusGroupId: custGroupId,
      cusPriceLevelId: priceLevelId,
    };
    expect((await asDto(SaveCustomerDto, cusBare)).errors.sort()).toEqual([
      'cusStateCode',
      'cusStateName',
    ]);
  });
});
