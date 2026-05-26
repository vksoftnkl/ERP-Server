import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, Post, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { DeleteLoyaltyGiftQueryDto } from './dto/delete-loyalty-gift-query.dto';
import { DeleteLoyaltyPointQueryDto } from './dto/delete-loyalty-point-query.dto';
import { DeleteLoyaltySchemeQueryDto } from './dto/delete-loyalty-scheme-query.dto';
import { LoyaltyGiftIdQueryDto } from './dto/loyalty-gift-id-query.dto';
import { LoyaltyPointIdQueryDto } from './dto/loyalty-point-id-query.dto';
import { LoyaltySchemeIdQueryDto } from './dto/loyalty-scheme-id-query.dto';
import {
  LoyaltyGiftSuccessDeleteDto,
  LoyaltyGiftSuccessSingleDto,
  LoyaltyPointSuccessDeleteDto,
  LoyaltyPointSuccessSingleDto,
  LoyaltySchemeSuccessDeleteDto,
  LoyaltySchemeSuccessSingleDto,
  PromotionLoyaltyPointsErrorResponseDto,
} from './dto/promotion-loyalty-points-response.dto';
import { SaveLoyaltyGiftDto } from './dto/save-loyalty-gift.dto';
import { SaveLoyaltyPointDto } from './dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsExceptionFilter } from './promotion-loyalty-points-exception.filter';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';
import {
  LoyaltyGiftDeleteResult,
  LoyaltyGiftPayload,
  LoyaltyPointDeleteResult,
  LoyaltyPointPayload,
  LoyaltySchemeDeleteResult,
  LoyaltySchemePayload,
  PromotionLoyaltyPointsSuccessResponse,
} from './types/promotion-loyalty-points-api.types';

@ApiTags('Promotion Loyalty Points')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('promotion-loyalty-points')
@UseFilters(PromotionLoyaltyPointsExceptionFilter)
export class PromotionLoyaltyPointsController {
  constructor(private readonly promotionLoyaltyPointsService: PromotionLoyaltyPointsService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update loyalty scheme by ls_id presence' })
  @ApiCreatedResponse({ type: LoyaltySchemeSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiConflictResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async saveScheme(
    @Body() saveLoyaltySchemeDto: SaveLoyaltySchemeDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload>> {
    const data = await this.promotionLoyaltyPointsService.saveScheme(saveLoyaltySchemeDto);

    return {
      success: true,
      message: saveLoyaltySchemeDto.ls_id
        ? 'Loyalty scheme updated successfully'
        : 'Loyalty scheme created successfully',
      data,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({
    summary: 'Get a full loyalty scheme graph by ls_id in a single response',
  })
  @ApiOkResponse({
    type: LoyaltySchemeSuccessSingleDto,
    description: 'Returns the scheme header along with nested parties, points, and gifts.',
  })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async getSchemeById(
    @Query() queryDto: LoyaltySchemeIdQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload>> {
    const data = await this.promotionLoyaltyPointsService.getSchemeById(queryDto.ls_id);

    return {
      success: true,
      message: 'Loyalty scheme fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete loyalty scheme by ls_id' })
  @ApiOkResponse({ type: LoyaltySchemeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async deleteScheme(
    @Query() queryDto: DeleteLoyaltySchemeQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemeDeleteResult>> {
    const data = await this.promotionLoyaltyPointsService.softDeleteScheme(
      queryDto.ls_id,
      queryDto.ls_updated_by,
    );

    return {
      success: true,
      message: 'Loyalty scheme deleted successfully',
      data,
    };
  }

  @Post('points/create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update loyalty point slab by lspt_id presence' })
  @ApiCreatedResponse({ type: LoyaltyPointSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiConflictResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async savePoint(
    @Body() saveLoyaltyPointDto: SaveLoyaltyPointDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyPointPayload>> {
    const data = await this.promotionLoyaltyPointsService.savePoint(saveLoyaltyPointDto);

    return {
      success: true,
      message: saveLoyaltyPointDto.lspt_id
        ? 'Loyalty point updated successfully'
        : 'Loyalty point created successfully',
      data,
    };
  }

  @Get('points/get')
  @Version('1')
  @ApiOperation({
    summary: 'Compatibility endpoint for a single loyalty point slab',
    deprecated: true,
  })
  @ApiOkResponse({ type: LoyaltyPointSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async getPointById(
    @Query() queryDto: LoyaltyPointIdQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyPointPayload>> {
    const data = await this.promotionLoyaltyPointsService.getPointById(queryDto.lspt_id);

    return {
      success: true,
      message: 'Loyalty point fetched successfully',
      data,
    };
  }

  @Delete('points/delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete loyalty point slab by lspt_id' })
  @ApiOkResponse({ type: LoyaltyPointSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async deletePoint(
    @Query() queryDto: DeleteLoyaltyPointQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyPointDeleteResult>> {
    const data = await this.promotionLoyaltyPointsService.softDeletePoint(
      queryDto.lspt_id,
      queryDto.lspt_updated_by,
    );

    return {
      success: true,
      message: 'Loyalty point deleted successfully',
      data,
    };
  }

  @Post('gifts/create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update loyalty gift rule by lsg_id presence' })
  @ApiCreatedResponse({ type: LoyaltyGiftSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiConflictResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async saveGift(
    @Body() saveLoyaltyGiftDto: SaveLoyaltyGiftDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyGiftPayload>> {
    const data = await this.promotionLoyaltyPointsService.saveGift(saveLoyaltyGiftDto);

    return {
      success: true,
      message: saveLoyaltyGiftDto.lsg_id
        ? 'Loyalty gift updated successfully'
        : 'Loyalty gift created successfully',
      data,
    };
  }

  @Get('gifts/get')
  @Version('1')
  @ApiOperation({
    summary: 'Compatibility endpoint for a single loyalty gift rule',
    deprecated: true,
  })
  @ApiOkResponse({ type: LoyaltyGiftSuccessSingleDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async getGiftById(
    @Query() queryDto: LoyaltyGiftIdQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyGiftPayload>> {
    const data = await this.promotionLoyaltyPointsService.getGiftById(queryDto.lsg_id);

    return {
      success: true,
      message: 'Loyalty gift fetched successfully',
      data,
    };
  }

  @Delete('gifts/delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete loyalty gift rule by lsg_id' })
  @ApiOkResponse({ type: LoyaltyGiftSuccessDeleteDto })
  @ApiBadRequestResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  @ApiNotFoundResponse({ type: PromotionLoyaltyPointsErrorResponseDto })
  async deleteGift(
    @Query() queryDto: DeleteLoyaltyGiftQueryDto,
  ): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyGiftDeleteResult>> {
    const data = await this.promotionLoyaltyPointsService.softDeleteGift(
      queryDto.lsg_id,
      queryDto.lsg_updated_by,
    );

    return {
      success: true,
      message: 'Loyalty gift deleted successfully',
      data,
    };
  }
}
