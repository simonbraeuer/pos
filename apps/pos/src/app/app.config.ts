/* eslint-disable @nx/enforce-module-boundaries */
import { ApplicationConfig, provideZoneChangeDetection, APP_INITIALIZER } from "@angular/core";
import { provideRouter, withComponentInputBinding } from "@angular/router";

import { appRoutes } from "./app.routes";
import { AuthStateService } from "@pos/login";
import { MenuRegistryService } from "@pos/pos-shell";
import { provideSearchCartMenu } from "@pos/pos-process-search-cart";
import { provideNewCartMenu } from "@pos/pos-process-new-cart";
import { provideOrdersMenu } from "@pos/pos-process-orders";
import { provideProductOfferHandler } from "@pos/cart-process-edit-sale-product-offer";
import { provideBundleOfferHandler } from "@pos/cart-process-edit-sale-bundle-offer";
import { provideProductPositionHandler } from "@pos/cart-process-edit-sale-product-offer";
import { provideBundlePositionHandler } from "@pos/cart-process-edit-sale-bundle-offer";
import { provideReturnPositionHandler } from "@pos/cart-process-return";
import { provideCheckoutActionPaymentCash } from "@pos/checkout-action-payment-cash";
import { provideCheckoutActionPaymentCardOffline } from "@pos/checkout-action-payment-card-offline";
import { provideCheckoutReceiptOptions } from "@pos/checkout-receipt-options";
import {
  providePendingPaymentCashOverlay,
  providePendingRefundCashOverlay,
} from "@pos/payment-method-cash";
import {
  providePendingPaymentCardOfflineOverlay,
  providePendingRefundCardOfflineOverlay,
  providePaymentItemCardOffline,
} from "@pos/payment-method-card-offline";
import { providePendingPaymentDefaultOverlay } from "@pos/pending-payment-default";
import { providePendingRefundDefaultOverlay } from "@pos/pending-refund-default";

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes, withComponentInputBinding()),

    // Burger menu providers
    ...provideSearchCartMenu(),
    ...provideNewCartMenu(),
    ...provideOrdersMenu(),

    // SaleOfferSearchResultHandler providers (IoC for creating new cart positions)
    ...provideProductOfferHandler(),
    ...provideBundleOfferHandler(),

    // CartPositionSelectionHandler providers (IoC for editing existing cart positions)
    ...provideProductPositionHandler(),
    ...provideBundlePositionHandler(),
    ...provideReturnPositionHandler(),

    // Checkout action providers
    ...provideCheckoutActionPaymentCash(),
    ...provideCheckoutActionPaymentCardOffline(),
    ...provideCheckoutReceiptOptions(),

    // Pending payment overlays
    ...providePendingPaymentCashOverlay(),
    ...providePendingPaymentCardOfflineOverlay(),
    ...providePendingPaymentDefaultOverlay(),

    // Pending refund overlays
    ...providePendingRefundCashOverlay(),
    ...providePendingRefundCardOfflineOverlay(),
    ...providePendingRefundDefaultOverlay(),

    // Payment item renderers
    ...providePaymentItemCardOffline(),

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
        registry.register({ id: "tablet-selection", label: "Select Tablet", icon: "📱", route: "/tablet-selection" });
        registry.register({ id: "edit-users",       label: "Manage Users",  icon: "👥", route: "/edit-users", adminOnly: true });
        registry.register({ id: "edit-product-catalog", label: "Manage Products", icon: "📦", route: "/edit-product-catalog", adminOnly: true });
        registry.register({ id: "edit-payment-methods", label: "Manage Payment Methods", icon: "💳", route: "/edit-payment-methods", adminOnly: true });
        registry.register({ id: "configure-demo", label: "Configure Demo", icon: "🛠️", route: "/configure-demo", adminOnly: true });
      },
      deps: [MenuRegistryService],
      multi: true,
    },
  ],
};
