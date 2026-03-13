import { Component, HostListener, Input, OnInit, OnDestroy, inject, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { NavigationEnd, Router } from '@angular/router';
import { ShoppingCart, CartItem, CartEvent, Tmf663ApiService, Tmf688EventService } from "@pos/tmf663";
import { CART_POSITION_SELECTION_HANDLERS, CartPositionSelectionHandler, CartValidationService } from "@pos/cart-core";
import { CreateProductOrderRequest, OrderPrice, Tmf622ApiService } from "@pos/tmf622";
import { AuthStateService } from '@pos/login';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { CartItemComponent } from './cart-item.component';
import { DialogService } from '@pos/core-ui';

interface TabletSelectionRecord {
  deviceId?: number;
  deviceCode?: string;
  deviceName?: string;
  locationId?: number;
  locationName?: string;
}

interface ShiftContextRecord {
  shiftId?: number;
  shiftStatus?: 'OPEN' | 'NEED_CLOSURE' | 'CLOSED';
  registerId?: number;
  registerCode?: string;
}

@Component({
  selector: "pos-cart",
  standalone: true,
  imports: [CommonModule, CartItemComponent],
  template: `
    @if (cartSignal()) {
      <div class="cart">
        <div class="cart-header">
          <h2>Shopping Cart</h2>
          @if (eventHistory().length > 0) {
            <button
              type="button"
              class="event-indicator"
              [attr.aria-expanded]="eventDebugVisible()"
              [attr.aria-label]="'Event history, ' + eventHistory().length + ' entries'"
              [title]="'Event history (' + eventHistory().length + ')'"
              (click)="toggleEventPanel($event)"
            >
              <span class="event-indicator__icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
                  <path
                    d="M15 17h5l-1.4-1.4a2 2 0 0 1-.6-1.4V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h11z"
                  ></path>
                  <path d="M9.5 19a2.5 2.5 0 0 0 5 0"></path>
                </svg>
              </span>
              <span class="event-indicator__count" aria-hidden="true">{{ eventHistory().length }}</span>
            </button>
          }
        </div>
        <p class="cart-id">Cart ID: {{ cartSignal()!.id }}</p>

        <div class="cart-customer">
          <button
            type="button"
            class="btn-customer"
            [disabled]="!cartSignal()"
            (click)="openEditCartCustomer()"
          >
            {{ customerButtonLabel() }}
          </button>
        </div>

        @if (eventHistory().length > 0 && eventDebugVisible()) {
          <div class="event-overlay-backdrop" (click)="dismissEventDebug()"></div>
          <div
            class="event-panel"
            [style.top.px]="eventPanelTop()"
            [style.left.px]="eventPanelLeft()"
            (click)="$event.stopPropagation()"
            role="status"
            aria-live="polite"
          >
            <div class="event-panel__head">
              <strong>TMF688 Event History</strong>
              <button
                type="button"
                class="event-close"
                (click)="dismissEventDebug()"
                aria-label="Collapse notification"
                title="Collapse"
              >
                ×
              </button>
            </div>
            <div class="event-panel__table-wrap">
              <table class="event-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Time</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  @for (event of eventHistory(); track event.eventId) {
                    <tr>
                      <td>
                        <span class="event-type">{{ getEventLabel(event.eventType) }}</span>
                      </td>
                      <td class="event-time">{{ event.timestamp | date: 'HH:mm:ss.SSS' }}</td>
                      <td class="event-reason">{{ event.reason || 'n/a' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <div class="cart-items-section">
          <h3>
            Items
            <span class="item-count">({{ cartSignal()!.cartItem.length }})</span>
          </h3>
          <div class="cart-items">
            @for (item of cartSignal()!.cartItem; track item.id) {
              <pos-cart-item
                [item]="item"
                [canEdit]="canEditPosition(item)"
                [isDeleting]="deleting() === item.id"
                [selected]="selectedPositionId() === item.id"
                (onEdit)="editPosition(item)"
                (onRemove)="deleteItem(item.id)"
              />
            }
            @if (cartSignal()!.cartItem.length === 0) {
              <p class="empty-cart">Cart is empty</p>
            }
          </div>
        </div>

        @if ((cartSignal()!.cartTotalPrice?.length ?? 0) > 0) {
          <div class="cart-totals">
            <h3>Totals</h3>
            @for (total of cartSignal()!.cartTotalPrice; track $index) {
              <div class="total-line">
                <div class="total-row">
                  <span class="label">Subtotal (excl. tax):</span>
                  <span class="amount">
                    {{ total.price.dutyFreeAmount?.value | number: '1.2-2' }}
                    {{ total.price.dutyFreeAmount?.unit }}
                  </span>
                </div>
                @if (total.price.taxRate) {
                  <div class="total-row tax">
                    <span class="label">Tax ({{ total.price.taxRate }}%):</span>
                    <span class="amount">
                      {{ (total.price.taxIncludedAmount!.value - total.price.dutyFreeAmount!.value) | number: '1.2-2' }}
                      {{ total.price.taxIncludedAmount?.unit }}
                    </span>
                  </div>
                }
                <div class="total-row grand-total">
                  <span class="label">Total (incl. tax):</span>
                  <span class="amount">
                    {{ total.price.taxIncludedAmount?.value | number: '1.2-2' }}
                    {{ total.price.taxIncludedAmount?.unit }}
                  </span>
                </div>
              </div>
            }

            <div class="checkout-actions">
              <button
                type="button"
                class="btn-checkout"
                [disabled]="isValidatingCart() || isCreatingOrder() || !isCartValidForCheckout()"
                (click)="goToCheckout()"
              >
                @if (isValidatingCart()) {
                  Validating cart...
                } @else if (isCreatingOrder()) {
                  Creating order...
                } @else {
                  Go to Checkout
                }
              </button>

              @if (!isValidatingCart() && hasValidatedCart() && validationErrors().length > 0) {
                <div class="checkout-hint" role="status" aria-live="polite">
                  Cannot checkout: {{ validationErrors()[0] }}
                </div>
              }
            </div>
          </div>
        }

        @if (error()) {
          <p class="error">{{ error() }}</p>
        }
      </div>
    }
  `,
  styleUrl: "./cart.component.scss",
})
export class CartComponent implements OnInit, OnDestroy {
  private static readonly TABLET_SELECTION_STORAGE_KEY = 'pos_tablet_selection';
  private static readonly TABLET_SHIFT_CONTEXT_STORAGE_KEY = 'pos_shift_context';

  @Input({ required: true }) cart!: ShoppingCart;

  private readonly api = inject(Tmf663ApiService);
  private readonly orderApi = inject(Tmf622ApiService);
  private readonly eventService = inject(Tmf688EventService);
  private readonly cartValidation = inject(CartValidationService);
  private readonly router = inject(Router);
  private readonly dialog = inject(DialogService);
  private readonly auth = inject(AuthStateService);
  private readonly positionHandlers = inject(CART_POSITION_SELECTION_HANDLERS, { optional: true }) || [];

  deleting = signal<string | null>(null);
  error = signal<string | null>(null);
  lastEvent = signal<CartEvent | null>(null);
  eventHistory = signal<CartEvent[]>([]);
  eventDebugVisible = signal(false);
  eventPanelTop = signal(0);
  eventPanelLeft = signal(0);
  selectedPositionId = signal<string | null>(null);
  isValidatingCart = signal(false);
  isCreatingOrder = signal(false);
  hasValidatedCart = signal(false);
  isCartValidForCheckout = signal(false);
  validationErrors = signal<string[]>([]);

  // Track the current cart in a signal for real-time updates
  cartSignal = signal<ShoppingCart | null>(null);
  
  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    // Initialize with the input cart
    if (this.cart) {
      this.cartSignal.set(this.cart);
      this.validateCart(this.cart.id);
    }

    this.updateSelectedPositionFromUrl(this.router.url);

    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntil(this.destroy$)
      )
      .subscribe(event => {
        this.updateSelectedPositionFromUrl(event.urlAfterRedirects);
      });

    // Subscribe to events for this specific cart
    this.eventService.getCartEvents(this.cart.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(event => {
        this.lastEvent.set(event);
        this.eventHistory.update(history => [event, ...history].slice(0, 25));
        this.eventDebugVisible.set(false);
        console.debug('[TMF688] cart event received', {
          eventType: event.eventType,
          cartId: event.cartId,
          itemId: event.itemId,
          reason: event.reason,
        });

        // Update the cart signal with the latest data from the event
        if (event.cart) {
          this.cartSignal.set(event.cart);
          // Also update the input property so parent component is aware
          this.cart = event.cart;
          this.validateCart(event.cart.id);
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    if (this.eventDebugVisible()) {
      this.eventDebugVisible.set(false);
    }
  }

  dismissEventDebug(): void {
    this.eventDebugVisible.set(false);
  }

  toggleEventPanel(event: MouseEvent): void {
    event.stopPropagation();

    const trigger = event.currentTarget as HTMLElement | null;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      const top = Math.round(rect.bottom + 8);
      const left = Math.round(rect.right + 10);
      const safeLeft = Math.min(left, Math.max(16, window.innerWidth - 420));
      this.eventPanelTop.set(top);
      this.eventPanelLeft.set(safeLeft);
    }

    this.eventDebugVisible.update(value => !value);
  }

  getEventIcon(eventType: CartEvent['eventType']): string {
    switch (eventType) {
      case 'ShoppingCartCreationEvent':
        return 'N';
      case 'ShoppingCartDeletionEvent':
        return 'D';
      case 'ShoppingCartItemAddedEvent':
        return '+';
      case 'ShoppingCartItemRemovedEvent':
        return '-';
      case 'ShoppingCartItemAttributeValueChangeEvent':
      case 'ShoppingCartAttributeValueChangeEvent':
        return '~';
      default:
        return 'i';
    }
  }

  getEventLabel(eventType: CartEvent['eventType']): string {
    switch (eventType) {
      case 'ShoppingCartCreationEvent':
        return 'Cart created';
      case 'ShoppingCartDeletionEvent':
        return 'Cart deleted';
      case 'ShoppingCartItemAddedEvent':
        return 'Item added';
      case 'ShoppingCartItemRemovedEvent':
        return 'Item removed';
      case 'ShoppingCartItemAttributeValueChangeEvent':
        return 'Item updated';
      case 'ShoppingCartAttributeValueChangeEvent':
        return 'Cart updated';
      default:
        return 'Cart event';
    }
  }

  private updateSelectedPositionFromUrl(url: string): void {
    const match = url.match(/\/(?:edit-sale-(?:product|bundle)-offer|return)\/([^/?#]+)/);
    this.selectedPositionId.set(match?.[1] ?? null);
  }

  canEditPosition(position: CartItem): boolean {
    return this.positionHandlers.some(handler => handler.isForCartPosition(position));
  }

  editPosition(position: CartItem): void {
    const handler = this.positionHandlers.find(h => h.isForCartPosition(position));
    if (handler) {
      handler.selectPosition(position);
    }
  }

  async deleteItem(itemId: string): Promise<void> {
    const confirmed = await this.dialog.show({
      title: 'Remove Item',
      message: 'Are you sure you want to remove this item?',
      confirmText: 'Remove',
      cancelText: 'Cancel',
      dismissible: true,
    });

    if (!confirmed) {
      return;
    }

    this.deleting.set(itemId);
    this.error.set(null);

    this.api.deleteCartItem(this.cartSignal()!.id, itemId).subscribe({
      next: () => {
        this.deleting.set(null);
      },
      error: (err) => {
        this.deleting.set(null);
        this.error.set(err?.message || 'Failed to delete item');
      },
    });
  }

  goToCheckout(): void {
    if (!this.isCartValidForCheckout() || this.isValidatingCart()) {
      return;
    }

    const cart = this.cartSignal();
    if (!cart) {
      this.error.set('Cannot checkout: cart is not available.');
      return;
    }

    this.error.set(null);
    this.isCreatingOrder.set(true);

    const request = this.toCreateProductOrderRequest(cart);

    this.orderApi.createProductOrder(request).subscribe({
      next: (order) => {
        this.isCreatingOrder.set(false);
        this.router.navigate(['/orders', order.id, 'checkout']);
      },
      error: (err) => {
        this.isCreatingOrder.set(false);
        this.error.set(err?.message || 'Failed to create order from cart.');
      },
    });
  }

  customerButtonLabel(): string {
    const name = this.cartSignal()?.customer?.name?.trim();
    return name ? name : 'Add customer';
  }

  openEditCartCustomer(): void {
    const cartId = this.cartSignal()?.id;
    if (!cartId) {
      return;
    }

    this.router.navigate(['/cart', cartId, 'edit-cart-customer']);
  }

  private toCreateProductOrderRequest(cart: ShoppingCart): CreateProductOrderRequest {
    const relatedParty = this.buildOperationalRelatedParty();

    const requestItems: CreateProductOrderRequest['productOrderItem'] = cart.cartItem.map(item => ({
      id: item.id,
      quantity: item.quantity,
      action: this.toOrderAction(item.action),
      productOffering: {
        id: item.product?.id || `unknown-offer-${item.id}`,
        name: item.product?.name,
      },
      product: item.product
        ? {
            id: item.product.id,
            href: item.product.href,
            name: item.product.name,
            description: item.product.description,
          }
        : undefined,
      itemPrice: item.itemPrice?.map(price => this.toOrderPrice(price.name, price.description, price.priceType, price.price)),
    }));

    return {
      externalId: `cart-${cart.id}`,
      description: `Order created from shopping cart ${cart.id}`,
      category: 'retail',
      relatedParty: relatedParty.length > 0 ? relatedParty : undefined,
      productOrderItem: requestItems,
      note: [
        {
          author: 'system',
          date: new Date().toISOString(),
          text: `Converted from shopping cart ${cart.id}`,
        },
      ],
    };
  }

  private buildOperationalRelatedParty(): NonNullable<CreateProductOrderRequest['relatedParty']> {
    const relatedParty: NonNullable<CreateProductOrderRequest['relatedParty']> = [];

    const currentUser = this.auth.currentUser();
    if (currentUser?.id || currentUser?.username) {
      relatedParty.push({
        id: currentUser.id || currentUser.username || 'unknown-cashier',
        name: currentUser.displayName || currentUser.username,
        role: 'cashier',
      });
    }

    const tabletSelection = this.readStorageJson<TabletSelectionRecord>(
      CartComponent.TABLET_SELECTION_STORAGE_KEY
    );

    if (tabletSelection?.locationId !== undefined) {
      relatedParty.push({
        id: String(tabletSelection.locationId),
        name: tabletSelection.locationName,
        role: 'location',
      });
    }

    if (tabletSelection?.deviceId !== undefined) {
      relatedParty.push({
        id: String(tabletSelection.deviceId),
        name: tabletSelection.deviceName || tabletSelection.deviceCode,
        role: 'device',
      });
    }

    const shiftContext = this.readStorageJson<ShiftContextRecord>(
      CartComponent.TABLET_SHIFT_CONTEXT_STORAGE_KEY
    );

    if (shiftContext?.shiftId !== undefined) {
      relatedParty.push({
        id: String(shiftContext.shiftId),
        role: 'shift',
      });
    }

    if (shiftContext?.registerId !== undefined) {
      relatedParty.push({
        id: String(shiftContext.registerId),
        name: shiftContext.registerCode,
        role: 'register',
      });
    }

    return relatedParty;
  }

  private readStorageJson<T>(key: string): T | null {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      localStorage.removeItem(key);
      return null;
    }
  }

  private toOrderPrice(
    name: string,
    description: string | undefined,
    priceType: 'recurring' | 'oneTime' | 'usage',
    price: CartItem['itemPrice'][number]['price']
  ): OrderPrice {
    return {
      name,
      description,
      priceType,
      price: {
        percentage: price.percentage,
        taxRate: price.taxRate,
        dutyFreeAmount: price.dutyFreeAmount,
        taxIncludedAmount: price.taxIncludedAmount,
      },
    };
  }

  private toOrderAction(action?: CartItem['action']): 'add' | 'modify' | 'delete' {
    if (action === 'modify' || action === 'delete') {
      return action;
    }
    return 'add';
  }

  private validateCart(cartId: string): void {
    this.isValidatingCart.set(true);
    this.hasValidatedCart.set(false);

    this.cartValidation
      .validateCartForCheckout(cartId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(result => {
        this.isValidatingCart.set(false);
        this.hasValidatedCart.set(true);
        this.isCartValidForCheckout.set(result.valid);
        this.validationErrors.set(result.issues.map(issue => issue.message));
      });
  }
}
