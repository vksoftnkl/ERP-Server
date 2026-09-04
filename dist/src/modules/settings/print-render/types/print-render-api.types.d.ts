import { OutputMode } from '../definition/template-definition.schema';
export type { SettingsErrorDetail as PrintRenderErrorDetail } from "../../../../common/types/module-api.types";
export type { SettingsErrorResponse as PrintRenderErrorResponse } from "../../../../common/types/module-api.types";
export type { SettingsSuccessResponse as PrintRenderSuccessResponse } from "../../../../common/types/module-api.types";
export interface RenderContext {
    readonly companyId: string;
    readonly branchId: string | null;
    readonly accYear: string | null;
    readonly docId: string | null;
    readonly userId: string | null;
    readonly deviceId: string | null;
}
export interface ResolvedDataset {
    readonly name: string;
    readonly datasetNo: number;
    readonly role: 'MASTER' | 'DETAIL';
    readonly sourceKind: 'PROVIDER' | 'SQL';
    readonly value: unknown;
    readonly rowCount: number;
    readonly durationMs: number;
    readonly truncated: boolean;
}
export interface RenderWarning {
    readonly kind: string;
    readonly message: string;
}
export interface RenderOutcome {
    readonly bytes: Buffer;
    readonly contentType: string;
    readonly extension: string;
    readonly outputMode: OutputMode;
    readonly pageCount: number;
    readonly pagesPerCopy: readonly number[];
    readonly copies: number;
    readonly copyLabels: readonly string[];
    readonly templateId: string;
    readonly templateName: string | null;
    readonly versionId: string;
    readonly revNo: number;
    readonly status: string;
    readonly engine: string;
    readonly paperCode: string;
    readonly layoutMs: number;
    readonly renderMs: number;
    readonly detailRows: number;
    readonly datasets: readonly ResolvedDataset[];
    readonly warnings: readonly RenderWarning[];
}
export interface RenderInspection extends Omit<RenderOutcome, 'bytes' | 'datasets'> {
    readonly datasets: readonly Omit<ResolvedDataset, 'value'>[];
    readonly byteCount: number;
    readonly printLogIds?: readonly string[];
}
