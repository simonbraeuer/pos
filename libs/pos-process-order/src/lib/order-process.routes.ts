import { Routes } from '@angular/router';
import { OrderProcessPaymentCashComponent } from '@pos/payment-method-cash';
import { OrderProcessPaymentCardOfflineComponent } from '@pos/payment-method-card-offline';
import { checkoutCompleteGuard } from '@pos/order-process-checkout';

/**
 * Routes for order processes.
 * These are child routes of the main order process shell.
 */
export const ORDER_PROCESS_ROUTES: Routes = [
  {
    path: '',
    redirectTo: 'checkout',
    pathMatch: 'full',
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('@pos/order-process-checkout').then((m) => m.OrderProcessCheckoutComponent),
  },
  {
    path: 'checkout-complete',
    canActivate: [checkoutCompleteGuard],
    loadComponent: () =>
      import('@pos/order-process-checkout').then((m) => m.OrderProcessCheckoutCompleteComponent),
  },
  {
    path: 'receipt-options',
    loadComponent: () =>
      import('@pos/checkout-receipt-options').then((m) => m.ReceiptOptionsComponent),
  },
  {
    path: 'payment-cash',
    component: OrderProcessPaymentCashComponent,
  },
  {
    path: 'payment-card-offline',
    component: OrderProcessPaymentCardOfflineComponent,
  },
];
