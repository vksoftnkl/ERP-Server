import type { Prisma } from '@prisma/client';
export declare const ITEM_HISTORY_CHILD_SCREENS: ReadonlySet<string>;
export declare function itemChildDisplayName(screenName: string, record: Prisma.JsonValue | null): string | null;
