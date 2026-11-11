import { AppVersionStateStore } from './app-version-state.store';
export type TokenKind = 'access' | 'refresh';
export declare class AuthEpochService {
    private readonly store;
    private readonly logger;
    private epoch;
    private readFailed;
    private inFlight;
    private generation;
    private lastEarlyReload;
    constructor(store: AppVersionStateStore);
    current(): number;
    set(epoch: number): void;
    reload(): Promise<void>;
    assertTokenEpoch(ep: number | null | undefined, kind: TokenKind): void;
    private read;
}
