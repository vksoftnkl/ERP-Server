import { APP_THEME_BASES } from '../types/app-theme.types';
export declare class SaveAppThemeDto {
    thmId?: number;
    thmName: string;
    thmBase: (typeof APP_THEME_BASES)[number];
    thmIsDefault?: boolean;
    thmIsActive?: boolean;
    thmRemarks?: string | null;
    tokens: Record<string, string>;
}
