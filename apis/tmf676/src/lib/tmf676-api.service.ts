import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import { autoFinalizeOrderIfFullyPaid } from '@pos/tmf622';
import {
  CreatePaymentRequest,
  PaginatedPaymentResults,
  Payment,
  PaymentSearchCriteria,
  UpdatePaymentRequest,
  PaymentMethodRef,
} from './models';
import { Tmf676EventsService } from './tmf676-events.service';


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
    const err = new Error('Payment service temporarily unavailable') as any;
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

/** Generate unique payment ID */
function generatePaymentId(): string {
  return `payment-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function isSettledPaymentStatus(status?: Payment['status']): boolean {
  return status === 'completed' || status === 'authorized';
}

function isRefundPayment(payment: Partial<Payment>): boolean {
  if (payment.isRefund === true) {
    return true;
  }

  if (payment.originalPaymentId) {
    return true;
  }

  return (payment.amount?.value || 0) < 0;
}

function withRefundFlag(payment: Payment): Payment {
  return {
    ...payment,
    isRefund: isRefundPayment(payment),
  };
}

/** Configurable payment methods registry */
export const PAYMENT_METHODS: Map<string, PaymentMethodRef> = new Map([
  [
    'pm-cash',
    {
      id: 'pm-cash',
      name: 'Cash',
      '@referredType': 'Cash',
      authorizationMode: 'offline',
      requiresHardware: false,
    },
  ],
  [
    'pm-001',
    {
      id: 'pm-001',
      name: 'Visa **** 1234',
      '@referredType': 'CreditCard',
      authorizationMode: 'online',
      requiresHardware: true,
    },
  ],
  [
    'pm-002',
    {
      id: 'pm-002',
      name: 'Bank Transfer',
      '@referredType': 'BankAccount',
      authorizationMode: 'online',
      requiresHardware: false,
    },
  ],
  [
    'pm-debit',
    {
      id: 'pm-debit',
      name: 'Debit Card',
      '@referredType': 'DebitCard',
      authorizationMode: 'online',
      requiresHardware: true,
    },
  ],
  [
    'pm-check',
    {
      id: 'pm-check',
      name: 'Check',
      '@referredType': 'Check',
      authorizationMode: 'offline',
      requiresHardware: false,
    },
  ],
]);

/** Get payment method by ID with all configured properties */
function getPaymentMethod(id: string): PaymentMethodRef | undefined {
  return PAYMENT_METHODS.get(id);
}

/** Initial payment seed data */
const INITIAL_PAYMENTS: Payment[] = Array.from(new Map<string, Payment>([
  [
    'payment-2024-001',
    {
      id: 'payment-2024-001',
      href: '/paymentManagement/v4/payment/payment-2024-001',
      externalId: 'order-2024-001', // Linked to order-2024-001
      status: 'completed',
      paymentDate: '2024-03-04T11:15:00Z',
      completionDate: '2024-03-04T11:16:10Z',
      amount: { unit: 'EUR', value: 200.00 },
      receivedAmount: { unit: 'EUR', value: 200.00 },
      remainingAmount: { unit: 'EUR', value: 0 },
      description: 'First payment - Cash',
      paymentMethod: getPaymentMethod('pm-cash'),
      relatedParty: [
        {
          id: 'cust-001',
          name: 'Johannes Müller',
          role: 'customer',
          '@referredType': 'Individual',
        },
      ],
      paymentItem: [
        {
          id: 'item-001',
          amount: { unit: 'EUR', value: 200.00 },
          appliedAmount: { unit: 'EUR', value: 200.00 },
          status: 'completed',
          billingAccount: {
            id: 'ba-001',
            name: 'Main Billing Account',
          },
          paymentDate: '2024-03-04T11:15:00Z',
          description: 'Cash payment',
        },
      ],
      note: [
        {
          id: '1',
          author: 'teleop1',
          date: '2024-03-04T11:16:10Z',
          text: 'Zahlung erfolgreich erfasst',
        },
      ],
    },
  ],
  [
    'payment-2024-001-b',
    {
      id: 'payment-2024-001-b',
      href: '/paymentManagement/v4/payment/payment-2024-001-b',
      externalId: 'order-2024-001', // Linked to same order
      status: 'completed',
      paymentDate: '2024-03-04T11:18:00Z',
      completionDate: '2024-03-04T11:18:30Z',
      amount: { unit: 'EUR', value: 99.99 },
      receivedAmount: { unit: 'EUR', value: 99.99 },
      remainingAmount: { unit: 'EUR', value: 0 },
      description: 'Second payment - Card',
      paymentMethod: getPaymentMethod('pm-001'),
      relatedParty: [
        {
          id: 'cust-001',
          name: 'Johannes Müller',
          role: 'customer',
          '@referredType': 'Individual',
        },
      ],
      paymentItem: [
        {
          id: 'item-001',
          amount: { unit: 'EUR', value: 99.99 },
          appliedAmount: { unit: 'EUR', value: 99.99 },
          status: 'completed',
          billingAccount: {
            id: 'ba-001',
            name: 'Main Billing Account',
          },
          paymentDate: '2024-03-04T11:18:00Z',
          description: 'Card payment',
        },
      ],
      note: [
        {
          id: '1',
          author: 'cashier-01',
          date: '2024-03-04T11:18:30Z',
          text: 'Card payment authorized and captured',
        },
      ],
    },
  ],
  [
    'payment-2024-002',
    {
      id: 'payment-2024-002',
      href: '/paymentManagement/v4/payment/payment-2024-002',
      externalId: 'order-2024-002',
      status: 'pending',
      paymentDate: '2024-03-08T09:40:00Z',
      amount: { unit: 'EUR', value: 129.0 },
      receivedAmount: { unit: 'EUR', value: 0 },
      remainingAmount: { unit: 'EUR', value: 129.0 },
      description: 'Payment pending - Bank Transfer',
      paymentMethod: getPaymentMethod('pm-002'),
      relatedParty: [
        {
          id: 'cust-002',
          name: 'Tech Solutions Inc',
          role: 'customer',
          '@referredType': 'Organization',
        },
      ],
      paymentItem: [
        {
          id: 'item-001',
          amount: { unit: 'EUR', value: 129.0 },
          appliedAmount: { unit: 'EUR', value: 0 },
          status: 'pending',
          billingAccount: {
            id: 'ba-002',
            name: 'Business Account',
          },
          paymentDate: '2024-03-08T09:40:00Z',
          description: 'Invoice INV-202403-0002',
        },
      ],
      note: [
        {
          id: '1',
          author: 'system',
          date: '2024-03-08T09:40:00Z',
          text: 'Waiting for transfer settlement',
        },
      ],
    },
  ],
]).values());

const STORE_NAME = 'payments';
const DB_NAME = 'pos-tmf676-payments';

/**
 * TMF-676 Payment Management API Service
 *
 * Provides access to payment lifecycle management operations
 * following the TMForum TMF-676 standard.
 */
@Injectable({ providedIn: 'root' })
export class Tmf676ApiService implements OnInit {
  private readonly paymentEvents = inject(Tmf676EventsService);
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'tmf676', '/paymentManagement/v4/payment');
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
        for (const payment of INITIAL_PAYMENTS) {
          await firstValueFrom(this.idb.put(STORE_NAME, payment));
        }
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  private async syncOrderFinalization(orderId?: string): Promise<void> {
    if (!orderId) {
      return;
    }

    const payments = await firstValueFrom(this.idb.getAll<Payment>(STORE_NAME));
    const paidAmount = payments
      .filter((payment) => payment.externalId === orderId && isSettledPaymentStatus(payment.status))
      .reduce((sum, payment) => sum + (payment.amount?.value || 0), 0);

    autoFinalizeOrderIfFullyPaid(orderId, paidAmount, 'tmf676');
  }

  /**
   * Create a new payment
   */
  createPayment(request: CreatePaymentRequest): Observable<Payment> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const paymentId = generatePaymentId();
          const now = new Date().toISOString();
          const payment: Payment = {
            id: paymentId,
            href: `/paymentManagement/v4/payment/${paymentId}`,
            externalId: request.externalId,
            status: 'pending',
            paymentDate: request.paymentDate || now,
            amount: request.amount,
            isRefund: request.isRefund ?? (!!request.originalPaymentId || request.amount.value < 0),
            receivedAmount: { unit: request.amount.unit, value: 0 },
            remainingAmount: { unit: request.amount.unit, value: request.amount.value },
            description: request.description,
            originalPaymentId: request.originalPaymentId,
            paymentMethod: request.paymentMethod,
            relatedParty: request.relatedParty,
            paymentItem: request.paymentItem?.map((item) => ({
              ...item,
              appliedAmount: { unit: item.amount.unit, value: 0 },
              status: 'pending',
            })),
            note: [
              {
                id: '1',
                author: 'system',
                date: now,
                text: 'Payment initialized',
              },
            ],
          };

          const normalizedPayment = withRefundFlag(payment);
          await firstValueFrom(this.idb.put(STORE_NAME, normalizedPayment));
          this.paymentEvents.emitPaymentCreated(normalizedPayment);

          if (request.originalPaymentId) {
            try {
              const originalPayment = await firstValueFrom(this.idb.get<Payment>(STORE_NAME, request.originalPaymentId));
              const refundedPayment: Payment = {
                ...originalPayment,
                status: 'refunded',
                note: [
                  ...(originalPayment.note || []),
                  {
                    id: String((originalPayment.note?.length || 0) + 1),
                    author: 'system',
                    date: now,
                    text: `Refunded by payment ${paymentId}`,
                  },
                ],
              };
              await firstValueFrom(this.idb.put(STORE_NAME, refundedPayment));
              this.paymentEvents.emitPaymentUpdated(withRefundFlag(refundedPayment), 'Payment refunded');
            } catch {
              // ignore missing original payment for backward compatibility
            }
          }

          await this.syncOrderFinalization(normalizedPayment.externalId);
          setTimeout(() => {
            subscriber.next(normalizedPayment);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Retrieve a payment by ID
   */
  getPayment(paymentId: string): Observable<Payment> {
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
            const payment = await firstValueFrom(this.idb.get<Payment>(STORE_NAME, paymentId));
            setTimeout(() => {
              subscriber.next(withRefundFlag({ ...payment }));
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const notFoundError = new Error(`Payment ${paymentId} not found`) as Error & { status?: number };
            notFoundError.status = 404;
            subscriber.error(notFoundError);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Search/list payments with criteria
   */
  searchPayments(
    criteria: PaymentSearchCriteria = {},
    page = 0,
    pageSize = 10
  ): Observable<PaginatedPaymentResults> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let payments = await firstValueFrom(this.idb.getAll<Payment>(STORE_NAME));

    if (criteria.status) {
      payments = payments.filter((p) => p.status === criteria.status);
    }

    if (criteria.externalId) {
      const extIdLower = criteria.externalId.toLowerCase();
      payments = payments.filter((p) => p.externalId?.toLowerCase().includes(extIdLower));
    }

    if (criteria.billingAccountId) {
      payments = payments.filter((p) =>
        p.paymentItem?.some((i) => i.billingAccount?.id === criteria.billingAccountId)
      );
    }

    if (criteria.customerId) {
      payments = payments.filter((p) =>
        p.relatedParty?.some((rp) => rp.role === 'customer' && rp.id === criteria.customerId)
      );
    }

    if (criteria.paymentDateFrom) {
      payments = payments.filter((p) => p.paymentDate && p.paymentDate >= criteria.paymentDateFrom!);
    }

    if (criteria.paymentDateTo) {
      payments = payments.filter((p) => p.paymentDate && p.paymentDate <= criteria.paymentDateTo!);
    }

    payments.sort((a, b) => (b.paymentDate || '').localeCompare(a.paymentDate || ''));

    const total = payments.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = payments.slice(start, end).map(withRefundFlag);
    const hasMore = end < total;

          setTimeout(() => {
            subscriber.next({
              items,
              total,
              page,
              pageSize,
              hasMore,
            });
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Update payment status/details
   */
  updatePayment(paymentId: string, request: UpdatePaymentRequest): Observable<Payment> {
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
            const payment = await firstValueFrom(this.idb.get<Payment>(STORE_NAME, paymentId));
            const updated: Payment = {
              ...payment,
              isRefund: isRefundPayment(payment),
              status: request.status ?? payment.status,
              completionDate: request.completionDate ?? payment.completionDate,
              description: request.description ?? payment.description,
              remainingAmount: request.remainingAmount ?? payment.remainingAmount,
              note: [
                ...(payment.note || []),
                {
                  id: String((payment.note?.length || 0) + 1),
                  author: 'system',
                  date: new Date().toISOString(),
                  text: `Payment updated${request.status ? ` to ${request.status}` : ''}`,
                },
              ],
            };

            const normalizedUpdated = withRefundFlag(updated);
            await firstValueFrom(this.idb.put(STORE_NAME, normalizedUpdated));
            this.paymentEvents.emitPaymentUpdated(
              normalizedUpdated,
              request.status ? `Payment updated to ${request.status}` : 'Payment updated'
            );
            await this.syncOrderFinalization(normalizedUpdated.externalId);

            setTimeout(() => {
              subscriber.next(normalizedUpdated);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const notFoundError = new Error(`Payment ${paymentId} not found`) as Error & { status?: number };
            notFoundError.status = 404;
            subscriber.error(notFoundError);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Cancel payment
   */
  cancelPayment(paymentId: string, reason?: string): Observable<Payment> {
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
            const payment = await firstValueFrom(this.idb.get<Payment>(STORE_NAME, paymentId));
            if (payment.status === 'completed' || payment.status === 'refunded') {
              const conflictError = new Error(`Cannot cancel payment in ${payment.status} state`) as Error & {
                status?: number;
              };
              conflictError.status = 409;
              subscriber.error(conflictError);
              return;
            }

            const cancelled: Payment = {
              ...payment,
              isRefund: isRefundPayment(payment),
              status: 'cancelled',
              note: [
                ...(payment.note || []),
                {
                  id: String((payment.note?.length || 0) + 1),
                  author: 'system',
                  date: new Date().toISOString(),
                  text: reason || 'Payment cancelled',
                },
              ],
            };

            const normalizedCancelled = withRefundFlag(cancelled);
            await firstValueFrom(this.idb.put(STORE_NAME, normalizedCancelled));
            this.paymentEvents.emitPaymentCancelled(normalizedCancelled, reason || 'Payment cancelled');
            await this.syncOrderFinalization(normalizedCancelled.externalId);

            setTimeout(() => {
              subscriber.next(normalizedCancelled);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const notFoundError = new Error(`Payment ${paymentId} not found`) as Error & { status?: number };
            notFoundError.status = 404;
            subscriber.error(notFoundError);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
