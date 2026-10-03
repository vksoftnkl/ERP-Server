import { Injectable } from '@nestjs/common';
import { Prisma, PrintTemplateAssignment } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import {
  DEFAULT_ACTOR,
  DEFAULT_LIMIT,
  DEFAULT_PAGE,
  applyPresentFields,
  hasOwnProperty,
  isForeignKeyConstraintError,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { SavePrintTemplateAssignmentDto } from './dto/save-print-template-assignment.dto';
import { ListPrintTemplateAssignmentQueryDto } from './dto/list-print-template-assignment-query.dto';
import { ResolvePrintTemplateAssignmentQueryDto } from './dto/resolve-print-template-assignment-query.dto';
import {
  PTA_DEFAULT_OUTPUT_MODE,
  PTA_SCOPE_BY_SPECIFICITY,
  PTA_SHIPPED_TEMPLATE_KEY,
  PtaPrinterSource,
  PtaScope,
} from './print-template-assignment.constants';
import {
  PrintTemplateAssignmentErrorDetail,
  PrintTemplateAssignmentErrorResponse,
  PrintTemplateAssignmentListResult,
  PrintTemplateAssignmentPayload,
  PrintTemplateAssignmentResolution,
} from './types/print-template-assignment-api.types';

const PTA_RELATIONS = {
  company: { select: { compName: true } },
  branch: { select: { brName: true } },
  device: { select: { devDeviceName: true } },
  purpose: { select: { ppoCode: true, ppoName: true, ppoCopyCount: true, ppoCopyLabels: true } },
  template: { select: { ptlCode: true, ptlName: true, ptlPublishedRevId: true } },
  printer: { select: { prfName: true } },
} satisfies Prisma.PrintTemplateAssignmentInclude;

type PrintTemplateAssignmentWithRelations = Prisma.PrintTemplateAssignmentGetPayload<{
  include: typeof PTA_RELATIONS;
}>;

type PrismaTransaction = Prisma.TransactionClient;

const PTA_TABLE_NAME = 'print template assignments';
const PTA_AUDIT_SCREEN_NAME = 'Print Template Assignments';

/// ptaTemplateCompanyKey is NOT here: it is never taken from the caller. The
/// service derives it from the template on every write, which is the only way
/// ck_pta_template_scope can mean anything.
const PTA_OPTIONAL_FIELDS = [
  'ptaCompanyId',
  'ptaBranchId',
  'ptaDeviceId',
  'ptaPurposeId',
  'ptaTemplateId',
  'ptaOutputMode',
  'ptaPrinterId',
  'ptaPrinterName',
  'ptaCopies',
  'ptaRemarks',
  'ptaIsActive',
];

/// ptaCreatedBy / ptaModifiedBy carry a real FK to public.user_master, unlike
/// the varchar actor columns most masters in this codebase use. DEFAULT_ACTOR
/// is the nil uuid and there is no user row with that id, so writing it would
/// fail fk_pta_created_by. An unattributable write stores NULL instead.
function toUserRef(actor: string | null | undefined): string | null {
  if (!actor || actor === DEFAULT_ACTOR) return null;
  return actor;
}

/// A CHECK violation (SQLSTATE 23514). Prisma has no error code for these — the
/// same hole isExclusionConstraintError works around — so the SQLSTATE and the
/// constraint name are readable only inside the driver message. Every check on
/// this table is stated in the service above the write, so reaching here means
/// a path that skipped one; answering 400 with the constraint name beats 500.
function checkConstraintName(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('message' in error)) return null;
  const { message } = error as { message?: unknown };
  if (typeof message !== 'string' || !message.includes('23514')) return null;
  const named = /ck_pta_[a-z_]+/.exec(message);
  return named ? named[0] : 'ck_pta_unknown';
}

@Injectable()
export class PrintTemplateAssignmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async save(dto: SavePrintTemplateAssignmentDto): Promise<PrintTemplateAssignmentPayload> {
    if (dto.ptaId) {
      return this.updateAssignment(dto);
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    return this.createAssignment(dto, userId);
  }

