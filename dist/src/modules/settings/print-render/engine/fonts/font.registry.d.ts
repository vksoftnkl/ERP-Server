import { OnModuleInit } from '@nestjs/common';
import * as fontkit from 'fontkit';
import { ScriptTag } from './script-runs';
export type FontWeight = 'regular' | 'bold';
export type FontStyle = 'normal' | 'italic';
export interface FontKey {
    readonly family: string;
    readonly bold: boolean;
    readonly italic: boolean;
}
export interface LoadedFont {
    readonly id: string;
    readonly family: string;
    readonly bold: boolean;
    readonly italic: boolean;
    readonly filePath: string;
    readonly font: fontkit.Font;
    readonly unitsPerEm: number;
    readonly ascent: number;
    readonly descent: number;
    readonly lineGap: number;
}
export declare const DEFAULT_FONT_FAMILY = "NotoSans";
export declare const MONOSPACE_FONT_FAMILY = "NotoSansMono";
export declare class FontRegistry implements OnModuleInit {
    private readonly logger;
    private readonly faces;
    private fontDirectory;
    onModuleInit(): void;
    load(): void;
    get directory(): string;
    all(): readonly LoadedFont[];
    resolve(key: FontKey): LoadedFont;
    resolveForScript(key: FontKey, script: ScriptTag): LoadedFont;
    families(): string[];
}
