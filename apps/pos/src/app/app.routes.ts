import { Routes } from "@angular/router";
import { ShellComponent } from "@pos/pos-shell";
import { LoginComponent } from "@pos/login";
import { authGuard, adminGuard, loginGuard } from "@pos/login";

export const appRoutes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [loginGuard] },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      { path: "", redirectTo: "show-user", pathMatch: "full" },
      {
        path: "show-user",
        loadComponent: () =>
          import("@pos/pos-process-show-user").then(m => m.ShowUserComponent),
      },
      {
        path: "change-password",
        loadComponent: () =>
          import("@pos/pos-process-change-password").then(m => m.ChangePasswordComponent),
      },
      {
        path: "edit-users",
        loadComponent: () =>
          import("@pos/pos-process-edit-users").then(m => m.EditUsersComponent),
        canActivate: [adminGuard],
      },
    ],
  },
  { path: "**", redirectTo: "" },
];
