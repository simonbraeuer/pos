import { Injectable, inject, OnInit } from '@angular/core';
import { Observable, of, throwError, firstValueFrom } from 'rxjs';
import { delay, switchMap, map, catchError } from 'rxjs/operators';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import { HardwareStationApiService } from '@pos/hardware-station';
import { CreateDeviceRequest, Device, DeviceType, UpdateDeviceRequest } from './models';


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
    const err = new Error('Device service temporarily unavailable') as Error & { status?: number };
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

/** Simulate an online-status check via remote-device-service (80% chance online). */
function simulateOnlineStatus(): boolean {
  return Math.random() > 0.2;
}

let nextDeviceId = 0;
const DEVICE_BASE_PATH = '/device/v1/device';
const STORE_NAME = 'devices';
const DB_NAME = 'pos-devices';

// Initial mock data
const INITIAL_DEVICES: Device[] = [
  {
    id: 1,
    code: 'EFT-WI-01',
    name: 'EFT Terminal Wien 01',
    type: 'EFT',
    hwStationId: 1,
    managedByRemoteDeviceService: true,
    isOnline: true,
    href: `${DEVICE_BASE_PATH}/1`,
    '@type': 'Device',
  },
  {
    id: 2,
    code: 'EFT-WI-02',
    name: 'EFT Terminal Wien 02',
    type: 'EFT',
    hwStationId: 2,
    managedByRemoteDeviceService: true,
    isOnline: false,
    href: `${DEVICE_BASE_PATH}/2`,
    '@type': 'Device',
  },
  {
    id: 3,
    code: 'CASH-WI-01',
    name: 'Kassenschublade Wien 01',
    type: 'CASH_DRAWER',
    hwStationId: 1,
    managedByRemoteDeviceService: false,
    href: `${DEVICE_BASE_PATH}/3`,
    '@type': 'Device',
  },
  {
    id: 4,
    code: 'CASH-LZ-01',
    name: 'Kassenschublade Linz 01',
    type: 'CASH_DRAWER',
    hwStationId: 3,
    managedByRemoteDeviceService: false,
    href: `${DEVICE_BASE_PATH}/4`,
    '@type': 'Device',
  },
  {
    id: 5,
    code: 'PRT-WI-01',
    name: 'Belegdrucker Wien 01',
    type: 'PRINTER',
    hwStationId: 1,
    managedByRemoteDeviceService: true,
    isOnline: true,
    href: `${DEVICE_BASE_PATH}/5`,
    '@type': 'Device',
  },
  {
    id: 6,
    code: 'TABLET-WI-01',
    name: 'POS Tablet Wien 01',
    type: 'TABLET',
    hwStationId: 1,
    managedByRemoteDeviceService: true,
    isOnline: true,
    href: `${DEVICE_BASE_PATH}/6`,
    '@type': 'Device',
  },
  {
    id: 7,
    code: 'TABLET-LZ-01',
    name: 'POS Tablet Linz 01',
    type: 'TABLET',
    hwStationId: 3,
    managedByRemoteDeviceService: true,
    isOnline: true,
    href: `${DEVICE_BASE_PATH}/7`,
    '@type': 'Device',
  },
];

