import { Controller, Get, Query, UseInterceptors, Version } from '@nestjs/common';
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
import { throwBadRequest, throwNotFound } from '../utils/module-shared.utils';
import { GridRunErrorCode, type GridRunErrorDetail } from './types/grid-run-error-codes';
@UseInterceptors(ConfiguredGridCacheInterceptor)
@ApiTags('Configured Grid SQL')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('configured-grid-sql')
export class ConfiguredGridSqlController {
  constructor(private readonly configuredGridSqlService: ConfiguredGridSqlService) {}
  @Get('columns')
  @Version(API_VERSION)
  @CacheTTL(1) // columns are stable → cache 5 minutes
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
  @CacheTTL(1) // rows incl. search/filter/pagination → cache 60s
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
    // Workflow B: a missing, empty, or whitespace grid_param means "no parameters" — run the base
    // SQL as-is. Only attempt to parse when there is actual content (Workflow A).
    const rawGridParam = query.grid_param?.trim();
    if (rawGridParam) {
      let parsed: unknown;
      try {
        parsed = JSON.parse(rawGridParam);
      } catch {
        throwGridRunInvalid('grid_param must be valid JSON', 'grid_param', GridRunErrorCode.PARAM_NOT_JSON);
      }
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        throwGridRunInvalid(
          'grid_param must be a JSON object',
          'grid_param',
          GridRunErrorCode.PARAM_NOT_OBJECT,
        );
      }
      gridPrm = parsed as Record<string, unknown>;
      for (const [key, val] of Object.entries(gridPrm)) {
        if (!/^[a-z_][a-z0-9_]*$/i.test(key)) {
          throwGridRunInvalid(
            `Invalid parameter name in grid_PRM: "${key}"`,
            'grid_param',
            GridRunErrorCode.PARAM_NAME_INVALID,
          );
        }
        if (
          val !== null &&
          val !== undefined &&
          typeof val !== 'boolean' &&
          typeof val !== 'number' &&
          typeof val !== 'string'
        ) {
          throwGridRunInvalid(
            `Unsupported value type for grid_PRM.${key}: ${typeof val}`,
            'grid_param',
            GridRunErrorCode.PARAM_VALUE_UNSUPPORTED,
          );
        }
        if (typeof val === 'number' && !Number.isFinite(val)) {
          throwGridRunInvalid(
            `Non-finite number for grid_PRM.${key}`,
            'grid_param',
            GridRunErrorCode.PARAM_VALUE_NOT_FINITE,
          );
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
      throwNotFound<GridRunErrorDetail>(
        `Grid with id ${query.grid_id} not found`,
        'grid_id',
        `Grid with id ${query.grid_id} not found`,
        GridRunErrorCode.GRID_NOT_FOUND,
      );
    }
    if (!candidate.gridSql) {
      throwGridRunInvalid(
        `Grid ${query.grid_id} has no configured SQL`,
        'grid_id',
        GridRunErrorCode.SQL_MISSING,
      );
    }
    const tableName =
      this.configuredGridSqlService.extractTopLevelFromTableName(candidate.gridSql) ?? '';
    const validation = this.configuredGridSqlService.validateBaseSql({
      sql: candidate.gridSql,
      tableName,
    });
    if (!validation.isValid) {
      throwGridRunInvalid(
        `Invalid grid SQL: ${validation.message}`,
        'grid_id',
        GridRunErrorCode.SQL_INVALID,
      );
    }
    let baseSql = validation.normalizedSql;
    let params: unknown[] = [];
    if (gridPrm) {
      // Bind grid_param values into the named placeholder tokens embedded in the stored SQL
      // (e.g. p_comp_id, p_branch_id) as positional parameters ($N). Values are passed to Postgres
      // as bound params — never string-concatenated into the SQL.
      const bound = this.configuredGridSqlService.bindGridParams(baseSql, gridPrm);
      baseSql = bound.sql;
      params = bound.params;
    }
    let result: { items: Record<string, unknown>[]; total: number };
    try {
      result = await this.configuredGridSqlService.runPagedQuery<Record<string, unknown>>({
        baseSql,
        params,
        alias: 'cgrid',
        search: query.search,
        limit,
        skip,
        gridId,
        sortBy: query.sort_by,
        sortDir: query.sort_dir,
      });
    } catch (error) {
      // Stored grid SQL is only validated syntactically at save time (see
      // GridDetailsService.normalizeGridSql — no LIMIT 0 probe), so schema drift
      // (e.g. a column typed into the grid designer that doesn't exist) surfaces
      // here. Two SQLSTATE classes mean "this grid/request is misconfigured",
      // not "the server broke", so both are reported instead of an opaque 500:
      //   42 — syntax/access-rule violation (undefined column, undefined table, …)
      //   22 — data exception, which is what an unbound parameter token becomes:
      //        a grid whose SQL says `sq_company_id = 'icompany_id'::uuid` and a
      //        request that sent no `grid_param` for it leave the token in place
      //        as a literal, and Postgres answers `invalid input syntax for type
      //        uuid: "icompany_id"`.
      const code = (error as { code?: string } | null)?.code;
      if (typeof code === 'string' && (code.startsWith('42') || code.startsWith('22'))) {
        const unboundTokens = this.configuredGridSqlService.findUnboundParamTokens(baseSql);
        const hint =
          unboundTokens.length > 0
            ? ` Pass a value for ${unboundTokens.join(', ')} in grid_param.`
            : '';
        // Notes 119: a token left unbound is the request's omission (PARAM_MISSING);
        // anything else is the stored SQL itself (SQL_FAILED).
        throwGridRunInvalid(
          `Grid ${query.grid_id} configured SQL failed: ${(error as Error).message}.${hint}`,
          unboundTokens.length > 0 ? 'grid_param' : 'grid_id',
          unboundTokens.length > 0 ? GridRunErrorCode.PARAM_MISSING : GridRunErrorCode.SQL_FAILED,
        );
      }
      throw error;
    }
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

/** Notes 119: a /run refusal — the same 400 and message as before, with its code. */
function throwGridRunInvalid(message: string, field: string, code: GridRunErrorCode): never {
  throwBadRequest<GridRunErrorDetail>(message, [{ field, message, code }]);
}
