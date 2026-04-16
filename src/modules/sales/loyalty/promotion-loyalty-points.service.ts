import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LoyaltyScheme,
  LoyaltySchemeGift,
  LoyaltySchemeParty,
  LoyaltySchemePoint,
  Prisma,
} from '@prisma/client';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { ListLoyaltyGiftQueryDto } from './dto/list-loyalty-gift-query.dto';
import { ListLoyaltyPointQueryDto } from './dto/list-loyalty-point-query.dto';
import { ListLoyaltySchemeQueryDto } from './dto/list-loyalty-scheme-query.dto';
import { SaveLoyaltyGiftDto } from './dto/save-loyalty-gift.dto';
import { SaveLoyaltyPartyDto } from './dto/save-loyalty-party.dto';
import { SaveLoyaltyPointDto } from './dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import {
  LoyaltyGiftDeleteResult,
  LoyaltyGiftPayload,
  LoyaltyPartyPayload,
  LoyaltyPointDeleteResult,
  LoyaltyPointPayload,
  LoyaltySchemeDeleteResult,
  LoyaltySchemePayload,
  LoyaltySchemeSummaryPayload,
  PromotionLoyaltyPointsErrorDetail,
  PromotionLoyaltyPointsErrorResponse,
  PromotionLoyaltyPointsListMeta,
} from './types/promotion-loyalty-points-api.types';
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 20;
const DEFAULT_AUDIT_ACTOR = 'system';
const LOYALTY_SCREEN_NAME = 'Promotion Loyalty Points';
const LOYALTY_SCHEME_TABLE_NAME = 'loyalty scheme list';
const LOYALTY_POINTS_TABLE_NAME = 'loyalty scheme points';
const LOYALTY_GIFT_TABLE_NAME = 'loyalty scheme gift';
const LOYALTY_PARTY_TABLE_NAME = 'loyalty scheme party scope';
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
type LoyaltyWriteClient = Prisma.TransactionClient | PrismaService;
type ListResult<T> = { items: T[]; meta: PromotionLoyaltyPointsListMeta };
type SchemeWithChildren = LoyaltyScheme & {
  parties: LoyaltySchemeParty[];
  points: LoyaltySchemePoint[];
  gifts: LoyaltySchemeGift[];
};
@Injectable()
export class PromotionLoyaltyPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  private parseTimeToUtcDate(value: string, field: string): Date {
    const trimmed = value.trim();
    if (!trimmed) {
      this.throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
    }
    const match = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d)(?:\.(\d{1,3}))?)?$/.exec(trimmed);
    if (!match) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid time (HH:mm or HH:mm:ss)` ,
        },
      ]);
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] ? Number(match[3]) : 0;
    const millis = match[4] ? Number(match[4].padEnd(3, '0')) : 0;
    const date = new Date(Date.UTC(1970, 0, 1, hours, minutes, seconds, millis));
    if (Number.isNaN(date.getTime())) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid time`,
        },
      ]);
    }
    return date;
  }
 async saveScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    if (dto.ls_id) {
      return this.updateScheme(dto);
    }
    return this.createScheme(dto);
  }
  async listSchemes(
    queryDto: ListLoyaltySchemeQueryDto,
  ): Promise<ListResult<LoyaltySchemePayload>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;
    const filters: Prisma.LoyaltySchemeWhereInput[] = [{ lsIsDeleted: false }];
    if (queryDto.ls_comp_id) {
      filters.push({ lsCompId: queryDto.ls_comp_id });
    }
    if (queryDto.ls_branch_id) {
      filters.push({ lsBranchId: queryDto.ls_branch_id });
    }
    if (queryDto.ls_is_active !== undefined) {
      filters.push({ lsIsActive: queryDto.ls_is_active });
    }
    if (queryDto.ls_type) {
      filters.push({ lsType: queryDto.ls_type });
    }
    if (queryDto.ls_status) {
      filters.push({ lsStatus: queryDto.ls_status });
    }
    if (queryDto.search) {
      filters.push({
        OR: [
          { lsName: { contains: queryDto.search, mode: Prisma.QueryMode.insensitive } },
          { lsCode: { contains: queryDto.search, mode: Prisma.QueryMode.insensitive } },
        ],
      });
    }
    const startDateFilter = this.buildDateRangeFilter(
      queryDto.ls_start_date_from,
      queryDto.ls_start_date_to,
      'ls_start_date',
    );
    if (startDateFilter) {
      filters.push({ lsStartDate: startDateFilter });
    }
    const endDateFilter = this.buildDateRangeFilter(
      queryDto.ls_end_date_from,
      queryDto.ls_end_date_to,
      'ls_end_date',
    );
    if (endDateFilter) {
      filters.push({ lsEndDate: endDateFilter });
    }

    const where: Prisma.LoyaltySchemeWhereInput =
      filters.length === 1 ? filters[0] : { AND: filters };

    const [total, schemes] = await Promise.all([
      this.prisma.loyaltyScheme.count({ where }),
      this.prisma.loyaltyScheme.findMany({
        where,
        include: {
          parties: {
            where: { lpsIsDeleted: false, lpsIsActive: true },
            orderBy: [{ lpsSlno: 'asc' }, { lpsId: 'asc' }],
          },
          points: {
            where: { lsptIsDeleted: false, lsptIsActive: true },
            orderBy: [{ lsptSlno: 'asc' }, { lsptId: 'asc' }],
          },
          gifts: {
            where: { lsgIsDeleted: false, lsgIsActive: true },
            orderBy: [{ lsgSlno: 'asc' }, { lsgId: 'asc' }],
          },
        },
        orderBy: [{ lsName: 'asc' }, { lsId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: schemes.map((scheme) => this.toSchemePayload(scheme)),
      meta: this.buildMeta(page, limit, total),
    };
  }
private buildPartyDisplayName(lpsLsId: string, lpsSlno: number): string {
  return `Scheme ${lpsLsId} / Party ${lpsSlno}`;
}
  async getSchemeById(lsId: string): Promise<LoyaltySchemePayload> {
    const scheme = await this.findActiveSchemeWithChildren(this.prisma, lsId);
    if (!scheme) {
      this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
    }

    return this.toSchemePayload(scheme);
  }

  async softDeleteScheme(
    lsId: string,
    lsUpdatedBy?: string,
  ): Promise<LoyaltySchemeDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findActiveSchemeWithChildren(tx, lsId);
      if (!existing) {
        this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
      }

      const updatedOn = new Date();
      const updatedBy = this.resolveActorUuid(lsUpdatedBy, this.requestContextService.getUserId());

      const updatedScheme = await tx.loyaltyScheme.update({
        where: { lsId },
        data: {
          lsIsDeleted: true,
          lsIsActive: false,
          lsUpdatedOn: updatedOn,
          lsUpdatedBy: updatedBy,
        },
      });          
      await Promise.all([
        tx.loyaltySchemeParty.updateMany({
          where: { lpsLsId: lsId, lpsIsDeleted: false },
          data: {
            lpsIsDeleted: true,
            lpsIsActive: false,
            lpsUpdatedOn: updatedOn,
            lpsUpdatedBy: updatedBy,
          },
        }),
        tx.loyaltySchemePoint.updateMany({
          where: { lsptLsId: lsId, lsptIsDeleted: false },
          data: {
            lsptIsDeleted: true,
            lsptIsActive: false,
            lsptUpdatedOn: updatedOn,
            lsptUpdatedBy: updatedBy,
          },
        }),
        tx.loyaltySchemeGift.updateMany({
          where: { lsgLsId: lsId, lsgIsDeleted: false },
          data: {
            lsgIsDeleted: true,
            lsgIsActive: false,
            lsgUpdatedOn: updatedOn,
            lsgUpdatedBy: updatedBy,
          },
        }),
      ]);

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LOYALTY_SCHEME_TABLE_NAME,
          screenName: LOYALTY_SCREEN_NAME,
          screenType: 'master',
          pk: lsId,
          displayName: existing.lsName,
          originalRecord: this.toSchemePayload(existing),
          modifiedRecord: this.toSchemePayload({
            ...updatedScheme,
            parties: existing.parties.map((party) => ({
              ...party,
              lpsIsDeleted: true,
              lpsIsActive: false,
              lpsUpdatedOn: updatedOn,
              lpsUpdatedBy: updatedBy,
            })),
            points: existing.points.map((point) => ({
              ...point,
              lsptIsDeleted: true,
              lsptIsActive: false,
              lsptUpdatedOn: updatedOn,
              lsptUpdatedBy: updatedBy,
            })),
            gifts: existing.gifts.map((gift) => ({
              ...gift,
              lsgIsDeleted: true,
              lsgIsActive: false,
              lsgUpdatedOn: updatedOn,
              lsgUpdatedBy: updatedBy,
            })),
          }),
          userId: this.resolveAuditActor(),
          notes: 'Loyalty scheme soft deleted',
        },
        tx,
      );

      return { ls_id: lsId, deleted: true };
    });
  }

  async savePoint(dto: SaveLoyaltyPointDto): Promise<LoyaltyPointPayload> {
    if (dto.lspt_id) {
      return this.updatePoint(dto);
    }

    return this.createPoint(dto);
  }

  async listPoints(queryDto: ListLoyaltyPointQueryDto): Promise<ListResult<LoyaltyPointPayload>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.LoyaltySchemePointWhereInput = {
      lsptLsId: queryDto.lspt_ls_id,
      lsptIsDeleted: false,
      ...(queryDto.lspt_is_active !== undefined ? { lsptIsActive: queryDto.lspt_is_active } : {}),
    };

    const [total, points] = await Promise.all([
      this.prisma.loyaltySchemePoint.count({ where }),
      this.prisma.loyaltySchemePoint.findMany({
        where,
        orderBy: [{ lsptSlno: 'asc' }, { lsptId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: points.map((point) => this.toPointPayload(point)),
      meta: this.buildMeta(page, limit, total),
    };
  }

  async getPointById(lsptId: string): Promise<LoyaltyPointPayload> {
    const point = await this.prisma.loyaltySchemePoint.findFirst({
      where: { lsptId, lsptIsDeleted: false },
    });

    if (!point) {
      this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
    }

    return this.toPointPayload(point);
  }

  async softDeletePoint(
    lsptId: string,
    lsptUpdatedBy?: string,
  ): Promise<LoyaltyPointDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltySchemePoint.findFirst({
        where: { lsptId, lsptIsDeleted: false },
      });

      if (!existing) {
        this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
      }

      const updatedOn = new Date();
      const updatedBy = this.resolveActorUuid(
        lsptUpdatedBy,
        this.requestContextService.getUserId(),
      );

      const updated = await tx.loyaltySchemePoint.update({
        where: { lsptId },
        data: {
          lsptIsDeleted: true,
          lsptIsActive: false,
          lsptUpdatedOn: updatedOn,
          lsptUpdatedBy: updatedBy,
        },
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LOYALTY_POINTS_TABLE_NAME,
          screenName: LOYALTY_SCREEN_NAME,
          screenType: 'master',
          pk: lsptId,
          displayName: this.buildPointDisplayName(existing.lsptLsId, existing.lsptSlno),
          originalRecord: this.toPointPayload(existing),
          modifiedRecord: this.toPointPayload(updated),
          userId: this.resolveAuditActor(),
          notes: 'Loyalty point soft deleted',
        },
        tx,
      );

      return { lspt_id: lsptId, deleted: true };
    });
  }

  async saveGift(dto: SaveLoyaltyGiftDto): Promise<LoyaltyGiftPayload> {
    if (dto.lsg_id) {
      return this.updateGift(dto);
    }

    return this.createGift(dto);
  }

  async listGifts(queryDto: ListLoyaltyGiftQueryDto): Promise<ListResult<LoyaltyGiftPayload>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.LoyaltySchemeGiftWhereInput = {
      lsgLsId: queryDto.lsg_ls_id,
      lsgIsDeleted: false,
      ...(queryDto.lsg_is_active !== undefined ? { lsgIsActive: queryDto.lsg_is_active } : {}),
    };

    const [total, gifts] = await Promise.all([
      this.prisma.loyaltySchemeGift.count({ where }),
      this.prisma.loyaltySchemeGift.findMany({
        where,
        orderBy: [{ lsgSlno: 'asc' }, { lsgId: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: gifts.map((gift) => this.toGiftPayload(gift)),
      meta: this.buildMeta(page, limit, total),
    };
  }

  async getGiftById(lsgId: string): Promise<LoyaltyGiftPayload> {
    const gift = await this.prisma.loyaltySchemeGift.findFirst({
      where: { lsgId, lsgIsDeleted: false },
    });

    if (!gift) {
      this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
    }

    return this.toGiftPayload(gift);
  }

  async softDeleteGift(
    lsgId: string,
    lsgUpdatedBy?: string,
  ): Promise<LoyaltyGiftDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltySchemeGift.findFirst({
        where: { lsgId, lsgIsDeleted: false },
      });

      if (!existing) {
        this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
      }

      const updatedOn = new Date();
      const updatedBy = this.resolveActorUuid(lsgUpdatedBy, this.requestContextService.getUserId());

      const updated = await tx.loyaltySchemeGift.update({
        where: { lsgId },
        data: {
          lsgIsDeleted: true,
          lsgIsActive: false,
          lsgUpdatedOn: updatedOn,
          lsgUpdatedBy: updatedBy,
        },
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LOYALTY_GIFT_TABLE_NAME,
          screenName: LOYALTY_SCREEN_NAME,
          screenType: 'master',
          pk: lsgId,
          displayName: this.buildGiftDisplayName(existing.lsgLsId, existing.lsgSlno),
          originalRecord: this.toGiftPayload(existing),
          modifiedRecord: this.toGiftPayload(updated),
          userId: this.resolveAuditActor(),
          notes: 'Loyalty gift soft deleted',
        },
        tx,
      );

      return { lsg_id: lsgId, deleted: true };
    });
  }

  private async createScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    const now = new Date();
    const actorId = this.resolveActorUuid(this.requestContextService.getUserId());
    const lsCode = this.normalizeNullableString(dto.ls_code);
    const lsCompId = this.requireUuid(dto.ls_comp_id, 'ls_comp_id');
    const lsStartDate = this.requireDate(dto.ls_start_date, 'ls_start_date');
    const lsEndDate = this.requireDate(dto.ls_end_date, 'ls_end_date');
    const lsCreatedBy = this.resolveActorUuid(dto.ls_created_by, actorId);
    const lsUpdatedBy = this.resolveActorUuid(dto.ls_updated_by, lsCreatedBy, actorId);

    const data: Prisma.LoyaltySchemeUncheckedCreateInput = {
      lsName: this.requireString(dto.ls_name, 'ls_name'),
      lsType: this.requireString(dto.ls_type, 'ls_type'),
      lsStartDate,
      lsEndDate,
      lsCompId,
      lsCode,
      lsCreatedOn: now,
      lsCreatedBy,
      lsUpdatedOn: now,
      lsUpdatedBy,
    };

    this.ensureDateRange(lsStartDate, lsEndDate);
    this.applyOptionalSchemeFields(data, dto, actorId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureSchemeCodeUnique(tx, lsCompId, lsCode);

        const created = await tx.loyaltyScheme.create({ data });
        const parties = await this.syncSchemeParties(tx, created.lsId, dto.parties, actorId);
        const payload = this.toSchemePayload({ ...created, parties, points: [], gifts: [] });

        await this.auditLogService.logEntityChange(
          {
            action: 'insert',
            tableName: LOYALTY_SCHEME_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: created.lsId,
            displayName: created.lsName,
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty scheme created',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    const lsId = this.requireUuid(dto.ls_id, 'ls_id');
    const actorId = this.resolveActorUuid(this.requestContextService.getUserId());

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await this.findActiveSchemeWithChildren(tx, lsId);
        if (!existing) {
          this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
        }

        const effectiveStartDate = this.hasOwn(dto, 'ls_start_date')
          ? this.requireDate(dto.ls_start_date, 'ls_start_date')
          : existing.lsStartDate;
        const effectiveEndDate = this.hasOwn(dto, 'ls_end_date')
          ? this.requireDate(dto.ls_end_date, 'ls_end_date')
          : existing.lsEndDate;
        const effectiveCompId = this.hasOwn(dto, 'ls_comp_id')
          ? this.requireUuid(dto.ls_comp_id, 'ls_comp_id')
          : existing.lsCompId;
        const effectiveCode = this.hasOwn(dto, 'ls_code')
          ? this.normalizeNullableString(dto.ls_code)
          : existing.lsCode;

        this.ensureDateRange(effectiveStartDate, effectiveEndDate);
        await this.ensureSchemeCodeUnique(tx, effectiveCompId, effectiveCode, lsId);

        const data: Prisma.LoyaltySchemeUncheckedUpdateInput = {
          lsUpdatedOn: new Date(),
          lsUpdatedBy: this.resolveActorUuid(dto.ls_updated_by, actorId),
        };

        if (this.hasOwn(dto, 'ls_name')) {
          data.lsName = this.requireString(dto.ls_name, 'ls_name');
        }
        if (this.hasOwn(dto, 'ls_type')) {
          data.lsType = this.requireString(dto.ls_type, 'ls_type');
        }
        if (this.hasOwn(dto, 'ls_start_date')) {
          data.lsStartDate = effectiveStartDate;
        }
        if (this.hasOwn(dto, 'ls_end_date')) {
          data.lsEndDate = effectiveEndDate;
        }
        if (this.hasOwn(dto, 'ls_comp_id')) {
          data.lsCompId = effectiveCompId;
        }
        if (this.hasOwn(dto, 'ls_code')) {
          data.lsCode = effectiveCode;
        }

        this.applyOptionalSchemeFields(data, dto, actorId);

        const updated = await tx.loyaltyScheme.update({
          where: { lsId },
          data,
        });

        const parties = await this.syncSchemeParties(tx, lsId, dto.parties, actorId);
        const payload = this.toSchemePayload({
          ...updated,
          parties: this.hasOwn(dto, 'parties') ? parties : existing.parties,
          points: existing.points,
          gifts: existing.gifts,
        });

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_SCHEME_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: lsId,
            displayName: updated.lsName,
            originalRecord: this.toSchemePayload(existing),
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty scheme updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private calculatePointFactor(points: number | undefined, each: number | undefined): number {
    const normalizedPoints = this.requireNumber(points, 'lspt_points', 0);
    const normalizedEach = this.requireNumber(each, 'lspt_each', Number.EPSILON);

    if (normalizedEach <= 0) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'lspt_each',
          message: 'lspt_each must be greater than 0',
        },
      ]);
    }

    return normalizedPoints / normalizedEach;
  }

  private async createPoint(dto: SaveLoyaltyPointDto): Promise<LoyaltyPointPayload> {
    const now = new Date();
    const actorId = this.resolveActorUuid(this.requestContextService.getUserId());
    const lsptLsId = this.requireUuid(dto.lspt_ls_id, 'lspt_ls_id');
    const lsptCreatedBy = this.resolveActorUuid(dto.lspt_created_by, actorId);
    const lsptUpdatedBy = this.resolveActorUuid(dto.lspt_updated_by, lsptCreatedBy, actorId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const scheme = await this.getActiveScheme(tx, lsptLsId);
        await this.ensurePointReferenceRecords(tx, scheme.lsItemType, dto);

        const lsptSlno = dto.lspt_slno ?? (await this.getNextPointSlno(tx, lsptLsId));
        await this.ensurePointSlnoUnique(tx, lsptLsId, lsptSlno);

        const lsptPoints = this.requireNumber(dto.lspt_points, 'lspt_points', 0);
        const lsptEach = this.requireNumber(dto.lspt_each, 'lspt_each', Number.EPSILON);
        const lsptFactor = this.calculatePointFactor(lsptPoints, lsptEach);

        const data: Prisma.LoyaltySchemePointUncheckedCreateInput = {
          lsptLsId,
          lsptSlno,
          lsptPoints,
          lsptEach,
          lsptFactor,
          lsptCreatedOn: now,
          lsptCreatedBy,
          lsptUpdatedOn: now,
          lsptUpdatedBy,
        };

        this.applyOptionalPointFields(data, dto);

        data.lsptEach = lsptEach;
        data.lsptFactor = lsptFactor;

        const created = await tx.loyaltySchemePoint.create({ data });
        const payload = this.toPointPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'insert',
            tableName: LOYALTY_POINTS_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: created.lsptId,
            displayName: this.buildPointDisplayName(created.lsptLsId, created.lsptSlno),
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty point created',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updatePoint(dto: SaveLoyaltyPointDto): Promise<LoyaltyPointPayload> {
    const lsptId = this.requireUuid(dto.lspt_id, 'lspt_id');
    const actorId = this.resolveActorUuid(this.requestContextService.getUserId());

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.loyaltySchemePoint.findFirst({
          where: { lsptId, lsptIsDeleted: false },
        });

        if (!existing) {
          this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
        }

        const effectiveSchemeId = this.hasOwn(dto, 'lspt_ls_id')
          ? this.requireUuid(dto.lspt_ls_id, 'lspt_ls_id')
          : existing.lsptLsId;
        const effectiveSlno = this.hasOwn(dto, 'lspt_slno')
          ? this.requireInteger(dto.lspt_slno, 'lspt_slno')
          : existing.lsptSlno;

        const scheme = await this.getActiveScheme(tx, effectiveSchemeId);
        await this.ensurePointReferenceRecords(tx, scheme.lsItemType, dto);
        await this.ensurePointSlnoUnique(tx, effectiveSchemeId, effectiveSlno, lsptId);

        const effectivePoints = this.hasOwn(dto, 'lspt_points')
          ? this.requireNumber(dto.lspt_points, 'lspt_points', 0)
          : this.requireNumber(existing.lsptPoints.toNumber(), 'lspt_points', 0);

        const effectiveEach = this.hasOwn(dto, 'lspt_each')
          ? this.requireNumber(dto.lspt_each, 'lspt_each', Number.EPSILON)
          : this.requireNumber(existing.lsptEach.toNumber(), 'lspt_each', Number.EPSILON);

        const effectiveFactor = this.calculatePointFactor(effectivePoints, effectiveEach);

        const data: Prisma.LoyaltySchemePointUncheckedUpdateInput = {
          lsptUpdatedOn: new Date(),
          lsptUpdatedBy: this.resolveActorUuid(dto.lspt_updated_by, actorId),
        };

        if (this.hasOwn(dto, 'lspt_ls_id')) {
          data.lsptLsId = effectiveSchemeId;
        }
        if (this.hasOwn(dto, 'lspt_slno')) {
          data.lsptSlno = effectiveSlno;
        }
        if (this.hasOwn(dto, 'lspt_points')) {
          data.lsptPoints = effectivePoints;
        }

        this.applyOptionalPointFields(data, dto);

        data.lsptPoints = effectivePoints;
        data.lsptEach = effectiveEach;
        data.lsptFactor = effectiveFactor;

        const updated = await tx.loyaltySchemePoint.update({
          where: { lsptId },
          data,
        });
        const payload = this.toPointPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_POINTS_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: lsptId,
            displayName: this.buildPointDisplayName(updated.lsptLsId, updated.lsptSlno),
            originalRecord: this.toPointPayload(existing),
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty point updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async createGift(dto: SaveLoyaltyGiftDto): Promise<LoyaltyGiftPayload> {
    const now = new Date();
    const actorId = this.resolveActorUuid(this.requestContextService.getUserId());
    const lsgLsId = this.requireUuid(dto.lsg_ls_id, 'lsg_ls_id');
    const lsgCreatedBy = this.resolveActorUuid(dto.lsg_created_by, actorId);
    const lsgUpdatedBy = this.resolveActorUuid(dto.lsg_updated_by, lsgCreatedBy, actorId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureSchemeExists(tx, lsgLsId);
        await this.ensureGiftReferenceRecords(tx, dto);

        const lsgSlno = dto.lsg_slno ?? (await this.getNextGiftSlno(tx, lsgLsId));
        await this.ensureGiftSlnoUnique(tx, lsgLsId, lsgSlno);

        const data: Prisma.LoyaltySchemeGiftUncheckedCreateInput = {
          lsgLsId,
          lsgSlno,
          lsgItemId: this.requireUuid(dto.lsg_item_id, 'lsg_item_id'),
          lsgUnitId: this.requireUuid(dto.lsg_unit_id, 'lsg_unit_id'),
          lsgItemQty: this.requireNumber(dto.lsg_item_qty, 'lsg_item_qty', Number.EPSILON),
          lsgRedeemPoints: this.requireNumber(
            dto.lsg_redeem_points,
            'lsg_redeem_points',
            0,
          ),
          lsgCreatedOn: now,
          lsgCreatedBy,
          lsgUpdatedOn: now,
          lsgUpdatedBy,
        };

        this.applyOptionalGiftFields(data, dto);

        const created = await tx.loyaltySchemeGift.create({ data });
        const payload = this.toGiftPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'insert',
            tableName: LOYALTY_GIFT_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: created.lsgId,
            displayName: this.buildGiftDisplayName(created.lsgLsId, created.lsgSlno),
            originalRecord: null,
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty gift created',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async updateGift(dto: SaveLoyaltyGiftDto): Promise<LoyaltyGiftPayload> {
    const lsgId = this.requireUuid(dto.lsg_id, 'lsg_id');
    const actorId = this.resolveActorUuid(this.requestContextService.getUserId());

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.loyaltySchemeGift.findFirst({
          where: { lsgId, lsgIsDeleted: false },
        });

        if (!existing) {
          this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
        }

        const effectiveSchemeId = this.hasOwn(dto, 'lsg_ls_id')
          ? this.requireUuid(dto.lsg_ls_id, 'lsg_ls_id')
          : existing.lsgLsId;
        const effectiveSlno = this.hasOwn(dto, 'lsg_slno')
          ? this.requireInteger(dto.lsg_slno, 'lsg_slno')
          : existing.lsgSlno;

        await this.ensureSchemeExists(tx, effectiveSchemeId);
        await this.ensureGiftReferenceRecords(tx, dto);
        await this.ensureGiftSlnoUnique(tx, effectiveSchemeId, effectiveSlno, lsgId);

        const data: Prisma.LoyaltySchemeGiftUncheckedUpdateInput = {
          lsgUpdatedOn: new Date(),
          lsgUpdatedBy: this.resolveActorUuid(dto.lsg_updated_by, actorId),
        };

        if (this.hasOwn(dto, 'lsg_ls_id')) {
          data.lsgLsId = effectiveSchemeId;
        }
        if (this.hasOwn(dto, 'lsg_slno')) {
          data.lsgSlno = effectiveSlno;
        }
        if (this.hasOwn(dto, 'lsg_item_id')) {
          data.lsgItemId = this.requireUuid(dto.lsg_item_id, 'lsg_item_id');
        }
        if (this.hasOwn(dto, 'lsg_unit_id')) {
          data.lsgUnitId = this.requireUuid(dto.lsg_unit_id, 'lsg_unit_id');
        }
        if (this.hasOwn(dto, 'lsg_item_qty')) {
          data.lsgItemQty = this.requireNumber(dto.lsg_item_qty, 'lsg_item_qty', Number.EPSILON);
        }
        if (this.hasOwn(dto, 'lsg_redeem_points')) {
          data.lsgRedeemPoints = this.requireNumber(
            dto.lsg_redeem_points,
            'lsg_redeem_points',
            0,
          );
        }

        this.applyOptionalGiftFields(data, dto);

        const updated = await tx.loyaltySchemeGift.update({
          where: { lsgId },
          data,
        });
        const payload = this.toGiftPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_GIFT_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: lsgId,
            displayName: this.buildGiftDisplayName(updated.lsgLsId, updated.lsgSlno),
            originalRecord: this.toGiftPayload(existing),
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty gift updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      this.handleWriteError(error);
      throw error;
    }
  }

  private async findActiveSchemeWithChildren(
    client: LoyaltyWriteClient,
    lsId: string,
  ): Promise<SchemeWithChildren | null> {
    return client.loyaltyScheme.findFirst({
      where: { lsId, lsIsDeleted: false },
      include: {
        parties: {
          where: { lpsIsDeleted: false, lpsIsActive: true },
          orderBy: [{ lpsSlno: 'asc' }, { lpsId: 'asc' }],
        },
        points: {
          where: { lsptIsDeleted: false, lsptIsActive: true },
          orderBy: [{ lsptSlno: 'asc' }, { lsptId: 'asc' }],
        },
        gifts: {
          where: { lsgIsDeleted: false, lsgIsActive: true },
          orderBy: [{ lsgSlno: 'asc' }, { lsgId: 'asc' }],
        },
      },
    });
  }

  private applyOptionalSchemeFields(
    data:
      | Prisma.LoyaltySchemeUncheckedCreateInput
      | Prisma.LoyaltySchemeUncheckedUpdateInput,
    dto: SaveLoyaltySchemeDto,
    actorId: string | null,
  ): void {
    if (this.hasOwn(dto, 'ls_status')) {
      data.lsStatus = this.requireString(dto.ls_status, 'ls_status');
    }
    if (this.hasOwn(dto, 'ls_auto_apply')) {
      data.lsAutoApply = dto.ls_auto_apply ?? true;
    }
    if (this.hasOwn(dto, 'ls_apply_on')) {
      data.lsApplyOn = this.requireString(dto.ls_apply_on, 'ls_apply_on');
    }
    if (this.hasOwn(dto, 'ls_calc_on_amount_type')) {
      data.lsCalcOnAmountType = this.requireString(
        dto.ls_calc_on_amount_type,
        'ls_calc_on_amount_type',
      );
    }
    if (this.hasOwn(dto, 'ls_bill_type')) {
      data.lsBillType = this.requireString(dto.ls_bill_type, 'ls_bill_type');
    }
    if (this.hasOwn(dto, 'ls_cust_type')) {
      data.lsCustType = this.requireString(dto.ls_cust_type, 'ls_cust_type');
    }
    if (this.hasOwn(dto, 'ls_item_type')) {
      data.lsItemType = this.requireString(dto.ls_item_type, 'ls_item_type');
    }
    if (this.hasOwn(dto, 'ls_valid_from_time')) {
      const value = dto.ls_valid_from_time;
      data.lsValidFromTime = value ? this.parseTimeToUtcDate(value, 'ls_valid_from_time') : null;
    }
    if (this.hasOwn(dto, 'ls_valid_to_time')) {
      const value = dto.ls_valid_to_time;
      data.lsValidToTime = value ? this.parseTimeToUtcDate(value, 'ls_valid_to_time') : null;
    }
    if (this.hasOwn(dto, 'ls_valid_weekdays')) {
      data.lsValidWeekdays = dto.ls_valid_weekdays ?? null;
    }
    if (this.hasOwn(dto, 'ls_branch_id')) {
      data.lsBranchId = dto.ls_branch_id ?? null;
    }
    if (this.hasOwn(dto, 'ls_include_tax_for_points')) {
      data.lsIncludeTaxForPoints = dto.ls_include_tax_for_points ?? false;
    }
    if (this.hasOwn(dto, 'ls_rounding_method')) {
      data.lsRoundingMethod = this.requireString(dto.ls_rounding_method, 'ls_rounding_method');
    }
    if (this.hasOwn(dto, 'ls_recur_apl')) {
      data.lsRecurApl = dto.ls_recur_apl ?? false;
    }
    if (this.hasOwn(dto, 'ls_bal_apl')) {
      data.lsBalApl = dto.ls_bal_apl ?? false;
    }
    if (this.hasOwn(dto, 'ls_allow_point_redeem')) {
      data.lsAllowPointRedeem = dto.ls_allow_point_redeem ?? false;
    }
    if (this.hasOwn(dto, 'ls_allow_gift_redeem')) {
      data.lsAllowGiftRedeem = dto.ls_allow_gift_redeem ?? false;
    }
    if (this.hasOwn(dto, 'ls_redeem_value_per_point')) {
      data.lsRedeemValuePerPoint = this.requireNumber(
        dto.ls_redeem_value_per_point,
        'ls_redeem_value_per_point',
        0,
      );
    }
    if (this.hasOwn(dto, 'ls_min_redeem_points')) {
      data.lsMinRedeemPoints = this.requireNumber(
        dto.ls_min_redeem_points,
        'ls_min_redeem_points',
        0,
      );
    }
    if (this.hasOwn(dto, 'ls_max_redeem_points_per_bill')) {
      data.lsMaxRedeemPointsPerBill = this.requireNumber(
        dto.ls_max_redeem_points_per_bill,
        'ls_max_redeem_points_per_bill',
        0,
      );
    }
    if (this.hasOwn(dto, 'ls_max_redeem_percent_per_bill')) {
      data.lsMaxRedeemPercentPerBill = this.requireNumber(
        dto.ls_max_redeem_percent_per_bill,
        'ls_max_redeem_percent_per_bill',
        0,
      );
    }
    if (this.hasOwn(dto, 'ls_redeem_min_bill_amount')) {
      data.lsRedeemMinBillAmount = this.requireNumber(
        dto.ls_redeem_min_bill_amount,
        'ls_redeem_min_bill_amount',
        0,
      );
    }
    if (this.hasOwn(dto, 'ls_points_valid_days')) {
      data.lsPointsValidDays = this.requireInteger(dto.ls_points_valid_days, 'ls_points_valid_days');
    }
    if (this.hasOwn(dto, 'ls_expiry_basis')) {
      data.lsExpiryBasis = this.requireString(dto.ls_expiry_basis, 'ls_expiry_basis');
    }
    if (this.hasOwn(dto, 'ls_remarks')) {
      data.lsRemarks = dto.ls_remarks ?? null;
    }
    if (this.hasOwn(dto, 'ls_is_active')) {
      data.lsIsActive = dto.ls_is_active ?? true;
    }
    if (this.hasOwn(dto, 'ls_approved_on')) {
      const approvedOn = (dto as { ls_approved_on?: unknown }).ls_approved_on;
      if (approvedOn === null || approvedOn === undefined || approvedOn === '') {
        data.lsApprovedOn = null;
      } else {
        data.lsApprovedOn = this.requireDateTime(String(approvedOn), 'ls_approved_on');
      }
    }
    if (this.hasOwn(dto, 'ls_approved_by')) {
      data.lsApprovedBy = this.resolveActorUuid(dto.ls_approved_by, actorId);
    }
  }

  private applyOptionalPointFields(
    data:
      | Prisma.LoyaltySchemePointUncheckedCreateInput
      | Prisma.LoyaltySchemePointUncheckedUpdateInput,
    dto: SaveLoyaltyPointDto,
  ): void {
    if (this.hasOwn(dto, 'lspt_item_id')) {
      data.lsptItemId = dto.lspt_item_id ?? null;
    }
    if (this.hasOwn(dto, 'lspt_unit_id')) {
      data.lsptUnitId = dto.lspt_unit_id ?? null;
    }
    if (this.hasOwn(dto, 'lspt_exceeds')) {
      data.lsptExceeds = this.requireNumber(dto.lspt_exceeds, 'lspt_exceeds', 0);
    }
    if (this.hasOwn(dto, 'lspt_each')) {
      data.lsptEach = this.requireNumber(dto.lspt_each, 'lspt_each', Number.EPSILON);
    }
    if (this.hasOwn(dto, 'lspt_notes')) {
      data.lsptNotes = dto.lspt_notes ?? null;
    }
    if (this.hasOwn(dto, 'lspt_is_active')) {
      data.lsptIsActive = dto.lspt_is_active ?? true;
    }
  }

  private applyOptionalGiftFields(
    data:
      | Prisma.LoyaltySchemeGiftUncheckedCreateInput
      | Prisma.LoyaltySchemeGiftUncheckedUpdateInput,
    dto: SaveLoyaltyGiftDto,
  ): void {
    if (this.hasOwn(dto, 'lsg_repeat')) {
      data.lsgRepeat = dto.lsg_repeat ?? false;
    }
    if (this.hasOwn(dto, 'lsg_notes')) {
      data.lsgNotes = dto.lsg_notes ?? null;
    }
    if (this.hasOwn(dto, 'lsg_is_active')) {
      data.lsgIsActive = dto.lsg_is_active ?? true;
    }
  }

private async syncSchemeParties(
  client: LoyaltyWriteClient,
  lsId: string,
  inputParties: SaveLoyaltyPartyDto[] | undefined,
  actorId: string | null,
): Promise<LoyaltySchemeParty[]> {
  const existing = await client.loyaltySchemeParty.findMany({
    where: { lpsLsId: lsId, lpsIsDeleted: false },
    orderBy: [{ lpsSlno: 'asc' }, { lpsId: 'asc' }],
  });

  if (inputParties === undefined) {
    return existing;
  }

  const existingMap = new Map(existing.map((party) => [party.lpsId, party]));
  const keptIds = new Set<string>();
  const seenSlnos = new Set<number>();
  const now = new Date();
  const persisted: LoyaltySchemeParty[] = [];

  for (const [index, inputParty] of inputParties.entries()) {
    const lpsSlno = inputParty.lps_slno ?? index + 1;

    if (seenSlnos.has(lpsSlno)) {
      this.throwConflict('Duplicate loyalty party serial number is not allowed', [
        {
          field: 'lps_slno',
          message: `A loyalty party scope row already exists with serial number ${lpsSlno}`,
        },
      ]);
    }

    seenSlnos.add(lpsSlno);

    if (inputParty.lps_id) {
      const existingParty = existingMap.get(inputParty.lps_id);
      if (!existingParty) {
        this.throwNotFound('lps_id', inputParty.lps_id, 'Loyalty party scope row not found');
      }

      const updated = await client.loyaltySchemeParty.update({
        where: { lpsId: inputParty.lps_id },
        data: {
          lpsSlno,
          lpsScopeType: this.requireString(inputParty.lps_scope_type, 'lps_scope_type'),
          lpsScopeId: this.requireUuid(inputParty.lps_scope_id, 'lps_scope_id'),
          lpsIsExclude: inputParty.lps_is_exclude ?? false,
          lpsNotes: inputParty.lps_notes ?? null,
          lpsIsActive: inputParty.lps_is_active ?? true,
          lpsUpdatedOn: now,
          lpsUpdatedBy: this.resolveActorUuid(inputParty.lps_updated_by, actorId),
        },
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'update',
          tableName: LOYALTY_PARTY_TABLE_NAME,
          screenName: LOYALTY_SCREEN_NAME,
          screenType: 'master',
          pk: updated.lpsId,
          displayName: this.buildPartyDisplayName(updated.lpsLsId, updated.lpsSlno),
          originalRecord: this.toPartyPayload(existingParty),
          modifiedRecord: this.toPartyPayload(updated),
          userId: this.resolveAuditActor(),
          notes: 'Loyalty party scope updated',
        },
        client,
      );

      keptIds.add(updated.lpsId);
      persisted.push(updated);
      continue;
    }

    const createdBy = this.resolveActorUuid(inputParty.lps_created_by, actorId);
    const updatedBy = this.resolveActorUuid(inputParty.lps_updated_by, createdBy, actorId);

    const created = await client.loyaltySchemeParty.create({
      data: {
        lpsLsId: lsId,
        lpsSlno,
        lpsScopeType: this.requireString(inputParty.lps_scope_type, 'lps_scope_type'),
        lpsScopeId: this.requireUuid(inputParty.lps_scope_id, 'lps_scope_id'),
        lpsIsExclude: inputParty.lps_is_exclude ?? false,
        lpsNotes: inputParty.lps_notes ?? null,
        lpsIsActive: inputParty.lps_is_active ?? true,
        lpsCreatedOn: now,
        lpsCreatedBy: createdBy,
        lpsUpdatedOn: now,
        lpsUpdatedBy: updatedBy,
      },
    });

    await this.auditLogService.logEntityChange(
      {
        action: 'insert',
        tableName: LOYALTY_PARTY_TABLE_NAME,
        screenName: LOYALTY_SCREEN_NAME,
        screenType: 'master',
        pk: created.lpsId,
        displayName: this.buildPartyDisplayName(created.lpsLsId, created.lpsSlno),
        originalRecord: null,
        modifiedRecord: this.toPartyPayload(created),
        userId: this.resolveAuditActor(),
        notes: 'Loyalty party scope created',
      },
      client,
    );

    keptIds.add(created.lpsId);
    persisted.push(created);
  }

  const removedParties = existing.filter((party) => !keptIds.has(party.lpsId));

  for (const removedParty of removedParties) {
    const deleted = await client.loyaltySchemeParty.update({
      where: { lpsId: removedParty.lpsId },
      data: {
        lpsIsDeleted: true,
        lpsIsActive: false,
        lpsUpdatedOn: now,
        lpsUpdatedBy: this.resolveActorUuid(actorId),
      },
    });

    await this.auditLogService.logEntityChange(
      {
        action: 'cancel',
        tableName: LOYALTY_PARTY_TABLE_NAME,
        screenName: LOYALTY_SCREEN_NAME,
        screenType: 'master',
        pk: deleted.lpsId,
        displayName: this.buildPartyDisplayName(deleted.lpsLsId, deleted.lpsSlno),
        originalRecord: this.toPartyPayload(removedParty),
        modifiedRecord: this.toPartyPayload(deleted),
        userId: this.resolveAuditActor(),
        notes: 'Loyalty party scope soft deleted',
      },
      client,
    );
  }

  return persisted.sort((left, right) => {
    if (left.lpsSlno === right.lpsSlno) {
      return left.lpsId.localeCompare(right.lpsId);
    }
    return left.lpsSlno - right.lpsSlno;
  });
}

  private buildDateRangeFilter(
    fromValue: string | undefined,
    toValue: string | undefined,
    field: 'ls_start_date' | 'ls_end_date',
  ): Prisma.DateTimeFilter<'LoyaltyScheme'> | undefined {
    if (!fromValue && !toValue) {
      return undefined;
    }

    const filter: Prisma.DateTimeFilter<'LoyaltyScheme'> = {};

    if (fromValue) {
      filter.gte = this.parseDateBoundary(fromValue, field, 'start');
    }
    if (toValue) {
      filter.lte = this.parseDateBoundary(toValue, field, 'end');
    }

    return filter;
  }

  private async ensureSchemeExists(client: LoyaltyWriteClient, lsId: string): Promise<void> {
    const scheme = await client.loyaltyScheme.findFirst({
      where: { lsId, lsIsDeleted: false },
      select: { lsId: true },
    });

    if (!scheme) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ls_id',
          message: `No active loyalty scheme found with id ${lsId}`,
        },
      ]);
    }
  }

  private async getActiveScheme(
    client: LoyaltyWriteClient,
    lsId: string,
  ): Promise<Pick<LoyaltyScheme, 'lsId' | 'lsItemType'>> {
    const scheme = await client.loyaltyScheme.findFirst({
      where: { lsId, lsIsDeleted: false },
      select: {
        lsId: true,
        lsItemType: true,
      },
    });

    if (!scheme) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ls_id',
          message: `No active loyalty scheme found with id ${lsId}`,
        },
      ]);
    }

    return scheme;
  }

  private async ensureItemExists(
    client: LoyaltyWriteClient,
    itemId: string,
    field: string,
  ): Promise<void> {
    const item = await client.itemMaster.findFirst({
      where: {
        itemId,
        itemIsDeleted: false,
        itemIsActive: true,
      },
      select: { itemId: true },
    });

    if (!item) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} does not reference an active item`,
        },
      ]);
    }
  }

  private async ensureUnitExists(
    client: LoyaltyWriteClient,
    unitId: string,
    field: string,
  ): Promise<void> {
    const unit = await client.unit.findFirst({
      where: {
        unit_id: unitId,
        unit_is_deleted: false,
        unit_is_active: true,
      },
      select: { unit_id: true },
    });

    if (!unit) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} does not reference an active unit`,
        },
      ]);
    }
  }

  private async ensurePointReferenceRecords(
    client: LoyaltyWriteClient,
    schemeItemType: string,
    dto: SaveLoyaltyPointDto,
  ): Promise<void> {
    if (dto.lspt_item_id) {
      await this.ensurePointScopeReference(client, schemeItemType, dto.lspt_item_id, 'lspt_item_id');
    }

    if (dto.lspt_unit_id) {
      await this.ensureUnitExists(client, dto.lspt_unit_id, 'lspt_unit_id');
    }
  }

  private async ensureGiftReferenceRecords(
    client: LoyaltyWriteClient,
    dto: SaveLoyaltyGiftDto,
  ): Promise<void> {
    await this.ensureItemExists(client, this.requireUuid(dto.lsg_item_id, 'lsg_item_id'), 'lsg_item_id');
    await this.ensureUnitExists(client, this.requireUuid(dto.lsg_unit_id, 'lsg_unit_id'), 'lsg_unit_id');
  }

  private async ensurePointScopeReference(
    client: LoyaltyWriteClient,
    schemeItemType: string,
    scopeId: string,
    field: string,
  ): Promise<void> {
    switch (schemeItemType) {
      case 'ITEM_GROUP': {
        const itemGroup = await client.itemGroupMaster.findFirst({
          where: {
            itgId: scopeId,
            itgIsDeleted: false,
            itgIsActive: true,
          },
          select: { itgId: true },
        });

        if (!itemGroup) {
          this.throwBadRequest('Validation failed', [
            {
              field,
              message: `${field} does not reference an active item group`,
            },
          ]);
        }
        return;
      }
      case 'ITEM_BRAND': {
        const itemBrand = await client.itemBrandMaster.findFirst({
          where: {
            brand_id: scopeId,
            brand_is_deleted: false,
            brand_is_active: true,
          },
          select: { brand_id: true },
        });

        if (!itemBrand) {
          this.throwBadRequest('Validation failed', [
            {
              field,
              message: `${field} does not reference an active item brand`,
            },
          ]);
        }
        return;
      }
      case 'ITEM_CATEGORY': {
        const itemCategory = await client.categoryMaster.findFirst({
          where: {
            categoryId: scopeId,
            categoryIsDeleted: false,
            categoryIsActive: true,
          },
          select: { categoryId: true },
        });

        if (!itemCategory) {
          this.throwBadRequest('Validation failed', [
            {
              field,
              message: `${field} does not reference an active item category`,
            },
          ]);
        }
        return;
      }
      case 'ITEM_SECTION': {
        const itemSection = await client.itemSectionMaster.findFirst({
          where: {
            secId: scopeId,
            secIsDeleted: false,
            secIsActive: true,
          },
          select: { secId: true },
        });

        if (!itemSection) {
          this.throwBadRequest('Validation failed', [
            {
              field,
              message: `${field} does not reference an active item section`,
            },
          ]);
        }
        return;
      }
      case 'ALL':
      case 'ITEM':
      default:
        await this.ensureItemExists(client, scopeId, field);
    }
  }

  private async ensureSchemeCodeUnique(
    client: LoyaltyWriteClient,
    lsCompId: string,
    lsCode: string | null,
    excludeId?: string,
  ): Promise<void> {
    if (!lsCode) {
      return;
    }

    const existing = await client.loyaltyScheme.findFirst({
      where: {
        lsCompId,
        lsIsDeleted: false,
        lsCode: { equals: lsCode, mode: Prisma.QueryMode.insensitive },
        ...(excludeId ? { NOT: { lsId: excludeId } } : {}),
      },
      select: { lsId: true },
    });

    if (existing) {
      this.throwConflict('Duplicate loyalty scheme code is not allowed', [
        {
          field: 'ls_code',
          message: `A loyalty scheme already exists with code ${lsCode}`,
        },
      ]);
    }
  }

  private async ensurePointSlnoUnique(
    client: LoyaltyWriteClient,
    lsptLsId: string,
    lsptSlno: number,
    excludeId?: string,
  ): Promise<void> {
    const existing = await client.loyaltySchemePoint.findFirst({
      where: {
        lsptLsId,
        lsptSlno,
        lsptIsDeleted: false,
        ...(excludeId ? { NOT: { lsptId: excludeId } } : {}),
      },
      select: { lsptId: true },
    });

    if (existing) {
      this.throwConflict('Duplicate loyalty point serial number is not allowed', [
        {
          field: 'lspt_slno',
          message: `A loyalty point slab already exists with serial number ${lsptSlno}`,
        },
      ]);
    }
  }

  private async ensureGiftSlnoUnique(
    client: LoyaltyWriteClient,
    lsgLsId: string,
    lsgSlno: number,
    excludeId?: string,
  ): Promise<void> {
    const existing = await client.loyaltySchemeGift.findFirst({
      where: {
        lsgLsId,
        lsgSlno,
        lsgIsDeleted: false,
        ...(excludeId ? { NOT: { lsgId: excludeId } } : {}),
      },
      select: { lsgId: true },
    });

    if (existing) {
      this.throwConflict('Duplicate loyalty gift serial number is not allowed', [
        {
          field: 'lsg_slno',
          message: `A loyalty gift rule already exists with serial number ${lsgSlno}`,
        },
      ]);
    }
  }

  private async getNextPointSlno(client: LoyaltyWriteClient, lsptLsId: string): Promise<number> {
    const result = await client.loyaltySchemePoint.aggregate({
      where: { lsptLsId, lsptIsDeleted: false },
      _max: { lsptSlno: true },
    });

    return (result._max.lsptSlno ?? 0) + 1;
  }

  private async getNextGiftSlno(client: LoyaltyWriteClient, lsgLsId: string): Promise<number> {
    const result = await client.loyaltySchemeGift.aggregate({
      where: { lsgLsId, lsgIsDeleted: false },
      _max: { lsgSlno: true },
    });

    return (result._max.lsgSlno ?? 0) + 1;
  }

  private buildMeta(page: number, limit: number, total: number): PromotionLoyaltyPointsListMeta {
    return {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  private toSchemePayload(scheme: SchemeWithChildren): LoyaltySchemePayload {
    return {
      ...this.toSchemeSummaryPayload(scheme),
      parties: scheme.parties.map((party) => this.toPartyPayload(party)),
      points: scheme.points.map((point) => this.toPointPayload(point)),
      gifts: scheme.gifts.map((gift) => this.toGiftPayload(gift)),
    };
  }

  private toSchemeSummaryPayload(scheme: LoyaltyScheme): LoyaltySchemeSummaryPayload {
    return {
      ls_id: scheme.lsId,
      ls_code: scheme.lsCode,
      ls_name: scheme.lsName,
      ls_type: scheme.lsType,
      ls_status: scheme.lsStatus,
      ls_auto_apply: scheme.lsAutoApply,
      ls_apply_on: scheme.lsApplyOn,
      ls_calc_on_amount_type: scheme.lsCalcOnAmountType,
      ls_bill_type: scheme.lsBillType,
      ls_cust_type: scheme.lsCustType,
      ls_item_type: scheme.lsItemType,
      ls_start_date: this.toIsoDate(scheme.lsStartDate),
      ls_end_date: this.toIsoDate(scheme.lsEndDate),
      ls_valid_from_time: this.toIsoTime(scheme.lsValidFromTime),
      ls_valid_to_time: this.toIsoTime(scheme.lsValidToTime),
      ls_valid_weekdays: scheme.lsValidWeekdays,
      ls_comp_id: scheme.lsCompId,
      ls_branch_id: scheme.lsBranchId,
      ls_include_tax_for_points: scheme.lsIncludeTaxForPoints,
      ls_rounding_method: scheme.lsRoundingMethod,
      ls_recur_apl: scheme.lsRecurApl,
      ls_bal_apl: scheme.lsBalApl,
      ls_allow_point_redeem: scheme.lsAllowPointRedeem,
      ls_allow_gift_redeem: scheme.lsAllowGiftRedeem,
      ls_redeem_value_per_point: this.toNumber(scheme.lsRedeemValuePerPoint),
      ls_min_redeem_points: this.toNumber(scheme.lsMinRedeemPoints),
      ls_max_redeem_points_per_bill: this.toNumber(scheme.lsMaxRedeemPointsPerBill),
      ls_max_redeem_percent_per_bill: this.toNumber(scheme.lsMaxRedeemPercentPerBill),
      ls_redeem_min_bill_amount: this.toNumber(scheme.lsRedeemMinBillAmount),
      ls_points_valid_days: scheme.lsPointsValidDays,
      ls_expiry_basis: scheme.lsExpiryBasis,
      ls_remarks: scheme.lsRemarks,
      ls_is_active: scheme.lsIsActive,
      ls_is_deleted: scheme.lsIsDeleted,
      ls_sync_date: scheme.lsSyncDate?.toISOString() ?? null,
      ls_created_on: scheme.lsCreatedOn.toISOString(),
      ls_created_by: scheme.lsCreatedBy,
      ls_updated_on: scheme.lsUpdatedOn?.toISOString() ?? null,
      ls_updated_by: scheme.lsUpdatedBy,
      ls_approved_on: scheme.lsApprovedOn?.toISOString() ?? null,
      ls_approved_by: scheme.lsApprovedBy,
    };
  }

  private toPartyPayload(party: LoyaltySchemeParty): LoyaltyPartyPayload {
    return {
      lps_id: party.lpsId,
      lps_ls_id: party.lpsLsId,
      lps_slno: party.lpsSlno,
      lps_scope_type: party.lpsScopeType,
      lps_scope_id: party.lpsScopeId,
      lps_is_exclude: party.lpsIsExclude,
      lps_notes: party.lpsNotes,
      lps_is_active: party.lpsIsActive,
      lps_is_deleted: party.lpsIsDeleted,
      lps_sync_date: party.lpsSyncDate?.toISOString() ?? null,
      lps_created_on: party.lpsCreatedOn.toISOString(),
      lps_created_by: party.lpsCreatedBy,
      lps_updated_on: party.lpsUpdatedOn?.toISOString() ?? null,
      lps_updated_by: party.lpsUpdatedBy,
    };
  }

  private toPointPayload(point: LoyaltySchemePoint): LoyaltyPointPayload {
    return {
      lspt_id: point.lsptId,
      lspt_ls_id: point.lsptLsId,
      lspt_slno: point.lsptSlno,
      lspt_item_id: point.lsptItemId,
      lspt_unit_id: point.lsptUnitId,
      lspt_exceeds: this.toNumber(point.lsptExceeds),
      lspt_each: this.toNumber(point.lsptEach),
      lspt_factor: this.toNumber(point.lsptFactor),
      lspt_points: this.toNumber(point.lsptPoints),
      lspt_notes: point.lsptNotes,
      lspt_is_active: point.lsptIsActive,
      lspt_is_deleted: point.lsptIsDeleted,
      lspt_sync_date: point.lsptSyncDate?.toISOString() ?? null,
      lspt_created_on: point.lsptCreatedOn.toISOString(),
      lspt_created_by: point.lsptCreatedBy,
      lspt_updated_on: point.lsptUpdatedOn?.toISOString() ?? null,
      lspt_updated_by: point.lsptUpdatedBy,
    };
  }

  private toGiftPayload(gift: LoyaltySchemeGift): LoyaltyGiftPayload {
    return {
      lsg_id: gift.lsgId,
      lsg_ls_id: gift.lsgLsId,
      lsg_slno: gift.lsgSlno,
      lsg_item_id: gift.lsgItemId,
      lsg_unit_id: gift.lsgUnitId,
      lsg_item_qty: this.toNumber(gift.lsgItemQty),
      lsg_redeem_points: this.toNumber(gift.lsgRedeemPoints),
      lsg_repeat: gift.lsgRepeat,
      lsg_notes: gift.lsgNotes,
      lsg_is_active: gift.lsgIsActive,
      lsg_is_deleted: gift.lsgIsDeleted,
      lsg_sync_date: gift.lsgSyncDate?.toISOString() ?? null,
      lsg_created_on: gift.lsgCreatedOn.toISOString(),
      lsg_created_by: gift.lsgCreatedBy,
      lsg_updated_on: gift.lsgUpdatedOn?.toISOString() ?? null,
      lsg_updated_by: gift.lsgUpdatedBy,
    };
  }

  private toIsoDate(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private toIsoTime(value: Date | null): string | null {
    if (!value) {
      return null;
    }

    const hours = String(value.getUTCHours()).padStart(2, '0');
    const minutes = String(value.getUTCMinutes()).padStart(2, '0');
    const seconds = String(value.getUTCSeconds()).padStart(2, '0');
    const milliseconds = value.getUTCMilliseconds();

    if (milliseconds === 0) {
      return `${hours}:${minutes}:${seconds}`;
    }

    const fraction = String(milliseconds).padStart(3, '0').replace(/0+$/, '');
    return `${hours}:${minutes}:${seconds}.${fraction}`;
  }

  private toNumber(value: Prisma.Decimal | number): number {
    return Number(value);
  }

  private ensureDateRange(startDate: Date, endDate: Date): void {
    if (startDate.getTime() > endDate.getTime()) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ls_end_date',
          message: 'ls_end_date must be greater than or equal to ls_start_date',
        },
      ]);
    }
  }

  private parseDateBoundary(value: string, field: string, boundary: 'start' | 'end'): Date {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid date`,
        },
      ]);
    }

    if (boundary === 'end') {
      parsed.setUTCHours(23, 59, 59, 999);
    }

    return parsed;
  }

  private normalizeNullableString(value: string | null | undefined): string | null {
    if (value === undefined || value === null) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }

  private requireString(value: string | undefined, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      this.throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
    }

    return value.trim();
  }

  private requireUuid(value: string | undefined, field: string): string {
    if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
      this.throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
    }

    return value;
  }

  private requireInteger(value: number | undefined, field: string): number {
    if (!Number.isInteger(value)) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be an integer`,
        },
      ]);
    }

    return value as number;
  }

  private requireNumber(value: number | undefined, field: string, minValue: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minValue) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be greater than or equal to ${minValue}`,
        },
      ]);
    }

    return value;
  }

  private requireDate(value: string | undefined, field: string): Date {
    if (!value) {
      this.throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
    }

    return this.parseDateBoundary(value, field, 'start');
  }

  private requireDateTime(value: string | undefined, field: string): Date {
    if (!value) {
      this.throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid datetime`,
        },
      ]);
    }

    return parsed;
  }

  private resolveActorUuid(...candidates: Array<string | null | undefined>): string | null {
    for (const candidate of candidates) {
      if (candidate && UUID_PATTERN.test(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  private resolveAuditActor(): string {
    return this.requestContextService.getUserId() ?? DEFAULT_AUDIT_ACTOR;
  }

  private buildPointDisplayName(lsptLsId: string, lsptSlno: number): string {
    return `Scheme ${lsptLsId} / Point ${lsptSlno}`;
  }

  private buildGiftDisplayName(lsgLsId: string, lsgSlno: number): string {
    return `Scheme ${lsgLsId} / Gift ${lsgSlno}`;
  }

  private hasOwn<T extends object>(value: T, key: keyof T): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  private handleWriteError(error: unknown): void {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
      return;
    }

    if (error.code === 'P2002') {
      this.throwConflict('Duplicate loyalty data is not allowed', [
        {
          field: 'request',
          message: 'A record with the same unique values already exists',
        },
      ]);
      return;
    }

    if (error.code === 'P2003') {
      this.throwBadRequest('Validation failed', [
        {
          field: this.resolveForeignKeyField(error),
          message: 'Referenced master record was not found or is inactive',
        },
      ]);
    }
  }

  private resolveForeignKeyField(error: Prisma.PrismaClientKnownRequestError): string {
    const metaField =
      typeof error.meta?.field_name === 'string'
        ? error.meta.field_name
        : typeof error.meta?.target === 'string'
          ? error.meta.target
          : '';

    const normalized = metaField.toLowerCase();

    if (normalized.includes('lspt_item')) return 'lspt_item_id';
    if (normalized.includes('lspt_unit')) return 'lspt_unit_id';
    if (normalized.includes('lsg_item')) return 'lsg_item_id';
    if (normalized.includes('lsg_unit')) return 'lsg_unit_id';
    if (normalized.includes('lps_scope')) return 'lps_scope_id';
    if (normalized.includes('lspt_ls') || normalized.includes('lsg_ls') || normalized.includes('lps_ls')) {
      return 'ls_id';
    }

    return 'request';
  }

  private throwBadRequest(
    message: string,
    errors: PromotionLoyaltyPointsErrorDetail[],
  ): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private throwConflict(
    message: string,
    errors: PromotionLoyaltyPointsErrorDetail[],
  ): never {
    throw new ConflictException(this.buildErrorResponse(message, errors));
  }

  private throwNotFound(field: string, value: string, message: string): never {
    throw new NotFoundException(
      this.buildErrorResponse(message, [{ field, message: `${field} ${value} was not found` }]),
    );
  }

  private buildErrorResponse(
    message: string,
    errors: PromotionLoyaltyPointsErrorDetail[],
  ): PromotionLoyaltyPointsErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }
}