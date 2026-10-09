import { ConflictException, Injectable } from '@nestjs/common';
import { EmployeeMaster, Prisma } from '@prisma/client';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveAccountLedgerMasterDto } from '../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
import { LedLedgerType } from '../../accountsModule/accountLedgerMasters/types/account-ledger-master-enum';
import {
  SettingsWriteClient,
  throwSettingsBadRequest,
  throwSettingsConflict,
} from 'src/common/utils/module-service.utils';
import { EmployeeMasterErrorDetail } from './types/employee-master-api.types';

// Notes 95 §A — every employee has a staff advance ledger: what the company has paid them in
// advance, and where a till shortage decided RECOVER is debited. The employee row points at it
// (emp_loan_ledger_id); unlike a customer it does NOT share the PK, because an employee can be
// given a ledger that already exists (one imported from Tally).

/** The shared, reserved group under Current Assets every staff advance ledger lives in. */
export const STAFF_ADVANCE_GROUP_NAME = 'Loans & Advances (Asset)';
export const EMP_LEDGER_HAS_BALANCE = 'EMP_LEDGER_HAS_BALANCE';
const STAFF_ADVANCE_SUFFIX = ' - Staff Advance';
const LEDGER_NAME_MAX = 200; // acc_ledger_master.led_name varchar(200)
const GROUP_WALK_LIMIT = 24; // the depth the voucher pickers walk to as well

type EmployeeIdentity = Pick<
  EmployeeMaster,
  'empId' | 'empName' | 'empCode' | 'empCompanyId' | 'empLoanLedgerId'
>;

/**
 * The generated ledger names, preferred first: `<name> - Staff Advance`, then — when that is
 * taken in the company — `<name> - Staff Advance (<code>)`. The employee name is cut so the
 * whole fits led_name; the same cut is applied when a rename looks for the old name.
 */
export function staffAdvanceLedgerNames(empName: string, empCode: string | null): string[] {
  const fit = (tail: string) =>
    `${empName
      .trim()
      .slice(0, Math.max(0, LEDGER_NAME_MAX - tail.length))
      .trimEnd()}${tail}`;
  const code = empCode?.trim();
  return code
    ? [fit(STAFF_ADVANCE_SUFFIX), fit(`${STAFF_ADVANCE_SUFFIX} (${code})`)]
    : [fit(STAFF_ADVANCE_SUFFIX)];
}

@Injectable()
export class StaffAdvanceLedgerService {
  constructor(private readonly accountLedgerMastersService: AccountLedgerMastersService) {}

  /**
   * Decides which ledger the saved employee points at, creating or renaming it in the caller's
   * transaction, and returns the employee row with emp_loan_ledger_id set.
   *
   *   requestedId given  → it must be a live Loans & Advances ledger this company sees (§A.2).
   *   absent or null     → keep the current ledger while it is live and visible to the employee's
   *                        company; otherwise create one (§A.1). Null never unlinks: an employee
   *                        always has a staff advance ledger.
   *
   * `previous` is the row before an update (null on create); a ledger that still carries the
   * name generated from it follows a name or code edit (§A.3).
   */
  async settle(
    tx: SettingsWriteClient,
    record: EmployeeMaster,
    previous: EmployeeMaster | null,
    requestedId: string | null | undefined,
  ): Promise<EmployeeMaster> {
    let ledId: string;
    if (requestedId) {
      await this.ensurePickable(tx, requestedId, record);
      ledId = requestedId;
    } else {
      const current = record.empLoanLedgerId
        ? await tx.accLedgerMaster.findFirst({
            where: {
              ledId: record.empLoanLedgerId,
              ledIsDeleted: false,
              OR: [
                { ledCompanyId: null },
                ...(record.empCompanyId ? [{ ledCompanyId: record.empCompanyId }] : []),
              ],
            },
            select: { ledId: true },
          })
        : null;
      ledId = current?.ledId ?? (await this.provision(tx, record));
    }
    if (previous && previous.empLoanLedgerId === ledId) {
      await this.followRename(tx, ledId, previous, record);
    }
    if (record.empLoanLedgerId === ledId) {
      return record;
    }
    return tx.employeeMaster.update({
      where: { empId: record.empId },
      data: { empLoanLedgerId: ledId },
    });
  }

