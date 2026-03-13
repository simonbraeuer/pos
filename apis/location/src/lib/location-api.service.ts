import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, firstValueFrom, throwError } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import { CreateLocationRequest, Location, UpdateLocationRequest } from './models';


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
    const err = new Error('Location service temporarily unavailable') as Error & { status?: number };
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

let nextLocationId = 0;
const LOCATION_BASE_PATH = '/location/v1/location';
const STORE_NAME = 'locations';
const DB_NAME = 'pos-locations';

const INITIAL_LOCATIONS: Location[] = [
  {
    id: 1,
    code: 'WI-STORE-01',
    name: 'Wien Store 01',
    fullName: 'TMF Telco GmbH Shop Wien Mariahilfer Strasse',
    address: {
      street: 'Mariahilfer Strasse 18',
      postalCode: '1070',
      city: 'Wien',
      country: 'Austria',
    },
    href: `${LOCATION_BASE_PATH}/1`,
    '@type': 'Location',
  },
  {
    id: 2,
    code: 'LZ-STORE-01',
    name: 'Linz Store 01',
    fullName: 'TMF Telco GmbH Shop Linz Landstrasse',
    address: {
      street: 'Landstrasse 44',
      postalCode: '4020',
      city: 'Linz',
      country: 'Austria',
    },
    href: `${LOCATION_BASE_PATH}/2`,
    '@type': 'Location',
  },
  {
    id: 3,
    code: 'SZ-WH-01',
    name: 'Salzburg Warehouse 01',
    fullName: 'TMF Telco GmbH Lager Salzburg',
    address: {
      street: 'Muenchner Bundesstrasse 122',
      postalCode: '5020',
      city: 'Salzburg',
      country: 'Austria',
    },
    href: `${LOCATION_BASE_PATH}/3`,
    '@type': 'Location',
  },
];

@Injectable({ providedIn: 'root' })
export class LocationApiService implements OnInit {
  private idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'location', LOCATION_BASE_PATH);
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

        const count = await firstValueFrom(this.idb.count(STORE_NAME));
        if (count === 0) {
          for (const location of INITIAL_LOCATIONS) {
            await firstValueFrom(this.idb.put(STORE_NAME, location));
          }
          nextLocationId = Math.max(...INITIAL_LOCATIONS.map((l) => l.id)) + 1;
        } else {
          const locations = await firstValueFrom(this.idb.getAll<Location>(STORE_NAME));
          nextLocationId = Math.max(...locations.map((l) => l.id), 0) + 1;
        }
      } catch (error) {
        console.error('Failed to initialize location database:', error);
        throw error;
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  listLocations(): Observable<Location[]> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const locations = await firstValueFrom(this.idb.getAll<Location>(STORE_NAME));
          setTimeout(
            () => {
              subscriber.next(locations);
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

  getLocation(locationId: number): Observable<Location> {
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
            const location = await firstValueFrom(this.idb.get<Location>(STORE_NAME, locationId));
            setTimeout(
              () => {
                subscriber.next(location);
                subscriber.complete();
              },
              simulateLatency()
            );
          } catch {
            const err = new Error(`Location ${locationId} not found`) as Error & {
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

  createLocation(request: CreateLocationRequest): Observable<Location> {
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
            await this.assertCodeUnique(request.code);
            const id = nextLocationId++;
            const created: Location = {
              id,
              code: request.code,
              name: request.name,
              fullName: request.fullName,
              address: request.address,
              href: `${LOCATION_BASE_PATH}/${id}`,
              '@type': 'Location',
            };

            await firstValueFrom(this.idb.put(STORE_NAME, created));
            setTimeout(
              () => {
                subscriber.next(created);
                subscriber.complete();
              },
              simulateLatency()
            );
          } catch {
            subscriber.error(error);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  updateLocation(locationId: number, updates: UpdateLocationRequest): Observable<Location> {
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
            const location = await firstValueFrom(this.idb.get<Location>(STORE_NAME, locationId));

            if (updates.code !== undefined && updates.code !== location.code) {
              await this.assertCodeUnique(updates.code, locationId);
              location.code = updates.code;
            }
            if (updates.name !== undefined) {
              location.name = updates.name;
            }
            if (updates.fullName !== undefined) {
              location.fullName = updates.fullName;
            }
            if (updates.address !== undefined) {
              location.address = updates.address;
            }

            await firstValueFrom(this.idb.put(STORE_NAME, location));
            setTimeout(
              () => {
                subscriber.next(location);
                subscriber.complete();
              },
              simulateLatency()
            );
          } catch {
            const err = new Error(`Location ${locationId} not found`) as Error & {
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

  deleteLocation(locationId: number): Observable<void> {
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
            await firstValueFrom(this.idb.get<Location>(STORE_NAME, locationId));
            await firstValueFrom(this.idb.delete(STORE_NAME, locationId));
            setTimeout(
              () => {
                subscriber.next(undefined);
                subscriber.complete();
              },
              simulateLatency()
            );
          } catch {
            const err = new Error(`Location ${locationId} not found`) as Error & {
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
    const locations = await firstValueFrom(this.idb.getAll<Location>(STORE_NAME));
    const duplicate = locations.some(
      (location) => location.code === code && location.id !== ignoreId
    );
    if (duplicate) {
      const err = new Error(`Location code '${code}' already exists`) as Error & {
        status?: number;
      };
      err.status = 409;
      throw err;
    }
  }
}
