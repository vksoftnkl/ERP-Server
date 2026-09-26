import { PrintTemplateDataset } from '@prisma/client';
import { PgService } from "../../../../database/pg/pg.service";
import { ModuleErrorDetail } from "../../../../common/utils/module-service.utils";
import { RenderContext, ResolvedDataset } from '../types/print-render-api.types';
import { PrintDataProviderRegistry } from './print-data-provider.registry';
export interface DatasetRunRequest {
    readonly datasets: readonly PrintTemplateDataset[];
    readonly context: RenderContext;
    readonly params: Readonly<Record<string, unknown>>;
    readonly lang: string;
}
export interface DatasetRunResult {
    readonly data: Record<string, unknown>;
    readonly resolved: readonly ResolvedDataset[];
    readonly warnings: readonly {
        kind: string;
        message: string;
    }[];
}
export declare class DatasetRunError extends Error {
    readonly details: ModuleErrorDetail[];
    constructor(message: string, details: ModuleErrorDetail[]);
}
export declare class DatasetRunnerService {
    private readonly pg;
    private readonly providers;
    private readonly logger;
    constructor(pg: PgService, providers: PrintDataProviderRegistry);
    run(request: DatasetRunRequest): Promise<DatasetRunResult>;
    private runOne;
    private runSql;
    private runProvider;
    private bindableValues;
    private attachChildren;
}
