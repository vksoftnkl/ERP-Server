import { Injectable } from '@nestjs/common';
import { AccLedgerRole, Prisma } from '@prisma/client';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { AuditActionInput } from '../../audit-log/types/audit-log.types';
import { collectRoleLedgerErrors } from '../ledgerRole/ledger-role.helper';
import { SaveLedgerMapDto } from './dto/save-ledger-map.dto';
import { describeDocuments, documentsUsingRole } from './role-usage';
import type {
  LedgerMapDeletePayload,
  LedgerMapErrorDetail,
  LedgerMapRolePayload,
} from './types/ledger-map-api.types';

const LEDGER_MAP_TABLE_NAME = 'posting ledger map';
const LEDGER_MAP_AUDIT_SCREEN_NAME = 'Posting Ledger Map';
/** Names this table in the messages ledger-role.helper composes. */
const LEDGER_MAP_WHERE = 'acc_ledger_map';

/**
 * The ONE scope this module manages: the row every company and every branch
 * resolves, for both supply natures.
 *
 * `ux_alm_role` is `NULLS NOT DISTINCT`, so these three nulls are a key, not an
 * absence — exactly one live row can carry them per role. The scoped rows the
 * index also allows are deliberately out of reach here; see the README.
 */
const SHARED_SCOPE = {
  almCompanyId: null,
  almBranchId: null,
  almSupplyNature: null,
} as const;

/** The client every write here runs on — always the caller's transaction. */
type LedgerMapWriteClient = Prisma.TransactionClient;

/** The mapping half of a role payload, read with the ledger it points at. */
const MAPPING_SELECT = {
  almId: true,
  almRole: true,
  almCompanyId: true,
  almBranchId: true,
  almSupplyNature: true,
  almLedgerId: true,
  almIsActive: true,
  almRemarks: true,
  ledger: { select: { ledName: true, ledIsActive: true, ledIsDeleted: true } },
} satisfies Prisma.AccLedgerMapSelect;

type MappingRow = Prisma.AccLedgerMapGetPayload<{ select: typeof MAPPING_SELECT }>;

/**
 * Role -> ledger, the shared set.
 *
 * Every posting engine turns a ROLE into a ledger through
 * `accounts.acc_ledger_map`; until this module there was no way to see that
 * mapping, let alone change it, without SQL on the box. A wrong mapping does
 * not fail — it posts money to the wrong account and says nothing — so the
 * checks here are the point of the module, not paperwork around it.
 *
 * What a ledger must BE for a role is not restated here. It lives in
 * `accounts.acc_ledger_role` (alr_want_type / alr_want_duty / alr_want_nature)
 * and is enforced by `ledger-role.helper`, the same code the tax rate master's
 * per-rate overrides go through. Adding a role stays one INSERT into the
 * catalogue.
 */
