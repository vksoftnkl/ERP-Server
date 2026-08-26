import { OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';
import { DynamicDatasetSource } from './dynamic/dynamic-dataset.source';
import { IReportDataProvider, ProviderDescriptor, ReportContext, ReportRow } from './report-data-provider.types';
export declare class ReportDataProviderRegistry implements OnModuleInit {
    private readonly discovery;
    private readonly reflector;
    private readonly dynamic;
    private readonly logger;
    private readonly providers;
    private readonly descriptors;
    constructor(discovery: DiscoveryService, reflector: Reflector, dynamic: DynamicDatasetSource);
    onModuleInit(): void;
    has(token: string): boolean;
    get(token: string): IReportDataProvider;
    list(docType?: string): ProviderDescriptor[];
    listTokens(): string[];
    resolve(token: string, context: ReportContext): Promise<ReportRow[] | ReportRow>;
    sample(token: string): ReportRow[] | ReportRow;
}
