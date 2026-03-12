import { Provider } from '@angular/core';
import { SALE_OFFER_SEARCH_RESULT_HANDLERS } from '@pos/cart-core';
import { BundleOfferHandler } from './bundle-offer.handler';

/**
 * Provides the bundle offer handler for the IoC pattern.
 * Register this in your app config to enable bundle offer handling.
 */
export function provideBundleOfferHandler(): Provider[] {
  return [
    BundleOfferHandler,
    {
      provide: SALE_OFFER_SEARCH_RESULT_HANDLERS,
      useExisting: BundleOfferHandler,
      multi: true,
    },
  ];
}
