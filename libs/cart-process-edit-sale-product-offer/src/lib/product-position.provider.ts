import { Provider } from '@angular/core';
import { CART_POSITION_SELECTION_HANDLERS } from '@pos/cart-core';
import { ProductPositionHandler } from './product-position.handler';

/**
 * Provides the product position handler for the IoC pattern.
 * Register this in your app config to enable product position editing.
 */
export function provideProductPositionHandler(): Provider[] {
  return [
    ProductPositionHandler,
    {
      provide: CART_POSITION_SELECTION_HANDLERS,
      useExisting: ProductPositionHandler,
      multi: true,
    },
  ];
}
