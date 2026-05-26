import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Query,
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
import { HttpErrorResponseDto } from '../dto/http-error-response.dto';
import { RunConfiguredGridQueryDto } from './dto/run-configured-grid-query.dto';
import { ConfiguredGridRunResponseDto } from './dto/configured-grid-run-response.dto';
import { ConfiguredGridSqlService } from './configured-grid-sql.service';

@ApiTags('Configured Grid SQL')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('configured-grid-sql')
export class ConfiguredGridSqlController {
  constructor(private readonly configuredGridSqlService: ConfiguredGridSqlService) {}

  @Get('run')
  @Version('1')
  @ApiOperation({ summary: 'Run the base SQL for a grid and return rows + column styles' })
  @ApiOkResponse({ type: ConfiguredGridRunResponseDto })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async run(@Query() query: RunConfiguredGridQueryDto): Promise<ConfiguredGridRunResponseDto> {
    const gridId = BigInt(query.grid_id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

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

    const result = await this.configuredGridSqlService.runPagedQuery<Record<string, unknown>>({
      baseSql: validation.normalizedSql,
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
         styles: result.styles,
      },
    };
  }
}
