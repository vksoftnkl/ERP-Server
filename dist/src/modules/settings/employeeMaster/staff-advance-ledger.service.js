"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StaffAdvanceLedgerService = exports.EMP_LEDGER_HAS_BALANCE = exports.STAFF_ADVANCE_GROUP_NAME = void 0;
exports.staffAdvanceLedgerNames = staffAdvanceLedgerNames;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const account_ledger_masters_service_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.service");
const account_ledger_master_enum_1 = require("../../accountsModule/accountLedgerMasters/types/account-ledger-master-enum");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
exports.STAFF_ADVANCE_GROUP_NAME = 'Loans & Advances (Asset)';
exports.EMP_LEDGER_HAS_BALANCE = 'EMP_LEDGER_HAS_BALANCE';
const STAFF_ADVANCE_SUFFIX = ' - Staff Advance';
const LEDGER_NAME_MAX = 200;
const GROUP_WALK_LIMIT = 24;
function staffAdvanceLedgerNames(empName, empCode) {
    const fit = (tail) => `${empName
        .trim()
        .slice(0, Math.max(0, LEDGER_NAME_MAX - tail.length))
        .trimEnd()}${tail}`;
    const code = empCode?.trim();
    return code
        ? [fit(STAFF_ADVANCE_SUFFIX), fit(`${STAFF_ADVANCE_SUFFIX} (${code})`)]
        : [fit(STAFF_ADVANCE_SUFFIX)];
}
let StaffAdvanceLedgerService = class StaffAdvanceLedgerService {
    accountLedgerMastersService;
    constructor(accountLedgerMastersService) {
        this.accountLedgerMastersService = accountLedgerMastersService;
    }
    async settle(tx, record, previous, requestedId) {
        let ledId;
        if (requestedId) {
            await this.ensurePickable(tx, requestedId, record);
            ledId = requestedId;
        }
        else {
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
    async liveLedgerOf(tx, employee) {
        if (!employee.empLoanLedgerId) {
            return null;
        }
        return tx.accLedgerMaster.findFirst({
            where: { ledId: employee.empLoanLedgerId, ledIsDeleted: false },
            select: { ledId: true, ledName: true },
        });
    }
    async ensureSettled(tx, employee, ledger) {
        const open = await this.balances(tx, ledger.ledId);
        if (open.length === 0) {
            return;
        }
        const shown = open
            .map((row) => `${row.balance.abs().toFixed(2)} ${row.balance.isNegative() ? 'Cr' : 'Dr'}`)
            .join(', ');
        (0, module_service_utils_1.throwSettingsConflict)('Staff advance ledger has a balance', [
            {
                field: 'empId',
                code: exports.EMP_LEDGER_HAS_BALANCE,
                message: `Employee "${employee.empName}" cannot be deleted while the staff advance ledger "${ledger.ledName}" has a balance (${shown}). Settle it first.`,
            },
        ]);
    }
    async retire(tx, ledger, actor, now) {
        const owners = await this.accountLedgerMastersService.findLedgerOwners(tx, ledger.ledId, ledger.ledName);
        if (owners.length > 0) {
            return false;
        }
        const result = await tx.accLedgerMaster.updateMany({
            where: { ledId: ledger.ledId, ledIsDeleted: false },
            data: { ledIsDeleted: true, ledIsActive: false, ledModifiedOn: now, ledModifiedBy: actor },
        });
        return result.count > 0;
    }
    async balances(tx, ledId) {
        const rows = await tx.$queryRaw `
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
            .map((row) => ({ companyId: row.company_id, balance: new client_1.Prisma.Decimal(row.balance) }))
            .filter((row) => !row.balance.isZero());
    }
    async ensurePickable(tx, ledId, employee) {
        const ledger = await tx.accLedgerMaster.findFirst({
            where: { ledId, ledIsDeleted: false },
            select: { ledName: true, ledGroupId: true, ledCompanyId: true },
        });
        if (!ledger) {
            this.refuse(`No active ledger found with id ${ledId}`);
        }
        const groupId = await this.staffAdvanceGroupId(tx);
        if (!(await this.isWithinGroup(tx, ledger.ledGroupId, groupId))) {
            this.refuse(`Ledger "${ledger.ledName}" is not in ${exports.STAFF_ADVANCE_GROUP_NAME} or a sub-group of it`);
        }
        if (ledger.ledCompanyId !== null && ledger.ledCompanyId !== employee.empCompanyId) {
            this.refuse(`Ledger "${ledger.ledName}" belongs to another company`);
        }
        const other = await tx.employeeMaster.findFirst({
            where: { empLoanLedgerId: ledId, empIsDeleted: false, NOT: { empId: employee.empId } },
            select: { empName: true },
        });
        if (other) {
            (0, module_service_utils_1.throwSettingsConflict)('Ledger already belongs to an employee', [
                {
                    field: 'empLoanLedgerId',
                    message: `Ledger "${ledger.ledName}" is already the staff advance ledger of employee "${other.empName}"`,
                },
            ]);
        }
    }
    async isWithinGroup(tx, groupId, rootId) {
        if (groupId === rootId) {
            return true;
        }
        const [row] = await tx.$queryRaw `
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
    async provision(tx, employee) {
        const groupId = await this.staffAdvanceGroupId(tx);
        const name = await this.firstFreeName(tx, employee, null);
        const ledgerDto = {
            ledGroupId: groupId,
            ledName: name,
        };
        const ledgerRecord = ledgerDto;
        ledgerRecord.ledCompanyId = employee.empCompanyId;
        ledgerRecord.ledBranchId = null;
        ledgerRecord.ledLedgerType = account_ledger_master_enum_1.LedLedgerType.PARTY;
        ledgerRecord.ledIsBillByBill = false;
        ledgerRecord.ledCategory = 'GENERAL';
        const copies = [
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
    async followRename(tx, ledId, previous, record) {
        const ledger = await tx.accLedgerMaster.findFirst({
            where: { ledId, ledIsDeleted: false },
            select: { ledName: true, ledGroupId: true },
        });
        if (!ledger) {
            return;
        }
        const generated = staffAdvanceLedgerNames(previous.empName, previous.empCode).map((name) => name.toLowerCase());
        if (!generated.includes(ledger.ledName.trim().toLowerCase())) {
            return;
        }
        if (staffAdvanceLedgerNames(record.empName, record.empCode).includes(ledger.ledName)) {
            return;
        }
        const name = await this.firstFreeName(tx, record, ledId);
        if (name === ledger.ledName) {
            return;
        }
        const ledgerDto = {
            ledId,
            ledGroupId: ledger.ledGroupId,
            ledName: name,
        };
        try {
            await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
        }
        catch (error) {
            if (error instanceof common_1.ConflictException) {
                this.nameTaken(name);
            }
            throw error;
        }
    }
    async firstFreeName(tx, employee, excludeLedId) {
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
        this.nameTaken(candidates.at(-1), !employee.empCode?.trim());
    }
    nameTaken(name, suggestCode = false) {
        (0, module_service_utils_1.throwSettingsConflict)('Staff advance ledger name already exists', [
            {
                field: 'empName',
                message: `Ledger "${name}" already exists. ${suggestCode ? 'Give the employee a code, or pick' : 'Pick'} an existing ledger in empLoanLedgerId.`,
            },
        ]);
    }
    async staffAdvanceGroupId(tx) {
        const group = await tx.accGroupMaster.findFirst({
            where: {
                accGroupName: exports.STAFF_ADVANCE_GROUP_NAME,
                accGroupCompanyId: null,
                accGroupIsDeleted: false,
            },
            select: { accGroupId: true },
        });
        if (!group) {
            this.refuse(`The shared account group "${exports.STAFF_ADVANCE_GROUP_NAME}" is missing; it is seeded with the chart of accounts`);
        }
        return group.accGroupId;
    }
    refuse(message) {
        (0, module_service_utils_1.throwSettingsBadRequest)('Invalid staff advance ledger', [
            { field: 'empLoanLedgerId', message },
        ]);
    }
};
exports.StaffAdvanceLedgerService = StaffAdvanceLedgerService;
exports.StaffAdvanceLedgerService = StaffAdvanceLedgerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [account_ledger_masters_service_1.AccountLedgerMastersService])
], StaffAdvanceLedgerService);
//# sourceMappingURL=staff-advance-ledger.service.js.map