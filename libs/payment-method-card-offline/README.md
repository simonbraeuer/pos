# payment-method-card-offline

This library contains the payment method implementation for offline card payments (credit card and debit card).

It provides:
- Order process component for entering card details
- Pending payment overlay for confirming payment on EFT device
- Pending refund overlay for confirming refund on EFT device
- Payment item component for displaying card payment details with masked card numbers

## Components

### OrderProcessPaymentCardOfflineComponent
Handles credit/debit card payment entry with validation and formatting.

### PendingPaymentCardOfflineComponent
Shows confirmation overlay that payment was processed, with spinner during finalization.

### PendingRefundCardOfflineComponent
Shows confirmation overlay that refund was processed, with spinner during finalization.

### PaymentItemCardOfflineComponent
Displays payment details with masked card information in the checkout summary.
