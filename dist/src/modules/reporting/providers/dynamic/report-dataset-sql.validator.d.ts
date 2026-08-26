import { ConfiguredGridSqlService } from '../../../../common/configured-grid-sql/configured-grid-sql.service';
import { ReportDatasetParamSpec } from './report-dataset.types';
export declare const DYNAMIC_TOKEN_PREFIX = "custom.";
export interface ValidateDatasetSqlOptions {
    readonly sql: string;
    readonly params: readonly ReportDatasetParamSpec[];
}
export interface ValidatedDatasetSql {
    readonly normalizedSql: string;
    readonly reservedParamsUsed: string[];
    readonly declaredParamsUsed: string[];
}
export declare class ReportDatasetSqlValidator {
    private readonly configuredGridSql;
    constructor(configuredGridSql: ConfiguredGridSqlService);
    assertValidToken(token: string): void;
    assertValidParamSpecs(params: readonly ReportDatasetParamSpec[]): void;
    validate(options: ValidateDatasetSqlOptions): ValidatedDatasetSql;
    private extractParamTokens;
}
