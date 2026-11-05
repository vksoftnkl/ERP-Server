export interface ErrorWordingRow {
    code: string;
    variant: string;
    lang: string;
    title: string;
    line: string;
    todo: string;
}
export interface UserWording {
    title: string;
    line: string;
    todo: string;
}
export declare function setErrorWording(rows: readonly ErrorWordingRow[], version: string | null): void;
export declare function errorWordingVersion(): string | null;
export declare function wordingFor(detail: Record<string, unknown>, lang?: string): UserWording | null;
export declare function withUserWording<T>(body: T, lang?: string): T;
export declare function withUserWordingOnNotes<T>(body: T, lang?: string): T;
export declare function wordingLangOf(request: {
    query?: unknown;
    headers?: Record<string, unknown>;
}): string;
export declare function wordedResponse<TRes extends {
    status(code: number): {
        json(body: unknown): unknown;
    };
}>(response: TRes, request: unknown): {
    status(code: number): {
        json(body: unknown): unknown;
    };
};
