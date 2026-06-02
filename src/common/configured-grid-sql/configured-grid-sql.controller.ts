import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CacheTTL } from '@nestjs/cache-manager';
import { HttpErrorResponseDto } from '../dto/http-error-response.dto';
import { ConfiguredGridColumnsQueryDto } from './dto/configured-grid-columns-query.dto';
import { ConfiguredGridColumnsResponseDto } from './dto/configured-grid-columns-response.dto';
import { RunConfiguredGridQueryDto } from './dto/run-configured-grid-query.dto';
import { ConfiguredGridRunResponseDto } from './dto/configured-grid-run-response.dto';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';
import { ConfiguredGridCacheInterceptor } from './utils/configured-sql-cache-interceptor';
import { API_VERSION } from '../constants/api-version';

@UseInterceptors(ConfiguredGridCacheInterceptor)
@ApiTags('Configured Grid SQL')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('configured-grid-sql')
export class ConfiguredGridSqlController {
  constructor(private readonly configuredGridSqlService: ConfiguredGridSqlService) {}

  @Get('columns')
  @Version(API_VERSION)
  @CacheTTL(300) // columns are stable → cache 5 minutes
  @ApiOperation({ summary: 'Fetch grid columns by grid id' })
  @ApiOkResponse({ type: ConfiguredGridColumnsResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  async columns(
    @Query() query: ConfiguredGridColumnsQueryDto,
  ): Promise<ConfiguredGridColumnsResponseDto> {
    const data = await this.configuredGridSqlService.loadGridColumns(BigInt(query.grid_id));

    return {
      success: true,
      message: 'Grid columns fetched successfully',
      data,
    };
  }

  @Get('run')
  @Version(API_VERSION)
  @CacheTTL(60) // rows incl. search/filter/pagination → cache 60s
  @ApiOperation({ summary: 'Run the base SQL for a grid and return rows + column styles' })
  @ApiOkResponse({ type: ConfiguredGridRunResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async run(@Query() query: RunConfiguredGridQueryDto): Promise<ConfiguredGridRunResponseDto> {
    const gridId = BigInt(query.grid_id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    let gridPrm: Record<string, unknown> | undefined;
    if (query.grid_param !== undefined) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(query.grid_param);
      } catch {
        throw new BadRequestException('grid_param must be valid JSON');
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throw new BadRequestException('grid_param must be a JSON object');
      }
      gridPrm = parsed as Record<string, unknown>;

      for (const [key, val] of Object.entries(gridPrm)) {
        if (!/^[a-z_][a-z0-9_]*$/i.test(key)) {
          throw new BadRequestException(`Invalid parameter name in grid_PRM: "${key}"`);
        }
        if (
          val !== null &&
          val !== undefined &&
          typeof val !== 'boolean' &&
          typeof val !== 'number' &&
          typeof val !== 'string'
        ) {
          throw new BadRequestException(
            `Unsupported value type for grid_PRM.${key}: ${typeof val}`,
          );
        }
        if (typeof val === 'number' && !Number.isFinite(val)) {
          throw new BadRequestException(`Non-finite number for grid_PRM.${key}`);
        }
      }
    }

    const candidates = await this.configuredGridSqlService.loadCandidates({
      tableName: '',
      fixedGridId: gridId,
      applyTableNameFilter: false,
    });

    const candidate = candidates[0];
    if (!candidate) {
      throw new NotFoundException(`Grid with id ${query.grid_id} not found`);
    }

    if (!candidate.gridSql) {
      throw new BadRequestException(`Grid ${query.grid_id} has no configured SQL`);
    }

    const tableName =
      this.configuredGridSqlService.extractTopLevelFromTableName(candidate.gridSql) ?? '';

    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: candidate.gridSql,
      tableName,
    });

    if (!validation.isValid) {
      throw new BadRequestException(`Invalid grid SQL: ${validation.message}`);
    }

    const finalSql = gridPrm
      ? this.configuredGridSqlService.substituteGridPrm(validation.normalizedSql, gridPrm)
      : validation.normalizedSql;

    const result = await this.configuredGridSqlService.runPagedQuery<Record<string, unknown>>({
      baseSql: finalSql,
      alias: 'cgrid',
      search: query.search,
      limit,
      skip,
      gridId,
    });

    return {
      success: true,
      message: 'Grid data fetched successfully',
      data: {
        items: result.items,
        meta: { page, limit, total: result.total },
      },
    };
  }
}