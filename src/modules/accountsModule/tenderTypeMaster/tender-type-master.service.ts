import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TenderTypeMaster } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListTenderTypeMasterQueryDto } from './dto/list-tender-type-master-query.dto';
import { SaveTenderTypeMasterDto } from './dto/save-tender-type-master.dto';
import {
  TenderTypeMasterErrorDetail,
  TenderTypeMasterErrorResponse,
  TenderTypeMasterListItem,
  TenderTypeMasterListMeta,
  TenderTypeMasterPayload,
} from './types/tender-type-master-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const TENDER_TYPE_MASTER_TABLE_NAME = 'tender_type_master';
const TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME = 'Tender Type Master';

type TenderTypeMasterWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class TenderTypeMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveTenderTypeMasterDto: SaveTenderTypeMasterDto): Promise<TenderTypeMasterPayload> {
    if (saveTenderTypeMasterDto.ttmTypeId) {
      return this.updateTenderType(saveTenderTypeMasterDto);
    }

    return this.createTenderType(saveTenderTypeMasterDto);
  }

  async list(
    queryDto: ListTenderTypeMasterQueryDto,
  ): Promise<{ items: TenderTypeMasterListItem[]; meta: TenderTypeMasterListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.TenderTypeMasterWhereInput = {
      ttmIsDeleted: false,
    };

    if (queryDto.ttmIsActive !== undefined) {
      where.ttmIsActive = queryDto.ttmIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [{ ttmTypeName: { contains: search, mode: 'insensitive' } }];
    }

    const [total, records] = await Promise.all([
      this.prisma.tenderTypeMaster.count({ where }),
      this.prisma.tenderTypeMaster.findMany({
        where,
        orderBy: [{ ttmTypeName: 'asc' }, { ttmTypeId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    };
  }

  async getById(ttmTypeId: string): Promise<TenderTypeMasterPayload> {
    const record = await this.prisma.tenderTypeMaster.findFirst({
      where: {
        ttmTypeId,
        ttmIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(ttmTypeId);
    }

    return this.toPayload(record);
  }

  async softDelete(ttmTypeId: string): Promise<{ ttmTypeId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenderTypeMaster.findFirst({
        where: {
          ttmTypeId,
          ttmIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(ttmTypeId);
      }

      const activeTendersCount = await tx.tenderMaster.count({
        where: {
          tndTypeId: ttmTypeId,
          tndIsDeleted: false,
        },
      });
      if (activeTendersCount > 0) {
        this.throwBadRequest('Cannot delete tender type with active tenders', [
          {
            field: 'ttmTypeId',
            message: `Tender type ${ttmTypeId} is used by ${activeTendersCount} tender(s).`,
          },
        ]);
      }

      const modifiedOn = new Date();
      const result = await tx.tenderTypeMaster.updateMany({
        where: {
          ttmTypeId,
          ttmIsDeleted: false,
        },
        data: {
          ttmIsDeleted: true,
          ttmIsActive: false,
          ttmModifiedOn: modifiedOn,
          ttmModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(ttmTypeId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        ttmIsDeleted: true,
        ttmIsActive: false,
        ttmModifiedOn: modifiedOn,
        ttmModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TENDER_TYPE_MASTER_TABLE_NAME,
          screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: ttmTypeId,
          displayName: existing.ttmTypeName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Tender type soft deleted',
        },
        tx,
      );

      return {
        ttmTypeId,
        deleted: true,
      };
    });
  }

  private async createTenderType(
    saveTenderTypeMasterDto: SaveTenderTypeMasterDto,
  ): Promise<TenderTypeMasterPayload> {
    try {
      return this.prisma.$transaction(async (tx) => {
        const ttmTypeName = this.normalizeRequiredName(saveTenderTypeMasterDto.ttmTypeName);

        await this.ensureNameIsUnique(tx, ttmTypeName);

        const now = new Date();
        const data: Prisma.TenderTypeMasterUncheckedCreateInput = {
          ttmTypeName,
          ttmCreatedOn: now,
          ttmCreatedBy: DEFAULT_ACTOR,
          ttmModifiedOn: now,
          ttmModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveTenderTypeMasterDto, 'ttmIsActive')) {
          data.ttmIsActive = saveTenderTypeMasterDto.ttmIsActive;
        }

        const created = await tx.tenderTypeMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: TENDER_TYPE_MASTER_TABLE_NAME,
            screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.ttmTypeId,
            displayName: payload.ttmTypeName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Tender type created',
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

  private async updateTenderType(
    saveTenderTypeMasterDto: SaveTenderTypeMasterDto,
  ): Promise<TenderTypeMasterPayload> {
    const ttmTypeId = saveTenderTypeMasterDto.ttmTypeId!;

    try {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.tenderTypeMaster.findFirst({
          where: {
            ttmTypeId,
            ttmIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(ttmTypeId);
        }

        const ttmTypeName = this.normalizeRequiredName(saveTenderTypeMasterDto.ttmTypeName);

        await this.ensureNameIsUnique(tx, ttmTypeName, ttmTypeId);

        const data: Prisma.TenderTypeMasterUncheckedUpdateInput = {
          ttmTypeName,
          ttmModifiedOn: new Date(),
          ttmModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveTenderTypeMasterDto, 'ttmIsActive')) {
          data.ttmIsActive = saveTenderTypeMasterDto.ttmIsActive;
        }

        const updated = await tx.tenderTypeMaster.update({
          where: {
            ttmTypeId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: TENDER_TYPE_MASTER_TABLE_NAME,
            screenName: TENDER_TYPE_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: ttmTypeId,
            displayName: payload.ttmTypeName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Tender type updated',
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

  private async ensureNameIsUnique(
    tx: TenderTypeMasterWriteClient,
    ttmTypeName: string,
    excludeTtmTypeId?: string,
  ): Promise<void> {
    const existing = await tx.tenderTypeMaster.findFirst({
      where: {
        ttmIsDeleted: false,
        ttmTypeName: {
          equals: ttmTypeName,
          mode: 'insensitive',
        },
        ...(excludeTtmTypeId
          ? {
              ttmTypeId: {
                not: excludeTtmTypeId,
              },
            }
          : {}),
      },
      select: {
        ttmTypeId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Tender type name already exists', [
          {
            field: 'ttmTypeName',
            message: 'Duplicate ttmTypeName is not allowed',
          },
        ]),
      );
    }
  }

  private normalizeRequiredName(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ttmTypeName',
          message: 'ttmTypeName must not be empty',
        },
      ]);
    }

    return trimmed;
  }

  private toPayload(record: TenderTypeMaster): TenderTypeMasterPayload {
    return {
      ttmTypeId: record.ttmTypeId,
      ttmTypeName: record.ttmTypeName,
      ttmIsActive: record.ttmIsActive,
      ttmIsDeleted: record.ttmIsDeleted,
      ttmSyncDate: record.ttmSyncDate ? record.ttmSyncDate.toISOString() : null,
      ttmCreatedOn: record.ttmCreatedOn.toISOString(),
      ttmCreatedBy: record.ttmCreatedBy,
      ttmModifiedOn: record.ttmModifiedOn.toISOString(),
      ttmModifiedBy: record.ttmModifiedBy,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Tender type already exists', [
          {
            field: 'ttmTypeName',
            message: 'Duplicate tender type unique value is not allowed',
          },
        ]),
      );
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }

  private throwNotFound(ttmTypeId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Tender type not found', [
        {
          field: 'ttmTypeId',
          message: `No active tender type found with id ${ttmTypeId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: TenderTypeMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: TenderTypeMasterErrorDetail[] = [],
  ): TenderTypeMasterErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
