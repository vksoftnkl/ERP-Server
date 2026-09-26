import { Injectable } from '@nestjs/common';
import { Prisma, TaxRateMaster } from '@prisma/client';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { AuditAction } from '../../audit-log/types/audit-log.types';
import {
  DEFAULT_AUDIT_ACTOR,
  InventoryWriteClient,
  ModuleErrorDetail,
  hasOwnProperty,
  normalizeNullableString,
  resolveActor,
  throwInventoryNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';
import { ListTaxRateQueryDto, ResolveTaxRateQueryDto } from './dto/tax-rate-query.dto';
import { SaveTaxRateLedgerDto } from './dto/save-tax-rate-ledger.dto';
import { SaveTaxRateDto } from './dto/save-tax-rate.dto';
import {
  TaxRateDeleteResult,
  TaxRateErrorDetail,
  TaxRateErrorResponse,
  TaxRatePayload,
  TaxRateResolution,
  TaxRateResolvedLedger,
} from './types/tax-rate-api.types';
import {
  isSupplyNature,
  resolveRoleLedgers,
  roleLedgerKey,
  SUPPLY_NATURES,
} from '../../accountsModule/ledgerRole/ledger-map.helper';
import { collectTaxRateLedgerErrors } from './utils/tax-rate-ledger.guard';
import {
  CESS_BASES,
  LEDGER_LINE_LOOKUP,
  MAX_TAX_RATE_PERC,
  TAX_RATE_LOOKUP,
  TAX_TAXABILITIES,
  TaxRateLedgerRow,
  TaxRateRow,
  ZERO_ONLY_TAXABILITIES,
  handleTaxRateWriteError,
  pushError,
  throwTaxRateBadRequest,
  throwTaxRateConflict,
  toLedgerLinePayload,
  toTaxRatePayload,
} from './utils/tax-rate.utils';

const SCREEN_NAME = 'Tax Rate Master';
const TAX_TABLE_NAME = 'tax rate master';
const LINE_TABLE_NAME = 'tax rate ledger';

/** Guards the supersession walk against a chain someone has looped. */
const MAX_SUPERSEDE_DEPTH = 50;

type WriteClient = InventoryWriteClient;

/**
 * The grid as an editor wants it: deleted lines gone, DEACTIVATED ones kept.
 *
 * A line switched off is still part of the rate's configuration and the screen
 * has to be able to switch it back on, which it cannot do if the read never
 * mentions the row.
 */
const EDITABLE_LINES_INCLUDE = {
  ledgerOverrides: {
    where: { trlIsDeleted: false },
    orderBy: [{ trlRole: 'asc' }, { trlSupplyNature: 'asc' }, { trlId: 'asc' }],
    include: LEDGER_LINE_LOOKUP,
  },
} satisfies Prisma.TaxRateMasterInclude;

/**
 * The grid as the picker wants it: live lines only, matching the promise /list
 * makes about the header — an inactive override is absent, not present and
 * flagged.
 */
const LIVE_LINES_INCLUDE = {
  ledgerOverrides: {
    where: { trlIsDeleted: false, trlIsActive: true },
    orderBy: [{ trlRole: 'asc' }, { trlSupplyNature: 'asc' }, { trlId: 'asc' }],
    include: LEDGER_LINE_LOOKUP,
  },
} satisfies Prisma.TaxRateMasterInclude;

/** The header values a constraint is checked against, stored merged with sent. */
interface EffectiveTaxRate {
  taxName: string;
  taxCode: string | null;
  taxTaxability: string;
  taxRatePerc: number;
  taxCessBasis: string;
  taxCessPerc: number;
  taxCessPerUnit: number;
  taxAcessBasis: string;
  taxAcessPerc: number;
  taxAcessPerUnit: number;
  taxSupersedesId: string | null;
}

/**
 * One GST rate, header and ledger overrides, saved and read as one thing.
 *
 * Every rule the table states as a CHECK is restated here, so a bad payload
 * comes back as a field error a form can highlight rather than a SQLSTATE the
 * ORM reports as a 500. Two rules exist ONLY here, because the database has no
 * way to state them: a role must be one the catalogue marks alr_by_rate, and
 * only a role marked alr_by_supply may narrow itself to INTRA or INTER.
 */
@Injectable()
export class TaxRateMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // ─── §1 read ────────────────────────────────────────────────────────────────

  async getById(taxId: string): Promise<TaxRatePayload> {
    const row = await this.findWithLines(this.prisma, taxId);
    if (!row) {
      this.throwNotFound('tax_id', taxId, 'Tax rate not found');
    }
    return toTaxRatePayload(row);
  }

  /**
   * Every rate the picker should offer, each one WHOLE — the same shape /get
   * answers with and /create accepts back.
   *
   * tax_is_deleted = false is not a parameter and cannot be turned off.
   * active_only defaults to true and is the one part of that a maintenance
   * screen may relax.
   */
  async list(query: ListTaxRateQueryDto): Promise<TaxRatePayload[]> {
    const activeOnly = query.active_only ?? true;
    const search = query.search?.trim();

    const rows = await this.prisma.taxRateMaster.findMany({
      where: {
        taxIsDeleted: false,
        ...(activeOnly ? { taxIsActive: true } : {}),
        ...(query.tax_taxability ? { taxTaxability: query.tax_taxability } : {}),
        ...(query.tax_rate_perc !== undefined ? { taxRatePerc: query.tax_rate_perc } : {}),
        ...(search
          ? {
              OR: [
                { taxName: { contains: search, mode: Prisma.QueryMode.insensitive } },
                { taxCode: { contains: search, mode: Prisma.QueryMode.insensitive } },
              ],
            }
          : {}),
      },
      orderBy: [{ taxSortOrder: 'asc' }, { taxName: 'asc' }, { taxId: 'asc' }],
      include: { ...TAX_RATE_LOOKUP, ...LIVE_LINES_INCLUDE },
    });

    return rows.map(toTaxRatePayload);
  }

  /**
   * Where this rate ACTUALLY posts — every role it can influence, resolved the
   * way posting will resolve it.
   *
   * /get answers with the rate's overrides, which is the handful of rows the
   * grid carries and says nothing about the rest. This answers the whole
   * question: an OVERRIDE row where the rate differs, the inherited
   * accounts.acc_ledger_map ledger where it does not, and UNMAPPED where
   * neither has anything — the one state that makes a voucher unpostable, and
   * the one a screen most needs to show.
   *
   * The roles listed are those the catalogue marks alr_by_rate: exactly the set
   * a rate is allowed to have an opinion about. Round-off, discount, write-off
   * and advances are deliberately absent — they have one answer for the whole
   * business and acc_ledger_map is their only home.
   */
  async resolveLedgers(query: ResolveTaxRateQueryDto): Promise<TaxRateResolution> {
    const rate = await this.prisma.taxRateMaster.findFirst({
      where: { taxId: query.tax_id, taxIsDeleted: false },
      select: { taxId: true, taxName: true },
    });
    if (!rate) {
      this.throwNotFound('tax_id', query.tax_id, 'Tax rate not found');
    }

    const supplyNature = query.supply_nature ?? null;
    if (supplyNature !== null && !isSupplyNature(supplyNature)) {
      throwTaxRateBadRequest('Validation failed', [
        {
          field: 'supply_nature',
          message: `supply_nature must be ${SUPPLY_NATURES.join(' or ')}, or omitted for the answer that serves both`,
        },
      ]);
    }

    const roles = await this.prisma.accLedgerRole.findMany({
      where: { alrByRate: true, alrIsActive: true },
      orderBy: [{ alrSortOrder: 'asc' }, { alrRole: 'asc' }],
      select: { alrRole: true, alrLabel: true, alrGroup: true },
    });

    const requests = roles.map((role) => ({
      role: role.alrRole,
      taxId: rate.taxId,
      supplyNature,
      field: role.alrRole,
    }));
    const resolved = await resolveRoleLedgers(this.prisma, requests, {
      companyId: query.company_id ?? null,
      branchId: query.branch_id ?? null,
      where: 'tax_rate_master',
    });

    return {
      tax_id: rate.taxId,
      tax_name: rate.taxName,
      supply_nature: supplyNature,
      roles: roles.map((role, index): TaxRateResolvedLedger => {
        const answer = resolved.get(roleLedgerKey(requests[index])) ?? null;
        return {
          role: role.alrRole,
          role_label: role.alrLabel,
          role_group: role.alrGroup,
          supply_nature: supplyNature,
          ledger_id: answer?.ledgerId ?? null,
          ledger_name: answer?.ledgerName ?? null,
          source:
            answer === null ? 'UNMAPPED' : answer.source === 'TAX_RATE' ? 'OVERRIDE' : 'DEFAULT',
          source_row_id: answer?.sourceRowId ?? null,
        };
      }),
    };
  }

  // ─── §2 write ───────────────────────────────────────────────────────────────

  async save(dto: SaveTaxRateDto): Promise<TaxRatePayload> {
    return dto.tax_id ? this.updateTaxRate(dto) : this.createTaxRate(dto);
  }

  private async createTaxRate(dto: SaveTaxRateDto): Promise<TaxRatePayload> {
    const actor = this.resolveWriteActor(dto.tax_created_by);

    return this.prisma
      .$transaction(async (tx) => {
        const data: Prisma.TaxRateMasterUncheckedCreateInput = {
          taxName: dto.tax_name,
          taxCreatedBy: actor,
        };
        this.applyHeaderFields(data, dto);

        const effective = this.effectiveTaxRate(null, dto);
        const errors = this.collectHeaderErrors(effective);
        errors.push(...(await this.collectLineErrors(tx, dto.lines ?? [])));
        if (errors.length > 0) {
          throwTaxRateBadRequest('Validation failed', errors);
        }

        await this.assertNameIsFree(tx, effective.taxName, null);
        await this.assertCodeIsFree(tx, effective.taxCode, null);
        await this.assertSupersedesExists(tx, effective.taxSupersedesId);

        const created = await tx.taxRateMaster.create({ data });
        await this.audit(
          tx,
          'insert',
          TAX_TABLE_NAME,
          created.taxId,
          created.taxName,
          null,
          toTaxRatePayload({ ...created, ledgerOverrides: [] }),
          'Tax rate created',
        );

        // The lines audit themselves as they are written, so the log reads in
        // order: the header first, then each override it carried.
        await this.syncLines(tx, created.taxId, dto);

        const after = await this.findWithLines(tx, created.taxId);
        return toTaxRatePayload(after ?? { ...created, ledgerOverrides: [] });
      })
      .catch((error: unknown) => {
        handleTaxRateWriteError(error);
        throw error;
      });
  }

  private async updateTaxRate(dto: SaveTaxRateDto): Promise<TaxRatePayload> {
    const taxId = dto.tax_id!;

    return this.prisma
      .$transaction(async (tx) => {
        const existing = await this.findWithLines(tx, taxId);
        if (!existing) {
          this.throwNotFound('tax_id', taxId, 'Tax rate not found');
        }

        const data: Prisma.TaxRateMasterUncheckedUpdateInput = {
          taxModifiedOn: new Date(),
          taxModifiedBy: this.resolveWriteActor(dto.tax_modified_by),
        };
        if (hasOwnProperty(dto, 'tax_name')) {
          data.taxName = dto.tax_name;
        }
        this.applyHeaderFields(data, dto);

        const effective = this.effectiveTaxRate(existing, dto);
        const errors = this.collectHeaderErrors(effective);
        errors.push(...(await this.collectLineErrors(tx, dto.lines ?? [])));
        if (errors.length > 0) {
          throwTaxRateBadRequest('Validation failed', errors);
        }

        await this.assertNameIsFree(tx, effective.taxName, taxId);
        await this.assertCodeIsFree(tx, effective.taxCode, taxId);
        await this.assertSupersedesExists(tx, effective.taxSupersedesId);
        await this.assertNoSupersedeCycle(tx, taxId, effective.taxSupersedesId);

        const updated = await tx.taxRateMaster.update({ where: { taxId }, data });
        await this.syncLines(tx, taxId, dto);

        const after = await this.findWithLines(tx, taxId);
        await this.audit(
          tx,
          'update',
          TAX_TABLE_NAME,
          taxId,
          updated.taxName,
          toTaxRatePayload(existing),
          after ? toTaxRatePayload(after) : null,
          'Tax rate updated',
        );

        return toTaxRatePayload(after ?? { ...updated, ledgerOverrides: [] });
      })
      .catch((error: unknown) => {
        handleTaxRateWriteError(error);
        throw error;
      });
  }

  /**
   * Soft delete only — a rate that has priced a bill can never be removed, and
   * its overrides go down with it so nothing is left pointing at a rate the
   * pickers no longer offer.
   */
  async softDelete(taxId: string, modifiedBy?: string | null): Promise<TaxRateDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findWithLines(tx, taxId);
      if (!existing || existing.taxIsDeleted) {
        this.throwNotFound('tax_id', taxId, 'Tax rate not found');
      }

      const actor = this.resolveWriteActor(modifiedBy);
      const modifiedOn = new Date();

      const liveLines = (existing.ledgerOverrides ?? []).filter((line) => !line.trlIsDeleted);
      for (const line of liveLines) {
        await this.softDeleteLineRow(tx, line, actor, modifiedOn);
      }

      const updated = await tx.taxRateMaster.update({
        where: { taxId },
        data: {
          taxIsDeleted: true,
          taxIsActive: false,
          taxModifiedOn: modifiedOn,
          taxModifiedBy: actor,
        },
      });

      await this.audit(
        tx,
        'cancel',
        TAX_TABLE_NAME,
        taxId,
        updated.taxName,
        toTaxRatePayload(existing),
        toTaxRatePayload({ ...updated, ledgerOverrides: [] }),
        'Tax rate soft deleted',
      );

      return { tax_id: taxId, deleted: true, lines_deleted: liveLines.length };
    });
  }

  // ─── §3 the header ──────────────────────────────────────────────────────────

  /**
   * Only the keys actually present in the body are written, so omitting a field
   * leaves the stored value alone.
   *
   * A NOT NULL column with a database default additionally ignores an explicit
   * null — the default (on create) or the stored value (on update) survives,
   * rather than the write failing on a constraint the caller never meant to
   * touch. The two genuinely nullable columns take a null and clear.
   */
  private applyHeaderFields(
    data: Prisma.TaxRateMasterUncheckedCreateInput | Prisma.TaxRateMasterUncheckedUpdateInput,
    dto: SaveTaxRateDto,
  ): void {
    // Nullable: an explicit null clears the column.
    if (hasOwnProperty(dto, 'tax_code')) data.taxCode = normalizeNullableString(dto.tax_code);
    if (hasOwnProperty(dto, 'tax_supersedes_id'))
      data.taxSupersedesId = dto.tax_supersedes_id ?? null;

    // NOT NULL with a default: a null is ignored, not written.
    if (isPresent(dto.tax_sort_order)) data.taxSortOrder = dto.tax_sort_order;
    if (isPresent(dto.tax_taxability)) data.taxTaxability = dto.tax_taxability;
    if (isPresent(dto.tax_is_reverse_charge)) data.taxIsReverseCharge = dto.tax_is_reverse_charge;
    if (isPresent(dto.tax_rate_perc)) data.taxRatePerc = dto.tax_rate_perc;
    if (isPresent(dto.tax_cess_basis)) data.taxCessBasis = dto.tax_cess_basis;
    if (isPresent(dto.tax_cess_perc)) data.taxCessPerc = dto.tax_cess_perc;
    if (isPresent(dto.tax_cess_per_unit)) data.taxCessPerUnit = dto.tax_cess_per_unit;
    if (isPresent(dto.tax_acess_basis)) data.taxAcessBasis = dto.tax_acess_basis;
    if (isPresent(dto.tax_acess_perc)) data.taxAcessPerc = dto.tax_acess_perc;
    if (isPresent(dto.tax_acess_per_unit)) data.taxAcessPerUnit = dto.tax_acess_per_unit;
    if (isPresent(dto.tax_is_active)) data.taxIsActive = dto.tax_is_active;
  }

  /**
   * What the row will actually look like once this request lands — sent values
   * where the body carries them, stored values everywhere else.
   *
   * Checking the merged record rather than the payload is what lets a caller
   * move one end of a paired rule (a cess basis without its figure, say) and
   * still be validated against the other end as it stands.
   */
  private effectiveTaxRate(existing: TaxRateMaster | null, dto: SaveTaxRateDto): EffectiveTaxRate {
    const num = (sent: number | undefined, stored: Prisma.Decimal | undefined): number =>
      isPresent(sent) ? sent : stored !== undefined ? toNumber(stored) : 0;

    return {
      taxName: hasOwnProperty(dto, 'tax_name')
        ? (dto.tax_name ?? '').trim()
        : (existing?.taxName ?? ''),
      taxCode: hasOwnProperty(dto, 'tax_code')
        ? (normalizeNullableString(dto.tax_code) ?? null)
        : (existing?.taxCode ?? null),
      taxTaxability: isPresent(dto.tax_taxability)
        ? dto.tax_taxability
        : (existing?.taxTaxability ?? 'TAXABLE'),
      taxRatePerc: num(dto.tax_rate_perc, existing?.taxRatePerc),
      taxCessBasis: isPresent(dto.tax_cess_basis)
        ? dto.tax_cess_basis
        : (existing?.taxCessBasis ?? 'NONE'),
      taxCessPerc: num(dto.tax_cess_perc, existing?.taxCessPerc),
      taxCessPerUnit: num(dto.tax_cess_per_unit, existing?.taxCessPerUnit),
      taxAcessBasis: isPresent(dto.tax_acess_basis)
        ? dto.tax_acess_basis
        : (existing?.taxAcessBasis ?? 'NONE'),
      taxAcessPerc: num(dto.tax_acess_perc, existing?.taxAcessPerc),
      taxAcessPerUnit: num(dto.tax_acess_per_unit, existing?.taxAcessPerUnit),
      taxSupersedesId: hasOwnProperty(dto, 'tax_supersedes_id')
        ? (dto.tax_supersedes_id ?? null)
        : (existing?.taxSupersedesId ?? null),
    };
  }

  /** Every CHECK the table states, restated as field errors, collected in one pass. */
  private collectHeaderErrors(rate: EffectiveTaxRate): ModuleErrorDetail[] {
    const errors: ModuleErrorDetail[] = [];

    if (!rate.taxName) {
      pushError(errors, 'tax_name', 'tax_name is required');
    }
    if (!TAX_TAXABILITIES.includes(rate.taxTaxability as (typeof TAX_TAXABILITIES)[number])) {
      pushError(
        errors,
        'tax_taxability',
        `tax_taxability must be one of ${TAX_TAXABILITIES.join(', ')}`,
      );
    }
    if (rate.taxRatePerc < 0 || rate.taxRatePerc > MAX_TAX_RATE_PERC) {
      pushError(
        errors,
        'tax_rate_perc',
        `tax_rate_perc must be between 0 and ${MAX_TAX_RATE_PERC}`,
      );
    }

    this.collectCessErrors(
      errors,
      'tax_cess',
      rate.taxCessBasis,
      rate.taxCessPerc,
      rate.taxCessPerUnit,
    );
    this.collectCessErrors(
      errors,
      'tax_acess',
      rate.taxAcessBasis,
      rate.taxAcessPerc,
      rate.taxAcessPerUnit,
    );

    // ck_tax_exempt_zero. ZERO_RATED is deliberately not covered: an export is
    // taxable at 0% and must stay distinguishable from an exempt supply.
    if (
      ZERO_ONLY_TAXABILITIES.includes(rate.taxTaxability as (typeof ZERO_ONLY_TAXABILITIES)[number])
    ) {
      const charged =
        rate.taxRatePerc !== 0 ||
        rate.taxCessPerc !== 0 ||
        rate.taxCessPerUnit !== 0 ||
        rate.taxAcessPerc !== 0 ||
        rate.taxAcessPerUnit !== 0;
      if (charged) {
        pushError(
          errors,
          'tax_taxability',
          `A ${rate.taxTaxability} rate charges nothing by definition — the rate and both cess ` +
            'figures must all be 0. Use ZERO_RATED for an export, which is taxable at 0%.',
        );
      }
    }

    return errors;
  }

  /** ck_tax_cess_agrees / ck_tax_acess_agrees: the basis and the figures must match. */
  private collectCessErrors(
    errors: ModuleErrorDetail[],
    prefix: string,
    basis: string,
    perc: number,
    perUnit: number,
  ): void {
    if (!CESS_BASES.includes(basis as (typeof CESS_BASES)[number])) {
      pushError(
        errors,
        `${prefix}_basis`,
        `${prefix}_basis must be one of ${CESS_BASES.join(', ')}`,
      );
      return;
    }
    if (perc < 0) pushError(errors, `${prefix}_perc`, `${prefix}_perc must not be negative`);
    if (perUnit < 0) {
      pushError(errors, `${prefix}_per_unit`, `${prefix}_per_unit must not be negative`);
    }

    const wantsPerc = basis === 'PERCENT' || basis === 'BOTH';
    const wantsPerUnit = basis === 'PER_UNIT' || basis === 'BOTH';

    if (wantsPerc && perc <= 0) {
      pushError(
        errors,
        `${prefix}_perc`,
        `${prefix}_basis is ${basis}, so ${prefix}_perc must be > 0`,
      );
    }
    if (!wantsPerc && perc !== 0) {
      pushError(
        errors,
        `${prefix}_perc`,
        `${prefix}_basis is ${basis}, so ${prefix}_perc must be 0`,
      );
    }
    if (wantsPerUnit && perUnit <= 0) {
      pushError(
        errors,
        `${prefix}_per_unit`,
        `${prefix}_basis is ${basis}, so ${prefix}_per_unit must be > 0`,
      );
    }
    if (!wantsPerUnit && perUnit !== 0) {
      pushError(
        errors,
        `${prefix}_per_unit`,
        `${prefix}_basis is ${basis}, so ${prefix}_per_unit must be 0`,
      );
    }
  }

  /**
   * ux_tax_name is a PARTIAL unique index (live rows only), which Prisma cannot
   * express, so the check has to live here. Deleting a rate frees its name —
   * that is the point of the partial index, and how 'GST @ 18%' stops piling up
   * beside 'GST 18%'.
   */
  private async assertNameIsFree(
    client: WriteClient,
    taxName: string,
    excludeTaxId: string | null,
  ): Promise<void> {
    if (!taxName) return;
    const clash = await client.taxRateMaster.findFirst({
      where: {
        taxIsDeleted: false,
        taxName: { equals: taxName, mode: Prisma.QueryMode.insensitive },
        ...(excludeTaxId ? { taxId: { not: excludeTaxId } } : {}),
      },
      select: { taxId: true, taxName: true },
    });
    if (clash) {
      throwTaxRateConflict('Tax rate name already exists', [
        {
          field: 'tax_name',
          message: `"${clash.taxName}" is already in use by rate ${clash.taxId}`,
        },
      ]);
    }
  }

  /** ux_tax_code — same partial-index story as the name. */
  private async assertCodeIsFree(
    client: WriteClient,
    taxCode: string | null,
    excludeTaxId: string | null,
  ): Promise<void> {
    if (!taxCode) return;
    const clash = await client.taxRateMaster.findFirst({
      where: {
        taxIsDeleted: false,
        taxCode: { equals: taxCode, mode: Prisma.QueryMode.insensitive },
        ...(excludeTaxId ? { taxId: { not: excludeTaxId } } : {}),
      },
      select: { taxId: true, taxCode: true },
    });
    if (clash) {
      throwTaxRateConflict('Tax rate code already exists', [
        {
          field: 'tax_code',
          message: `"${clash.taxCode}" is already in use by rate ${clash.taxId}`,
        },
      ]);
    }
  }

  private async assertSupersedesExists(
    client: WriteClient,
    supersedesId: string | null,
  ): Promise<void> {
    if (!supersedesId) return;
    const target = await client.taxRateMaster.findFirst({
      where: { taxId: supersedesId },
      select: { taxId: true },
    });
    if (!target) {
      this.throwNotFound('tax_supersedes_id', supersedesId, 'Superseded tax rate not found');
    }
  }

  /**
   * ck_tax_no_self_supersede blocks a rate pointing at itself; nothing in the
   * database blocks A → B → A. A loop makes "what was this rate before?"
   * unanswerable — the walk never terminates — so it is refused here.
   */
  private async assertNoSupersedeCycle(
    client: WriteClient,
    taxId: string,
    supersedesId: string | null,
  ): Promise<void> {
    if (!supersedesId) return;
    if (supersedesId === taxId) {
      throwTaxRateBadRequest('Validation failed', [
        { field: 'tax_supersedes_id', message: 'A tax rate cannot supersede itself' },
      ]);
    }

    let cursor: string | null = supersedesId;
    for (let depth = 0; cursor && depth < MAX_SUPERSEDE_DEPTH; depth += 1) {
      const node: { taxSupersedesId: string | null } | null = await client.taxRateMaster.findFirst({
        where: { taxId: cursor },
        select: { taxSupersedesId: true },
      });
      cursor = node?.taxSupersedesId ?? null;
      if (cursor === taxId) {
        throwTaxRateBadRequest('Validation failed', [
          {
            field: 'tax_supersedes_id',
            message: 'That rate already supersedes this one — the chain would loop',
          },
        ]);
      }
    }
  }

  // ─── §4 the lines ───────────────────────────────────────────────────────────

  /**
   * Sending `lines` REPLACES the grid; omitting the key leaves it untouched.
   * `"lines": []` therefore means "remove every override", which is a different
   * request from not mentioning them.
   */
  private async syncLines(
    tx: Prisma.TransactionClient,
    taxId: string,
    dto: SaveTaxRateDto,
  ): Promise<void> {
    if (dto.lines === undefined) return;

    const actor = this.resolveWriteActor(dto.tax_modified_by ?? dto.tax_created_by);
    const kept: string[] = [];
    for (let index = 0; index < dto.lines.length; index += 1) {
      const saved = await this.saveLineRow(tx, taxId, dto.lines[index]);
      kept.push(saved.trlId);
    }

    const stale = await tx.taxRateLedger.findMany({
      where: { trlTaxId: taxId, trlIsDeleted: false, trlId: { notIn: kept } },
    });
    const now = new Date();
    for (const row of stale) {
      await this.softDeleteLineRow(tx, row, actor, now);
    }
  }

  /**
   * The grid's rules, delegated to the guard that owns them — the TypeScript
   * form of what a BEFORE INSERT/UPDATE trigger would otherwise enforce one
   * opaque failure at a time.
   */
  private collectLineErrors(
    tx: Prisma.TransactionClient,
    lines: readonly SaveTaxRateLedgerDto[],
  ): Promise<ModuleErrorDetail[]> {
    return collectTaxRateLedgerErrors(tx, lines, { companyId: null });
  }

  private async saveLineRow(
    tx: Prisma.TransactionClient,
    taxId: string,
    line: SaveTaxRateLedgerDto,
  ): Promise<TaxRateLedgerRow> {
    if (line.trl_id) {
      const existing = await tx.taxRateLedger.findFirst({
        where: { trlId: line.trl_id, trlTaxId: taxId, trlIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound('trl_id', line.trl_id, 'Tax rate ledger line not found on this rate');
      }

      const data: Prisma.TaxRateLedgerUncheckedUpdateInput = {
        trlModifiedOn: new Date(),
        trlModifiedBy: this.resolveWriteActor(line.trl_modified_by),
      };
      if (hasOwnProperty(line, 'trl_role')) data.trlRole = line.trl_role;
      if (hasOwnProperty(line, 'trl_supply_nature')) {
        data.trlSupplyNature = line.trl_supply_nature ?? null;
      }
      if (hasOwnProperty(line, 'trl_ledger_id')) data.trlLedgerId = line.trl_ledger_id;
      if (hasOwnProperty(line, 'trl_remarks')) {
        data.trlRemarks = normalizeNullableString(line.trl_remarks);
      }
      if (isPresent(line.trl_is_active)) data.trlIsActive = line.trl_is_active;

      const updated = await tx.taxRateLedger.update({
        where: { trlId: line.trl_id },
        data,
        include: LEDGER_LINE_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        LINE_TABLE_NAME,
        updated.trlId,
        this.describeLine(updated),
        toLedgerLinePayload(existing),
        toLedgerLinePayload(updated),
        'Tax rate ledger line updated',
      );
      return updated;
    }

    const created = await tx.taxRateLedger.create({
      data: {
        trlTaxId: taxId,
        trlRole: line.trl_role,
        trlSupplyNature: line.trl_supply_nature ?? null,
        trlLedgerId: line.trl_ledger_id,
        trlRemarks: normalizeNullableString(line.trl_remarks) ?? null,
        ...(isPresent(line.trl_is_active) ? { trlIsActive: line.trl_is_active } : {}),
        trlCreatedBy: this.resolveWriteActor(line.trl_created_by),
      },
      include: LEDGER_LINE_LOOKUP,
    });
    await this.audit(
      tx,
      'insert',
      LINE_TABLE_NAME,
      created.trlId,
      this.describeLine(created),
      null,
      toLedgerLinePayload(created),
      'Tax rate ledger line created',
    );
    return created;
  }

  private async softDeleteLineRow(
    tx: Prisma.TransactionClient,
    existing: TaxRateLedgerRow,
    actor: string,
    modifiedOn: Date,
  ): Promise<void> {
    const updated = await tx.taxRateLedger.update({
      where: { trlId: existing.trlId },
      data: {
        trlIsDeleted: true,
        trlIsActive: false,
        trlModifiedOn: modifiedOn,
        trlModifiedBy: actor,
      },
      include: LEDGER_LINE_LOOKUP,
    });
    await this.audit(
      tx,
      'cancel',
      LINE_TABLE_NAME,
      updated.trlId,
      this.describeLine(updated),
      toLedgerLinePayload(existing),
      toLedgerLinePayload(updated),
      'Tax rate ledger line soft deleted',
    );
  }

  private describeLine(row: TaxRateLedgerRow): string {
    return `${row.trlRole}${row.trlSupplyNature ? ` / ${row.trlSupplyNature}` : ''}`;
  }

  // ─── §5 plumbing ────────────────────────────────────────────────────────────

  private async findWithLines(client: WriteClient, taxId: string): Promise<TaxRateRow | null> {
    return client.taxRateMaster.findFirst({
      where: { taxId, taxIsDeleted: false },
      include: { ...TAX_RATE_LOOKUP, ...EDITABLE_LINES_INCLUDE },
    });
  }

  private resolveWriteActor(explicit?: string | null): string {
    return resolveActor(explicit, this.requestContextService.getUserId());
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: Extract<AuditAction, 'insert' | 'update' | 'cancel'>,
    tableName: string,
    pk: string,
    displayName: string,
    originalRecord: unknown,
    modifiedRecord: unknown,
    notes: string,
  ): Promise<void> {
    await this.auditLogService.logEntityChange(
      {
        action,
        tableName,
        screenName: SCREEN_NAME,
        screenType: 'master',
        pk,
        displayName,
        originalRecord,
        modifiedRecord,
        userId: this.requestContextService.getUserId() ?? DEFAULT_AUDIT_ACTOR,
        notes,
      },
      tx,
    );
  }

  private throwNotFound(field: string, value: string, message: string): never {
    throwInventoryNotFound<TaxRateErrorDetail, TaxRateErrorResponse>(
      message,
      field,
      `${field} ${value} was not found`,
    );
  }
}

/**
 * Present AND meaningful.
 *
 * class-transformer leaves the key on the object even when its transform maps
 * the value to undefined, so hasOwnProperty alone would write an undefined into
 * a NOT NULL column. This is the guard for those columns; the two nullable ones
 * use hasOwnProperty, because for them a null is an instruction.
 */
function isPresent<T>(value: T | null | undefined): value is T {
  return value !== null && value !== undefined;
}
