import { type KeyObject } from 'node:crypto';
export declare function publicKeyDir(): string;
export declare function loadPublicKey(ref: string): Promise<KeyObject | null>;
export declare function encryptAuthPayload(key: KeyObject, payload: object): string;
export declare function decryptSek(sek: string, appKey: Buffer): Buffer | null;
export declare function appKeyBytes(stored: string | null): Buffer | null;
