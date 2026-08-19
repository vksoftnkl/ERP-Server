import type { ModuleApiErrorDetail, ModuleApiErrorResponse, ModuleApiSuccessResponse } from "../../../../common/types/module-api.types";
export type ConfigsErrorDetail = ModuleApiErrorDetail;
export type ConfigsErrorResponse = ModuleApiErrorResponse<ConfigsErrorDetail>;
export type ConfigsSuccessResponse<T, TMeta = Record<string, unknown>, TStyles = unknown> = ModuleApiSuccessResponse<T, TMeta, TStyles>;
export interface ConfigsPayload {
    configId: number;
    configName: string | null;
    configValue: string | null;
    configSyncDate: string | null;
    configCreatedOn: string | null;
    configCreatedBy: string | null;
    configModifiedOn: string | null;
    configModifiedBy: string | null;
}
