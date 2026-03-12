import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import {
  AddCartPositionRequest,
  ShoppingCart,
  Tmf663ApiService,
  CartItem,
} from '@pos/tmf663';
import { Tmf688EventService, CartEvent } from '@pos/tmf663';

/**
 * Extended Cart API Service with Event Emission
 *
 * This service wraps the base TMF663 API service and adds
 * real-time event emission through the TMF688 event service.
 * 
 * Every cart operation (add, delete, update) automatically
 * emits an event that can be consumed by UI components.
 */
@Injectable({ providedIn: 'root' })
export class CartApiServiceWithEvents {
  private baseApi = inject(Tmf663ApiService);
  private eventService = inject(Tmf688EventService);

  /**
   * Get a cart with automatic event emission
   */
  getCart(cartId: string): Observable<ShoppingCart> {
    return this.baseApi.getCart(cartId);
  }

  /**
   * List carts with automatic event emission
   */
  listCarts(): Observable<ShoppingCart[]> {
    return this.baseApi.listCarts();
  }

  /**
   * Create a cart with automatic event emission
   */
  createCart(cart: Partial<ShoppingCart>): Observable<ShoppingCart> {
    return this.baseApi.createCart(cart).pipe(
      tap((created: ShoppingCart) => this.eventService.emitCartCreated(created))
    );
  }

  /**
   * Update a cart with automatic event emission
   */
  updateCart(cartId: string, updates: Partial<ShoppingCart>): Observable<ShoppingCart> {
    return this.baseApi.updateCart(cartId, updates).pipe(
      tap((updated: ShoppingCart) => this.eventService.emitCartUpdated(updated, 'Cart updated'))
    );
  }

  /**
   * Delete a cart with automatic event emission
   */
  deleteCart(cartId: string): Observable<void> {
    const cartBefore = this.baseApi.getCart(cartId);
    return new Observable(subscriber => {
      let deletedCart: ShoppingCart;
      
      // Capture the cart before deletion
      cartBefore.subscribe({
        next: cart => {
          deletedCart = cart;
        },
        complete: () => {
          this.baseApi.deleteCart(cartId).subscribe({
            next: () => {
              this.eventService.emitCartDeleted(deletedCart);
              subscriber.next(undefined);
              subscriber.complete();
            },
            error: err => subscriber.error(err),
          });
        },
      });
    });
  }

  /**
   * Delete a cart item with automatic event emission
   */
  deleteCartItem(cartId: string, itemId: string): Observable<ShoppingCart> {
    return this.baseApi.deleteCartItem(cartId, itemId).pipe(
      tap((updated: ShoppingCart) => {
        const removedItem = undefined; // We don't have it anymore
        this.eventService.emitItemRemoved(updated, itemId, removedItem);
      })
    );
  }

  /**
   * Add an offer to cart with automatic event emission
   */
  addOfferToCart(cartId: string, request: AddCartPositionRequest): Observable<ShoppingCart> {
    return this.baseApi.addOfferToCart(cartId, request).pipe(
      tap((updated: ShoppingCart) => {
        // Find the newly added item
        const newItem = updated.cartItem[updated.cartItem.length - 1];
        if (newItem) {
          this.eventService.emitItemAdded(updated, newItem);
        }
      })
    );
  }

  /**
   * Search carts
   */
  searchCarts(criteria: any, page?: number, pageSize?: number): Observable<any> {
    return this.baseApi.searchCarts(criteria, page, pageSize) as Observable<any>;
  }

  /**
   * Search sale offers
   */
  searchSaleOffers(term: string): Observable<any> {
    return this.baseApi.searchSaleOffers(term) as Observable<any>;
  }
}
