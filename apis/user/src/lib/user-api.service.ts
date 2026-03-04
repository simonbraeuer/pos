import { Injectable, inject } from '@angular/core';
import { Observable, from } from 'rxjs';
import { IdbService, idbReq } from '@pos/auth';
import { PublicUser, User } from '@pos/auth';

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

/** Simulates realistic API network latency (150–800 ms). */
function simulateLatency(): Promise<void> {
  return new Promise(r => setTimeout(r, 150 + Math.random() * 650));
}

/** Randomly reject ~5 % of requests to simulate transient failures. */
function maybeNetworkError(): void {
  if (Math.random() < 0.05) {
    throw { status: 503, message: 'Service temporarily unavailable' };
  }
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private idb = inject(IdbService);

  // ── Public API ──────────────────────────────────────────────────────────

  getUsers(): Observable<PublicUser[]> {
    return from(simulateLatency().then(() => { maybeNetworkError(); return this.doGetAll(); }));
  }

  getUser(id: string): Observable<PublicUser> {
    return from(simulateLatency().then(() => { maybeNetworkError(); return this.doGet(id); }));
  }

  createUser(req: CreateUserRequest): Observable<PublicUser> {
    return from(simulateLatency().then(() => { maybeNetworkError(); return this.doCreate(req); }));
  }

  updateUser(id: string, req: UpdateUserRequest): Observable<PublicUser> {
    return from(simulateLatency().then(() => { maybeNetworkError(); return this.doUpdate(id, req); }));
  }

  deleteUser(id: string): Observable<void> {
    return from(simulateLatency().then(() => { maybeNetworkError(); return this.doDelete(id); }));
  }

  changePassword(req: ChangePasswordRequest): Observable<void> {
    return from(simulateLatency().then(() => { maybeNetworkError(); return this.doChangePassword(req); }));
  }

  // ── Internal helpers ────────────────────────────────────────────────────

  private async doGetAll(): Promise<PublicUser[]> {
    const db    = await this.idb.open();
    const tx    = db.transaction('users', 'readonly');
    const users = await idbReq<User[]>(tx.objectStore('users').getAll());
    return users.map(({ passwordHash: _ph, ...u }) => u);
  }

  private async doGet(id: string): Promise<PublicUser> {
    const db   = await this.idb.open();
    const tx   = db.transaction('users', 'readonly');
    const user = await idbReq<User | undefined>(tx.objectStore('users').get(id));
    if (!user) throw { status: 404, message: 'User not found' };
    const { passwordHash: _ph, ...pub } = user;
    return pub;
  }

  private async doCreate(req: CreateUserRequest): Promise<PublicUser> {
    const db  = await this.idb.open();
    const newUser: User = {
      id: crypto.randomUUID(),
      username: req.username,
      passwordHash: btoa(req.password),
      role: req.role,
      email: req.email,
      displayName: req.displayName,
    };
    const tx = db.transaction('users', 'readwrite');
    await idbReq(tx.objectStore('users').add(newUser));
    const { passwordHash: _ph, ...pub } = newUser;
    return pub;
  }

  private async doUpdate(id: string, req: UpdateUserRequest): Promise<PublicUser> {
    const db    = await this.idb.open();
    const tx    = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const user  = await idbReq<User | undefined>(store.get(id));
    if (!user) throw { status: 404, message: 'User not found' };
    const updated: User = { ...user, ...req };
    await idbReq(store.put(updated));
    const { passwordHash: _ph, ...pub } = updated;
    return pub;
  }

  private async doDelete(id: string): Promise<void> {
    const db = await this.idb.open();
    const tx = db.transaction('users', 'readwrite');
    await idbReq(tx.objectStore('users').delete(id));
  }

  private async doChangePassword(req: ChangePasswordRequest): Promise<void> {
    const db    = await this.idb.open();
    const tx    = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const user  = await idbReq<User | undefined>(store.get(req.userId));
    if (!user) throw { status: 404, message: 'User not found' };
    if (req.currentPassword !== undefined &&
        user.passwordHash !== btoa(req.currentPassword)) {
      throw { status: 400, message: 'Current password is incorrect' };
    }
    await idbReq(store.put({ ...user, passwordHash: btoa(req.newPassword) }));
  }
}
