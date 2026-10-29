import { RequestContextService } from "../../../common/request-context/request-context.service";
import { PrismaService } from "../../../database/prisma/prisma.service";
import { AccountLedgerMastersService } from "../../accountsModule/accountLedgerMasters/account-ledger-masters.service";
export declare const AGENT_MENU_ID = 28;
export declare class SaveAgentDto {
    pagId?: string;
    companyId: string;
    code?: string;
    name: string;
    alias?: string;
    mobile1?: string;
    mobile2?: string;
    addr1?: string;
    addr2?: string;
    city?: string;
    district?: string;
    state?: string;
    pincode?: string;
    panNo?: string;
    gstin?: string;
    defaultCommPct?: number;
    remarks?: string;
    isActive?: boolean;
}
export declare class AgentRefDto {
    pagId: string;
}
export declare class AgentActiveDto extends AgentRefDto {
    active: boolean;
}
export declare class PurchaseAgentService {
    private readonly prisma;
    private readonly ctx;
    private readonly ledgers;
    constructor(prisma: PrismaService, ctx: RequestContextService, ledgers: AccountLedgerMastersService);
    private actor;
    save(dto: SaveAgentDto): Promise<Record<string, unknown>>;
    setActive(dto: AgentActiveDto): Promise<Record<string, unknown>>;
    get(pagId: string): Promise<Record<string, unknown>>;
}
export declare class PurchaseAgentController {
    private readonly service;
    private readonly prisma;
    private readonly ctx;
    constructor(service: PurchaseAgentService, prisma: PrismaService, ctx: RequestContextService);
    private right;
    save(dto: SaveAgentDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
    active(dto: AgentActiveDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
    get(q: AgentRefDto): Promise<{
        success: boolean;
        message: string;
        data: Record<string, unknown>;
    }>;
}
