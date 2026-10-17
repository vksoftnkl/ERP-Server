import { Prisma, PrismaClient } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { CompanyMasterService } from '../src/modules/settings/companyMaster/company-master.service';
import { SaveCompanyMasterDto } from '../src/modules/settings/companyMaster/dto/save-company-master.dto';
import { BranchMasterService } from '../src/modules/settings/branchMaster/branch-master.service';
import { SaveBranchMasterDto } from '../src/modules/settings/branchMaster/dto/save-branch-master.dto';
import { GodownsMasterService } from '../src/modules/Inventory/godowns-master/godowns-master.service';

/**
 * NOTES 78 — a new company gets its main branch — against the real database,
 * in one rolled-back transaction like `company-branch-notes-72.e2e-spec.ts`:
 * the seeded Main Branch and Main Godown (items 1, 2), one live default per
 * company (item 4), the default flag that moves but is never dropped (item 5)
 * and the company's last branch (item 6). The backfill and the index are
 * migration 20261002100000, already applied to the database this runs on.
 *
 *     npm run test:e2e -- company-branch-notes-78
 */

const prisma = new PrismaClient();
class Rollback extends Error {}

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

describe('A new company gets its main branch, notes 78 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let companies: CompanyMasterService;
  let branches: BranchMasterService;
  let userId: string;
  let spSeq = 0;
  const stamp = Date.now().toString(36).toUpperCase();
  const name = (what: string) => `ZT78-${what}-${stamp}`;

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
    const ctx = {
      getUserId: () => userId,
      getCompanyId: () => null,
      getIpAddress: () => null,
    } as unknown as RequestContextService;
    const db = transactional(tx);
    // The REAL audit service, the real godown service: the seed audits both rows.
    const audit = new AuditLogService(db, ctx);
    branches = new BranchMasterService(db, audit, ctx, new GodownsMasterService(db, audit, ctx));
    companies = new CompanyMasterService(db, audit, ctx, branches);
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
  /** The DTO as the controller builds it: transformed and validated. */
  const newCompany = (what: string, extra: Record<string, unknown> = {}) =>
    attempt(async () => {
      const dto = plainToInstance(SaveCompanyMasterDto, {
        compName: name(what),
        compStateCode: '33',
        ...extra,
      });
      const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
      expect(errors.map((e) => e.property)).toEqual([]);
      return companies.save(dto);
    });
  const newBranch = (compId: string, what: string, extra: Record<string, unknown> = {}) =>
    attempt(() =>
      branches.save(
        plainToInstance(SaveBranchMasterDto, {
          brCompId: compId,
          brName: name(what),
          brStateCode: '33',
          ...extra,
        }),
      ),
    );
  const liveBranches = (compId: string) =>
    tx.branchMaster.findMany({ where: { brCompId: compId, brIsDeleted: false } });

  // ── 1 / 2 — the seeded branch and godown ──────────────────────────────────
  it('1/2. a new company has one live branch, Main Branch, default, copied from the company, with Main Godown', async () => {
    const created = await newCompany('seed', {
      compGstinNo: '33ZTABC1234Z1Z5',
      compGstRegType: 'regular',
      compAddr1: '12 Mount Road',
      compAddr2: 'Anna Salai',
      compCity: 'Chennai',
      compDistrict: 'Chennai',
      compState: 'Tamil Nadu',
      compPin: 600002,
      compRegionAddr1: 'மவுண்ட் ரோடு',
      compRegionCity: 'சென்னை',
      compTel: '04412345678',
      compPhone: '9876543210',
      compMail: 'seed@example.com',
    });
    expect(created.compMainBranch).toMatchObject({ brName: 'Main Branch', gdlName: 'Main Godown' });
    const seeded = created.compMainBranch!;

    const live = await liveBranches(created.compId);
    expect(live).toHaveLength(1);
    const [main] = live;
    expect(main).toMatchObject({
      brId: seeded.brId,
      brName: 'Main Branch',
      brType: 'HEAD OFFICE',
      brIsDefault: true,
      brIsActive: true,
      brCode: null,
      brStateCode: '33',
      brState: 'Tamil Nadu',
      brGstinNo: '33ZTABC1234Z1Z5',
      brGstRegType: 'REGULAR',
      brPanNo: 'ZTABC1234Z',
      brAddr1: '12 Mount Road',
      brAddr2: 'Anna Salai',
      brCity: 'Chennai',
      brDistrict: 'Chennai',
      brPin: 600002,
      brCountry: created.compCountry,
      brRegionAddr1: 'மவுண்ட் ரோடு',
      brRegionCity: 'சென்னை',
      brTel: '04412345678',
      brPhone: '9876543210',
      brMail: 'seed@example.com',
      brDefaultGodownId: seeded.gdlId,
      brCreatedBy: userId,
    });

    const godown = await tx.godownLocation.findFirstOrThrow({ where: { gdlId: seeded.gdlId } });
    expect(godown).toMatchObject({
      gdlBranchId: main.brId,
      gdlName: 'Main Godown',
      gdlType: 'WAREHOUSE',
      gdlParentId: null,
      gdlLevel: 0,
      gdlPathIdsCache: [seeded.gdlId],
      gdlIsActive: true,
      gdlIsDeleted: false,
      gdlCreatedBy: userId,
    });

    // Both are audited as seeded; the Branch screen resolves the godown's name;
    // GET on the company does not repeat the seed.
    const audits = await tx.$queryRaw<Array<{ log_table_name: string; log_notes: string }>>`
      SELECT log_table_name, log_notes FROM audit.audit_log
       WHERE log_pk IN (${seeded.brId}, ${seeded.gdlId}) ORDER BY log_table_name`;
    expect(audits).toEqual([
      { log_table_name: 'branch master', log_notes: 'Seeded on company create' },
      { log_table_name: 'godown locations', log_notes: 'Seeded on company create' },
    ]);
    expect(await branches.getById(main.brId)).toMatchObject({
      brDefaultGodownName: 'Main Godown',
      brCompName: created.compName,
    });
    expect((await companies.getById(created.compId)).compMainBranch).toBeUndefined();
  });

  it('1. the seed copies what the company has: a bare company gives a bare branch', async () => {
    const created = await newCompany('bare');
    const [main] = await liveBranches(created.compId);
    expect(main).toMatchObject({
      brName: 'Main Branch',
      brIsDefault: true,
      brStateCode: '33',
      brState: null,
      brGstinNo: null,
      brGstRegType: null,
      brPanNo: null,
      brAddr1: null,
      brPin: null,
      brMail: null,
    });
    expect(main.brDefaultGodownId).toBe(created.compMainBranch!.gdlId);
  });

  // ── 4 — one live default per company ──────────────────────────────────────
  it('4. the table refuses a second live default; the service moves the flag instead', async () => {
    const company = await newCompany('uq');
    const mainId = company.compMainBranch!.brId;
    const second = await refusal(
      attempt(
        () => tx.$executeRaw`
          INSERT INTO public.branch_master (br_comp_id, br_name, br_state_code, br_is_default)
          VALUES (${company.compId}::uuid, ${name('uq-raw')}, '33', true)`,
      ),
    );
    // Prisma reports the unique violation by code and key, not by index name.
    expect(second.body).toContain('23505');
    expect(second.body).toContain('Key (br_comp_id)');
    const [index] = await tx.$queryRaw<Array<{ indexdef: string }>>`
      SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_branch_master_default'`;
    expect(index.indexdef).toContain('WHERE (br_is_default AND (NOT br_is_deleted))');

    // Through the service the old default is cleared first, so the index never trips.
    const side = await newBranch(company.compId, 'uq-side', { brIsDefault: true });
    expect(side.brIsDefault).toBe(true);
    expect((await branches.getById(mainId)).brIsDefault).toBe(false);
    const defaults = await tx.branchMaster.count({
      where: { brCompId: company.compId, brIsDeleted: false, brIsDefault: true },
    });
    expect(defaults).toBe(1);

    // Partial: a deleted branch may keep its flag (restore, notes 72 B1) without
    // blocking the live default.
    const gone = await newBranch(company.compId, 'uq-gone');
    await attempt(() => branches.softDelete(gone.brId));
    await attempt(
      () => tx.$executeRaw`
        UPDATE public.branch_master SET br_is_default = true WHERE br_id = ${gone.brId}::uuid`,
    );
    const third = await newBranch(company.compId, 'uq-third', { brIsDefault: true });
    expect(third.brIsDefault).toBe(true);
  });

  // ── 5 — the default flag moves, it is never dropped ───────────────────────
  it('5. unticking the default is a 400; another branch taking it is the only way', async () => {
    const company = await newCompany('untick');
    const main = company.compMainBranch!;
    const mainDto = (extra: Record<string, unknown>) =>
      plainToInstance(SaveBranchMasterDto, {
        brId: main.brId,
        brCompId: company.compId,
        brName: main.brName,
        brStateCode: '33',
        ...extra,
      });
    const untick = await refusal(attempt(() => branches.save(mainDto({ brIsDefault: false }))));
    expect(untick.status).toBe(400);
    expect(untick.body).toContain('brIsDefault');
    expect(untick.body).toContain('make another branch the default instead');
    expect((await branches.getById(main.brId)).brIsDefault).toBe(true);

    // Re-ticking it, or leaving the flag out, is an ordinary update.
    expect((await attempt(() => branches.save(mainDto({ brIsDefault: true })))).brIsDefault).toBe(
      true,
    );
    const retyped = await attempt(() => branches.save(mainDto({ brType: 'STORE' })));
    expect(retyped).toMatchObject({ brIsDefault: true, brType: 'STORE' });

    // Another branch takes the flag; the former default may then be unticked (a no-op).
    const side = await newBranch(company.compId, 'untick-side');
    const sideDto = plainToInstance(SaveBranchMasterDto, {
      brId: side.brId,
      brCompId: company.compId,
      brName: side.brName,
      brStateCode: '33',
      brIsDefault: true,
    });
    expect((await attempt(() => branches.save(sideDto))).brIsDefault).toBe(true);
    expect((await branches.getById(main.brId)).brIsDefault).toBe(false);
    expect((await attempt(() => branches.save(mainDto({ brIsDefault: false })))).brIsDefault).toBe(
      false,
    );
  });

  // ── 6 — the company's last branch ─────────────────────────────────────────
  it('6. the only branch may still go once unused; the company is branchless until deleted', async () => {
    const company = await newCompany('last');
    const mainId = company.compMainBranch!.brId;
    expect(await attempt(() => branches.softDelete(mainId))).toEqual({
      brId: mainId,
      deleted: true,
    });
    expect(await liveBranches(company.compId)).toEqual([]);
    // The branch keeps its flag for restore (notes 72 B1) — the index is partial.
    const gone = await tx.branchMaster.findFirstOrThrow({ where: { brId: mainId } });
    expect(gone).toMatchObject({ brIsDeleted: true, brIsDefault: true });
    expect(await attempt(() => companies.softDelete(company.compId))).toEqual({
      compId: company.compId,
      deleted: true,
    });
  });
});
