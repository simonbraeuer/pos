import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import { RegisterApiService } from '@pos/register';
import { OpenShiftRequest, Shift } from './models';


// --- API Behaviour Config ---
interface ApiBehaviourConfig {
  latency: number;
  errorRate: number;
  failureStatus: number;
}

const API_BEHAVIOUR_KEY = 'pos_api_behaviour';
function getApiBehaviour(): ApiBehaviourConfig {
  try {
    const raw = localStorage.getItem(API_BEHAVIOUR_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { latency: 300, errorRate: 5, failureStatus: 503 };
}

function simulateLatency(): number {
  const { latency } = getApiBehaviour();
  const jitter = latency * 0.3 * (Math.random() - 0.5) * 2;
  return Math.max(0, Math.round(latency + jitter));
}

function maybeNetworkError(): Observable<never> | null {
  const { errorRate, failureStatus } = getApiBehaviour();
  if (Math.random() < (errorRate / 100)) {
    const err = new Error('Shift service temporarily unavailable') as Error & { status?: number };
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

function withDerivedStatus(shift: Shift): Shift {
  if (shift.status === 'CLOSED') {
    return shift;
  }

  const nextStatus = todayDateOnly() > shift.bookingDay ? 'NEED_CLOSURE' : 'OPEN';
  return { ...shift, status: nextStatus };
}

let nextShiftId = 0;
const SHIFT_BASE_PATH = '/shift/v1/shift';
const STORE_NAME = 'shifts';
const DB_NAME = 'pos-shifts';

const INITIAL_SHIFTS: Shift[] = [
  {
    id: 1,
    registerId: 1,
    userId: 'user-admin',
    bookingDay: todayDateOnly(),
    status: 'OPEN',
    openedAt: new Date().toISOString(),
    href: `${SHIFT_BASE_PATH}/1`,
    '@type': 'Shift',
  },
  {
    id: 2,
    registerId: 2,
    userId: 'user-cashier-01',
    bookingDay: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    status: 'NEED_CLOSURE',
    openedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    href: `${SHIFT_BASE_PATH}/2`,
    '@type': 'Shift',
  },
];

@Injectable({ providedIn: 'root' })
export class ShiftApiService implements OnInit {
  private readonly registerApi = inject(RegisterApiService);
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'shift', SHIFT_BASE_PATH);
  }

  ngOnInit(): void {
    this.initializeDb();
  }

  private initializeDb(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      try {
        await this.idb.initialize(DB_NAME, [{ name: STORE_NAME, keyPath: 'id', autoIncrement: false }]);

        const count = await firstValueFrom(this.idb.count(STORE_NAME));
        if (count === 0) {
          for (const shift of INITIAL_SHIFTS) {
            await firstValueFrom(this.idb.put(STORE_NAME, shift));
          }
          nextShiftId = Math.max(...INITIAL_SHIFTS.map((s) => s.id)) + 1;
        } else {
          const shifts = await firstValueFrom(this.idb.getAll<Shift>(STORE_NAME));
          nextShiftId = Math.max(...shifts.map((s) => s.id), 0) + 1;
        }
      } catch (error) {
        console.error('Failed to initialize shift database:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  listShifts(): Observable<Shift[]> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const shifts = await firstValueFrom(this.idb.getAll<Shift>(STORE_NAME));
          const derived = shifts.map((shift) => withDerivedStatus(shift));

          for (const shift of derived) {
            await firstValueFrom(this.idb.put(STORE_NAME, shift));
          }

          setTimeout(() => {
            subscriber.next(derived);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  getShift(shiftId: number): Observable<Shift> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          try {
            const shift = await firstValueFrom(this.idb.get<Shift>(STORE_NAME, shiftId));
            const derived = withDerivedStatus(shift);
            await firstValueFrom(this.idb.put(STORE_NAME, derived));

            setTimeout(() => {
              subscriber.next(derived);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Shift ${shiftId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  openShift(request: OpenShiftRequest): Observable<Shift> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const shifts = await firstValueFrom(this.idb.getAll<Shift>(STORE_NAME));
          const hasActiveShift = shifts
            .map((shift) => withDerivedStatus(shift))
            .some(
              (shift) =>
                shift.registerId === request.registerId &&
                shift.userId === request.userId &&
                shift.status !== 'CLOSED'
            );

          if (hasActiveShift) {
            const err = new Error(
              `An active shift already exists for register ${request.registerId} and user ${request.userId}`
            ) as Error & { status?: number };
            err.status = 409;
            subscriber.error(err);
            return;
          }

          await firstValueFrom(this.registerApi.getRegister(request.registerId));

          const id = nextShiftId++;
          const created: Shift = {
            id,
            registerId: request.registerId,
            userId: request.userId,
            bookingDay: request.bookingDay ?? todayDateOnly(),
            status: 'OPEN',
            openedAt: new Date().toISOString(),
            href: `${SHIFT_BASE_PATH}/${id}`,
            '@type': 'Shift',
          };

          const normalized = withDerivedStatus(created);
          await firstValueFrom(this.idb.put(STORE_NAME, normalized));

          setTimeout(() => {
            subscriber.next(normalized);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  closeShift(shiftId: number): Observable<Shift> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          try {
            const shift = await firstValueFrom(this.idb.get<Shift>(STORE_NAME, shiftId));

            if (shift.status === 'CLOSED') {
              const err = new Error(`Shift ${shiftId} is already closed`) as Error & { status?: number };
              err.status = 409;
              subscriber.error(err);
              return;
            }

            shift.status = 'CLOSED';
            shift.closedAt = new Date().toISOString();

            await firstValueFrom(this.idb.put(STORE_NAME, shift));
            setTimeout(() => {
              subscriber.next(shift);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Shift ${shiftId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
