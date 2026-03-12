import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import {
  AddCartPositionRequest,
  CartItem,
  CartSearchCriteria,
  PaginatedCartResults,
  SaleOfferSearchResult,
  ShoppingCart,
} from './models';
import { Tmf620ApiService } from '@pos/tmf620';
import { Tmf688EventService } from './tmf688-events.service';
import { instrumentMockHarLogging } from '@pos/tmf688';

/** Simulates realistic API network latency (150–800 ms). */
function simulateLatency(): number {
  return 150 + Math.random() * 650;
}

/** Randomly reject ~5 % of requests to simulate transient failures. */
function maybeNetworkError(): Observable<never> | null {
  if (Math.random() < 0.05) {
    const err = new Error('Service temporarily unavailable') as any;
    err.status = 503;
    return throwError(() => err);
  }
  return null;
}

/** Initial cart seed data */
const INITIAL_CARTS: ShoppingCart[] = Array.from(new Map<string, ShoppingCart>([
  [
    'cart-001',
    {
      id: 'cart-001',
      href: '/shoppingCart/cart-001',
      status: 'active',
      cartItem: [
        {
          id: 'item-1',
          quantity: 1,
          product: {
            id: 'offer-prod-mobile-phone-01',
            name: 'Mobile Phone 5G Flagship',
            description: 'Latest flagship mobile phone with 5G connectivity',
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
        },
        {
          id: 'item-2',
          quantity: 1,
          product: {
            id: 'offer-prod-phone-case-01',
            name: 'Protective Phone Case Set',
            description: 'Set of 3 premium protective phone cases with screen protectors',
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
        },
      ],
      cartTotalPrice: [
        {
          name: 'Total price',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 262.48 },
            taxIncludedAmount: { unit: 'EUR', value: 314.98 },
            taxRate: 20,
          },
        },
      ],
    },
  ],
  [
    'cart-002',
    {
      id: 'cart-002',
      href: '/shoppingCart/cart-002',
      status: 'active',
      customer: {
        name: 'TMF Telco GmbH',
        email: 'einkauf@tmf-telco.at',
        phone: '+43 732 123456',
      },
      cartItem: [
        {
          id: 'item-1',
          quantity: 1,
          product: {
            id: 'prod-010',
            name: 'VoIP System Professional',
            description: 'Enterprise-grade Voice over IP system for business communications',
          },
          itemPrice: [
            {
              name: 'One-time charge',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 1499.99 },
                taxIncludedAmount: { unit: 'EUR', value: 1799.99 },
                taxRate: 20,
              },
            },
          ],
        },
      ],
      cartTotalPrice: [
        {
          name: 'Total price',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 1499.99 },
            taxIncludedAmount: { unit: 'EUR', value: 1799.99 },
            taxRate: 20,
          },
        },
      ],
    },
  ],
  [
    'cart-003',
    {
      id: 'cart-003',
      href: '/shoppingCart/cart-003',
      status: 'completed',
      cartItem: [
        {
          id: 'item-1',
          quantity: 5,
          product: {
            id: 'prod-020',
            name: 'Network Switch Gigabit',
            description: '24-port managed network switch with PoE support',
          },
          itemPrice: [
            {
              name: 'One-time charge',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 199.99 },
                taxIncludedAmount: { unit: 'EUR', value: 239.99 },
                taxRate: 20,
              },
            },
          ],
        },
      ],
      cartTotalPrice: [
        {
          name: 'Total price',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 999.95 },
            taxIncludedAmount: { unit: 'EUR', value: 1199.95 },
            taxRate: 20,
          },
        },
      ],
    },
  ],
  [
    'cart-004',
    {
      id: 'cart-004',
      href: '/shoppingCart/cart-004',
      status: 'active',
      cartItem: [
        {
          id: 'item-1',
          quantity: 2,
          product: {
            id: 'prod-030',
            name: 'USB-C Fast Charger',
            description: 'Multi-port USB-C fast charger for mobile devices',
          },
          itemPrice: [
            {
              name: 'One-time charge',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 29.99 },
                taxIncludedAmount: { unit: 'EUR', value: 35.99 },
                taxRate: 20,
              },
            },
          ],
        },
      ],
      cartTotalPrice: [
        {
          name: 'Total price',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 59.98 },
            taxIncludedAmount: { unit: 'EUR', value: 71.98 },
            taxRate: 20,
          },
        },
      ],
    },
  ],
  [
    'cart-005',
    {
      id: 'cart-005',
      href: '/shoppingCart/cart-005',
      status: 'cancelled',
      cartItem: [
        {
          id: 'item-1',
          quantity: 1,
          product: {
            id: 'prod-040',
            name: 'Cellular IoT Gateway',
            description: 'Industrial-grade cellular gateway for IoT connectivity',
          },
          itemPrice: [
            {
              name: 'One-time charge',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: 'EUR', value: 449.99 },
                taxIncludedAmount: { unit: 'EUR', value: 539.99 },
                taxRate: 20,
              },
            },
          ],
        },
      ],
      cartTotalPrice: [
        {
          name: 'Total price',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 449.99 },
            taxIncludedAmount: { unit: 'EUR', value: 539.99 },
            taxRate: 20,
          },
        },
      ],
    },
  ],
]).values());

