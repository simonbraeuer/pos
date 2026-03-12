import { APP_INITIALIZER, Provider } from "@angular/core";
import { Router } from "@angular/router";
import { BurgerMenuService } from "@pos/pos-shell";

export * from "./lib/new-cart.component";

/**
 * Provides the "New Cart" menu item for the burger menu.
 * Call this in app.config.ts providers array.
 */
export function provideNewCartMenu(): Provider[] {
  return [
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (burgerMenu: BurgerMenuService, router: Router) => {
        return () => {
          burgerMenu.register({
            id: "new-cart",
            name: "New Cart",
            icon: "🛒",
            onClick: () => {
              burgerMenu.close();
              router.navigate(['/new-cart']);
            },
          });
        };
      },
      deps: [BurgerMenuService, Router],
    },
  ];
}
