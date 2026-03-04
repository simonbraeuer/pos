import { APP_INITIALIZER, Provider } from "@angular/core";
import { MenuRegistryService } from "@pos/pos-shell";

export function provideEditUsersProcess(): Provider {
  return {
    provide: APP_INITIALIZER,
    useFactory: (registry: MenuRegistryService) => () =>
      registry.register({
        id: "edit-users",
        label: "Manage Users",
        icon: "👥",
        route: "/edit-users",
        adminOnly: true,
      }),
    deps: [MenuRegistryService],
    multi: true,
  };
}
