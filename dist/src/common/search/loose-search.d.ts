import { Prisma } from '@prisma/client';
export declare const SEARCH_NORM_SQL_FUNCTION = "fixed.fn_search_norm";
export declare const MAX_SEARCH_TOKENS = 8;
export declare function normalizeSearchText(text: string | null | undefined): string;
export declare function splitSearchTokens(text: string | null | undefined): string[];
export declare function looseSearchPredicateSql(columnExpr: string, paramPlaceholder: string): string;
export declare function looseSearchSql(columnExprs: readonly string[], search: string | null | undefined): Prisma.Sql;
