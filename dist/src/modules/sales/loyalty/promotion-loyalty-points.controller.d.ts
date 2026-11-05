import { ListLoyaltySchemeQueryDto } from './dto/list-loyalty-scheme-query.dto';
import { DeleteLoyaltySchemeQueryDto, LoyaltySchemeEligibilityQueryDto, LoyaltySchemeIdQueryDto } from './dto/loyalty-scheme-id-query.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';
import { LoyaltySchemeDeleteResult, LoyaltySchemeEligibilityPayload, LoyaltySchemePayload, PromotionLoyaltyPointsSuccessResponse } from './types/promotion-loyalty-points-api.types';
export declare class PromotionLoyaltyPointsController {
    private readonly promotionLoyaltyPointsService;
    constructor(promotionLoyaltyPointsService: PromotionLoyaltyPointsService);
    saveScheme(dto: SaveLoyaltySchemeDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload>>;
    getScheme(query: LoyaltySchemeIdQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload>>;
    listSchemes(query: ListLoyaltySchemeQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemePayload[]>>;
    checkEligibility(query: LoyaltySchemeEligibilityQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemeEligibilityPayload>>;
    deleteScheme(query: DeleteLoyaltySchemeQueryDto): Promise<PromotionLoyaltyPointsSuccessResponse<LoyaltySchemeDeleteResult>>;
}
