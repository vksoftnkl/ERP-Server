import { PrintTemplateDataset, PrintTemplateVersion } from '@prisma/client';
import { ModuleErrorDetail } from "../../../../common/utils/module-service.utils";
import { RenderableEngine } from '../print-render.constants';
import { TemplateDefinition } from './template-definition.schema';
export interface DefinitionBuildResult {
    readonly definition: TemplateDefinition;
    readonly layoutMode: 'GRAPHIC' | 'GRID';
    readonly engine: RenderableEngine;
}
export declare class PrintRenderDefinitionError extends Error {
    readonly details: ModuleErrorDetail[];
    constructor(message: string, details: ModuleErrorDetail[]);
}
export declare function assertRenderableEngine(engine: string): RenderableEngine;
export declare function buildDefinition(version: PrintTemplateVersion, datasets: readonly PrintTemplateDataset[]): DefinitionBuildResult;
export declare function buildDefinitionFromBody(version: PrintTemplateVersion, datasets: readonly PrintTemplateDataset[], body: Record<string, unknown>): DefinitionBuildResult;
