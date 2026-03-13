import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import { LocationApiService } from '@pos/location';
import {
  CreateHardwareStationRequest,
  HardwareStation,
  UpdateHardwareStationRequest,
} from './models';


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
    const err = new Error('Hardware Station service temporarily unavailable') as Error & { status?: number };
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

let nextHardwareStationId = 0;
const HARDWARE_STATION_BASE_PATH = '/hardwareStation/v1/hardwareStation';
const STORE_NAME = 'hardware-stations';
const DB_NAME = 'pos-hardware-stations';

const INITIAL_HARDWARE_STATIONS: HardwareStation[] = [
  {
    id: 1,
    code: 'HWS-WI-01',
    name: 'Wien Station 01',
    locationId: 1,
    href: `${HARDWARE_STATION_BASE_PATH}/1`,
    '@type': 'HardwareStation',
  },
  {
    id: 2,
    code: 'HWS-WI-02',
    name: 'Wien Station 02',
    locationId: 1,
    href: `${HARDWARE_STATION_BASE_PATH}/2`,
    '@type': 'HardwareStation',
  },
  {
    id: 3,
    code: 'HWS-LZ-01',
    name: 'Linz Station 01',
    locationId: 2,
    href: `${HARDWARE_STATION_BASE_PATH}/3`,
    '@type': 'HardwareStation',
  },
];

@Injectable({ providedIn: 'root' })
export class HardwareStationApiService implements OnInit {
  private readonly locationApi = inject(LocationApiService);
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'hardware-station', HARDWARE_STATION_BASE_PATH);
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
          for (const station of INITIAL_HARDWARE_STATIONS) {
            await firstValueFrom(this.idb.put(STORE_NAME, station));
          }
          nextHardwareStationId = Math.max(...INITIAL_HARDWARE_STATIONS.map((s) => s.id)) + 1;
        } else {
          const stations = await firstValueFrom(this.idb.getAll<HardwareStation>(STORE_NAME));
          nextHardwareStationId = Math.max(...stations.map((s) => s.id), 0) + 1;
        }
      } catch (error) {
        console.error('Failed to initialize hardware-station database:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  listHardwareStations(): Observable<HardwareStation[]> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const stations = await firstValueFrom(this.idb.getAll<HardwareStation>(STORE_NAME));
          setTimeout(() => {
            subscriber.next(stations);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  getHardwareStation(hardwareStationId: number): Observable<HardwareStation> {
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
            const station = await firstValueFrom(this.idb.get<HardwareStation>(STORE_NAME, hardwareStationId));
            setTimeout(() => {
              subscriber.next(station);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Hardware station ${hardwareStationId} not found`) as Error & {
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

  createHardwareStation(request: CreateHardwareStationRequest): Observable<HardwareStation> {
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
          await firstValueFrom(this.locationApi.getLocation(request.locationId));

          const id = nextHardwareStationId++;
          const created: HardwareStation = {
            id,
            code: request.code,
            name: request.name,
            locationId: request.locationId,
            href: `${HARDWARE_STATION_BASE_PATH}/${id}`,
            '@type': 'HardwareStation',
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

  updateHardwareStation(
    hardwareStationId: number,
    updates: UpdateHardwareStationRequest
  ): Observable<HardwareStation> {
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
            const station = await firstValueFrom(this.idb.get<HardwareStation>(STORE_NAME, hardwareStationId));

            if (updates.code !== undefined && updates.code !== station.code) {
              await this.assertCodeUnique(updates.code, hardwareStationId);
              station.code = updates.code;
            }
            if (updates.name !== undefined) {
              station.name = updates.name;
            }
            if (updates.locationId !== undefined && updates.locationId !== station.locationId) {
              await firstValueFrom(this.locationApi.getLocation(updates.locationId));
              station.locationId = updates.locationId;
            }

            await firstValueFrom(this.idb.put(STORE_NAME, station));
            setTimeout(() => {
              subscriber.next(station);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Hardware station ${hardwareStationId} not found`) as Error & {
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

  deleteHardwareStation(hardwareStationId: number): Observable<void> {
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
            await firstValueFrom(this.idb.get<HardwareStation>(STORE_NAME, hardwareStationId));
            await firstValueFrom(this.idb.delete(STORE_NAME, hardwareStationId));
            setTimeout(() => {
              subscriber.next(undefined);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Hardware station ${hardwareStationId} not found`) as Error & {
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

  private async assertCodeUnique(code: string, ignoreId?: number): Promise<void> {
    const stations = await firstValueFrom(this.idb.getAll<HardwareStation>(STORE_NAME));
    const duplicate = stations.some((station) => station.code === code && station.id !== ignoreId);
    if (duplicate) {
      const err = new Error(`Hardware station code '${code}' already exists`) as Error & {
        status?: number;
      };
      err.status = 409;
      throw err;
    }
  }
}
