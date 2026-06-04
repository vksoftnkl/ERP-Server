import { Injectable } from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { BankMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListBankListQueryDto } from './dto/list-bank-list-query.dto';
import { SaveBankListDto } from './dto/save-bank-list.dto';
import {
  BankListErrorDetail,
  BankListErrorResponse,
  BankListItem,
  BankListMeta,
  BankListPayload,
} from './types/bank-list-api.types';
import {
  DEFAULT_ACTOR,
  FixedWriteClient,
  applyPresentFields,
  normalizeRequiredText,
  resolveActor,
  throwFixedBadRequest,
  throwFixedConflict,
  throwFixedNotFound,
  throwOnUniqueConstraintError,
} from 'src/common/utils/module-service.utils';
import { resolvePagination, runConfiguredGridQuery } from 'src/common/utils/module-list.utils';
const BANK_LIST_TABLE_NAME = 'bank master';
const BANK_LIST_AUDIT_SCREEN_NAME = 'Bank List Master';
const BANK_LIST_OPTIONAL_FIELDS = ['bnkShortName', 'bnkAlias', 'bnkRbiCode', 'bnkIbanSupported', 'bnkIsActive'];
@Injectable()
export class BankListService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}
  async save(saveBankListDto: SaveBankListDto): Promise<BankListPayload> {
    if (saveBankListDto.bnkId) {
      return this.updateBank(saveBankListDto);
    }
    return this.createBank(saveBankListDto);
  }
  async list(
    queryDto: ListBankListQueryDto,
  ): Promise<ConfiguredGridListResult<BankListItem, BankListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const result = await runConfiguredGridQuery<BankListItem>(
      this.configuredGridSqlService,
      { tableName: BANK_LIST_TABLE_NAME, alias: 'bank_list_grid', search: queryDto.search, page, limit, skip },
    );
    if (!result) {
      throwFixedBadRequest<BankListErrorDetail, BankListErrorResponse>('No configured grid found for bank list', []);
    }
    return result;
  }
  async getById(bnkId: string): Promise<BankListPayload> {
    const record = await this.prisma.bankMaster.findFirst({
      where: { bnkId, bnkIsDeleted: false },
    });
    if (!record) {
      throwFixedNotFound<BankListErrorDetail, BankListErrorResponse>(
        'Bank not found',
        'bnkId',
        `No active bank found with id ${bnkId}`,
      );
    }
    return this.toPayload(record);
  }
  async softDelete(bnkId: string): Promise<{ bnkId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.bankMaster.findFirst({
        where: { bnkId, bnkIsDeleted: false },
      });
      if (!existing) {
        throwFixedNotFound<BankListErrorDetail, BankListErrorResponse>(
          'Bank not found',
          'bnkId',
          `No active bank found with id ${bnkId}`,
        );
      }
      const bankUsageCount = await tx.accLedgerBankAccount.count({
        where: { lbaBankName: existing.bnkName, lbaIsDeleted: false },
      });
      if (bankUsageCount > 0) {
        throwFixedBadRequest<BankListErrorDetail, BankListErrorResponse>(
          'Cannot delete bank with active bank-account mappings',
          [{ field: 'bnkId', message: `Bank ${bnkId} is used in ${bankUsageCount} ledger bank account(s).` }],
        );
      }
      const modifiedOn = new Date();
      const result = await tx.bankMaster.updateMany({
        where: { bnkId, bnkIsDeleted: false },
        data: {
          bnkIsDeleted: true,
          bnkIsActive: false,
          bnkModifiedOn: modifiedOn,
          bnkModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        throwFixedNotFound<BankListErrorDetail, BankListErrorResponse>(
          'Bank not found',
          'bnkId',
          `No active bank found with id ${bnkId}`,
        );
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        bnkIsDeleted: true,
        bnkIsActive: false,
        bnkModifiedOn: modifiedOn,
        bnkModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: BANK_LIST_TABLE_NAME,
          screenName: BANK_LIST_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: bnkId,
          displayName: existing.bnkName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Bank soft deleted',
        },
        tx,
      );
      return { bnkId, deleted: true };
    });
  }
  private async createBank(saveBankListDto: SaveBankListDto): Promise<BankListPayload> {
    const normalizedName = normalizeRequiredText<BankListErrorDetail, BankListErrorResponse>(
      saveBankListDto.bnkName,
      'bnkName',
    );
    const now = new Date();
    const createdBy = resolveActor(saveBankListDto.bnkCreatedBy);
    const modifiedBy = resolveActor(saveBankListDto.bnkModifiedBy, createdBy);
    const data: Prisma.BankMasterUncheckedCreateInput = {
      bnkName: normalizedName,
      bnkCreatedOn: now,
      bnkCreatedBy: createdBy,
    };
    applyPresentFields(data, saveBankListDto, BANK_LIST_OPTIONAL_FIELDS);
    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureNameIsUnique(tx, normalizedName);
        const created = await tx.bankMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: BANK_LIST_TABLE_NAME,
            screenName: BANK_LIST_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.bnkId,
            displayName: payload.bnkName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: createdBy,
            notes: 'Bank created',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<BankListErrorDetail, BankListErrorResponse>(
        error,
        'Bank already exists',
        [{ field: 'bnkName', message: 'Duplicate bnkName is not allowed' }],
      );
      throw error;
    }
  }
  private async updateBank(saveBankListDto: SaveBankListDto): Promise<BankListPayload> {
    const bnkId = saveBankListDto.bnkId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.bankMaster.findFirst({
          where: { bnkId, bnkIsDeleted: false },
        });
        if (!existing) {
          throwFixedNotFound<BankListErrorDetail, BankListErrorResponse>(
            'Bank not found',
            'bnkId',
            `No active bank found with id ${bnkId}`,
          );
        }
        const normalizedName = normalizeRequiredText<BankListErrorDetail, BankListErrorResponse>(
          saveBankListDto.bnkName,
          'bnkName',
        );
        await this.ensureNameIsUnique(tx, normalizedName, bnkId);
        const data: Prisma.BankMasterUncheckedUpdateInput = {
          bnkName: normalizedName,
          bnkModifiedOn: new Date(),
          bnkModifiedBy: resolveActor(saveBankListDto.bnkModifiedBy),
        };
        applyPresentFields(data, saveBankListDto, BANK_LIST_OPTIONAL_FIELDS);
        const updated = await tx.bankMaster.update({ where: { bnkId }, data });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BANK_LIST_TABLE_NAME,
            screenName: BANK_LIST_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: bnkId,
            displayName: payload.bnkName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: resolveActor(saveBankListDto.bnkModifiedBy),
            notes: 'Bank updated',
          },
          tx,
        );
        return payload;
      });
    } catch (error: unknown) {
      throwOnUniqueConstraintError<BankListErrorDetail, BankListErrorResponse>(
        error,
        'Bank already exists',
        [{ field: 'bnkName', message: 'Duplicate bnkName is not allowed' }],
      );
      throw error;
    }
  }
  private async ensureNameIsUnique(
    tx: FixedWriteClient,
    bankName: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.bankMaster.findFirst({
      where: {
        bnkIsDeleted: false,
        bnkName: { equals: bankName, mode: 'insensitive' },
        ...(excludeId ? { bnkId: { not: excludeId } } : {}),
      },
      select: { bnkId: true },
    });
    if (existing) {
      throwFixedConflict<BankListErrorDetail, BankListErrorResponse>(
        'Bank name already exists',
        [{ field: 'bnkName', message: 'Duplicate bank name is not allowed' }],
      );
    }
  }
  private toPayload(record: BankMaster): BankListPayload {
    return {
      bnkId: record.bnkId,
      bnkName: record.bnkName,
      bnkShortName: record.bnkShortName,
      bnkAlias: record.bnkAlias,
      bnkRbiCode: record.bnkRbiCode,
      bnkIbanSupported: record.bnkIbanSupported,
      bnkIsActive: record.bnkIsActive,
      bnkIsDeleted: record.bnkIsDeleted,
      bnkSyncDate: record.bnkSyncDate ? record.bnkSyncDate.toISOString() : null,
      bnkCreatedOn: record.bnkCreatedOn.toISOString(),
      bnkCreatedBy: record.bnkCreatedBy,
      bnkModifiedOn: record.bnkModifiedOn.toISOString(),
      bnkModifiedBy: record.bnkModifiedBy,
    };
  }
}