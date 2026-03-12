import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Tmf691ApiService } from '@pos/tmf691';
import { Tmf720ApiService, DigitalIdentity } from '@pos/tmf720';
import { LoginRequest, LoginResponse, Session } from './models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private tmf691 = inject(Tmf691ApiService);
  private tmf720 = inject(Tmf720ApiService);

  // ── Public API ──────────────────────────────────────────────────────────

  login(req: LoginRequest): Observable<LoginResponse> {
    return this.tmf720
      .searchDigitalIdentities({ identityType: 'individual', page: 1, pageSize: 500 })
      .pipe(
        map((res) =>
          res.items.find(
            (i) =>
              this.getAttribute(i, 'username') === req.username && i.status !== 'revoked'
          )
        ),
        switchMap((identity) => {
          if (!identity) {
            const err = new Error('Invalid username or password') as any;
            err.status = 401;
            return throwError(() => err);
          }

          const passwordCredential = identity.credential?.find(
            (c) => c.credentialType === 'password' && c.status === 'active'
          );

          if (!passwordCredential?.credentialValue || passwordCredential.credentialValue !== btoa(req.password)) {
            const err = new Error('Invalid username or password') as any;
            err.status = 401;
            return throwError(() => err);
          }

          const email = this.getAttribute(identity, 'email') || `${req.username}@pos.local`;
          const displayName = this.getAttribute(identity, 'displayName') || req.username;
          const role = this.getRole(identity);

          return this.tmf691
            .createSessionForUser({
              userId: identity.id,
              username: req.username,
              email,
              displayName,
              roles: [role],
              authenticationMethod: 'password',
            })
            .pipe(
              map((resp) => ({
                token: resp.token.accessToken,
                user: {
                  id: identity.id,
                  username: req.username,
                  role,
                  email,
                  displayName,
                },
              }))
            );
        })
      );
  }

  logout(token: string): Observable<void> {
    return this.tmf691.logout({ token }).pipe(map(() => undefined));
  }

  getSession(token: string): Observable<Session | null> {
    return this.tmf691.getSessionByToken(token).pipe(
      map((session) => {
        if (!session) return null;

        const username =
          session.userIdentity?.username ||
          (typeof session.claims?.['username'] === 'string' ? session.claims['username'] : 'unknown');
        const displayName = session.userIdentity?.displayName || username;
        const role = this.toRole(session.userIdentity?.roles?.[0]);

        return {
          token,
          userId: session.userId,
          username,
          role,
          displayName,
          expiresAt: new Date(session.expiresAt).getTime(),
        };
      })
    );
  }

  private getAttribute(identity: DigitalIdentity, name: string): string | undefined {
    return identity.attribute?.find((a) => a.name === name)?.value;
  }

  private getRole(identity: DigitalIdentity): 'admin' | 'user' {
    return this.toRole(this.getAttribute(identity, 'role'));
  }

  private toRole(roleLike: string | undefined): 'admin' | 'user' {
    return roleLike === 'admin' ? 'admin' : 'user';
  }
}
