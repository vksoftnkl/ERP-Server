import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfiguredGridListResult, ConfiguredGridSqlService } from '../../../common/configured-grid-sql/configured-grid-sql.service';
import { BranchMaster, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListBranchMasterQueryDto } from './dto/list-branch-master-query.dto';
import { SaveBranchMasterDto } from './dto/save-branch-master.dto';
import {
  BranchMasterErrorDetail,
  BranchMasterErrorResponse,
  BranchMasterListItem,
  BranchMasterListMeta,
  BranchMasterPayload,
} from './types/branch-master-api.types';

const DEFAULT_ACTOR = 'system';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const BRANCH_MASTER_TABLE_NAME = 'branch master';
const BRANCH_MASTER_AUDIT_SCREEN_NAME = 'Branch Master';

type BranchMasterWriteClient = Prisma.TransactionClient | PrismaService;

@Injectable()
export class BranchMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
  ) { }

  async save(saveBranchMasterDto: SaveBranchMasterDto): Promise<BranchMasterPayload> {
    if (saveBranchMasterDto.brId) {
      return this.updateBranch(saveBranchMasterDto);
    }

    return this.createBranch(saveBranchMasterDto);
  }
  async list(
    queryDto: ListBranchMasterQueryDto,
  ): Promise<ConfiguredGridListResult<BranchMasterListItem, BranchMasterListMeta>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const hasStructuredFilters =
      queryDto.compId !== undefined ||
      queryDto.brStateCode !== undefined ||
      queryDto.brIsActive !== undefined ||
      queryDto.brIsDefault !== undefined;
    if (!hasStructuredFilters) {
      const configuredList = await this.listFromConfiguredGridSql(queryDto.search, page, limit, skip);
      if (configuredList) {
        return configuredList;
      }
    }
    const where: Prisma.BranchMasterWhereInput = {
      brIsDeleted: false,
    };
    if (queryDto.compId !== undefined) {
      where.compId = queryDto.compId as string;
    }
    if (queryDto.brStateCode !== undefined) {
      where.brStateCode = queryDto.brStateCode;
    }
    if (queryDto.brIsActive !== undefined) {
      where.brIsActive = queryDto.brIsActive;
    }
    if (queryDto.brIsDefault !== undefined) {
      where.brIsDefault = queryDto.brIsDefault;
    }
    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      where.OR = [
        { brCode: { contains: search, mode: 'insensitive' } },
        { brName: { contains: search, mode: 'insensitive' } },
        { brAlias: { contains: search, mode: 'insensitive' } },
        { brShort: { contains: search, mode: 'insensitive' } },
        { brCity: { contains: search, mode: 'insensitive' } },
        { brDistrict: { contains: search, mode: 'insensitive' } },
        { brState: { contains: search, mode: 'insensitive' } },
        { brContactPerson: { contains: search, mode: 'insensitive' } },
        { brPhone: { contains: search, mode: 'insensitive' } },
        { brMail: { contains: search, mode: 'insensitive' } },
      ];
    }
    const [total, records, styles] = await Promise.all([
      this.prisma.branchMaster.count({ where }),
      this.prisma.branchMaster.findMany({
        where,
        orderBy: [{ brIsDefault: 'desc' }, { brName: 'asc' }, { brId: 'asc' }],
        skip,
        take: limit,
      }),
      this.configuredGridSqlService.loadPrimaryGridStyles(BRANCH_MASTER_TABLE_NAME),
    ]);
    return {
      items: records.map((record) => this.toPayload(record)),
      meta: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
      ...(styles !== undefined && { styles }),
    };
  }
  private async listFromConfiguredGridSql(
    search: string | undefined,
    page: number,
    limit: number,
    skip: number,
  ): Promise<ConfiguredGridListResult<BranchMasterListItem, BranchMasterListMeta> | null> {
    const configuredGrids = await this.configuredGridSqlService.loadCandidates({
      tableName: BRANCH_MASTER_TABLE_NAME,
    });
    const primaryConfiguredGrids = this.configuredGridSqlService.filterPrimaryFromTable(
      configuredGrids,
      BRANCH_MASTER_TABLE_NAME,
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
        tableName: BRANCH_MASTER_TABLE_NAME,
      });
      if (!validation.isValid) {
        continue;
      }
      try {
        const result = await this.configuredGridSqlService.runPagedQuery<BranchMasterListItem>({
          baseSql: validation.normalizedSql,
          alias: 'branch_master_grid',
          search,
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
  async getById(brId: string): Promise<BranchMasterPayload> {
    const record = await this.prisma.branchMaster.findFirst({
      where: {
        brId,
        brIsDeleted: false,
      },
    });
    if (!record) {
      this.throwNotFound(brId);
    }
    return this.toPayload(record);
  }
  async softDelete(brId: string): Promise<{ brId: string; deleted: true }> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.branchMaster.findFirst({
        where: {
          brId,
          brIsDeleted: false,
        },
      });
      if (!existing) {
        this.throwNotFound(brId);
      }
      const modifiedOn = new Date();
      const result = await tx.branchMaster.updateMany({
        where: {
          brId,
          brIsDeleted: false,
        },
        data: {
          brIsDeleted: true,
          brIsActive: false,
          brModifiedOn: modifiedOn,
          brModifiedBy: DEFAULT_ACTOR,
        },
      });
      if (result.count === 0) {
        this.throwNotFound(brId);
      }
      const originalRecord = this.toPayload(existing);
      const modifiedRecord = this.toPayload({
        ...existing,
        brIsDeleted: true,
        brIsActive: false,
        brModifiedOn: modifiedOn,
        brModifiedBy: DEFAULT_ACTOR,
      });
      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: BRANCH_MASTER_TABLE_NAME,
          screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
          screenType: 'master',
          pk: String(brId),
          displayName: existing.brName,
          originalRecord,
          modifiedRecord,
          userId: DEFAULT_ACTOR,
          notes: 'Branch soft deleted',
        },
        tx,
      );
      return {
        brId,
        deleted: true,
      };
    });
  }
  private async createBranch(
    saveBranchMasterDto: SaveBranchMasterDto,
  ): Promise<BranchMasterPayload> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const normalizedName = this.normalizeRequiredName(saveBranchMasterDto.brName);
        const stateCode = this.normalizeStateCode(saveBranchMasterDto.brStateCode);
        await this.ensureCompanyExists(saveBranchMasterDto.compId, tx);
        await this.ensureNameIsUnique(tx, saveBranchMasterDto.compId, normalizedName);
        await this.ensureCodeIsUnique(tx, saveBranchMasterDto.brCode ?? null);
        if (saveBranchMasterDto.brIsDefault === true) {
          await this.clearDefaultBranch(tx, saveBranchMasterDto.compId);
        }
        const now = new Date();
        const data: Prisma.BranchMasterUncheckedCreateInput = {
          compId: saveBranchMasterDto.compId,
          brName: normalizedName,
          brStateCode: stateCode,
          brCreatedOn: now,
          brCreatedBy: DEFAULT_ACTOR,
          brModifiedOn: now,
          brModifiedBy: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveBranchMasterDto);
        const created = await tx.branchMaster.create({ data });
        const payload = this.toPayload(created);
        await this.auditLogService.logEntityChange(
          {
            action: 'New',
            tableName: BRANCH_MASTER_TABLE_NAME,
            screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(payload.brId),
            displayName: payload.brName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Branch created',
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
  private async updateBranch(
    saveBranchMasterDto: SaveBranchMasterDto,
  ): Promise<BranchMasterPayload> {
    const brId = saveBranchMasterDto.brId!;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.branchMaster.findFirst({
          where: {
            brId,
            brIsDeleted: false,
          },
        });
        if (!existing) {
          this.throwNotFound(brId);
        }
        const normalizedName = this.normalizeRequiredName(saveBranchMasterDto.brName);
        const stateCode = this.normalizeStateCode(saveBranchMasterDto.brStateCode);
        await this.ensureCompanyExists(saveBranchMasterDto.compId, tx);
        await this.ensureNameIsUnique(tx, saveBranchMasterDto.compId, normalizedName, brId);
        await this.ensureCodeIsUnique(tx, saveBranchMasterDto.brCode ?? null, brId);
        if (saveBranchMasterDto.brIsDefault === true) {
          await this.clearDefaultBranch(tx, saveBranchMasterDto.compId, brId);
        }
        const data: Prisma.BranchMasterUncheckedUpdateInput = {
          compId: saveBranchMasterDto.compId,
          brName: normalizedName,
          brStateCode: stateCode,
          brModifiedOn: new Date(),
          brModifiedBy: DEFAULT_ACTOR,
        };
        this.applyOptionalFields(data, saveBranchMasterDto);
        const updated = await tx.branchMaster.update({
          where: {
            brId,
          },
          data,
        });
        const payload = this.toPayload(updated);
        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: BRANCH_MASTER_TABLE_NAME,
            screenName: BRANCH_MASTER_AUDIT_SCREEN_NAME,
            screenType: 'master',
            pk: String(brId),
            displayName: payload.brName,
            originalRecord: this.toPayload(existing),
            modifiedRecord: payload,
            userId: DEFAULT_ACTOR,
            notes: 'Branch updated',
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
  private async ensureCompanyExists(compId: string, tx: BranchMasterWriteClient): Promise<void> {
    const company = await tx.company.findFirst({
      where: {
        compId,
        compIsDeleted: false,
      },
      select: {
        compId: true,
      },
    });
    if (!company) {
      this.throwBadRequest('Company does not exist', [
        {
          field: 'compId',
          message: `No active company found with id ${compId}`,
        },
      ]);
    }
  }
  private async ensureNameIsUnique(
    tx: BranchMasterWriteClient,
    compId: string,
    brName: string,
    excludeBrId?: string,
  ): Promise<void> {
    const existing = await tx.branchMaster.findFirst({
      where: {
        compId,
        brIsDeleted: false,
        brName: {
          equals: brName,
          mode: 'insensitive',
        },
        ...(excludeBrId !== undefined
          ? {
            brId: {
              not: excludeBrId,
            },
          }
          : {}),
      },
      select: {
        brId: true,
      },
    });
    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Branch name already exists for this company', [
          {
            field: 'brName',
            message: 'Duplicate brName is not allowed for this company',
          },
        ]),
      );
    }
  }
  private async ensureCodeIsUnique(
    tx: BranchMasterWriteClient,
    brCode: string | null,
    excludeBrId?: string,
  ): Promise<void> {
    if (!brCode) {
      return;
    }
    const existing = await tx.branchMaster.findFirst({
      where: {
        brCode: {
          equals: brCode,
          mode: 'insensitive',
        },
        ...(excludeBrId !== undefined
          ? {
            brId: {
              not: excludeBrId,
            },
          }
          : {}),
      },
      select: {
        brId: true,
      },
    });
    if (existing) {
      throw new ConflictException(
        this.buildErrorResponse('Branch code already exists', [
          {
            field: 'brCode',
            message: 'Duplicate brCode is not allowed',
          },
        ]),
      );
    }
  }
  private async clearDefaultBranch(
    tx: BranchMasterWriteClient,
    compId: string,
    excludeBrId?: string,
  ): Promise<void> {
    await tx.branchMaster.updateMany({
      where: {
        compId,
        brIsDeleted: false,
        brIsDefault: true,
        ...(excludeBrId !== undefined
          ? {
            brId: {
              not: excludeBrId,
            },
          }
          : {}),
      },
      data: {
        brIsDefault: false,
        brModifiedOn: new Date(),
        brModifiedBy: DEFAULT_ACTOR,
      },
    });
  }
  private applyOptionalFields(
    data: Prisma.BranchMasterUncheckedCreateInput | Prisma.BranchMasterUncheckedUpdateInput,
    saveBranchMasterDto: SaveBranchMasterDto,
  ): void {
    if (this.hasOwnProperty(saveBranchMasterDto, 'brCode')) {
      data.brCode = saveBranchMasterDto.brCode;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brMailingName')) {
      data.brMailingName = saveBranchMasterDto.brMailingName;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brAlias')) {
      data.brAlias = saveBranchMasterDto.brAlias;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brShort')) {
      data.brShort = saveBranchMasterDto.brShort;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brType')) {
      data.brType = saveBranchMasterDto.brType;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brIsDefault')) {
      data.brIsDefault = saveBranchMasterDto.brIsDefault;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brIsActive')) {
      data.brIsActive = saveBranchMasterDto.brIsActive;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brAddr1')) {
      data.brAddr1 = saveBranchMasterDto.brAddr1;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brAddr2')) {
      data.brAddr2 = saveBranchMasterDto.brAddr2;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brAddr3')) {
      data.brAddr3 = saveBranchMasterDto.brAddr3;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brCity')) {
      data.brCity = saveBranchMasterDto.brCity;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brDistrict')) {
      data.brDistrict = saveBranchMasterDto.brDistrict;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brState')) {
      data.brState = saveBranchMasterDto.brState;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brPin')) {
      data.brPin = saveBranchMasterDto.brPin;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brCountry')) {
      data.brCountry = saveBranchMasterDto.brCountry;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brLandmark')) {
      data.brLandmark = saveBranchMasterDto.brLandmark;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRegionAddr1')) {
      data.brRegionAddr1 = saveBranchMasterDto.brRegionAddr1;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRegionAddr2')) {
      data.brRegionAddr2 = saveBranchMasterDto.brRegionAddr2;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRegionAddr3')) {
      data.brRegionAddr3 = saveBranchMasterDto.brRegionAddr3;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRegionCity')) {
      data.brRegionCity = saveBranchMasterDto.brRegionCity;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRegionDistrict')) {
      data.brRegionDistrict = saveBranchMasterDto.brRegionDistrict;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRegionState')) {
      data.brRegionState = saveBranchMasterDto.brRegionState;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRegionCountry')) {
      data.brRegionCountry = saveBranchMasterDto.brRegionCountry;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brContactPerson')) {
      data.brContactPerson = saveBranchMasterDto.brContactPerson;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brTel')) {
      data.brTel = saveBranchMasterDto.brTel;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brPhone')) {
      data.brPhone = saveBranchMasterDto.brPhone;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brMail')) {
      data.brMail = saveBranchMasterDto.brMail;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brBillPrefix')) {
      data.brBillPrefix = saveBranchMasterDto.brBillPrefix;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brInvoiceSeriesPrefix')) {
      data.brInvoiceSeriesPrefix = saveBranchMasterDto.brInvoiceSeriesPrefix;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brBillGreeting')) {
      data.brBillGreeting = saveBranchMasterDto.brBillGreeting;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brTerms')) {
      data.brTerms = saveBranchMasterDto.brTerms;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRoundingMode')) {
      data.brRoundingMode = saveBranchMasterDto.brRoundingMode;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brRoundingValue')) {
      data.brRoundingValue = saveBranchMasterDto.brRoundingValue;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brDefaultGodownId')) {
      data.brDefaultGodownId = saveBranchMasterDto.brDefaultGodownId;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brPosType')) {
      data.brPosType = saveBranchMasterDto.brPosType;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brAllowNegativeStock')) {
      data.brAllowNegativeStock = saveBranchMasterDto.brAllowNegativeStock;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brSmsApplicable')) {
      data.brSmsApplicable = saveBranchMasterDto.brSmsApplicable;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brBankId')) {
      data.brBankId = saveBranchMasterDto.brBankId;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brFssaiNo')) {
      data.brFssaiNo = saveBranchMasterDto.brFssaiNo;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brFssaiLicenseType')) {
      data.brFssaiLicenseType = saveBranchMasterDto.brFssaiLicenseType;
    }
    if (this.hasOwnProperty(saveBranchMasterDto, 'brFssaiValidUpto')) {
      data.brFssaiValidUpto = saveBranchMasterDto.brFssaiValidUpto;
    }
  }
  private normalizeRequiredName(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'brName',
          message: 'brName must not be empty',
        },
      ]);
    }
    return trimmed;
  }
  private normalizeStateCode(stateCode: string): string {
    const normalized = stateCode.trim().toUpperCase();
    if (normalized.length !== 2) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'brStateCode',
          message: 'brStateCode must be exactly 2 characters',
        },
      ]);
    }
    return normalized;
  }
  private toPayload(record: BranchMaster): BranchMasterPayload {
    return {
      brId: record.brId,
      compId: record.compId,
      brCode: record.brCode,
      brName: record.brName,
      brMailingName: record.brMailingName,
      brAlias: record.brAlias,
      brShort: record.brShort,
      brType: record.brType,
      brIsDefault: record.brIsDefault,
      brIsActive: record.brIsActive,
      brAddr1: record.brAddr1,
      brAddr2: record.brAddr2,
      brAddr3: record.brAddr3,
      brCity: record.brCity,
      brDistrict: record.brDistrict,
      brState: record.brState,
      brStateCode: record.brStateCode,
      brPin: record.brPin,
      brCountry: record.brCountry,
      brLandmark: record.brLandmark,
      brRegionAddr1: record.brRegionAddr1,
      brRegionAddr2: record.brRegionAddr2,
      brRegionAddr3: record.brRegionAddr3,
      brRegionCity: record.brRegionCity,
      brRegionDistrict: record.brRegionDistrict,
      brRegionState: record.brRegionState,
      brRegionCountry: record.brRegionCountry,
      brContactPerson: record.brContactPerson,
      brTel: record.brTel,
      brPhone: record.brPhone,
      brMail: record.brMail,
      brBillPrefix: record.brBillPrefix,
      brInvoiceSeriesPrefix: record.brInvoiceSeriesPrefix,
      brBillGreeting: record.brBillGreeting,
      brTerms: record.brTerms,
      brRoundingMode: record.brRoundingMode,
      brRoundingValue: this.toNullableNumber(record.brRoundingValue),
      brDefaultGodownId: record.brDefaultGodownId,
      brPosType: record.brPosType,
      brAllowNegativeStock: record.brAllowNegativeStock,
      brSmsApplicable: record.brSmsApplicable,
      brBankId: record.brBankId,
      brFssaiNo: record.brFssaiNo,
      brFssaiLicenseType: record.brFssaiLicenseType,
      brFssaiValidUpto: record.brFssaiValidUpto ? record.brFssaiValidUpto.toISOString() : null,
      brIsDeleted: record.brIsDeleted,
      brSyncDate: record.brSyncDate ? record.brSyncDate.toISOString() : null,
      brCreatedOn: record.brCreatedOn.toISOString(),
      brCreatedBy: record.brCreatedBy,
      brModifiedOn: record.brModifiedOn.toISOString(),
      brModifiedBy: record.brModifiedBy,
    };
  }
  private toNullableNumber(value: Prisma.Decimal | number | null): number | null {
    if (value === null) {
      return null;
    }
    if (typeof value === 'number') {
      return value;
    }
    return Number(value.toString());
  }
  private handleWriteError(error: unknown): void {
    if (this.isUniqueConstraintError(error)) {
      throw new ConflictException(
        this.buildErrorResponse('Branch already exists', [
          {
            field: 'brCode',
            message: 'Duplicate branch unique value is not allowed',
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
  private throwNotFound(brId: string): never {
    throw new NotFoundException(
      this.buildErrorResponse('Branch not found', [
        {
          field: 'brId',
          message: `No active branch found with id ${brId}`,
        },
      ]),
    );
  }
  private throwBadRequest(message: string, errors: BranchMasterErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }
  private buildErrorResponse(
    message: string,
    errors: BranchMasterErrorDetail[] = [],
  ): BranchMasterErrorResponse {
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
