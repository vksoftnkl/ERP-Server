import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { isPresentField } from '../utils/module-shared.utils';
import {
  PARTY_DETAIL_FIELDS,
  PARTY_REQUIRED_FIELDS,
  type PartyRole,
  roleKeyOf,
} from './party-detail.map';
import type { PartyGstType } from './party-gst-type';

type PartyClient = Prisma.TransactionClient;

/** `data.partySync` on a customer / supplier save (plan §3.5). */
export interface PartySyncResult {
  /** The other role on the same ledger, when it is live. */
  otherRole: PartyRole | null;
  /** The other role's row was written (some synced value differed). */
  otherRoleUpdated: boolean;
  /** The other role's own keys that changed, e.g. ["supAddr1", "supPhone"]. */
  fields: string[];
}

export const NO_PARTY_SYNC: PartySyncResult = Object.freeze({
  otherRole: null,
  otherRoleUpdated: false,
  fields: [],
}) as PartySyncResult;

/**
 * The party details a save carries, keyed by the LEDGER's field name (the one key the
 * three rows share). Only the keys the client sent (isPresentField) are in it.
 */
export type PartyDetails = Record<string, unknown>;

const ROLE_TABLE: Record<PartyRole, { table: string; screen: string }> = {
  CUSTOMER: { table: 'customers', screen: 'Customer Master' },
  SUPPLIER: { table: 'suppliers', screen: 'Supplier Master' },
};
const OTHER: Record<PartyRole, PartyRole> = { CUSTOMER: 'SUPPLIER', SUPPLIER: 'CUSTOMER' };
const GST_TYPE_KEY: Record<PartyRole, string> = { CUSTOMER: 'cusGstType', SUPPLIER: 'supGstType' };

/**
 * Party master rules D4 (plan §3.4–3.5) — customer ↔ supplier ↔ ledger, one party.
 *
 * Each master writes its own row and its ledger (updateLedgerWithinTx, audited there);
 * this service then writes the OTHER role's row, inside the same transaction, after the
 * ledger row was locked (PartyBalanceService.lockLedger). Only the synced columns whose
 * value actually changes are written, so an unchanged row is not dirtied for sync.
 *
 * Q8: the other role is written even when the user holds no right on its master — it is
 * one party, and the audit row names the user and the screen.
 */
@Injectable()
export class PartySyncService {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * The present synced keys of a role's payload, re-keyed by the ledger's field.
   * `overrides` (normalised name / state / GSTIN …) win over the raw payload.
   */
  detailsOf(role: PartyRole, dto: object, overrides: PartyDetails = {}): PartyDetails {
    const details: PartyDetails = {};
    const record = dto as Record<string, unknown>;
    for (const field of PARTY_DETAIL_FIELDS) {
      const key = roleKeyOf(field, role);
      if (key !== null && isPresentField(dto, key)) {
        details[field.led] = record[key];
      }
    }
    return { ...details, ...overrides };
  }

  /**
   * Write the synced details onto the other role's live row. `details` holds ledger keys
   * (detailsOf + the required trio); `gstType` the type this save stores.
   * `assertOtherNameFree` runs before the write when the save renames the other role
   * (the supplier keeps its own per-company name check, plan §3.4).
   */
  async syncOtherRole(
    tx: PartyClient,
    input: {
      role: PartyRole;
      partyId: string;
      details: PartyDetails;
      gstType: PartyGstType;
      actor: string;
      assertOtherNameFree?: (name: string, companyId: string | null) => Promise<void>;
    },
  ): Promise<PartySyncResult> {
    const otherRole = OTHER[input.role];
    const existing = await this.loadRole(tx, otherRole, input.partyId);
    if (!existing) {
      return { ...NO_PARTY_SYNC, fields: [] };
    }
    const changes: Record<string, unknown> = {};
    for (const field of [...PARTY_REQUIRED_FIELDS, ...PARTY_DETAIL_FIELDS]) {
      const key = roleKeyOf(field, otherRole);
      if (key === null || !(field.led in input.details)) {
        continue;
      }
      const value = input.details[field.led] ?? null;
      if (!sameValue(existing[key], value)) {
        changes[key] = value;
      }
    }
    const gstKey = GST_TYPE_KEY[otherRole];
    if (!sameValue(existing[gstKey], input.gstType)) {
      changes[gstKey] = input.gstType;
    }
    const fields = Object.keys(changes);
    if (fields.length === 0) {
      return { otherRole, otherRoleUpdated: false, fields: [] };
    }
    const nameKey = otherRole === 'CUSTOMER' ? 'cusName' : 'supName';
    const companyKey = otherRole === 'CUSTOMER' ? 'cusCompanyId' : 'supCompanyId';
    if (input.assertOtherNameFree && (nameKey in changes || companyKey in changes)) {
      const name = (changes[nameKey] ?? existing[nameKey]) as string | null;
      const companyId = (companyKey in changes ? changes[companyKey] : existing[companyKey]) as
        | string
        | null;
      if (name) {
        await input.assertOtherNameFree(name, companyId);
      }
    }
    const now = new Date();
    const updated =
      otherRole === 'SUPPLIER'
        ? await tx.supplier.update({
            where: { supId: input.partyId },
            data: {
              ...(changes as Prisma.SupplierUncheckedUpdateInput),
              supModifiedOn: now,
              supModifiedBy: input.actor,
            },
          })
        : await tx.customer.update({
            where: { cusId: input.partyId },
            data: {
              ...(changes as Prisma.CustomerUncheckedUpdateInput),
              cusModifiedOn: now,
              cusModifiedBy: input.actor,
            },
          });
    const after = updated as unknown as Record<string, unknown>;
    const { table, screen } = ROLE_TABLE[otherRole];
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: table,
        screenName: screen,
        screenType: 'master',
        pk: input.partyId,
        displayName: String(after[nameKey] ?? input.partyId),
        originalRecord: jsonSafe(existing),
        modifiedRecord: jsonSafe(after),
        userId: input.actor,
        notes: `Party details updated from ${ROLE_TABLE[input.role].screen}`,
      },
      tx,
    );
    return { otherRole, otherRoleUpdated: true, fields };
  }

  /** The other role's live row, or null. */
  private async loadRole(
    tx: PartyClient,
    role: PartyRole,
    partyId: string,
  ): Promise<Record<string, unknown> | null> {
    const row =
      role === 'SUPPLIER'
        ? await tx.supplier.findFirst({ where: { supId: partyId, supIsDeleted: false } })
        : await tx.customer.findFirst({ where: { cusId: partyId, cusIsDeleted: false } });
    return (row as unknown as Record<string, unknown>) ?? null;
  }
}

/** null, undefined and '' are one "blank"; anything else compares as text. */
function sameValue(a: unknown, b: unknown): boolean {
  const blank = (v: unknown) => v === null || v === undefined || v === '';
  if (blank(a) || blank(b)) {
    return blank(a) && blank(b);
  }
  return String(a) === String(b);
}

/** A Prisma row as plain JSON for the audit payload (Date → ISO, Decimal → text). */
function jsonSafe(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value instanceof Date) {
      out[key] = value.toISOString();
    } else if (value instanceof Prisma.Decimal) {
      out[key] = value.toString();
    } else {
      out[key] = value;
    }
  }
  return out;
}
