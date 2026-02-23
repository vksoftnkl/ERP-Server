import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GspCompanyService, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListGspCompanyServiceQueryDto } from './dto/list-gsp-company-service-query.dto';
import { SaveGspCompanyServiceDto } from './dto/save-gsp-company-service.dto';
import {
  GspCompanyServiceErrorDetail,
  GspCompanyServiceErrorResponse,
  GspCompanyServiceListItem,
  GspCompanyServiceListMeta,
  GspCompanyServicePayload,
} from './types/gsp-company-service-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const GSP_COMPANY_SERVICE_TABLE_NAME = 'gsp_company_service';
const GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME = 'GSP Company Service';

type GspCompanyServiceWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class GspCompanyServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
  ) {}

  async save(saveGspCompanyServiceDto: SaveGspCompanyServiceDto): Promise<GspCompanyServicePayload> {
    if (saveGspCompanyServiceDto.csgCompanyServiceId) {
      return this.updateGspCompanyService(saveGspCompanyServiceDto);
    }

    return this.createGspCompanyService(saveGspCompanyServiceDto);
  }

  async list(
    queryDto: ListGspCompanyServiceQueryDto,
  ): Promise<{ items: GspCompanyServiceListItem[]; meta: GspCompanyServiceListMeta }> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.GspCompanyServiceWhereInput = {
      csgIsDeleted: false,
    };

    if (queryDto.csgCompanyId !== undefined) {
      where.csgCompanyId = queryDto.csgCompanyId as string;
    }

    if (queryDto.csgGspProviderId !== undefined) {
      where.csgGspProviderId = queryDto.csgGspProviderId;
    }

    if (queryDto.csgServiceType?.trim()) {
      where.csgServiceType = queryDto.csgServiceType.trim();
    }

    if (queryDto.csgIsActive !== undefined) {
      where.csgIsActive = queryDto.csgIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { csgServiceType: { contains: search, mode: 'insensitive' } },
        { csgEuserName: { contains: search, mode: 'insensitive' } },
        { csgAuthToken: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.gspCompanyService.count({ where }),
      this.prisma.gspCompanyService.findMany({
        where,
        orderBy: [{ csgCompanyId: 'asc' }, { csgServiceType: 'asc' }, { csgCompanyServiceId: 'asc' }],
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

  async getById(csgCompanyServiceId: string): Promise<GspCompanyServicePayload> {
    const record = await this.prisma.gspCompanyService.findFirst({
      where: {
        csgCompanyServiceId,
        csgIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(csgCompanyServiceId);
    }

    return this.toPayload(record);
  }

  async softDelete(csgCompanyServiceId: string): Promise<{ csgCompanyServiceId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.gspCompanyService.findFirst({
        where: {
          csgCompanyServiceId,
          csgIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(csgCompanyServiceId);
      }

      const modifiedOn = new Date();
      const result = await tx.gspCompanyService.updateMany({
        where: {
          csgCompanyServiceId,
          csgIsDeleted: false,
        },
        data: {
          csgIsDeleted: true,
          csgIsActive: false,
          csgModifiedOn: modifiedOn,
          csgModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(csgCompanyServiceId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        csgIsDeleted: true,
        csgIsActive: false,
        csgModifiedOn: modifiedOn,
        csgModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
          screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: csgCompanyServiceId,
          displayName: this.buildDisplayName(existing),
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'GSP company service soft deleted',
        },
        tx,
      );

      return {
        csgCompanyServiceId,
        deleted: true,
      };
    });
  }

  private async createGspCompanyService(
    saveGspCompanyServiceDto: SaveGspCompanyServiceDto,
  ): Promise<GspCompanyServicePayload> {
    try {
      return this.prisma.$transaction(async (tx) => {
        const csgServiceType = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgServiceType,
          'csgServiceType',
        );
        const csgEuserName = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgEuserName,
          'csgEuserName',
        );
        const csgEuserPassword = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgEuserPassword,
          'csgEuserPassword',
        );
        const csgAuthToken = this.normalizeNullableString(saveGspCompanyServiceDto.csgAuthToken);

        await this.ensureCompanyExists(saveGspCompanyServiceDto.csgCompanyId, tx);
        await this.ensureGspProviderExists(saveGspCompanyServiceDto.csgGspProviderId, tx);

        const now = new Date();
        const data: Prisma.GspCompanyServiceUncheckedCreateInput = {
          csgCompanyId: saveGspCompanyServiceDto.csgCompanyId,
          csgGspProviderId: saveGspCompanyServiceDto.csgGspProviderId,
          csgServiceType,
          csgEuserName,
          csgEuserPassword,
          csgCreatedOn: now,
          csgCreatedBy: DEFAULT_ACTOR,
          csgModifiedOn: now,
          csgModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthToken')) {
          data.csgAuthToken = csgAuthToken;
        }
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthTokenValidTill')) {
          data.csgAuthTokenValidTill = saveGspCompanyServiceDto.csgAuthTokenValidTill ?? null;
        }
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgIsActive')) {
          data.csgIsActive = saveGspCompanyServiceDto.csgIsActive;
        }

        const created = await tx.gspCompanyService.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
            screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.csgCompanyServiceId,
            displayName: this.buildDisplayName(created),
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'GSP company service created',
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

  private async updateGspCompanyService(
    saveGspCompanyServiceDto: SaveGspCompanyServiceDto,
  ): Promise<GspCompanyServicePayload> {
    const csgCompanyServiceId = saveGspCompanyServiceDto.csgCompanyServiceId!;

    try {
      return this.prisma.$transaction(async (tx) => {
        const existing = await tx.gspCompanyService.findFirst({
          where: {
            csgCompanyServiceId,
            csgIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(csgCompanyServiceId);
        }

        const csgServiceType = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgServiceType,
          'csgServiceType',
        );
        const csgEuserName = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgEuserName,
          'csgEuserName',
        );
        const csgEuserPassword = this.normalizeRequiredString(
          saveGspCompanyServiceDto.csgEuserPassword,
          'csgEuserPassword',
        );
        const csgAuthToken = this.normalizeNullableString(saveGspCompanyServiceDto.csgAuthToken);

        await this.ensureCompanyExists(saveGspCompanyServiceDto.csgCompanyId, tx);
        await this.ensureGspProviderExists(saveGspCompanyServiceDto.csgGspProviderId, tx);

        const data: Prisma.GspCompanyServiceUncheckedUpdateInput = {
          csgCompanyId: saveGspCompanyServiceDto.csgCompanyId,
          csgGspProviderId: saveGspCompanyServiceDto.csgGspProviderId,
          csgServiceType,
          csgEuserName,
          csgEuserPassword,
          csgModifiedOn: new Date(),
          csgModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthToken')) {
          data.csgAuthToken = csgAuthToken;
        }
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthTokenValidTill')) {
          data.csgAuthTokenValidTill = saveGspCompanyServiceDto.csgAuthTokenValidTill ?? null;
        }
        if (this.hasOwnProperty(saveGspCompanyServiceDto, 'csgIsActive')) {
          data.csgIsActive = saveGspCompanyServiceDto.csgIsActive;
        }

        const updated = await tx.gspCompanyService.update({
          where: {
            csgCompanyServiceId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: GSP_COMPANY_SERVICE_TABLE_NAME,
            screenName: GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: csgCompanyServiceId,
            displayName: this.buildDisplayName(updated),
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'GSP company service updated',
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

  private async ensureCompanyExists(companyId: number, tx: GspCompanyServiceWriteClient): Promise<void> {
    const company = await tx.company.findFirst({
      where: {
        compId: companyId,
        compIsDeleted: false,
      },
      select: {
        compId: true,
      },
    });

    if (!company) {
      this.throwBadRequest('Company does not exist', [
        {
          field: 'csgCompanyId',
          message: `No active company found with id ${companyId}`,
        },
      ]);
    }
  }

  private async ensureGspProviderExists(
    gspProviderId: string,
    tx: GspCompanyServiceWriteClient,
  ): Promise<void> {
    const provider = await tx.gspProviderMaster.findFirst({
      where: {
        gspProviderId,
        gspIsDeleted: false,
      },
      select: {
        gspProviderId: true,
      },
    });

    if (!provider) {
      this.throwBadRequest('GSP provider does not exist', [
        {
          field: 'csgGspProviderId',
          message: `No active GSP provider found with id ${gspProviderId}`,
        },
      ]);
    }
  }

  private normalizeRequiredString(value: string, field: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must not be empty`,
        },
      ]);
    }

    return trimmed;
  }

  private normalizeNullableString(value: string | null | undefined): string | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private toPayload(record: GspCompanyService): GspCompanyServicePayload {
    return {
      csgCompanyServiceId: record.csgCompanyServiceId,
      csgCompanyId: record.csgCompanyId,
      csgGspProviderId: record.csgGspProviderId,
      csgServiceType: record.csgServiceType,
      csgEuserName: record.csgEuserName,
      csgEuserPassword: record.csgEuserPassword,
      csgAuthToken: record.csgAuthToken,
      csgAuthTokenValidTill: record.csgAuthTokenValidTill
        ? record.csgAuthTokenValidTill.toISOString()
        : null,
      csgIsActive: record.csgIsActive,
      csgIsDeleted: record.csgIsDeleted,
      csgSyncDate: record.csgSyncDate ? record.csgSyncDate.toISOString() : null,
      csgCreatedOn: record.csgCreatedOn.toISOString(),
      csgCreatedBy: record.csgCreatedBy,
      csgModifiedOn: record.csgModifiedOn.toISOString(),
      csgModifiedBy: record.csgModifiedBy,
    };
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('GSP company service already exists', [
          {
            field: 'csgCompanyServiceId',
            message: 'Duplicate GSP company service unique value is not allowed',
          },
        ]),
      );
    }

    if (this.isForeignKeyConstraintError(error)) {
      this.throwBadRequest('Invalid company or provider reference', [
        {
          field: 'csgCompanyId',
          message: 'Referenced company or provider does not exist',
        },
      ]);
    }
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2002';
  }

  private isForeignKeyConstraintError(error: unknown): boolean {
    if (typeof error !== 'object' || error === null || !('code' in error)) {
      return false;
    }

    return (error as { code?: string }).code === 'P2003';
  }

  private throwNotFound(csgCompanyServiceId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('GSP company service not found', [
        {
          field: 'csgCompanyServiceId',
          message: `No active GSP company service found with id ${csgCompanyServiceId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: GspCompanyServiceErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: GspCompanyServiceErrorDetail[] = [],
  ): GspCompanyServiceErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private buildDisplayName(record: GspCompanyService): string {
    return `${record.csgServiceType} (${record.csgEuserName})`;
  }

  private hasOwnProperty<T extends object>(obj: T, key: PropertyKey): boolean {
    return Object.prototype.hasOwnProperty.call(obj, key);
  }
}
