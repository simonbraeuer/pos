import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { instrumentMockHarLogging } from '@pos/tmf688';
import { ProductOffering } from '@pos/tmf620';
import { ShoppingCart } from '@pos/tmf663';
import {
  CartValidationIssue,
  ProductOfferingQualificationRequest,
  ProductOfferingQualificationResult,
} from './models';

/** Simulates realistic API network latency (120-450 ms). */
function simulateLatency(): number {
  return 120 + Math.random() * 330;
}

/** Randomly reject ~3% of requests to simulate transient failures. */
function maybeNetworkError(): Observable<never> | null {
  if (Math.random() < 0.03) {
    const err = new Error('Product Offering Qualification service temporarily unavailable') as any;
    err.status = 503;
    return throwError(() => err);
  }
  return null;
}

/**
 * TMF679-style Product Offering Qualification service.
 *
 * In a real deployment this would call the external TMF679 API endpoint.
 * Here it validates shopping cart positions against qualification rules
 * and returns TMF679-like eligibility responses.
 */
@Injectable({ providedIn: 'root' })
export class Tmf679ProductOfferingQualificationService {
  constructor() {
    instrumentMockHarLogging(this, 'tmf679', '/productOfferingQualification/v4/productOfferingQualification');
  }

  /**
   * Qualify a shopping cart in aggregate.
   * @param cart Shopping cart to qualify
   * @param offeringById Map of referenced product offerings
   * @returns Eligibility result with qualification issues
   */
  qualifyCart(
    cart: ShoppingCart,
    offeringById: Map<string, ProductOffering>
  ): Observable<ProductOfferingQualificationResult> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    const request = this.toQualificationRequest(cart, offeringById);
    const result = this.evaluateRequest(request, offeringById);

    return of(result).pipe(delay(simulateLatency()));
  }

  /**
   * Qualify an explicit TMF679 request payload.
   * @param request Qualification request
   * @returns Eligibility result with qualification issues
   */
  qualifyProductOffering(
    request: ProductOfferingQualificationRequest,
    offeringById: Map<string, ProductOffering>
  ): Observable<ProductOfferingQualificationResult> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    return of(this.evaluateRequest(request, offeringById)).pipe(delay(simulateLatency()));
  }

  private toQualificationRequest(
    cart: ShoppingCart,
    offeringById: Map<string, ProductOffering>
  ): ProductOfferingQualificationRequest {
    return {
      cartId: cart.id,
      items: cart.cartItem.map(item => {
        const productId = item.product?.id ?? '';
        const offering = productId ? offeringById.get(productId) : undefined;
        const requiresCustomerReference =
          offering?.productSpecCharacteristic?.some(
            c => c.name === 'requiresCustomerReference' && c.value === 'true'
          ) ?? false;
        const hasCustomerReference = (item.product?.description ?? '').includes('Customer Ref:');

        return {
          itemId: item.id,
          productOfferingId: productId,
          quantity: item.quantity,
          isBundle: offering?.isBundle,
          requiresCustomerReference,
          hasCustomerReference,
          lifecycleStatus: offering?.lifecycleStatus,
        };
      }),
    };
  }

  private evaluateRequest(
    request: ProductOfferingQualificationRequest,
    offeringById: Map<string, ProductOffering>
  ): ProductOfferingQualificationResult {
    const issues: CartValidationIssue[] = [];

    for (const requestItem of request.items) {
      this.qualifyItem(requestItem, offeringById, issues);
    }

    return {
      eligible: issues.length === 0,
      issues,
      qualifiedAt: new Date().toISOString(),
    };
  }

  private qualifyItem(
    item: ProductOfferingQualificationRequest['items'][number],
    offeringById: Map<string, ProductOffering>,
    issues: CartValidationIssue[]
  ): void {
    const productId = item.productOfferingId;
    if (!productId) {
      issues.push({
        code: 'MISSING_PRODUCT_REFERENCE',
        message: 'Cart position has no product reference.',
        itemId: item.itemId,
      });
      return;
    }

    const offering = offeringById.get(productId);
    if (!offering) {
      issues.push({
        code: 'NOT_QUALIFIED_OFFER_NOT_FOUND',
        message: `Product offering ${productId} cannot be qualified.`,
        itemId: item.itemId,
      });
      return;
    }

    if (offering.lifecycleStatus && offering.lifecycleStatus !== 'active') {
      issues.push({
        code: 'NOT_QUALIFIED_OFFER_INACTIVE',
        message: `Product offering ${offering.name} is not active.`,
        itemId: item.itemId,
      });
    }

    if (!Number.isFinite(item.quantity) || item.quantity < 1) {
      issues.push({
        code: 'NOT_QUALIFIED_INVALID_QUANTITY',
        message: `Cart position ${item.itemId} has invalid quantity.`,
        itemId: item.itemId,
      });
    }

    const requiresCustomerReference =
      offering.productSpecCharacteristic?.some(
        c => c.name === 'requiresCustomerReference' && c.value === 'true'
      ) ?? false;

    const hasCustomerReference = item.hasCustomerReference ?? false;

    if (offering.isBundle && requiresCustomerReference && !hasCustomerReference) {
      issues.push({
        code: 'NOT_QUALIFIED_CUSTOMER_REFERENCE_REQUIRED',
        message: `Bundle ${offering.name} requires a customer reference.`,
        itemId: item.itemId,
      });
    }
  }
}
