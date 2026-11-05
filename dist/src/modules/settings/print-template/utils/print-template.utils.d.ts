import { Prisma } from '@prisma/client';
import { PrintTemplateDatasetPayload, PrintTemplatePayload, PrintTemplateVersionPayload } from '../types/print-template-api.types';
export declare const DATASET_ORDER_BY: Prisma.PrintTemplateDatasetOrderByWithRelationInput[];
export declare const VERSION_INCLUDE: {
    datasets: {
        where: {
            ptdIsDeleted: false;
        };
        orderBy: Prisma.PrintTemplateDatasetOrderByWithRelationInput[];
    };
};
export declare const TEMPLATE_INCLUDE: {
    company: {
        select: {
            compName: true;
        };
    };
    purpose: {
        select: {
            ppoCode: true;
            ppoName: true;
        };
    };
    forkedFrom: {
        select: {
            ptlCode: true;
        };
    };
    publishedRev: {
        select: {
            ptvRevNo: true;
        };
    };
    versions: {
        where: {
            ptvIsDeleted: false;
        };
        orderBy: {
            ptvRevNo: "desc";
        };
        include: {
            datasets: {
                where: {
                    ptdIsDeleted: false;
                };
                orderBy: Prisma.PrintTemplateDatasetOrderByWithRelationInput[];
            };
        };
    };
};
export type TemplateWithChildren = Prisma.PrintTemplateGetPayload<{
    include: typeof TEMPLATE_INCLUDE;
}>;
export type VersionWithDatasets = Prisma.PrintTemplateVersionGetPayload<{
    include: typeof VERSION_INCLUDE;
}>;
export type DatasetRow = Prisma.PrintTemplateDatasetGetPayload<Record<string, never>>;
export type VersionRow = Prisma.PrintTemplateVersionGetPayload<Record<string, never>>;
export type TemplateRow = Prisma.PrintTemplateGetPayload<Record<string, never>>;
export declare function toDatasetPayload(row: DatasetRow): PrintTemplateDatasetPayload;
export declare function toVersionPayload(row: VersionRow & {
    datasets?: DatasetRow[];
}, publishedRevId: string | null): PrintTemplateVersionPayload;
export declare function toTemplatePayload(row: TemplateRow & Partial<Omit<TemplateWithChildren, keyof TemplateRow>>): PrintTemplatePayload;
export declare function handlePrintTemplateWriteError(error: unknown): void;
