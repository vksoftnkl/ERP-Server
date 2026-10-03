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
import { SaleAgentService } from '../src/modules/sales/sale-agent/sale-agent.service';
import { SaveSaleAgentDto } from '../src/modules/sales/sale-agent/dto/save-sale-agent.dto';
import { SaveAccountLedgerMasterDto } from '../src/modules/accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';

/**
 * NOTES 82 (ledger delete) — a ledger that IS a customer, supplier or sale agent (cus_id /
 * sup_id / sa_id = led_id) is refused by DELETE /account-ledger-masters/delete, so no master is
 * left live on a deleted ledger. Against the real database, in one rolled-back transaction like
 * `party-shared-ledger-notes-81.e2e-spec.ts`.
 *
 *     npm run test:e2e -- ledger-delete-owner-guard
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

describe('The ledger delete refuses a ledger a master owns, notes 82 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let customers: CustomerService;
  let suppliers: SuppliersService;
  let ledgers: AccountLedgerMastersService;
  let saleAgents: SaleAgentService;
  let companyId: string;
  let saleAgentGroupId: string;
  let userId: string;
  let areaIds: [string, string];
  let custGroupId: string;
  let priceLevelId: number;
  let supplierGroupId: string;
  let spSeq = 0;
  const stamp = Date.now().toString(36).toUpperCase();
  const name = (what: string) => `ZT82-${what}-${stamp}`;

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
    ledgers = new AccountLedgerMastersService(db, audit, ctx);
    customers = new CustomerService(db, audit, ctx, ledgers);
    suppliers = new SuppliersService(db, audit, ctx, ledgers);
    saleAgents = new SaleAgentService(db, audit, ctx, ledgers);
    companyId = (await tx.company.findFirstOrThrow({ where: { compIsDeleted: false } })).compId;
    saleAgentGroupId = (
      await tx.saleAgentGroup.findFirstOrThrow({ where: { saGrpIsDeleted: false } })
    ).saGrpId;
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

  const deleteLedger = (ledId: string) => attempt(() => ledgers.softDelete(ledId));
  async function expectRefused(ledId: string, ...mentions: string[]) {
    const refused = await refusal(deleteLedger(ledId));
    expect(refused.status).toBe(400);
    for (const mention of mentions) expect(refused.body).toContain(mention);
    expect(await ledgerOf(ledId)).toMatchObject({ ledIsDeleted: false, ledIsActive: true });
    return refused.body;
  }

  it("1. a customer's ledger is refused, and ledger and customer both stay active", async () => {
    const customer = await saveCustomer(customerBody('C'));
    const body = await expectRefused(
      customer.cusId,
      `This ledger belongs to customer \\"${name('C')}\\". Delete it from the Customer master.`,
      'ledId',
    );
    expect(body).not.toContain('supplier');
    expect(await tx.customer.findUniqueOrThrow({ where: { cusId: customer.cusId } })).toMatchObject(
      { cusIsDeleted: false, cusIsActive: true },
    );
  });

  it("2. a supplier's ledger is refused the same way", async () => {
    const supplier = await saveSupplier(supplierBody('S'));
    await expectRefused(supplier.supId, `supplier \\"${name('S')}\\"`, 'Supplier master.');
    expect(await tx.supplier.findUniqueOrThrow({ where: { supId: supplier.supId } })).toMatchObject(
      { supIsDeleted: false, supIsActive: true },
    );
  });

  it('2b. a ledger that is both names both masters', async () => {
    const customer = await saveCustomer(customerBody('BOTH'));
    await saveSupplier(supplierBody('BOTH', { supLinkLedId: customer.cusId }));
    await expectRefused(
      customer.cusId,
      `customer \\"${name('BOTH')}\\" and supplier \\"${name('BOTH')}\\"`,
      'Delete it from the Customer and Supplier masters.',
    );

    // With the customer gone through its own master the supplier still holds the ledger.
    await attempt(() => customers.softDelete(customer.cusId));
    await expectRefused(customer.cusId, 'Supplier master.');
  });

  it("2c. a sale agent's ledger is refused too", async () => {
    const { dto, errors } = await asDto(SaveSaleAgentDto, {
      saCompanyId: companyId,
      saGroupId: saleAgentGroupId,
      saName: name('SA'),
    });
    expect(errors).toEqual([]);
    const agent = await attempt(() => saleAgents.save(dto));
    await expectRefused(agent.saId, `sale agent \\"${name('SA')}\\"`, 'Sale Agent master.');
  });

  it('3. a ledger with no customer, supplier or sale agent still deletes as today', async () => {
    const { dto, errors } = await asDto(SaveAccountLedgerMasterDto, {
      ledName: name('PLAIN'),
      ledGroupId: SUPPLIERS_GROUP_ID,
      ledStateName: 'Tamil Nadu',
      ledStateCode: '33',
    });
    expect(errors).toEqual([]);
    const ledger = await attempt(() => ledgers.save(dto));
    await expect(deleteLedger(ledger.ledId)).resolves.toEqual({
      ledId: ledger.ledId,
      deleted: true,
    });
    expect(await ledgerOf(ledger.ledId)).toMatchObject({ ledIsDeleted: true, ledIsActive: false });
  });

  it('3b. so does one whose only master row is already deleted', async () => {
    const customer = await saveCustomer(customerBody('GONE'));
    // A legacy state: the customer row deleted, its ledger left live (pre-notes-81 data).
    await tx.customer.update({
      where: { cusId: customer.cusId },
      data: { cusIsDeleted: true, cusIsActive: false },
    });
    await expect(deleteLedger(customer.cusId)).resolves.toMatchObject({ deleted: true });
  });
});
