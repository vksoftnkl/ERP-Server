import { ConfigService } from '@nestjs/config';
import { Prisma, type WaConnection } from '@prisma/client';
import { PrismaService } from "../../database/prisma/prisma.service";
import { RequestContextService } from "../../common/request-context/request-context.service";
import { type MenuRight } from "../../common/posting/rights";
import { WaCryptoService } from './wa-crypto.service';
import type { TemplateMirror } from './wa-language';
import type { RelayConnection } from './wa-relay.client';
import { type WacState } from './wa.constants';
export interface WaActor {
    userId: string | null;
    userName: string;
    deviceId: string | null;
    branchId: string | null;
}
export declare class WaStore {
    readonly prisma: PrismaService;
    private readonly requestContext;
    private readonly crypto;
    private readonly config;
    private readonly logger;
    readonly processName: string;
    constructor(prisma: PrismaService, requestContext: RequestContextService, crypto: WaCryptoService, config: ConfigService);
    offlineSite(): boolean;
    assertMainServer(): void;
    userId(): string | null;
    right(menuId: number, right: MenuRight, action: string): Promise<void>;
    actor(): Promise<WaActor>;
    istToday(now?: Date): string;
    accYearOn(companyId: string, date: string): Promise<string>;
    companyExists(companyId: string): Promise<boolean>;
    row(companyId: string): Promise<WaConnection | null>;
    rowOrRefuse(companyId: string): Promise<WaConnection>;
    keyOf(row: WaConnection): string;
    relayUrlOrRefuse(): string;
    setState(row: WaConnection, state: WacState, by: string): Promise<void>;
    noteRelayError(row: WaConnection, error: unknown, by: string): Promise<void>;
    fastPoll(companyId: string): Promise<void>;
    mirror(row: WaConnection, conn: RelayConnection, by: string): Promise<void>;
    templates(companyId: string): Promise<TemplateMirror[]>;
    templateRows(companyId: string): Promise<{
        name: string;
        lang: string;
        purpose: string;
        category: string | null;
        status: string;
        reason: string | null;
        body: string | null;
        params: Prisma.JsonValue;
        headerKind: string;
        buttons: Prisma.JsonValue;
        statusOn: string | null;
    }[]>;
    usedToday(companyId: string): Promise<number>;
}
