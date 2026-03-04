import { inject } from "@angular/core";
import { CanActivateFn, Router } from "@angular/router";
import { AuthStateService } from "./auth-state.service";

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthStateService);
  if (auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(["/login"]);
};

export const loginGuard: CanActivateFn = () => {
  const auth = inject(AuthStateService);
  if (!auth.isAuthenticated()) return true;
  return inject(Router).createUrlTree(["/"]);
};

export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthStateService);
  if (auth.currentUser()?.role === "admin") return true;
  return inject(Router).createUrlTree(["/"]);
};
