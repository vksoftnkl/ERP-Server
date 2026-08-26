import { ListPromotionSchemeQueryDto } from './dto/list-promotion-scheme-query.dto';
import { DeletePromotionSchemeQueryDto, PromotionSchemeEligibilityQueryDto, PromotionSchemeIdQueryDto } from './dto/promotion-scheme-id-query.dto';
import { SavePromotionSchemeDto } from './dto/save-promotion-scheme.dto';
import { PromotionSchemeService } from './promotion-scheme.service';
import { PromotionSchemeDeleteResult, PromotionSchemeEligibilityPayload, PromotionSchemePayload, PromotionSchemeSuccessResponse } from './types/promotion-scheme-api.types';
export declare class PromotionSchemeController {
    private readonly promotionSchemeService;
    constructor(promotionSchemeService: PromotionSchemeService);
    saveScheme(dto: SavePromotionSchemeDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemePayload>>;
    getScheme(query: PromotionSchemeIdQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemePayload>>;
    listSchemes(query: ListPromotionSchemeQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemePayload[]>>;
    checkEligibility(query: PromotionSchemeEligibilityQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeEligibilityPayload>>;
    deleteScheme(query: DeletePromotionSchemeQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeDeleteResult>>;
}
