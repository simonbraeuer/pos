import { APP_INITIALIZER, Provider } from '@angular/core';
import { Router } from '@angular/router';
import { BurgerMenuService } from '@pos/pos-shell';

/**
 * Provider that registers the Orders menu item in the burger menu
 */
export function provideOrdersMenu(): Provider[] {
  return [
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (burgerMenu: BurgerMenuService, router: Router) => {
        return () => {
          burgerMenu.register({
            id: 'orders',
            name: '📦 Orders',
            onClick: () => {
              burgerMenu.close();
              router.navigate(['/orders']);
            },
          });
        };
      },
      deps: [BurgerMenuService, Router],
    },
  ];
}
