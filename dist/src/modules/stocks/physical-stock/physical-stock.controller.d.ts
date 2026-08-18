import { Response } from 'express';
import { PhysicalStockService } from './physical-stock.service';
import { CreatePhysicalStockDto } from './dto/create-physical-stock.dto';
import { PhysicalStockDeleteResponse, PhysicalStockDocumentResponse, PhysicalStockListItem, PhysicalStockListMeta, PhysicalStockSuccessResponse } from './types/physical-stock-response.types';
import { ListPhysicalStockQueryDto } from './dto/list-physical-stock-query.dto';
export declare class PhysicalStockController {
    private readonly physicalStockService;
    constructor(physicalStockService: PhysicalStockService);
    save(createPhysicalStockDto: CreatePhysicalStockDto, response: Response): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>>;
    listOrGet(queryDto: ListPhysicalStockQueryDto): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse | PhysicalStockListItem[], PhysicalStockListMeta>>;
    getById(queryDto: ListPhysicalStockQueryDto): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>>;
    getList(queryDto: ListPhysicalStockQueryDto): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse | PhysicalStockListItem[], PhysicalStockListMeta>>;
    findOne(id: string): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>>;
    removeByQueryRoot(queryDto: ListPhysicalStockQueryDto): Promise<PhysicalStockSuccessResponse<PhysicalStockDeleteResponse>>;
    removeByQuery(queryDto: ListPhysicalStockQueryDto): Promise<PhysicalStockSuccessResponse<PhysicalStockDeleteResponse>>;
    remove(id: string): Promise<PhysicalStockSuccessResponse<PhysicalStockDeleteResponse>>;
    private resolveDocumentQuery;
}
