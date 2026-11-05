import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { ErrorMessageCataloguePayload } from './error-messages.types';
export declare class ErrorMessageService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly logger;
    private timer;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    reload(): Promise<void>;
    private refreshIfChanged;
    catalogue(lang: string, since?: string | null): Promise<ErrorMessageCataloguePayload>;
    private activeRows;
}
