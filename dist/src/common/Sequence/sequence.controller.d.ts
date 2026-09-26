import { ListSequenceQueryDto } from './dto/list-sequence-query.dto';
import { SaveSequenceDto } from './dto/save-sequence.dto';
import { SequenceService } from './sequence.service';
import { SequenceListItem, SequenceListMeta, SequencePayload, SequenceSuccessResponse } from './types/sequence-api.types';
export declare class SequenceController {
    private readonly sequenceService;
    constructor(sequenceService: SequenceService);
    save(saveSequenceDto: SaveSequenceDto): Promise<SequenceSuccessResponse<SequencePayload>>;
    list(queryDto: ListSequenceQueryDto): Promise<SequenceSuccessResponse<SequenceListItem[], SequenceListMeta>>;
    getById(id: string): Promise<SequenceSuccessResponse<SequencePayload>>;
    remove(id: string): Promise<SequenceSuccessResponse<{
        id: string;
        deleted: true;
    }>>;
}
