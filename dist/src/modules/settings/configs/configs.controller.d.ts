import { SaveConfigsDto } from './dto/save-configs.dto';
import { ConfigsService } from './configs.service';
import { ConfigsPayload, ConfigsSuccessResponse } from './types/configs-api.types';
export declare class ConfigsController {
    private readonly configsService;
    constructor(configsService: ConfigsService);
    save(saveConfigsDto: SaveConfigsDto): Promise<ConfigsSuccessResponse<ConfigsPayload>>;
    getById(configId: number): Promise<ConfigsSuccessResponse<ConfigsPayload>>;
}
