import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { CartPositionSelectionHandler } from '@pos/cart-core';
import { CartItem } from '@pos/tmf663';

/**
 * Handler for editing bundle positions in cart.
 * Navigates to edit-sale-bundle-offer process with position ID in URL.
 */
@Injectable()
export class BundlePositionHandler implements CartPositionSelectionHandler {
  private router = inject(Router);

  isForCartPosition(position: CartItem): boolean {
    // Bundle edit flow applies only to positions with bundle components.
    return !!position.product && this.hasBundleComponents(position) && !this.isReturnPosition(position);
  }

  selectPosition(position: CartItem): void {
    // Parse current URL to get cart ID
    const urlTree = this.router.parseUrl(this.router.url);
    const segments = urlTree.root.children['primary']?.segments || [];
    
    // Find the cart/:cart-id segment
    const cartIndex = segments.findIndex(s => s.path === 'cart');
    if (cartIndex >= 0 && segments[cartIndex + 1]) {
      const cartId = segments[cartIndex + 1].path;
      this.router.navigate(['/cart', cartId, 'edit-sale-bundle-offer', position.id]);
    }
  }

  private hasBundleComponents(position: CartItem): boolean {
    return (position.bundleComponents?.length ?? 0) > 0;
  }

  private isReturnPosition(position: CartItem): boolean {
    const description = (position.product?.description || "").toUpperCase();
    const hasReturnMarker = description.includes("RETURN|ORDER:");
    const gross = position.itemPrice?.[0]?.price?.taxIncludedAmount?.value ?? 0;
    return hasReturnMarker || gross < 0;
  }
}
