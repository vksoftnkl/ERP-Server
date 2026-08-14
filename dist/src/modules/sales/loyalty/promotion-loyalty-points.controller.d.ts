import { DeleteLoyaltyGiftQueryDto } from './dto/delete-loyalty-gift-query.dto';
import { DeleteLoyaltyPointQueryDto } from './dto/delete-loyalty-point-query.dto';
import { DeleteLoyaltySchemeQueryDto } from './dto/delete-loyalty-scheme-query.dto';
import { LoyaltyGiftIdQueryDto } from './dto/loyalty-gift-id-query.dto';
import { LoyaltyPointIdQueryDto } from './dto/loyalty-point-id-query.dto';
import { LoyaltySchemeIdQueryDto } from './dto/loyalty-scheme-id-query.dto';
import { SaveLoyaltyGiftDto } from './dto/save-loyalty-gift.dto';
import { SaveLoyaltyPointDto } from './dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';
import { LoyaltyGiftDeleteResult, LoyaltyGiftPayload, LoyaltyPointDeleteResult, LoyaltyPointPayload, LoyaltySchemeDeleteResult, LoyaltySchemePayload, PromotionLoyaltyPointsSuccessResponse } from './types/promotion-loyalty-points-api.types';
export declare class PromotionLoyaltyPointsController {
    private readonly promotionLoyaltyPointsService;
    constructor(promotionLoyaltyPointsService: PromotionLoyaltyPointsService);
    saveScheme(saveLoyaltySchemeDto: SaveLoyaltySchemeDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload>>;
    getSchemeById(queryDto: LoyaltySchemeIdQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload>>;
    deleteScheme(queryDto: DeleteLoyaltySchemeQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemeDeleteResult>>;
    savePoint(saveLoyaltyPointDto: SaveLoyaltyPointDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyPointPayload>>;
    getPointById(queryDto: LoyaltyPointIdQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyPointPayload>>;
    deletePoint(queryDto: DeleteLoyaltyPointQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyPointDeleteResult>>;
    saveGift(saveLoyaltyGiftDto: SaveLoyaltyGiftDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyGiftPayload>>;
    getGiftById(queryDto: LoyaltyGiftIdQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyGiftPayload>>;
    deleteGift(queryDto: DeleteLoyaltyGiftQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltyGiftDeleteResult>>;
}
