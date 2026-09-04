import { Injectable } from '@nestjs/common';
import { Configs, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveConfigsDto } from './dto/save-configs.dto';
import {
  ConfigsErrorDetail,
  ConfigsErrorResponse,
  ConfigsPayload,
} from './types/configs-api.types';
import {
  PresentFieldTransform,
  applyPresentFields,
  resolveActor,
  throwSettingsNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const CONFIGS_TABLE_NAME = 'configs';
const CONFIGS_AUDIT_SCREEN_NAME = 'Configs';
const CONFIGS_OPTIONAL_FIELDS = ['configName', 'configValue', 'configSyncDate'];
const CONFIGS_FIELD_TRANSFORMS: Partial<Record<string, PresentFieldTransform>> = {
  configSyncDate: (value) => (value ? new Date(value as string) : null),
};
@Injectable()
export class ConfigsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveConfigsDto: SaveConfigsDto): Promise<ConfigsPayload> {
    return this.updateConfig(saveConfigsDto);
  }
  async getById(configId: number): Promise<ConfigsPayload> {
    const record = await this.prisma.configs.findUnique({ where: { configId } });
    if (!record) {
      throwSettingsNotFound<ConfigsErrorDetail, ConfigsErrorResponse>(
        'Config not found',
        'configId',
        `No config found with id ${configId}`,
      );
    }
    return this.toPayload(record);
  }  
  private async updateConfig(saveConfigsDto: SaveConfigsDto): Promise<ConfigsPayload> {
    const configId = saveConfigsDto.configId;
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.configs.findUnique({ where: { configId } });
      if (!existing) {
        throwSettingsNotFound<ConfigsErrorDetail, ConfigsErrorResponse>(
          'Config not found',
          'configId',
          `No config found with id ${configId}`,
        );
      }
      const data: Prisma.ConfigsUncheckedUpdateInput = {
        configModifiedOn: new Date(),
        configModifiedBy: resolveActor(
          saveConfigsDto.configModifiedBy,
          this.requestContextService.getUserId(),
        ),
      };
      applyPresentFields(data, saveConfigsDto, CONFIGS_OPTIONAL_FIELDS, CONFIGS_FIELD_TRANSFORMS);
      const updated = await tx.configs.update({ where: { configId }, data });
      const payload = this.toPayload(updated);
      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: CONFIGS_TABLE_NAME,
          screenName: CONFIGS_AUDIT_SCREEN_NAME,
          screenType: 'settings',
          pk: configId,
          displayName: payload.configName,
          originalRecord: this.toPayload(existing),
          modifiedRecord: payload,
          userId: resolveActor(
            saveConfigsDto.configModifiedBy,
            this.requestContextService.getUserId(),
          ),
          notes: 'Config updated',
        },
        tx,
      );
      return payload;
    });
  }
  private toPayload(record: Configs): ConfigsPayload {
    return {
      configId: record.configId,
      configName: record.configName,
      configValue: record.configValue,
      configSyncDate: record.configSyncDate ? record.configSyncDate.toISOString() : null,
      configCreatedOn: record.configCreatedOn ? record.configCreatedOn.toISOString() : null,
      configCreatedBy: record.configCreatedBy,
      configModifiedOn: record.configModifiedOn ? record.configModifiedOn.toISOString() : null,
      configModifiedBy: record.configModifiedBy,
    };
  }
}