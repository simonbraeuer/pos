import { InjectionToken, Type } from '@angular/core';

/**
 * Interface for checkout action UI components that appear in the checkout actions panel.
 * Implementations define their size and provide their component via inversion of control.
 */
export interface CheckoutActionUI {
  /**
   * Unique identifier for this action (used for tracking in grid)
   */
  id: string;

  /**
   * Number of grid columns this action spans (1-3)
   */
  cols: number;

  /**
   * Number of grid rows this action spans
   */
  rows: number;

  /**
   * The component type to render for this action
   */
  component: Type<unknown>;
}

/**
 * Injection token for providing checkout action UI implementations.
 * Use multi: true to register multiple actions.
 */
export const CHECKOUT_ACTION_UI = new InjectionToken<CheckoutActionUI[]>('CHECKOUT_ACTION_UI');