@Injectable({ providedIn: 'root' })
export class DeviceApiService implements OnInit {
  private readonly hardwareStationApi = inject(HardwareStationApiService);
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'device', DEVICE_BASE_PATH);
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
        await this.idb.initialize(DB_NAME, [
          { name: STORE_NAME, keyPath: 'id', autoIncrement: false },
        ]);

        // Seed initial data if store is empty
        const count = await firstValueFrom(this.idb.count(STORE_NAME));
        if (count === 0) {
          for (const device of INITIAL_DEVICES) {
            await firstValueFrom(this.idb.put(STORE_NAME, device));
          }
          nextDeviceId = Math.max(...INITIAL_DEVICES.map((d) => d.id)) + 1;
        } else {
          // Get max ID from existing devices
          const devices = await firstValueFrom(this.idb.getAll<Device>(STORE_NAME));
          nextDeviceId = Math.max(...devices.map((d) => d.id), 0) + 1;
        }
      } catch (error) {
        console.error('Failed to initialize device database:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  listDevices(filter?: { type?: DeviceType; hwStationId?: number }): Observable<Device[]> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({
              error: (err) => subscriber.error(err),
            });
            return;
          }

          const devices = await firstValueFrom(this.idb.getAll<Device>(STORE_NAME));
          let filtered = devices;

          if (filter?.type) {
            filtered = filtered.filter((d) => d.type === filter.type);
          }
          if (filter?.hwStationId !== undefined) {
            filtered = filtered.filter((d) => d.hwStationId === filter.hwStationId);
          }

          // Refresh simulated online status for managed devices
          filtered = filtered.map((d) =>
            d.managedByRemoteDeviceService ? { ...d, isOnline: simulateOnlineStatus() } : d
          );

          setTimeout(
            () => {
              subscriber.next(filtered);
              subscriber.complete();
            },
            simulateLatency()
          );
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  getDevice(deviceId: number): Observable<Device> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({
              error: (err) => subscriber.error(err),
            });
            return;
          }

          try {
            const device = await firstValueFrom(this.idb.get<Device>(STORE_NAME, deviceId));
            const result = device.managedByRemoteDeviceService
              ? { ...device, isOnline: simulateOnlineStatus() }
              : { ...device };

            setTimeout(
              () => {
                subscriber.next(result);
                subscriber.complete();
              },
              simulateLatency()
            );
          } catch (error) {
            const err = new Error(`Device ${deviceId} not found`) as Error & {
              status?: number;
            };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  createDevice(request: CreateDeviceRequest): Observable<Device> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({
              error: (err) => subscriber.error(err),
            });
            return;
          }

          try {
            await this.assertCodeUnique(request.code);

            const doCreate = async () => {
              const id = nextDeviceId++;
              const created: Device = {
                id,
                code: request.code,
                name: request.name,
                type: request.type,
                hwStationId: request.hwStationId,
                managedByRemoteDeviceService: request.managedByRemoteDeviceService ?? false,
                isOnline: request.managedByRemoteDeviceService ? simulateOnlineStatus() : undefined,
                href: `${DEVICE_BASE_PATH}/${id}`,
                '@type': 'Device',
              };
              await firstValueFrom(this.idb.put(STORE_NAME, created));
              return created;
            };

            let created: Device;
            if (request.hwStationId !== undefined) {
              await firstValueFrom(
                this.hardwareStationApi.getHardwareStation(request.hwStationId)
              );
              created = await doCreate();
            } else {
              created = await doCreate();
            }

            setTimeout(
              () => {
                subscriber.next(created);
                subscriber.complete();
              },
              simulateLatency()
            );
          } catch (error) {
            subscriber.error(error);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  updateDevice(deviceId: number, updates: UpdateDeviceRequest): Observable<Device> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({
              error: (err) => subscriber.error(err),
            });
            return;
          }

          try {
            const device = await firstValueFrom(this.idb.get<Device>(STORE_NAME, deviceId));

            if (updates.code !== undefined && updates.code !== device.code) {
              await this.assertCodeUnique(updates.code, deviceId);
              device.code = updates.code;
            }
            if (updates.name !== undefined) device.name = updates.name;
            if (updates.managedByRemoteDeviceService !== undefined) {
              device.managedByRemoteDeviceService = updates.managedByRemoteDeviceService;
              device.isOnline = updates.managedByRemoteDeviceService
                ? simulateOnlineStatus()
                : undefined;
            }

            let result: Device;
            if ('hwStationId' in updates) {
              if (updates.hwStationId === null) {
                device.hwStationId = undefined;
                await firstValueFrom(this.idb.put(STORE_NAME, device));
                result = { ...device };
              } else {
                await firstValueFrom(
                  this.hardwareStationApi.getHardwareStation(updates.hwStationId as number)
                );
                device.hwStationId = updates.hwStationId as number;
                await firstValueFrom(this.idb.put(STORE_NAME, device));
                result = { ...device };
              }
            } else {
              await firstValueFrom(this.idb.put(STORE_NAME, device));
              result = { ...device };
            }

            setTimeout(
              () => {
                subscriber.next(result);
                subscriber.complete();
              },
              simulateLatency()
            );
          } catch (error) {
            const err = new Error(`Device ${deviceId} not found`) as Error & {
              status?: number;
            };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  deleteDevice(deviceId: number): Observable<void> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({
              error: (err) => subscriber.error(err),
            });
            return;
          }

          try {
            await firstValueFrom(this.idb.get<Device>(STORE_NAME, deviceId));
            await firstValueFrom(this.idb.delete(STORE_NAME, deviceId));

            setTimeout(
              () => {
                subscriber.next(undefined);
                subscriber.complete();
              },
              simulateLatency()
            );
          } catch (error) {
            const err = new Error(`Device ${deviceId} not found`) as Error & {
              status?: number;
            };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  private async assertCodeUnique(code: string, excludeId?: number): Promise<void> {
    const devices = await firstValueFrom(this.idb.getAll<Device>(STORE_NAME));
    for (const device of devices) {
      if (device.code === code && device.id !== excludeId) {
        const err = new Error(`Device with code '${code}' already exists`) as Error & {
          status?: number;
        };
        err.status = 409;
        throw err;
      }
    }
  }
}
