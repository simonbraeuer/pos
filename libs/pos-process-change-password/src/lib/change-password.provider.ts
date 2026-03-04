import { APP_INITIALIZER, Provider } from "@angular/core";
import { MenuRegistryService } from "@pos/pos-shell";

export function provideChangePasswordProcess(): Provider {
  return {
    provide: APP_INITIALIZER,
    useFactory: (registry: MenuRegistryService) => () =>
      registry.register({
        id: "change-password",
        label: "Change Password",
        icon: "🔑",
        route: "/change-password",
      }),
    deps: [MenuRegistryService],
    multi: true,
  };
}
