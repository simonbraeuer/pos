import { Injectable, inject } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import { Tmf720ApiService, DigitalIdentity } from '@pos/tmf720';
import type { PublicUser } from '@pos/auth';

export interface CreateUserRequest {
  username: string;
  password: string;
  email: string;
  displayName: string;
  role: 'admin' | 'user';
}

export interface UpdateUserRequest {
  email?: string;
  displayName?: string;
  role?: 'admin' | 'user';
}

export interface ChangePasswordRequest {
  userId: string;
  currentPassword?: string;
  newPassword: string;
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private tmf720 = inject(Tmf720ApiService);

  // ── Public API ──────────────────────────────────────────────────────────

  getUsers(): Observable<PublicUser[]> {
    return this.tmf720
      .searchDigitalIdentities({ identityType: 'individual', page: 1, pageSize: 500 })
      .pipe(
        map((res) =>
          res.items
            .filter((i) => i.status !== 'revoked')
            .map((i) => this.toPublicUser(i))
        )
      );
  }

  getUser(id: string): Observable<PublicUser> {
    return this.tmf720.getDigitalIdentity(id).pipe(map((identity) => this.toPublicUser(identity)));
  }

  createUser(req: CreateUserRequest): Observable<PublicUser> {
    return this.tmf720
      .searchDigitalIdentities({ identityType: 'individual', page: 1, pageSize: 500 })
      .pipe(
        switchMap((res) => {
          const duplicate = res.items.some((i) => this.getAttribute(i, 'username') === req.username);
          if (duplicate) {
            const err = new Error('Username already exists') as any;
            err.status = 409;
            return throwError(() => err);
          }

          return this.tmf720.createDigitalIdentity({
            identityType: 'individual',
            verificationLevel: 'low',
            credential: [
              {
                credentialType: 'password',
                status: 'active',
                credentialValue: btoa(req.password),
              },
            ],
            attribute: [
              {
                name: 'username',
                value: req.username,
                verificationStatus: 'verified',
                verifiedDate: new Date().toISOString(),
              },
              {
                name: 'email',
                value: req.email,
                verificationStatus: 'verified',
                verifiedDate: new Date().toISOString(),
              },
              {
                name: 'displayName',
                value: req.displayName,
                verificationStatus: 'verified',
                verifiedDate: new Date().toISOString(),
              },
              {
                name: 'role',
                value: req.role,
                verificationStatus: 'verified',
                verifiedDate: new Date().toISOString(),
              },
            ],
            relatedParty: [
              {
                id: req.username,
                name: req.displayName,
                role: 'owner',
                '@referredType': 'Individual',
              },
            ],
          });
        }),
        map((identity) => this.toPublicUser(identity))
      );
  }

  updateUser(id: string, req: UpdateUserRequest): Observable<PublicUser> {
    return this.tmf720.getDigitalIdentity(id).pipe(
      switchMap((identity) => {
        const updates = [] as { id: string; value: string }[];

        const email = this.findAttribute(identity, 'email');
        if (email && req.email !== undefined) {
          updates.push({ id: email.id, value: req.email });
        }

        const displayName = this.findAttribute(identity, 'displayName');
        if (displayName && req.displayName !== undefined) {
          updates.push({ id: displayName.id, value: req.displayName });
        }

        const role = this.findAttribute(identity, 'role');
        if (role && req.role !== undefined) {
          updates.push({ id: role.id, value: req.role });
        }

        return this.tmf720.updateDigitalIdentity(id, {
          attribute: updates.map((u) => ({ id: u.id, value: u.value })),
        });
      }),
      map((identity) => this.toPublicUser(identity))
    );
  }

  deleteUser(id: string): Observable<void> {
    return this.tmf720.deleteDigitalIdentity(id);
  }

  changePassword(req: ChangePasswordRequest): Observable<void> {
    return this.tmf720.getDigitalIdentity(req.userId).pipe(
      switchMap((identity) => {
        const passwordCredential = identity.credential?.find(
          (c) => c.credentialType === 'password' && c.status === 'active'
        );

        if (!passwordCredential) {
          const err = new Error('Password credential not found') as any;
          err.status = 404;
          return throwError(() => err);
        }

        if (
          req.currentPassword !== undefined &&
          passwordCredential.credentialValue !== btoa(req.currentPassword)
        ) {
          const err = new Error('Current password is incorrect') as any;
          err.status = 400;
          return throwError(() => err);
        }

        return this.tmf720.updateDigitalIdentity(req.userId, {
          credential: [
            {
              id: passwordCredential.id,
              credentialValue: btoa(req.newPassword),
              lastUsedDate: new Date().toISOString(),
            },
          ],
        });
      }),
      map(() => undefined)
    );
  }

  private toPublicUser(identity: DigitalIdentity): PublicUser {
    const username = this.getAttribute(identity, 'username') || identity.id;
    const email = this.getAttribute(identity, 'email') || `${username}@pos.local`;
    const displayName = this.getAttribute(identity, 'displayName') || username;
    const role = this.getAttribute(identity, 'role') === 'admin' ? 'admin' : 'user';

    return {
      id: identity.id,
      username,
      role,
      email,
      displayName,
    };
  }

  private getAttribute(identity: DigitalIdentity, name: string): string | undefined {
    return identity.attribute?.find((a) => a.name === name)?.value;
  }

  private findAttribute(identity: DigitalIdentity, name: string) {
    return identity.attribute?.find((a) => a.name === name);
  }
}
