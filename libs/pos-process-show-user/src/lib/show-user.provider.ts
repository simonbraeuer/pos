import { APP_INITIALIZER, Provider } from "@angular/core";
import { MenuRegistryService } from "@pos/pos-shell";

export function provideShowUserProcess(): Provider {
  return {
    provide: APP_INITIALIZER,
    useFactory: (registry: MenuRegistryService) => () =>
      registry.register({ id: "show-user", label: "My Profile", icon: "👤", route: "/show-user" }),
    deps: [MenuRegistryService],
    multi: true,
  };
}
