import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import {
  ProductOrder,
  ProductOrderItem,
  ProductOrderState,
  CreateProductOrderRequest,
  UpdateProductOrderRequest,
  CancelProductOrderRequest,
  ProductOrderSearchCriteria,
  PaginatedOrderResults,
  OrderPrice,
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
    const err = new Error('Product Order service temporarily unavailable') as any;
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

/** Generate unique order ID */
function generateOrderId(): string {
  return `order-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Initial product order seed data */
const INITIAL_PRODUCT_ORDERS: ProductOrder[] = Array.from(new Map<string, ProductOrder>([
  [
    'order-2024-001',
    {
      id: 'order-2024-001',
      href: '/productOrderingManagement/v4/productOrder/order-2024-001',
      externalId: 'EXT-ORD-2024-001',
      state: 'completed',
      category: 'retail',
      priority: 'normal',
      description: 'Smartphone und Zubehör Bestellung für Geschäftskunde',
      orderDate: '2024-03-01T10:30:00Z',
      completionDate: '2024-03-05T14:22:00Z',
      requestedStartDate: '2024-03-01T10:30:00Z',
      requestedCompletionDate: '2024-03-05T18:00:00Z',
      expectedCompletionDate: '2024-03-05T18:00:00Z',
      notificationContact: 'mueller@tmf-telco.at',
      relatedParty: [
        {
          id: 'cust-001',
          name: 'Johannes Müller',
          role: 'customer',
          '@referredType': 'Individual',
        },
      ],
      productOrderItem: [
        {
          id: '1',
          quantity: 1,
          action: 'add',
          state: 'completed',
          productOffering: {
            id: 'offer-prod-mobile-phone-01',
            name: 'Premium Smartphone 5G',
          },
          product: {
            id: 'prod-phone-001',
            name: 'Premium Smartphone 5G',
            productSerialNumber: 'SER-MOB-001',
          },
          itemPrice: [
            {
              name: 'One-time purchase',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 249.99 },
                taxIncludedAmount: { unit: 'EUR', value: 299.99 },
                taxRate: 20,
              },
            },
          ],
          itemTotalPrice: [
            {
              name: 'Total',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 249.99 },
                taxIncludedAmount: { unit: 'EUR', value: 299.99 },
                taxRate: 20,
              },
            },
          ],
        },
        {
          id: '2',
          quantity: 1,
          action: 'add',
          state: 'completed',
          productOffering: {
            id: 'offer-prod-phone-case-01',
            name: 'Business Smartphone Schutzbundle',
          },
          product: {
            id: 'prod-case-001',
            name: 'Business Smartphone Schutzbundle',
          },
          itemPrice: [
            {
              name: 'One-time purchase',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 12.49 },
                taxIncludedAmount: { unit: 'EUR', value: 14.99 },
                taxRate: 20,
              },
            },
          ],
          itemTotalPrice: [
            {
              name: 'Total',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 12.49 },
                taxIncludedAmount: { unit: 'EUR', value: 14.99 },
                taxRate: 20,
              },
            },
          ],
        },
      ],
      orderTotalPrice: [
        {
          name: 'Order Total',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 262.48 },
            taxIncludedAmount: { unit: 'EUR', value: 314.98 },
            taxRate: 20,
          },
        },
      ],
      note: [
        {
          id: '1',
          author: 'system',
          date: '2024-03-01T10:30:00Z',
          text: 'Order created from shopping cart cart-001',
        },
        {
          id: '2',
          author: 'system',
          date: '2024-03-05T14:22:00Z',
          text: 'Order completed and ready for pickup',
        },
      ],
    },
  ],
  [
    'order-2024-002',
    {
      id: 'order-2024-002',
      href: '/productOrderingManagement/v4/productOrder/order-2024-002',
      externalId: 'EXT-ORD-2024-002',
      state: 'inProgress',
      category: 'business',
      priority: 'high',
      description: 'Enterprise Netzwerk-Equipment Bestellung für Großkundenvertrag',
      orderDate: '2024-03-08T09:15:00Z',
      requestedStartDate: '2024-03-08T09:15:00Z',
      requestedCompletionDate: '2024-03-12T17:00:00Z',
      expectedCompletionDate: '2024-03-11T17:00:00Z',
      notificationContact: 'it@abc-gmbh.at',
      relatedParty: [
        {
          id: 'cust-002',
          name: 'TMF Telco GmbH',
          role: 'customer',
          '@referredType': 'Organization',
        },
      ],
      productOrderItem: [
        {
          id: '1',
          quantity: 1,
          action: 'add',
          state: 'inProgress',
          productOffering: {
            id: 'offer-prod-broadband-router-01',
            name: 'ASTL-10G Glasfaser-Router',
          },
          product: {
            id: 'prod-router-001',
            name: 'ASTL-10G Glasfaser-Router',
            productSerialNumber: 'SER-RTR-5G-0001',
          },
          itemPrice: [
            {
              name: 'One-time purchase',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 107.5 },
                taxIncludedAmount: { unit: 'EUR', value: 129.0 },
                taxRate: 20,
              },
            },
          ],
          itemTotalPrice: [
            {
              name: 'Total',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 107.5 },
                taxIncludedAmount: { unit: 'EUR', value: 129.0 },
                taxRate: 20,
              },
            },
          ],
        },
      ],
      orderTotalPrice: [
        {
          name: 'Order Total',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 107.5 },
            taxIncludedAmount: { unit: 'EUR', value: 129.0 },
            taxRate: 20,
          },
        },
      ],
      note: [
        {
          id: '1',
          author: 'system',
          date: '2024-03-08T09:15:00Z',
          text: 'Order acknowledged and processing started',
        },
      ],
    },
  ],
  [
    'order-2024-003',
    {
      id: 'order-2024-003',
      href: '/productOrderingManagement/v4/productOrder/order-2024-003',
      externalId: 'EXT-ORD-2024-003',
      state: 'inProgress',
      category: 'retail',
      priority: 'normal',
      description: 'Laptop accessories order',
      orderDate: '2024-03-09T14:30:00Z',
      requestedStartDate: '2024-03-09T14:30:00Z',
      requestedCompletionDate: '2024-03-15T18:00:00Z',
      expectedCompletionDate: '2024-03-15T18:00:00Z',
      notificationContact: 'customer@example.com',
      relatedParty: [
        {
          id: 'cust-003',
          name: 'Sarah Johnson',
          role: 'customer',
          '@referredType': 'Individual',
        },
      ],
      productOrderItem: [
        {
          id: '1',
          quantity: 2,
          action: 'add',
          state: 'inProgress',
          productOffering: {
            id: 'offer-prod-usb-cable-01',
            name: 'USB-C Cable Premium',
          },
          product: {
            id: 'prod-cable-001',
            name: 'USB-C Cable Premium',
          },
          itemPrice: [
            {
              name: 'One-time purchase',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 8.32 },
                taxIncludedAmount: { unit: 'EUR', value: 9.99 },
                taxRate: 20,
              },
            },
          ],
          itemTotalPrice: [
            {
              name: 'Total',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 16.64 },
                taxIncludedAmount: { unit: 'EUR', value: 19.98 },
                taxRate: 20,
              },
            },
          ],
        },
        {
          id: '2',
          quantity: 1,
          action: 'add',
          state: 'inProgress',
          productOffering: {
            id: 'offer-prod-mouse-01',
            name: 'Wireless Mouse Pro',
          },
          product: {
            id: 'prod-mouse-001',
            name: 'Wireless Mouse Pro',
          },
          itemPrice: [
            {
              name: 'One-time purchase',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 24.99 },
                taxIncludedAmount: { unit: 'EUR', value: 29.99 },
                taxRate: 20,
              },
            },
          ],
          itemTotalPrice: [
            {
              name: 'Total',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 24.99 },
                taxIncludedAmount: { unit: 'EUR', value: 29.99 },
                taxRate: 20,
              },
            },
          ],
        },
      ],
      orderTotalPrice: [
        {
          name: 'Order Total',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 41.63 },
            taxIncludedAmount: { unit: 'EUR', value: 49.97 },
            taxRate: 20,
          },
        },
      ],
      note: [
        {
          id: '1',
          author: 'system',
          date: '2024-03-09T14:30:00Z',
          text: 'Order created from shopping cart',
        },
      ],
    },
  ],
]).values());

const STORE_NAME = 'product-orders';
const DB_NAME = 'pos-tmf622-product-orders';
const ORDER_HOOK_CACHE: Map<string, ProductOrder> = new Map();

const PAYMENT_EPSILON = 0.00001;

function getOrderTotalAmount(order: ProductOrder): number {
  const orderTotal = order.orderTotalPrice?.[0]?.price?.taxIncludedAmount?.value;
  if (orderTotal !== undefined) {
    return orderTotal;
  }

  return order.productOrderItem.reduce((sum, item) => {
    const itemTotal = item.itemTotalPrice?.[0]?.price?.taxIncludedAmount?.value;
    if (itemTotal !== undefined) {
      return sum + itemTotal;
    }

    const itemPrice = item.itemPrice?.[0]?.price?.taxIncludedAmount?.value;
    if (itemPrice !== undefined) {
      return sum + itemPrice * item.quantity;
    }

    return sum;
  }, 0);
}

function isFullyPaid(totalAmount: number, paidAmount: number): boolean {
  if (Math.abs(totalAmount) <= PAYMENT_EPSILON) {
    return true;
  }

  if (totalAmount > 0) {
    return paidAmount + PAYMENT_EPSILON >= totalAmount;
  }

  return paidAmount - PAYMENT_EPSILON <= totalAmount;
}

/**
 * Backend-side hook: finalize an order once payment settlement reaches the order total.
 */
export function autoFinalizeOrderIfFullyPaid(
  orderId: string,
  paidAmount: number,
  source = 'payment-service'
): ProductOrder | null {
  const order = ORDER_HOOK_CACHE.get(orderId);
  if (!order) {
    return null;
  }

  const totalAmount = getOrderTotalAmount(order);
  if (!isFullyPaid(totalAmount, paidAmount)) {
    return order;
  }

  if (
    order.state === 'completed' ||
    order.state === 'cancelled' ||
    order.state === 'rejected' ||
    order.state === 'failed'
  ) {
    return order;
  }

  const now = new Date().toISOString();
  const finalized: ProductOrder = {
    ...order,
    state: 'completed',
    completionDate: order.completionDate || now,
    productOrderItem: order.productOrderItem.map((item) => ({
      ...item,
      state:
        item.state === 'cancelled' || item.state === 'failed' || item.state === 'rejected'
          ? item.state
          : 'completed',
    })),
    note: [
      ...(order.note || []),
      {
        id: String((order.note?.length || 0) + 1),
        author: 'system',
        date: now,
        text: `Order auto-finalized after full payment settlement (${source})`,
      },
    ],
  };

  ORDER_HOOK_CACHE.set(orderId, finalized);
  return finalized;
}

/**
 * TMF-622 Product Ordering Management API Service
 *
 * Provides access to product order lifecycle management
 * following the TMForum TMF-622 standard.
 */
@Injectable({ providedIn: 'root' })
export class Tmf622ApiService implements OnInit {
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'tmf622', '/productOrderingManagement/v4/productOrder');
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
        for (const order of INITIAL_PRODUCT_ORDERS) {
          await firstValueFrom(this.idb.put(STORE_NAME, order));
          ORDER_HOOK_CACHE.set(order.id, order);
        }
      } else {
        const orders = await firstValueFrom(this.idb.getAll<ProductOrder>(STORE_NAME));
        ORDER_HOOK_CACHE.clear();
        for (const order of orders) {
          ORDER_HOOK_CACHE.set(order.id, order);
        }
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  private cacheOrder(order: ProductOrder): void {
    ORDER_HOOK_CACHE.set(order.id, order);
  }

  createProductOrder(request: CreateProductOrderRequest): Observable<ProductOrder> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const orderId = generateOrderId();
          const now = new Date().toISOString();
          const orderTotalPrice = this.calculateOrderTotal(request.productOrderItem);

          const order: ProductOrder = {
            id: orderId,
            href: `/productOrderingManagement/v4/productOrder/${orderId}`,
            externalId: request.externalId,
            priority: request.priority || 'normal',
            description: request.description,
            category: request.category || 'retail',
            state: 'acknowledged',
            orderDate: now,
            requestedStartDate: request.requestedStartDate || now,
            requestedCompletionDate: request.requestedCompletionDate,
            expectedCompletionDate: request.requestedCompletionDate,
            notificationContact: request.notificationContact,
            relatedParty: request.relatedParty || [],
            productOrderItem: request.productOrderItem.map((item) => ({
              ...item,
              state: 'acknowledged',
              itemTotalPrice: item.itemPrice
                ? [
                    {
                      name: 'Total',
                      priceType: item.itemPrice[0].priceType,
                      price: {
                        dutyFreeAmount: {
                          unit: item.itemPrice[0].price.dutyFreeAmount!.unit,
                          value: item.itemPrice[0].price.dutyFreeAmount!.value * item.quantity,
                        },
                        taxIncludedAmount: {
                          unit: item.itemPrice[0].price.taxIncludedAmount!.unit,
                          value: item.itemPrice[0].price.taxIncludedAmount!.value * item.quantity,
                        },
                        taxRate: item.itemPrice[0].price.taxRate,
                      },
                    },
                  ]
                : undefined,
            })),
            orderTotalPrice,
            note: [
              ...(request.note || []),
              {
                id: '1',
                author: 'system',
                date: now,
                text: 'Order created and acknowledged',
              },
            ],
          };

          await firstValueFrom(this.idb.put(STORE_NAME, order));
          this.cacheOrder(order);
          setTimeout(() => {
            subscriber.next(order);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Retrieve a product order by ID
   * @param orderId The unique identifier of the order
   * @returns Observable of product order
   */
  getProductOrder(orderId: string): Observable<ProductOrder> {
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
            const order = await firstValueFrom(this.idb.get<ProductOrder>(STORE_NAME, orderId));
            this.cacheOrder(order);
            setTimeout(() => {
              subscriber.next({ ...order });
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const notFoundError = new Error(`Product order ${orderId} not found`) as Error & { status?: number };
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
   * Search/list product orders with criteria
   * @param criteria Search criteria
   * @param page Page number (0-indexed)
   * @param pageSize Number of items per page
   * @returns Observable of paginated results
   */
  searchProductOrders(
    criteria: ProductOrderSearchCriteria = {},
    page = 0,
    pageSize = 10
  ): Observable<PaginatedOrderResults> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let orders = await firstValueFrom(this.idb.getAll<ProductOrder>(STORE_NAME));

    // Filter by state
    if (criteria.state) {
      orders = orders.filter((o) => o.state === criteria.state);
    }

    // Filter by external ID
    if (criteria.externalId) {
      const extIdLower = criteria.externalId.toLowerCase();
      orders = orders.filter((o) => o.externalId?.toLowerCase().includes(extIdLower));
    }

    // Filter by customer ID
    if (criteria.customerId) {
      orders = orders.filter((o) =>
        o.relatedParty?.some(
          (p) => p.role === 'customer' && p.id === criteria.customerId
        )
      );
    }

    // Filter by order date range
    if (criteria.orderDateFrom) {
      orders = orders.filter((o) => o.orderDate && o.orderDate >= criteria.orderDateFrom!);
    }
    if (criteria.orderDateTo) {
      orders = orders.filter((o) => o.orderDate && o.orderDate <= criteria.orderDateTo!);
    }

    // Filter by priority
    if (criteria.priority) {
      orders = orders.filter((o) => o.priority === criteria.priority);
    }

    // Sort by order date descending (newest first)
    orders.sort((a, b) => {
      const dateA = a.orderDate || '';
      const dateB = b.orderDate || '';
      return dateB.localeCompare(dateA);
    });

    // Pagination
    const total = orders.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = orders.slice(start, end);
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
   * Update a product order
   * @param orderId The order ID to update
   * @param request Update request
   * @returns Observable of updated order
   */
  updateProductOrder(
    orderId: string,
    request: UpdateProductOrderRequest
  ): Observable<ProductOrder> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let order: ProductOrder;
          try {
            order = await firstValueFrom(this.idb.get<ProductOrder>(STORE_NAME, orderId));
          } catch {
            const notFoundError = new Error(`Product order ${orderId} not found`) as Error & { status?: number };
            notFoundError.status = 404;
            subscriber.error(notFoundError);
            return;
          }

          // Only allow updates on orders in certain states
          if (
            order.state === 'completed' ||
            order.state === 'cancelled' ||
            order.state === 'rejected'
          ) {
            const conflictError = new Error(
              `Cannot update order in ${order.state} state`
            ) as Error & { status?: number };
            conflictError.status = 409;
            subscriber.error(conflictError);
            return;
          }

          const updatedOrder: ProductOrder = {
            ...order,
            description: request.description ?? order.description,
            priority: request.priority ?? order.priority,
            requestedStartDate: request.requestedStartDate ?? order.requestedStartDate,
            requestedCompletionDate:
              request.requestedCompletionDate ?? order.requestedCompletionDate,
            notificationContact: request.notificationContact ?? order.notificationContact,
            note: [
              ...(order.note || []),
              ...(request.note || []).map((note, index) => ({
                id: String((order.note?.length || 0) + index + 1),
                author: note.author || 'system',
                date: note.date || new Date().toISOString(),
                text: note.text,
              })),
            ],
          };

          await firstValueFrom(this.idb.put(STORE_NAME, updatedOrder));
          this.cacheOrder(updatedOrder);
          setTimeout(() => {
            subscriber.next(updatedOrder);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Cancel a product order
   * @param orderId The order ID to cancel
   * @param request Cancellation request
   * @returns Observable of cancelled order
   */
  cancelProductOrder(
    orderId: string,
    request: CancelProductOrderRequest = {}
  ): Observable<ProductOrder> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let order: ProductOrder;
          try {
            order = await firstValueFrom(this.idb.get<ProductOrder>(STORE_NAME, orderId));
          } catch {
            const notFoundError = new Error(`Product order ${orderId} not found`) as Error & { status?: number };
            notFoundError.status = 404;
            subscriber.error(notFoundError);
            return;
          }

          // Only allow cancellation on orders in certain states
          if (order.state === 'completed' || order.state === 'cancelled') {
            const conflictError = new Error(
              `Cannot cancel order in ${order.state} state`
            ) as Error & { status?: number };
            conflictError.status = 409;
            subscriber.error(conflictError);
            return;
          }

          const now = new Date().toISOString();
          const cancelledOrder: ProductOrder = {
            ...order,
            state: 'cancelled',
            completionDate: now,
            note: [
              ...(order.note || []),
              {
                id: String((order.note?.length || 0) + 1),
                author: 'system',
                date: now,
                text: request.note || request.cancellationReason || 'Order cancelled by user',
              },
            ],
            productOrderItem: order.productOrderItem.map((item) => ({
              ...item,
              state: 'cancelled',
            })),
          };

          await firstValueFrom(this.idb.put(STORE_NAME, cancelledOrder));
          this.cacheOrder(cancelledOrder);
          setTimeout(() => {
            subscriber.next(cancelledOrder);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Delete a product order (administrative operation)
   * @param orderId The order ID to delete
   * @returns Observable of void
   */
  deleteProductOrder(orderId: string): Observable<void> {
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
            await firstValueFrom(this.idb.get<ProductOrder>(STORE_NAME, orderId));
            await firstValueFrom(this.idb.delete(STORE_NAME, orderId));
            ORDER_HOOK_CACHE.delete(orderId);
            setTimeout(() => {
              subscriber.next(undefined);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const notFoundError = new Error(`Product order ${orderId} not found`) as Error & { status?: number };
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
   * Atomically update `returnedQuantity` on a specific order item.
   * Pass +1 when a return cart position is added, -1 when one is removed (edit/undo).
   * The value is clamped to [0, item.quantity].
   */
  recordOrderItemReturn(orderId: string, itemId: string, delta: number): Observable<void> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();

          let order: ProductOrder;
          try {
            order = await firstValueFrom(this.idb.get<ProductOrder>(STORE_NAME, orderId));
          } catch {
            subscriber.error(new Error(`Product order ${orderId} not found`));
            return;
          }

          const updatedItems = order.productOrderItem.map((item) => {
            if (item.id !== itemId) return item;
            const current = item.returnedQuantity ?? 0;
            return {
              ...item,
              returnedQuantity: Math.max(0, Math.min(item.quantity, current + delta)),
            };
          });

          const updatedOrder: ProductOrder = { ...order, productOrderItem: updatedItems };
          await firstValueFrom(this.idb.put(STORE_NAME, updatedOrder));
          this.cacheOrder(updatedOrder);

          subscriber.next(undefined);
          subscriber.complete();
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Calculate total order price from order items
   * @private
   */
  private calculateOrderTotal(
    items: CreateProductOrderRequest['productOrderItem']
  ): OrderPrice[] | undefined {
    let totalDutyFree = 0;
    let totalTaxIncluded = 0;
    let currency = 'EUR';
    let taxRate = 0;

    for (const item of items) {
      if (item.itemPrice && item.itemPrice.length > 0) {
        const price = item.itemPrice[0].price;
        if (price.dutyFreeAmount) {
          totalDutyFree += price.dutyFreeAmount.value * item.quantity;
          currency = price.dutyFreeAmount.unit;
        }
        if (price.taxIncludedAmount) {
          totalTaxIncluded += price.taxIncludedAmount.value * item.quantity;
        }
        if (price.taxRate) {
          taxRate = price.taxRate;
        }
      }
    }

    if (totalDutyFree === 0 && totalTaxIncluded === 0) {
      return undefined;
    }

    return [
      {
        name: 'Order Total',
        priceType: 'oneTime',
        price: {
          dutyFreeAmount: { unit: currency, value: totalDutyFree },
          taxIncludedAmount: { unit: currency, value: totalTaxIncluded },
          taxRate,
        },
      },
    ];
  }
}
