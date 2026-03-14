import { APP_INITIALIZER, Provider } from '@angular/core';
import { Router } from '@angular/router';
import { BurgerMenuService } from '@pos/pos-shell';

/**
 * Provider that registers the X-Report menu item in the burger menu
 */
export function provideXReportMenu(): Provider[] {
  return [
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (burgerMenu: BurgerMenuService, router: Router) => {
        return () => {
          burgerMenu.register({
            id: 'x-report',
            name: '📄 X-Report',
            onClick: () => {
              burgerMenu.close();
              router.navigate(['/x-report']);
            },
          });
        };
      },
      deps: [BurgerMenuService, Router],
    },
  ];
}
