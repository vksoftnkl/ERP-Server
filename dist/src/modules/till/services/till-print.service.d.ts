import { PrismaService } from '../../../database/prisma/prisma.service';
import { TillDayService } from './till-day.service';
import { TillSessionService } from './till-session.service';
export interface TillPrintDoc {
    companyId: string;
    docId: string;
    accYear: string;
    userId: string | null;
}
export type TillPrintRow = Record<string, string | number | boolean | null>;
export declare class TillPrintService {
    private readonly prisma;
    private readonly sessions;
    private readonly days;
    constructor(prisma: PrismaService, sessions: TillSessionService, days: TillDayService);
    sessionHeader(doc: TillPrintDoc): Promise<TillPrintRow>;
    sessionTenders(doc: TillPrintDoc): Promise<TillPrintRow[]>;
    sessionMovements(doc: TillPrintDoc): Promise<TillPrintRow[]>;
    dayHeader(doc: TillPrintDoc): Promise<TillPrintRow>;
    daySessions(doc: TillPrintDoc): Promise<TillPrintRow[]>;
    dayTenders(doc: TillPrintDoc): Promise<TillPrintRow[]>;
    private session;
    private day;
    private inTransit;
    private userName;
}
export declare function timeText(iso: string | null): string | null;
