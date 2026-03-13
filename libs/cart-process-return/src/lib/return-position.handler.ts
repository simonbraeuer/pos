import { Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";
import { CartPositionSelectionHandler } from "@pos/cart-core";
import { CartItem } from "@pos/tmf663";

/**
 * Handler for editing return positions in cart.
 * Navigates to return process with existing cart position ID.
 */
@Injectable()
export class ReturnPositionHandler implements CartPositionSelectionHandler {
  private readonly router = inject(Router);

  isForCartPosition(position: CartItem): boolean {
    return this.isReturnPosition(position);
  }

  selectPosition(position: CartItem): void {
    const urlTree = this.router.parseUrl(this.router.url);
    const segments = urlTree.root.children["primary"]?.segments || [];
    const cartIndex = segments.findIndex((s) => s.path === "cart");

    if (cartIndex >= 0 && segments[cartIndex + 1]) {
      const cartId = segments[cartIndex + 1].path;
      this.router.navigate(["/cart", cartId, "return", position.id]);
    }
  }

  private isReturnPosition(position: CartItem): boolean {
    const description = (position.product?.description || "").toUpperCase();
    const hasReturnMarker = description.includes("RETURN|ORDER:");
    const gross = position.itemPrice?.[0]?.price?.taxIncludedAmount?.value ?? 0;
    const hasNegativeAmount = gross < 0;
    return hasReturnMarker || hasNegativeAmount;
  }
}