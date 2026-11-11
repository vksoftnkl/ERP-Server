import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { AuthErrorCode, authErrorBody } from '../../auth/types/auth-error-codes';
import { AppVersionStateStore } from './app-version-state.store';

export type TokenKind = 'access' | 'refresh';

/**
 * Part B Step 2 Rev 2 §7.2: the token epoch, held in memory.
 *
 * Every access and refresh token carries the epoch it was minted under (`ep`;
 * a token from before Rev 2 has none and reads as 0). When the backend starts
 * on a new APP_BUILD, BackendUpdateService raises the stored epoch by one, so
 * every token minted before the update is refused with 401
 * AUTH_BACKEND_UPDATED and every user logs in again (and meets the build check).
 * A restart on the same build changes nothing.
 *
 * No DB read per request: the value is loaded at startup and re-read every
 * STATE_REFRESH_INTERVAL_MS. A token whose epoch is ABOVE ours proves another
 * process has raised it, so it is accepted and triggers an early re-read.
 * If the table cannot be read, the last value stands (0 before the first read):
 * a failure here never locks users out.
 */
@Injectable()
export class AuthEpochService {
  private readonly logger = new Logger(AuthEpochService.name);
  private epoch = 0;
  private readFailed = false;
  private inFlight: Promise<void> | null = null;
  /** Raised by set(); a read that started before it is dropped. */
  private generation = 0;
  /** When a token from a newer epoch last triggered an early re-read. */
  private lastEarlyReload = 0;

  constructor(private readonly store: AppVersionStateStore) {}

  current(): number {
    return this.epoch;
  }

  /** Set by the startup step right after its transaction commits. */
  set(epoch: number): void {
    this.generation += 1;
    this.epoch = epoch;
  }

  async reload(): Promise<void> {
    this.inFlight ??= this.read().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /**
   * 401 AUTH_BACKEND_UPDATED when the token was minted under an older epoch.
   * A missing epoch reads as 0 (TokenService already does this; a hand-built
   * payload, e.g. a test double, may not).
   */
  assertTokenEpoch(ep: number | null | undefined, kind: TokenKind): void {
    const tokenEpoch = typeof ep === 'number' && Number.isFinite(ep) ? ep : 0;
    if (tokenEpoch >= this.epoch) {
      // At most one early re-read per EARLY_RELOAD_MIN_MS, so a token that stays
      // above a stale or unreadable epoch can never mean a DB read per request.
      const now = Date.now();
      if (tokenEpoch > this.epoch && now - this.lastEarlyReload >= EARLY_RELOAD_MIN_MS) {
        this.lastEarlyReload = now;
        void this.reload();
      }
      return;
    }
    throw new UnauthorizedException(
      authErrorBody(
        'The server was updated. Please log in again.',
        kind === 'access' ? 'authorization' : 'refresh_token',
        AuthErrorCode.BACKEND_UPDATED,
      ),
    );
  }

  private async read(): Promise<void> {
    const generation = this.generation;
    try {
      const epoch = await this.store.readEpoch();
      if (generation !== this.generation) {
        return; // the startup step set a newer value while this read was out
      }
      if (epoch !== this.epoch) {
        this.logger.log(`Token epoch ${this.epoch} -> ${epoch}`);
      }
      this.epoch = epoch;
      if (this.readFailed) {
        this.readFailed = false;
        this.logger.log('Token epoch: readable again');
      }
    } catch (error: unknown) {
      if (!this.readFailed) {
        this.readFailed = true;
        this.logger.warn(
          `Token epoch: could not read app_auth_state, keeping ${this.epoch}: ${describe(error)}`,
        );
      }
    }
  }
}

const EARLY_RELOAD_MIN_MS = 5_000;

function describe(error: unknown): string {
  return error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
}