@Injectable()
export class LedgerMapService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  /**
   * Every role the product knows, mapped or not.
   *
   * The catalogue drives the list, never `SELECT DISTINCT alm_role` — a role
   * with no row is exactly the case this screen exists to show, and it is
   * invisible to a query over the mappings. It is also why the client should
   * stop keeping its own copy of the role names: this one cannot drift from
   * what the engines ask for, because they ask the same table.
   */
  async listRoles(): Promise<LedgerMapRolePayload[]> {
    const [roles, mappings] = await Promise.all([
      this.prisma.accLedgerRole.findMany({
        orderBy: [{ alrSortOrder: 'asc' }, { alrRole: 'asc' }],
      }),
      this.prisma.accLedgerMap.findMany({
        where: { ...SHARED_SCOPE, almIsDeleted: false },
        select: MAPPING_SELECT,
      }),
    ]);
    const mappingByRole = new Map(mappings.map((mapping) => [mapping.almRole, mapping]));
    return roles.map((role) => this.toPayload(role, mappingByRole.get(role.alrRole) ?? null));
  }

  /** Create-or-update: the presence of `almId` selects. */
  async save(saveLedgerMapDto: SaveLedgerMapDto): Promise<LedgerMapRolePayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const role = await this.requireRole(tx, saveLedgerMapDto.role);
        await this.requireLedgerFitsRole(tx, role.alrRole, saveLedgerMapDto.ledgerId);
        const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;

        return saveLedgerMapDto.almId
          ? this.updateMapping(tx, saveLedgerMapDto, role, actor)
          : this.createMapping(tx, saveLedgerMapDto, role, actor);
      });
    } catch (error: unknown) {
      // ux_alm_role, if two operators map the same role at the same instant —
      // the read-then-write above cannot see the other transaction's row.
      throwOnUniqueConstraintError<LedgerMapErrorDetail>(error, 'That role is already mapped', [
        {
          field: 'role',
          message: `${saveLedgerMapDto.role} already has a ledger. Re-point that mapping instead of adding a second one.`,
        },
      ]);
      throw error;
    }
  }

  /**
   * Soft delete, and NOT an ordinary one: unmapping a role a deployed engine
   * resolves is not a blank screen, it is a posting that fails at the moment
   * money is being taken. A role nothing posts yet may be unmapped freely.
   */
  async softDelete(almId: string): Promise<LedgerMapDeletePayload> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accLedgerMap.findFirst({
        where: { almId, almIsDeleted: false },
        select: MAPPING_SELECT,
      });
      if (!existing) {
        throwAccountsNotFound<LedgerMapErrorDetail>(
          'Posting ledger mapping not found',
          'almId',
          `No active acc_ledger_map row with id ${almId}`,
        );
      }
      this.requireShared(existing);

      const documents = documentsUsingRole(existing.almRole);
      if (documents.length > 0) {
        throwAccountsConflict<LedgerMapErrorDetail>('Posting role is in use', [
          {
            field: 'almId',
            message:
              `${existing.almRole} is used by ${describeDocuments(documents)}. ` +
              'Point it at a different ledger instead of removing it.',
          },
        ]);
      }

      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const modifiedOn = new Date();
      await tx.accLedgerMap.update({
        where: { almId: existing.almId },
        data: {
          almIsDeleted: true,
          almIsActive: false,
          almModifiedOn: modifiedOn,
          almModifiedBy: actor,
        },
      });
      await this.logChange(tx, {
        action: 'cancel',
        almId: existing.almId,
        role: existing.almRole,
        originalRecord: this.toAuditRecord(existing),
        modifiedRecord: { ...this.toAuditRecord(existing), almIsActive: false, almIsDeleted: true },
        actor,
        notes: 'Posting ledger mapping removed',
      });

      return { almId: existing.almId, role: existing.almRole, deleted: true as const };
    });
  }

  // ─── Writes ────────────────────────────────────────────────────────────────

  private async createMapping(
    tx: LedgerMapWriteClient,
    saveLedgerMapDto: SaveLedgerMapDto,
    role: AccLedgerRole,
    actor: string,
  ): Promise<LedgerMapRolePayload> {
    const duplicate = await tx.accLedgerMap.findFirst({
      where: { ...SHARED_SCOPE, almRole: role.alrRole, almIsDeleted: false },
      select: { almId: true },
    });
    if (duplicate) {
      // ux_alm_role would refuse this anyway, as a 500 naming an index. Said
      // here it names the role and the row to re-point.
      throwAccountsConflict<LedgerMapErrorDetail>('That role is already mapped', [
        {
          field: 'role',
          message:
            `${role.alrRole} already has a ledger (almId ${duplicate.almId}). ` +
            'Send that almId to re-point it rather than adding a second mapping.',
        },
      ]);
    }

    const data: Prisma.AccLedgerMapUncheckedCreateInput = {
      ...SHARED_SCOPE,
      almRole: role.alrRole,
      almLedgerId: saveLedgerMapDto.ledgerId,
      almRemarks: saveLedgerMapDto.remarks ?? null,
      almCreatedOn: new Date(),
      almCreatedBy: actor,
    };
    if (hasOwnProperty(saveLedgerMapDto, 'isActive')) {
      data.almIsActive = saveLedgerMapDto.isActive;
    }
    const created = await tx.accLedgerMap.create({ data, select: MAPPING_SELECT });
    await this.logChange(tx, {
      action: 'New',
      almId: created.almId,
      role: role.alrRole,
      originalRecord: null,
      modifiedRecord: this.toAuditRecord(created),
      actor,
      notes: 'Posting ledger mapped',
    });
    return this.toPayload(role, created);
  }

  private async updateMapping(
    tx: LedgerMapWriteClient,
    saveLedgerMapDto: SaveLedgerMapDto,
    role: AccLedgerRole,
    actor: string,
  ): Promise<LedgerMapRolePayload> {
    const almId = saveLedgerMapDto.almId!;
    const existing = await tx.accLedgerMap.findFirst({
      where: { almId, almIsDeleted: false },
      select: MAPPING_SELECT,
    });
    if (!existing) {
      throwAccountsNotFound<LedgerMapErrorDetail>(
        'Posting ledger mapping not found',
        'almId',
        `No active acc_ledger_map row with id ${almId}`,
      );
    }
    this.requireShared(existing);

    // Re-pointing a row at a DIFFERENT role would unmap the old one silently,
    // sidestepping the in-use check /delete exists to make. Two operations,
    // two requests.
    if (existing.almRole !== role.alrRole) {
      throwAccountsBadRequest<LedgerMapErrorDetail>('Validation failed', [
        {
          field: 'role',
          message:
            `This mapping belongs to ${existing.almRole}, not ${role.alrRole}. ` +
            `Map ${role.alrRole} with its own request; a mapping never changes role.`,
        },
      ]);
    }

    const data: Prisma.AccLedgerMapUncheckedUpdateInput = {
      almLedgerId: saveLedgerMapDto.ledgerId,
      almRemarks: saveLedgerMapDto.remarks ?? null,
      almModifiedOn: new Date(),
      almModifiedBy: actor,
    };
    if (hasOwnProperty(saveLedgerMapDto, 'isActive')) {
      data.almIsActive = saveLedgerMapDto.isActive;
    }
    const updated = await tx.accLedgerMap.update({
      where: { almId: existing.almId },
      data,
      select: MAPPING_SELECT,
    });
    await this.logChange(tx, {
      action: 'update',
      almId: updated.almId,
      role: role.alrRole,
      originalRecord: this.toAuditRecord(existing),
      modifiedRecord: this.toAuditRecord(updated),
      actor,
      notes: 'Posting ledger mapping re-pointed',
    });
    return this.toPayload(role, updated);
  }

  // ─── Guards ────────────────────────────────────────────────────────────────

  /**
   * The role must be in the catalogue. A code that is not is a 400 listing what
   * the product does know — the operator picked from a stale list, and a bare
   * "not found" leaves them nowhere to go.
   */
  private async requireRole(tx: LedgerMapWriteClient, role: string): Promise<AccLedgerRole> {
    const found = await tx.accLedgerRole.findUnique({ where: { alrRole: role } });
    if (found) {
      return found;
    }
    const known = await tx.accLedgerRole.findMany({
      orderBy: [{ alrSortOrder: 'asc' }, { alrRole: 'asc' }],
      select: { alrRole: true },
    });
    throwAccountsBadRequest<LedgerMapErrorDetail>('Validation failed', [
      {
        field: 'role',
        message:
          `"${role}" is not a posting role. Known roles: ` +
          `${known.map((row) => row.alrRole).join(', ')}`,
      },
    ]);
  }

  /**
   * The check that is the whole reason this module is worth building.
   *
   * `DISCOUNT_ALLOWED` pointed at a bank account is accepted by the schema —
   * there is no CHECK and no trigger for it, because the rule is per-role and
   * lives in the catalogue. A mapping is set up once and lived with for years,
   * so catching it at the moment it is typed is worth far more than catching it
   * at the first posting, which is to say at the counter.
   *
   * The type / duty head / group nature rules come from ledger-role.helper; the
   * live-ledger rule is here, because a deleted ledger is still perfectly
   * shaped for its role and `fn_ledger_for` never looks at the flag.
   */
  private async requireLedgerFitsRole(
    tx: LedgerMapWriteClient,
    role: string,
    ledgerId: string,
  ): Promise<void> {
    const ledger = await tx.accLedgerMaster.findUnique({
      where: { ledId: ledgerId },
      select: { ledName: true, ledIsActive: true, ledIsDeleted: true },
    });
    const errors: LedgerMapErrorDetail[] = [];
    if (ledger?.ledIsDeleted) {
      errors.push({
        field: 'ledgerId',
        message: `"${ledger.ledName}" is deleted — a mapping must name a live ledger`,
      });
    } else if (ledger && !ledger.ledIsActive) {
      errors.push({
        field: 'ledgerId',
        message: `"${ledger.ledName}" is inactive — a mapping must name a live ledger`,
      });
    }
    // Reports a missing ledger too, so an unknown id and an unfit one read the
    // same way. companyId null demands a GLOBAL ledger: the shared mapping is
    // resolved by every company, and a company-owned ledger would make one
    // company's books absorb everyone's postings.
    errors.push(
      ...(await collectRoleLedgerErrors(tx, [{ role, ledgerId, field: 'ledgerId' }], {
        companyId: null,
        where: LEDGER_MAP_WHERE,
      })),
    );
    if (errors.length > 0) {
      throwAccountsBadRequest<LedgerMapErrorDetail>('Validation failed', errors);
    }
  }

  /**
   * A scoped row — one naming a company, a branch or a supply nature — is not
   * this API's to touch. None exists today; the columns are reserved for the
   * per-company override that is deliberately not built yet, and a half-built
   * one editing it by accident is the failure this prevents.
   */
  private requireShared(mapping: MappingRow): void {
    const scoped =
      mapping.almCompanyId !== null ||
      mapping.almBranchId !== null ||
      mapping.almSupplyNature !== null;
    if (scoped) {
      throwAccountsBadRequest<LedgerMapErrorDetail>('Validation failed', [
        {
          field: 'almId',
          message:
            'That mapping is scoped to a company, a branch or a supply nature. ' +
            '/ledger-map manages the shared mapping only.',
        },
      ]);
    }
  }

  // ─── Shapes ────────────────────────────────────────────────────────────────

  private toPayload(role: AccLedgerRole, mapping: MappingRow | null): LedgerMapRolePayload {
    return {
      role: role.alrRole,
      label: role.alrLabel,
      group: role.alrGroup,
      sortOrder: role.alrSortOrder,
      expectedLedgerType: role.alrWantType,
      expectedDutyHead: role.alrWantDuty,
      expectedGroupNature: role.alrWantNature,
      roleIsActive: role.alrIsActive,
      usedBy: [...documentsUsingRole(role.alrRole)],
      almId: mapping?.almId ?? null,
      ledgerId: mapping?.almLedgerId ?? null,
      ledgerName: mapping?.ledger?.ledName ?? null,
      ledgerIsActive: mapping?.ledger?.ledIsActive ?? null,
      ledgerIsDeleted: mapping?.ledger?.ledIsDeleted ?? null,
      isActive: mapping?.almIsActive ?? null,
      remarks: mapping?.almRemarks ?? null,
    };
  }

  private toAuditRecord(mapping: MappingRow): Record<string, unknown> {
    return {
      almId: mapping.almId,
      almRole: mapping.almRole,
      almLedgerId: mapping.almLedgerId,
      almLedgerName: mapping.ledger?.ledName ?? null,
      almIsActive: mapping.almIsActive,
      almIsDeleted: false,
      almRemarks: mapping.almRemarks,
    };
  }

  private logChange(
    tx: LedgerMapWriteClient,
    change: {
      action: AuditActionInput;
      almId: string;
      role: string;
      originalRecord: Record<string, unknown> | null;
      modifiedRecord: Record<string, unknown>;
      actor: string;
      notes: string;
    },
  ): Promise<void> {
    return this.auditLogService.logEntityChange(
      {
        action: change.action,
        tableName: LEDGER_MAP_TABLE_NAME,
        screenName: LEDGER_MAP_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: change.almId,
        displayName: change.role,
        originalRecord: change.originalRecord,
        modifiedRecord: change.modifiedRecord,
        userId: change.actor,
        notes: change.notes,
      },
      tx,
    );
  }
}
