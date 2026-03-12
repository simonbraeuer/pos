import { APP_INITIALIZER, Provider } from '@angular/core';
import { Router } from '@angular/router';
import { BurgerMenuService } from '@pos/pos-shell';

/**
 * Provider that registers the Search Cart menu item in the burger menu
 */
export function provideSearchCartMenu(): Provider[] {
  return [
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (burgerMenu: BurgerMenuService, router: Router) => {
        return () => {
          burgerMenu.register({
            id: 'search-cart',
            name: '🔍 Search Cart',
            onClick: () => {
              router.navigate(['/search-cart']);
            },
          });
        };
      },
      deps: [BurgerMenuService, Router],
    },
  ];
}
