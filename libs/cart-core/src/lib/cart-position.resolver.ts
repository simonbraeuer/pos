import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { CartItem, ShoppingCart, Tmf663ApiService } from '@pos/tmf663';
import { catchError, map, of } from 'rxjs';

/**
 * Resolver that fetches cart position (item) details by ID.
 * Used for hydrating position data when navigating to edit cart position processes.
 */
export const cartPositionResolver: ResolveFn<CartItem | null> = (route) => {
  const api = inject(Tmf663ApiService);
  const cartId = route.parent?.paramMap.get('cart-id');
  const positionId = route.paramMap.get('positionId');

  if (!cartId || !positionId) {
    return of(null);
  }

  // Fetch the cart and find the matching position
  return api.getCart(cartId).pipe(
    map((cart: ShoppingCart) => {
      const position = cart.cartItem.find((item: CartItem) => item.id === positionId) || null;
      return position;
    }),
    catchError(err => {
      console.error('Failed to resolve cart position:', err);
      return of(null);
    })
  );
};
