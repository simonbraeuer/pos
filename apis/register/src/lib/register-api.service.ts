import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import { HardwareStationApiService } from '@pos/hardware-station';
import { CreateRegisterRequest, Register, UpdateRegisterRequest } from './models';

function simulateLatency(): number {
  return 120 + Math.random() * 480;
}

function maybeNetworkError(): Observable<never> | null {
  if (Math.random() < 0.05) {
    const err = new Error('Register service temporarily unavailable') as Error & { status?: number };
    err.status = 503;
    return throwError(() => err);
  }
  return null;
}

let nextRegisterId = 0;
const REGISTER_BASE_PATH = '/register/v1/register';
const STORE_NAME = 'registers';
const DB_NAME = 'pos-registers';

const INITIAL_REGISTERS: Register[] = [
  {
    id: 1,
    code: 'REG-WI-01',
    name: 'Wien Register 01',
    hwStationId: 1,
    href: `${REGISTER_BASE_PATH}/1`,
    '@type': 'Register',
  },
  {
    id: 2,
    code: 'REG-WI-SHIFT',
    name: 'Wien User Shift Register',
    href: `${REGISTER_BASE_PATH}/2`,
    '@type': 'Register',
  },
  {
    id: 3,
    code: 'REG-LZ-01',
    name: 'Linz Register 01',
    hwStationId: 3,
    href: `${REGISTER_BASE_PATH}/3`,
    '@type': 'Register',
  },
];

@Injectable({ providedIn: 'root' })
export class RegisterApiService implements OnInit {
  private readonly hardwareStationApi = inject(HardwareStationApiService);
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'register', REGISTER_BASE_PATH);
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
          for (const register of INITIAL_REGISTERS) {
            await firstValueFrom(this.idb.put(STORE_NAME, register));
          }
          nextRegisterId = Math.max(...INITIAL_REGISTERS.map((r) => r.id)) + 1;
        } else {
          const registers = await firstValueFrom(this.idb.getAll<Register>(STORE_NAME));
          nextRegisterId = Math.max(...registers.map((r) => r.id), 0) + 1;
        }
      } catch (error) {
        console.error('Failed to initialize register database:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  listRegisters(): Observable<Register[]> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const registers = await firstValueFrom(this.idb.getAll<Register>(STORE_NAME));
          setTimeout(() => {
            subscriber.next(registers);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  getRegister(registerId: number): Observable<Register> {
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
            const register = await firstValueFrom(this.idb.get<Register>(STORE_NAME, registerId));
            setTimeout(() => {
              subscriber.next(register);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Register ${registerId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  createRegister(request: CreateRegisterRequest): Observable<Register> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          await this.assertCodeUnique(request.code);

          if (request.hwStationId !== undefined) {
            await firstValueFrom(this.hardwareStationApi.getHardwareStation(request.hwStationId));
          }

          const id = nextRegisterId++;
          const created: Register = {
            id,
            code: request.code,
            name: request.name,
            hwStationId: request.hwStationId,
            href: `${REGISTER_BASE_PATH}/${id}`,
            '@type': 'Register',
          };

          await firstValueFrom(this.idb.put(STORE_NAME, created));
          setTimeout(() => {
            subscriber.next(created);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  updateRegister(registerId: number, updates: UpdateRegisterRequest): Observable<Register> {
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
            const register = await firstValueFrom(this.idb.get<Register>(STORE_NAME, registerId));

            if (updates.code !== undefined && updates.code !== register.code) {
              await this.assertCodeUnique(updates.code, registerId);
              register.code = updates.code;
            }
            if (updates.name !== undefined) {
              register.name = updates.name;
            }

            if ('hwStationId' in updates) {
              if (updates.hwStationId === undefined) {
                register.hwStationId = undefined;
              } else {
                await firstValueFrom(this.hardwareStationApi.getHardwareStation(updates.hwStationId));
                register.hwStationId = updates.hwStationId;
              }
            }

            await firstValueFrom(this.idb.put(STORE_NAME, register));
            setTimeout(() => {
              subscriber.next(register);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Register ${registerId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  unlinkRegisterFromHardwareStation(registerId: number): Observable<Register> {
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
            const register = await firstValueFrom(this.idb.get<Register>(STORE_NAME, registerId));
            register.hwStationId = undefined;
            await firstValueFrom(this.idb.put(STORE_NAME, register));
            setTimeout(() => {
              subscriber.next(register);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Register ${registerId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  deleteRegister(registerId: number): Observable<void> {
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
            await firstValueFrom(this.idb.get<Register>(STORE_NAME, registerId));
            await firstValueFrom(this.idb.delete(STORE_NAME, registerId));
            setTimeout(() => {
              subscriber.next(undefined);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Register ${registerId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  private async assertCodeUnique(code: string, ignoreId?: number): Promise<void> {
    const registers = await firstValueFrom(this.idb.getAll<Register>(STORE_NAME));
    const duplicate = registers.some((register) => register.code === code && register.id !== ignoreId);
    if (duplicate) {
      const err = new Error(`Register code '${code}' already exists`) as Error & { status?: number };
      err.status = 409;
      throw err;
    }
  }
}
