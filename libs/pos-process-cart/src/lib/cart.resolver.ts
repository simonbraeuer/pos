import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable } from 'rxjs';
import { Tmf663ApiService, ShoppingCart } from '@pos/tmf663';

/**
 * Resolver that loads cart data based on the cart-id route parameter
 */
export const cartResolver: ResolveFn<ShoppingCart> = (
  route
): Observable<ShoppingCart> => {
  const cartId = route.paramMap.get('cart-id');
  if (!cartId) {
    throw new Error('cart-id parameter is required');
  }
  
  const tmf663Api = inject(Tmf663ApiService);
  return tmf663Api.getCart(cartId);
};
