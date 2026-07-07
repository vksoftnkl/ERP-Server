import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { ListWidgetQueryDto } from './dto/list-widget-query.dto';
import { WidgetConfigQueryDto } from './dto/widget-config-query.dto';
import { UpdateWidgetVisibilityDto } from './dto/update-widget-visibility.dto';
import { SaveWidgetDto, SaveWidgetFieldDto } from './dto/save-widget.dto';
import { SaveBulkWidgetDto } from './dto/save-bulk-widget.dto';
import {
  WidgetFieldPayload,
  WidgetMasterErrorDetail,
  WidgetMasterPayload,
  WidgetPlatform,
  WidgetVisibilityFilter,
} from './types/widget-master-api.types';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  throwMasterBadRequest,
  throwMasterNotFound,
} from 'src/common/utils/module-service.utils';
const FIELD_ORDER_BY: Prisma.FormFieldOrderByWithRelationInput[] = [
  { fieldPosition: 'asc' },
  { fieldId: 'asc' },
];
type SectionWithFields = Prisma.FormSectionGetPayload<{ include: { fields: true } }>;
@Injectable()
export class WidgetMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveWidgetDto: SaveWidgetDto): Promise<WidgetMasterPayload> {
    const actor = this.getActor();
    return this.prisma.$transaction((tx) => this.saveSectionTx(tx, saveWidgetDto, actor));
  }
  /**
   * Upsert several sections (each with its nested fields) in a single transaction. Each section
   * follows the same create/update rules as {@link save}; if any one fails (duplicate name, missing
   * id, …) the whole batch is rolled back.
   */
  async saveBulk(saveBulkWidgetDto: SaveBulkWidgetDto): Promise<WidgetMasterPayload[]> {
    const actor = this.getActor();
    return this.prisma.$transaction(async (tx) => {
      const results: WidgetMasterPayload[] = [];
      for (const section of saveBulkWidgetDto.data) {
        results.push(await this.saveSectionTx(tx, section, actor));
      }
      return results;
    });
  }
  async list(queryDto: ListWidgetQueryDto): Promise<WidgetMasterPayload[]> {
    const search = queryDto.search?.trim() ?? '';
    const where: Prisma.FormSectionWhereInput = {};
    if (queryDto.sectionId !== undefined) {
      where.sectionId = queryDto.sectionId;
    }
    if (queryDto.sectionMenuId !== undefined) {
      where.sectionMenuId = queryDto.sectionMenuId;
    }
    if (queryDto.sectionPlatform !== undefined) {
      where.sectionPlatform = queryDto.sectionPlatform;
    }
    if (search) {
      where.OR = this.buildSearchConditions(search);
    }
    const records = await this.prisma.formSection.findMany({
      where,
      orderBy: [{ sectionPosition: 'asc' }, { sectionId: 'asc' }],
      include: { fields: { orderBy: FIELD_ORDER_BY } },
    });
    return records.map((record) => this.toPayload(record));
  }
  /**
   * Return a menu's widget config.
   * - `visibility=false`: only hidden sections (`sectionVisibility = false`), each carrying its
   *   hidden fields plus any field that has secondary text (even when that field is itself visible).
   * - `visibility=all` (or omitted): both visible and hidden sections (and all their fields).
   * - `platform`, when provided, restricts results to sections scoped to that platform.
   */
  async getConfig(queryDto: WidgetConfigQueryDto): Promise<WidgetMasterPayload[]> {
    const onlyHidden = queryDto.visibility === WidgetVisibilityFilter.False;
    const records = await this.prisma.formSection.findMany({
      where: {
        sectionMenuId: queryDto.menu_id,
        ...(queryDto.platform !== undefined && { sectionPlatform: queryDto.platform }),
        ...(onlyHidden && { sectionVisibility: false }),
      },
      orderBy: [{ sectionPosition: 'asc' }, { sectionId: 'asc' }],
      include: {
        fields: {
          where: onlyHidden
            ? { OR: [{ fieldVisibility: false }, { fieldSecondaryText: { not: null } }] }
            : undefined,
          orderBy: FIELD_ORDER_BY,
        },
      },
    });
    return records.map((record) => this.toPayload(record));
  }
  /**
   * Bulk-update the visibility config for a set of sections and their fields in one transaction:
   * each section's `sectionVisibility` / `sectionGuiName` and each field's `fieldVisibility` /
   * `fieldSecondaryText` are updated by id. Any missing id aborts and rolls back the whole batch.
   */
  async updateVisibility(dto: UpdateWidgetVisibilityDto): Promise<WidgetMasterPayload[]> {
    const actor = this.getActor();
    const now = new Date();
    const sectionIds = dto.data.map((section) => this.normalizeSectionId(section.sectionId));
    return this.prisma.$transaction(async (tx) => {
      for (const section of dto.data) {
        const sectionId = this.normalizeSectionId(section.sectionId);
        const existing = await tx.formSection.findUnique({
          where: { sectionId },
          select: { sectionId: true },
        });
        if (!existing) {
          this.throwNotFound(sectionId);
        }
        await tx.formSection.update({
          where: { sectionId },
          data: {
            sectionGuiName: section.sectionGuiName.trim(),
            sectionVisibility: section.sectionVisibility,
            sectionUpdatedBy: actor,
            sectionUpdatedOn: now,
          },
        });
        for (const field of section.fields) {
          const fieldId = this.normalizeFieldId(field.fieldId);
          const existingField = await tx.formField.findUnique({
            where: { fieldId },
            select: { fieldSectionId: true },
          });
          if (!existingField || existingField.fieldSectionId !== sectionId) {
            this.throwFieldNotFound(fieldId, sectionId);
          }
          await tx.formField.update({
            where: { fieldId },
            data: {
              fieldSecondaryText: field.fieldSecondaryText.trim(),
              fieldVisibility: field.fieldVisibility,
              fieldUpdatedBy: actor,
              fieldUpdatedOn: now,
            },
          });
        }
      }
      const updated = await tx.formSection.findMany({
        where: { sectionId: { in: sectionIds } },
        orderBy: [{ sectionPosition: 'asc' }, { sectionId: 'asc' }],
        include: { fields: { orderBy: FIELD_ORDER_BY } },
      });
      return updated.map((record) => this.toPayload(record));
    });
  }
  async delete(sectionId: number): Promise<{ sectionId: number; deleted: true }> {
    const normalizedSectionId = this.normalizeSectionId(sectionId);
    const deleted = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.formSection.findUnique({
        where: {
          sectionId: normalizedSectionId,
        },
        select: {
          sectionId: true,
        },
      });
      if (!existing) {
        return false;
      }
      // Child fields cascade-delete via the form_field FK (onDelete: Cascade).
      await tx.formSection.delete({
        where: {
          sectionId: normalizedSectionId,
        },
      });
      return true;
    });
    if (!deleted) {
      this.throwNotFound(normalizedSectionId);
    }
    return {
      sectionId: normalizedSectionId,
      deleted: true,
    };
  }
  /** Route a single section to create or update within an existing transaction. */
  private async saveSectionTx(
    tx: Prisma.TransactionClient,
    saveWidgetDto: SaveWidgetDto,
    actor: string,
  ): Promise<WidgetMasterPayload> {
    if (saveWidgetDto.sectionId !== undefined) {
      return this.updateSectionTx(tx, saveWidgetDto, actor);
    }
    return this.createSectionTx(tx, saveWidgetDto, actor);
  }
  private async createSectionTx(
    tx: Prisma.TransactionClient,
    saveWidgetDto: SaveWidgetDto,
    actor: string,
  ): Promise<WidgetMasterPayload> {
    const data: Prisma.FormSectionUncheckedCreateInput = {
      sectionMenuId: saveWidgetDto.sectionMenuId,
      sectionName: saveWidgetDto.sectionName.trim(),
      sectionGuiName: saveWidgetDto.sectionGuiName.trim(),
      sectionPosition: saveWidgetDto.sectionPosition ?? 0,
      sectionVisibility: saveWidgetDto.sectionVisibility ?? true,
      sectionPlatform: saveWidgetDto.sectionPlatform,
      sectionCreatedOn: new Date(),
      sectionCreatedBy: actor,
    };
    if (saveWidgetDto.fields !== undefined) {
      data.fields = {
        create: saveWidgetDto.fields.map((field) => this.buildFieldCreateData(field, actor)),
      };
    }
    const created = await tx.formSection.create({
      data,
      include: { fields: { orderBy: FIELD_ORDER_BY } },
    });
    return this.toPayload(created);
  }
  private async updateSectionTx(
    tx: Prisma.TransactionClient,
    saveWidgetDto: SaveWidgetDto,
    actor: string,
  ): Promise<WidgetMasterPayload> {
    const sectionId = this.normalizeSectionId(saveWidgetDto.sectionId!);
    const existing = await tx.formSection.findUnique({
      where: { sectionId },
    });
    if (!existing) {
      this.throwNotFound(sectionId);
    }
    const data: Prisma.FormSectionUncheckedUpdateInput = {
      sectionMenuId: saveWidgetDto.sectionMenuId,
      sectionName: saveWidgetDto.sectionName.trim(),
      sectionGuiName: saveWidgetDto.sectionGuiName.trim(),
      sectionPosition: saveWidgetDto.sectionPosition ?? existing.sectionPosition,
      sectionVisibility: saveWidgetDto.sectionVisibility ?? existing.sectionVisibility,
      sectionPlatform: saveWidgetDto.sectionPlatform,
      sectionUpdatedBy: actor,
      sectionUpdatedOn: new Date(),
    };
    await tx.formSection.update({
      where: { sectionId },
      data,
    });

    // `fields` omitted => leave existing fields untouched; provided (even []) => full sync.
    if (saveWidgetDto.fields !== undefined) {
      await this.syncFields(tx, sectionId, saveWidgetDto.fields, actor);
    }
    const updated = await tx.formSection.findUniqueOrThrow({
      where: { sectionId },
      include: { fields: { orderBy: FIELD_ORDER_BY } },
    });
    return this.toPayload(updated);
  }
  /** Reconcile the section's fields against the desired set: delete removed, update existing, create new. */
  private async syncFields(
    tx: Prisma.TransactionClient,
    sectionId: number,
    fields: SaveWidgetFieldDto[],
    actor: string,
  ): Promise<void> {
    const existing = await tx.formField.findMany({
      where: { fieldSectionId: sectionId },
      select: { fieldId: true },
    });
    const existingIds = new Set(existing.map((field) => field.fieldId));
    const keepIds = new Set<number>();
    for (const field of fields) {
      if (field.fieldId !== undefined && existingIds.has(field.fieldId)) {
        keepIds.add(field.fieldId);
      }
    }
    const toDelete = [...existingIds].filter((id) => !keepIds.has(id));
    if (toDelete.length > 0) {
      await tx.formField.deleteMany({ where: { fieldId: { in: toDelete } } });
    }
    for (const field of fields) {
      if (field.fieldId !== undefined && existingIds.has(field.fieldId)) {
        await tx.formField.update({
          where: { fieldId: field.fieldId },
          data: this.buildFieldUpdateData(field, actor),
        });
      } else {
        await tx.formField.create({
          data: { ...this.buildFieldCreateData(field, actor), fieldSectionId: sectionId },
        });
      }
    }
  }
  private buildFieldCreateData(
    field: SaveWidgetFieldDto,
    actor: string,
  ): Prisma.FormFieldCreateWithoutSectionInput {
    return {
      fieldName: field.fieldName.trim(),
      fieldGuiName: field.fieldGuiName ?? null,
      fieldSecondaryText: field.fieldSecondaryText ?? null,
      fieldPosition: field.fieldPosition ?? 0,
      fieldVisibility: field.fieldVisibility ?? true,
      fieldCreatedBy: actor,
      fieldUpdatedBy: null,
    };
  }
  private buildFieldUpdateData(
    field: SaveWidgetFieldDto,
    actor: string,
  ): Prisma.FormFieldUncheckedUpdateInput {
    const data: Prisma.FormFieldUncheckedUpdateInput = {
      fieldName: field.fieldName.trim(),
      fieldUpdatedBy: actor,
      fieldUpdatedOn: new Date(),
    };
    if (hasOwnProperty(field, 'fieldGuiName')) {
      data.fieldGuiName = field.fieldGuiName ?? null;
    }
    if (hasOwnProperty(field, 'fieldSecondaryText')) {
      data.fieldSecondaryText = field.fieldSecondaryText ?? null;
    }
    if (field.fieldPosition !== undefined) {
      data.fieldPosition = field.fieldPosition;
    }
    if (field.fieldVisibility !== undefined) {
      data.fieldVisibility = field.fieldVisibility;
    }
    return data;
  }
  private buildSearchConditions(search: string): Prisma.FormSectionWhereInput[] {
    return [
      { sectionName: { contains: search, mode: 'insensitive' } },
      { sectionGuiName: { contains: search, mode: 'insensitive' } },
      { fields: { some: { fieldName: { contains: search, mode: 'insensitive' } } } },
      { fields: { some: { fieldGuiName: { contains: search, mode: 'insensitive' } } } },
      { fields: { some: { fieldSecondaryText: { contains: search, mode: 'insensitive' } } } },
    ];
  }
  private toPayload(record: SectionWithFields): WidgetMasterPayload {
    return {
      sectionId: record.sectionId,
      sectionMenuId: record.sectionMenuId,
      sectionName: record.sectionName,
      sectionGuiName: record.sectionGuiName,
      sectionPosition: record.sectionPosition,
      sectionVisibility: record.sectionVisibility,
      sectionPlatform: record.sectionPlatform as WidgetPlatform,
      sectionSyncDate: record.sectionSyncDate.toISOString(),
      sectionCreatedOn: record.sectionCreatedOn.toISOString(),
      sectionCreatedBy: record.sectionCreatedBy,
      sectionUpdatedOn: record.sectionUpdatedOn.toISOString(),
      sectionUpdatedBy: record.sectionUpdatedBy,
      fields: record.fields.map((field) => this.toFieldPayload(field)),
    };
  }
  private toFieldPayload(field: SectionWithFields['fields'][number]): WidgetFieldPayload {
    return {
      fieldId: field.fieldId,
      fieldSectionId: field.fieldSectionId,
      fieldName: field.fieldName,
      fieldGuiName: field.fieldGuiName,
      fieldSecondaryText: field.fieldSecondaryText,
      fieldPosition: field.fieldPosition,
      fieldVisibility: field.fieldVisibility,
      fieldSyncDate: field.fieldSyncDate.toISOString(),
      fieldCreatedOn: field.fieldCreatedOn.toISOString(),
      fieldCreatedBy: field.fieldCreatedBy,
      fieldUpdatedOn: field.fieldUpdatedOn.toISOString(),
      fieldUpdatedBy: field.fieldUpdatedBy,
    };
  }
  /** Current request's user id, falling back to the system actor for unauthenticated/background calls. */
  private getActor(): string {
    return this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
  }
  private normalizeSectionId(sectionId: number): number {
    if (!Number.isInteger(sectionId) || sectionId <= 0) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'sectionId',
          message: 'sectionId must be a positive integer',
        },
      ]);
    }
    return sectionId;
  }
  private normalizeFieldId(fieldId: number): number {
    if (!Number.isInteger(fieldId) || fieldId <= 0) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'fieldId',
          message: 'fieldId must be a positive integer',
        },
      ]);
    }
    return fieldId;
  }
  private throwNotFound(sectionId: number): never {
    throwMasterNotFound<WidgetMasterErrorDetail>(
      'Section not found',
      'sectionId',
      `No section found with sectionId ${sectionId}`,
    );
  }

  private throwFieldNotFound(fieldId: number, sectionId: number): never {
    throwMasterNotFound<WidgetMasterErrorDetail>(
      'Field not found',
      'fieldId',
      `No field found with fieldId ${fieldId} under sectionId ${sectionId}`,
    );
  }

  private throwBadRequest(message: string, errors: WidgetMasterErrorDetail[]): never {
    throwMasterBadRequest<WidgetMasterErrorDetail>(message, errors);
  }
}
