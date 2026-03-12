import { InjectionToken, Type } from '@angular/core';
import { Payment } from '@pos/tmf676';

/**
 * Overlay extension point for pending refunds.
 * Implementations decide if they can handle a refund payment and provide the UI component.
 */
export interface RefundPaymentOverlay {
  isResponsible(payment: Payment): boolean;
  refundOverlayUi: Type<unknown>;
}

/**
 * Multi-provider token for pending refund overlays.
 */
export const REFUND_PAYMENT_OVERLAY =
  new InjectionToken<RefundPaymentOverlay[]>('REFUND_PAYMENT_OVERLAY');
