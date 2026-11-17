import { Prisma } from '@prisma/client';
type Num = Prisma.Decimal | string | number | null | undefined;
export declare function decOf(value: Num): Prisma.Decimal;
export declare function qtyText(value: Num, dp?: number): string;
export declare function numOf(value: Num): number | null;
export declare function dmyText(value: string | Date | null | undefined): string;
export declare function istText(at: Date | string | null | undefined): string;
export declare function countText(n: number, one: string, many?: string): string;
export declare function uuidList(raw: unknown, what: string, max?: number): string[];
export declare const UUID: RegExp;
export declare class RenderMemo<T> {
    private readonly keepMs;
    private readonly runs;
    constructor(keepMs?: number);
    get(key: string, work: () => Promise<T>): Promise<T>;
}
export {};
