import { InjectionToken } from '@angular/core';
import { SaleOfferSearchResult } from '@pos/tmf663';

/**
 * Handler for processing selected sale offers from the search results.
 * Implementations determine if they can handle a specific offer type
 * and navigate to the appropriate cart process.
 */
export interface SaleOfferSearchResultHandler {
  /**
   * Determines if this handler can process the given offer.
   * @param offer The selected sale offer from search results
   * @returns true if this handler should process this offer
   */
  isForOffer(offer: SaleOfferSearchResult): boolean;

  /**
   * Handles the selected offer by navigating to the appropriate process.
   * @param offer The selected sale offer to process
   */
  handleSearchResult(offer: SaleOfferSearchResult): void;
}

/**
 * Injection token for providing multiple SaleOfferSearchResultHandler implementations.
 * Use multi-provider pattern to register handlers.
 */
export const SALE_OFFER_SEARCH_RESULT_HANDLERS = new InjectionToken<
  SaleOfferSearchResultHandler[]
>('SALE_OFFER_SEARCH_RESULT_HANDLERS');