  /** The live ledger the employee points at, or null when there is none to retire. */
  async liveLedgerOf(
    tx: SettingsWriteClient,
    employee: EmployeeIdentity,
  ): Promise<{ ledId: string; ledName: string } | null> {
    if (!employee.empLoanLedgerId) {
      return null;
    }
    return tx.accLedgerMaster.findFirst({
      where: { ledId: employee.empLoanLedgerId, ledIsDeleted: false },
      select: { ledId: true, ledName: true },
    });
  }

  /** §A.4 — an employee whose ledger still holds money cannot be deleted. 409 EMP_LEDGER_HAS_BALANCE. */
  async ensureSettled(
    tx: SettingsWriteClient,
    employee: EmployeeIdentity,
    ledger: { ledId: string; ledName: string },
  ): Promise<void> {
    const open = await this.balances(tx, ledger.ledId);
    if (open.length === 0) {
      return;
    }
    const shown = open
      .map((row) => `${row.balance.abs().toFixed(2)} ${row.balance.isNegative() ? 'Cr' : 'Dr'}`)
      .join(', ');
    throwSettingsConflict<EmployeeMasterErrorDetail>('Staff advance ledger has a balance', [
      {
        field: 'empId',
        code: EMP_LEDGER_HAS_BALANCE,
        message: `Employee "${employee.empName}" cannot be deleted while the staff advance ledger "${ledger.ledName}" has a balance (${shown}). Settle it first.`,
      },
    ]);
  }

  /**
   * After the employee row is deleted: the ledger goes too, unless something else still owns
   * it (another employee, or a customer / supplier / sale agent sharing its id).
   */
  async retire(
    tx: SettingsWriteClient,
    ledger: { ledId: string; ledName: string },
    actor: string,
    now: Date,
  ): Promise<boolean> {
    const owners = await this.accountLedgerMastersService.findLedgerOwners(
      tx,
      ledger.ledId,
      ledger.ledName,
    );
    if (owners.length > 0) {
      return false;
    }
    const result = await tx.accLedgerMaster.updateMany({
      where: { ledId: ledger.ledId, ledIsDeleted: false },
      data: { ledIsDeleted: true, ledIsActive: false, ledModifiedOn: now, ledModifiedBy: actor },
    });
    return result.count > 0;
  }

  /**
   * Per company, the ledger's balance the way the Ledger Statement reads it — opening plus
   * POSTED and CANCELLED legs (a cancel's reversal nets it out) — over every year at once.
   * A carried-forward opening restates the year before it, so only the opening of the ledger's
   * FIRST year is counted, with every leg since. Non-zero companies only.
   */
  async balances(
    tx: SettingsWriteClient,
    ledId: string,
  ): Promise<Array<{ companyId: string; balance: Prisma.Decimal }>> {
    const rows = await tx.$queryRaw<Array<{ company_id: string; balance: Prisma.Decimal }>>`
      WITH legs AS (
        SELECT v.av_company_id AS company_id, v.av_acc_year AS acc_year,
               SUM(v.av_signed_amount) AS amount
          FROM accounts.acc_vouchers v
          JOIN accounts.acc_voucher_header h
            ON h.avh_voucher_id = v.av_voucher_id AND h.avh_acc_year = v.av_acc_year
         WHERE v.av_ledger_id = ${ledId}::uuid
           AND v.av_is_deleted = false AND h.avh_is_deleted = false
           AND h.avh_voucher_status IN ('POSTED', 'CANCELLED')
         GROUP BY 1, 2
      ), openings AS (
        SELECT o.op_company_id AS company_id, o.op_acc_year AS acc_year,
               SUM(CASE o.op_dr_cr WHEN 'D' THEN o.op_amount ELSE -o.op_amount END) AS amount
          FROM accounts.acc_opening_balance o
         WHERE o.op_ledger_id = ${ledId}::uuid AND o.op_is_deleted = false
         GROUP BY 1, 2
      ), first_year AS (
        SELECT company_id, MIN(acc_year) AS acc_year
          FROM (SELECT company_id, acc_year FROM legs
                UNION ALL
                SELECT company_id, acc_year FROM openings) y
         GROUP BY 1
      )
      SELECT f.company_id::text AS company_id,
             ROUND(COALESCE((SELECT o.amount FROM openings o
                              WHERE o.company_id = f.company_id AND o.acc_year = f.acc_year), 0)
                 + COALESCE((SELECT SUM(l.amount) FROM legs l
                              WHERE l.company_id = f.company_id), 0), 2) AS balance
        FROM first_year f`;
    return rows
      .map((row) => ({ companyId: row.company_id, balance: new Prisma.Decimal(row.balance) }))
      .filter((row) => !row.balance.isZero());
  }