  async createAssignment(
    dto: SavePrintTemplateAssignmentDto,
    userId: string,
  ): Promise<PrintTemplateAssignmentPayload> {
    // "Every company" must be asked for, not arrived at. An omitted company on
    // create would otherwise write the widest rung of the ladder by accident.
    if (!hasOwnProperty(dto, 'ptaCompanyId')) {
      throwSettingsBadRequest<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >('Invalid assignment scope', [
        {
          field: 'ptaCompanyId',
          message:
            'State the company this assignment is for. Send null explicitly to make it the default for EVERY company — which only a shipped design may be.',
        },
      ]);
    }

    const companyId = dto.ptaCompanyId ?? null;
    const branchId = dto.ptaBranchId ?? null;
    const deviceId = dto.ptaDeviceId ?? null;
    const printerId = dto.ptaPrinterId ?? null;
    const printerName = dto.ptaPrinterName ?? null;

    this.assertScopeLadder(companyId, branchId, deviceId);
    this.assertPrinterOneOf(printerId, printerName);

    const actor = resolveActor(dto.ptaCreatedBy, userId);
    const now = new Date();
    const isDeleted = dto.ptaIsActive === false;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const templateCompanyKey = await this.resolveTemplateCompanyKey(
          tx,
          dto.ptaTemplateId,
          companyId,
        );

        const data: Prisma.PrintTemplateAssignmentUncheckedCreateInput = {
          ptaCompanyId: companyId,
          ptaBranchId: branchId,
          ptaDeviceId: deviceId,
          ptaPurposeId: dto.ptaPurposeId,
          ptaTemplateId: dto.ptaTemplateId,
          ptaTemplateCompanyKey: templateCompanyKey,
          ptaOutputMode: dto.ptaOutputMode ?? PTA_DEFAULT_OUTPUT_MODE,
          ptaPrinterId: printerId,
          ptaPrinterName: printerName,
          ptaCopies: dto.ptaCopies ?? null,
          ptaRemarks: dto.ptaRemarks ?? null,
          ptaIsActive: !isDeleted,
          ptaIsDeleted: isDeleted,
          ptaCreatedOn: now,
          ptaCreatedBy: toUserRef(actor),
          ptaModifiedOn: now,
          ptaModifiedBy: toUserRef(actor),
        };

        const created = await tx.printTemplateAssignment.create({
          data,
          include: PTA_RELATIONS,
        });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: PTA_TABLE_NAME,
            screenName: PTA_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ptaId,
            displayName: this.displayName(payload),
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'Print template assignment created',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  async getById(ptaId: string): Promise<PrintTemplateAssignmentPayload> {
    const record = await this.prisma.printTemplateAssignment.findFirst({
      where: { ptaId, ptaIsDeleted: false },
      include: PTA_RELATIONS,
    });

    if (!record) {
      throwSettingsNotFound<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >(
        'Print template assignment not found',
        'ptaId',
        `No active print template assignment found with id ${ptaId}`,
      );
    }

    return this.toPayload(record);
  }

  async list(
    queryDto: ListPrintTemplateAssignmentQueryDto,
  ): Promise<PrintTemplateAssignmentListResult> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.PrintTemplateAssignmentWhereInput = { ptaIsDeleted: false };

    // Company is now three questions, not one: this company's rows, the
    // every-company rows it inherits, or both.
    if (queryDto.globalOnly) {
      where.ptaCompanyId = null;
    } else if (queryDto.ptaCompanyId && queryDto.includeGlobal) {
      where.OR = [{ ptaCompanyId: queryDto.ptaCompanyId }, { ptaCompanyId: null }];
    } else if (queryDto.ptaCompanyId) {
      where.ptaCompanyId = queryDto.ptaCompanyId;
    }

    if (queryDto.ptaBranchId) where.ptaBranchId = queryDto.ptaBranchId;
    if (queryDto.ptaDeviceId) where.ptaDeviceId = queryDto.ptaDeviceId;
    if (queryDto.ptaPurposeId) where.ptaPurposeId = queryDto.ptaPurposeId;
    if (queryDto.ptaTemplateId) where.ptaTemplateId = queryDto.ptaTemplateId;
    if (queryDto.ptaOutputMode) where.ptaOutputMode = queryDto.ptaOutputMode;
    if (queryDto.ptaIsActive !== undefined) where.ptaIsActive = queryDto.ptaIsActive;

    if (queryDto.search) {
      const search = queryDto.search;
      // AND-ed with the company clause above rather than replacing it: `OR` is
      // one property, so a search on an includeGlobal list must nest.
      const searchOr: Prisma.PrintTemplateAssignmentWhereInput[] = [
        { template: { ptlCode: { contains: search, mode: 'insensitive' } } },
        { template: { ptlName: { contains: search, mode: 'insensitive' } } },
        { purpose: { ppoCode: { contains: search, mode: 'insensitive' } } },
        { purpose: { ppoName: { contains: search, mode: 'insensitive' } } },
        { ptaPrinterName: { contains: search, mode: 'insensitive' } },
        { ptaRemarks: { contains: search, mode: 'insensitive' } },
      ];
      if (where.OR) {
        where.AND = [{ OR: where.OR }, { OR: searchOr }];
        delete where.OR;
      } else {
        where.OR = searchOr;
      }
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.printTemplateAssignment.findMany({
        where,
        include: PTA_RELATIONS,
        // Narrowest first, so the list reads in the order the resolver walks.
        orderBy: [{ ptaSpecificity: 'desc' }, { ptaCreatedOn: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.printTemplateAssignment.count({ where }),
    ]);

    return { items: items.map((item) => this.toPayload(item)), page, limit, total };
  }

  /// NARROWEST WINS: counter -> branch -> company -> every company.
  ///
  /// One indexed query, not four: every candidate row for the scope is fetched
  /// and ordered by ptaSpecificity DESC, which is exactly what ix_pta_resolve
  /// is built for — it leads with COALESCE(pta_company_id, nil) so that this
  /// company's rows and the global ones come back in one index scan. The ladder
  /// is data — the database derives ptaSpecificity — so this method cannot
  /// invent a different one.
  async resolve(
    queryDto: ResolvePrintTemplateAssignmentQueryDto,
  ): Promise<PrintTemplateAssignmentResolution> {
    const outputMode = queryDto.outputMode ?? PTA_DEFAULT_OUTPUT_MODE;
    const branchId = queryDto.branchId ?? null;
    const deviceId = queryDto.deviceId ?? null;

    const winner = await this.prisma.printTemplateAssignment.findFirst({
      where: {
        ptaPurposeId: queryDto.purposeId,
        ptaOutputMode: outputMode,
        ptaIsActive: true,
        ptaIsDeleted: false,
        // A row is a candidate when its scope is NULL (applies to everything)
        // or matches the caller exactly. Anything else belongs to a sibling
        // company, branch or counter and must not be considered.
        AND: [
          { OR: [{ ptaCompanyId: null }, { ptaCompanyId: queryDto.companyId }] },
          { OR: [{ ptaBranchId: null }, ...(branchId ? [{ ptaBranchId: branchId }] : [])] },
          { OR: [{ ptaDeviceId: null }, ...(deviceId ? [{ ptaDeviceId: deviceId }] : [])] },
        ],
      },
      include: PTA_RELATIONS,
      orderBy: [{ ptaSpecificity: 'desc' }, { ptaCreatedOn: 'desc' }],
    });

    if (!winner) {
      throwSettingsNotFound<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >(
        'No print template assigned for this scope',
        'purposeId',
        `No active assignment resolves for company ${queryDto.companyId}, purpose ${queryDto.purposeId}, output mode ${outputMode} — not at the counter, the branch, the company, nor as an every-company default`,
      );
    }

    // The assignment overrides the purpose's copy count; NULL means use it.
    const copies = winner.ptaCopies ?? winner.purpose?.ppoCopyCount ?? 1;
    const copyLabels = (winner.purpose?.ppoCopyLabels ?? '')
      .split(',')
      .map((label) => label.trim())
      .filter((label) => label.length > 0);

    // ck_pta_printer_one_of guarantees at most one of the two is set, so this
    // reads as a ladder rather than a precedence rule.
    const printerSource: PtaPrinterSource = winner.ptaPrinterId
      ? 'PROFILE'
      : winner.ptaPrinterName
        ? 'NAME'
        : 'DEFAULT';

    return {
      ptaId: winner.ptaId,
      ptaSpecificity: winner.ptaSpecificity,
      scope: this.toScope(winner.ptaSpecificity),
      ptaTemplateId: winner.ptaTemplateId,
      ptaTemplateCode: winner.template?.ptlCode ?? null,
      ptaTemplateName: winner.template?.ptlName ?? null,
      ptaTemplateIsShipped: winner.ptaTemplateCompanyKey === PTA_SHIPPED_TEMPLATE_KEY,
      publishedRevId: winner.template?.ptlPublishedRevId ?? null,
      ptaPrinterId: winner.ptaPrinterId,
      ptaPrinterName:
        printerSource === 'PROFILE' ? (winner.printer?.prfName ?? null) : winner.ptaPrinterName,
      printerSource,
      ptaOutputMode: winner.ptaOutputMode,
      copies,
      copyLabels,
    };
  }

  async softDelete(ptaId: string): Promise<{ ptaId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.printTemplateAssignment.findFirst({
        where: { ptaId, ptaIsDeleted: false },
        include: PTA_RELATIONS,
      });

      if (!existing) {
        throwSettingsNotFound<
          PrintTemplateAssignmentErrorDetail,
          PrintTemplateAssignmentErrorResponse
        >(
          'Print template assignment not found',
          'ptaId',
          `No active print template assignment found with id ${ptaId}`,
        );
      }

      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const modifiedOn = new Date();

      const result = await tx.printTemplateAssignment.updateMany({
        where: { ptaId, ptaIsDeleted: false },
        data: {
          ptaIsDeleted: true,
          ptaIsActive: false,
          ptaModifiedOn: modifiedOn,
          ptaModifiedBy: toUserRef(actor),
        },
      });

      if (result.count === 0) {
        throwSettingsNotFound<
          PrintTemplateAssignmentErrorDetail,
          PrintTemplateAssignmentErrorResponse
        >(
          'Print template assignment not found',
          'ptaId',
          `No active print template assignment found with id ${ptaId}`,
        );
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ptaIsDeleted: true,
        ptaIsActive: false,
        ptaModifiedOn: modifiedOn,
        ptaModifiedBy: toUserRef(actor),
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: PTA_TABLE_NAME,
          screenName: PTA_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ptaId,
          displayName: this.displayName(originalRecord),
          originalRecord,
          modifiedRecord,
          userId: actor,
          notes: 'Print template assignment soft deleted',
        },
        tx,
      );

      return { ptaId, deleted: true };
    });
  }

