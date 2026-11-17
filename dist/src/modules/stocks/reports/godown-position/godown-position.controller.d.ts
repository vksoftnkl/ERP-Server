import { GodownPositionService } from './godown-position.service';
import { GodownPositionBehindDto, GodownPositionExportDto, GodownPositionQueryDto } from './dto/godown-position-query.dto';
import type { BehindPayload, PositionExportPayload, PositionPayload } from './types/godown-position.types';
interface Ok<T> {
    success: true;
    message: string;
    data: T;
}
export declare class GodownPositionController {
    private readonly service;
    constructor(service: GodownPositionService);
    show(q: GodownPositionQueryDto): Promise<Ok<PositionPayload>>;
    behind(q: GodownPositionBehindDto): Promise<Ok<BehindPayload>>;
    export(q: GodownPositionExportDto): Promise<Ok<PositionExportPayload>>;
}
export {};
