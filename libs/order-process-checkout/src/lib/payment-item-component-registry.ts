import { InjectionToken, Type } from '@angular/core';
import { Payment } from '@pos/tmf676';

/**
 * Interface for payment item UI component registrations.
 * Implementations provide custom rendering for specific payment method types.
 */
export interface PaymentItemComponentRegistry {
  /**
   * Determine if this payment item component should handle the given payment.
   * Return true if this component is responsible for rendering this payment.
   */
  isResponsible: (payment: Payment) => boolean;

  /**
   * The component type to render for this payment item.
   * The component must accept:
   * - @Input() payment: Payment
   * - @Input() formatAmount: (amount: number) => string
   */
  component: Type<unknown>;
}

/**
 * Injection token for providing payment item UI implementations.
 * Use multi: true to register multiple payment item component implementations.
 */
export const PAYMENT_ITEM_COMPONENT = new InjectionToken<PaymentItemComponentRegistry[]>('PAYMENT_ITEM_COMPONENT');
