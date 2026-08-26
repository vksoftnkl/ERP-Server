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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportDatasetSqlValidator = exports.DYNAMIC_TOKEN_PREFIX = void 0;
const common_1 = require("@nestjs/common");
const configured_grid_sql_service_1 = require("../../../../common/configured-grid-sql/configured-grid-sql.service");
const report_dataset_types_1 = require("./report-dataset.types");
exports.DYNAMIC_TOKEN_PREFIX = 'custom.';
const TOKEN_PATTERN = /^custom\.[a-z0-9]+(?:[._-][a-z0-9]+)*$/;
const PARAM_TOKEN_PATTERN = /'?\b(p_[a-z0-9]+(?:_[a-z0-9]+)*)\b'?/gi;
let ReportDatasetSqlValidator = class ReportDatasetSqlValidator {
    configuredGridSql;
    constructor(configuredGridSql) {
        this.configuredGridSql = configuredGridSql;
    }
    assertValidToken(token) {
        if (!TOKEN_PATTERN.test(token)) {
            throw new common_1.BadRequestException(`Dataset token '${token}' is invalid. Runtime datasets must be namespaced ` +
                `'${exports.DYNAMIC_TOKEN_PREFIX}<name>' in lowercase, e.g. 'custom.sales.daybook'. ` +
                'The prefix is what guarantees a runtime dataset can never shadow a compiled provider.');
        }
    }
    assertValidParamSpecs(params) {
        const seen = new Set();
        for (const param of params) {
            if (!report_dataset_types_1.DATASET_PARAM_NAME_PATTERN.test(param.name)) {
                throw new common_1.BadRequestException(`Parameter '${param.name}' is invalid. Names must be lowercase snake_case ` +
                    "beginning 'p_', e.g. 'p_party_id'.");
            }
            if ((0, report_dataset_types_1.isReservedDatasetParam)(param.name)) {
                throw new common_1.BadRequestException(`Parameter '${param.name}' is reserved and bound from the request context ` +
                    'automatically. Remove it from the declared parameters — declaring it would ' +
                    'let a caller supply the value, which is exactly what must not be possible.');
            }
            if (seen.has(param.name)) {
                throw new common_1.BadRequestException(`Parameter '${param.name}' is declared more than once`);
            }
            seen.add(param.name);
        }
    }
    validate(options) {
        const shape = this.configuredGridSql.validateBaseSql({ sql: options.sql });
        if (!shape.isValid) {
            throw new common_1.BadRequestException(shape.message);
        }
        const normalizedSql = shape.normalizedSql;
        const tokensInSql = this.extractParamTokens(normalizedSql);
        if (!tokensInSql.has(report_dataset_types_1.MANDATORY_SCOPE_PARAM)) {
            throw new common_1.BadRequestException(`Dataset SQL must reference the ${report_dataset_types_1.MANDATORY_SCOPE_PARAM} token — it is what scopes ` +
                'the query to the printing company. Add it to the WHERE clause, e.g. ' +
                '`WHERE sb_company_id = p_company_id`.');
        }
        const declaredNames = new Set(options.params.map((param) => param.name));
        const reservedParamsUsed = [];
        const declaredParamsUsed = [];
        const undeclared = [];
        for (const token of tokensInSql) {
            if ((0, report_dataset_types_1.isReservedDatasetParam)(token)) {
                reservedParamsUsed.push(token);
            }
            else if (declaredNames.has(token)) {
                declaredParamsUsed.push(token);
            }
            else {
                undeclared.push(token);
            }
        }
        if (undeclared.length > 0) {
            throw new common_1.BadRequestException(`Undeclared parameter token(s) in dataset SQL: ${undeclared.sort().join(', ')}. ` +
                `Declare them, or correct the spelling. Reserved tokens are: ` +
                `${Object.keys(report_dataset_types_1.RESERVED_DATASET_PARAMS).join(', ')}.`);
        }
        const unused = [...declaredNames].filter((name) => !tokensInSql.has(name));
        if (unused.length > 0) {
            throw new common_1.BadRequestException(`Declared parameter(s) never used in the SQL: ${unused.sort().join(', ')}. ` +
                'A parameter that appears nowhere binds nothing — this is usually a spelling ' +
                'mismatch with the token in the query.');
        }
        return {
            normalizedSql,
            reservedParamsUsed: reservedParamsUsed.sort(),
            declaredParamsUsed: declaredParamsUsed.sort(),
        };
    }
    extractParamTokens(sql) {
        const tokens = new Set();
        const pattern = new RegExp(PARAM_TOKEN_PATTERN.source, PARAM_TOKEN_PATTERN.flags);
        let match = pattern.exec(sql);
        while (match !== null) {
            tokens.add(match[1].toLowerCase());
            match = pattern.exec(sql);
        }
        return tokens;
    }
};
exports.ReportDatasetSqlValidator = ReportDatasetSqlValidator;
exports.ReportDatasetSqlValidator = ReportDatasetSqlValidator = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [configured_grid_sql_service_1.ConfiguredGridSqlService])
], ReportDatasetSqlValidator);
//# sourceMappingURL=report-dataset-sql.validator.js.map