import { Provider } from '@angular/core';
import { CART_POSITION_SELECTION_HANDLERS } from '@pos/cart-core';
import { BundlePositionHandler } from './bundle-position.handler';

/**
 * Provides the bundle position handler for the IoC pattern.
 * Register this in your app config to enable bundle position editing.
 */
export function provideBundlePositionHandler(): Provider[] {
  return [
    BundlePositionHandler,
    {
      provide: CART_POSITION_SELECTION_HANDLERS,
      useExisting: BundlePositionHandler,
      multi: true,
    },
  ];
}
