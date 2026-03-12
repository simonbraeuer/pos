import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { SaleOfferSearchResult, Tmf663ApiService } from '@pos/tmf663';
import { catchError, map, of } from 'rxjs';

/**
 * Resolver that fetches sale offer details by ID.
 * Used for hydrating offer data when navigating to create cart position processes.
 */
export const saleOfferResolver: ResolveFn<SaleOfferSearchResult | null> = (route) => {
  const api = inject(Tmf663ApiService);
  const offerId = route.paramMap.get('offerId');

  if (!offerId) {
    return of(null);
  }

  // Search all offers and find the matching one
  // In a real implementation, you might have a getOfferById method
  return api.searchSaleOffers('').pipe(
    map(offers => offers.find(offer => offer.id === offerId) || null),
    catchError(err => {
      console.error('Failed to resolve sale offer:', err);
      return of(null);
    })
  );
};
