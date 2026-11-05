"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfiguredGridSqlController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const cache_manager_1 = require("@nestjs/cache-manager");
const http_error_response_dto_1 = require("../dto/http-error-response.dto");
const configured_grid_columns_query_dto_1 = require("./dto/configured-grid-columns-query.dto");
const configured_grid_columns_response_dto_1 = require("./dto/configured-grid-columns-response.dto");
const run_configured_grid_query_dto_1 = require("./dto/run-configured-grid-query.dto");
const configured_grid_run_response_dto_1 = require("./dto/configured-grid-run-response.dto");
const configured_grid_sql_service_1 = require("./configured-grid-sql.service");
const configured_sql_cache_interceptor_1 = require("./utils/configured-sql-cache-interceptor");
const api_version_1 = require("../constants/api-version");
const module_shared_utils_1 = require("../utils/module-shared.utils");
const grid_run_error_codes_1 = require("./types/grid-run-error-codes");
let ConfiguredGridSqlController = class ConfiguredGridSqlController {
    configuredGridSqlService;
    constructor(configuredGridSqlService) {
        this.configuredGridSqlService = configuredGridSqlService;
    }
    async columns(query) {
        const data = await this.configuredGridSqlService.loadGridColumns(BigInt(query.grid_id));
        return {
            success: true,
            message: 'Grid columns fetched successfully',
            data,
        };
    }
    async run(query) {
        const gridId = BigInt(query.grid_id);
        const page = query.page ?? 1;
        const limit = query.limit ?? 20;
        const skip = (page - 1) * limit;
        let gridPrm;
        const rawGridParam = query.grid_param?.trim();
        if (rawGridParam) {
            let parsed;
            try {
                parsed = JSON.parse(rawGridParam);
            }
            catch {
                throwGridRunInvalid('grid_param must be valid JSON', 'grid_param', grid_run_error_codes_1.GridRunErrorCode.PARAM_NOT_JSON);
            }
            if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
                throwGridRunInvalid('grid_param must be a JSON object', 'grid_param', grid_run_error_codes_1.GridRunErrorCode.PARAM_NOT_OBJECT);
            }
            gridPrm = parsed;
            for (const [key, val] of Object.entries(gridPrm)) {
                if (!/^[a-z_][a-z0-9_]*$/i.test(key)) {
                    throwGridRunInvalid(`Invalid parameter name in grid_PRM: "${key}"`, 'grid_param', grid_run_error_codes_1.GridRunErrorCode.PARAM_NAME_INVALID);
                }
                if (val !== null &&
                    val !== undefined &&
                    typeof val !== 'boolean' &&
                    typeof val !== 'number' &&
                    typeof val !== 'string') {
                    throwGridRunInvalid(`Unsupported value type for grid_PRM.${key}: ${typeof val}`, 'grid_param', grid_run_error_codes_1.GridRunErrorCode.PARAM_VALUE_UNSUPPORTED);
                }
                if (typeof val === 'number' && !Number.isFinite(val)) {
                    throwGridRunInvalid(`Non-finite number for grid_PRM.${key}`, 'grid_param', grid_run_error_codes_1.GridRunErrorCode.PARAM_VALUE_NOT_FINITE);
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
            (0, module_shared_utils_1.throwNotFound)(`Grid with id ${query.grid_id} not found`, 'grid_id', `Grid with id ${query.grid_id} not found`, grid_run_error_codes_1.GridRunErrorCode.GRID_NOT_FOUND);
        }
        if (!candidate.gridSql) {
            throwGridRunInvalid(`Grid ${query.grid_id} has no configured SQL`, 'grid_id', grid_run_error_codes_1.GridRunErrorCode.SQL_MISSING);
        }
        const tableName = this.configuredGridSqlService.extractTopLevelFromTableName(candidate.gridSql) ?? '';
        const validation = this.configuredGridSqlService.validateBaseSql({
            sql: candidate.gridSql,
            tableName,
        });
        if (!validation.isValid) {
            throwGridRunInvalid(`Invalid grid SQL: ${validation.message}`, 'grid_id', grid_run_error_codes_1.GridRunErrorCode.SQL_INVALID);
        }
        let baseSql = validation.normalizedSql;
        let params = [];
        if (gridPrm) {
            const bound = this.configuredGridSqlService.bindGridParams(baseSql, gridPrm);
            baseSql = bound.sql;
            params = bound.params;
        }
        let result;
        try {
            result = await this.configuredGridSqlService.runPagedQuery({
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
        }
        catch (error) {
            const code = error?.code;
            if (typeof code === 'string' && (code.startsWith('42') || code.startsWith('22'))) {
                const unboundTokens = this.configuredGridSqlService.findUnboundParamTokens(baseSql);
                const hint = unboundTokens.length > 0
                    ? ` Pass a value for ${unboundTokens.join(', ')} in grid_param.`
                    : '';
                throwGridRunInvalid(`Grid ${query.grid_id} configured SQL failed: ${error.message}.${hint}`, unboundTokens.length > 0 ? 'grid_param' : 'grid_id', unboundTokens.length > 0 ? grid_run_error_codes_1.GridRunErrorCode.PARAM_MISSING : grid_run_error_codes_1.GridRunErrorCode.SQL_FAILED);
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
};
exports.ConfiguredGridSqlController = ConfiguredGridSqlController;
__decorate([
    (0, common_1.Get)('columns'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(1),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch grid columns by grid id' }),
    (0, swagger_1.ApiOkResponse)({ type: configured_grid_columns_response_dto_1.ConfiguredGridColumnsResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [configured_grid_columns_query_dto_1.ConfiguredGridColumnsQueryDto]),
    __metadata("design:returntype", Promise)
], ConfiguredGridSqlController.prototype, "columns", null);
__decorate([
    (0, common_1.Get)('run'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, cache_manager_1.CacheTTL)(1),
    (0, swagger_1.ApiOperation)({ summary: 'Run the base SQL for a grid and return rows + column styles' }),
    (0, swagger_1.ApiOkResponse)({ type: configured_grid_run_response_dto_1.ConfiguredGridRunResponseDto }),
    (0, swagger_1.ApiBadRequestResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, swagger_1.ApiNotFoundResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [run_configured_grid_query_dto_1.RunConfiguredGridQueryDto]),
    __metadata("design:returntype", Promise)
], ConfiguredGridSqlController.prototype, "run", null);
exports.ConfiguredGridSqlController = ConfiguredGridSqlController = __decorate([
    (0, common_1.UseInterceptors)(configured_sql_cache_interceptor_1.ConfiguredGridCacheInterceptor),
    (0, swagger_1.ApiTags)('Configured Grid SQL'),
    (0, swagger_1.ApiBearerAuth)('access-token'),
    (0, swagger_1.ApiUnauthorizedResponse)({ type: http_error_response_dto_1.HttpErrorResponseDto }),
    (0, common_1.Controller)('configured-grid-sql'),
    __metadata("design:paramtypes", [configured_grid_sql_service_1.ConfiguredGridSqlService])
], ConfiguredGridSqlController);
function throwGridRunInvalid(message, field, code) {
    (0, module_shared_utils_1.throwBadRequest)(message, [{ field, message, code }]);
}
//# sourceMappingURL=configured-grid-sql.controller.js.map