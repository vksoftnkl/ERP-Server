import { Prisma } from '@prisma/client';
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AuditLogService } from "../../audit-log/audit-log.service";
import { RequestContextService } from "../../../common/request-context/request-context.service";
import { type MenuRight } from "../../../common/posting/rights";
import { type GstMenu } from './gst-config.constants';
import { GstCryptoService } from './gst-crypto.service';
import type { GstErrorDetail } from '../types/gst-config.types';
export interface GstSecretSpec {
    key: string;
    column: string;
}
export interface GstSecretWrite {
    data: Record<string, string | null>;
    keyVersion: number;
    written: string[];
}
export declare class GstConfigSupport {
    private readonly prisma;
    private readonly requestContext;
    private readonly auditLogService;
    private readonly crypto;
    private readonly menuIds;
    constructor(prisma: PrismaService, requestContext: RequestContextService, auditLogService: AuditLogService, crypto: GstCryptoService);
    requireRight(menu: GstMenu, right: MenuRight, action: string): Promise<void>;
    actor(): string;
    audit(tx: Prisma.TransactionClient, entry: {
        action: 'New' | 'update' | 'cancel';
        table: string;
        screen: string;
        pk: string;
        displayName: string;
        before: object | null;
        after: object;
        notes: string;
    }): Promise<void>;
    notFound(field: string, what: string, id: string): never;
    conflict(message: string, field: string, detail: string, code: string): never;
    badRequest(errors: GstErrorDetail[]): never;
    refuseDeleted(field: string, what: string, id: string): never;
    refuseParentChange(field: string, stored: string): never;
    translateWriteError(error: unknown, uniques: ReadonlyArray<{
        match: readonly string[];
        field: string;
        message: string;
        code: string;
    }>): void;
    writeSecrets(params: {
        specs: readonly GstSecretSpec[];
        input: Record<string, unknown>;
        clear: readonly string[] | undefined;
        stored: Record<string, string | null> | null;
        storedVersion: number | null;
    }): GstSecretWrite;
    private menuIdOf;
}
export declare function toDateOnly(value: string | null | undefined): Date | null | undefined;
export declare function fromDateOnly(value: Date | null): string | null;
export declare function isoOrNull(value: Date | null): string | null;
export declare function decimalOrNull(value: Prisma.Decimal | null): number | null;
export declare function keep<T>(sent: T | undefined, stored: T | undefined, fallback: T): T;