  // ── §A.2: a ledger handed in ──────────────────────────────────────────────

  private async ensurePickable(
    tx: SettingsWriteClient,
    ledId: string,
    employee: EmployeeIdentity,
  ): Promise<void> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: { ledId, ledIsDeleted: false },
      select: { ledName: true, ledGroupId: true, ledCompanyId: true },
    });
    if (!ledger) {
      this.refuse(`No active ledger found with id ${ledId}`);
    }
    const groupId = await this.staffAdvanceGroupId(tx);
    if (!(await this.isWithinGroup(tx, ledger.ledGroupId, groupId))) {
      this.refuse(
        `Ledger "${ledger.ledName}" is not in ${STAFF_ADVANCE_GROUP_NAME} or a sub-group of it`,
      );
    }
    if (ledger.ledCompanyId !== null && ledger.ledCompanyId !== employee.empCompanyId) {
      this.refuse(`Ledger "${ledger.ledName}" belongs to another company`);
    }
    const other = await tx.employeeMaster.findFirst({
      where: { empLoanLedgerId: ledId, empIsDeleted: false, NOT: { empId: employee.empId } },
      select: { empName: true },
    });
    if (other) {
      throwSettingsConflict<EmployeeMasterErrorDetail>('Ledger already belongs to an employee', [
        {
          field: 'empLoanLedgerId',
          message: `Ledger "${ledger.ledName}" is already the staff advance ledger of employee "${other.empName}"`,
        },
      ]);
    }
  }

  private async isWithinGroup(
    tx: SettingsWriteClient,
    groupId: string,
    rootId: string,
  ): Promise<boolean> {
    if (groupId === rootId) {
      return true;
    }
    const [row] = await tx.$queryRaw<Array<{ found: boolean }>>`
      WITH RECURSIVE up(id, parent_id, depth) AS (
        SELECT g.acc_group_id, g.acc_group_parent_id, 0
          FROM accounts.acc_group_master g WHERE g.acc_group_id = ${groupId}::uuid
        UNION ALL
        SELECT p.acc_group_id, p.acc_group_parent_id, up.depth + 1
          FROM up JOIN accounts.acc_group_master p ON p.acc_group_id = up.parent_id
         WHERE up.depth < ${GROUP_WALK_LIMIT}
      )
      SELECT EXISTS (SELECT 1 FROM up WHERE up.id = ${rootId}::uuid) AS found`;
    return Boolean(row?.found);
  }

  // ── §A.1: the ledger created with the employee ────────────────────────────

  private async provision(tx: SettingsWriteClient, employee: EmployeeMaster): Promise<string> {
    const groupId = await this.staffAdvanceGroupId(tx);
    const name = await this.firstFreeName(tx, employee, null);
    // Company-owned, branch-less: a transfer between branches must not strand the balance.
    const ledgerDto: SaveAccountLedgerMasterDto = {
      ledGroupId: groupId,
      ledName: name,
    };
    const ledgerRecord = ledgerDto as unknown as Record<string, unknown>;
    ledgerRecord.ledCompanyId = employee.empCompanyId;
    ledgerRecord.ledBranchId = null;
    ledgerRecord.ledLedgerType = LedLedgerType.PARTY; // so Payment's payee list and Receipt offer it
    ledgerRecord.ledIsBillByBill = false; // advances and recoveries run on account
    ledgerRecord.ledCategory = 'GENERAL';
    // Contact details copied once, as the customer save copies them, cut to the ledger's widths.
    const copies: Array<[string, string | null, number]> = [
      ['ledPhone1', employee.empMobile1, 20],
      ['ledPhone2', employee.empMobile2, 20],
      ['ledEmail', employee.empEmail, 150],
      ['ledAddr1', employee.empAddr1, 200],
      ['ledAddr2', employee.empAddr2, 200],
      ['ledAddr3', employee.empAddr3, 200],
      ['ledCity', employee.empCity, 100],
      ['ledDistrict', employee.empDistrict, 100],
      ['ledStateName', employee.empState, 100],
      ['ledPin', employee.empPincode, 10],
      ['ledPanNo', employee.empPanNo, 20],
    ];
    for (const [field, value, width] of copies) {
      const trimmed = value?.trim();
      if (trimmed) {
        ledgerRecord[field] = trimmed.slice(0, width);
      }
    }
    const ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
    return ledger.ledId;
  }

  // ── §A.3: the generated name follows the employee ─────────────────────────

  private async followRename(
    tx: SettingsWriteClient,
    ledId: string,
    previous: EmployeeMaster,
    record: EmployeeMaster,
  ): Promise<void> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: { ledId, ledIsDeleted: false },
      select: { ledName: true, ledGroupId: true },
    });
    if (!ledger) {
      return;
    }
    const generated = staffAdvanceLedgerNames(previous.empName, previous.empCode).map((name) =>
      name.toLowerCase(),
    );
    if (!generated.includes(ledger.ledName.trim().toLowerCase())) {
      return; // renamed by hand, or a ledger the employee was given: not ours to rename
    }
    if (staffAdvanceLedgerNames(record.empName, record.empCode).includes(ledger.ledName)) {
      return;
    }
    const name = await this.firstFreeName(tx, record, ledId);
    if (name === ledger.ledName) {
      return;
    }
    const ledgerDto: SaveAccountLedgerMasterDto = {
      ledId,
      ledGroupId: ledger.ledGroupId,
      ledName: name,
    };
    try {
      await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
    } catch (error: unknown) {
      if (error instanceof ConflictException) {
        this.nameTaken(name);
      }
      throw error;
    }
  }

  // ── shared ────────────────────────────────────────────────────────────────

  /**
   * The first generated name no other ledger holds. "Holds" is what the ledger save refuses —
   * a live ledger of that name, any case, in the company or shared (uq_led_name_company,
   * uq_led_name_shared, tr_led_name_scope) — plus the plain (company, name) key
   * uq_led_name_per_company, which still counts deleted rows.
   */
  private async firstFreeName(
    tx: SettingsWriteClient,
    employee: Pick<EmployeeMaster, 'empName' | 'empCode' | 'empCompanyId'>,
    excludeLedId: string | null,
  ): Promise<string> {
    const companyId = employee.empCompanyId;
    const candidates = staffAdvanceLedgerNames(employee.empName, employee.empCode);
    for (const name of candidates) {
      const clash = await tx.accLedgerMaster.findFirst({
        where: {
          ...(excludeLedId ? { ledId: { not: excludeLedId } } : {}),
          OR: [
            {
              ledIsDeleted: false,
              ledName: { equals: name, mode: 'insensitive' },
              ...(companyId === null
                ? {}
                : { OR: [{ ledCompanyId: companyId }, { ledCompanyId: null }] }),
            },
            ...(companyId === null ? [] : [{ ledCompanyId: companyId, ledName: name }]),
          ],
        },
        select: { ledId: true },
      });
      if (!clash) {
        return name;
      }
    }
    this.nameTaken(candidates.at(-1)!, !employee.empCode?.trim());
  }

  private nameTaken(name: string, suggestCode = false): never {
    throwSettingsConflict<EmployeeMasterErrorDetail>('Staff advance ledger name already exists', [
      {
        field: 'empName',
        message: `Ledger "${name}" already exists. ${
          suggestCode ? 'Give the employee a code, or pick' : 'Pick'
        } an existing ledger in empLoanLedgerId.`,
      },
    ]);
  }

  private async staffAdvanceGroupId(tx: SettingsWriteClient): Promise<string> {
    const group = await tx.accGroupMaster.findFirst({
      where: {
        accGroupName: STAFF_ADVANCE_GROUP_NAME,
        accGroupCompanyId: null,
        accGroupIsDeleted: false,
      },
      select: { accGroupId: true },
    });
    if (!group) {
      this.refuse(
        `The shared account group "${STAFF_ADVANCE_GROUP_NAME}" is missing; it is seeded with the chart of accounts`,
      );
    }
    return group.accGroupId;
  }

  private refuse(message: string): never {
    throwSettingsBadRequest<EmployeeMasterErrorDetail>('Invalid staff advance ledger', [
      { field: 'empLoanLedgerId', message },
    ]);
  }
}
