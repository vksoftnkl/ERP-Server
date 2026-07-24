import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, SaleAgent } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { AccountLedgerMastersService } from '../../accountsModule/accountLedgerMasters/account-ledger-masters.service';
import { SaveAccountLedgerMasterDto } from '../../accountsModule/accountLedgerMasters/dto/save-account-ledger-master.dto';
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
const SALE_AGENT_RELATIONS = {
  company: { select: { compName: true } },
  branch: { select: { brName: true } },
  group: { select: { saGrpName: true } },
} satisfies Prisma.SaleAgentInclude;
type SaleAgentWithRelations = Prisma.SaleAgentGetPayload<{
  include: typeof SALE_AGENT_RELATIONS;
}>;
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
// Sale-agent fields mirrored into the linked account ledger on create/update. Each pair
// is [sale-agent DTO field, ledger DTO field]; only keys present on the incoming payload
// are copied, so partial updates stay partial.
const SALE_AGENT_TO_LEDGER_FIELD_MAP: ReadonlyArray<[keyof SaveSaleAgentDto, string]> = [
  ['saAlias', 'ledAlias'],
  ['saMobile1', 'ledPhone1'],
  ['saMobile2', 'ledPhone2'],
  ['saAddr1', 'ledAddr1'],
  ['saAddr2', 'ledAddr2'],
  ['saCity', 'ledCity'],
  ['saDistrict', 'ledDistrict'],
  ['saState', 'ledStateName'],
  ['saPincode', 'ledPin'],
  ['saPanNo', 'ledPanNo'],
  ['saGstin', 'ledGstinNo'],
  ['saRemarks', 'ledRemarks'],
  ['saIsActive', 'ledIsActive'],
];
@Injectable()
export class SaleAgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
    private readonly accountLedgerMastersService: AccountLedgerMastersService,
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
      include: SALE_AGENT_RELATIONS,
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
      // Soft-delete the linked account ledger (shares sa_id as its PK) alongside the sale
      // agent so the shared identity stays consistent. Guarded for legacy agents with no ledger.
      await tx.accLedgerMaster.updateMany({
        where: { ledId: saId, ledIsDeleted: false },
        data: {
          ledIsDeleted: true,
          ledIsActive: false,
          ledModifiedOn: modifiedOn,
          ledModifiedBy: actor,
        },
      });
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
        // Provision the linked account ledger first, then reuse its led_id as the sale
        // agent's sa_id so the two masters share one identity (1:1 link), mirroring how
        // customer/supplier provision their ledger. The ledger requires an account group;
        // any active one satisfies the FK for a sale-agent ledger.
        const ledgerGroupId = await this.resolveAnyAccountGroupId(tx);
        const ledgerDto = this.buildLinkedLedgerDto(saveSaleAgentDto, {
          name: normalizedName,
          groupId: ledgerGroupId,
          companyId,
          branchId,
        });
        const ledger = await this.accountLedgerMastersService.createLedgerWithinTx(ledgerDto, tx);
        data.saId = ledger.ledId;
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
        // Keep the linked account ledger (shares sa_id as its PK) in sync with the edited
        // sale-agent fields, mirroring how createSaleAgent provisions it. Same transaction =>
        // atomic. Guarded so legacy agents with no linked ledger stay a no-op.
        const linkedLedger = await tx.accLedgerMaster.findFirst({
          where: { ledId: saId, ledIsDeleted: false },
          select: { ledId: true, ledName: true, ledGroupId: true },
        });
        if (linkedLedger) {
          const ledgerDto = this.buildLinkedLedgerDto(saveSaleAgentDto, {
            name: normalizedName,
            groupId: linkedLedger.ledGroupId,
            companyId: nextCompanyId,
            branchId: nextBranchId,
          });
          ledgerDto.ledId = saId;
          try {
            await this.accountLedgerMastersService.updateLedgerWithinTx(ledgerDto, tx);
          } catch (error: unknown) {
            // The linked-ledger write enforces company-scoped name uniqueness. Surface a
            // collision in the sale agent's own vocabulary instead of leaking the ledName field.
            if (error instanceof ConflictException) {
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
            throw error;
          }
        }
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
  // Pick any active account group. The linked ledger requires a non-nullable ledGroupId FK,
  // but a sale agent has no account-group of its own, so any existing group satisfies it.
  private async resolveAnyAccountGroupId(tx: SaleAgentWriteClient): Promise<string> {
    const group = await tx.accountGroup.findFirst({
      where: { accGroupIsDeleted: false },
      select: { accGroupId: true },
    });
    if (!group) {
      throwSalesBadRequest<SaleAgentErrorDetail, SaleAgentErrorResponse>(
        'No account group available',
        [
          {
            field: 'request',
            message: 'At least one account group must exist to provision the sale agent ledger',
          },
        ],
      );
    }
    return group.accGroupId;
  }
  // Build the linked-ledger DTO from the sale-agent payload: the required identity fields
  // (group, name, company, branch) plus any mirrored optional fields present on the request.
  private buildLinkedLedgerDto(
    saveSaleAgentDto: SaveSaleAgentDto,
    resolved: { name: string; groupId: string; companyId: string; branchId: string | null },
  ): SaveAccountLedgerMasterDto {
    const ledgerDto: SaveAccountLedgerMasterDto = {
      ledGroupId: resolved.groupId,
      ledName: resolved.name,
    };
    const ledgerRecord = ledgerDto as unknown as Record<string, unknown>;
    ledgerRecord.ledCompanyId = resolved.companyId;
    ledgerRecord.ledBranchId = resolved.branchId;
    const dtoRecord = saveSaleAgentDto as unknown as Record<string, unknown>;
    for (const [saField, ledField] of SALE_AGENT_TO_LEDGER_FIELD_MAP) {
      if (hasOwnProperty(saveSaleAgentDto, saField)) {
        ledgerRecord[ledField] = dtoRecord[saField];
      }
    }
    return ledgerDto;
  }
  private toPayload(record: SaleAgent | SaleAgentWithRelations): SaleAgentPayload {
    return {
      saId: record.saId,
      saCompanyId: record.saCompanyId,
      saCompanyName: 'company' in record ? (record.company?.compName ?? null) : null,
      saBranchId: record.saBranchId,
      saBranchName: 'branch' in record ? (record.branch?.brName ?? null) : null,
      saGroupId: record.saGroupId,
      saGroupName: 'group' in record ? (record.group?.saGrpName ?? null) : null,
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