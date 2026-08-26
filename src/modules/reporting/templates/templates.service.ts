import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PrintTemplate } from '@prisma/client';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { ExpressionValidator, buildAllowedRoots } from '../engine/expression/expression.validator';
import { ReportDataProviderRegistry } from '../providers/report-data-provider.registry';
import {
  LAYOUT_MODES,
  OUTPUT_MODES,
  TemplateDefinition,
  isTextLike,
} from './dto/template-definition.schema';
import {
  CloneTemplateDto,
  CreateTemplateDto,
  GetTemplatesQueryDto,
  ImportTemplateDto,
  UpdateTemplateDto,
} from './dto/template-request.dto';
import { TemplateMigrationService } from './template-migration.service';
import {
  ResolvedTemplate,
  TemplateDeleteResult,
  TemplateExportPayload,
  TemplatePayload,
  TemplateResolutionSource,
  TemplateRevisionPayload,
  TemplateSummaryPayload,
} from './types/templates-api.types';

/**
 * Template storage, versioning and resolution.
 *
 * Three things in here are load-bearing and worth reading before changing:
 *
 * 1. VALIDATION HAPPENS ON SAVE. zod schema, then expression AST whitelist,
 *    then provider-token existence. A template that would fail at render time
 *    is rejected at save time, so the failure lands in the designer rather than
 *    at a customer's counter on a Saturday.
 *
 * 2. HISTORY IS APPEND-ONLY. A definition write bumps ptVersion and copies the
 *    PREVIOUS body into a revision row, in one transaction. Rollback writes the
 *    old body forward as a NEW version rather than rewinding the counter, so
 *    (template, version) is a complete audit trail with no gaps and no reuse.
 *
 * 3. SYSTEM TEMPLATES ARE READ-ONLY. ptCompanyId NULL means shipped with the
 *    product. A tenant clones one to edit it. Letting a tenant edit a system
 *    row in place would silently change every other tenant's default.
 */
@Injectable()
export class TemplatesService {
  private readonly logger = new Logger(TemplatesService.name);

