import { InjectionToken } from '@angular/core';
import { CartItem } from '@pos/tmf663';

/**
 * Handler for processing selected cart positions (items in cart).
 * Implementations determine if they can handle a specific position type
 * and navigate to the appropriate edit process.
 */
export interface CartPositionSelectionHandler {
  /**
   * Determines if this handler can process the given position.
   * @param position The selected cart position/item
   * @returns true if this handler should process this position
   */
  isForCartPosition(position: CartItem): boolean;

  /**
   * Handles the selected position by navigating to the appropriate process.
   * @param position The selected cart position to edit
   */
  selectPosition(position: CartItem): void;
}

/**
 * Injection token for providing multiple CartPositionSelectionHandler implementations.
 * Use multi-provider pattern to register handlers.
 */
export const CART_POSITION_SELECTION_HANDLERS = new InjectionToken<
  CartPositionSelectionHandler[]
>('CART_POSITION_SELECTION_HANDLERS');
