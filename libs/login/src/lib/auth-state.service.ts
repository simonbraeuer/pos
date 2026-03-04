import { Injectable, inject, signal, computed } from "@angular/core";
import { Router } from "@angular/router";
import { AuthApiService } from "@pos/auth";
import type { Session, LoginRequest } from "@pos/auth";

const TOKEN_KEY = "pos_session_token";

@Injectable({ providedIn: "root" })
export class AuthStateService {
  private auth = inject(AuthApiService);
  private router = inject(Router);

  private _session = signal<Session | null>(null);
  private _loading = signal(false);
  private _error   = signal<string | null>(null);

  readonly session      = this._session.asReadonly();
  readonly loading      = this._loading.asReadonly();
  readonly error        = this._error.asReadonly();
  readonly isAuthenticated = computed(() => !!this._session());
  readonly currentUser     = computed(() => {
    const s = this._session();
    if (!s) return null;
    return { id: s.userId, username: s.username, role: s.role, displayName: s.displayName };
  });

  /** Called once at app bootstrap. */
  async init(): Promise<void> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    try {
      const session = await new Promise<Session | null>((res, rej) =>
        this.auth.getSession(token).subscribe({ next: res, error: rej })
      );
      this._session.set(session);
      if (!session) localStorage.removeItem(TOKEN_KEY);
    } catch {
      localStorage.removeItem(TOKEN_KEY);
    }
  }

  login(req: LoginRequest): void {
    this._loading.set(true);
    this._error.set(null);
    this.auth.login(req).subscribe({
      next: (resp) => {
        localStorage.setItem(TOKEN_KEY, resp.token);
        this._session.set({
          token: resp.token,
          userId: resp.user.id,
          username: resp.user.username,
          role: resp.user.role,
          displayName: resp.user.displayName,
          expiresAt: Date.now() + 8 * 60 * 60 * 1000,
        });
        this._loading.set(false);
        this.router.navigate(["/"]);
      },
      error: (err) => {
        this._loading.set(false);
        this._error.set(err?.message ?? "Login failed");
      },
    });
  }

  logout(): void {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) this.auth.logout(token).subscribe();
    localStorage.removeItem(TOKEN_KEY);
    this._session.set(null);
    this.router.navigate(["/login"]);
  }
}