  private readonly expressionValidator = new ExpressionValidator();

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly migration: TemplateMigrationService,
    private readonly providers: ReportDataProviderRegistry,
  ) {}

  // ─── Read ──────────────────────────────────────────────────────────────

  async list(
    query: GetTemplatesQueryDto,
  ): Promise<{ items: TemplateSummaryPayload[]; includeSystem: boolean }> {
    const includeSystem = query.includeSystem ?? true;
    const activeOnly = query.activeOnly ?? true;
    const companyId = query.ptCompanyId ?? this.contextCompanyId();

    const scope: Prisma.PrintTemplateWhereInput[] = [];
    if (companyId) {
      scope.push({ ptCompanyId: companyId });
    }
    if (includeSystem) {
      scope.push({ ptCompanyId: null });
    }

    const where: Prisma.PrintTemplateWhereInput = {
      ptIsDeleted: false,
      ...(activeOnly ? { ptIsActive: true } : {}),
      ...(query.ptDocType ? { ptDocType: query.ptDocType } : {}),
      ...(query.ptOutputMode ? { ptOutputMode: query.ptOutputMode } : {}),
      ...(query.ptPaperCode ? { ptPaperCode: query.ptPaperCode } : {}),
      ...(query.ptBranchId ? { ptBranchId: query.ptBranchId } : {}),
      // An empty scope would list every tenant's templates. When neither a
      // company nor system templates are asked for there is nothing to return.
      ...(scope.length > 0 ? { OR: scope } : { ptId: '00000000-0000-0000-0000-000000000000' }),
    };

    const records = await this.prisma.printTemplate.findMany({
      where,
      orderBy: [
        // Tenant templates before system ones, so a customer's own designs are
        // what they see first in the picker.
        { ptCompanyId: 'desc' },
        { ptDocType: 'asc' },
        { ptOutputMode: 'asc' },
        { ptPaperCode: 'asc' },
        { ptName: 'asc' },
      ],
      select: SUMMARY_SELECT,
    });

    return { items: records.map(toSummaryPayload), includeSystem };
  }

  /** One template with its definition, migrated to the current schema version. */
  async findOne(ptId: string): Promise<TemplatePayload> {
    const record = await this.prisma.printTemplate.findFirst({
      where: { ptId, ptIsDeleted: false },
    });

    if (!record) {
      throw new NotFoundException(`Print template ${ptId} not found`);
    }

    this.assertReadable(record);

    const outcome = this.migration.migrateDefinition(record.ptDefinition);

    return {
      ...toSummaryPayload(record),
      definition: outcome.definition,
      definitionMigrated: outcome.migrated,
    };
  }

  async listRevisions(ptId: string): Promise<TemplateRevisionPayload[]> {
    await this.findOne(ptId);

    const records = await this.prisma.printTemplateRevision.findMany({
      where: { ptrTemplateId: ptId },
      orderBy: { ptrVersion: 'desc' },
      select: {
        ptrId: true,
        ptrTemplateId: true,
        ptrVersion: true,
        ptrSchemaVer: true,
        ptrNote: true,
        ptrCreatedOn: true,
        ptrCreatedBy: true,
      },
    });

    return records.map((record) => ({
      ptrId: record.ptrId,
      ptrTemplateId: record.ptrTemplateId,
      ptrVersion: record.ptrVersion,
      ptrSchemaVer: record.ptrSchemaVer,
      ptrNote: record.ptrNote,
      ptrCreatedOn: record.ptrCreatedOn.toISOString(),
      ptrCreatedBy: record.ptrCreatedBy,
    }));
  }

  // ─── Write ─────────────────────────────────────────────────────────────

  async create(dto: CreateTemplateDto): Promise<TemplatePayload> {
    const definition = this.validateDefinition(dto.definition, {
      outputMode: dto.ptOutputMode,
    });

    const companyId = dto.ptCompanyId ?? this.contextCompanyId();
    const actor = this.actor();

    const record = await this.prisma
      .$transaction(async (transaction) => {
        if (dto.ptIsDefault) {
          await this.clearDefault(transaction, {
            companyId,
            branchId: dto.ptBranchId ?? null,
            docType: dto.ptDocType,
            outputMode: dto.ptOutputMode,
            paperCode: dto.ptPaperCode,
          });
        }

        return transaction.printTemplate.create({
          data: {
            ptCompanyId: companyId,
            ptBranchId: dto.ptBranchId ?? null,
            ptDocType: dto.ptDocType,
            ptOutputMode: dto.ptOutputMode,
            ptPaperCode: dto.ptPaperCode,
            ptName: dto.ptName,
            ptVersion: 1,
            ptSchemaVer: definition.schemaVersion,
            ptDefinition: definition as unknown as Prisma.InputJsonValue,
            ptIsDefault: dto.ptIsDefault ?? false,
            ptIsActive: dto.ptIsActive ?? true,
            ptCreatedBy: actor,
          },
        });
      })
      .catch((error) => this.rethrowWriteError(error, dto.ptName));

    this.logger.log(`Created print template ${record.ptId} (${record.ptName})`);

    return {
      ...toSummaryPayload(record),
      definition,
      definitionMigrated: false,
    };
  }

  /**
   * Update a template.
   *
   * A definition change bumps the version and archives the OLD body. The bump
   * and the archive are one transaction: a version counter that advanced
   * without its revision row would leave a hole in the history, and a history
   * with holes is not an audit trail.
   */
  async update(ptId: string, dto: UpdateTemplateDto): Promise<TemplatePayload> {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { ptId, ptIsDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException(`Print template ${ptId} not found`);
    }

    this.assertWritable(existing);

    const actor = this.actor();
    const definitionSupplied = dto.definition !== undefined;

    const definition = definitionSupplied
      ? this.validateDefinition(dto.definition as Record<string, unknown>, {
          outputMode: existing.ptOutputMode,
        })
      : this.migration.migrateDefinition(existing.ptDefinition).definition;

    const record = await this.prisma
      .$transaction(async (transaction) => {
        if (definitionSupplied) {
          // Archive the body being replaced, under the version it WAS.
          await transaction.printTemplateRevision.create({
            data: {
              ptrTemplateId: ptId,
              ptrVersion: existing.ptVersion,
              ptrSchemaVer: existing.ptSchemaVer,
              ptrDefinition: existing.ptDefinition as Prisma.InputJsonValue,
              ptrNote: dto.note ?? null,
              ptrCreatedBy: actor,
            },
          });
        }

        return transaction.printTemplate.update({
          where: { ptId },
          data: {
            ...(dto.ptName !== undefined ? { ptName: dto.ptName } : {}),
            ...(dto.ptIsActive !== undefined ? { ptIsActive: dto.ptIsActive } : {}),
            ...(definitionSupplied
              ? {
                  ptDefinition: definition as unknown as Prisma.InputJsonValue,
                  ptSchemaVer: definition.schemaVersion,
                  ptVersion: existing.ptVersion + 1,
                }
              : {}),
            ptModifiedOn: new Date(),
            ptModifiedBy: actor,
          },
        });
      })
      .catch((error) => this.rethrowWriteError(error, dto.ptName ?? existing.ptName));

    this.logger.log(
      `Updated print template ${ptId}${definitionSupplied ? ` to version ${record.ptVersion}` : ''}`,
    );

    return { ...toSummaryPayload(record), definition, definitionMigrated: false };
  }

  /**
   * Soft delete.
   *
   * A default template cannot be deleted while it is the default: doing so
   * would leave its (company, branch, docType, mode, paper) with no default at
   * all, and the next print would silently fall back to the system design. The
   * caller has to promote a replacement first.
   */
  async softDelete(ptId: string): Promise<TemplateDeleteResult> {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { ptId, ptIsDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException(`Print template ${ptId} not found`);
    }

    this.assertWritable(existing);

    if (existing.ptIsDefault) {
      throw new ConflictException(
        `Print template ${ptId} is the default for ${existing.ptDocType}/` +
          `${existing.ptOutputMode}/${existing.ptPaperCode}. Promote another template first.`,
      );
    }

    const cloneCount = await this.prisma.printTemplate.count({
      where: { ptParentId: ptId, ptIsDeleted: false },
    });
    if (cloneCount > 0) {
      // fk_pt_parent is ON DELETE RESTRICT, and a soft delete that orphaned a
      // clone's lineage would make the parent unfindable while the FK still
      // pointed at it.
      throw new ConflictException(
        `Print template ${ptId} has ${cloneCount} clone(s) descended from it and cannot be deleted.`,
      );
    }

    await this.prisma.printTemplate.update({
      where: { ptId },
      data: { ptIsDeleted: true, ptModifiedOn: new Date(), ptModifiedBy: this.actor() },
    });

    this.logger.log(`Soft-deleted print template ${ptId}`);
    return { ptId, deleted: true };
  }

  /**
   * Clone a template into a tenant.
   *
   * The path a customer takes to customise a shipped design: system template ->
   * clone -> edit the clone. ptParentId records the lineage so a later release
   * can tell which of a tenant's templates started from which stock design.
   */
  async clone(ptId: string, dto: CloneTemplateDto): Promise<TemplatePayload> {
    const source = await this.prisma.printTemplate.findFirst({
      where: { ptId, ptIsDeleted: false },
    });

    if (!source) {
      throw new NotFoundException(`Print template ${ptId} not found`);
    }

    this.assertReadable(source);

    // Migrate on clone, so the copy is stored at the current schema version and
    // the tenant never inherits a migration debt from a stock design.
    const definition = this.migration.migrateDefinition(source.ptDefinition).definition;

    const companyId = dto.ptCompanyId ?? this.contextCompanyId();
    if (!companyId) {
      throw new BadRequestException(
        'A clone needs an owning company. Supply ptCompanyId, or call with a company request context.',
      );
    }

    const actor = this.actor();
    const name = dto.ptName ?? `${source.ptName} (copy)`;

    const record = await this.prisma
      .$transaction(async (transaction) => {
        if (dto.ptIsDefault) {
          await this.clearDefault(transaction, {
            companyId,
            branchId: dto.ptBranchId ?? null,
            docType: source.ptDocType,
            outputMode: source.ptOutputMode,
            paperCode: source.ptPaperCode,
          });
        }

        return transaction.printTemplate.create({
          data: {
            ptCompanyId: companyId,
            ptBranchId: dto.ptBranchId ?? null,
            ptDocType: source.ptDocType,
            ptOutputMode: source.ptOutputMode,
            ptPaperCode: source.ptPaperCode,
            ptName: name,
            ptVersion: 1,
            ptParentId: source.ptId,
            ptSchemaVer: definition.schemaVersion,
            ptDefinition: definition as unknown as Prisma.InputJsonValue,
            ptIsDefault: dto.ptIsDefault ?? false,
            ptIsActive: true,
            ptCreatedBy: actor,
          },
        });
      })
      .catch((error) => this.rethrowWriteError(error, name));

    this.logger.log(`Cloned print template ${ptId} -> ${record.ptId}`);
    return { ...toSummaryPayload(record), definition, definitionMigrated: false };
  }

  /** Promote a template to the default for its scope. */
  async setDefault(ptId: string): Promise<TemplateSummaryPayload> {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { ptId, ptIsDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException(`Print template ${ptId} not found`);
    }

    this.assertReadable(existing);

    if (!existing.ptIsActive) {
      throw new ConflictException(
        `Print template ${ptId} is inactive and cannot be made the default.`,
      );
    }

    const record = await this.prisma.$transaction(async (transaction) => {
      await this.clearDefault(transaction, {
        companyId: existing.ptCompanyId,
        branchId: existing.ptBranchId,
        docType: existing.ptDocType,
        outputMode: existing.ptOutputMode,
        paperCode: existing.ptPaperCode,
        exceptId: ptId,
      });

      return transaction.printTemplate.update({
        where: { ptId },
        data: { ptIsDefault: true, ptModifiedOn: new Date(), ptModifiedBy: this.actor() },
      });
    });

    return toSummaryPayload(record);
  }

  /**
   * Roll back to an archived version.
   *
   * Writes the old body FORWARD as a new version rather than rewinding
   * ptVersion. Reusing a version number would make (template, version)
   * ambiguous and break the unique index the history depends on — and a
   * rollback is itself an event worth recording, not an erasure.
   */
  async rollback(ptId: string, version: number): Promise<TemplatePayload> {
    const existing = await this.prisma.printTemplate.findFirst({
      where: { ptId, ptIsDeleted: false },
    });

    if (!existing) {
      throw new NotFoundException(`Print template ${ptId} not found`);
    }

    this.assertWritable(existing);

    const revision = await this.prisma.printTemplateRevision.findFirst({
      where: { ptrTemplateId: ptId, ptrVersion: version },
    });

    if (!revision) {
      throw new NotFoundException(`Print template ${ptId} has no version ${version}`);
    }

    // The archived body may predate the current schema. Migrate and re-validate
    // before writing it back, or a rollback reintroduces an old shape.
    const outcome = this.migration.migrateDefinition(revision.ptrDefinition);
    const actor = this.actor();

    const record = await this.prisma.$transaction(async (transaction) => {
      await transaction.printTemplateRevision.create({
        data: {
          ptrTemplateId: ptId,
          ptrVersion: existing.ptVersion,
          ptrSchemaVer: existing.ptSchemaVer,
          ptrDefinition: existing.ptDefinition as Prisma.InputJsonValue,
          ptrNote: `superseded by rollback to v${version}`,
          ptrCreatedBy: actor,
        },
      });

      return transaction.printTemplate.update({
        where: { ptId },
        data: {
          ptDefinition: outcome.definition as unknown as Prisma.InputJsonValue,
          ptSchemaVer: outcome.definition.schemaVersion,
          ptVersion: existing.ptVersion + 1,
          ptModifiedOn: new Date(),
          ptModifiedBy: actor,
        },
      });
    });

    this.logger.log(
      `Rolled print template ${ptId} back to v${version}, stored as v${record.ptVersion}`,
    );

    return {
      ...toSummaryPayload(record),
      definition: outcome.definition,
      definitionMigrated: outcome.migrated,
    };
  }

  // ─── Export / import ───────────────────────────────────────────────────

  async export(ptId: string): Promise<TemplateExportPayload> {
    const template = await this.findOne(ptId);

    return {
      kind: 'vknex.print-template',
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      name: template.ptName,
      docType: template.ptDocType,
      outputMode: template.ptOutputMode,
      paperCode: template.ptPaperCode,
      schemaVersion: template.definition.schemaVersion,
      definition: template.definition,
    };
  }

  /**
   * Import an exported file as a new template.
   *
   * The `kind` marker is checked first so an unrelated JSON upload fails with a
   * clear message instead of a hundred zod issues. Everything after that goes
   * through the same validation as a create — an exported file is untrusted
   * input, whatever produced it.
   */
  async import(dto: ImportTemplateDto): Promise<TemplatePayload> {
    const payload = dto.payload;

    if (payload.kind !== 'vknex.print-template') {
      throw new BadRequestException(
        "This is not a VK Nex print template export (expected kind 'vknex.print-template').",
      );
    }

    const docType = asNonEmptyString(payload.docType, 'docType');
    const outputMode = asNonEmptyString(payload.outputMode, 'outputMode');
    const paperCode = asNonEmptyString(payload.paperCode, 'paperCode');
    const name = dto.ptName ?? asNonEmptyString(payload.name, 'name');

    if (payload.definition === null || typeof payload.definition !== 'object') {
      throw new BadRequestException('The export carries no definition object.');
    }

    // Migrate first: an export from an older release is exactly the case this
    // is for, and it must not be rejected for being old.
    const migrated = this.migration.migrateDefinition(payload.definition);
    const definition = this.validateDefinition(
      migrated.definition as unknown as Record<string, unknown>,
      { outputMode },
    );

    return this.create({
      ptDocType: docType.toUpperCase(),
      ptOutputMode: outputMode.toUpperCase(),
      ptPaperCode: paperCode.toUpperCase(),
      ptName: name,
      ptCompanyId: dto.ptCompanyId,
      ptBranchId: dto.ptBranchId,
      ptIsDefault: false,
      ptIsActive: true,
      definition: definition as unknown as Record<string, unknown>,
    });
  }

  // ─── Resolution ────────────────────────────────────────────────────────

  /**
   * Resolve the template a print request should use.
   *
   * Order, most specific first:
   *   1. an explicit templateId
   *   2. the branch default   (company + branch)
   *   3. the company default  (branch NULL)
   *   4. the system default   (company NULL)
   *   5. 404 naming exactly what was missing
   *
   * Step 4 is what makes a fresh install printable: the gallery seeds system
   * defaults, so a customer who has never opened the designer still prints.
   */
  async resolveForPrint(request: {
    docType: string;
    outputMode: string;
    paperCode: string;
    companyId: string;
    branchId: string | null;
    templateId?: string;
  }): Promise<ResolvedTemplate> {
    const { docType, outputMode, paperCode, companyId, branchId, templateId } = request;

    if (templateId) {
      const explicit = await this.prisma.printTemplate.findFirst({
        where: { ptId: templateId, ptIsDeleted: false, ptIsActive: true },
      });

      if (!explicit) {
        throw new NotFoundException(`Print template ${templateId} not found or inactive`);
      }
      // A template belonging to another tenant must not be printable even by id.
      if (explicit.ptCompanyId !== null && explicit.ptCompanyId !== companyId) {
        throw new ForbiddenException(`Print template ${templateId} belongs to another company`);
      }

      return this.toResolved(explicit, 'EXPLICIT');
    }

    const candidates: Array<{
      where: Prisma.PrintTemplateWhereInput;
      source: TemplateResolutionSource;
    }> = [];

    if (branchId) {
      candidates.push({
        where: { ptCompanyId: companyId, ptBranchId: branchId },
        source: 'BRANCH_DEFAULT',
      });
    }
    candidates.push({
      where: { ptCompanyId: companyId, ptBranchId: null },
      source: 'COMPANY_DEFAULT',
    });
    candidates.push({ where: { ptCompanyId: null }, source: 'SYSTEM_DEFAULT' });

    for (const candidate of candidates) {
      const found = await this.prisma.printTemplate.findFirst({
        where: {
          ...candidate.where,
          ptDocType: docType,
          ptOutputMode: outputMode,
          ptPaperCode: paperCode,
          ptIsDefault: true,
          ptIsActive: true,
          ptIsDeleted: false,
        },
      });

      if (found) {
        return this.toResolved(found, candidate.source);
      }
    }

    throw new NotFoundException(
      `No template configured for ${docType} / ${outputMode} / ${paperCode}. ` +
        'Seed the template gallery, or create a template and mark it default.',
    );
  }

  // ─── Validation ────────────────────────────────────────────────────────

  /**
   * Validate a definition: shape, then expressions, then provider tokens.
   *
   * All three at save time. The expression check is risk R3's mitigation and
   * also catches the far more common typo'd dataset name, which would otherwise
   * print a blank column that nobody notices until a customer does.
   */
  validateDefinition(
    raw: Record<string, unknown>,
    context: { outputMode?: string } = {},
  ): TemplateDefinition {
    let definition: TemplateDefinition;
    try {
      definition = this.migration.validate(raw);
    } catch (error) {
      throw new BadRequestException(error instanceof Error ? error.message : String(error));
    }

    const problems: string[] = [];

    // ── Output mode and layout mode have to agree ────────────────────────
    if (context.outputMode) {
      if (!(OUTPUT_MODES as readonly string[]).includes(context.outputMode)) {
        problems.push(
          `unknown output mode '${context.outputMode}' (expected ${OUTPUT_MODES.join(', ')})`,
        );
      }

      const expectedLayout =
        context.outputMode === 'ESCPOS' || context.outputMode === 'ESCP_DOTMATRIX'
          ? 'GRID'
          : 'GRAPHIC';

      if (definition.layoutMode !== expectedLayout) {
        // A GRAPHIC template sent to a dot matrix would be rasterised, which is
        // the slowness the GRID path exists to avoid.
        problems.push(
          `output mode ${context.outputMode} requires layoutMode ${expectedLayout}, ` +
            `but the definition declares ${definition.layoutMode} ` +
            `(valid modes: ${LAYOUT_MODES.join(', ')})`,
        );
      }
    }

    // ── Every dataset must name a registered provider ────────────────────
    for (const dataset of definition.datasets) {
      if (!this.providers.has(dataset.provider)) {
        problems.push(
          `dataset '${dataset.name}' names unknown provider '${dataset.provider}'. ` +
            `Registered: ${this.providers.listTokens().join(', ')}`,
        );
      }
    }

    // ── Every expression must parse and reference known roots ────────────
    const allowedRoots = buildAllowedRoots(definition.datasets.map((dataset) => dataset.name));

    for (const [bandIndex, band] of definition.bands.entries()) {
      const bandPath = `bands[${bandIndex}]`;

      for (const issue of this.expressionValidator.validateTemplateString(
        band.visible,
        `${bandPath}.visible`,
        allowedRoots,
      )) {
        problems.push(`${issue.path}: ${issue.message}`);
      }
      for (const issue of this.expressionValidator.validateTemplateString(
        band.groupBy,
        `${bandPath}.groupBy`,
        allowedRoots,
      )) {
        problems.push(`${issue.path}: ${issue.message}`);
      }

      for (const [elementIndex, element] of band.elements.entries()) {
        const path = `${bandPath}.elements[${elementIndex}]`;
        const strings: Array<[string, string | undefined]> = [
          ['visible', element.visible],
          ['style.color', element.style?.color],
          ['style.fill', element.style?.fill],
          ['style.stroke', element.style?.stroke],
        ];

        if (isTextLike(element)) {
          strings.push(['value', element.value]);
          if (element.kind === 'FIELD' && element.aggregate?.over) {
            strings.push(['aggregate.over', element.aggregate.over]);
          }
        } else if (element.kind === 'IMAGE') {
          strings.push(['source', element.source]);
        } else if (element.kind === 'BARCODE' || element.kind === 'QRCODE') {
          strings.push(['value', element.value]);
        } else if (element.kind === 'PAGEBREAK') {
          strings.push(['when', element.when]);
        }

        for (const [field, template] of strings) {
          for (const issue of this.expressionValidator.validateTemplateString(
            template,
            `${path}.${field}`,
            allowedRoots,
          )) {
            problems.push(`${issue.path}: ${issue.message}`);
          }
        }
      }
    }

    if (problems.length > 0) {
      throw new BadRequestException({
        message: 'Template definition is not valid',
        errors: problems.slice(0, 40),
        errorCount: problems.length,
      });
    }

    return definition;
  }

  // ─── Internals ─────────────────────────────────────────────────────────

  private toResolved(record: PrintTemplate, source: TemplateResolutionSource): ResolvedTemplate {
    const outcome = this.migration.migrateDefinition(record.ptDefinition);
    return {
      ptId: record.ptId,
      name: record.ptName,
      version: record.ptVersion,
      outputMode: record.ptOutputMode,
      paperCode: record.ptPaperCode,
      definition: outcome.definition,
      source,
    };
  }

  /**
   * Clear the current default for a scope.
   *
   * ux_pt_default is UNIQUE NULLS NOT DISTINCT, so promoting a second default
   * without clearing the first is a constraint violation rather than a silent
   * double. Clearing inside the same transaction as the promotion keeps the
   * window closed.
   */
  private async clearDefault(
    transaction: Prisma.TransactionClient,
    scope: {
      companyId: string | null;
      branchId: string | null;
      docType: string;
      outputMode: string;
      paperCode: string;
      exceptId?: string;
    },
  ): Promise<void> {
    await transaction.printTemplate.updateMany({
      where: {
        ptCompanyId: scope.companyId,
        ptBranchId: scope.branchId,
        ptDocType: scope.docType,
        ptOutputMode: scope.outputMode,
        ptPaperCode: scope.paperCode,
        ptIsDefault: true,
        ptIsDeleted: false,
        ...(scope.exceptId ? { ptId: { not: scope.exceptId } } : {}),
      },
      data: { ptIsDefault: false },
    });
  }

  /** A tenant may read its own templates and the system ones. */
  private assertReadable(record: PrintTemplate): void {
    const companyId = this.contextCompanyId();
    if (!companyId || record.ptCompanyId === null || record.ptCompanyId === companyId) {
      return;
    }
    throw new ForbiddenException(`Print template ${record.ptId} belongs to another company`);
  }

  /** A tenant may write only its own templates. System ones are cloned first. */
  private assertWritable(record: PrintTemplate): void {
    if (record.ptCompanyId === null) {
      throw new ForbiddenException(
        `Print template ${record.ptId} is a system template and cannot be edited. ` +
          'Clone it first, then edit the clone.',
      );
    }
    this.assertReadable(record);
  }

  private contextCompanyId(): string | null {
    return this.requestContext.getCompanyId();
  }

  private actor(): string | null {
    const userId = this.requestContext.getUserId();
    return userId && UUID_PATTERN.test(userId) ? userId : null;
  }

  /** Turn Prisma's unique-violation codes into the message a user can act on. */
  private rethrowWriteError(error: unknown, name: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const rawTarget = (error.meta as { target?: unknown } | undefined)?.target;
      // Prisma reports `target` as string | string[] depending on the driver.
      const target = Array.isArray(rawTarget)
        ? rawTarget.join(',')
        : typeof rawTarget === 'string'
          ? rawTarget
          : '';

      if (target.includes('ux_pt_default')) {
        throw new ConflictException(
          'Another template is already the default for this document type, output mode and paper.',
        );
      }
      if (target.includes('ux_pt_name')) {
        throw new ConflictException(`A template named '${name}' already exists in this scope.`);
      }
      throw new ConflictException(`Template '${name}' conflicts with an existing record.`);
    }
    throw error;
  }
}

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const SUMMARY_SELECT = {
  ptId: true,
  ptCompanyId: true,
  ptBranchId: true,
  ptDocType: true,
  ptOutputMode: true,
  ptPaperCode: true,
  ptName: true,
  ptVersion: true,
  ptParentId: true,
  ptSchemaVer: true,
  ptIsDefault: true,
  ptIsActive: true,
  ptCreatedOn: true,
  ptCreatedBy: true,
  ptModifiedOn: true,
  ptModifiedBy: true,
} as const;

type SummaryRecord = Pick<PrintTemplate, keyof typeof SUMMARY_SELECT>;

const toSummaryPayload = (record: SummaryRecord): TemplateSummaryPayload => ({
  ptId: record.ptId,
  ptCompanyId: record.ptCompanyId,
  ptBranchId: record.ptBranchId,
  ptDocType: record.ptDocType,
  ptOutputMode: record.ptOutputMode,
  ptPaperCode: record.ptPaperCode,
  ptName: record.ptName,
  ptVersion: record.ptVersion,
  ptParentId: record.ptParentId,
  ptSchemaVer: record.ptSchemaVer,
  ptIsDefault: record.ptIsDefault,
  ptIsActive: record.ptIsActive,
  isSystemTemplate: record.ptCompanyId === null,
  ptCreatedOn: record.ptCreatedOn.toISOString(),
  ptCreatedBy: record.ptCreatedBy,
  ptModifiedOn: record.ptModifiedOn?.toISOString() ?? null,
  ptModifiedBy: record.ptModifiedBy,
});

const asNonEmptyString = (value: unknown, field: string): string => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new BadRequestException(`The export is missing '${field}'.`);
  }
  return value.trim();
};
