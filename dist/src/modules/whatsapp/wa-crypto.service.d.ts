export declare class WaCryptoService {
    currentVersion(): number;
    isConfigured(): boolean;
    encrypt(plain: string): string;
    decrypt(stored: string): string;
    private keyFor;
    private keyProblem;
}
