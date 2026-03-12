import { APP_INITIALIZER, Provider } from "@angular/core";
import { MenuRegistryService } from "@pos/pos-shell";

export function provideEditPaymentMethodsProcess(): Provider {
  return {
    provide: APP_INITIALIZER,
    useFactory: (registry: MenuRegistryService) => () =>
      registry.register({
        id: "edit-payment-methods",
        label: "Manage Payment Methods",
        icon: "💳",
        route: "/edit-payment-methods",
        adminOnly: true,
      }),
    deps: [MenuRegistryService],
    multi: true,
  };
}
