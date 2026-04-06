import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { loyaltysch_gift,loyaltysch_list,loyaltysch_points, Prisma } from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListLoyaltyGiftQueryDto } from './dto/list-loyalty-gift-query.dto';
import { ListLoyaltyPointQueryDto } from './dto/list-loyalty-point-query.dto';
import { ListLoyaltySchemeQueryDto } from './dto/list-loyalty-scheme-query.dto';
import { SaveLoyaltyGiftDto } from './dto/save-loyalty-gift.dto';
import { SaveLoyaltyPointDto } from './dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import {
  LoyaltyGiftDeleteResult,
  LoyaltyGiftPayload,
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
const LOYALTY_SCHEME_TABLE_NAME = 'loyaltysch_list';
const LOYALTY_POINTS_TABLE_NAME = 'loyaltysch_points';
const LOYALTY_GIFT_TABLE_NAME = 'loyaltysch_gift';

type LoyaltyWriteClient = Prisma.TransactionClient;
type LoyaltySchemeRecord = loyaltysch_list;
type LoyaltyPointRecord = loyaltysch_points;
type LoyaltyGiftRecord = loyaltysch_gift;
type ListResult<T> = { items: T[]; meta: PromotionLoyaltyPointsListMeta };
type GiftKey = { gift_ls_id: number; gift_slno: number };

