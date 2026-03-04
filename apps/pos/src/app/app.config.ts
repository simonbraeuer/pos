import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from "@angular/core";
import { provideRouter, withComponentInputBinding } from "@angular/router";

import { appRoutes } from "./app.routes";
import { AuthStateService } from "@pos/login";
import { MenuRegistryService } from "@pos/pos-shell";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withComponentInputBinding()),

    // Restore session on startup
    {
      provide: APP_INITIALIZER,
      useFactory: (auth: AuthStateService) => () => auth.init(),
      deps: [AuthStateService],
      multi: true,
    },

    // IoC: process registration into the shell menu.
    // Each process declares its own menu metadata here; the shell renders
    // whatever is in the registry without knowing the processes directly.
    {
      provide: APP_INITIALIZER,
      useFactory: (registry: MenuRegistryService) => () => {
        registry.register({ id: "show-user",        label: "My Profile",    icon: "👤", route: "/show-user" });
        registry.register({ id: "change-password",  label: "Change Password", icon: "🔑", route: "/change-password" });
        registry.register({ id: "edit-users",       label: "Manage Users",  icon: "👥", route: "/edit-users", adminOnly: true });
      },
      deps: [MenuRegistryService],
      multi: true,
    },
  ],
};