  private async updateAssignment(
    dto: SavePrintTemplateAssignmentDto,
  ): Promise<PrintTemplateAssignmentPayload> {
    const ptaId = dto.ptaId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.printTemplateAssignment.findFirst({
          where: { ptaId, ptaIsDeleted: false },
          include: PTA_RELATIONS,
        });

        if (!existing) {
          throwSettingsNotFound<
            PrintTemplateAssignmentErrorDetail,
            PrintTemplateAssignmentErrorResponse
          >(
            'Print template assignment not found',
            'ptaId',
            `No active print template assignment found with id ${ptaId}`,
          );
        }

        // Validate against the MERGED row, not the patch: a request that clears
        // the branch while leaving a device in place — or that moves the row to
        // "every company" while a branch stays named — is only visible once the
        // two are combined.
        const merged = {
          companyId: hasOwnProperty(dto, 'ptaCompanyId')
            ? (dto.ptaCompanyId ?? null)
            : existing.ptaCompanyId,
          branchId: hasOwnProperty(dto, 'ptaBranchId')
            ? (dto.ptaBranchId ?? null)
            : existing.ptaBranchId,
          deviceId: hasOwnProperty(dto, 'ptaDeviceId')
            ? (dto.ptaDeviceId ?? null)
            : existing.ptaDeviceId,
          printerId: hasOwnProperty(dto, 'ptaPrinterId')
            ? (dto.ptaPrinterId ?? null)
            : existing.ptaPrinterId,
          printerName: hasOwnProperty(dto, 'ptaPrinterName')
            ? (dto.ptaPrinterName ?? null)
            : existing.ptaPrinterName,
          templateId: dto.ptaTemplateId ?? existing.ptaTemplateId,
        };

        this.assertScopeLadder(merged.companyId, merged.branchId, merged.deviceId);
        this.assertPrinterOneOf(merged.printerId, merged.printerName);

        const data: Prisma.PrintTemplateAssignmentUncheckedUpdateInput = {
          ptaModifiedOn: new Date(),
          ptaModifiedBy: toUserRef(
            resolveActor(dto.ptaModifiedBy, this.requestContextService.getUserId()),
          ),
        };
        applyPresentFields(data, dto, PTA_OPTIONAL_FIELDS);

        // Re-derived on EVERY update, not only when the template changes:
        // moving the row to another company (or to "every company") re-asks the
        // cross-company question of a template that has not moved at all.
        data.ptaTemplateCompanyKey = await this.resolveTemplateCompanyKey(
          tx,
          merged.templateId,
          merged.companyId,
        );

        const updated = await tx.printTemplateAssignment.update({
          where: { ptaId },
          data,
          include: PTA_RELATIONS,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: PTA_TABLE_NAME,
            screenName: PTA_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ptaId,
            displayName: this.displayName(payload),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.ptaModifiedBy ?? DEFAULT_ACTOR,
            notes: 'Print template assignment updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  /// ck_pta_template_scope, stated in the service so the caller gets a
  /// field-level message instead of a raw constraint violation — and so that
  /// pta_template_company_key is never taken from the caller. A caller free to
  /// state the template's owner is a caller free to state the wrong one, and
  /// the whole lock rests on that column being true.
  private async resolveTemplateCompanyKey(
    tx: PrismaTransaction,
    templateId: string,
    companyId: string | null,
  ): Promise<string> {
    const template = await tx.printTemplate.findFirst({
      where: { ptlId: templateId, ptlIsDeleted: false },
      select: { ptlCode: true, ptlCompanyId: true, ptlCompanyKey: true },
    });

    if (!template) {
      throwSettingsBadRequest<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >('Invalid relation reference', [
        {
          field: 'ptaTemplateId',
          message: `No active print template found with id ${templateId}`,
        },
      ]);
    }

    // ptl_company_key is GENERATED ALWAYS and cannot be null in the database;
    // the fallback is here only because Prisma types a generated column as
    // optional, and it recomputes the same COALESCE the column itself uses.
    const templateKey = template.ptlCompanyKey ?? template.ptlCompanyId ?? PTA_SHIPPED_TEMPLATE_KEY;
    const scopeKey = companyId ?? PTA_SHIPPED_TEMPLATE_KEY;

    if (templateKey !== PTA_SHIPPED_TEMPLATE_KEY && templateKey !== scopeKey) {
      throwSettingsBadRequest<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >('Invalid assignment scope', [
        {
          field: 'ptaTemplateId',
          message:
            companyId === null
              ? `An assignment for EVERY company may only name a design that ships with the product. Template ${template.ptlCode} is private to company ${templateKey} — every other company's till would otherwise render it.`
              : `Template ${template.ptlCode} is private to company ${templateKey} and cannot be assigned by company ${companyId}. Fork it first, then assign the fork.`,
        },
      ]);
    }

    return templateKey;
  }

  /// ck_pta_device_needs_branch and ck_pta_branch_needs_company, stated in the
  /// service so the caller gets a field-level message instead of a raw
  /// constraint violation. A counter belongs to a branch and a branch belongs
  /// to a company, so either gap is a rung of the ladder nobody can reach.
  private assertScopeLadder(
    companyId: string | null,
    branchId: string | null,
    deviceId: string | null,
  ): void {
    if (deviceId && !branchId) {
      throwSettingsBadRequest<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >('Invalid assignment scope', [
        {
          field: 'ptaBranchId',
          message:
            'A counter-scoped assignment must also name its branch: a counter belongs to a branch, so a device row with no branch is a rung of the ladder nobody can reach.',
        },
      ]);
    }

    if (branchId && !companyId) {
      throwSettingsBadRequest<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >('Invalid assignment scope', [
        {
          field: 'ptaCompanyId',
          message:
            'A branch-scoped assignment must also name its company: a branch belongs to a company, so an every-company row that names a branch is a rung of the ladder nobody can reach.',
        },
      ]);
    }
  }

  /// ck_pta_printer_one_of. One answer, or none. Never two.
  private assertPrinterOneOf(printerId: string | null, printerName: string | null): void {
    if (printerId && printerName) {
      throwSettingsBadRequest<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >('Invalid printer selection', [
        {
          field: 'ptaPrinterName',
          message:
            'Give the registered profile OR the bare queue name, not both. The bare name is a fallback for a printer nobody has registered — it is never a copy of a profile name, because it goes stale the day the profile is renamed.',
        },
      ]);
    }
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<
      PrintTemplateAssignmentErrorDetail,
      PrintTemplateAssignmentErrorResponse
    >(error, 'An assignment already exists for this scope', [
      {
        field: 'ptaPurposeId',
        message:
          "One choice per (company, branch, counter, purpose, output mode) — and the every-company row counts as its own scope. Update the existing assignment instead of adding a second: default-ness is the row's existence, so there is no flag to clear.",
      },
    ]);

    if (isForeignKeyConstraintError(error)) {
      throwSettingsBadRequest<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >('Invalid relation reference', [
        {
          field: 'request',
          message:
            'Referenced company, branch, counter, purpose, template or printer profile does not exist',
        },
      ]);
    }

    const constraint = checkConstraintName(error);
    if (constraint) {
      throwSettingsBadRequest<
        PrintTemplateAssignmentErrorDetail,
        PrintTemplateAssignmentErrorResponse
      >('Invalid assignment', [
        {
          field: 'request',
          message: `The database refused this row: ${constraint}`,
        },
      ]);
    }
  }

  private displayName(payload: PrintTemplateAssignmentPayload): string {
    const purpose = payload.ptaPurposeCode ?? payload.ptaPurposeId;
    const template = payload.ptaTemplateCode ?? payload.ptaTemplateId;
    return `${payload.ptaScope}: ${purpose} -> ${template} (${payload.ptaOutputMode})`;
  }

  /// ptaSpecificity read as a word. The database derives the number; this only
  /// names it, and the fallback is GLOBAL because 0 is the widest rung.
  private toScope(specificity: number | null): PtaScope {
    return (
      PTA_SCOPE_BY_SPECIFICITY[specificity as keyof typeof PTA_SCOPE_BY_SPECIFICITY] ?? 'GLOBAL'
    );
  }

  private toPayload(
    record: PrintTemplateAssignment | PrintTemplateAssignmentWithRelations,
  ): PrintTemplateAssignmentPayload {
    return {
      ptaId: record.ptaId,
      ptaCompanyId: record.ptaCompanyId,
      ptaCompanyName: 'company' in record ? (record.company?.compName ?? null) : null,
      ptaBranchId: record.ptaBranchId,
      ptaBranchName: 'branch' in record ? (record.branch?.brName ?? null) : null,
      ptaDeviceId: record.ptaDeviceId,
      ptaDeviceName: 'device' in record ? (record.device?.devDeviceName ?? null) : null,
      ptaPurposeId: record.ptaPurposeId,
      ptaPurposeCode: 'purpose' in record ? (record.purpose?.ppoCode ?? null) : null,
      ptaPurposeName: 'purpose' in record ? (record.purpose?.ppoName ?? null) : null,
      ptaTemplateId: record.ptaTemplateId,
      ptaTemplateCode: 'template' in record ? (record.template?.ptlCode ?? null) : null,
      ptaTemplateName: 'template' in record ? (record.template?.ptlName ?? null) : null,
      ptaTemplateCompanyKey: record.ptaTemplateCompanyKey,
      ptaTemplateIsShipped: record.ptaTemplateCompanyKey === PTA_SHIPPED_TEMPLATE_KEY,
      ptaOutputMode: record.ptaOutputMode,
      ptaPrinterId: record.ptaPrinterId,
      ptaPrinterName: record.ptaPrinterName,
      ptaPrinterProfileName: 'printer' in record ? (record.printer?.prfName ?? null) : null,
      ptaCopies: record.ptaCopies,
      ptaSpecificity: record.ptaSpecificity,
      ptaScope: this.toScope(record.ptaSpecificity),
      ptaRemarks: record.ptaRemarks,
      ptaIsActive: record.ptaIsActive,
      ptaIsDeleted: record.ptaIsDeleted,
      ptaSyncDate: record.ptaSyncDate ? record.ptaSyncDate.toISOString() : null,
      ptaCreatedOn: record.ptaCreatedOn.toISOString(),
      ptaCreatedBy: record.ptaCreatedBy,
      ptaModifiedOn: record.ptaModifiedOn ? record.ptaModifiedOn.toISOString() : null,
      ptaModifiedBy: record.ptaModifiedBy,
    };
  }
}
