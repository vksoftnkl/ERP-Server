import { Injectable } from '@nestjs/common';
import { GspCompanyService, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveGspCompanyServiceDto } from './dto/save-gsp-company-service.dto';
import {
  GspCompanyServiceErrorDetail,
  GspCompanyServiceErrorResponse,
  GspCompanyServicePayload,
} from './types/gsp-company-service-api.types';
import {
  DEFAULT_ACTOR,
  SettingsWriteClient,
  buildSettingsErrorResponse,
  hasOwnProperty,
  isForeignKeyConstraintError,
  normalizeNullableString,
  normalizeRequiredText,
  throwOnUniqueConstraintError,
  throwSettingsBadRequest,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';

const GSP_COMPANY_SERVICE_TABLE_NAME = 'gsp company service';
const GSP_COMPANY_SERVICE_AUDIT_SCREEN_NAME = 'GSP Company Service';
type GspCompanyServiceWriteClient = SettingsWriteClient;
type GspCompanyServiceRecordWithCompany = Prisma.GspCompanyServiceGetPayload<{
  include: {
    company: {
      select: {
        compName: true;
      };
    };
  };
}>;
@Injectable()
export class GspCompanyServiceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(
    saveGspCompanyServiceDto: SaveGspCompanyServiceDto,
  ): Promise<GspCompanyServicePayload> {
    if (saveGspCompanyServiceDto.csgCompanyServiceId) {
      return this.updateGspCompanyService(saveGspCompanyServiceDto);
    }
    return this.createGspCompanyService(saveGspCompanyServiceDto);
  }

  async getById(csgCompanyServiceId: string): Promise<GspCompanyServicePayload> {
    const record = await this.prisma.gspCompanyService.findFirst({
      where: {
        csgCompanyServiceId,
        csgIsDeleted: false,
      },
      include: {
        company: {
          select: {
            compName: true,
          },
        },
      },
    });
    if (!record) {
      this.throwNotFound(csgCompanyServiceId);
    }
    const providerNameById = await this.loadProviderNameMap([record.csgGspProviderId]);
    return this.toPayload(record, providerNameById.get(record.csgGspProviderId) ?? null);
  }
  async softDelete(
    csgCompanyServiceId: string,
  ): Promise<{ csgCompanyServiceId: string; deleted: true }> {
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
          csgModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        csgModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
          userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        const csgAuthToken = normalizeNullableString(saveGspCompanyServiceDto.csgAuthToken);
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
          csgCreatedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        if (hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthToken')) {
          data.csgAuthToken = csgAuthToken;
        }
        if (hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthTokenValidTill')) {
          data.csgAuthTokenValidTill = saveGspCompanyServiceDto.csgAuthTokenValidTill ?? null;
        }
        if (hasOwnProperty(saveGspCompanyServiceDto, 'csgIsActive')) {
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
        const csgAuthToken = normalizeNullableString(saveGspCompanyServiceDto.csgAuthToken);
        await this.ensureCompanyExists(saveGspCompanyServiceDto.csgCompanyId, tx);
        await this.ensureGspProviderExists(saveGspCompanyServiceDto.csgGspProviderId, tx);
        const data: Prisma.GspCompanyServiceUncheckedUpdateInput = {
          csgCompanyId: saveGspCompanyServiceDto.csgCompanyId,
          csgGspProviderId: saveGspCompanyServiceDto.csgGspProviderId,
          csgServiceType,
          csgEuserName,
          csgEuserPassword,
          csgModifiedOn: new Date(),
          csgModifiedBy: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        };
        if (hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthToken')) {
          data.csgAuthToken = csgAuthToken;
        }
        if (hasOwnProperty(saveGspCompanyServiceDto, 'csgAuthTokenValidTill')) {
          data.csgAuthTokenValidTill = saveGspCompanyServiceDto.csgAuthTokenValidTill ?? null;
        }
        if (hasOwnProperty(saveGspCompanyServiceDto, 'csgIsActive')) {
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
            userId: this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
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
  private async ensureCompanyExists(
    companyId: string,
    tx: GspCompanyServiceWriteClient,
  ): Promise<void> {
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
    return normalizeRequiredText<GspCompanyServiceErrorDetail>(value, field);
  }
  private async loadProviderNameMap(providerIds: readonly string[]): Promise<Map<string, string>> {
    const uniqueProviderIds = Array.from(
      new Set(providerIds.map((providerId) => providerId.trim()).filter(Boolean)),
    );
    if (uniqueProviderIds.length === 0) {
      return new Map<string, string>();
    }
    const providers = await this.prisma.gspProviderMaster.findMany({
      where: {
        gspProviderId: {
          in: uniqueProviderIds,
        },
      },
      select: {
        gspProviderId: true,
        gspProviderName: true,
      },
    });
    return new Map(providers.map((provider) => [provider.gspProviderId, provider.gspProviderName]));
  }

  private buildReferenceDisplay(name: string | null, id: string | null): string | null {
    if (name && id) {
      return `${name} (${id})`;
    }
    if (name) {
      return name;
    }
    return id;
  }
  private toPayload(
    record: GspCompanyService | GspCompanyServiceRecordWithCompany,
    providerName: string | null = null,
  ): GspCompanyServicePayload {
    const companyName = 'company' in record ? (record.company?.compName ?? null) : null;
    return {
      csgCompanyServiceId: record.csgCompanyServiceId,
      csgCompanyId: record.csgCompanyId,
      companyName,
      companyDisplay: this.buildReferenceDisplay(companyName, record.csgCompanyId),
      csgGspProviderId: record.csgGspProviderId,
      providerName,
      providerDisplay: this.buildReferenceDisplay(providerName, record.csgGspProviderId),
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
    throwOnUniqueConstraintError<GspCompanyServiceErrorDetail>(
      error,
      'GSP company service already exists',
      [
        {
          field: 'csgCompanyServiceId',
          message: 'Duplicate GSP company service unique value is not allowed',
        },
      ],
    );

    if (isForeignKeyConstraintError(error)) {
      throwSettingsBadRequest<GspCompanyServiceErrorDetail>(
        'Invalid company or provider reference',
        [
          {
            field: 'csgCompanyId',
            message: 'Referenced company or provider does not exist',
          },
        ],
      );
    }
  }
  private throwNotFound(csgCompanyServiceId: string): never {
    throwSettingsNotFound<GspCompanyServiceErrorDetail>(
      'GSP company service not found',
      'csgCompanyServiceId',
      `No active GSP company service found with id ${csgCompanyServiceId}`,
    );
  }
  private throwBadRequest(message: string, errors: GspCompanyServiceErrorDetail[]): never {
    throwSettingsBadRequest<GspCompanyServiceErrorDetail>(message, errors);
  }
  private buildErrorResponse(
    message: string,
    errors: GspCompanyServiceErrorDetail[] = [],
  ): GspCompanyServiceErrorResponse {
    return buildSettingsErrorResponse<GspCompanyServiceErrorDetail, GspCompanyServiceErrorResponse>(
      message,
      errors,
    );
  }
  private buildDisplayName(record: GspCompanyService): string {
    return `${record.csgServiceType} (${record.csgEuserName})`;
  }
}