const STORE_NAME = 'shopping-carts';
const DB_NAME = 'pos-tmf663-shopping-carts';

function recalculateCartTotals(cart: ShoppingCart): void {
  const net = cart.cartItem.reduce((sum, item) => {
    const unitNet = item.itemPrice[0]?.price.dutyFreeAmount?.value ?? 0;
    return sum + unitNet * item.quantity;
  }, 0);

  const gross = cart.cartItem.reduce((sum, item) => {
    const unitGross = item.itemPrice[0]?.price.taxIncludedAmount?.value ?? 0;
    return sum + unitGross * item.quantity;
  }, 0);

  cart.cartTotalPrice = [
    {
      name: 'Total price',
      priceType: 'oneTime',
      price: {
        dutyFreeAmount: { unit: 'EUR', value: Number(net.toFixed(2)) },
        taxIncludedAmount: { unit: 'EUR', value: Number(gross.toFixed(2)) },
        taxRate: 20,
      },
    },
  ];
}

function defaultBundleComponentsForOffer(offerId: string): CartItem['bundleComponents'] {
  if (offerId === 'offer-bundle-telco-01') {
    return [
      { id: 'bundle-comp-mobile', name: 'Business Mobile Plan', quantity: 1 },
      { id: 'bundle-comp-broadband', name: 'Business Broadband', quantity: 1 },
      { id: 'bundle-comp-voip', name: 'VoIP System', quantity: 1 },
    ];
  }

  return [
    { id: 'bundle-comp-1', name: 'Bundle Component 1', quantity: 1 },
    { id: 'bundle-comp-2', name: 'Bundle Component 2', quantity: 1 },
  ];
}

