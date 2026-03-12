import { Routes } from "@angular/router";
import { saleOfferResolver, cartPositionResolver } from "@pos/cart-core";

/**
 * Routes for cart processes
 * These are child routes of the main cart process
 */
export const CART_PROCESS_ROUTES: Routes = [
  {
    path: "",
    redirectTo: "find-sale-offer",
    pathMatch: "full",
  },
  {
    path: "find-sale-offer",
    loadComponent: () =>
      import("@pos/cart-process-find-sale-offer").then(
        (m) => m.FindSaleOfferComponent
      ),
  },
  {
    path: "create-sale-product-offer/:offerId",
    loadComponent: () =>
      import("@pos/cart-process-edit-sale-product-offer").then(
        (m) => m.EditSaleProductOfferComponent
      ),
    resolve: {
      offer: saleOfferResolver,
    },
  },
  {
    path: "create-sale-bundle-offer/:offerId",
    loadComponent: () =>
      import("@pos/cart-process-edit-sale-bundle-offer").then(
        (m) => m.EditSaleBundleOfferComponent
      ),
    resolve: {
      offer: saleOfferResolver,
    },
  },
  {
    path: "edit-sale-product-offer/:positionId",
    loadComponent: () =>
      import("@pos/cart-process-edit-sale-product-offer").then(
        (m) => m.EditSaleProductOfferComponent
      ),
    runGuardsAndResolvers: 'paramsChange',
    resolve: {
      position: cartPositionResolver,
    },
  },
  {
    path: "edit-sale-bundle-offer/:positionId",
    loadComponent: () =>
      import("@pos/cart-process-edit-sale-bundle-offer").then(
        (m) => m.EditSaleBundleOfferComponent
      ),
    runGuardsAndResolvers: 'paramsChange',
    resolve: {
      position: cartPositionResolver,
    },
  },
  {
    path: "edit-sale-product-offer",
    loadComponent: () =>
      import("@pos/cart-process-edit-sale-product-offer").then(
        (m) => m.EditSaleProductOfferComponent
      ),
  },
  {
    path: "edit-sale-bundle-offer",
    loadComponent: () =>
      import("@pos/cart-process-edit-sale-bundle-offer").then(
        (m) => m.EditSaleBundleOfferComponent
      ),
  },
  {
    path: 'edit-cart-customer',
    loadComponent: () =>
      import('@pos/pos-process-edit-cart-customer').then(
        (m) => m.EditCartCustomerComponent
      ),
  },
];
