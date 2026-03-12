import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable } from 'rxjs';
import { ProductOrder, Tmf622ApiService } from '@pos/tmf622';

/**
 * Resolver that loads order data based on the orderid route parameter.
 */
export const orderResolver: ResolveFn<ProductOrder> = (
  route
): Observable<ProductOrder> => {
  const orderId = route.paramMap.get('orderid');
  if (!orderId) {
    throw new Error('orderid parameter is required');
  }

  const tmf622Api = inject(Tmf622ApiService);
  return tmf622Api.getProductOrder(orderId);
};
