/* eslint-disable @nx/enforce-module-boundaries */
import { Routes } from "@angular/router";
import { CurrentCartRedirectComponent } from "./current-cart-redirect.component";
import { ShellComponent } from "@pos/pos-shell";
import { LoginComponent } from "@pos/login";
import { authGuard, adminGuard, loginGuard } from "@pos/login";
import { cartResolver, CART_PROCESS_ROUTES } from "@pos/pos-process-cart";
import { orderResolver, ORDER_PROCESS_ROUTES } from "@pos/pos-process-order";
import { tabletSelectionChildGuard } from "@pos/tablet-selection";

export const appRoutes: Routes = [
  { path: "login", component: LoginComponent, canActivate: [loginGuard] },
  {
    path: "",
    component: ShellComponent,
    canActivate: [authGuard],
    canActivateChild: [tabletSelectionChildGuard],
    children: [
      {
        path: "tablet-selection",
        loadComponent: () =>
          import("@pos/tablet-selection").then(m => m.TabletSelectionComponent),
      },
      { path: "", component: CurrentCartRedirectComponent, pathMatch: "full" },
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
      {
        path: "edit-product-catalog",
        loadComponent: () =>
          import("@pos/pos-process-edit-product-catalog").then(m => m.EditProductCatalogComponent),
        canActivate: [adminGuard],
      },
        {
          path: "edit-payment-methods",
          loadComponent: () =>
            import("@pos/pos-process-edit-payment-methods").then(m => m.EditPaymentMethodsComponent),
          canActivate: [adminGuard],
        },
      {
        path: "search-cart",
        loadComponent: () =>
          import("@pos/pos-process-search-cart").then(m => m.SearchCartComponent),
      },
      {
        path: "new-cart",
        loadComponent: () =>
          import("@pos/pos-process-new-cart").then(m => m.NewCartComponent),
      },
      {
        path: "orders",
        loadComponent: () =>
          import("@pos/pos-process-orders").then(m => m.OrdersComponent),
      },
      {
        path: "orders/:orderid",
        loadComponent: () =>
          import("@pos/pos-process-order").then(m => m.OrderProcessComponent),
        resolve: { order: orderResolver },
        children: ORDER_PROCESS_ROUTES,
      },
      {
        path: "cart/:cart-id",
        loadComponent: () =>
          import("@pos/pos-process-cart").then(m => m.CartProcessComponent),
        resolve: { cart: cartResolver },
        children: CART_PROCESS_ROUTES,
      },
    ],
  },
  { path: "**", redirectTo: "" },
];
