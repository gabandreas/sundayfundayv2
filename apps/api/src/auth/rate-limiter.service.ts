import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { normalizeIp } from './auth.utils';

export interface RateLimitState {
  attempts: number;
  firstAttemptAt: number;
  lockedUntil: number | null;
}

@Injectable()
export class RateLimiterService {
  private readonly attemptsMap = new Map<string, RateLimitState>();
  private readonly WINDOW_MS = 15 * 60 * 1000; // 15 minutes
  private readonly MAX_ATTEMPTS = 5;
  private readonly LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes

  private makeKey(email: string, clientIp: string): string {
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanIp = normalizeIp(clientIp);
    return `${cleanEmail}:${cleanIp}`;
  }

  /**
   * Checks if the given (email, ip) is currently locked out due to exceeding failed attempts.
   * Throws HTTP 429 Too Many Requests if locked.
   */
  check(email: string, clientIp: string): void {
    const key = this.makeKey(email, clientIp);
    const state = this.attemptsMap.get(key);

    if (!state) return;

    const now = Date.now();

    // If locked, check if the lock period is still active
    if (state.lockedUntil) {
      if (now < state.lockedUntil) {
        throw new HttpException(
          'Too many failed authentication attempts. Please wait 15 minutes before retrying.',
          HttpStatus.TOO_MANY_REQUESTS,
        );
      } else {
        // Lock expired, reset state
        this.attemptsMap.delete(key);
      }
    }
  }

  /**
   * Records a failed attempt for the given (email, ip).
   * Locks the key if failures reach MAX_ATTEMPTS within the window.
   */
  recordFailure(email: string, clientIp: string): { attempts: number; isLocked: boolean } {
    const key = this.makeKey(email, clientIp);
    const now = Date.now();
    let state = this.attemptsMap.get(key);

    if (!state || now - state.firstAttemptAt > this.WINDOW_MS) {
      state = {
        attempts: 1,
        firstAttemptAt: now,
        lockedUntil: null,
      };
    } else {
      state.attempts += 1;
    }

    if (state.attempts >= this.MAX_ATTEMPTS) {
      state.lockedUntil = now + this.LOCK_DURATION_MS;
      this.attemptsMap.set(key, state);
      throw new HttpException(
        'Too many failed login attempts. Please wait 15 minutes before retrying.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    this.attemptsMap.set(key, state);
    return { attempts: state.attempts, isLocked: false };
  }

  /**
   * Records a successful login and resets failed attempt counter for this key.
   */
  recordSuccess(email: string, clientIp: string): void {
    const key = this.makeKey(email, clientIp);
    this.attemptsMap.delete(key);
  }

  /**
   * Resets rate limit for a specific (email, ip).
   */
  reset(email: string, clientIp: string): void {
    const key = this.makeKey(email, clientIp);
    this.attemptsMap.delete(key);
  }

  /**
   * Clears all rate limiting states (useful in test suites).
   */
  clearAll(): void {
    this.attemptsMap.clear();
  }

  /**
   * Returns inspection state for unit testing.
   */
  getState(email: string, clientIp: string): { attempts: number; isLocked: boolean; lockedUntil: number | null } {
    const key = this.makeKey(email, clientIp);
    const state = this.attemptsMap.get(key);
    if (!state) {
      return { attempts: 0, isLocked: false, lockedUntil: null };
    }
    const isLocked = Boolean(state.lockedUntil && Date.now() < state.lockedUntil);
    return { attempts: state.attempts, isLocked, lockedUntil: state.lockedUntil };
  }
}
