import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { DeviceApiService, DeviceType } from '@pos/device';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import {
  PaymentMethod,
  CreatePaymentMethodRequest,
  UpdatePaymentMethodRequest,
  PaymentMethodSearchCriteria,
  PaginatedPaymentMethodResults,
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
    const err = new Error('Payment Method service temporarily unavailable') as Error & { status?: number };
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

function generatePaymentMethodId(): string {
  return `pm-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

const STORE_NAME = 'payment-methods';
const DB_NAME = 'pos-tmf670-payment-methods';

const INITIAL_PAYMENT_METHODS: PaymentMethod[] = [
  {
    id: 'pm-cash',
    href: '/paymentMethod/v4/paymentMethod/pm-cash',
    name: 'Cash',
    description: 'Cash payment at point of sale',
    type: 'cash',
    status: 'active',
    isPreferred: false,
    authorizationMode: 'offline',
    requiresHardware: false,
    deviceId: 3,
  },
  {
    id: 'pm-card-001',
    href: '/paymentMethod/v4/paymentMethod/pm-card-001',
    name: 'Visa **** 1234',
    description: 'Primary credit card',
    type: 'creditCard',
    status: 'active',
    isPreferred: true,
    validFor: {
      endDateTime: '2026-12-31T23:59:59Z',
    },
    card: {
      id: 'card-001',
      brand: 'Visa',
      cardNumber: '**** **** **** 1234',
      expiryDate: '12/26',
      cardHolder: 'Johannes Müller',
      cardType: 'credit',
    },
    relatedParty: [
      {
        id: 'cust-001',
        name: 'Johannes Müller',
        role: 'customer',
        '@referredType': 'Individual',
      },
    ],
    authorizationMode: 'offline',
    requiresHardware: true,
    deviceId: 1,
  },
  {
    id: 'pm-card-002',
    href: '/paymentMethod/v4/paymentMethod/pm-card-002',
    name: 'Mastercard **** 5678',
    description: 'Secondary debit card',
    type: 'debitCard',
    status: 'active',
    isPreferred: false,
    validFor: {
      endDateTime: '2027-06-30T23:59:59Z',
    },
    card: {
      id: 'card-002',
      brand: 'Mastercard',
      cardNumber: '**** **** **** 5678',
      expiryDate: '06/27',
      cardHolder: 'Johannes Müller',
      cardType: 'debit',
    },
    relatedParty: [
      {
        id: 'cust-001',
        name: 'Johannes Müller',
        role: 'customer',
        '@referredType': 'Individual',
      },
    ],
    authorizationMode: 'offline',
    requiresHardware: true,
  },
  {
    id: 'pm-bank-001',
    href: '/paymentMethod/v4/paymentMethod/pm-bank-001',
    name: 'Bank Transfer - Main Account',
    description: 'SEPA bank transfer',
    type: 'bankTransfer',
    status: 'active',
    isPreferred: false,
    bankAccount: {
      id: 'ba-001',
      iban: 'AT611904300234573201',
      bic: 'GIBAATWWXXX',
      accountHolder: 'TMF Telco GmbH',
    },
    relatedParty: [
      {
        id: 'cust-002',
        name: 'TMF Telco GmbH',
        role: 'customer',
        '@referredType': 'Organization',
      },
    ],
    authorizationMode: 'online',
    requiresHardware: false,
  },
  {
    id: 'pm-wallet-001',
    href: '/paymentMethod/v4/paymentMethod/pm-wallet-001',
    name: 'PayPal Account',
    description: 'Digital wallet payment',
    type: 'digitalWallet',
    status: 'active',
    isPreferred: false,
    digitalWallet: {
      id: 'wallet-001',
      provider: 'PayPal',
      accountEmail: 'johannes.mueller@abc-gmbh.at',
    },
    relatedParty: [
      {
        id: 'cust-001',
        name: 'Johannes Müller',
        role: 'customer',
        '@referredType': 'Individual',
      },
    ],
    authorizationMode: 'online',
    requiresHardware: false,
  },
];

@Injectable({ providedIn: 'root' })
export class Tmf670ApiService implements OnInit {
  private readonly deviceApi = inject(DeviceApiService);
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'tmf670', '/paymentMethod/v4/paymentMethod');
  }

  ngOnInit(): void {
    this.initializeDb();
  }

  private initializeDb(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      await this.idb.initialize(DB_NAME, [{ name: STORE_NAME, keyPath: 'id', autoIncrement: false }]);
      const count = await firstValueFrom(this.idb.count(STORE_NAME));
      if (count === 0) {
        for (const item of INITIAL_PAYMENT_METHODS) {
          await firstValueFrom(this.idb.put(STORE_NAME, item));
        }
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  createPaymentMethod(request: CreatePaymentMethodRequest): Observable<PaymentMethod> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const paymentMethodId = generatePaymentMethodId();
          let card: PaymentMethod['card'];
          if (request.card) {
            const cardId = `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            card = { id: cardId, href: `/paymentMethod/v4/card/${cardId}`, ...request.card };
          }

          let digitalWallet: PaymentMethod['digitalWallet'];
          if (request.digitalWallet) {
            const walletId = `wallet-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            digitalWallet = {
              id: walletId,
              href: `/paymentMethod/v4/digitalWallet/${walletId}`,
              ...request.digitalWallet,
            };
          }

          await this.validateDeviceMapping(request.type, request.deviceId);

          const paymentMethod: PaymentMethod = {
            id: paymentMethodId,
            href: `/paymentMethod/v4/paymentMethod/${paymentMethodId}`,
            name: request.name,
            description: request.description,
            type: request.type,
            status: 'active',
            isPreferred: request.isPreferred,
            validFor: request.validFor,
            relatedParty: request.relatedParty,
            bankAccount: request.bankAccount,
            card,
            digitalWallet,
            authorizationCode: request.authorizationCode,
            authorizationMode: request.authorizationMode,
            requiresHardware: request.requiresHardware,
            deviceId: request.deviceId,
            '@type': 'PaymentMethod',
          };

          await firstValueFrom(this.idb.put(STORE_NAME, paymentMethod));
          setTimeout(() => {
            subscriber.next(paymentMethod);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  getPaymentMethod(paymentMethodId: string): Observable<PaymentMethod> {
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
            const paymentMethod = await firstValueFrom(this.idb.get<PaymentMethod>(STORE_NAME, paymentMethodId));
            setTimeout(() => {
              subscriber.next(paymentMethod);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Payment method ${paymentMethodId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  searchPaymentMethods(
    criteria: PaymentMethodSearchCriteria = {},
    page = 0,
    pageSize = 10
  ): Observable<PaginatedPaymentMethodResults> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let paymentMethods = await firstValueFrom(this.idb.getAll<PaymentMethod>(STORE_NAME));

          if (criteria.type) {
            paymentMethods = paymentMethods.filter((pm) => pm.type === criteria.type);
          }
          if (criteria.status) {
            paymentMethods = paymentMethods.filter((pm) => pm.status === criteria.status);
          }
          if (criteria.isPreferred !== undefined) {
            paymentMethods = paymentMethods.filter((pm) => pm.isPreferred === criteria.isPreferred);
          }
          if (criteria.customerId) {
            paymentMethods = paymentMethods.filter((pm) =>
              pm.relatedParty?.some((rp) => rp.role === 'customer' && rp.id === criteria.customerId)
            );
          }

          paymentMethods.sort((a, b) => {
            if (a.isPreferred && !b.isPreferred) return -1;
            if (!a.isPreferred && b.isPreferred) return 1;
            return a.name.localeCompare(b.name);
          });

          const total = paymentMethods.length;
          const start = page * pageSize;
          const end = start + pageSize;
          const items = paymentMethods.slice(start, end);

          const result: PaginatedPaymentMethodResults = {
            items,
            total,
            page,
            pageSize,
            hasMore: end < total,
          };

          setTimeout(() => {
            subscriber.next(result);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  updatePaymentMethod(
    paymentMethodId: string,
    request: UpdatePaymentMethodRequest
  ): Observable<PaymentMethod> {
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
            const paymentMethod = await firstValueFrom(this.idb.get<PaymentMethod>(STORE_NAME, paymentMethodId));
            const { deviceId, ...safeRequest } = request;
            const updated: PaymentMethod = {
              ...paymentMethod,
              ...safeRequest,
            };

            await this.validateDeviceMapping(paymentMethod.type, deviceId);

            if (deviceId === null) {
              delete updated.deviceId;
            } else if (deviceId !== undefined) {
              updated.deviceId = deviceId;
            }

            await firstValueFrom(this.idb.put(STORE_NAME, updated));
            setTimeout(() => {
              subscriber.next(updated);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Payment method ${paymentMethodId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  deletePaymentMethod(paymentMethodId: string): Observable<void> {
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
            await firstValueFrom(this.idb.get<PaymentMethod>(STORE_NAME, paymentMethodId));
            await firstValueFrom(this.idb.delete(STORE_NAME, paymentMethodId));
            setTimeout(() => {
              subscriber.next(undefined);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Payment method ${paymentMethodId} not found`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  private async validateDeviceMapping(
    paymentType: PaymentMethod['type'],
    deviceId: number | null | undefined
  ): Promise<void> {
    if (deviceId === undefined || deviceId === null) {
      return;
    }

    const expectedDeviceType = this.expectedDeviceTypeForPaymentType(paymentType);
    if (!expectedDeviceType) {
      const err = new Error(
        `Payment method type '${paymentType}' does not support device mapping`
      ) as Error & { status?: number };
      err.status = 400;
      throw err;
    }

    const device = await firstValueFrom(this.deviceApi.getDevice(deviceId));
    if (device.type !== expectedDeviceType) {
      const err = new Error(
        `Invalid device type '${device.type}' for payment method type '${paymentType}'. Expected '${expectedDeviceType}'.`
      ) as Error & { status?: number };
      err.status = 400;
      throw err;
    }
  }

  private expectedDeviceTypeForPaymentType(paymentType: PaymentMethod['type']): DeviceType | null {
    if (paymentType === 'cash') return 'CASH_DRAWER';
    if (paymentType === 'creditCard' || paymentType === 'debitCard') return 'EFT';
    return null;
  }
}
