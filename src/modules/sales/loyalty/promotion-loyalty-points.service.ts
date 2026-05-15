import { Injectable } from '@nestjs/common';
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
import {
  DEFAULT_AUDIT_ACTOR,
  SalesWriteClient,
  buildSalesErrorResponse,
  hasOwnProperty,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
  toNumber,
} from '../utils/sales-service.utils';
import { resolvePagination, runSalesListQuery } from '../utils/sales-list.utils';
import {
  SchemeWithChildren,
  applyOptionalGiftFields,
  applyOptionalPointFields,
  applyOptionalSchemeFields,
  buildDateRangeFilter,
  buildGiftDisplayName,
  buildPartyDisplayName,
  buildPointDisplayName,
  ensureDateRange,
  handleLoyaltyWriteError,
  normalizeNullableString,
  parseDateBoundary,
  parseTimeToUtcDate,
  requireDate,
  requireDateTime,
  requireInteger,
  requireNumber,
  requireString,
  requireUuid,
  resolveActorUuid,
  toGiftPayload,
  toIsoDate,
  toIsoTime,
  toPartyPayload,
  toPointPayload,
  toSchemePayload,
  toSchemeSummaryPayload,
} from './utils/loyalty.utils';
const LOYALTY_SCREEN_NAME = 'Promotion Loyalty Points';
const LOYALTY_SCHEME_TABLE_NAME = 'loyalty scheme list';
const LOYALTY_POINTS_TABLE_NAME = 'loyalty scheme points';
const LOYALTY_GIFT_TABLE_NAME = 'loyalty scheme gift';
const LOYALTY_PARTY_TABLE_NAME = 'loyalty scheme party scope';
type LoyaltyWriteClient = SalesWriteClient;
type ListResult<T> = { items: T[]; meta: PromotionLoyaltyPointsListMeta };
@Injectable()
export class PromotionLoyaltyPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  async saveScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    if (dto.ls_id) {
      return this.updateScheme(dto);
    }
    return this.createScheme(dto);
  }
  async listSchemes(
    queryDto: ListLoyaltySchemeQueryDto,
  ): Promise<ListResult<LoyaltySchemePayload>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const filters: Prisma.LoyaltySchemeWhereInput[] = [{ lsIsDeleted: false }];
    if (queryDto.ls_comp_id) filters.push({ lsCompId: queryDto.ls_comp_id });
    if (queryDto.ls_branch_id) filters.push({ lsBranchId: queryDto.ls_branch_id });
    if (queryDto.ls_is_active !== undefined) filters.push({ lsIsActive: queryDto.ls_is_active });
    if (queryDto.ls_type) filters.push({ lsType: queryDto.ls_type });
    if (queryDto.ls_status) filters.push({ lsStatus: queryDto.ls_status });
    if (queryDto.search) {
      filters.push({
        OR: [
          { lsName: { contains: queryDto.search, mode: Prisma.QueryMode.insensitive } },
          { lsCode: { contains: queryDto.search, mode: Prisma.QueryMode.insensitive } },
        ],
      });
    }
    const startDateFilter = buildDateRangeFilter(
      queryDto.ls_start_date_from,
      queryDto.ls_start_date_to,
      'ls_start_date',
    );
    if (startDateFilter) filters.push({ lsStartDate: startDateFilter });
    const endDateFilter = buildDateRangeFilter(
      queryDto.ls_end_date_from,
      queryDto.ls_end_date_to,
      'ls_end_date',
    );
    if (endDateFilter) filters.push({ lsEndDate: endDateFilter });
    const where: Prisma.LoyaltySchemeWhereInput =
      filters.length === 1 ? filters[0] : { AND: filters };
    return runSalesListQuery({ page, limit }, {
      countFn: () => this.prisma.loyaltyScheme.count({ where }),
      findManyFn: () => this.prisma.loyaltyScheme.findMany({
        where,
        include: {
          parties: { where: { lpsIsDeleted: false, lpsIsActive: true }, orderBy: [{ lpsSlno: 'asc' }, { lpsId: 'asc' }] },
          points: { where: { lsptIsDeleted: false, lsptIsActive: true }, orderBy: [{ lsptSlno: 'asc' }, { lsptId: 'asc' }] },
          gifts: { where: { lsgIsDeleted: false, lsgIsActive: true }, orderBy: [{ lsgSlno: 'asc' }, { lsgId: 'asc' }] },
        },
        orderBy: [{ lsName: 'asc' }, { lsId: 'asc' }],
        skip,
        take: limit,
      }),
      toItemFn: (scheme) => toSchemePayload(scheme),
    });
  }
  async getSchemeById(lsId: string): Promise<LoyaltySchemePayload> {
    const scheme = await this.findActiveSchemeWithChildren(this.prisma, lsId);
    if (!scheme) {
      this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
    }
    return toSchemePayload(scheme);
  }
  async softDeleteScheme(lsId: string, lsUpdatedBy?: string): Promise<LoyaltySchemeDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findActiveSchemeWithChildren(tx, lsId);
      if (!existing) {
        this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
      }
      const updatedOn = new Date();
      const updatedBy = resolveActorUuid(lsUpdatedBy, this.requestContextService.getUserId());
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
          originalRecord: toSchemePayload(existing),
          modifiedRecord: toSchemePayload({
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
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.LoyaltySchemePointWhereInput = {
      lsptLsId: queryDto.lspt_ls_id,
      lsptIsDeleted: false,
      ...(queryDto.lspt_is_active !== undefined ? { lsptIsActive: queryDto.lspt_is_active } : {}),
    };
    return runSalesListQuery({ page, limit }, {
      countFn: () => this.prisma.loyaltySchemePoint.count({ where }),
      findManyFn: () => this.prisma.loyaltySchemePoint.findMany({ where, orderBy: [{ lsptSlno: 'asc' }, { lsptId: 'asc' }], skip, take: limit }),
      toItemFn: (point) => toPointPayload(point),
    });
  }
  async getPointById(lsptId: string): Promise<LoyaltyPointPayload> {
    const point = await this.prisma.loyaltySchemePoint.findFirst({
      where: { lsptId, lsptIsDeleted: false },
    });
    if (!point) {
      this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
    }
    return toPointPayload(point);
  }
  async softDeletePoint(lsptId: string, lsptUpdatedBy?: string): Promise<LoyaltyPointDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltySchemePoint.findFirst({
        where: { lsptId, lsptIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
      }
      const updatedOn = new Date();
      const updatedBy = resolveActorUuid(
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
          displayName: buildPointDisplayName(existing.lsptLsId, existing.lsptSlno),
          originalRecord: toPointPayload(existing),
          modifiedRecord: toPointPayload(updated),
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
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.LoyaltySchemeGiftWhereInput = {
      lsgLsId: queryDto.lsg_ls_id,
      lsgIsDeleted: false,
      ...(queryDto.lsg_is_active !== undefined ? { lsgIsActive: queryDto.lsg_is_active } : {}),
    };
    return runSalesListQuery({ page, limit }, {
      countFn: () => this.prisma.loyaltySchemeGift.count({ where }),
      findManyFn: () => this.prisma.loyaltySchemeGift.findMany({ where, orderBy: [{ lsgSlno: 'asc' }, { lsgId: 'asc' }], skip, take: limit }),
      toItemFn: (gift) => toGiftPayload(gift),
    });
  }

  async getGiftById(lsgId: string): Promise<LoyaltyGiftPayload> {
    const gift = await this.prisma.loyaltySchemeGift.findFirst({
      where: { lsgId, lsgIsDeleted: false },
    });

    if (!gift) {
      this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
    }

    return toGiftPayload(gift);
  }

  async softDeleteGift(lsgId: string, lsgUpdatedBy?: string): Promise<LoyaltyGiftDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltySchemeGift.findFirst({
        where: { lsgId, lsgIsDeleted: false },
      });

      if (!existing) {
        this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
      }

      const updatedOn = new Date();
      const updatedBy = resolveActorUuid(lsgUpdatedBy, this.requestContextService.getUserId());

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
          displayName: buildGiftDisplayName(existing.lsgLsId, existing.lsgSlno),
          originalRecord: toGiftPayload(existing),
          modifiedRecord: toGiftPayload(updated),
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
    const actorId = resolveActorUuid(this.requestContextService.getUserId());
    const lsCode = normalizeNullableString(dto.ls_code);
    const lsCompId = requireUuid(dto.ls_comp_id, 'ls_comp_id');
    const lsStartDate = requireDate(dto.ls_start_date, 'ls_start_date');
    const lsEndDate = requireDate(dto.ls_end_date, 'ls_end_date');
    const lsCreatedBy = resolveActorUuid(dto.ls_created_by, actorId);
    const lsUpdatedBy = resolveActorUuid(dto.ls_updated_by, lsCreatedBy, actorId);

    const data: Prisma.LoyaltySchemeUncheckedCreateInput = {
      lsName: requireString(dto.ls_name, 'ls_name'),
      lsType: requireString(dto.ls_type, 'ls_type'),
      lsStartDate,
      lsEndDate,
      lsCompId,
      lsCode,
      lsCreatedOn: now,
      lsCreatedBy,
      lsUpdatedOn: now,
      lsUpdatedBy,
    };

    ensureDateRange(lsStartDate, lsEndDate);
    applyOptionalSchemeFields(data, dto, actorId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureSchemeCodeUnique(tx, lsCompId, lsCode);

        const created = await tx.loyaltyScheme.create({ data });
        const parties = await this.syncSchemeParties(tx, created.lsId, dto.parties, actorId);
        const payload = toSchemePayload({ ...created, parties, points: [], gifts: [] });

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
      handleLoyaltyWriteError(error);
      throw error;
    }
  }

  private async updateScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    const lsId = requireUuid(dto.ls_id, 'ls_id');
    const actorId = resolveActorUuid(this.requestContextService.getUserId());

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await this.findActiveSchemeWithChildren(tx, lsId);
        if (!existing) {
          this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
        }

        const effectiveStartDate = hasOwnProperty(dto, 'ls_start_date')
          ? requireDate(dto.ls_start_date, 'ls_start_date')
          : existing.lsStartDate;
        const effectiveEndDate = hasOwnProperty(dto, 'ls_end_date')
          ? requireDate(dto.ls_end_date, 'ls_end_date')
          : existing.lsEndDate;
        const effectiveCompId = hasOwnProperty(dto, 'ls_comp_id')
          ? requireUuid(dto.ls_comp_id, 'ls_comp_id')
          : existing.lsCompId;
        const effectiveCode = hasOwnProperty(dto, 'ls_code')
          ? normalizeNullableString(dto.ls_code)
          : existing.lsCode;

        ensureDateRange(effectiveStartDate, effectiveEndDate);
        await this.ensureSchemeCodeUnique(tx, effectiveCompId, effectiveCode, lsId);

        const data: Prisma.LoyaltySchemeUncheckedUpdateInput = {
          lsUpdatedOn: new Date(),
          lsUpdatedBy: resolveActorUuid(dto.ls_updated_by, actorId),
        };

        if (hasOwnProperty(dto, 'ls_name')) {
          data.lsName = requireString(dto.ls_name, 'ls_name');
        }
        if (hasOwnProperty(dto, 'ls_type')) {
          data.lsType = requireString(dto.ls_type, 'ls_type');
        }
        if (hasOwnProperty(dto, 'ls_start_date')) {
          data.lsStartDate = effectiveStartDate;
        }
        if (hasOwnProperty(dto, 'ls_end_date')) {
          data.lsEndDate = effectiveEndDate;
        }
        if (hasOwnProperty(dto, 'ls_comp_id')) {
          data.lsCompId = effectiveCompId;
        }
        if (hasOwnProperty(dto, 'ls_code')) {
          data.lsCode = effectiveCode;
        }

        applyOptionalSchemeFields(data, dto, actorId);

        const updated = await tx.loyaltyScheme.update({
          where: { lsId },
          data,
        });

        const parties = await this.syncSchemeParties(tx, lsId, dto.parties, actorId);
        const payload = toSchemePayload({
          ...updated,
          parties: hasOwnProperty(dto, 'parties') ? parties : existing.parties,
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
            originalRecord: toSchemePayload(existing),
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty scheme updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      handleLoyaltyWriteError(error);
      throw error;
    }
  }

  private calculatePointFactor(points: number | undefined, each: number | undefined): number {
    const normalizedPoints = requireNumber(points, 'lspt_points', 0);
    const normalizedEach = requireNumber(each, 'lspt_each', Number.EPSILON);

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
    const actorId = resolveActorUuid(this.requestContextService.getUserId());
    const lsptLsId = requireUuid(dto.lspt_ls_id, 'lspt_ls_id');
    const lsptCreatedBy = resolveActorUuid(dto.lspt_created_by, actorId);
    const lsptUpdatedBy = resolveActorUuid(dto.lspt_updated_by, lsptCreatedBy, actorId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const scheme = await this.getActiveScheme(tx, lsptLsId);
        await this.ensurePointReferenceRecords(tx, scheme.lsItemType, dto);

        const lsptSlno = dto.lspt_slno ?? (await this.getNextPointSlno(tx, lsptLsId));
        await this.ensurePointSlnoUnique(tx, lsptLsId, lsptSlno);

        const lsptPoints = requireNumber(dto.lspt_points, 'lspt_points', 0);
        const lsptEach = requireNumber(dto.lspt_each, 'lspt_each', Number.EPSILON);
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

        applyOptionalPointFields(data, dto);

        data.lsptEach = lsptEach;
        data.lsptFactor = lsptFactor;

        const created = await tx.loyaltySchemePoint.create({ data });
        const payload = toPointPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'insert',
            tableName: LOYALTY_POINTS_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: created.lsptId,
            displayName: buildPointDisplayName(created.lsptLsId, created.lsptSlno),
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
      handleLoyaltyWriteError(error);
      throw error;
    }
  }

  private async updatePoint(dto: SaveLoyaltyPointDto): Promise<LoyaltyPointPayload> {
    const lsptId = requireUuid(dto.lspt_id, 'lspt_id');
    const actorId = resolveActorUuid(this.requestContextService.getUserId());

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.loyaltySchemePoint.findFirst({
          where: { lsptId, lsptIsDeleted: false },
        });

        if (!existing) {
          this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
        }

        const effectiveSchemeId = hasOwnProperty(dto, 'lspt_ls_id')
          ? requireUuid(dto.lspt_ls_id, 'lspt_ls_id')
          : existing.lsptLsId;
        const effectiveSlno = hasOwnProperty(dto, 'lspt_slno')
          ? requireInteger(dto.lspt_slno, 'lspt_slno')
          : existing.lsptSlno;

        const scheme = await this.getActiveScheme(tx, effectiveSchemeId);
        await this.ensurePointReferenceRecords(tx, scheme.lsItemType, dto);
        await this.ensurePointSlnoUnique(tx, effectiveSchemeId, effectiveSlno, lsptId);

        const effectivePoints = hasOwnProperty(dto, 'lspt_points')
          ? requireNumber(dto.lspt_points, 'lspt_points', 0)
          : requireNumber(existing.lsptPoints.toNumber(), 'lspt_points', 0);

        const effectiveEach = hasOwnProperty(dto, 'lspt_each')
          ? requireNumber(dto.lspt_each, 'lspt_each', Number.EPSILON)
          : requireNumber(existing.lsptEach.toNumber(), 'lspt_each', Number.EPSILON);

        const effectiveFactor = this.calculatePointFactor(effectivePoints, effectiveEach);

        const data: Prisma.LoyaltySchemePointUncheckedUpdateInput = {
          lsptUpdatedOn: new Date(),
          lsptUpdatedBy: resolveActorUuid(dto.lspt_updated_by, actorId),
        };

        if (hasOwnProperty(dto, 'lspt_ls_id')) {
          data.lsptLsId = effectiveSchemeId;
        }
        if (hasOwnProperty(dto, 'lspt_slno')) {
          data.lsptSlno = effectiveSlno;
        }
        if (hasOwnProperty(dto, 'lspt_points')) {
          data.lsptPoints = effectivePoints;
        }

        applyOptionalPointFields(data, dto);

        data.lsptPoints = effectivePoints;
        data.lsptEach = effectiveEach;
        data.lsptFactor = effectiveFactor;

        const updated = await tx.loyaltySchemePoint.update({
          where: { lsptId },
          data,
        });
        const payload = toPointPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_POINTS_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: lsptId,
            displayName: buildPointDisplayName(updated.lsptLsId, updated.lsptSlno),
            originalRecord: toPointPayload(existing),
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty point updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      handleLoyaltyWriteError(error);
      throw error;
    }
  }

  private async createGift(dto: SaveLoyaltyGiftDto): Promise<LoyaltyGiftPayload> {
    const now = new Date();
    const actorId = resolveActorUuid(this.requestContextService.getUserId());
    const lsgLsId = requireUuid(dto.lsg_ls_id, 'lsg_ls_id');
    const lsgCreatedBy = resolveActorUuid(dto.lsg_created_by, actorId);
    const lsgUpdatedBy = resolveActorUuid(dto.lsg_updated_by, lsgCreatedBy, actorId);

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureSchemeExists(tx, lsgLsId);
        await this.ensureGiftReferenceRecords(tx, dto);

        const lsgSlno = dto.lsg_slno ?? (await this.getNextGiftSlno(tx, lsgLsId));
        await this.ensureGiftSlnoUnique(tx, lsgLsId, lsgSlno);

        const data: Prisma.LoyaltySchemeGiftUncheckedCreateInput = {
          lsgLsId,
          lsgSlno,
          lsgItemId: requireUuid(dto.lsg_item_id, 'lsg_item_id'),
          lsgUnitId: requireUuid(dto.lsg_unit_id, 'lsg_unit_id'),
          lsgItemQty: requireNumber(dto.lsg_item_qty, 'lsg_item_qty', Number.EPSILON),
          lsgRedeemPoints: requireNumber(dto.lsg_redeem_points, 'lsg_redeem_points', 0),
          lsgCreatedOn: now,
          lsgCreatedBy,
          lsgUpdatedOn: now,
          lsgUpdatedBy,
        };

        applyOptionalGiftFields(data, dto);

        const created = await tx.loyaltySchemeGift.create({ data });
        const payload = toGiftPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'insert',
            tableName: LOYALTY_GIFT_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: created.lsgId,
            displayName: buildGiftDisplayName(created.lsgLsId, created.lsgSlno),
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
      handleLoyaltyWriteError(error);
      throw error;
    }
  }

  private async updateGift(dto: SaveLoyaltyGiftDto): Promise<LoyaltyGiftPayload> {
    const lsgId = requireUuid(dto.lsg_id, 'lsg_id');
    const actorId = resolveActorUuid(this.requestContextService.getUserId());

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.loyaltySchemeGift.findFirst({
          where: { lsgId, lsgIsDeleted: false },
        });

        if (!existing) {
          this.throwNotFound('lsg_id', lsgId, 'Loyalty gift not found');
        }

        const effectiveSchemeId = hasOwnProperty(dto, 'lsg_ls_id')
          ? requireUuid(dto.lsg_ls_id, 'lsg_ls_id')
          : existing.lsgLsId;
        const effectiveSlno = hasOwnProperty(dto, 'lsg_slno')
          ? requireInteger(dto.lsg_slno, 'lsg_slno')
          : existing.lsgSlno;

        await this.ensureSchemeExists(tx, effectiveSchemeId);
        await this.ensureGiftReferenceRecords(tx, dto);
        await this.ensureGiftSlnoUnique(tx, effectiveSchemeId, effectiveSlno, lsgId);

        const data: Prisma.LoyaltySchemeGiftUncheckedUpdateInput = {
          lsgUpdatedOn: new Date(),
          lsgUpdatedBy: resolveActorUuid(dto.lsg_updated_by, actorId),
        };

        if (hasOwnProperty(dto, 'lsg_ls_id')) {
          data.lsgLsId = effectiveSchemeId;
        }
        if (hasOwnProperty(dto, 'lsg_slno')) {
          data.lsgSlno = effectiveSlno;
        }
        if (hasOwnProperty(dto, 'lsg_item_id')) {
          data.lsgItemId = requireUuid(dto.lsg_item_id, 'lsg_item_id');
        }
        if (hasOwnProperty(dto, 'lsg_unit_id')) {
          data.lsgUnitId = requireUuid(dto.lsg_unit_id, 'lsg_unit_id');
        }
        if (hasOwnProperty(dto, 'lsg_item_qty')) {
          data.lsgItemQty = requireNumber(dto.lsg_item_qty, 'lsg_item_qty', Number.EPSILON);
        }
        if (hasOwnProperty(dto, 'lsg_redeem_points')) {
          data.lsgRedeemPoints = requireNumber(dto.lsg_redeem_points, 'lsg_redeem_points', 0);
        }

        applyOptionalGiftFields(data, dto);

        const updated = await tx.loyaltySchemeGift.update({
          where: { lsgId },
          data,
        });
        const payload = toGiftPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_GIFT_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: lsgId,
            displayName: buildGiftDisplayName(updated.lsgLsId, updated.lsgSlno),
            originalRecord: toGiftPayload(existing),
            modifiedRecord: payload,
            userId: this.resolveAuditActor(),
            notes: 'Loyalty gift updated',
          },
          tx,
        );

        return payload;
      });
    } catch (error) {
      handleLoyaltyWriteError(error);
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
            lpsScopeType: requireString(inputParty.lps_scope_type, 'lps_scope_type'),
            lpsScopeId: requireUuid(inputParty.lps_scope_id, 'lps_scope_id'),
            lpsIsExclude: inputParty.lps_is_exclude ?? false,
            lpsNotes: inputParty.lps_notes ?? null,
            lpsIsActive: inputParty.lps_is_active ?? true,
            lpsUpdatedOn: now,
            lpsUpdatedBy: resolveActorUuid(inputParty.lps_updated_by, actorId),
          },
        });

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_PARTY_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: updated.lpsId,
            displayName: buildPartyDisplayName(updated.lpsLsId, updated.lpsSlno),
            originalRecord: toPartyPayload(existingParty),
            modifiedRecord: toPartyPayload(updated),
            userId: this.resolveAuditActor(),
            notes: 'Loyalty party scope updated',
          },
          client,
        );

        keptIds.add(updated.lpsId);
        persisted.push(updated);
        continue;
      }

      const createdBy = resolveActorUuid(inputParty.lps_created_by, actorId);
      const updatedBy = resolveActorUuid(inputParty.lps_updated_by, createdBy, actorId);

      const created = await client.loyaltySchemeParty.create({
        data: {
          lpsLsId: lsId,
          lpsSlno,
          lpsScopeType: requireString(inputParty.lps_scope_type, 'lps_scope_type'),
          lpsScopeId: requireUuid(inputParty.lps_scope_id, 'lps_scope_id'),
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
          displayName: buildPartyDisplayName(created.lpsLsId, created.lpsSlno),
          originalRecord: null,
          modifiedRecord: toPartyPayload(created),
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
          lpsUpdatedBy: resolveActorUuid(actorId),
        },
      });

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LOYALTY_PARTY_TABLE_NAME,
          screenName: LOYALTY_SCREEN_NAME,
          screenType: 'master',
          pk: deleted.lpsId,
          displayName: buildPartyDisplayName(deleted.lpsLsId, deleted.lpsSlno),
          originalRecord: toPartyPayload(removedParty),
          modifiedRecord: toPartyPayload(deleted),
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
      await this.ensurePointScopeReference(
        client,
        schemeItemType,
        dto.lspt_item_id,
        'lspt_item_id',
      );
    }

    if (dto.lspt_unit_id) {
      await this.ensureUnitExists(client, dto.lspt_unit_id, 'lspt_unit_id');
    }
  }

  private async ensureGiftReferenceRecords(
    client: LoyaltyWriteClient,
    dto: SaveLoyaltyGiftDto,
  ): Promise<void> {
    await this.ensureItemExists(
      client,
      requireUuid(dto.lsg_item_id, 'lsg_item_id'),
      'lsg_item_id',
    );
    await this.ensureUnitExists(
      client,
      requireUuid(dto.lsg_unit_id, 'lsg_unit_id'),
      'lsg_unit_id',
    );
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

  private resolveAuditActor(): string {
    return this.requestContextService.getUserId() ?? DEFAULT_AUDIT_ACTOR;
  }

  private throwBadRequest(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never {
    throwSalesBadRequest<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
      message,
      errors,
    );
  }

  private throwConflict(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never {
    throwSalesConflict<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
      message,
      errors,
    );
  }

  private throwNotFound(field: string, value: string, message: string): never {
    throwSalesNotFound<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
      message,
      field,
      `${field} ${value} was not found`,
    );
  }

  private buildErrorResponse(
    message: string,
    errors: PromotionLoyaltyPointsErrorDetail[],
  ): PromotionLoyaltyPointsErrorResponse {
    return buildSalesErrorResponse<
      PromotionLoyaltyPointsErrorDetail,
      PromotionLoyaltyPointsErrorResponse
    >(message, errors);
  }
}
