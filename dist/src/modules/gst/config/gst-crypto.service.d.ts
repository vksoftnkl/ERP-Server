export declare class GstCryptoService {
    currentVersion(): number;
    isConfigured(): boolean;
    encrypt(plain: string): string;
    decrypt(stored: string): string;
    versionOf(stored: string): number | null;
    private keyFor;
    private throwKeyProblem;
}
