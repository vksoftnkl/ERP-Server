import { ConfiguredGridColumnsQueryDto } from './dto/configured-grid-columns-query.dto';
import { ConfiguredGridColumnsResponseDto } from './dto/configured-grid-columns-response.dto';
import { RunConfiguredGridQueryDto } from './dto/run-configured-grid-query.dto';
import { ConfiguredGridRunResponseDto } from './dto/configured-grid-run-response.dto';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';
export declare class ConfiguredGridSqlController {
    private readonly configuredGridSqlService;
    constructor(configuredGridSqlService: ConfiguredGridSqlService);
    columns(query: ConfiguredGridColumnsQueryDto): Promise<ConfiguredGridColumnsResponseDto>;
    run(query: RunConfiguredGridQueryDto): Promise<ConfiguredGridRunResponseDto>;
}