@Injectable()
export class PromotionLoyaltyPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  async saveScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    if (dto.ls_id !== undefined) {
      return this.updateScheme(dto);
    }

    return this.createScheme(dto);
  }

  async listSchemes(
    queryDto: ListLoyaltySchemeQueryDto,
  ): Promise<ListResult<LoyaltySchemeSummaryPayload>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const filters: Prisma.loyaltysch_listWhereInput[] = [{ ls_is_deleted: false }];

    if (queryDto.ls_comp_id !== undefined) {
      filters.push({ ls_comp_id: queryDto.ls_comp_id });
    }

    if (queryDto.ls_branch_id !== undefined) {
      filters.push({ ls_branch_id: queryDto.ls_branch_id });
    }

    if (queryDto.ls_is_active !== undefined) {
      filters.push({ ls_is_active: queryDto.ls_is_active });
    }

    if (queryDto.ls_type?.trim()) {
      filters.push({ ls_type: queryDto.ls_type.trim() });
    }

    if (queryDto.search?.trim()) {
      const search = queryDto.search.trim();
      filters.push({
        OR: [
          { ls_name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { ls_code: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      });
    }

    const startDateFilter = this.buildDateRangeFilter(
      queryDto.ls_start_date_from,
      queryDto.ls_start_date_to,
      'ls_start_date',
    );
    if (startDateFilter) {
      filters.push({ ls_start_date: startDateFilter });
    }

    const endDateFilter = this.buildDateRangeFilter(
      queryDto.ls_end_date_from,
      queryDto.ls_end_date_to,
      'ls_end_date',
    );
    if (endDateFilter) {
      filters.push({ ls_end_date: endDateFilter });
    }

    const where: Prisma.loyaltysch_listWhereInput =
      filters.length === 1 ? filters[0] : { AND: filters };

    const [total, records] = await Promise.all([
      this.prisma.loyaltysch_list.count({ where }),
      this.prisma.loyaltysch_list.findMany({
        where,
        orderBy: [{ ls_name: 'asc' }, { ls_id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toSchemeSummaryPayload(record)),
      meta: this.buildMeta(page, limit, total),
    };
  }

  async getSchemeById(lsId: number): Promise<LoyaltySchemePayload> {
    const scheme = await this.findActiveScheme(this.prisma, lsId);
    if (!scheme) {
      this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
    }

    const { points, gifts } = await this.fetchActiveSchemeChildren(this.prisma, lsId);
    return this.toSchemePayload(scheme, points, gifts);
  }

  async softDeleteScheme(lsId: number, modifiedBy?: number): Promise<LoyaltySchemeDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findActiveScheme(tx, lsId);
      if (!existing) {
        this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
      }

      const modifiedOn = new Date();
      const result = await tx.loyaltysch_list.updateMany({
        where: {
          ls_id: lsId,
          ls_is_deleted: false,
        },
        data: {
          ls_is_deleted: true,
          ls_is_active: false,
          modified_on: modifiedOn,
          modified_by: modifiedBy ?? null,
        },
      });

      if (result.count === 0) {
        this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
      }

      await Promise.all([
        tx.loyaltysch_points.updateMany({
          where: {
            lspt_ls_id: lsId,
            lspt_is_deleted: false,
          },
          data: {
            lspt_is_deleted: true,
            lspt_is_active: false,
            modified_on: modifiedOn,
            modified_by: modifiedBy ?? null,
          },
        }),
        tx.loyaltysch_gift.updateMany({
          where: {
            gift_ls_id: lsId,
            gift_is_deleted: false,
          },
          data: {
            gift_is_deleted: true,
            gift_is_active: false,
            modified_on: modifiedOn,
            modified_by: modifiedBy ?? null,
          },
        }),
      ]);

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LOYALTY_SCHEME_TABLE_NAME,
          screenName: LOYALTY_SCREEN_NAME,
          screenType: 'master',
          pk: String(lsId),
          displayName: existing.ls_name,
          originalRecord: this.toSchemeSummaryPayload(existing),
          modifiedRecord: this.toSchemeSummaryPayload({
            ...existing,
            ls_is_deleted: true,
            ls_is_active: false,
            modified_on: modifiedOn,
            modified_by: modifiedBy ?? null,
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
    if (dto.lspt_id !== undefined) {
      return this.updatePoint(dto);
    }

    return this.createPoint(dto);
  }

  async listPoints(queryDto: ListLoyaltyPointQueryDto): Promise<ListResult<LoyaltyPointPayload>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.loyaltysch_pointsWhereInput = {
      lspt_ls_id: queryDto.lspt_ls_id,
      lspt_is_deleted: false,
      ...(queryDto.lspt_is_active !== undefined ? { lspt_is_active: queryDto.lspt_is_active } : {}),
    };

    const [total, records] = await Promise.all([
      this.prisma.loyaltysch_points.count({ where }),
      this.prisma.loyaltysch_points.findMany({
        where,
        orderBy: [{ lspt_slno: 'asc' }, { lspt_id: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toPointPayload(record)),
      meta: this.buildMeta(page, limit, total),
    };
  }

  async getPointById(lsptId: number): Promise<LoyaltyPointPayload> {
    const point = await this.prisma.loyaltysch_points.findFirst({
      where: {
        lspt_id: lsptId,
        lspt_is_deleted: false,
      },
    });

    if (!point) {
      this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
    }

    return this.toPointPayload(point);
  }

  async softDeletePoint(lsptId: number, modifiedBy?: number): Promise<LoyaltyPointDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltysch_points.findFirst({
        where: {
          lspt_id: lsptId,
          lspt_is_deleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
      }

      const modifiedOn = new Date();
      const result = await tx.loyaltysch_points.updateMany({
        where: {
          lspt_id: lsptId,
          lspt_is_deleted: false,
        },
        data: {
          lspt_is_deleted: true,
          lspt_is_active: false,
          modified_on: modifiedOn,
          modified_by: modifiedBy ?? null,
        },
      });

      if (result.count === 0) {
        this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
      }

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LOYALTY_POINTS_TABLE_NAME,
          screenName: LOYALTY_SCREEN_NAME,
          screenType: 'master',
          pk: String(lsptId),
          displayName: this.buildPointDisplayName(existing.lspt_ls_id, existing.lspt_slno),
          originalRecord: this.toPointPayload(existing),
          modifiedRecord: this.toPointPayload({
            ...existing,
            lspt_is_deleted: true,
            lspt_is_active: false,
            modified_on: modifiedOn,
            modified_by: modifiedBy ?? null,
          }),
          userId: this.resolveAuditActor(),
          notes: 'Loyalty point soft deleted',
        },
        tx,
      );

      return { lspt_id: lsptId, deleted: true };
    });
  }

  async saveGift(dto: SaveLoyaltyGiftDto): Promise<LoyaltyGiftPayload> {
    if (dto.gift_slno !== undefined) {
      return this.updateGift(dto);
    }

    return this.createGift(dto);
  }

  async listGifts(queryDto: ListLoyaltyGiftQueryDto): Promise<ListResult<LoyaltyGiftPayload>> {
    const page = queryDto.page ?? DEFAULT_PAGE;
    const limit = queryDto.limit ?? DEFAULT_LIMIT;
    const skip = (page - 1) * limit;

    const where: Prisma.loyaltysch_giftWhereInput = {
      gift_ls_id: queryDto.gift_ls_id,
      gift_is_deleted: false,
      ...(queryDto.gift_is_active !== undefined ? { gift_is_active: queryDto.gift_is_active } : {}),
    };

    const [total, records] = await Promise.all([
      this.prisma.loyaltysch_gift.count({ where }),
      this.prisma.loyaltysch_gift.findMany({
        where,
        orderBy: [{ gift_slno: 'asc' }],
        skip,
        take: limit,
      }),
    ]);

    return {
      items: records.map((record) => this.toGiftPayload(record)),
      meta: this.buildMeta(page, limit, total),
    };
  }

  async getGiftById(giftLsId: number, giftSlno: number): Promise<LoyaltyGiftPayload> {
    const gift = await this.prisma.loyaltysch_gift.findFirst({
      where: {
        gift_ls_id: giftLsId,
        gift_slno: giftSlno,
        gift_is_deleted: false,
      },
    });

    if (!gift) {
      this.throwNotFound('gift_slno', `${giftLsId}:${giftSlno}`, 'Loyalty gift not found');
    }

    return this.toGiftPayload(gift);
  }

  async softDeleteGift(
    giftLsId: number,
    giftSlno: number,
    modifiedBy?: number,
  ): Promise<LoyaltyGiftDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.loyaltysch_gift.findFirst({
        where: {
          gift_ls_id: giftLsId,
          gift_slno: giftSlno,
          gift_is_deleted: false,
        },
      });

      if (!existing) {
        this.throwNotFound('gift_slno', `${giftLsId}:${giftSlno}`, 'Loyalty gift not found');
      }

      const modifiedOn = new Date();
      const result = await tx.loyaltysch_gift.updateMany({
        where: {
          gift_ls_id: giftLsId,
          gift_slno: giftSlno,
          gift_is_deleted: false,
        },
        data: {
          gift_is_deleted: true,
          gift_is_active: false,
          modified_on: modifiedOn,
          modified_by: modifiedBy ?? null,
        },
      });

      if (result.count === 0) {
        this.throwNotFound('gift_slno', `${giftLsId}:${giftSlno}`, 'Loyalty gift not found');
      }

      await this.auditLogService.logEntityChange(
        {
          action: 'cancel',
          tableName: LOYALTY_GIFT_TABLE_NAME,
          screenName: LOYALTY_SCREEN_NAME,
          screenType: 'master',
          pk: `${giftLsId}:${giftSlno}`,
          displayName: this.buildGiftDisplayName(giftLsId, giftSlno),
          originalRecord: this.toGiftPayload(existing),
          modifiedRecord: this.toGiftPayload({
            ...existing,
            gift_is_deleted: true,
            gift_is_active: false,
            modified_on: modifiedOn,
            modified_by: modifiedBy ?? null,
          }),
          userId: this.resolveAuditActor(),
          notes: 'Loyalty gift soft deleted',
        },
        tx,
      );

      return { gift_ls_id: giftLsId, gift_slno: giftSlno, deleted: true };
    });
  }

  private async createScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    const lsName = this.requireString(dto.ls_name, 'ls_name');
    const lsType = this.requireString(dto.ls_type, 'ls_type');
    const startDate = this.requireDate(dto.ls_start_date, 'ls_start_date');
    const endDate = this.requireDate(dto.ls_end_date, 'ls_end_date');
    const companyId = this.requireInteger(dto.ls_comp_id, 'ls_comp_id');
    const now = new Date();
    const createdBy = dto.created_by ?? null;
    const modifiedBy = dto.modified_by ?? createdBy;

    this.ensureDateRange(startDate, endDate);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const normalizedCode = this.normalizeNullableString(dto.ls_code);
        await this.ensureSchemeCodeUnique(tx, normalizedCode);

        const data: Prisma.loyaltysch_listUncheckedCreateInput = {
          ls_name: lsName,
          ls_type: lsType,
          ls_start_date: startDate,
          ls_end_date: endDate,
          ls_comp_id: companyId,
          created_on: now,
          modified_on: now,
          created_by: createdBy,
          modified_by: modifiedBy,
          ls_code: normalizedCode,
        };

        this.applyOptionalSchemeFields(data, dto);

        const created = await tx.loyaltysch_list.create({ data });
        const payload = this.toSchemePayload(created, [], []);

        await this.auditLogService.logEntityChange(
          {
            action: 'insert',
            tableName: LOYALTY_SCHEME_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: String(created.ls_id),
            displayName: created.ls_name,
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
    const lsId = dto.ls_id as number;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await this.findActiveScheme(tx, lsId);
        if (!existing) {
          this.throwNotFound('ls_id', lsId, 'Loyalty scheme not found');
        }

        const effectiveStartDate = this.hasOwn(dto, 'ls_start_date')
          ? this.requireDate(dto.ls_start_date, 'ls_start_date')
          : existing.ls_start_date;
        const effectiveEndDate = this.hasOwn(dto, 'ls_end_date')
          ? this.requireDate(dto.ls_end_date, 'ls_end_date')
          : existing.ls_end_date;

        this.ensureDateRange(effectiveStartDate, effectiveEndDate);

        const effectiveCode = this.hasOwn(dto, 'ls_code')
          ? this.normalizeNullableString(dto.ls_code)
          : existing.ls_code;
        await this.ensureSchemeCodeUnique(tx, effectiveCode, lsId);

        const data: Prisma.loyaltysch_listUncheckedUpdateInput = {
          modified_on: new Date(),
          modified_by: dto.modified_by ?? null,
        };

        this.applyOptionalSchemeFields(data, dto);

        if (this.hasOwn(dto, 'ls_name')) {
          data.ls_name = this.requireString(dto.ls_name, 'ls_name');
        }

        if (this.hasOwn(dto, 'ls_type')) {
          data.ls_type = this.requireString(dto.ls_type, 'ls_type');
        }

        if (this.hasOwn(dto, 'ls_start_date')) {
          data.ls_start_date = effectiveStartDate;
        }

        if (this.hasOwn(dto, 'ls_end_date')) {
          data.ls_end_date = effectiveEndDate;
        }

        if (this.hasOwn(dto, 'ls_comp_id')) {
          data.ls_comp_id = this.requireInteger(dto.ls_comp_id, 'ls_comp_id');
        }

        if (this.hasOwn(dto, 'ls_code')) {
          data.ls_code = effectiveCode;
        }

        const updated = await tx.loyaltysch_list.update({
          where: { ls_id: lsId },
          data,
        });

        const { points, gifts } = await this.fetchActiveSchemeChildren(tx, lsId);
        const payload = this.toSchemePayload(updated, points, gifts);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_SCHEME_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: String(lsId),
            displayName: updated.ls_name,
            originalRecord: this.toSchemePayload(existing, points, gifts),
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

  private async createPoint(dto: SaveLoyaltyPointDto): Promise<LoyaltyPointPayload> {
    const schemeId = this.requireInteger(dto.lspt_ls_id, 'lspt_ls_id');
    const points = this.requireNumber(dto.lspt_points, 'lspt_points', 0);
    const now = new Date();
    const createdBy = dto.created_by ?? null;
    const modifiedBy = dto.modified_by ?? createdBy;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureSchemeExists(tx, schemeId);

        const slno = dto.lspt_slno ?? (await this.getNextPointSlno(tx, schemeId));
        await this.ensurePointSlnoUnique(tx, schemeId, slno);

        const data: Prisma.loyaltysch_pointsUncheckedCreateInput = {
          lspt_ls_id: schemeId,
          lspt_slno: slno,
          lspt_points: points,
          created_on: now,
          modified_on: now,
          created_by: createdBy,
          modified_by: modifiedBy,
        };

        this.applyOptionalPointFields(data, dto);

        const created = await tx.loyaltysch_points.create({ data });
        const payload = this.toPointPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'insert',
            tableName: LOYALTY_POINTS_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: String(created.lspt_id),
            displayName: this.buildPointDisplayName(created.lspt_ls_id, created.lspt_slno),
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
    const lsptId = dto.lspt_id as number;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.loyaltysch_points.findFirst({
          where: {
            lspt_id: lsptId,
            lspt_is_deleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound('lspt_id', lsptId, 'Loyalty point not found');
        }

        const schemeId = this.hasOwn(dto, 'lspt_ls_id')
          ? this.requireInteger(dto.lspt_ls_id, 'lspt_ls_id')
          : existing.lspt_ls_id;
        await this.ensureSchemeExists(tx, schemeId);

        const slno = this.hasOwn(dto, 'lspt_slno')
          ? this.requireInteger(dto.lspt_slno, 'lspt_slno')
          : existing.lspt_slno;
        await this.ensurePointSlnoUnique(tx, schemeId, slno, lsptId);

        const data: Prisma.loyaltysch_pointsUncheckedUpdateInput = {
          modified_on: new Date(),
          modified_by: dto.modified_by ?? null,
        };

        this.applyOptionalPointFields(data, dto);

        if (this.hasOwn(dto, 'lspt_ls_id')) {
          data.lspt_ls_id = schemeId;
        }

        if (this.hasOwn(dto, 'lspt_slno')) {
          data.lspt_slno = slno;
        }

        if (this.hasOwn(dto, 'lspt_points')) {
          data.lspt_points = this.requireNumber(dto.lspt_points, 'lspt_points', 0);
        }

        const updated = await tx.loyaltysch_points.update({
          where: { lspt_id: lsptId },
          data,
        });

        const payload = this.toPointPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_POINTS_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: String(lsptId),
            displayName: this.buildPointDisplayName(updated.lspt_ls_id, updated.lspt_slno),
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
    const schemeId = this.requireInteger(dto.gift_ls_id, 'gift_ls_id');
    const itemId = this.requireInteger(dto.gift_item_id, 'gift_item_id');
    const unitId = this.requireInteger(dto.gift_unit_id, 'gift_unit_id');
    const qty = this.requireNumber(dto.gift_qty, 'gift_qty', Number.EPSILON);
    const points = this.requireNumber(dto.gift_points, 'gift_points', Number.EPSILON);
    const now = new Date();
    const createdBy = dto.created_by ?? null;
    const modifiedBy = dto.modified_by ?? createdBy;

    try {
      return await this.prisma.$transaction(async (tx) => {
        await this.ensureSchemeExists(tx, schemeId);

        const slno = await this.getNextGiftSlno(tx, schemeId);
        await this.ensureGiftRuleUnique(tx, schemeId, itemId, unitId, points);

        const data: Prisma.loyaltysch_giftUncheckedCreateInput = {
          gift_ls_id: schemeId,
          gift_slno: slno,
          gift_item_id: itemId,
          gift_unit_id: unitId,
          gift_qty: qty,
          gift_points: points,
          created_on: now,
          modified_on: now,
          created_by: createdBy,
          modified_by: modifiedBy,
        };

        this.applyOptionalGiftFields(data, dto);

        const created = await tx.loyaltysch_gift.create({ data });
        const payload = this.toGiftPayload(created);

        await this.auditLogService.logEntityChange(
          {
            action: 'insert',
            tableName: LOYALTY_GIFT_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: `${created.gift_ls_id}:${created.gift_slno}`,
            displayName: this.buildGiftDisplayName(created.gift_ls_id, created.gift_slno),
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
    const giftLsId = this.requireInteger(dto.gift_ls_id, 'gift_ls_id');
    const giftSlno = this.requireInteger(dto.gift_slno, 'gift_slno');

    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.loyaltysch_gift.findFirst({
          where: {
            gift_ls_id: giftLsId,
            gift_slno: giftSlno,
            gift_is_deleted: false,
          },
        });

        if (!existing) {
          this.throwNotFound('gift_slno', `${giftLsId}:${giftSlno}`, 'Loyalty gift not found');
        }

        const itemId = this.hasOwn(dto, 'gift_item_id')
          ? this.requireInteger(dto.gift_item_id, 'gift_item_id')
          : existing.gift_item_id;
        const unitId = this.hasOwn(dto, 'gift_unit_id')
          ? this.requireInteger(dto.gift_unit_id, 'gift_unit_id')
          : existing.gift_unit_id;
        const points = this.hasOwn(dto, 'gift_points')
          ? this.requireNumber(dto.gift_points, 'gift_points', Number.EPSILON)
          : this.toNumber(existing.gift_points);

        await this.ensureGiftRuleUnique(tx, giftLsId, itemId, unitId, points, {
          gift_ls_id: giftLsId,
          gift_slno: giftSlno,
        });

        const data: Prisma.loyaltysch_giftUncheckedUpdateInput = {
          modified_on: new Date(),
          modified_by: dto.modified_by ?? null,
        };

        this.applyOptionalGiftFields(data, dto);

        if (this.hasOwn(dto, 'gift_item_id')) {
          data.gift_item_id = itemId;
        }

        if (this.hasOwn(dto, 'gift_unit_id')) {
          data.gift_unit_id = unitId;
        }

        if (this.hasOwn(dto, 'gift_qty')) {
          data.gift_qty = this.requireNumber(dto.gift_qty, 'gift_qty', Number.EPSILON);
        }

        if (this.hasOwn(dto, 'gift_points')) {
          data.gift_points = points;
        }

        const updated = await tx.loyaltysch_gift.update({
          where: {
            gift_ls_id_gift_slno: {
              gift_ls_id: giftLsId,
              gift_slno: giftSlno,
            },
          },
          data,
        });

        const payload = this.toGiftPayload(updated);

        await this.auditLogService.logEntityChange(
          {
            action: 'update',
            tableName: LOYALTY_GIFT_TABLE_NAME,
            screenName: LOYALTY_SCREEN_NAME,
            screenType: 'master',
            pk: `${giftLsId}:${giftSlno}`,
            displayName: this.buildGiftDisplayName(giftLsId, giftSlno),
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

  private async findActiveScheme(
    client: LoyaltyWriteClient | PrismaService,
    lsId: number,
  ): Promise<LoyaltySchemeRecord | null> {
    return client.loyaltysch_list.findFirst({
      where: {
        ls_id: lsId,
        ls_is_deleted: false,
      },
    });
  }

  private async fetchActiveSchemeChildren(
    client: LoyaltyWriteClient | PrismaService,
    lsId: number,
  ): Promise<{ points: LoyaltyPointRecord[]; gifts: LoyaltyGiftRecord[] }> {
    const [points, gifts] = await Promise.all([
      client.loyaltysch_points.findMany({
        where: {
          lspt_ls_id: lsId,
          lspt_is_deleted: false,
          lspt_is_active: true,
        },
        orderBy: [{ lspt_slno: 'asc' }, { lspt_id: 'asc' }],
      }),
      client.loyaltysch_gift.findMany({
        where: {
          gift_ls_id: lsId,
          gift_is_deleted: false,
          gift_is_active: true,
        },
        orderBy: [{ gift_slno: 'asc' }],
      }),
    ]);

    return { points, gifts };
  }

  private applyOptionalSchemeFields(
    data: Prisma.loyaltysch_listUncheckedCreateInput | Prisma.loyaltysch_listUncheckedUpdateInput,
    dto: SaveLoyaltySchemeDto,
  ): void {
    if (this.hasOwn(dto, 'ls_apply_on')) {
      data.ls_apply_on = this.requireString(dto.ls_apply_on, 'ls_apply_on');
    }

    if (this.hasOwn(dto, 'ls_bill_type')) {
      data.ls_bill_type = this.requireString(dto.ls_bill_type, 'ls_bill_type');
    }

    if (this.hasOwn(dto, 'ls_cust_type')) {
      data.ls_cust_type = this.requireString(dto.ls_cust_type, 'ls_cust_type');
    }

    if (this.hasOwn(dto, 'ls_item_type')) {
      data.ls_item_type = this.requireString(dto.ls_item_type, 'ls_item_type');
    }

    if (this.hasOwn(dto, 'ls_branch_id')) {
      data.ls_branch_id = dto.ls_branch_id ?? null;
    }

    if (this.hasOwn(dto, 'ls_points_per_inr')) {
      data.ls_points_per_inr = this.requireNumber(dto.ls_points_per_inr, 'ls_points_per_inr', 0);
    }

    if (this.hasOwn(dto, 'ls_points_per_qty')) {
      data.ls_points_per_qty = this.requireNumber(dto.ls_points_per_qty, 'ls_points_per_qty', 0);
    }

    if (this.hasOwn(dto, 'ls_min_bill_amount')) {
      data.ls_min_bill_amount = this.requireNumber(
        dto.ls_min_bill_amount,
        'ls_min_bill_amount',
        0,
      );
    }

    if (this.hasOwn(dto, 'ls_max_points_per_bill')) {
      data.ls_max_points_per_bill = this.requireNumber(
        dto.ls_max_points_per_bill,
        'ls_max_points_per_bill',
        0,
      );
    }

    if (this.hasOwn(dto, 'ls_recur_apl')) {
      data.ls_recur_apl = dto.ls_recur_apl ?? false;
    }

    if (this.hasOwn(dto, 'ls_bal_apl')) {
      data.ls_bal_apl = dto.ls_bal_apl ?? false;
    }

    if (this.hasOwn(dto, 'ls_allow_point_earn')) {
      data.ls_allow_point_earn = dto.ls_allow_point_earn ?? true;
    }

    if (this.hasOwn(dto, 'ls_allow_point_redeem')) {
      data.ls_allow_point_redeem = dto.ls_allow_point_redeem ?? false;
    }

    if (this.hasOwn(dto, 'ls_allow_gift_redeem')) {
      data.ls_allow_gift_redeem = dto.ls_allow_gift_redeem ?? false;
    }

    if (this.hasOwn(dto, 'ls_is_active')) {
      data.ls_is_active = dto.ls_is_active ?? true;
    }
  }

  private applyOptionalPointFields(
    data:
      | Prisma.loyaltysch_pointsUncheckedCreateInput
      | Prisma.loyaltysch_pointsUncheckedUpdateInput,
    dto: SaveLoyaltyPointDto,
  ): void {
    if (this.hasOwn(dto, 'lspt_item_id')) {
      data.lspt_item_id = dto.lspt_item_id ?? null;
    }

    if (this.hasOwn(dto, 'lspt_unit_id')) {
      data.lspt_unit_id = dto.lspt_unit_id ?? null;
    }

    if (this.hasOwn(dto, 'lspt_exceeds')) {
      data.lspt_exceeds = this.requireNumber(dto.lspt_exceeds, 'lspt_exceeds', 0);
    }

    if (this.hasOwn(dto, 'lspt_each')) {
      data.lspt_each = this.requireNumber(dto.lspt_each, 'lspt_each', Number.EPSILON);
    }

    if (this.hasOwn(dto, 'lspt_factor')) {
      data.lspt_factor = this.requireNumber(dto.lspt_factor, 'lspt_factor', 0);
    }

    if (this.hasOwn(dto, 'lspt_is_active')) {
      data.lspt_is_active = dto.lspt_is_active ?? true;
    }
  }

  private applyOptionalGiftFields(
    data: Prisma.loyaltysch_giftUncheckedCreateInput | Prisma.loyaltysch_giftUncheckedUpdateInput,
    dto: SaveLoyaltyGiftDto,
  ): void {
    if (this.hasOwn(dto, 'gift_repeat')) {
      data.gift_repeat = dto.gift_repeat ?? false;
    }

    if (this.hasOwn(dto, 'gift_is_active')) {
      data.gift_is_active = dto.gift_is_active ?? true;
    }
  }

  private buildDateRangeFilter(
    fromValue: string | undefined,
    toValue: string | undefined,
    field: 'ls_start_date' | 'ls_end_date',
  ): Prisma.DateTimeFilter<'loyaltysch_list'> | undefined {
    if (!fromValue && !toValue) {
      return undefined;
    }

    const filter: Prisma.DateTimeFilter<'loyaltysch_list'> = {};

    if (fromValue) {
      filter.gte = this.parseDateBoundary(fromValue, field, 'start');
    }

    if (toValue) {
      filter.lte = this.parseDateBoundary(toValue, field, 'end');
    }

    return filter;
  }

  private async ensureSchemeExists(client: LoyaltyWriteClient, lsId: number): Promise<void> {
    const existing = await client.loyaltysch_list.findFirst({
      where: {
        ls_id: lsId,
        ls_is_deleted: false,
      },
      select: {
        ls_id: true,
      },
    });

    if (!existing) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'ls_id',
          message: `No active loyalty scheme found with id ${lsId}`,
        },
      ]);
    }
  }

  private async ensureSchemeCodeUnique(
    client: LoyaltyWriteClient,
    code: string | null,
    excludeId?: number,
  ): Promise<void> {
    if (!code) {
      return;
    }

    const existing = await client.loyaltysch_list.findFirst({
      where: {
        ls_code: code,
        ...(excludeId !== undefined ? { NOT: { ls_id: excludeId } } : {}),
      },
      select: {
        ls_id: true,
      },
    });

    if (existing) {
      this.throwConflict('Duplicate loyalty scheme code is not allowed', [
        {
          field: 'ls_code',
          message: `A loyalty scheme already exists with code ${code}`,
        },
      ]);
    }
  }

  private async ensurePointSlnoUnique(
    client: LoyaltyWriteClient,
    schemeId: number,
    slno: number,
    excludeId?: number,
  ): Promise<void> {
    const existing = await client.loyaltysch_points.findFirst({
      where: {
        lspt_ls_id: schemeId,
        lspt_slno: slno,
        ...(excludeId !== undefined ? { NOT: { lspt_id: excludeId } } : {}),
      },
      select: {
        lspt_id: true,
      },
    });

    if (existing) {
      this.throwConflict('Duplicate loyalty point sequence is not allowed', [
        {
          field: 'lspt_slno',
          message: `Sequence ${slno} is already used for loyalty scheme ${schemeId}`,
        },
      ]);
    }
  }

  private async ensureGiftRuleUnique(
    client: LoyaltyWriteClient,
    schemeId: number,
    itemId: number,
    unitId: number,
    points: number,
    excludeKey?: GiftKey,
  ): Promise<void> {
    const existing = await client.loyaltysch_gift.findFirst({
      where: {
        gift_ls_id: schemeId,
        gift_item_id: itemId,
        gift_unit_id: unitId,
        gift_points: points,
        ...(excludeKey
          ? {
              NOT: {
                gift_ls_id: excludeKey.gift_ls_id,
                gift_slno: excludeKey.gift_slno,
              },
            }
          : {}),
      },
      select: {
        gift_ls_id: true,
        gift_slno: true,
      },
    });

    if (existing) {
      this.throwConflict('Duplicate loyalty gift rule is not allowed', [
        {
          field: 'gift_points',
          message:
            `A gift rule already exists for scheme ${schemeId} with the same item, unit, and points`,
        },
      ]);
    }
  }

  private async getNextPointSlno(client: LoyaltyWriteClient, schemeId: number): Promise<number> {
    const lastPoint = await client.loyaltysch_points.findFirst({
      where: {
        lspt_ls_id: schemeId,
      },
      orderBy: {
        lspt_slno: 'desc',
      },
      select: {
        lspt_slno: true,
      },
    });

    return (lastPoint?.lspt_slno ?? 0) + 1;
  }

  private async getNextGiftSlno(client: LoyaltyWriteClient, schemeId: number): Promise<number> {
    const lastGift = await client.loyaltysch_gift.findFirst({
      where: {
        gift_ls_id: schemeId,
      },
      orderBy: {
        gift_slno: 'desc',
      },
      select: {
        gift_slno: true,
      },
    });

    return (lastGift?.gift_slno ?? 0) + 1;
  }

  private toSchemeSummaryPayload(record: LoyaltySchemeRecord): LoyaltySchemeSummaryPayload {
    return {
      ls_id: record.ls_id,
      ls_code: record.ls_code,
      ls_name: record.ls_name,
      ls_type: record.ls_type,
      ls_apply_on: record.ls_apply_on,
      ls_bill_type: record.ls_bill_type,
      ls_cust_type: record.ls_cust_type,
      ls_item_type: record.ls_item_type,
      ls_start_date: record.ls_start_date.toISOString(),
      ls_end_date: record.ls_end_date.toISOString(),
      ls_comp_id: record.ls_comp_id,
      ls_branch_id: record.ls_branch_id,
      ls_points_per_inr: this.toNumber(record.ls_points_per_inr),
      ls_points_per_qty: this.toNumber(record.ls_points_per_qty),
      ls_min_bill_amount: this.toNumber(record.ls_min_bill_amount),
      ls_max_points_per_bill: this.toNumber(record.ls_max_points_per_bill),
      ls_recur_apl: record.ls_recur_apl,
      ls_bal_apl: record.ls_bal_apl,
      ls_allow_point_earn: record.ls_allow_point_earn,
      ls_allow_point_redeem: record.ls_allow_point_redeem,
      ls_allow_gift_redeem: record.ls_allow_gift_redeem,
      ls_is_active: record.ls_is_active,
      ls_is_deleted: record.ls_is_deleted,
      created_on: record.created_on.toISOString(),
      created_by: record.created_by,
      modified_on: record.modified_on ? record.modified_on.toISOString() : null,
      modified_by: record.modified_by,
    };
  }

  private toSchemePayload(
    record: LoyaltySchemeRecord,
    points: LoyaltyPointRecord[],
    gifts: LoyaltyGiftRecord[],
  ): LoyaltySchemePayload {
    return {
      ...this.toSchemeSummaryPayload(record),
      points: points.map((point) => this.toPointPayload(point)),
      gifts: gifts.map((gift) => this.toGiftPayload(gift)),
    };
  }

  private toPointPayload(record: LoyaltyPointRecord): LoyaltyPointPayload {
    return {
      lspt_id: record.lspt_id,
      lspt_ls_id: record.lspt_ls_id,
      lspt_slno: record.lspt_slno,
      lspt_item_id: record.lspt_item_id,
      lspt_unit_id: record.lspt_unit_id,
      lspt_exceeds: this.toNumber(record.lspt_exceeds),
      lspt_each: this.toNumber(record.lspt_each),
      lspt_factor: this.toNumber(record.lspt_factor),
      lspt_points: this.toNumber(record.lspt_points),
      lspt_is_active: record.lspt_is_active,
      lspt_is_deleted: record.lspt_is_deleted,
      created_on: record.created_on.toISOString(),
      created_by: record.created_by,
      modified_on: record.modified_on ? record.modified_on.toISOString() : null,
      modified_by: record.modified_by,
    };
  }

  private toGiftPayload(record: LoyaltyGiftRecord): LoyaltyGiftPayload {
    return {
      gift_ls_id: record.gift_ls_id,
      gift_slno: record.gift_slno,
      gift_item_id: record.gift_item_id,
      gift_unit_id: record.gift_unit_id,
      gift_qty: this.toNumber(record.gift_qty),
      gift_points: this.toNumber(record.gift_points),
      gift_repeat: record.gift_repeat,
      gift_is_active: record.gift_is_active,
      gift_is_deleted: record.gift_is_deleted,
      created_on: record.created_on.toISOString(),
      created_by: record.created_by,
      modified_on: record.modified_on ? record.modified_on.toISOString() : null,
      modified_by: record.modified_by,
    };
  }

  private buildMeta(page: number, limit: number, total: number): PromotionLoyaltyPointsListMeta {
    return {
      page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
  }

  private requireString(value: string | undefined, field: string): string {
    if (typeof value !== 'string' || !value.trim()) {
      this.throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
    }

    return value.trim();
  }

  private requireInteger(value: number | undefined, field: string): number {
    if (!Number.isInteger(value) || Number(value) <= 0) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a positive integer`,
        },
      ]);
    }

    return value as number;
  }

  private requireNumber(value: number | undefined, field: string, minimum: number): number {
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message:
            minimum <= 0
              ? `${field} must be a non-negative number`
              : `${field} must be greater than 0`,
        },
      ]);
    }

    return value;
  }

  private requireDate(value: string | undefined, field: string): Date {
    if (!value?.trim()) {
      this.throwBadRequest('Validation failed', [{ field, message: `${field} is required` }]);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `${field} must be a valid ISO date`,
        },
      ]);
    }

    return parsed;
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

  private parseDateBoundary(
    value: string,
    field: 'ls_start_date' | 'ls_end_date',
    boundary: 'start' | 'end',
  ): Date {
    const normalized = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
      const suffix = boundary === 'start' ? 'T00:00:00.000Z' : 'T23:59:59.999Z';
      return new Date(`${normalized}${suffix}`);
    }

    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
      this.throwBadRequest('Validation failed', [
        {
          field,
          message: `Invalid date value: ${value}`,
        },
      ]);
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

  private buildPointDisplayName(schemeId: number, slno: number): string {
    return `Scheme ${schemeId} Point ${slno}`;
  }

  private buildGiftDisplayName(schemeId: number, slno: number): string {
    return `Scheme ${schemeId} Gift ${slno}`;
  }

  private resolveAuditActor(): string {
    return this.requestContextService.getUserId() ?? DEFAULT_AUDIT_ACTOR;
  }

  private toNumber(value: Prisma.Decimal | number | null | undefined): number {
    const parsed = Number(value ?? 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private hasOwn<T extends object>(value: T, key: keyof T): boolean {
    return Object.prototype.hasOwnProperty.call(value, key);
  }

  private buildErrorResponse(
    message: string,
    errors: PromotionLoyaltyPointsErrorDetail[] = [],
  ): PromotionLoyaltyPointsErrorResponse {
    return {
      success: false,
      message,
      errors,
    };
  }

  private throwBadRequest(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never {
    throw new BadRequestException(this.buildErrorResponse(message, errors));
  }

  private throwConflict(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never {
    throw new ConflictException(this.buildErrorResponse(message, errors));
  }

  private throwNotFound(field: string, value: number | string, message: string): never {
    throw new NotFoundException(
      this.buildErrorResponse(message, [
        {
          field,
          message: `No active record found for ${field} ${value}`,
        },
      ]),
    );
  }

  private handleWriteError(error: unknown): void {
    const prismaError = error as {
      code?: string;
      meta?: {
        target?: unknown;
      };
    };

    if (prismaError.code !== 'P2002') {
      return;
    }

    const rawTarget = prismaError.meta?.target;
    const target = Array.isArray(rawTarget)
      ? rawTarget.map((value) => String(value))
      : typeof rawTarget === 'string'
        ? [rawTarget]
        : [];

    if (target.includes('ls_code')) {
      this.throwConflict('Duplicate loyalty scheme code is not allowed', [
        {
          field: 'ls_code',
          message: 'A loyalty scheme with this code already exists',
        },
      ]);
    }

    if (target.includes('lspt_ls_id') && target.includes('lspt_slno')) {
      this.throwConflict('Duplicate loyalty point sequence is not allowed', [
        {
          field: 'lspt_slno',
          message: 'A loyalty point already exists with this sequence for the scheme',
        },
      ]);
    }

    if (
      target.includes('gift_ls_id') &&
      target.includes('gift_item_id') &&
      target.includes('gift_unit_id') &&
      target.includes('gift_points')
    ) {
      this.throwConflict('Duplicate loyalty gift rule is not allowed', [
        {
          field: 'gift_points',
          message:
            'A loyalty gift rule already exists with the same scheme, item, unit, and points',
        },
      ]);
    }
  }
}
