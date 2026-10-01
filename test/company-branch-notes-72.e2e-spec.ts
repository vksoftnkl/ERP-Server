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

/**
 * NOTES 72 — Company + Branch masters — against the real database, in one
 * rolled-back transaction like `item-masters-notes-70.e2e-spec.ts`: the year a
 * new company starts in, the new company fields, the GSTIN rules, the signature
 * image, and the delete / restore / move guards.
 *
 *     npm run test:e2e -- company-branch-notes-72
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

/** A 1×1 PNG. */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

describe('Company + Branch masters, notes 72 (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let companies: CompanyMasterService;
  let branches: BranchMasterService;
  let userId: string;
  let spSeq = 0;
  const stamp = Date.now().toString(36).toUpperCase();
  const name = (what: string) => `ZT72-${what}-${stamp}`;
  /** A GSTIN of state 33 whose PAN is ZT<3 letters>1234Z — unique per call. */
  let gstinSeq = 0;
  const gstin = () => {
    const letters = (gstinSeq++).toString(26).toUpperCase().padStart(3, 'A').replace(/[0-9]/g, 'Q');
    const pan = `Z${letters.slice(-3)}X1234Z`.slice(0, 10);
    return { gstin: `33${pan}1Z5`, pan };
  };

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
    // The REAL audit service (notes 71 B1's lesson).
    const audit = new AuditLogService(db, ctx);
    companies = new CompanyMasterService(db, audit, ctx);
    branches = new BranchMasterService(db, audit, ctx);
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
  const companyDto = async (body: Record<string, unknown>) => {
    const dto = plainToInstance(SaveCompanyMasterDto, body);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    return { dto, errors: errors.map((e) => e.property) };
  };
  const newCompany = (what: string, extra: Record<string, unknown> = {}) =>
    attempt(async () => {
      const { dto, errors } = await companyDto({
        compName: name(what),
        compStateCode: '33',
        ...extra,
      });
      expect(errors).toEqual([]);
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
  const years = (compId: string) => tx.fiscalYear.findMany({ where: { compId, isDeleted: false } });

  // ── A1 — a new company has its year ───────────────────────────────────────
  it('A1. a company created without dates starts in the current Indian financial year', async () => {
    const created = await newCompany('fy-default');
    const [year] = await years(created.compId);
    const today = new Date();
    const startYear =
      today.getUTCMonth() >= 3 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
    expect(year).toMatchObject({
      fyYearName: `${startYear}-${startYear + 1}`,
      fyStatus: 'OPEN',
      fyIsCurrent: true,
    });
    expect(year.fyBeginDate.toISOString().slice(0, 10)).toBe(`${startYear}-04-01`);
    expect(year.fyEndDate.toISOString().slice(0, 10)).toBe(`${startYear + 1}-03-31`);
    expect(created.compFinYearFrom?.slice(0, 10)).toBe(`${startYear}-04-01`);
  });

  it('A1. the dates sent seed the year; books begin inside it; bad years are a 400', async () => {
    const created = await newCompany('fy-dates', {
      compFinYearFrom: '2026-04-01',
      compFinYearTo: '2027-03-31',
      compBooksBeginFrom: '2026-06-15',
    });
    const [year] = await years(created.compId);
    expect(year.fyYearName).toBe('2026-2027');
    expect(year.fyBooksBeginDate?.toISOString().slice(0, 10)).toBe('2026-06-15');

    const backwards = await refusal(
      newCompany('fy-back', { compFinYearFrom: '2026-04-01', compFinYearTo: '2026-03-31' }),
    );
    expect(backwards.status).toBe(400);
    expect(backwards.body).toContain('ends on 2027-03-31');
    const tooLong = await refusal(
      newCompany('fy-long', { compFinYearFrom: '2026-04-01', compFinYearTo: '2028-03-31' }),
    );
    expect(tooLong.status).toBe(400);
    expect(tooLong.body).toContain('compFinYearTo');
    const outside = await refusal(
      newCompany('fy-books', { compFinYearFrom: '2026-04-01', compBooksBeginFrom: '2027-05-01' }),
    );
    expect(outside.status).toBe(400);
    expect(outside.body).toContain('compBooksBeginFrom');
  });

  it('A1. a year is always 1 April – 31 March: other dates are a 400, never a "2026-2026"', async () => {
    // The range the Qt form was once sent (ZT-CO-72B): an eight-day "year".
    const junk = await refusal(
      newCompany('fy-junk', {
        compFinYearFrom: '2026-03-20',
        compFinYearTo: '2026-03-28',
        compBooksBeginFrom: '2026-03-21',
      }),
    );
    expect(junk.status).toBe(400);
    expect(junk.body).toContain('begins on 1 April');
    const calendar = await refusal(newCompany('fy-cal', { compFinYearTo: '2026-12-31' }));
    expect(calendar.status).toBe(400);
    expect(calendar.body).toContain('ends on 31 March');

    // Without From / To the year is the one containing the books-begin date …
    const midYear = await newCompany('fy-books-only', { compBooksBeginFrom: '2026-02-10' });
    const [fromBooks] = await years(midYear.compId);
    expect(fromBooks.fyYearName).toBe('2025-2026');
    expect(fromBooks.fyBeginDate.toISOString().slice(0, 10)).toBe('2025-04-01');
    expect(fromBooks.fyEndDate.toISOString().slice(0, 10)).toBe('2026-03-31');
    expect(fromBooks.fyBooksBeginDate?.toISOString().slice(0, 10)).toBe('2026-02-10');
    // … and To alone names the year it ends.
    const toOnly = await newCompany('fy-to-only', { compFinYearTo: '2028-03-31' });
    expect((await years(toOnly.compId))[0].fyYearName).toBe('2027-2028');
  });

  // ── A2 / A3 / C1 / C3 — the new fields ────────────────────────────────────
  it('A2/A3/C1. AATO class, DC purposes and the TDS switch are saved and returned', async () => {
    const created = await newCompany('fields', {
      compAatoClass: 'GT_10CR',
      compDcPurposes: ['supply', 'Job_Work'],
      compTdsApplicable: true,
    });
    expect(created).toMatchObject({
      compAatoClass: 'GT_10CR',
      compDcPurposes: ['SUPPLY', 'JOB_WORK'],
      compTdsApplicable: true,
    });
    expect(await companies.getById(created.compId)).toMatchObject({
      compAatoClass: 'GT_10CR',
      compDcPurposes: ['SUPPLY', 'JOB_WORK'],
    });
    const bad = await companyDto({
      compName: 'x',
      compStateCode: '33',
      compAatoClass: null,
      compDcPurposes: ['SUPPLY', 'SMUGGLING'],
    });
    expect(bad.errors).toEqual(expect.arrayContaining(['compAatoClass', 'compDcPurposes']));
    expect(
      (await companyDto({ compName: 'x', compStateCode: '33', compDcPurposes: [] })).errors,
    ).toContain('compDcPurposes');
  });

  it('C3. GST registration type is one of four, upper-cased; the table refuses anything else', async () => {
    const ok = await companyDto({ compName: 'x', compStateCode: '33', compGstRegType: 'Regular' });
    expect(ok.errors).toEqual([]);
    expect(ok.dto.compGstRegType).toBe('REGULAR');
    const consumer = await companyDto({
      compName: 'x',
      compStateCode: '33',
      compGstRegType: 'Consumer',
    });
    expect(consumer.errors).toContain('compGstRegType');
    const created = await newCompany('regtype', { compGstRegType: 'sez' });
    expect(created.compGstRegType).toBe('SEZ');
    const db = await refusal(
      attempt(
        () => tx.$executeRaw`
          UPDATE public.companys SET comp_gst_reg_type = 'Overseas'
           WHERE comp_id = ${created.compId}::uuid`,
      ),
    );
    expect(db.body).toContain('ck_comp_gst_reg_type');
  });

  // ── C7 — GSTIN against state and PAN ─────────────────────────────────────
  it('C7. a GSTIN of another state or PAN is a 400; a blank PAN is filled from the GSTIN', async () => {
    const { gstin: good, pan } = gstin();
    const filled = await newCompany('gst-ok', { compGstinNo: good });
    expect(filled.compPanNo).toBe(pan);

    const other = gstin();
    const state = await refusal(
      newCompany('gst-state', { compGstinNo: `29${other.gstin.slice(2)}` }),
    );
    expect(state.status).toBe(400);
    expect(state.body).toContain('registered in state 29');

    const third = gstin();
    const panClash = await refusal(
      newCompany('gst-pan', { compGstinNo: third.gstin, compPanNo: 'ABCDE1234F' }),
    );
    expect(panClash.status).toBe(400);
    expect(panClash.body).toContain('compPanNo');

    // An update that omits the GSTIN is checked against the stored one.
    const moved = await refusal(
      attempt(() =>
        companies.save(
          plainToInstance(SaveCompanyMasterDto, {
            compId: filled.compId,
            compName: filled.compName,
            compStateCode: '29',
          }),
        ),
      ),
    );
    expect(moved.status).toBe(400);
    expect(moved.body).toContain('compGstinNo');

    const branchClash = await refusal(
      newBranch(filled.compId, 'br-gst', { brGstinNo: `27${third.gstin.slice(2)}` }),
    );
    expect(branchClash.status).toBe(400);
    expect(branchClash.body).toContain('brStateCode');
  });

  // ── C5 — the signature image ─────────────────────────────────────────────
  it('C5. the signature must be an image; it is stored and returned as a data URL', async () => {
    const bare = await newCompany('sig', { compAuthorizeSignature: PNG_BASE64 });
    expect(bare.compAuthorizeSignature).toBe(`data:image/png;base64,${PNG_BASE64}`);
    // The kind is read from the bytes, not from the label.
    const relabelled = await newCompany('sig2', {
      compAuthorizeSignature: `data:image/jpeg;base64,${PNG_BASE64}`,
    });
    expect(relabelled.compAuthorizeSignature).toMatch(/^data:image\/png;base64,/);
    const notImage = await refusal(
      newCompany('sig3', { compAuthorizeSignature: Buffer.from('hello').toString('base64') }),
    );
    expect(notImage.status).toBe(400);
    expect(notImage.body).toContain('PNG, JPEG, GIF or WebP');
  });

  // ── C2 — the year owns its dates ─────────────────────────────────────────
  it('C2. on update the year dates and the lock date are ignored; GET reports the current year', async () => {
    const created = await newCompany('c2', { compFinYearFrom: '2026-04-01' });
    await tx.fiscalYear.updateMany({
      where: { compId: created.compId },
      data: { fyLockDate: new Date('2026-06-30') },
    });
    const updated = await attempt(() =>
      companies.save(
        plainToInstance(SaveCompanyMasterDto, {
          compId: created.compId,
          compName: created.compName,
          compStateCode: '33',
          compFinYearFrom: '2020-01-01',
          compBooksLockDate: '2020-01-31',
        }),
      ),
    );
    expect(updated.compFinYearFrom?.slice(0, 10)).toBe('2026-04-01');
    expect(updated.compBooksLockDate?.slice(0, 10)).toBe('2026-06-30');
    const [year] = await years(created.compId);
    expect(year.fyBeginDate.toISOString().slice(0, 10)).toBe('2026-04-01');
  });

  // ── B1 / B2 — company delete and restore ─────────────────────────────────
  it('B2. the default company, or one with a live branch, is not deleted', async () => {
    const [def] = await tx.$queryRaw<Array<{ comp_id: string }>>`
      SELECT comp_id FROM public.companys WHERE comp_default AND NOT comp_is_deleted LIMIT 1`;
    if (def) {
      const isDefault = await refusal(attempt(() => companies.softDelete(def.comp_id)));
      expect(isDefault.status).toBe(409);
      expect(isDefault.body).toContain('default company');
    }
    const company = await newCompany('b2');
    await newBranch(company.compId, 'b2-branch');
    const used = await refusal(attempt(() => companies.softDelete(company.compId)));
    expect(used.status).toBe(409);
    expect(used.body).toContain('1 live branches');
  });

  it('B1. a deleted branch waits for its company; restore twice is a 409', async () => {
    const company = await newCompany('b1');
    const branch = await newBranch(company.compId, 'b1-branch');
    await attempt(() => branches.softDelete(branch.brId));
    await attempt(() => companies.softDelete(company.compId));

    const orphan = await refusal(attempt(() => branches.restore(branch.brId)));
    expect(orphan.status).toBe(409);
    expect(orphan.body).toContain('Restore the company first');

    expect(await attempt(() => companies.restore(company.compId))).toEqual({
      compId: company.compId,
      deleted: false,
    });
    const twice = await refusal(attempt(() => companies.restore(company.compId)));
    expect(twice.status).toBe(409);
    expect(await attempt(() => branches.restore(branch.brId))).toEqual({
      brId: branch.brId,
      deleted: false,
    });
    expect((await branches.getById(branch.brId)).brIsActive).toBe(true);
    const againBranch = await refusal(attempt(() => branches.restore(branch.brId)));
    expect(againBranch.status).toBe(409);
  });

  // ── B3 / B4 — branch delete and move ─────────────────────────────────────
  it('B3. the default branch with siblings, or a branch with documents, is not deleted', async () => {
    const company = await newCompany('b3');
    const main = await newBranch(company.compId, 'b3-main', { brIsDefault: true });
    const side = await newBranch(company.compId, 'b3-side');
    const isDefault = await refusal(attempt(() => branches.softDelete(main.brId)));
    expect(isDefault.status).toBe(409);
    expect(isDefault.body).toContain('default branch');
    await attempt(() => branches.softDelete(side.brId));
    // Now the company's only branch: it may go, so the company can be retired.
    await attempt(() => branches.softDelete(main.brId));

    const [busy] = await tx.$queryRaw<Array<{ br_id: string }>>`
      SELECT b.br_id FROM public.branch_master b
       WHERE NOT b.br_is_deleted AND NOT b.br_is_default
         AND EXISTS (SELECT 1 FROM sales.sale_bill s WHERE s.sb_branch_id = b.br_id)
       LIMIT 1`;
    if (busy) {
      const used = await refusal(attempt(() => branches.softDelete(busy.br_id)));
      expect(used.status).toBe(409);
      expect(used.body).toContain('sale bills');
    }
  });

  it('B4. a branch with documents, or a default branch, does not change company', async () => {
    const target = await newCompany('b4-target');
    const [busy] = await tx.$queryRaw<
      Array<{ br_id: string; br_name: string; br_state_code: string }>
    >`
      SELECT b.br_id, b.br_name, b.br_state_code FROM public.branch_master b
       WHERE NOT b.br_is_deleted AND NOT b.br_is_default
         AND EXISTS (SELECT 1 FROM sales.sale_bill s WHERE s.sb_branch_id = b.br_id)
       LIMIT 1`;
    if (busy) {
      const moved = await refusal(
        attempt(() =>
          branches.save(
            plainToInstance(SaveBranchMasterDto, {
              brId: busy.br_id,
              brCompId: target.compId,
              brName: busy.br_name,
              brStateCode: busy.br_state_code,
            }),
          ),
        ),
      );
      expect(moved.status).toBe(400);
      expect(moved.body).toContain('cannot move to another company');
    }
    const home = await newCompany('b4-home');
    const unused = await newBranch(home.compId, 'b4-unused');
    const saved = await attempt(() =>
      branches.save(
        plainToInstance(SaveBranchMasterDto, {
          brId: unused.brId,
          brCompId: target.compId,
          brName: unused.brName,
          brStateCode: '33',
        }),
      ),
    );
    expect(saved.brCompId).toBe(target.compId);
  });
});
