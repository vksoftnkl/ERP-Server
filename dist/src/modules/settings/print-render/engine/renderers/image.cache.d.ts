export declare class ImageCache {
    private readonly logger;
    private readonly entries;
    private totalBytes;
    private readonly warnings;
    private readonly allowedRoots;
    private readonly allowRemote;
    private readonly maxBytes;
    constructor();
    drainWarnings(): string[];
    resolveImage(source: string): Promise<Buffer | null>;
    private load;
    private decodeDataUri;
    private readLocal;
    private fetchRemote;
    private store;
    private warn;
    stats(): {
        entries: number;
        bytes: number;
        allowedRoots: readonly string[];
        allowRemote: boolean;
    };
}
