import { Injectable, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { SaleOfferSearchResultHandler } from '@pos/cart-core';
import { SaleOfferSearchResult } from '@pos/tmf663';

/**
 * Handler for bundle offers.
 * Navigates to create-sale-bundle-offer process with offer ID in URL.
 */
@Injectable()
export class BundleOfferHandler implements SaleOfferSearchResultHandler {
  private router = inject(Router);

  isForOffer(offer: SaleOfferSearchResult): boolean {
    return offer.kind === 'bundle';
  }

  handleSearchResult(offer: SaleOfferSearchResult): void {
    // Navigate to sibling route within current cart context
    // Use relative path from current location
    const urlTree = this.router.parseUrl(this.router.url);
    const segments = urlTree.root.children['primary']?.segments || [];
    
    // Find the cart/:cart-id segment
    const cartIndex = segments.findIndex(s => s.path === 'cart');
    if (cartIndex >= 0 && segments[cartIndex + 1]) {
      const cartId = segments[cartIndex + 1].path;
      this.router.navigate(['/cart', cartId, 'create-sale-bundle-offer', offer.id]);
    }
  }
}
