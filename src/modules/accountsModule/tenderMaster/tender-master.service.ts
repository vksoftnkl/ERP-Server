import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { Prisma, TenderMaster } from '@prisma/client';
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
const TENDER_MASTER_TABLE_NAME = 'tender_master';
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
  ): Promise<{ items: TenderMasterListItem[]; meta: TenderMasterListMeta }> {
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

    const where: Prisma.TenderMasterWhereInput = {
      tndIsDeleted: false,
    };

    if (queryDto.tndTypeId !== undefined) {
      where.tndTypeId = queryDto.tndTypeId;
    }

    if (queryDto.tndLedgerId !== undefined) {
      where.tndLedgerId = queryDto.tndLedgerId;
    }

    if (queryDto.tndIsActive !== undefined) {
      where.tndIsActive = queryDto.tndIsActive;
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { tndName: { contains: search, mode: 'insensitive' } },
        { tndRemarks: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [total, records] = await Promise.all([
      this.prisma.tenderMaster.count({ where }),
      this.prisma.tenderMaster.findMany({
        where,
        orderBy: [{ tndDisplayPosition: 'asc' }, { tndName: 'asc' }, { tndId: 'asc' }],
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
  ): Promise<{ items: TenderMasterListItem[]; meta: TenderMasterListMeta } | null> {
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
        });

        return {
          items: result.items,
          meta: {
            page,
            limit,
            total: result.total,
            total_pages: Math.ceil(result.total / limit),
          },
        };
      } catch {
        continue;
      }
    }

    return null;
  }

  async getById(tndId: string): Promise<TenderMasterPayload> {
    const record = await this.prisma.tenderMaster.findFirst({
      where: {
        tndId,
        tndIsDeleted: false,
      },
    });

    if (!record) {
      this.throwNotFound(tndId);
    }

    return this.toPayload(record);
  }

  async softDelete(tndId: string): Promise<{ tndId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.tenderMaster.findFirst({
        where: {
          tndId,
          tndIsDeleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound(tndId);
      }

      const modifiedOn = new Date();
      const result = await tx.tenderMaster.updateMany({
        where: {
          tndId,
          tndIsDeleted: false,
        },
        data: {
          tndIsDeleted: true,
          tndIsActive: false,
          tndModifiedOn: modifiedOn,
          tndModifiedBy: DEFAULT_ACTOR,
        },
      });

      if (result.count === 0) {
        this.throwNotFound(tndId);
      }

      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        tndIsDeleted: true,
        tndIsActive: false,
        tndModifiedOn: modifiedOn,
        tndModifiedBy: DEFAULT_ACTOR,
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: TENDER_MASTER_TABLE_NAME,
          screenName: TENDER_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: tndId,
          displayName: existing.tndName,
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

        await this.ensureTenderTypeExists(saveTenderMasterDto.tndTypeId, tx);
        await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx);
        await this.ensureNameIsUnique(tx, tndName, saveTenderMasterDto.tndTypeId);

        const now = new Date();
        const data: Prisma.TenderMasterUncheckedCreateInput = {
          tndTypeId: saveTenderMasterDto.tndTypeId,
          tndName,
          tndLedgerId: saveTenderMasterDto.tndLedgerId,
          tndMinAmount,
          tndCreatedOn: now,
          tndCreatedBy: DEFAULT_ACTOR,
          tndModifiedOn: now,
          tndModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndMaxAmount')) {
          data.tndMaxAmount = tndMaxAmount;
        }

        if (
          this.hasOwnProperty(saveTenderMasterDto, 'tndDisplayPosition') &&
          saveTenderMasterDto.tndDisplayPosition !== undefined
        ) {
          data.tndDisplayPosition = saveTenderMasterDto.tndDisplayPosition;
        }

        if (
          this.hasOwnProperty(saveTenderMasterDto, 'tndSurchargePerc') &&
          tndSurchargePerc !== undefined
        ) {
          data.tndSurchargePerc = tndSurchargePerc!;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndIsActive')) {
          data.tndIsActive = saveTenderMasterDto.tndIsActive;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndRemarks')) {
          data.tndRemarks = tndRemarks;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndEditSurcharge')) {
          data.tndEditSurcharge = saveTenderMasterDto.tndEditSurcharge;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndEditLedger')) {
          data.tndEditLedger = saveTenderMasterDto.tndEditLedger;
        }

        const created = await tx.tenderMaster.create({ data });
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
        const existing = await tx.tenderMaster.findFirst({
          where: {
            tndId,
            tndIsDeleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound(tndId);
        }

        const tndName = this.normalizeRequiredName(saveTenderMasterDto.tndName);
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

        await this.ensureTenderTypeExists(saveTenderMasterDto.tndTypeId, tx);
        await this.ensureLedgerExists(saveTenderMasterDto.tndLedgerId, tx);
        await this.ensureNameIsUnique(tx, tndName, saveTenderMasterDto.tndTypeId, tndId);

        const data: Prisma.TenderMasterUncheckedUpdateInput = {
          tndTypeId: saveTenderMasterDto.tndTypeId,
          tndName,
          tndLedgerId: saveTenderMasterDto.tndLedgerId,
          tndMinAmount,
          tndModifiedOn: new Date(),
          tndModifiedBy: DEFAULT_ACTOR,
        };

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndMaxAmount')) {
          data.tndMaxAmount = tndMaxAmount;
        }

        if (
          this.hasOwnProperty(saveTenderMasterDto, 'tndDisplayPosition') &&
          saveTenderMasterDto.tndDisplayPosition !== undefined
        ) {
          data.tndDisplayPosition = saveTenderMasterDto.tndDisplayPosition;
        }

        if (
          this.hasOwnProperty(saveTenderMasterDto, 'tndSurchargePerc') &&
          tndSurchargePerc !== undefined
        ) {
          data.tndSurchargePerc = tndSurchargePerc!;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndIsActive')) {
          data.tndIsActive = saveTenderMasterDto.tndIsActive;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndRemarks')) {
          data.tndRemarks = tndRemarks;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndEditSurcharge')) {
          data.tndEditSurcharge = saveTenderMasterDto.tndEditSurcharge;
        }

        if (this.hasOwnProperty(saveTenderMasterDto, 'tndEditLedger')) {
          data.tndEditLedger = saveTenderMasterDto.tndEditLedger;
        }

        const updated = await tx.tenderMaster.update({
          where: {
            tndId,
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

  private async ensureTenderTypeExists(typeId: string, tx: TenderMasterWriteClient): Promise<void> {
    const tenderType = await tx.tenderTypeMaster.findFirst({
      where: {
        ttmTypeId: typeId,
        ttmIsDeleted: false,
      },
      select: {
        ttmTypeId: true,
      },
    });

    if (!tenderType) {
      this.throwBadRequest('Tender type does not exist', [
        {
          field: 'tndTypeId',
          message: `No active tender type found with id ${typeId}`,
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
    tndTypeId: string,
    excludeTndId?: string,
  ): Promise<void> {
    const existing = await tx.tenderMaster.findFirst({
      where: {
        tndIsDeleted: false,
        tndTypeId,
        tndName: {
          equals: tndName,
          mode: 'insensitive',
        },
        ...(excludeTndId
          ? {
              tndId: {
                not: excludeTndId,
              },
            }
          : {}),
      },
      select: {
        tndId: true,
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

  private toPayload(record: TenderMaster): TenderMasterPayload {
    return {
      tndId: record.tndId,
      tndTypeId: record.tndTypeId,
      tndName: record.tndName,
      tndLedgerId: record.tndLedgerId,
      tndMinAmount: this.toNumber(record.tndMinAmount),
      tndMaxAmount: this.toNullableNumber(record.tndMaxAmount),
      tndDisplayPosition: record.tndDisplayPosition,
      tndSurchargePerc: this.toNumber(record.tndSurchargePerc),
      tndIsActive: record.tndIsActive,
      tndIsDeleted: record.tndIsDeleted,
      tndRemarks: record.tndRemarks,
      tndEditSurcharge: record.tndEditSurcharge,
      tndEditLedger: record.tndEditLedger,
      tndSyncDate: record.tndSyncDate ? record.tndSyncDate.toISOString() : null,
      tndCreatedOn: record.tndCreatedOn.toISOString(),
      tndCreatedBy: record.tndCreatedBy,
      tndModifiedOn: record.tndModifiedOn.toISOString(),
      tndModifiedBy: record.tndModifiedBy,
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
