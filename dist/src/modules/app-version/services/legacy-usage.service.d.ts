import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { ClientInfo } from '../../../common/client-info/client-info';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { LegacyUsageQueryDto } from '../dto/support-query.dto';
export interface LegacyUsageRow {
    id: string;
    name: string;
    platform: string;
    build: number;
    count: number;
    firstSeen: string;
    lastSeen: string;
}
export declare class LegacyUsageService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly logger;
    private pending;
    private droppedKeys;
    private timer;
    private flushChain;
    constructor(prisma: PrismaService);
    onModuleInit(): void;
    onModuleDestroy(): Promise<void>;
    record(name: string, client?: ClientInfo | null, count?: number): void;
    flush(): Promise<number>;
    list(query: LegacyUsageQueryDto): Promise<LegacyUsageRow[]>;
    pendingCount(): number;
    private flushOnce;
    private write;
    private merge;
}
