import { InjectionToken, Type } from '@angular/core';
import { Payment } from '@pos/tmf676';

/**
 * Overlay extension point for pending payments.
 * Implementations decide if they can handle a payment and provide the UI component.
 */
export interface PendingPaymentOverlay {
  isResponsible(payment: Payment): boolean;
  pendingOverlayUi: Type<unknown>;
}

/**
 * Multi-provider token for pending payment overlays.
 */
export const PENDING_PAYMENT_OVERLAY =
  new InjectionToken<PendingPaymentOverlay[]>('PENDING_PAYMENT_OVERLAY');
