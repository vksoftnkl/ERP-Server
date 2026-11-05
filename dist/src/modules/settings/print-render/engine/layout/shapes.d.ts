import { PathPrimitive } from './layout-tree.types';
export interface Point {
    readonly x: number;
    readonly y: number;
}
export interface PathStyle {
    readonly fill: string | null;
    readonly stroke: string | null;
    readonly strokeWidthPt: number;
    readonly dash?: PathPrimitive['dash'];
}
export declare function polygonPath(points: readonly Point[], style: PathStyle): PathPrimitive;
export declare function polylinePath(points: readonly Point[], style: PathStyle): PathPrimitive;
export declare function ellipsePath(x: number, y: number, w: number, h: number, style: PathStyle): PathPrimitive;
export declare function trianglePath(x: number, y: number, w: number, h: number, style: PathStyle): PathPrimitive;
export declare function rhombusPath(x: number, y: number, w: number, h: number, style: PathStyle): PathPrimitive;
export declare function arrowHeadPath(from: Point, tip: Point, lengthMm: number, lineWidthMm: number, colour: string): PathPrimitive | null;
export declare function slicePath(cx: number, cy: number, radius: number, innerRadius: number, start: number, end: number, style: PathStyle): PathPrimitive;
