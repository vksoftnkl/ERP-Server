export declare function hashSecret(plain: string): Promise<string>;
export declare function verifySecret(plain: string, stored: string | null): Promise<boolean>;
