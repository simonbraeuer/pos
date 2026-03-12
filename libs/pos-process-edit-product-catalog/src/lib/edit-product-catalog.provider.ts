import { APP_INITIALIZER, Provider } from '@angular/core';
import { MenuRegistryService } from '@pos/pos-shell';

export function provideEditProductCatalogProcess(): Provider {
  return {
    provide: APP_INITIALIZER,
    useFactory: (registry: MenuRegistryService) => () =>
      registry.register({
        id: 'edit-product-catalog',
        label: 'Manage Products',
        icon: '📦',
        route: '/edit-product-catalog',
        adminOnly: true,
      }),
    deps: [MenuRegistryService],
    multi: true,
  };
}
