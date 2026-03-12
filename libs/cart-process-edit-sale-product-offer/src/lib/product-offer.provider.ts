import { Provider } from '@angular/core';
import { SALE_OFFER_SEARCH_RESULT_HANDLERS } from '@pos/cart-core';
import { ProductOfferHandler } from './product-offer.handler';

/**
 * Provides the product offer handler for the IoC pattern.
 * Register this in your app config to enable product offer handling.
 */
export function provideProductOfferHandler(): Provider[] {
  return [
    ProductOfferHandler,
    {
      provide: SALE_OFFER_SEARCH_RESULT_HANDLERS,
      useExisting: ProductOfferHandler,
      multi: true,
    },
  ];
}
