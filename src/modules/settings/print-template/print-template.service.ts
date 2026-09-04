import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { AuditAction } from '../../audit-log/types/audit-log.types';
import { ListPrintTemplateQueryDto } from './dto/list-print-template-query.dto';
import { SavePrintTemplateDatasetDto } from './dto/save-print-template-dataset.dto';
import { SavePrintTemplateDto } from './dto/save-print-template.dto';
import { SavePrintTemplateVersionDto } from './dto/save-print-template-version.dto';
import {
  PRINT_TEMPLATE_SCREEN_NAME,
  PTD_DEFAULT_ROW_LIMIT,
  PTD_DEFAULT_SOURCE_KIND,
  PTD_DEFAULT_TIMEOUT_MS,
  PTD_DEFAULT_ROLE,
  PTV_DEFAULT_ENGINE,
  PTV_DEFAULT_LANG,
  PTV_DEFAULT_ORIENTATION,
  PTV_DEFAULT_STATUS,
} from './print-template.constants';
import {
  PrintTemplateDeleteResult,
  PrintTemplateErrorDetail,
  PrintTemplateErrorResponse,
  PrintTemplateListResult,
  PrintTemplatePayload,
} from './types/print-template-api.types';
import {
  EffectiveDataset,
  EffectiveTemplate,
  EffectiveVersion,
  collectDatasetInvariantErrors,
  collectDatasetSetInvariantErrors,
  collectTemplateInvariantErrors,
  collectVersionInvariantErrors,
} from './utils/print-template-invariants';
import {
  DATASET_ORDER_BY,
  DatasetRow,
  TEMPLATE_INCLUDE,
  TemplateWithChildren,
  TemplateRow,
  VersionRow,
  handlePrintTemplateWriteError,
  toDatasetPayload,
  toTemplatePayload,
  toVersionPayload,
} from './utils/print-template.utils';
import {
  DEFAULT_AUDIT_ACTOR,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  SettingsWriteClient,
  hasOwnProperty,
  normalizeNullableString,
  throwSettingsBadRequest,
  throwSettingsConflict,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';

const TEMPLATE_TABLE_NAME = 'print template';
const VERSION_TABLE_NAME = 'print template version';
const DATASET_TABLE_NAME = 'print template dataset';

type WriteClient = SettingsWriteClient;

/** What one row of `datasets` will become once the request is applied. */
interface DatasetPlan {
  path: string;
  existing: DatasetRow | null;
  effective: EffectiveDataset;
  row: SavePrintTemplateDatasetDto;
}

/** The whole `datasets` key: a set that REPLACES what the version holds. */
interface DatasetSetPlan {
  plans: DatasetPlan[];
}

interface VersionPlan {
  path: string;
  row: SavePrintTemplateVersionDto;
  /// null for a revision being appended.
  existing: VersionRow | null;
  effective: EffectiveVersion;
  /// null when the `datasets` key was omitted — "leave them alone", which is
  /// not the same as an empty array.
  datasets: DatasetSetPlan | null;
  /// This request moves the template's published pointer to this revision.
  publishes: boolean;
  /// This request retires the revision the pointer currently names, so the
  /// pointer has to be let go of.
  releasesPointer: boolean;
  /// Explicit ptvIsDeleted: true. Omitting a version does NOT do this.
  deletes: boolean;
}

/**
 * The whole design behind ONE URL: the template, its revisions, and each
 * revision's datasets, saved together in one transaction.
 *
 * Three rules from the schema shape everything below, and none of them are
 * negotiable by a payload:
 *
 *  1. A PUBLISHED VERSION IS NEVER UPDATEd. print_log.plg_version_id is a real
 *     reference to the exact bytes that were rendered, so "what did this bill
 *     look like" is enforced rather than hoped for. Editing a live revision
 *     would make every past log entry a lie. Send a row with no ptvId instead;
 *     it becomes the next revision, and publishing it is a pointer move.
 *
 *  2. THE HISTORY IS APPEND-ONLY. ux_ptv_template_rev is not partial on
 *     is_deleted, unlike every other unique index in the module. So a version
 *     missing from the `versions` array is LEFT ALONE — deleting one is an
 *     explicit ptvIsDeleted: true. The `datasets` arrays behave the other way
 *     round, replacing the set, because their indexes ARE partial and a
 *     designer grid is exactly the case replacement is for.
 *
 *  3. A DATASET HANGS OFF THE VERSION. That is why the payload nests them there
 *     rather than beside the versions: if they hung off the template, editing a
 *     query would silently change what every past version rendered.
 */
@Injectable()
export class PrintTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // ═══ Reads ═══════════════════════════════════════════════════════════════

  async getTemplateById(
    ptlId: string,
    includeDeletedVersions = false,
  ): Promise<PrintTemplatePayload> {
    const template = await this.findTemplate(this.prisma, ptlId, includeDeletedVersions);
    if (!template) {
      this.throwNotFound('ptlId', ptlId, 'Print template not found');
    }
    return toTemplatePayload(template);
  }

  /**
   * The "print in format" list. Every filter is an optional narrowing; a bare
   * /list is every live template there is.
   *
   * The company filter is deliberately NOT a plain column match. A shipped
   * design (ptl_company_id NULL) is visible to every company, so narrowing to a
   * company returns its own templates AND the shipped ones it can use — which
   * is the list the screen actually needs. `onlyOwned` is there for the
   * administration screen that wants the other reading.
   */
  async listTemplates(query: ListPrintTemplateQueryDto): Promise<PrintTemplateListResult> {
    const page = query.page ?? DEFAULT_PAGE;
    const limit = query.limit ?? DEFAULT_LIMIT;
    const includeVersions = query.includeVersions ?? true;

    const where: Prisma.PrintTemplateWhereInput = { ptlIsDeleted: false };

    if (query.ptlCompanyId) {
      if (query.onlyOwned) {
        where.ptlCompanyId = query.ptlCompanyId;
      } else {
        where.OR = [{ ptlCompanyId: query.ptlCompanyId }, { ptlCompanyId: null }];
      }
    }
    if (query.ptlPurposeId) {
      where.ptlPurposeId = query.ptlPurposeId;
    }
    if (query.ptlIsActive !== undefined) {
      where.ptlIsActive = query.ptlIsActive;
    }
    if (query.isPublished !== undefined) {
      where.ptlPublishedRevId = query.isPublished ? { not: null } : null;
    }
    if (query.engine) {
      // A relation filter, not a column: the engine is a property of the
      // revision that is live, and a template with only a draft has none.
      where.publishedRev = { ptvEngine: query.engine };
    }
    if (query.search) {
      const search = query.search.trim();
      where.AND = [
        {
          OR: [
            { ptlCode: { contains: search, mode: 'insensitive' } },
            { ptlName: { contains: search, mode: 'insensitive' } },
          ],
        },
      ];
    }

    const [rows, total] = await Promise.all([
      this.prisma.printTemplate.findMany({
        where,
        orderBy: [{ ptlSortOrder: 'asc' }, { ptlCode: 'asc' }, { ptlId: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        include: includeVersions
          ? TEMPLATE_INCLUDE
          : {
              company: TEMPLATE_INCLUDE.company,
              purpose: TEMPLATE_INCLUDE.purpose,
              forkedFrom: TEMPLATE_INCLUDE.forkedFrom,
              publishedRev: TEMPLATE_INCLUDE.publishedRev,
            },
      }),
      this.prisma.printTemplate.count({ where }),
    ]);

    return {
      items: rows.map((row) => toTemplatePayload(row)),
      page,
      limit,
      total,
      total_pages: total === 0 ? 0 : Math.ceil(total / limit),
    };
  }

  // ═══ Writes ══════════════════════════════════════════════════════════════

  async saveTemplate(dto: SavePrintTemplateDto): Promise<PrintTemplatePayload> {
    return this.prisma
      .$transaction(async (tx) => {
        const existing = dto.ptlId ? await this.findTemplate(tx, dto.ptlId, true) : null;
        if (dto.ptlId && !existing) {
          this.throwNotFound('ptlId', dto.ptlId, 'Print template not found');
        }

        // ── Phase A: resolve and validate the WHOLE payload, reading only ──
        // Nothing is written until every complaint has been collected, so a bad
        // request is answered with all of its problems rather than the first.
        const errors: PrintTemplateErrorDetail[] = [];
        const header = this.planHeader(existing, dto, errors);
        const versionPlans = this.planVersions(existing, dto.versions, errors);
        const pointer = this.planPointer(existing, dto, versionPlans, errors);
        if (errors.length > 0) {
          this.throwBadRequest('Validation failed', errors);
        }
        await this.assertCodeIsFree(
          tx,
          header.effective.companyId,
          header.effective.ptlCode,
          existing?.ptlId ?? null,
        );

        // ── Phase B: write ────────────────────────────────────────────────
        const template = existing
          ? await tx.printTemplate.update({
              where: { ptlId: existing.ptlId },
              data: header.update,
            })
          : await tx.printTemplate.create({ data: header.create });

        if (!existing) {
          await this.audit(
            tx,
            'insert',
            TEMPLATE_TABLE_NAME,
            template.ptlId,
            template.ptlName,
            null,
            toTemplatePayload(template),
            'Print template created',
          );
        }

        const publishedRevId = await this.applyVersionPlans(tx, template, versionPlans);
        await this.applyPointer(tx, template, pointer, publishedRevId, versionPlans);

        const after = await this.findTemplate(tx, template.ptlId, true);
        if (existing) {
          await this.audit(
            tx,
            'update',
            TEMPLATE_TABLE_NAME,
            template.ptlId,
            template.ptlName,
            toTemplatePayload(existing),
            after ? toTemplatePayload(after) : null,
            'Print template updated',
          );
        }
        return after ? toTemplatePayload(after) : toTemplatePayload(template);
      })
      .catch((error: unknown) => {
        handlePrintTemplateWriteError(error);
        throw error;
      });
  }

  /**
   * Soft delete, and take every revision and every dataset down with it in the
   * same transaction. A live dataset under a dead template is the state that
   * makes a withdrawn design keep printing at a till.
   *
   * The version history is soft deleted rather than removed: print_log still
   * points at those revisions, and "what did this bill look like" has to keep
   * answering after the design is retired.
   */
  async softDeleteTemplate(
    ptlId: string,
    modifiedBy?: string | null,
  ): Promise<PrintTemplateDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findTemplate(tx, ptlId, true);
      if (!existing) {
        this.throwNotFound('ptlId', ptlId, 'Print template not found');
      }

      await this.assertNotAssigned(tx, ptlId);

      const modifiedOn = new Date();
      const actor = this.resolveWriteActor(modifiedBy);
      const versionIds = existing.versions.map((version) => version.ptvId);

      const updated = await tx.printTemplate.update({
        where: { ptlId },
        data: {
          ptlIsDeleted: true,
          ptlIsActive: false,
          ptlModifiedOn: modifiedOn,
          ptlModifiedBy: actor,
        },
      });

      if (versionIds.length > 0) {
        await tx.printTemplateDataset.updateMany({
          where: { ptdVersionId: { in: versionIds }, ptdIsDeleted: false },
          data: { ptdIsDeleted: true, ptdModifiedOn: modifiedOn, ptdModifiedBy: actor },
        });
        await tx.printTemplateVersion.updateMany({
          where: { ptvTemplateId: ptlId, ptvIsDeleted: false },
          data: { ptvIsDeleted: true, ptvModifiedOn: modifiedOn, ptvModifiedBy: actor },
        });
      }

      await this.audit(
        tx,
        'cancel',
        TEMPLATE_TABLE_NAME,
        ptlId,
        existing.ptlName,
        toTemplatePayload(existing),
        toTemplatePayload(updated),
        'Print template soft deleted with every revision and dataset',
      );

      return { deleted: true as const, ptlId };
    });
  }

  // ═══ Phase A — the header ════════════════════════════════════════════════

  private planHeader(
    existing: TemplateWithChildren | null,
    dto: SavePrintTemplateDto,
    errors: PrintTemplateErrorDetail[],
  ): {
    create: Prisma.PrintTemplateUncheckedCreateInput;
    update: Prisma.PrintTemplateUncheckedUpdateInput;
    effective: EffectiveTemplate & { companyId: string | null };
  } {
    const companyId = hasOwnProperty(dto, 'ptlCompanyId')
      ? (dto.ptlCompanyId ?? null)
      : (existing?.ptlCompanyId ?? null);
    const purposeId = dto.ptlPurposeId ?? existing?.ptlPurposeId ?? '';
    const code = dto.ptlCode ?? existing?.ptlCode ?? '';
    const name = dto.ptlName ?? existing?.ptlName ?? '';

    if (!existing) {
      if (!purposeId) {
        errors.push({ field: 'ptlPurposeId', message: 'ptlPurposeId is required' });
      }
      if (!code) {
        errors.push({ field: 'ptlCode', message: 'ptlCode is required' });
      }
      if (!name) {
        errors.push({ field: 'ptlName', message: 'ptlName is required' });
      }
    }

    const forkedFromId = hasOwnProperty(dto, 'ptlForkedFromId')
      ? (dto.ptlForkedFromId ?? null)
      : (existing?.ptlForkedFromId ?? null);
    const forkedFromRev = hasOwnProperty(dto, 'ptlForkedFromRev')
      ? (dto.ptlForkedFromRev ?? null)
      : (existing?.ptlForkedFromRev ?? null);
    const sortOrder = dto.ptlSortOrder ?? existing?.ptlSortOrder ?? 100;

    const effective: EffectiveTemplate & { companyId: string | null } = {
      ptlId: existing?.ptlId ?? null,
      ptlCode: code,
      ptlSortOrder: sortOrder,
      ptlForkedFromId: forkedFromId,
      ptlForkedFromRev: forkedFromRev,
      companyId,
    };
    errors.push(...collectTemplateInvariantErrors(effective));

    const create: Prisma.PrintTemplateUncheckedCreateInput = {
      ptlCompanyId: companyId,
      ptlPurposeId: purposeId,
      ptlCode: code,
      ptlName: name,
      ptlDescription: normalizeNullableString(dto.ptlDescription) ?? null,
      ptlForkedFromId: forkedFromId,
      ptlForkedFromRev: forkedFromRev,
      ptlSortOrder: sortOrder,
      ptlIsActive: dto.ptlIsActive ?? true,
      ptlCreatedBy: this.resolveWriteActor(dto.ptlCreatedBy),
    };

    // Only the keys actually present are written, so a screen can rename a
    // template without resending the design.
    const update: Prisma.PrintTemplateUncheckedUpdateInput = {
      ptlModifiedOn: new Date(),
      ptlModifiedBy: this.resolveWriteActor(dto.ptlModifiedBy),
    };
    if (hasOwnProperty(dto, 'ptlCompanyId')) update.ptlCompanyId = companyId;
    if (hasOwnProperty(dto, 'ptlPurposeId')) update.ptlPurposeId = purposeId;
    if (hasOwnProperty(dto, 'ptlCode')) update.ptlCode = code;
    if (hasOwnProperty(dto, 'ptlName')) update.ptlName = name;
    if (hasOwnProperty(dto, 'ptlDescription')) {
      update.ptlDescription = normalizeNullableString(dto.ptlDescription) ?? null;
    }
    if (hasOwnProperty(dto, 'ptlForkedFromId')) update.ptlForkedFromId = forkedFromId;
    if (hasOwnProperty(dto, 'ptlForkedFromRev')) update.ptlForkedFromRev = forkedFromRev;
    if (hasOwnProperty(dto, 'ptlSortOrder')) update.ptlSortOrder = sortOrder;
    if (hasOwnProperty(dto, 'ptlIsActive')) update.ptlIsActive = dto.ptlIsActive ?? true;

    return { create, update, effective };
  }

  /**
   * ux_ptl_code is a PARTIAL unique index with NULLS NOT DISTINCT, so Prisma
   * neither declares nor necessarily creates it — check here rather than hoping
   * for a P2002.
   *
   * NULLS NOT DISTINCT is what makes a shipped SALE_INVOICE_A4 and a company's
   * own SALE_INVOICE_A4 coexist while two SHIPPED ones collide: the null owner
   * dedupes against itself. Passing `null` through as a real IS NULL match is
   * the whole of that behaviour.
   */
  private async assertCodeIsFree(
    client: WriteClient,
    companyId: string | null,
    code: string,
    ignoreTemplateId: string | null,
  ): Promise<void> {
    if (!code) {
      return;
    }
    const clash = await client.printTemplate.findFirst({
      where: {
        ptlCompanyId: companyId,
        ptlIsDeleted: false,
        ptlCode: { equals: code, mode: 'insensitive' },
        ...(ignoreTemplateId ? { ptlId: { not: ignoreTemplateId } } : {}),
      },
      select: { ptlId: true },
    });
    if (clash) {
      this.throwConflict('Duplicate template code', [
        {
          field: 'ptlCode',
          message: companyId
            ? `ptlCode ${code} already exists for this company`
            : `ptlCode ${code} already exists among the shipped templates`,
        },
      ]);
    }
  }

  /**
   * A template that some counter is still pointed at cannot simply vanish:
   * fk_pta_template would refuse the delete if it were a hard one, and a soft
   * delete would leave the assignment resolving to a template that is gone.
   */
  private async assertNotAssigned(client: WriteClient, ptlId: string): Promise<void> {
    const assignment = await client.printTemplateAssignment.findFirst({
      where: { ptaTemplateId: ptlId, ptaIsDeleted: false },
      select: { ptaId: true },
    });
    if (assignment) {
      this.throwConflict('Print template is still assigned', [
        {
          field: 'ptlId',
          message:
            'One or more print template assignments still point at this template. Remove them ' +
            'first, or point them at another design.',
        },
      ]);
    }
  }

  // ═══ Phase A — the versions ══════════════════════════════════════════════

  private planVersions(
    existing: TemplateWithChildren | null,
    rows: SavePrintTemplateVersionDto[] | undefined,
    errors: PrintTemplateErrorDetail[],
  ): VersionPlan[] {
    if (rows === undefined) {
      return [];
    }

    const byId = new Map<string, TemplateWithChildren['versions'][number]>();
    for (const version of existing?.versions ?? []) {
      byId.set(version.ptvId, version);
    }
    // Dense and never reused, so the next one is one past the highest that has
    // EVER existed — deleted revisions included, which is why the read that
    // feeds this includes them.
    let nextRevNo = Math.max(0, ...(existing?.versions ?? []).map((v) => v.ptvRevNo)) + 1;
    const claimedRevNos = new Set((existing?.versions ?? []).map((v) => v.ptvRevNo));

    const plans: VersionPlan[] = [];
    rows.forEach((row, index) => {
      const path = `versions[${index}]`;
      const current = row.ptvId ? byId.get(row.ptvId) : undefined;

      if (row.ptvId && !current) {
        errors.push({
          field: `${path}.ptvId`,
          message: `No revision ${row.ptvId} belongs to this template`,
        });
        return;
      }

      if (row.ptvIsDeleted === true) {
        const plan = this.planVersionDelete(existing, current ?? null, row, path, errors);
        if (plan) {
          plans.push(plan);
        }
        return;
      }

      // THE RULE. A version that was already PUBLISHED or RETIRED when this
      // request arrived is frozen; one being published BY this request is not,
      // so a designer can compose a revision and publish it in a single call.
      if (current && current.ptvStatus !== 'DRAFT') {
        const plan = this.planFrozenVersion(existing, current, row, path, errors);
        if (plan) {
          plans.push(plan);
        }
        return;
      }

      const revNo = row.ptvRevNo ?? current?.ptvRevNo ?? nextRevNo;
      if (!current && row.ptvRevNo === undefined) {
        nextRevNo += 1;
      }
      if (!current && row.ptvRevNo !== undefined && claimedRevNos.has(row.ptvRevNo)) {
        errors.push({
          field: `${path}.ptvRevNo`,
          message:
            `Revision ${row.ptvRevNo} already exists on this template. Revision numbers are ` +
            'never reused — omit ptvRevNo and the next one is assigned.',
        });
      }
      claimedRevNos.add(revNo);

      const effective = this.effectiveVersion(current ?? null, row, revNo);
      errors.push(...collectVersionInvariantErrors(effective, path));

      const publishes = effective.ptvStatus === 'PUBLISHED' && current?.ptvStatus !== 'PUBLISHED';
      const datasets = this.planDatasets(current ?? null, row.datasets, path, errors);

      plans.push({
        path,
        row,
        existing: current ?? null,
        effective,
        datasets,
        publishes,
        releasesPointer: false,
        deletes: false,
      });
    });

    return plans;
  }

  /**
   * A revision that is already live. The design is frozen, and the one thing
   * still allowed is taking it out of service.
   */
  private planFrozenVersion(
    existing: TemplateWithChildren | null,
    current: VersionRow,
    row: SavePrintTemplateVersionDto,
    path: string,
    errors: PrintTemplateErrorDetail[],
  ): VersionPlan | null {
    const design = this.designKeysPresent(row);
    if (design.length > 0) {
      errors.push({
        field: `${path}.${design[0]}`,
        message:
          `Revision ${current.ptvRevNo} is ${current.ptvStatus} and can no longer be edited — ` +
          'print_log points at these exact bytes. Send a version row with NO ptvId instead and ' +
          `it becomes the next revision. (Refused: ${design.join(', ')}.)`,
      });
      return null;
    }
    if (row.datasets !== undefined) {
      errors.push({
        field: `${path}.datasets`,
        message:
          `The datasets of ${current.ptvStatus} revision ${current.ptvRevNo} are frozen with its ` +
          'design. Add a new revision to change what feeds it.',
      });
      return null;
    }

    const target = row.ptvStatus ?? current.ptvStatus;
    if (target === current.ptvStatus) {
      return null; // nothing asked for
    }
    if (!(current.ptvStatus === 'PUBLISHED' && target === 'RETIRED')) {
      errors.push({
        field: `${path}.ptvStatus`,
        message:
          `A ${current.ptvStatus} revision cannot become ${target}. The only move left to a ` +
          'published revision is RETIRED.',
      });
      return null;
    }

    return {
      path,
      row,
      existing: current,
      effective: this.effectiveVersion(current, row, current.ptvRevNo),
      datasets: null,
      publishes: false,
      // Retiring the revision the template points at leaves the template
      // unresolvable, which is precisely what withdrawing a design means.
      releasesPointer: existing?.ptlPublishedRevId === current.ptvId,
      deletes: false,
    };
  }

  private planVersionDelete(
    existing: TemplateWithChildren | null,
    current: VersionRow | null,
    row: SavePrintTemplateVersionDto,
    path: string,
    errors: PrintTemplateErrorDetail[],
  ): VersionPlan | null {
    if (!current) {
      errors.push({
        field: `${path}.ptvId`,
        message: 'ptvIsDeleted needs a ptvId — there is nothing to delete without one',
      });
      return null;
    }
    if (current.ptvIsDeleted) {
      return null;
    }
    if (current.ptvStatus === 'PUBLISHED') {
      errors.push({
        field: `${path}.ptvIsDeleted`,
        message:
          `Revision ${current.ptvRevNo} is PUBLISHED. Retire it first — a revision that has ` +
          'printed cannot be deleted out from under print_log.',
      });
      return null;
    }
    if (existing?.ptlPublishedRevId === current.ptvId) {
      errors.push({
        field: `${path}.ptvIsDeleted`,
        message: `Revision ${current.ptvRevNo} is the one this template publishes. Point the template elsewhere first.`,
      });
      return null;
    }
    return {
      path,
      row,
      existing: current,
      effective: this.effectiveVersion(current, {}, current.ptvRevNo),
      datasets: null,
      publishes: false,
      releasesPointer: false,
      deletes: true,
    };
  }

  /** The keys that describe the DESIGN, as opposed to its status. */
  private designKeysPresent(row: SavePrintTemplateVersionDto): string[] {
    const designKeys = [
      'ptvRevNo',
      'ptvEngine',
      'ptvBody',
      'ptvSchemaVer',
      'ptvPaperCode',
      'ptvOrientation',
      'ptvWidthMm',
      'ptvHeightMm',
      'ptvMarginTopMm',
      'ptvMarginBottomMm',
      'ptvMarginLeftMm',
      'ptvMarginRightMm',
      'ptvColumns',
      'ptvLang',
      'ptvFontFamily',
      'ptvParams',
      'ptvNote',
    ];
    return designKeys.filter((key) => hasOwnProperty(row, key));
  }

  /** The existing revision overlaid with whatever this request writes. */
  private effectiveVersion(
    current: VersionRow | null,
    row: SavePrintTemplateVersionDto,
    revNo: number,
  ): EffectiveVersion {
    const pick = <T>(key: keyof SavePrintTemplateVersionDto, fallback: T): T => {
      const value = row[key];
      return value === undefined ? fallback : (value as T);
    };
    const status = pick('ptvStatus', current?.ptvStatus ?? PTV_DEFAULT_STATUS);
    return {
      ptvRevNo: revNo,
      ptvStatus: status,
      ptvEngine: pick('ptvEngine', current?.ptvEngine ?? PTV_DEFAULT_ENGINE),
      ptvBody: pick('ptvBody', current?.ptvBody ?? ''),
      ptvPaperCode: pick('ptvPaperCode', current?.ptvPaperCode ?? 'A4'),
      ptvOrientation: pick('ptvOrientation', current?.ptvOrientation ?? PTV_DEFAULT_ORIENTATION),
      ptvWidthMm: pick('ptvWidthMm', numberOrNull(current?.ptvWidthMm)),
      ptvHeightMm: pick('ptvHeightMm', numberOrNull(current?.ptvHeightMm)),
      ptvMarginTopMm: pick('ptvMarginTopMm', numberOr(current?.ptvMarginTopMm, 0)),
      ptvMarginBottomMm: pick('ptvMarginBottomMm', numberOr(current?.ptvMarginBottomMm, 0)),
      ptvMarginLeftMm: pick('ptvMarginLeftMm', numberOr(current?.ptvMarginLeftMm, 0)),
      ptvMarginRightMm: pick('ptvMarginRightMm', numberOr(current?.ptvMarginRightMm, 0)),
      ptvColumns: pick('ptvColumns', current?.ptvColumns ?? null),
      ptvLang: pick('ptvLang', current?.ptvLang ?? PTV_DEFAULT_LANG),
      ptvParams: hasOwnProperty(row, 'ptvParams')
        ? (row.ptvParams ?? null)
        : (current?.ptvParams ?? null),
      // Publishing takes a signature. An explicit ptvApprovedBy wins; otherwise
      // whoever pressed publish signs it, and if the request carries no
      // authenticated user then ck_ptv_published has nothing to work with and
      // says so.
      ptvApprovedBy:
        pick('ptvApprovedBy', current?.ptvApprovedBy ?? null) ??
        (status === 'PUBLISHED' ? this.requestContextService.getUserId() : null),
    };
  }

  // ═══ Phase A — the datasets ══════════════════════════════════════════════

  /**
   * The `datasets` key REPLACES the version's set: rows with ptdId are updated,
   * rows without one are inserted, and rows already on the version but missing
   * from the array are soft deleted. Omitting the key leaves them alone.
   *
   * Validation runs over the RESULTING set, not over the rows that changed —
   * the three partial unique indexes and the parent references are statements
   * about the whole version, and a row that is merely being kept can still be
   * the one a new row collides with.
   */
  private planDatasets(
    current: TemplateWithChildren['versions'][number] | null,
    rows: SavePrintTemplateDatasetDto[] | undefined,
    versionPath: string,
    errors: PrintTemplateErrorDetail[],
  ): DatasetSetPlan | null {
    if (rows === undefined) {
      return null;
    }

    const byId = new Map<string, DatasetRow>();
    for (const dataset of current?.datasets ?? []) {
      byId.set(dataset.ptdId, dataset);
    }

    const plans: DatasetPlan[] = [];
    rows.forEach((row, index) => {
      const path = `${versionPath}.datasets[${index}]`;
      const existing = row.ptdId ? byId.get(row.ptdId) : undefined;
      if (row.ptdId && !existing) {
        errors.push({
          field: `${path}.ptdId`,
          message: `No dataset ${row.ptdId} belongs to this revision`,
        });
        return;
      }

      const effective = this.effectiveDataset(existing ?? null, row, path, errors);
      errors.push(...collectDatasetInvariantErrors(effective, path));
      plans.push({ path, existing: existing ?? null, effective, row });
    });

    errors.push(
      ...collectDatasetSetInvariantErrors(
        plans.map((plan) => ({ dataset: plan.effective, path: plan.path })),
      ),
    );

    return { plans };
  }

  private effectiveDataset(
    existing: DatasetRow | null,
    row: SavePrintTemplateDatasetDto,
    path: string,
    errors: PrintTemplateErrorDetail[],
  ): EffectiveDataset {
    const role = row.ptdRole ?? existing?.ptdRole ?? PTD_DEFAULT_ROLE;
    const name = row.ptdName ?? existing?.ptdName ?? '';
    if (!existing && !name) {
      errors.push({ field: `${path}.ptdName`, message: 'ptdName is required' });
    }

    // A MASTER is dataset 0 by definition, so a create that names a role but no
    // number is unambiguous — filling it in is not a guess.
    const datasetNo =
      row.ptdDatasetNo ?? existing?.ptdDatasetNo ?? (role === 'MASTER' ? 0 : Number.NaN);
    if (!existing && Number.isNaN(datasetNo)) {
      errors.push({
        field: `${path}.ptdDatasetNo`,
        message: 'ptdDatasetNo is required for a DETAIL dataset — it is what a band points at',
      });
    }

    return {
      ptdRole: role,
      ptdDatasetNo: Number.isNaN(datasetNo) ? -1 : datasetNo,
      ptdName: name,
      ptdSourceKind: row.ptdSourceKind ?? existing?.ptdSourceKind ?? PTD_DEFAULT_SOURCE_KIND,
      ptdProviderCode: hasOwnProperty(row, 'ptdProviderCode')
        ? (row.ptdProviderCode ?? null)
        : (existing?.ptdProviderCode ?? null),
      ptdSql: hasOwnProperty(row, 'ptdSql') ? (row.ptdSql ?? null) : (existing?.ptdSql ?? null),
      ptdRequiresCompany: row.ptdRequiresCompany ?? existing?.ptdRequiresCompany ?? true,
      ptdParentNo: hasOwnProperty(row, 'ptdParentNo')
        ? (row.ptdParentNo ?? null)
        : (existing?.ptdParentNo ?? null),
      ptdLinkFields: hasOwnProperty(row, 'ptdLinkFields')
        ? (row.ptdLinkFields ?? null)
        : (existing?.ptdLinkFields ?? null),
      ptdRowLimit: row.ptdRowLimit ?? existing?.ptdRowLimit ?? PTD_DEFAULT_ROW_LIMIT,
      ptdTimeoutMs: row.ptdTimeoutMs ?? existing?.ptdTimeoutMs ?? PTD_DEFAULT_TIMEOUT_MS,
    };
  }

  // ═══ Phase A — the published pointer ═════════════════════════════════════

  /**
   * fk_ptl_published_rev points at ptv_id ALONE, so nothing in the database
   * stops it naming a DRAFT, a RETIRED version, or a version of a DIFFERENT
   * template. Until the composite key exists, this is the only thing that does.
   */
  private planPointer(
    existing: TemplateWithChildren | null,
    dto: SavePrintTemplateDto,
    plans: VersionPlan[],
    errors: PrintTemplateErrorDetail[],
  ): { explicit: boolean; value: string | null } {
    const publishing = plans.filter((plan) => plan.publishes);
    if (publishing.length > 1) {
      errors.push({
        field: `${publishing[1].path}.ptvStatus`,
        message:
          'Only one revision may be published per request — the template has one published ' +
          'pointer, and two candidates leave no way to say which is live.',
      });
    }

    if (!hasOwnProperty(dto, 'ptlPublishedRevId')) {
      return { explicit: false, value: null };
    }

    const requested = dto.ptlPublishedRevId ?? null;
    if (requested === null) {
      return { explicit: true, value: null };
    }
    if (publishing.length > 0) {
      errors.push({
        field: 'ptlPublishedRevId',
        message:
          'Send either ptlPublishedRevId or a revision with ptvStatus PUBLISHED, not both — they ' +
          'are two ways of moving the same pointer.',
      });
      return { explicit: true, value: requested };
    }

    const target = existing?.versions.find((version) => version.ptvId === requested);
    if (!target) {
      errors.push({
        field: 'ptlPublishedRevId',
        message: 'ptlPublishedRevId must name a revision of THIS template',
      });
    } else if (target.ptvIsDeleted) {
      errors.push({
        field: 'ptlPublishedRevId',
        message: `Revision ${target.ptvRevNo} is deleted and cannot be published`,
      });
    } else if (target.ptvStatus !== 'PUBLISHED') {
      errors.push({
        field: 'ptlPublishedRevId',
        message:
          `Revision ${target.ptvRevNo} is ${target.ptvStatus}. Only a PUBLISHED revision may be ` +
          'the one a render uses — set its ptvStatus to PUBLISHED in the same call.',
      });
    }
    return { explicit: true, value: requested };
  }

  // ═══ Phase B — writing the versions ══════════════════════════════════════

  /** @returns the revision this request publishes, if any. */
  private async applyVersionPlans(
    tx: Prisma.TransactionClient,
    template: TemplateRow,
    plans: VersionPlan[],
  ): Promise<string | null> {
    let publishedRevId: string | null = null;

    for (const plan of plans) {
      if (plan.deletes) {
        await this.deleteVersion(tx, plan);
        continue;
      }

      const version = plan.existing
        ? await this.updateVersion(tx, plan)
        : await this.createVersion(tx, template, plan);

      if (plan.datasets) {
        await this.applyDatasetPlan(tx, version, plan);
      }
      if (plan.publishes) {
        publishedRevId = version.ptvId;
      }
    }

    return publishedRevId;
  }

  private async createVersion(
    tx: Prisma.TransactionClient,
    template: TemplateRow,
    plan: VersionPlan,
  ): Promise<VersionRow> {
    const effective = plan.effective;
    const data: Prisma.PrintTemplateVersionUncheckedCreateInput = {
      ptvTemplateId: template.ptlId,
      ptvRevNo: effective.ptvRevNo,
      ptvStatus: effective.ptvStatus,
      ptvEngine: effective.ptvEngine,
      ptvBody: effective.ptvBody,
      ptvSchemaVer: plan.row.ptvSchemaVer ?? 1,
      ptvPaperCode: effective.ptvPaperCode,
      ptvOrientation: effective.ptvOrientation,
      ptvWidthMm: effective.ptvWidthMm,
      ptvHeightMm: effective.ptvHeightMm,
      ptvMarginTopMm: effective.ptvMarginTopMm,
      ptvMarginBottomMm: effective.ptvMarginBottomMm,
      ptvMarginLeftMm: effective.ptvMarginLeftMm,
      ptvMarginRightMm: effective.ptvMarginRightMm,
      ptvColumns: effective.ptvColumns,
      ptvLang: effective.ptvLang,
      ptvFontFamily: normalizeNullableString(plan.row.ptvFontFamily) ?? null,
      ptvParams: toJsonInput(effective.ptvParams),
      ptvNote: normalizeNullableString(plan.row.ptvNote) ?? null,
      ptvApprovedBy: effective.ptvApprovedBy,
      ptvApprovedOn: effective.ptvStatus === 'PUBLISHED' ? new Date() : null,
      ptvCreatedBy: this.resolveWriteActor(plan.row.ptvCreatedBy),
    };

    const version = await tx.printTemplateVersion.create({ data });
    await this.audit(
      tx,
      'insert',
      VERSION_TABLE_NAME,
      version.ptvId,
      `${version.ptvTemplateId} rev ${version.ptvRevNo}`,
      null,
      toVersionPayload(version, null),
      `Print template revision ${version.ptvRevNo} created as ${version.ptvStatus}`,
    );
    return version;
  }

  private async updateVersion(
    tx: Prisma.TransactionClient,
    plan: VersionPlan,
  ): Promise<VersionRow> {
    const existing = plan.existing as VersionRow;
    const row = plan.row;
    const effective = plan.effective;

    const data: Prisma.PrintTemplateVersionUncheckedUpdateInput = {
      ptvModifiedOn: new Date(),
      ptvModifiedBy: this.resolveWriteActor(row.ptvModifiedBy),
    };
    if (hasOwnProperty(row, 'ptvRevNo')) data.ptvRevNo = effective.ptvRevNo;
    if (hasOwnProperty(row, 'ptvStatus')) data.ptvStatus = effective.ptvStatus;
    if (hasOwnProperty(row, 'ptvEngine')) data.ptvEngine = effective.ptvEngine;
    if (hasOwnProperty(row, 'ptvBody')) data.ptvBody = effective.ptvBody;
    if (hasOwnProperty(row, 'ptvSchemaVer')) data.ptvSchemaVer = row.ptvSchemaVer;
    if (hasOwnProperty(row, 'ptvPaperCode')) data.ptvPaperCode = effective.ptvPaperCode;
    if (hasOwnProperty(row, 'ptvOrientation')) data.ptvOrientation = effective.ptvOrientation;
    if (hasOwnProperty(row, 'ptvWidthMm')) data.ptvWidthMm = effective.ptvWidthMm;
    if (hasOwnProperty(row, 'ptvHeightMm')) data.ptvHeightMm = effective.ptvHeightMm;
    if (hasOwnProperty(row, 'ptvMarginTopMm')) data.ptvMarginTopMm = effective.ptvMarginTopMm;
    if (hasOwnProperty(row, 'ptvMarginBottomMm')) {
      data.ptvMarginBottomMm = effective.ptvMarginBottomMm;
    }
    if (hasOwnProperty(row, 'ptvMarginLeftMm')) data.ptvMarginLeftMm = effective.ptvMarginLeftMm;
    if (hasOwnProperty(row, 'ptvMarginRightMm')) {
      data.ptvMarginRightMm = effective.ptvMarginRightMm;
    }
    if (hasOwnProperty(row, 'ptvColumns')) data.ptvColumns = effective.ptvColumns;
    if (hasOwnProperty(row, 'ptvLang')) data.ptvLang = effective.ptvLang;
    if (hasOwnProperty(row, 'ptvFontFamily')) {
      data.ptvFontFamily = normalizeNullableString(row.ptvFontFamily) ?? null;
    }
    if (hasOwnProperty(row, 'ptvParams')) data.ptvParams = toJsonInput(effective.ptvParams);
    if (hasOwnProperty(row, 'ptvNote')) {
      data.ptvNote = normalizeNullableString(row.ptvNote) ?? null;
    }

    // Publishing is the one transition that stamps a signature and a time. Both
    // are the server's to write: an approver who could choose their own
    // approval timestamp is not an approver.
    if (plan.publishes) {
      data.ptvApprovedBy = effective.ptvApprovedBy;
      data.ptvApprovedOn = new Date();
    } else if (hasOwnProperty(row, 'ptvApprovedBy')) {
      data.ptvApprovedBy = effective.ptvApprovedBy;
    }

    const updated = await tx.printTemplateVersion.update({
      where: { ptvId: existing.ptvId },
      data,
    });
    await this.audit(
      tx,
      plan.publishes ? 'approve' : 'update',
      VERSION_TABLE_NAME,
      updated.ptvId,
      `${updated.ptvTemplateId} rev ${updated.ptvRevNo}`,
      toVersionPayload(existing, null),
      toVersionPayload(updated, null),
      plan.publishes
        ? `Print template revision ${updated.ptvRevNo} published`
        : `Print template revision ${updated.ptvRevNo} updated`,
    );
    return updated;
  }

  private async deleteVersion(tx: Prisma.TransactionClient, plan: VersionPlan): Promise<void> {
    const existing = plan.existing as VersionRow;
    const modifiedOn = new Date();
    const actor = this.resolveWriteActor(plan.row.ptvModifiedBy);

    await tx.printTemplateDataset.updateMany({
      where: { ptdVersionId: existing.ptvId, ptdIsDeleted: false },
      data: { ptdIsDeleted: true, ptdModifiedOn: modifiedOn, ptdModifiedBy: actor },
    });
    const updated = await tx.printTemplateVersion.update({
      where: { ptvId: existing.ptvId },
      data: { ptvIsDeleted: true, ptvModifiedOn: modifiedOn, ptvModifiedBy: actor },
    });
    await this.audit(
      tx,
      'cancel',
      VERSION_TABLE_NAME,
      existing.ptvId,
      `${existing.ptvTemplateId} rev ${existing.ptvRevNo}`,
      toVersionPayload(existing, null),
      toVersionPayload(updated, null),
      `Print template revision ${existing.ptvRevNo} soft deleted with its datasets`,
    );
  }

  // ═══ Phase B — writing the datasets ══════════════════════════════════════

  /**
   * WRITE ORDER IS THE WHOLE PROBLEM HERE, and it is why every live dataset is
   * taken down before a single one is written back.
   *
   * ux_ptd_dataset_no, ux_ptd_name and ux_ptd_one_master are partial on
   * is_deleted, and PostgreSQL checks a unique index per STATEMENT — there is
   * no deferral to lean on. So the obvious order, "write the new rows then
   * remove the ones nobody mentioned", collides with itself in two ordinary
   * cases: a fresh row that reuses the number of a row this same request is
   * about to drop, and two kept rows swapping numbers with each other. Both are
   * things a designer does by hand in the grid, and both would surface as a
   * P2002 naming a constraint the payload never mentioned.
   *
   * Clearing the partial index first makes the ordering irrelevant. A row that
   * is being kept comes straight back up, id and history intact, because the
   * update names it by ptdId and sets ptdIsDeleted false again.
   */
  private async applyDatasetPlan(
    tx: Prisma.TransactionClient,
    version: VersionRow,
    plan: VersionPlan,
  ): Promise<void> {
    const set = plan.datasets as DatasetSetPlan;
    const actor = this.resolveWriteActor(plan.row.ptvModifiedBy ?? plan.row.ptvCreatedBy);
    const modifiedOn = new Date();

    const before = await tx.printTemplateDataset.findMany({
      where: { ptdVersionId: version.ptvId, ptdIsDeleted: false },
    });
    const kept = new Set(
      set.plans
        .map((datasetPlan) => datasetPlan.existing?.ptdId)
        .filter((id): id is string => id !== undefined),
    );

    if (before.length > 0) {
      await tx.printTemplateDataset.updateMany({
        where: { ptdVersionId: version.ptvId, ptdIsDeleted: false },
        data: { ptdIsDeleted: true, ptdModifiedOn: modifiedOn, ptdModifiedBy: actor },
      });
    }

    for (const datasetPlan of set.plans) {
      if (datasetPlan.existing) {
        await this.updateDataset(tx, datasetPlan);
      } else {
        await this.createDataset(tx, version, datasetPlan);
      }
    }

    // Only the rows nobody mentioned are a deletion. The rest were down for the
    // length of this transaction and nothing outside it ever saw them that way.
    for (const row of before) {
      if (kept.has(row.ptdId)) {
        continue;
      }
      await this.audit(
        tx,
        'cancel',
        DATASET_TABLE_NAME,
        row.ptdId,
        `${row.ptdName} (#${row.ptdDatasetNo})`,
        toDatasetPayload(row),
        toDatasetPayload({
          ...row,
          ptdIsDeleted: true,
          ptdModifiedOn: modifiedOn,
          ptdModifiedBy: actor,
        }),
        'Print template dataset soft deleted — absent from the datasets array',
      );
    }
  }

  private async createDataset(
    tx: Prisma.TransactionClient,
    version: VersionRow,
    plan: DatasetPlan,
  ): Promise<DatasetRow> {
    const effective = plan.effective;
    const created = await tx.printTemplateDataset.create({
      data: {
        ptdVersionId: version.ptvId,
        ptdRole: effective.ptdRole,
        ptdDatasetNo: effective.ptdDatasetNo,
        ptdSortOrder: plan.row.ptdSortOrder ?? 0,
        ptdName: effective.ptdName,
        ptdLabel: normalizeNullableString(plan.row.ptdLabel) ?? null,
        ptdSourceKind: effective.ptdSourceKind,
        ptdProviderCode: effective.ptdProviderCode,
        ptdSql: effective.ptdSql,
        ptdRequiresCompany: effective.ptdRequiresCompany,
        ptdParentNo: effective.ptdParentNo,
        ptdLinkFields: effective.ptdLinkFields,
        ptdRowLimit: effective.ptdRowLimit,
        ptdTimeoutMs: effective.ptdTimeoutMs,
        ptdRemarks: normalizeNullableString(plan.row.ptdRemarks) ?? null,
        ptdCreatedBy: this.resolveWriteActor(plan.row.ptdCreatedBy),
      },
    });
    await this.audit(
      tx,
      'insert',
      DATASET_TABLE_NAME,
      created.ptdId,
      `${created.ptdName} (#${created.ptdDatasetNo})`,
      null,
      toDatasetPayload(created),
      `Print template dataset ${created.ptdName} created`,
    );
    return created;
  }

  private async updateDataset(
    tx: Prisma.TransactionClient,
    plan: DatasetPlan,
  ): Promise<DatasetRow> {
    const existing = plan.existing as DatasetRow;
    const row = plan.row;
    const effective = plan.effective;

    const data: Prisma.PrintTemplateDatasetUncheckedUpdateInput = {
      // Back up again — applyDatasetPlan took every live row down first so that
      // the partial unique indexes could not collide mid-write.
      ptdIsDeleted: false,
      ptdModifiedOn: new Date(),
      ptdModifiedBy: this.resolveWriteActor(row.ptdModifiedBy),
    };
    if (hasOwnProperty(row, 'ptdRole')) data.ptdRole = effective.ptdRole;
    if (hasOwnProperty(row, 'ptdDatasetNo')) data.ptdDatasetNo = effective.ptdDatasetNo;
    if (hasOwnProperty(row, 'ptdSortOrder')) data.ptdSortOrder = row.ptdSortOrder;
    if (hasOwnProperty(row, 'ptdName')) data.ptdName = effective.ptdName;
    if (hasOwnProperty(row, 'ptdLabel')) {
      data.ptdLabel = normalizeNullableString(row.ptdLabel) ?? null;
    }
    if (hasOwnProperty(row, 'ptdSourceKind')) data.ptdSourceKind = effective.ptdSourceKind;
    if (hasOwnProperty(row, 'ptdProviderCode')) data.ptdProviderCode = effective.ptdProviderCode;
    if (hasOwnProperty(row, 'ptdSql')) data.ptdSql = effective.ptdSql;
    if (hasOwnProperty(row, 'ptdRequiresCompany')) {
      data.ptdRequiresCompany = effective.ptdRequiresCompany;
    }
    if (hasOwnProperty(row, 'ptdParentNo')) data.ptdParentNo = effective.ptdParentNo;
    if (hasOwnProperty(row, 'ptdLinkFields')) data.ptdLinkFields = effective.ptdLinkFields;
    if (hasOwnProperty(row, 'ptdRowLimit')) data.ptdRowLimit = effective.ptdRowLimit;
    if (hasOwnProperty(row, 'ptdTimeoutMs')) data.ptdTimeoutMs = effective.ptdTimeoutMs;
    if (hasOwnProperty(row, 'ptdRemarks')) {
      data.ptdRemarks = normalizeNullableString(row.ptdRemarks) ?? null;
    }

    const updated = await tx.printTemplateDataset.update({
      where: { ptdId: existing.ptdId },
      data,
    });
    await this.audit(
      tx,
      'update',
      DATASET_TABLE_NAME,
      updated.ptdId,
      `${updated.ptdName} (#${updated.ptdDatasetNo})`,
      toDatasetPayload(existing),
      toDatasetPayload(updated),
      `Print template dataset ${updated.ptdName} updated`,
    );
    return updated;
  }

  // ═══ Phase B — moving the pointer ════════════════════════════════════════

  /**
   * Publishing and rolling back are a POINTER MOVE — one row, atomic — which
   * is what lets a render in flight never see a half-saved template.
   */
  private async applyPointer(
    tx: Prisma.TransactionClient,
    template: TemplateRow,
    pointer: { explicit: boolean; value: string | null },
    publishedRevId: string | null,
    plans: VersionPlan[],
  ): Promise<void> {
    let target: string | null | undefined;

    if (publishedRevId) {
      target = publishedRevId;
    } else if (pointer.explicit) {
      target = pointer.value;
    } else if (plans.some((plan) => plan.releasesPointer)) {
      // The live revision was retired. The template stops resolving, which is
      // exactly what withdrawing a design means.
      target = null;
    }

    if (target === undefined || target === template.ptlPublishedRevId) {
      return;
    }

    await tx.printTemplate.update({
      where: { ptlId: template.ptlId },
      data: {
        ptlPublishedRevId: target,
        ptlModifiedOn: new Date(),
        ptlModifiedBy: this.resolveWriteActor(null),
      },
    });
  }

  // ═══ Shared ══════════════════════════════════════════════════════════════

  private async findTemplate(
    client: WriteClient,
    ptlId: string,
    includeDeletedVersions: boolean,
  ): Promise<TemplateWithChildren | null> {
    return client.printTemplate.findFirst({
      where: { ptlId, ptlIsDeleted: false },
      include: {
        ...TEMPLATE_INCLUDE,
        versions: {
          ...(includeDeletedVersions ? {} : { where: { ptvIsDeleted: false } }),
          orderBy: { ptvRevNo: 'desc' },
          include: {
            datasets: { where: { ptdIsDeleted: false }, orderBy: DATASET_ORDER_BY },
          },
        },
      },
    });
  }

  /**
   * ptl_created_by and its siblings are real foreign keys to user_master, so
   * the nil-uuid DEFAULT_ACTOR the older masters fall back to would fail
   * fk_ptl_created_by. NULL is the honest answer when nobody is authenticated,
   * and the columns are nullable for exactly that reason.
   */
  private resolveWriteActor(explicit?: string | null): string | null {
    const value = explicit?.trim();
    if (value) {
      return value;
    }
    return this.requestContextService.getUserId() ?? null;
  }

  private resolveAuditActor(): string {
    return this.requestContextService.getUserId() ?? DEFAULT_AUDIT_ACTOR;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: Extract<AuditAction, 'insert' | 'update' | 'approve' | 'cancel'>,
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
        screenName: PRINT_TEMPLATE_SCREEN_NAME,
        screenType: 'settings',
        pk,
        displayName,
        originalRecord,
        modifiedRecord,
        userId: this.resolveAuditActor(),
        notes,
      },
      tx,
    );
  }

  private throwBadRequest(message: string, errors: PrintTemplateErrorDetail[]): never {
    throwSettingsBadRequest<PrintTemplateErrorDetail, PrintTemplateErrorResponse>(message, errors);
  }

  private throwConflict(message: string, errors: PrintTemplateErrorDetail[]): never {
    throwSettingsConflict<PrintTemplateErrorDetail, PrintTemplateErrorResponse>(message, errors);
  }

  private throwNotFound(field: string, value: string, message: string): never {
    throwSettingsNotFound<PrintTemplateErrorDetail, PrintTemplateErrorResponse>(
      message,
      field,
      `${field} ${value} was not found`,
    );
  }
}

const numberOrNull = (value: Prisma.Decimal | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value.toString());

const numberOr = (value: Prisma.Decimal | null | undefined, fallback: number): number =>
  value === null || value === undefined ? fallback : Number(value.toString());

/** ptv_params is jsonb: null has to reach Prisma as DbNull, not as JS null. */
const toJsonInput = (value: unknown): Prisma.InputJsonValue | typeof Prisma.DbNull =>
  value === null || value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);
