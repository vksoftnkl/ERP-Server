import { Injectable } from '@nestjs/common';
import { Prisma, SaleAgent } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveSaleAgentDto } from './dto/save-sale-agent.dto';
import {
  SaleAgentErrorDetail,
  SaleAgentErrorResponse,
  SaleAgentPayload,
} from './types/sale-agent-api.types';
import {
  DEFAULT_ACTOR,
  SalesWriteClient,
  applyPresentFields,
  hasOwnProperty,
  isForeignKeyConstraintError,
  normalizeNullableString,
  normalizeRequiredText,
  resolveActor,
  throwOnUniqueConstraintError,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
} from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
const SALE_AGENT_TABLE_NAME = 'sale agents';
const SALE_AGENT_AUDIT_SCREEN_NAME = 'Sale Agent Master';
const SALE_AGENT_OPTIONAL_FIELDS = [
  'saAlias',
  'saMobile1',
  'saMobile2',
  'saAddr1',
  'saAddr2',
  'saCity',
  'saDistrict',
  'saState',
  'saPincode',
  'saPanNo',
  'saGstin',
  'saRemarks',
  'saIsActive',
];
type SaleAgentWriteClient = SalesWriteClient;
@Injectable()
export class SaleAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async save(saveSaleAgentDto: SaveSaleAgentDto): Promise<SaleAgentPayload> {
    if (saveSaleAgentDto.saId) {
      return this.updateSaleAgent(saveSaleAgentDto);
    }
    return this.createSaleAgent(saveSaleAgentDto);
  }

  async getById(saId: string): Promise<SaleAgentPayload> {
    const record = await this.prisma.saleAgent.findFirst({
      where: {
        saId,
        saIsDeleted: false,
      },
    });

    if (!record) {
      throwSalesNotFound<SaleAgentErrorDetail, SaleAgentErrorResponse>(
        'Sale agent not found',
        'saId',
        `No active sale agent found with id ${saId}`,
      );
    }

    return this.toPayload(record);
  }

  async softDelete(saId: string): Promise<{ saId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.saleAgent.findFirst({
        where: {
          saId,
          saIsDeleted: false,
        },
      });

      if (!existing) {
        throwSalesNotFound<SaleAgentErrorDetail, SaleAgentErrorResponse>(
          'Sale agent not found',
          'saId',
          `No active sale agent found with id ${saId}`,
        );
      }

      const actor = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
      const modifiedOn = new Date();
      const result = await tx.saleAgent.updateMany({
        where: {
          saId,
          saIsDeleted: false,
        },
        data: {
          saIsDeleted: true,
          saIsActive: false,
          saModifiedOn: modifiedOn,
          saModifiedBy: actor,
        },
      });

      if (result.count === 0) {
        throwSalesNotFound<SaleAgentErrorDetail, SaleAgentErrorResponse>(
          'Sale agent not found',
          'saId',
          `No active sale agent found with id ${saId}`,
        );
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        saIsDeleted: true,
        saIsActive: false,
        saModifiedOn: modifiedOn,
        saModifiedBy: actor,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: SALE_AGENT_TABLE_NAME,
          screenName: SALE_AGENT_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: saId,
          displayName: existing.saName,
          originalRecord,
          modifiedRecord,
          userId: actor,
          notes: 'Sale agent soft deleted',
        },
        tx,
      );

      return {
        saId,
        deleted: true,
      };
    });
  }

  private async createSaleAgent(saveSaleAgentDto: SaveSaleAgentDto): Promise<SaleAgentPayload> {
    const now = new Date();
    const actor = resolveActor(
      saveSaleAgentDto.saCreatedBy,
      this.requestContextService.getUserId(),
    );
    const normalizedName = normalizeRequiredText<SaleAgentErrorDetail, SaleAgentErrorResponse>(
      saveSaleAgentDto.saName,
      'saName',
    );
    const normalizedCode = normalizeNullableString(saveSaleAgentDto.saCode) ?? null;
    const companyId = saveSaleAgentDto.saCompanyId;
    const branchId = saveSaleAgentDto.saBranchId ?? null;
    const groupId = saveSaleAgentDto.saGroupId;

    const data: Prisma.SaleAgentUncheckedCreateInput = {
      saCompanyId: companyId,
      saBranchId: branchId,
      saGroupId: groupId,
      saCode: normalizedCode,
      saName: normalizedName,
      saCreatedOn: now,
      saCreatedBy: actor,
      saModifiedOn: now,
      saModifiedBy: actor,
    };
    this.applyOptionalFields(data, saveSaleAgentDto);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureCompanyExists(tx, companyId);
        await this.ensureBranchExists(tx, branchId);
        await this.ensureGroupExists(tx, groupId);
        await this.ensureNameIsUnique(tx, normalizedName, companyId);
        await this.ensureCodeIsUnique(tx, normalizedCode, companyId);

        const created = await tx.saleAgent.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: SALE_AGENT_TABLE_NAME,
            screenName: SALE_AGENT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.saId,
            displayName: payload.saName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: actor,
            notes: 'Sale agent created',
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

  private async updateSaleAgent(saveSaleAgentDto: SaveSaleAgentDto): Promise<SaleAgentPayload> {
    const saId = saveSaleAgentDto.saId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.saleAgent.findFirst({
          where: {
            saId,
            saIsDeleted: false,
          },
        });

        if (!existing) {
          throwSalesNotFound<SaleAgentErrorDetail, SaleAgentErrorResponse>(
            'Sale agent not found',
            'saId',
            `No active sale agent found with id ${saId}`,
          );
        }

        const normalizedName = normalizeRequiredText<SaleAgentErrorDetail, SaleAgentErrorResponse>(
          saveSaleAgentDto.saName,
          'saName',
        );
        const nextCompanyId = saveSaleAgentDto.saCompanyId;
        const nextGroupId = saveSaleAgentDto.saGroupId;
        const nextBranchId = hasOwnProperty(saveSaleAgentDto, 'saBranchId')
          ? (saveSaleAgentDto.saBranchId ?? null)
          : existing.saBranchId;
        const nextCode = hasOwnProperty(saveSaleAgentDto, 'saCode')
          ? (normalizeNullableString(saveSaleAgentDto.saCode) ?? null)
          : existing.saCode;

        await this.ensureCompanyExists(tx, nextCompanyId);
        await this.ensureBranchExists(tx, nextBranchId);
        await this.ensureGroupExists(tx, nextGroupId);
        await this.ensureNameIsUnique(tx, normalizedName, nextCompanyId, saId);
        await this.ensureCodeIsUnique(tx, nextCode, nextCompanyId, saId);

        const data: Prisma.SaleAgentUncheckedUpdateInput = {
          saCompanyId: nextCompanyId,
          saBranchId: nextBranchId,
          saGroupId: nextGroupId,
          saCode: nextCode,
          saName: normalizedName,
          saModifiedOn: new Date(),
          saModifiedBy: resolveActor(
            saveSaleAgentDto.saModifiedBy,
            this.requestContextService.getUserId(),
          ),
        };
        this.applyOptionalFields(data, saveSaleAgentDto);

        const updated = await tx.saleAgent.update({
          where: {
            saId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: SALE_AGENT_TABLE_NAME,
            screenName: SALE_AGENT_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: saId,
            displayName: payload.saName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: payload.saModifiedBy ?? DEFAULT_ACTOR,
            notes: 'Sale agent updated',
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

  private async ensureCompanyExists(tx: SaleAgentWriteClient, companyId: string): Promise<void> {
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
      throwSalesBadRequest<SaleAgentErrorDetail, SaleAgentErrorResponse>('Company does not exist', [
        {
          field: 'saCompanyId',
          message: `No active company found with id ${companyId}`,
        },
      ]);
    }
  }

  private async ensureBranchExists(
    tx: SaleAgentWriteClient,
    branchId: string | null,
  ): Promise<void> {
    if (branchId === null) {
      return;
    }

    const branch = await tx.branchMaster.findFirst({
      where: {
        brId: branchId,
        brIsDeleted: false,
      },
      select: {
        brId: true,
      },
    });

    if (!branch) {
      throwSalesBadRequest<SaleAgentErrorDetail, SaleAgentErrorResponse>('Branch does not exist', [
        {
          field: 'saBranchId',
          message: `No active branch found with id ${branchId}`,
        },
      ]);
    }
  }

  private async ensureGroupExists(tx: SaleAgentWriteClient, groupId: string): Promise<void> {
    const group = await tx.saleAgentGroup.findFirst({
      where: {
        saGrpId: groupId,
        saGrpIsDeleted: false,
      },
      select: {
        saGrpId: true,
      },
    });

    if (!group) {
      throwSalesBadRequest<SaleAgentErrorDetail, SaleAgentErrorResponse>(
        'Sale agent group does not exist',
        [
          {
            field: 'saGroupId',
            message: `No active sale agent group found with id ${groupId}`,
          },
        ],
      );
    }
  }

  private async ensureNameIsUnique(
    tx: SaleAgentWriteClient,
    agentName: string,
    companyId: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await tx.saleAgent.findFirst({
      where: {
        saIsDeleted: false,
        saCompanyId: companyId,
        saName: {
          equals: agentName,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              saId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        saId: true,
      },
    });

    if (existing) {
      throwSalesConflict<SaleAgentErrorDetail, SaleAgentErrorResponse>(
        'Sale agent name already exists for this company',
        [
          {
            field: 'saName',
            message: 'Duplicate sale agent name is not allowed for this company',
          },
        ],
      );
    }
  }

  private async ensureCodeIsUnique(
    tx: SaleAgentWriteClient,
    agentCode: string | null,
    companyId: string,
    excludeId?: string,
  ): Promise<void> {
    if (agentCode === null) {
      return;
    }

    const existing = await tx.saleAgent.findFirst({
      where: {
        saIsDeleted: false,
        saCompanyId: companyId,
        saCode: {
          equals: agentCode,
          mode: 'insensitive',
        },
        ...(excludeId
          ? {
              saId: {
                not: excludeId,
              },
            }
          : {}),
      },
      select: {
        saId: true,
      },
    });

    if (existing) {
      throwSalesConflict<SaleAgentErrorDetail, SaleAgentErrorResponse>(
        'Sale agent code already exists for this company',
        [
          {
            field: 'saCode',
            message: 'Duplicate sale agent code is not allowed for this company',
          },
        ],
      );
    }
  }

  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<SaleAgentErrorDetail, SaleAgentErrorResponse>(
      error,
      'Sale agent already exists',
      [
        {
          field: 'saName',
          message: 'Duplicate sale agent is not allowed',
        },
      ],
    );
    if (isForeignKeyConstraintError(error)) {
      throwSalesBadRequest<SaleAgentErrorDetail, SaleAgentErrorResponse>(
        'Invalid relation reference',
        [
          {
            field: 'request',
            message: 'Referenced company, branch or sale agent group does not exist',
          },
        ],
      );
    }
  }

  private applyOptionalFields(
    data: Prisma.SaleAgentUncheckedCreateInput | Prisma.SaleAgentUncheckedUpdateInput,
    saveSaleAgentDto: SaveSaleAgentDto,
  ): void {
    applyPresentFields(data, saveSaleAgentDto, SALE_AGENT_OPTIONAL_FIELDS);
  }

  private toPayload(record: SaleAgent): SaleAgentPayload {
    return {
      saId: record.saId,
      saCompanyId: record.saCompanyId,
      saBranchId: record.saBranchId,
      saGroupId: record.saGroupId,
      saCode: record.saCode,
      saName: record.saName,
      saAlias: record.saAlias,
      saMobile1: record.saMobile1,
      saMobile2: record.saMobile2,
      saAddr1: record.saAddr1,
      saAddr2: record.saAddr2,
      saCity: record.saCity,
      saDistrict: record.saDistrict,
      saState: record.saState,
      saPincode: record.saPincode,
      saPanNo: record.saPanNo,
      saGstin: record.saGstin,
      saRemarks: record.saRemarks,
      saIsActive: record.saIsActive,
      saIsDeleted: record.saIsDeleted,
      saSyncDate: record.saSyncDate ? record.saSyncDate.toISOString() : null,
      saCreatedOn: record.saCreatedOn.toISOString(),
      saCreatedBy: record.saCreatedBy,
      saModifiedOn: record.saModifiedOn.toISOString(),
      saModifiedBy: record.saModifiedBy,
    };
  }
}
