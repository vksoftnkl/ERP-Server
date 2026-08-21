import { DeletePromotionChildQueryDto, DeletePromotionSchemeQueryDto, PromotionSchemeIdQueryDto } from './dto/promotion-scheme-id-query.dto';
import { SavePromotionSchemeBranchesDto } from './dto/save-promotion-scheme-branch.dto';
import { SavePromotionSchemeItemsDto } from './dto/save-promotion-scheme-item.dto';
import { SavePromotionSchemePartiesDto } from './dto/save-promotion-scheme-party.dto';
import { SavePromotionSchemeSlabsDto } from './dto/save-promotion-scheme-slab.dto';
import { SavePromotionSchemeDto } from './dto/save-promotion-scheme.dto';
import { PromotionSchemeService } from './promotion-scheme.service';
import { PromotionSchemeBranchPayload, PromotionSchemeChildDeleteResult, PromotionSchemeDeleteResult, PromotionSchemeItemPayload, PromotionSchemePartyPayload, PromotionSchemePayload, PromotionSchemeSlabPayload, PromotionSchemeSuccessResponse } from './types/promotion-scheme-api.types';
export declare class PromotionSchemeController {
    private readonly promotionSchemeService;
    constructor(promotionSchemeService: PromotionSchemeService);
    saveScheme(dto: SavePromotionSchemeDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemePayload>>;
    getScheme(query: PromotionSchemeIdQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemePayload>>;
    deleteScheme(query: DeletePromotionSchemeQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeDeleteResult>>;
    saveBranches(dto: SavePromotionSchemeBranchesDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeBranchPayload[]>>;
    getBranches(query: PromotionSchemeIdQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeBranchPayload[]>>;
    deleteBranch(query: DeletePromotionChildQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeChildDeleteResult>>;
    saveParties(dto: SavePromotionSchemePartiesDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemePartyPayload[]>>;
    getParties(query: PromotionSchemeIdQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemePartyPayload[]>>;
    deleteParty(query: DeletePromotionChildQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeChildDeleteResult>>;
    saveItems(dto: SavePromotionSchemeItemsDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeItemPayload[]>>;
    getItems(query: PromotionSchemeIdQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeItemPayload[]>>;
    deleteItem(query: DeletePromotionChildQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeChildDeleteResult>>;
    saveSlabs(dto: SavePromotionSchemeSlabsDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeSlabPayload[]>>;
    getSlabs(query: PromotionSchemeIdQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeSlabPayload[]>>;
    deleteSlab(query: DeletePromotionChildQueryDto): Promise<PromotionSchemeSuccessResponse<PromotionSchemeChildDeleteResult>>;
}
