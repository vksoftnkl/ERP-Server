import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { AccountTenderMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListTenderMasterQueryDto } from './dto/list-tender-master-query.dto';
import { SaveTenderMasterDto } from './dto/save-tender-master.dto';
import {
  TenderMasterErrorDetail,
  TenderMasterErrorResponse,
  TenderMasterListItem,
  TenderMasterListMeta,
  TenderMasterPayload,
} from './types/tender-master-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const TENDER_MASTER_TABLE_NAME = 'account_tender_master';
const TENDER_MASTER_AUDIT_SCREEN_NAME = 'Tender Master';

type TenderMasterWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class TenderMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) {}

  async save(saveTenderMasterDto: SaveTenderMasterDto): Promise<TenderMasterPayload> {
    if (saveTenderMasterDto.tndId) {
      return this.updateTender(saveTenderMasterDto);
    }

    return this.createTender(saveTenderMasterDto);
  }

  async list(
    queryDto: ListTenderMasterQueryDto,
  ): Promise<ConfiguredGridListResult<TenderMasterListItem, TenderMasterListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const hasStructuredFilters =
      queryDto.tndTypeId !== undefined ||
      queryDto.tndLedgerId !== undefined ||
      queryDto.tndIsActive !== undefined ||
      Boolean(queryDto.search?.trim());

    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }

    const where: Prisma.AccountTenderMasterWhereInput = {
      acctndIsDeleted: false,
    };

    if (queryDto.tndTypeId !== undefined) {
      where.acctndTypeId = this.parseTenderTypeId(queryDto.tndTypeId, 'tndTypeId');
    }

    if (queryDto.tndLedgerId !== undefined) {
      where.acctndLedgerId = queryDto.tndLedgerId;
    }

    if (queryDto.tndIsActive !== undefined) {
      where.acctndIsActive = queryDto.tndIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { acctndName: { contains: search, mode: 'insensitive' } },
        { acctndRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.accountTenderMaster.count({ where }),
      this.prisma.accountTenderMaster.findMany({
        where,
        orderBy: [{ acctndDisplayPosition: 'asc' }, { acctndName: 'asc' }, { acctndId: 'asc' }],
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

  private async listFromConfiguredGridSql(
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<TenderMasterListItem, TenderMasterListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: TENDER_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      TENDER_MASTER_TABLE_NAME,
    );
    if (primaryConfiguredGrids.length === 0) {
      return null;
    }

    for (const configuredGrid of primaryConfiguredGrids) {
      const rawGridSql = configuredGrid.gridSql?.trim();
      if (!rawGridSql) {
        continue;
      }

      const validation = this.configuredGridSqlService.validateBaseSql({
        sql: rawGridSql,
        tableName: TENDER_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }

      try {
        const result = await this.configuredGridSqlService.runPagedQuery<TenderMasterListItem>({
          baseSql: validation.normalizedSql,
          alias: 'tender_master_grid',
          limit,
          skip,
          gridId: configuredGrid.gridId,
        });

        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
          styles: result.styles,
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  async getById(tndId: string): Promise<TenderMasterPayload> {
    const record = await this.prisma.accountTenderMaster.findFirst({
      where: {
        acctndId: tndId,
        acctndIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(tndId);
    }

    return this.toPayload(record);
  }

  async softDelete(tndId: string): Promise<{ tndId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.accountTenderMaster.findFirst({
        where: {
          acctndId: tndId,
          acctndIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(tndId);
      }

      const modifiedOn = new Date();
      const result = await tx.accountTenderMaster.updateMany({
        where: {
          acctndId: tndId,
          acctndIsDeleted: false,
        },
        data: {
          acctndIsDeleted: true,
          acctndIsActive: false,
          acctndModifiedOn: modifiedOn,
          acctndModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(tndId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        acctndIsDeleted: true,
        acctndIsActive: false,
        acctndModifiedOn: modifiedOn,
        acctndModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TENDER_MASTER_TABLE_NAME,
          screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: tndId,
          displayName: existing.acctndName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Tender soft deleted',
        },
        tx,
      );

      return {
        tndId,
        deleted: true,
      };
    });
  }

  private async createTender(
    saveTenderMasterDto: SaveTenderMasterDto,
  ): Promise<TenderMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const tndName = this.normalizeRequiredName(saveTenderMasterDto.tndName);
        const tndTypeId = this.parseTenderTypeId(saveTenderMasterDto.tndTypeId, 'tndTypeId');
        const tndRemarks = this.normalizeNullableString(saveTenderMasterDto.tndRemarks);
        const tndMinAmount = this.toInputNumber(saveTenderMasterDto.tndMinAmount, 'tndMinAmount');
        const tndMaxAmount = this.toInputNullableNumber(
          saveTenderMasterDto.tndMaxAmount,
          'tndMaxAmount',
        );
        const tndSurchargePerc = this.toInputNullableNumber(
          saveTenderMasterDto.tndSurchargePerc,
          'tndSurchargePerc',
        );
        this.validateAmountRange(tndMinAmount, tndMaxAmount);

        await this.ensureTenderTypeExists(tndTypeId, tx);
        await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx);
        await this.ensureNameIsUnique(tx, tndName, tndTypeId);

        const now = new Date();
        const data: Prisma.AccountTenderMasterUncheckedCreateInput = {
          acctndTypeId: tndTypeId,
          acctndName: tndName,
          acctndShortName: this.buildShortName(tndName),
          acctndLedgerId: saveTenderMasterDto.tndLedgerId,
          acctndMinAmount: tndMinAmount,
          acctndCreatedOn: now,
          acctndCreatedBy: DEFAULT_ACTOR,
          acctndModifiedOn: now,
          acctndModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndMaxAmount')) {
          data.acctndMaxAmount = tndMaxAmount;
        }

        if (
          this.hasOwnProperty(saveTenderMasterDto, 'tndDisplayPosition') &&
          saveTenderMasterDto.tndDisplayPosition !== undefined
        ) {
          data.acctndDisplayPosition = saveTenderMasterDto.tndDisplayPosition;
        }

        if (
          this.hasOwnProperty(saveTenderMasterDto, 'tndSurchargePerc') &&
          tndSurchargePerc !== undefined &&
          tndSurchargePerc !== null
        ) {
          data.acctndSurchargePerc = tndSurchargePerc;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndIsActive')) {
          data.acctndIsActive = saveTenderMasterDto.tndIsActive;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndRemarks')) {
          data.acctndRemarks = tndRemarks;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndEditSurcharge')) {
          data.acctndEditSurcharge = saveTenderMasterDto.tndEditSurcharge;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndEditLedger')) {
          data.acctndEditLedger = saveTenderMasterDto.tndEditLedger;
        }

        const created = await tx.accountTenderMaster.create({ data });
        const payload = this.toPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: TENDER_MASTER_TABLE_NAME,
            screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: payload.tndId,
            displayName: payload.tndName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Tender created',
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

  private async updateTender(
    saveTenderMasterDto: SaveTenderMasterDto,
  ): Promise<TenderMasterPayload> {
    const tndId = saveTenderMasterDto.tndId!;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.accountTenderMaster.findFirst({
          where: {
            acctndId: tndId,
            acctndIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(tndId);
        }

        const tndName = this.normalizeRequiredName(saveTenderMasterDto.tndName);
        const tndTypeId = this.parseTenderTypeId(saveTenderMasterDto.tndTypeId, 'tndTypeId');
        const tndRemarks = this.normalizeNullableString(saveTenderMasterDto.tndRemarks);
        const tndMinAmount = this.toInputNumber(saveTenderMasterDto.tndMinAmount, 'tndMinAmount');
        const tndMaxAmount = this.toInputNullableNumber(
          saveTenderMasterDto.tndMaxAmount,
          'tndMaxAmount',
        );
        const tndSurchargePerc = this.toInputNullableNumber(
          saveTenderMasterDto.tndSurchargePerc,
          'tndSurchargePerc',
        );
        this.validateAmountRange(tndMinAmount, tndMaxAmount);

        await this.ensureTenderTypeExists(tndTypeId, tx);
        await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx);
        await this.ensureNameIsUnique(tx, tndName, tndTypeId, tndId);

        const data: Prisma.AccountTenderMasterUncheckedUpdateInput = {
          acctndTypeId: tndTypeId,
          acctndName: tndName,
          acctndShortName: this.buildShortName(tndName),
          acctndLedgerId: saveTenderMasterDto.tndLedgerId,
          acctndMinAmount: tndMinAmount,
          acctndModifiedOn: new Date(),
          acctndModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndMaxAmount')) {
          data.acctndMaxAmount = tndMaxAmount;
        }

        if (
          this.hasOwnProperty(saveTenderMasterDto, 'tndDisplayPosition') &&
          saveTenderMasterDto.tndDisplayPosition !== undefined
        ) {
          data.acctndDisplayPosition = saveTenderMasterDto.tndDisplayPosition;
        }

        if (
          this.hasOwnProperty(saveTenderMasterDto, 'tndSurchargePerc') &&
          tndSurchargePerc !== undefined &&
          tndSurchargePerc !== null
        ) {
          data.acctndSurchargePerc = tndSurchargePerc;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndIsActive')) {
          data.acctndIsActive = saveTenderMasterDto.tndIsActive;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndRemarks')) {
          data.acctndRemarks = tndRemarks;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndEditSurcharge')) {
          data.acctndEditSurcharge = saveTenderMasterDto.tndEditSurcharge;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndEditLedger')) {
          data.acctndEditLedger = saveTenderMasterDto.tndEditLedger;
        }

        const updated = await tx.accountTenderMaster.update({
          where: {
            acctndId: tndId,
          },
          data,
        });
        const payload = this.toPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: TENDER_MASTER_TABLE_NAME,
            screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: tndId,
            displayName: payload.tndName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Tender updated',
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

  private async ensureTenderTypeExists(typeId: bigint, tx: TenderMasterWriteClient): Promise<void> {
    const tenderType = await tx.accountTenderTypes.findFirst({
      where: {
        accttTypeId: typeId,
        accttTypeIsDeleted: false,
      },
      select: {
        accttTypeId: true,
      },
    });

    if (!tenderType) {
      this.throwBadRequest('Tender type does not exist', [
        {
          field: 'tndTypeId',
          message: `No active tender type found with id ${typeId.toString()}`,
        },
      ]);
    }
  }

  private async ensureLedgerExists(ledgerId: string, tx: TenderMasterWriteClient): Promise<void> {
    const ledger = await tx.accLedgerMaster.findFirst({
      where: {
        ledId: ledgerId,
        ledIsDeleted: false,
      },
      select: {
        ledId: true,
      },
    });

    if (!ledger) {
      this.throwBadRequest('Ledger does not exist', [
        {
          field: 'tndLedgerId',
          message: `No active account ledger found with id ${ledgerId}`,
        },
      ]);
    }
  }

  private async ensureNameIsUnique(
    tx: TenderMasterWriteClient,
    tndName: string,
    tndTypeId: bigint,
    excludeTndId?: string,
  ): Promise<void> {
    const existing = await tx.accountTenderMaster.findFirst({
      where: {
        acctndIsDeleted: false,
        acctndTypeId: tndTypeId,
        acctndName: {
          equals: tndName,
          mode: 'insensitive',
        },
        ...(excludeTndId
          ? {
              acctndId: {
                not: excludeTndId,
              },
            }
          : {}),
      },
      select: {
        acctndId: true,
      },
    });

    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Tender name already exists for this tender type', [
          {
            field: 'tndName',
            message: 'Duplicate tndName is not allowed for this tender type',
          },
        ]),
      );
    }
  }

  private validateAmountRange(tndMinAmount: number, tndMaxAmount: number | null | undefined): void {
    if (tndMaxAmount === null || tndMaxAmount === undefined) {
      return;
    }

    if (tndMaxAmount < tndMinAmount) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'tndMaxAmount',
          message: 'tndMaxAmount must be greater than or equal to tndMinAmount',
        },
      ]);
    }
  }

  private normalizeRequiredName(value: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'tndName',
          message: 'tndName must not be empty',
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

  private buildShortName(value: string): string {
    return value;
  }

  private parseTenderTypeId(value: string, field: string): bigint {
    const normalized = value.trim();
    if (!/^\d+$/.test(normalized)) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid numeric identifier`,
        },
      ]);
    }

    return BigInt(normalized);
  }

  private toInputNumber(value: number, field: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid number`,
        },
      ]);
    }

    return parsed;
  }

  private toInputNullableNumber(
    value: number | null | undefined,
    field: string,
  ): number | null | undefined {
    if (value === undefined) {
      return undefined;
    }

    if (value === null) {
      return null;
    }

    return this.toInputNumber(value, field);
  }

  private toPayload(record: AccountTenderMaster): TenderMasterPayload {
    return {
      tndId: record.acctndId,
      tndTypeId: record.acctndTypeId.toString(),
      tndName: record.acctndName,
      tndLedgerId: record.acctndLedgerId,
      tndMinAmount: this.toNumber(record.acctndMinAmount),
      tndMaxAmount: this.toNullableNumber(record.acctndMaxAmount),
      tndDisplayPosition: record.acctndDisplayPosition,
      tndSurchargePerc: this.toNumber(record.acctndSurchargePerc),
      tndIsActive: record.acctndIsActive,
      tndIsDeleted: record.acctndIsDeleted,
      tndRemarks: record.acctndRemarks,
      tndEditSurcharge: record.acctndEditSurcharge,
      tndEditLedger: record.acctndEditLedger,
      tndSyncDate: record.acctndSyncDate ? record.acctndSyncDate.toISOString() : null,
      tndCreatedOn: record.acctndCreatedOn.toISOString(),
      tndCreatedBy: record.acctndCreatedBy,
      tndModifiedOn: record.acctndModifiedOn.toISOString(),
      tndModifiedBy: record.acctndModifiedBy,
    };
  }

  private toNumber(value: Prisma.Decimal | number): number {
    if (typeof value === 'number') {
      return value;
    }

    return Number(value.toString());
  }

  private toNullableNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }

    return this.toNumber(value);
  }

  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Tender already exists', [
          {
            field: 'tndName',
            message: 'Duplicate tender unique value is not allowed',
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

  private throwNotFound(tndId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Tender not found', [
        {
          field: 'tndId',
          message: `No active tender found with id ${tndId}`,
        },
      ]),
    );
  }

  private throwBadRequest(message: string, errors: TenderMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private buildErrorResponse(
    message: string,
    errors: TenderMasterErrorDetail[] = [],
  ): TenderMasterErrorResponse {
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
