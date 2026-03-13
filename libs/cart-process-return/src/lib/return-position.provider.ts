import { Provider } from "@angular/core";
import { CART_POSITION_SELECTION_HANDLERS } from "@pos/cart-core";
import { ReturnPositionHandler } from "./return-position.handler";

/**
 * Provides the return position handler for the IoC pattern.
 */
export function provideReturnPositionHandler(): Provider[] {
  return [
    ReturnPositionHandler,
    {
      provide: CART_POSITION_SELECTION_HANDLERS,
      useExisting: ReturnPositionHandler,
      multi: true,
    },
  ];
}