@Injectable({ providedIn: 'root' })
export class Tmf663ApiService implements OnInit {
  private catalogApi: Tmf620ApiService = inject(Tmf620ApiService);
  private eventService: Tmf688EventService = inject(Tmf688EventService);
  private idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'tmf663', '/shoppingCart/v4/shoppingCart');
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
        for (const cart of INITIAL_CARTS) {
          await firstValueFrom(this.idb.put(STORE_NAME, cart));
        }
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  /**
   * Retrieve a shopping cart by ID
   * @param cartId The unique identifier of the cart
   * @returns Observable of the shopping cart or error
   */
  getCart(cartId: string): Observable<ShoppingCart> {
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
            const cart = await firstValueFrom(this.idb.get<ShoppingCart>(STORE_NAME, cartId));
            setTimeout(() => {
              subscriber.next(cart);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Cart not found: ${cartId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * List all shopping carts
   * @returns Observable of shopping cart array
   */
  listCarts(): Observable<ShoppingCart[]> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const carts = await firstValueFrom(this.idb.getAll<ShoppingCart>(STORE_NAME));
          setTimeout(() => {
            subscriber.next(carts);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Create a new shopping cart
   * @param cart Initial cart data
   * @returns Observable of the created cart
   */
  createCart(cart: Partial<ShoppingCart>): Observable<ShoppingCart> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const newId = `cart-${Date.now()}`;
          const newCart: ShoppingCart = {
            id: newId,
            href: `/shoppingCart/${newId}`,
            status: 'active',
            cartItem: cart.cartItem || [],
            cartTotalPrice: cart.cartTotalPrice || [],
          };

          await firstValueFrom(this.idb.put(STORE_NAME, newCart));
          setTimeout(() => {
            this.eventService.emitCartCreated(newCart);
            subscriber.next(newCart);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Update an existing shopping cart
   * @param cartId The cart ID to update
   * @param updates Partial cart data to merge
   * @returns Observable of the updated cart
   */
  updateCart(
    cartId: string,
    updates: Partial<ShoppingCart>
  ): Observable<ShoppingCart> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let cart: ShoppingCart;
          try {
            cart = await firstValueFrom(this.idb.get<ShoppingCart>(STORE_NAME, cartId));
          } catch {
            const err = new Error(`Cart not found: ${cartId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          const updated = { ...cart, ...updates, id: cartId };
          await firstValueFrom(this.idb.put(STORE_NAME, updated));
          setTimeout(() => {
            this.eventService.emitCartUpdated(updated, 'Cart updated');
            subscriber.next(updated);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Delete a shopping cart
   * @param cartId The cart ID to delete
   * @returns Observable that completes when deletion is done
   */
  deleteCart(cartId: string): Observable<void> {
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
            const deletedCart = await firstValueFrom(this.idb.get<ShoppingCart>(STORE_NAME, cartId));
            await firstValueFrom(this.idb.delete(STORE_NAME, cartId));
            setTimeout(() => {
              this.eventService.emitCartDeleted(deletedCart);
              subscriber.next(undefined);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Cart not found: ${cartId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Delete a cart item from a shopping cart
   * @param cartId The cart ID
   * @param itemId The cart item ID to delete
   * @returns Observable of the updated cart
   */
  deleteCartItem(cartId: string, itemId: string): Observable<ShoppingCart> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let cart: ShoppingCart;
          try {
            cart = await firstValueFrom(this.idb.get<ShoppingCart>(STORE_NAME, cartId));
          } catch {
            const err = new Error(`Cart not found: ${cartId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          const itemIndex = cart.cartItem.findIndex((item) => item.id === itemId);
          if (itemIndex === -1) {
            const err = new Error(`Cart item not found: ${itemId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

    const removedItem = cart.cartItem[itemIndex];
    // Remove the item
    cart.cartItem.splice(itemIndex, 1);

    // Recalculate totals
    recalculateCartTotals(cart);

          await firstValueFrom(this.idb.put(STORE_NAME, cart));
          setTimeout(() => {
            this.eventService.emitItemRemoved(cart, itemId, removedItem);
            subscriber.next(cart);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Update an existing cart position and return the updated cart.
   * This is used by edit-sale-* processes.
   */
  updateCartItem(
    cartId: string,
    itemId: string,
    updates: Partial<Pick<CartItem, 'quantity' | 'product' | 'bundleComponents'>>
  ): Observable<ShoppingCart> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let cart: ShoppingCart;
          try {
            cart = await firstValueFrom(this.idb.get<ShoppingCart>(STORE_NAME, cartId));
          } catch {
            const err = new Error(`Cart not found: ${cartId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          const item = cart.cartItem.find((i) => i.id === itemId);
          if (!item) {
            const err = new Error(`Cart item not found: ${itemId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          if (updates.quantity !== undefined) {
            if (!Number.isFinite(updates.quantity) || updates.quantity < 1) {
              const err = new Error('Quantity must be at least 1') as Error & { status?: number };
              err.status = 400;
              subscriber.error(err);
              return;
            }
            item.quantity = updates.quantity;
          }

    if (updates.product) {
      item.product = { ...item.product, ...updates.product } as CartItem['product'];
    }

    if (updates.bundleComponents) {
      const sanitized = updates.bundleComponents
        .map(component => ({
          id: component.id,
          name: component.name?.trim() ?? '',
          quantity: Number(component.quantity),
        }))
        .filter(component => component.name.length > 0 && Number.isFinite(component.quantity) && component.quantity > 0);

      item.bundleComponents = sanitized;
    }

          item.action = 'modify';
          recalculateCartTotals(cart);
          await firstValueFrom(this.idb.put(STORE_NAME, cart));
          setTimeout(() => {
            this.eventService.emitItemUpdated(cart, item, 'Cart position updated');
            this.eventService.emitCartUpdated(cart, 'Cart totals recalculated after position update');
            subscriber.next(cart);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Search shopping carts with pagination
   * @param criteria Search criteria
   * @param page Page number (0-indexed)
   * @param pageSize Number of items per page
   * @returns Observable of paginated search results
   */
  searchCarts(
    criteria: CartSearchCriteria,
    page = 0,
    pageSize = 10
  ): Observable<PaginatedCartResults> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let carts = await firstValueFrom(this.idb.getAll<ShoppingCart>(STORE_NAME));

    // Apply filters
    if (criteria.id) {
      const searchId = criteria.id.toLowerCase();
      carts = carts.filter(c => c.id.toLowerCase().includes(searchId));
    }

    if (criteria.status) {
      carts = carts.filter(c => c.status === criteria.status);
    }

    if (criteria.minTotal !== undefined || criteria.maxTotal !== undefined) {
      carts = carts.filter(c => {
        const total = c.cartTotalPrice?.[0]?.price?.taxIncludedAmount?.value ?? 0;
        const meetsMin = criteria.minTotal === undefined || total >= criteria.minTotal;
        const meetsMax = criteria.maxTotal === undefined || total <= criteria.maxTotal;
        return meetsMin && meetsMax;
      });
    }

    // Calculate pagination
    const total = carts.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = carts.slice(start, end);
    const hasMore = end < total;

    const result: PaginatedCartResults = {
      items,
      total,
      page,
      pageSize,
      hasMore,
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

  /** Search sale offers by product name, product number or serial number. */
  /** Search sale offers by product name, product number or serial number. */
  searchSaleOffers(term: string): Observable<SaleOfferSearchResult[]> {
    // Delegate to TMF620 Product Catalog API
    return this.catalogApi.searchProductOfferings(term);
  }

  /** Add a sale offer as a new cart position and return the updated cart. */
  addOfferToCart(
    cartId: string,
    request: AddCartPositionRequest
  ): Observable<ShoppingCart> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let cart: ShoppingCart;
          try {
            cart = await firstValueFrom(this.idb.get<ShoppingCart>(STORE_NAME, cartId));
          } catch {
            const err = new Error(`Cart not found: ${cartId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          if (cart.status !== 'active') {
            const err = new Error('Only active carts can be modified') as Error & { status?: number };
            err.status = 409;
            subscriber.error(err);
            return;
          }

          if (!Number.isFinite(request.quantity) || request.quantity < 1) {
            const err = new Error('Quantity must be at least 1') as Error & { status?: number };
            err.status = 400;
            subscriber.error(err);
            return;
          }

          const results = await firstValueFrom(this.catalogApi.searchProductOfferings(request.offerId));
          const offer = results.find((o: SaleOfferSearchResult) => o.id === request.offerId);
        
          if (!offer) {
            const err = new Error(`Offer not found: ${request.offerId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          if (offer.requiredFields.includes('serialNumber') && !request.serialNumber?.trim()) {
            const err = new Error('Serial number is required for this offer') as Error & { status?: number };
            err.status = 400;
            subscriber.error(err);
            return;
          }

          if (offer.requiredFields.includes('customerReference') && !request.customerReference?.trim()) {
            const err = new Error('Customer reference is required for this offer') as Error & { status?: number };
            err.status = 400;
            subscriber.error(err);
            return;
          }

        const taxRate = 20;
        const netUnit = Number((offer.cheapestPrice / (1 + taxRate / 100)).toFixed(2));
        const newItem: CartItem = {
          id: `item-${Date.now()}`,
          action: 'add',
          quantity: request.quantity,
          product: {
            id: offer.id,
            name: offer.name,
            description: [
              offer.description,
              request.serialNumber ? `Serial: ${request.serialNumber}` : null,
              request.customerReference
                ? `Customer Ref: ${request.customerReference}`
                : null,
            ]
              .filter(Boolean)
              .join(' | '),
          },
          itemPrice: [
            {
              name: 'One-time charge',
              priceType: 'oneTime',
              price: {
                dutyFreeAmount: { unit: offer.currency, value: netUnit },
                taxIncludedAmount: { unit: offer.currency, value: offer.cheapestPrice },
                taxRate,
              },
            },
          ],
          bundleComponents: offer.kind === 'bundle' ? defaultBundleComponentsForOffer(offer.id) : undefined,
        };

          cart.cartItem = [...cart.cartItem, newItem];
          recalculateCartTotals(cart);
          await firstValueFrom(this.idb.put(STORE_NAME, cart));
          setTimeout(() => {
            this.eventService.emitItemAdded(cart, newItem);
            this.eventService.emitCartUpdated(cart, 'Cart totals recalculated after item add');
            subscriber.next(cart);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
