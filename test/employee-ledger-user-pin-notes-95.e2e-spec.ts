import { Prisma, PrismaClient } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../src/database/prisma/prisma.service';
import { AuditLogService } from '../src/modules/audit-log/audit-log.service';
import { RequestContextService } from '../src/common/request-context/request-context.service';
import { verifySecret } from '../src/common/utils/secret-hash.utils';
import { AccountLedgerMastersService } from '../src/modules/accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { EmployeeMasterService } from '../src/modules/settings/employeeMaster/employee-master.service';
import { SaveEmployeeMasterDto } from '../src/modules/settings/employeeMaster/dto/save-employee-master.dto';
import {
  STAFF_ADVANCE_GROUP_NAME,
  StaffAdvanceLedgerService,
} from '../src/modules/settings/employeeMaster/staff-advance-ledger.service';
import { UserAdministrationService } from '../src/modules/settings/userAdministration/user-administration.service';
import { SaveUserAdministrationDto } from '../src/modules/settings/userAdministration/dto/save-user-administration.dto';

/**
 * NOTES 95 — the staff advance ledger is created with the employee (§A), and the till PIN and
 * the employee link live on the user (§B). Against the real database, in one rolled-back
 * transaction like `ledger-delete-owner-guard.e2e-spec.ts`. The payment half of acceptance 2
 * is `employee-staff-advance-http-notes-95.e2e-spec.ts`.
 *
 *     npm run test:e2e -- employee-ledger-user-pin-notes-95
 */

jest.setTimeout(120_000);

const prisma = new PrismaClient();
class Rollback extends Error {}
const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';

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

