import { Injectable, inject } from '@angular/core';
import { Tmf620ApiService } from '@pos/tmf620';
import {
  CartValidationIssue,
  Tmf679ProductOfferingQualificationService,
} from '@pos/tmf679';
import { CartItem, ShoppingCart, Tmf663ApiService } from '@pos/tmf663';
import { Observable, forkJoin, of } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';

export interface CartValidationResult {
  cartId: string;
  valid: boolean;
  issues: CartValidationIssue[];
  validatedAt: string;
}

/**
 * Validates whether a shopping cart can safely transition to a product order.
 *
 * Orchestration:
 * - TMF663 Shopping Cart Management: load cart and cart positions.
 * - TMF620 Product Catalog Management: verify referenced offerings exist and are active.
 * - TMF679 Product Offering Qualification: run qualification checks on positions.
 */
@Injectable({ providedIn: 'root' })
export class CartValidationService {
  private cartApi = inject(Tmf663ApiService);
  private catalogApi = inject(Tmf620ApiService);
  private qualificationApi = inject(Tmf679ProductOfferingQualificationService);

  validateCartForCheckout(cartId: string): Observable<CartValidationResult> {
    return this.cartApi.getCart(cartId).pipe(
      switchMap(cart => this.validateResolvedCart(cart)),
      catchError(err =>
        of({
          cartId,
          valid: false,
          issues: [
            {
              code: 'CART_VALIDATION_FAILED',
              message: err?.message ?? 'Cart validation failed.',
            },
          ],
          validatedAt: new Date().toISOString(),
        })
      )
    );
  }

  private validateResolvedCart(cart: ShoppingCart): Observable<CartValidationResult> {
    const baseIssues: CartValidationIssue[] = [];

    if (cart.status !== 'active') {
      baseIssues.push({
        code: 'CART_STATUS_NOT_ACTIVE',
        message: `Cart status is ${cart.status ?? 'unknown'} (must be active).`,
      });
    }

    if (cart.cartItem.length === 0) {
      baseIssues.push({
        code: 'CART_EMPTY',
        message: 'Cart has no positions to order.',
      });
    }

    const uniqueOfferIds = Array.from(
      new Set(cart.cartItem.map(item => item.product?.id).filter((id): id is string => !!id))
    );

    if (uniqueOfferIds.length === 0) {
      return of(this.toResult(cart.id, baseIssues));
    }

    const offeringLookups = uniqueOfferIds.map(offerId =>
      this.catalogApi.getProductOffering(offerId).pipe(
        map(offering => ({ offerId, offering, issue: null as CartValidationIssue | null })),
        catchError(() =>
          of({
            offerId,
            offering: null,
            issue: {
              code: 'CATALOG_OFFER_NOT_FOUND',
              message: `Product offering ${offerId} not found in catalog.`,
            } as CartValidationIssue,
          })
        )
      )
    );

    return forkJoin(offeringLookups).pipe(
      switchMap(results => {
        const catalogIssues = results
          .map(result => result.issue)
          .filter((issue): issue is CartValidationIssue => issue !== null);

        const offeringById = new Map(
          results
            .filter(result => result.offering !== null)
            .map(result => [result.offerId, result.offering!])
        );

        // Attach itemId to missing-offer issues where possible.
        const missingOfferIssuesByItem = this.mapMissingOffersToItems(cart.cartItem, catalogIssues);

        return this.qualificationApi.qualifyCart(cart, offeringById).pipe(
          map(qualificationResult =>
            this.toResult(cart.id, [
              ...baseIssues,
              ...missingOfferIssuesByItem,
              ...qualificationResult.issues,
            ])
          )
        );
      })
    );
  }

  private mapMissingOffersToItems(
    items: CartItem[],
    catalogIssues: CartValidationIssue[]
  ): CartValidationIssue[] {
    return catalogIssues.flatMap(issue => {
      const match = issue.message.match(/Product offering\s+([^\s]+)\s+not found/i);
      const missingOfferId = match?.[1];
      if (!missingOfferId) {
        return [issue];
      }

      const mapped = items
        .filter(item => item.product?.id === missingOfferId)
        .map(item => ({ ...issue, itemId: item.id }));

      return mapped.length > 0 ? mapped : [issue];
    });
  }

  private toResult(cartId: string, issues: CartValidationIssue[]): CartValidationResult {
    return {
      cartId,
      valid: issues.length === 0,
      issues,
      validatedAt: new Date().toISOString(),
    };
  }
}
