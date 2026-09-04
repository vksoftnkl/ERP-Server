import { Response } from 'express';
import { DeleteGodownQueryDto } from './dto/delete-godown-query.dto';
import { SaveGodownDto } from './dto/save-godown.dto';
import { GodownsMasterService } from './godowns-master.service';
import { GodownPayload, GodownSuccessResponse } from './types/godown-api.types';
export declare class GodownsMasterController {
    private readonly godownsMasterService;
    constructor(godownsMasterService: GodownsMasterService);
    save(saveGodownDto: SaveGodownDto, response: Response): Promise<GodownSuccessResponse<GodownPayload>>;
    getByQuery(queryDto: DeleteGodownQueryDto): Promise<GodownSuccessResponse<GodownPayload>>;
    listOrGet(queryDto: DeleteGodownQueryDto): Promise<GodownSuccessResponse<GodownPayload>>;
    remove(queryDto: DeleteGodownQueryDto): Promise<GodownSuccessResponse<{
        gdl_id: string;
        deleted: boolean;
    }>>;
}