describe('Notes 95 — staff advance ledger with the employee, till PIN on the user (e2e — one rolled-back transaction)', () => {
  let tx: Prisma.TransactionClient;
  let release: () => void;
  let txDone: Promise<void>;
  let employees: EmployeeMasterService;
  let ledgers: AccountLedgerMastersService;
  let users: UserAdministrationService;
  let userId: string;
  let otherCompanyId: string;
  let advanceGroupId: string;
  let debtorsGroupId: string;
  let spSeq = 0;
  const stamp = Date.now().toString(36).toUpperCase();
  const name = (what: string) => `ZT95-${what}-${stamp}`;

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
    otherCompanyId = (
      await tx.company.findFirstOrThrow({
        where: { compIsDeleted: false, NOT: { compId: COMPANY } },
      })
    ).compId;
    advanceGroupId = (
      await tx.accGroupMaster.findFirstOrThrow({
        where: { accGroupName: STAFF_ADVANCE_GROUP_NAME, accGroupCompanyId: null },
      })
    ).accGroupId;
    debtorsGroupId = (
      await tx.accGroupMaster.findFirstOrThrow({
        where: { accGroupName: 'Sundry Debtors', accGroupCompanyId: null },
      })
    ).accGroupId;

    const ctx = {
      getUserId: () => userId,
      getCompanyId: () => null,
      getIpAddress: () => null,
    } as unknown as RequestContextService;
    const db = transactional(tx);
    const audit = new AuditLogService(db, ctx);
    ledgers = new AccountLedgerMastersService(db, audit, ctx);
    employees = new EmployeeMasterService(db, audit, ctx, new StaffAdvanceLedgerService(ledgers));
    users = new UserAdministrationService(db, audit, ctx);
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
  async function saveEmployee(body: Record<string, unknown>) {
    const { dto, errors } = await asDto(SaveEmployeeMasterDto, body);
    expect(errors).toEqual([]);
    return attempt(() => employees.save(dto));
  }
  async function saveUser(body: Record<string, unknown>) {
    const { dto, errors } = await asDto(SaveUserAdministrationDto, body);
    expect(errors).toEqual([]);
    return attempt(() => users.save(dto));
  }
  const employeeBody = (what: string, extra: Record<string, unknown> = {}) => ({
    empCompanyId: COMPANY,
    empName: name(what),
    empSalaryType: 'MONTHLY',
    ...extra,
  });
  const userBody = (what: string, extra: Record<string, unknown> = {}) => ({
    usrLoginName: name(what),
    usrPassword: 'zt-secret-95',
    usrCompanyId: COMPANY,
    ...extra,
  });
  const ledgerOf = (ledId: string) => tx.accLedgerMaster.findUniqueOrThrow({ where: { ledId } });
  /** A bare employee row with no ledger: what every employee looked like before notes 95. */
  const legacyEmployee = (what: string) =>
    tx.employeeMaster.create({
      data: { empCompanyId: COMPANY, empName: name(what), empSalaryType: 'MONTHLY' },
    });
  const makeLedger = (ledName: string, groupId: string, companyId: string | null) =>
    tx.accLedgerMaster.create({
      data: { ledName, ledGroupId: groupId, ledCompanyId: companyId },
    });
  const opening = (ledId: string, accYear: string, amount: number, drCr: 'D' | 'C') =>
    tx.accOpeningBalance.create({
      data: {
        opCompanyId: COMPANY,
        opAccYear: accYear,
        opLedgerId: ledId,
        opAmount: amount,
        opDrCr: drCr,
        opSource: 'MANUAL',
      },
    });

  // ── §A — the staff advance ledger ────────────────────────────────────────

  it('A1: a new employee with no ledger gets "<name> - Staff Advance" — PARTY, on account, company-owned, branch-less, contact copied', async () => {
    const saved = await saveEmployee(
      employeeBody('RAVI', {
        empMobile1: '9840012345',
        empEmail: 'ravi@example.test',
        empAddr1: '4 Gandhi Road',
        empCity: 'Coimbatore',
        empPanNo: 'ZTRAV1234Z',
      }),
    );
    expect(saved.empLoanLedgerId).toBeTruthy();
    const ledger = await ledgerOf(saved.empLoanLedgerId!);
    expect(ledger).toMatchObject({
      ledName: `${name('RAVI')} - Staff Advance`,
      ledGroupId: advanceGroupId,
      ledLedgerType: 'PARTY',
      ledIsBillByBill: false,
      ledCategory: 'GENERAL',
      ledCompanyId: COMPANY,
      ledBranchId: null,
      ledPhone1: '9840012345',
      ledEmail: 'ravi@example.test',
      ledAddr1: '4 Gandhi Road',
      ledCity: 'Coimbatore',
      ledPanNo: 'ZTRAV1234Z',
      ledIsDeleted: false,
    });
  });

  it('A1: a taken name falls back to "(<code>)"; taken with no code is a 409 on empName', async () => {
    await makeLedger(`${name('CLASH')} - Staff Advance`, advanceGroupId, COMPANY);
    const withCode = await saveEmployee(employeeBody('CLASH', { empCode: 'C95' }));
    expect((await ledgerOf(withCode.empLoanLedgerId!)).ledName).toBe(
      `${name('CLASH')} - Staff Advance (C95)`,
    );
    const refused = await refusal(saveEmployee(employeeBody('CLASH')));
    expect(refused.status).toBe(409);
    expect(refused.body).toContain('empName');
  });

  it('A1: an update of an employee with no ledger creates one; null on one that has a ledger keeps it', async () => {
    const legacy = await legacyEmployee('LEGACY');
    expect(legacy.empLoanLedgerId).toBeNull();
    const saved = await saveEmployee(employeeBody('LEGACY', { empId: legacy.empId }));
    expect(saved.empLoanLedgerId).toBeTruthy();
    const again = await saveEmployee(
      employeeBody('LEGACY', { empId: legacy.empId, empLoanLedgerId: null }),
    );
    expect(again.empLoanLedgerId).toBe(saved.empLoanLedgerId);
    expect(
      await tx.accLedgerMaster.count({
        where: { ledName: { startsWith: name('LEGACY') }, ledIsDeleted: false },
      }),
    ).toBe(1);
  });

  it('A2: a given ledger must be live, in Loans & Advances or below, this company’s or shared, and no other employee’s', async () => {
    const pick = (ledId: string) =>
      refusal(saveEmployee(employeeBody('PICK', { empLoanLedgerId: ledId })));

    const missing = await pick('01a00000-0000-7000-8000-000000000000');
    expect(missing.status).toBe(400);
    expect(missing.body).toContain('empLoanLedgerId');

    const deleted = await makeLedger(name('PICK-DELETED'), advanceGroupId, COMPANY);
    await tx.accLedgerMaster.update({
      where: { ledId: deleted.ledId },
      data: { ledIsDeleted: true },
    });
    expect((await pick(deleted.ledId)).status).toBe(400);

    const debtor = await makeLedger(name('PICK-DEBTOR'), debtorsGroupId, COMPANY);
    const wrongGroup = await pick(debtor.ledId);
    expect(wrongGroup.status).toBe(400);
    expect(wrongGroup.body).toContain(STAFF_ADVANCE_GROUP_NAME);

    const foreign = await makeLedger(name('PICK-FOREIGN'), advanceGroupId, otherCompanyId);
    const otherCompany = await pick(foreign.ledId);
    expect(otherCompany.status).toBe(400);
    expect(otherCompany.body).toContain('another company');

    // A shared ledger two levels down — what a Tally import of "Staff Advances" looks like.
    const subGroup = await tx.accGroupMaster.create({
      data: {
        accGroupName: name('STAFF ADVANCES'),
        accGroupParentId: advanceGroupId,
        accGroupType: 'BALANCESHEET',
        accGroupNature: 'Assets',
      },
    });
    const imported = await makeLedger(name('TALLY-ADVANCE'), subGroup.accGroupId, null);
    const picked = await saveEmployee(employeeBody('PICK', { empLoanLedgerId: imported.ledId }));
    expect(picked.empLoanLedgerId).toBe(imported.ledId);
    expect((await ledgerOf(imported.ledId)).ledName).toBe(name('TALLY-ADVANCE')); // never renamed

    const taken = await refusal(
      saveEmployee(employeeBody('PICK-2', { empLoanLedgerId: imported.ledId })),
    );
    expect(taken.status).toBe(409);
    expect(taken.body).toContain(name('PICK'));
  });

  it('A3: the generated name follows a rename; a ledger renamed by hand is left alone', async () => {
    const created = await saveEmployee(employeeBody('ZT RAVI'));
    const ledId = created.empLoanLedgerId!;
    await saveEmployee(
      employeeBody('ZT RAVI K', { empId: created.empId, empLoanLedgerId: ledId }),
    );
    expect((await ledgerOf(ledId)).ledName).toBe(`${name('ZT RAVI K')} - Staff Advance`);

    await tx.accLedgerMaster.update({ where: { ledId }, data: { ledName: name('RAVI ADV') } });
    await saveEmployee(employeeBody('ZT RAVI KUMAR', { empId: created.empId }));
    expect((await ledgerOf(ledId)).ledName).toBe(name('RAVI ADV'));
  });

  it('A4: delete is refused 409 EMP_LEDGER_HAS_BALANCE while the ledger holds money; at zero both go', async () => {
    const created = await saveEmployee(employeeBody('DELETE'));
    const ledId = created.empLoanLedgerId!;
    // A carried-forward opening restates the year before it: 300 Dr, not 600.
    const first = await opening(ledId, '2026-2027', 300, 'D');
    const carried = await opening(ledId, '2027-2028', 300, 'D');

    const refused = await refusal(attempt(() => employees.softDelete(created.empId)));
    expect(refused.status).toBe(409);
    expect(refused.body).toContain('EMP_LEDGER_HAS_BALANCE');
    expect(refused.body).toContain('300.00 Dr');

    await tx.accOpeningBalance.updateMany({
      where: { opId: { in: [first.opId, carried.opId] } },
      data: { opIsDeleted: true },
    });
    await attempt(() => employees.softDelete(created.empId));
    expect(
      await tx.employeeMaster.findUniqueOrThrow({ where: { empId: created.empId } }),
    ).toMatchObject({ empIsDeleted: true });
    expect(await ledgerOf(ledId)).toMatchObject({ ledIsDeleted: true, ledIsActive: false });
  });

  it('A5: GET answers empLoanLedgerName', async () => {
    const created = await saveEmployee(employeeBody('GET'));
    const got = await employees.getById(created.empId);
    expect(got.empLoanLedgerName).toBe(`${name('GET')} - Staff Advance`);
  });

  it('A6: the ledger delete refuses a ledger an employee points at', async () => {
    const created = await saveEmployee(employeeBody('GUARD'));
    const refused = await refusal(attempt(() => ledgers.softDelete(created.empLoanLedgerId!)));
    expect(refused.status).toBe(400);
    expect(refused.body).toContain(`This ledger belongs to employee \\"${name('GUARD')}\\"`);
  });

  it('A7: the backfill gives every live employee its ledger, and a second run walks nobody new', async () => {
    const a = await legacyEmployee('BACKFILL-A');
    const b = await legacyEmployee('BACKFILL-B');
    const first = await employees.backfillStaffAdvanceLedgers();
    const ids = first.created.map((row) => row.empId);
    expect(ids).toEqual(expect.arrayContaining([a.empId, b.empId]));
    expect(first.created.find((row) => row.empId === a.empId)?.ledName).toBe(
      `${name('BACKFILL-A')} - Staff Advance`,
    );
    const second = await employees.backfillStaffAdvanceLedgers();
    expect(second.created).toEqual([]);
    expect(second.walked).toBe(first.failed.length);
  });

  // ── §B — the till PIN and the employee link on the user ──────────────────

  it('B1/B2: usrPin is hashed like the password; GET answers usrPinSet and never the hash; "" and null clear, absent keeps', async () => {
    const created = await saveUser(userBody('PIN', { usrPin: '4321' }));
    expect(created.usrPinSet).toBe(true);
    const row = await tx.userMaster.findUniqueOrThrow({ where: { usrId: created.usrId } });
    expect(row.usrPinHash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(await verifySecret('4321', row.usrPinHash)).toBe(true);
    expect(await verifySecret('1234', row.usrPinHash)).toBe(false);

    const got = await users.getById(created.usrId);
    expect(got.usrPinSet).toBe(true);
    expect(JSON.stringify(got)).not.toContain(row.usrPinHash!);
    expect(Object.keys(got)).not.toContain('usrPinHash');

    const kept = await saveUser(userBody('PIN', { usrId: created.usrId }));
    expect(kept.usrPinSet).toBe(true);
    const cleared = await saveUser(userBody('PIN', { usrId: created.usrId, usrPin: '' }));
    expect(cleared.usrPinSet).toBe(false);
    await saveUser(userBody('PIN', { usrId: created.usrId, usrPin: '987654' }));
    const nulled = await saveUser(userBody('PIN', { usrId: created.usrId, usrPin: null }));
    expect(nulled.usrPinSet).toBe(false);
  });

  it('B1: a PIN is 4 to 6 digits', async () => {
    for (const bad of ['123', '1234567', 'abcd', '12 34']) {
      const { errors } = await asDto(SaveUserAdministrationDto, userBody('PIN-BAD', { usrPin: bad }));
      expect(errors).toContain('usrPin');
    }
    for (const good of ['1234', '123456', '']) {
      const { errors } = await asDto(SaveUserAdministrationDto, userBody('PIN-OK', { usrPin: good }));
      expect(errors).toEqual([]);
    }
  });

  it('B4/B5: the employee must be live and the company’s; one active user per employee (409); GET names it', async () => {
    const mine = await saveEmployee(employeeBody('LINK'));
    const theirs = await saveEmployee(employeeBody('LINK-OTHER', { empCompanyId: otherCompanyId }));

    const first = await saveUser(userBody('LINK-1', { usrEmployeeId: mine.empId }));
    expect((await users.getById(first.usrId)).usrEmployeeName).toBe(name('LINK'));

    const second = await refusal(saveUser(userBody('LINK-2', { usrEmployeeId: mine.empId })));
    expect(second.status).toBe(409);
    expect(second.body).toContain('usrEmployeeId');
    expect(second.body).toContain(name('LINK-1'));

    // An inactive user may hold the link; making them active again is the same 409.
    const idle = await saveUser(
      userBody('LINK-2', { usrEmployeeId: mine.empId, usrIsActive: false }),
    );
    const revived = await refusal(
      saveUser(userBody('LINK-2', { usrId: idle.usrId, usrIsActive: true })),
    );
    expect(revived.status).toBe(409);

    const foreign = await refusal(saveUser(userBody('LINK-3', { usrEmployeeId: theirs.empId })));
    expect(foreign.status).toBe(400);
    expect(foreign.body).toContain('usrEmployeeId');
    const unscoped = await saveUser(
      userBody('LINK-3', { usrCompanyId: null, usrEmployeeId: theirs.empId }),
    );
    expect(unscoped.usrEmployeeId).toBe(theirs.empId);

    const ghost = await refusal(
      saveUser(userBody('LINK-4', { usrEmployeeId: '01a00000-0000-7000-8000-000000000000' })),
    );
    expect(ghost.status).toBe(400);

    // Till plan §4: a new link needs an active employee. A standing link to one who has since
    // left is kept, so the user can still be edited and switched off, but not switched back on.
    const leaver = await saveEmployee(employeeBody('LINK-LEFT'));
    const stays = await saveUser(userBody('LINK-5', { usrEmployeeId: leaver.empId }));
    await saveEmployee(employeeBody('LINK-LEFT', { empId: leaver.empId, empIsActive: false }));
    const edited = await saveUser(
      userBody('LINK-5', { usrId: stays.usrId, usrEmployeeId: leaver.empId }),
    );
    expect(edited.usrEmployeeId).toBe(leaver.empId);
    await saveUser(userBody('LINK-5', { usrId: stays.usrId, usrIsActive: false }));
    const back = await refusal(
      saveUser(userBody('LINK-5', { usrId: stays.usrId, usrIsActive: true })),
    );
    expect(back.status).toBe(400);
    expect(back.body).toContain('is not active');
    const fresh = await refusal(saveUser(userBody('LINK-6', { usrEmployeeId: leaver.empId })));
    expect(fresh.status).toBe(400);
    expect(fresh.body).toContain('usrEmployeeId');
  });
});
