import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { Tmf688Event, Tmf688EventBusService } from '@pos/tmf688';
import { ShoppingCart, CartItem } from './models';

/**
 * Event types following TMF688 Event Management standard
 */
export enum CartEventType {
  // Cart lifecycle events
  CartCreated = 'ShoppingCartCreationEvent',
  CartUpdated = 'ShoppingCartAttributeValueChangeEvent',
  CartDeleted = 'ShoppingCartDeletionEvent',

  // Position (item) events
  ItemAdded = 'ShoppingCartItemAddedEvent',
  ItemUpdated = 'ShoppingCartItemAttributeValueChangeEvent',
  ItemRemoved = 'ShoppingCartItemRemovedEvent',
}

/**
 * Base event payload following TMF688 standard
 */
export interface CartEvent {
  eventType: CartEventType;
  eventId: string;
  timestamp: Date;
  cartId: string;
  cart: ShoppingCart;
  itemId?: string; // Present for item-specific events
  item?: CartItem; // Present for item-specific events
  reason?: string; // Optional reason for the change
}

interface CartEventPayload {
  cart: ShoppingCart;
  itemId?: string;
  item?: CartItem;
}

/**
 * TMF688 Event Management Service
 *
 * Manages real-time notifications for Shopping Cart (TMF663) changes.
 * Emits events when:
 * - Cart is created, updated, or deleted
 * - Items (positions) are added, modified, or removed
 *
 * This service acts as an event bus that:
 * 1. The API service publishes events to
 * 2. Components subscribe to for real-time updates
 *
 * In a real implementation, this would connect to an actual TMF688
 * event distribution system or WebSocket endpoint.
 */
@Injectable({ providedIn: 'root' })
export class Tmf688EventService {
  private readonly resourceType = 'ShoppingCart';

  /** Observable stream of all cart events */
  readonly cartEvents$: Observable<CartEvent>;

  constructor(private readonly eventBus: Tmf688EventBusService) {
    this.cartEvents$ = this.eventBus.getEventsForResourceType(this.resourceType).pipe(
      map(event => this.toCartEvent(event)),
      filter((event): event is CartEvent => event !== null)
    );
  }

  /**
   * Get an observable of events for a specific cart
   * @param cartId The cart ID to filter events for
   * @returns Observable of events for this cart only
   */
  getCartEvents(cartId: string): Observable<CartEvent> {
    return this.cartEvents$.pipe(filter(event => event.cartId === cartId));
  }

  /**
   * Get an observable of events for a specific event type
   * @param eventType The type of event to filter for
   * @returns Observable of events of this type
   */
  getEventsByType(eventType: CartEventType): Observable<CartEvent> {
    return this.cartEvents$.pipe(filter(event => event.eventType === eventType));
  }

  /**
   * Internal method: Emit a cart event
   * Called by the API service when cart operations occur
   * @internal
   */
  emitCartEvent(event: CartEvent): void {
    this.eventBus.publish<CartEventPayload>({
      eventType: event.eventType,
      eventId: event.eventId,
      timestamp: event.timestamp,
      resourceType: this.resourceType,
      resourceId: event.cartId,
      payload: {
        cart: event.cart,
        itemId: event.itemId,
        item: event.item,
      },
      reason: event.reason,
    });
  }

  /**
   * Emit a cart creation event
   * @internal
   */
  emitCartCreated(cart: ShoppingCart): void {
    this.publishCartEvent({
      eventType: CartEventType.CartCreated,
      cartId: cart.id,
      cart,
      reason: 'New shopping cart created',
    });
  }

  /**
   * Emit a cart update event
   * @internal
   */
  emitCartUpdated(cart: ShoppingCart, reason = 'Cart updated'): void {
    this.publishCartEvent({
      eventType: CartEventType.CartUpdated,
      cartId: cart.id,
      cart,
      reason,
    });
  }

  /**
   * Emit a cart deletion event
   * @internal
   */
  emitCartDeleted(cart: ShoppingCart): void {
    this.publishCartEvent({
      eventType: CartEventType.CartDeleted,
      cartId: cart.id,
      cart,
      reason: 'Shopping cart deleted',
    });
  }

  /**
   * Emit an item added event
   * @internal
   */
  emitItemAdded(cart: ShoppingCart, item: CartItem): void {
    this.publishCartEvent({
      eventType: CartEventType.ItemAdded,
      cartId: cart.id,
      cart,
      itemId: item.id,
      item,
      reason: `Item added: ${item.product?.name || item.id}`,
    });
  }

  /**
   * Emit an item update event
   * @internal
   */
  emitItemUpdated(cart: ShoppingCart, item: CartItem, reason = 'Item updated'): void {
    this.publishCartEvent({
      eventType: CartEventType.ItemUpdated,
      cartId: cart.id,
      cart,
      itemId: item.id,
      item,
      reason,
    });
  }

  /**
   * Emit an item removed event
   * @internal
   */
  emitItemRemoved(cart: ShoppingCart, itemId: string, removedItem?: CartItem): void {
    this.publishCartEvent({
      eventType: CartEventType.ItemRemoved,
      cartId: cart.id,
      cart,
      itemId,
      item: removedItem,
      reason: `Item removed: ${removedItem?.product?.name || itemId}`,
    });
  }

  private publishCartEvent(event: Omit<CartEvent, 'eventId' | 'timestamp'>): void {
    this.eventBus.publish<CartEventPayload>({
      eventType: event.eventType,
      resourceType: this.resourceType,
      resourceId: event.cartId,
      payload: {
        cart: event.cart,
        itemId: event.itemId,
        item: event.item,
      },
      reason: event.reason,
    });
  }

  private toCartEvent(event: Tmf688Event): CartEvent | null {
    if (!this.isCartEventType(event.eventType)) {
      return null;
    }

    const payload = event.payload as CartEventPayload | undefined;
    if (!event.resourceId || !payload?.cart) {
      return null;
    }

    return {
      eventType: event.eventType,
      eventId: event.eventId,
      timestamp: event.timestamp,
      cartId: event.resourceId,
      cart: payload.cart,
      itemId: payload.itemId,
      item: payload.item,
      reason: event.reason,
    };
  }

  private isCartEventType(eventType: string): eventType is CartEventType {
    return Object.values(CartEventType).includes(eventType as CartEventType);
  }
}
