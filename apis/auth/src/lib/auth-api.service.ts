import { Injectable, inject } from '@angular/core';
import { Observable, from, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IdbService, idbReq } from './idb.service';
import { LoginRequest, LoginResponse, Session, User } from './models';

/** Simulates realistic API network latency (150–800 ms). */
function simulateLatency(): Promise<void> {
  return new Promise(r => setTimeout(r, 150 + Math.random() * 650));
}

/** Randomly reject ~5 % of requests to simulate transient failures. */
function maybeNetworkError(): void {
  if (Math.random() < 0.05) {
    const err = new Error('Service temporarily unavailable') as any;
    err.status = 503;
    throw err;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private idb = inject(IdbService);

  constructor() { this.seed(); }

  // ── Public API ──────────────────────────────────────────────────────────

  login(req: LoginRequest): Observable<LoginResponse> {
    return from(simulateLatency().then(() => { maybeNetworkError(); return this.doLogin(req); }));
  }

  logout(token: string): Observable<void> {
    return from(simulateLatency().then(() => { maybeNetworkError(); return this.doLogout(token); }));
  }

  getSession(token: string): Observable<Session | null> {
    // Session check is always fast (local read, no artificial failure)
    return from(this.doGetSession(token));
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async doLogin(req: LoginRequest): Promise<LoginResponse> {
    const db = await this.idb.open();
    const tx  = db.transaction('users', 'readonly');
    const user = await idbReq<User | undefined>(
      tx.objectStore('users').index('username').get(req.username)
    );

    if (!user || user.passwordHash !== btoa(req.password)) {
      const err = new Error('Invalid username or password') as any;
      err.status = 401;
      throw err;
    }

    const token = crypto.randomUUID();
    const session: Session = {
      token,
      userId: user.id,
      username: user.username,
      role: user.role,
      displayName: user.displayName,
      expiresAt: Date.now() + 8 * 60 * 60 * 1000,   // 8 h
    };

    const stx = db.transaction('sessions', 'readwrite');
    await idbReq(stx.objectStore('sessions').add(session));

    const { passwordHash: _ph, ...publicUser } = user;
    return { token, user: publicUser };
  }

  private async doLogout(token: string): Promise<void> {
    const db = await this.idb.open();
    const tx  = db.transaction('sessions', 'readwrite');
    await idbReq(tx.objectStore('sessions').delete(token));
  }

  private async doGetSession(token: string): Promise<Session | null> {
    const db      = await this.idb.open();
    const tx      = db.transaction('sessions', 'readonly');
    const session = await idbReq<Session | undefined>(tx.objectStore('sessions').get(token));
    if (!session) return null;
    if (session.expiresAt < Date.now()) {
      const dtx = db.transaction('sessions', 'readwrite');
      await idbReq(dtx.objectStore('sessions').delete(token));
      return null;
    }
    return session;
  }

  // ── Seed ────────────────────────────────────────────────────────────────

  private async seed(): Promise<void> {
    const db    = await this.idb.open();
    const tx    = db.transaction('users', 'readonly');
    const count = await idbReq(tx.objectStore('users').count());
    if (count > 0) return;

    const wtx   = db.transaction('users', 'readwrite');
    const store = wtx.objectStore('users');
    const seeds: User[] = [
      { id: crypto.randomUUID(), username: 'admin', passwordHash: btoa('admin123'),
        role: 'admin', email: 'admin@pos.local', displayName: 'Administrator' },
      { id: crypto.randomUUID(), username: 'user',  passwordHash: btoa('user123'),
        role: 'user',  email: 'user@pos.local',  displayName: 'Regular User'   },
    ];
    for (const u of seeds) await idbReq(store.add(u));
  }
}
