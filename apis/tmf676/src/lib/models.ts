/** TMF-676 Money value with currency */
export interface Money {
  unit: string;
  value: number;
}

/** TMF-676 Related party */
export interface RelatedParty {
  id: string;
  href?: string;
  name?: string;
  role?: string;
  '@referredType'?: string;
}

/** Authorization mode for payment methods (TMF-670 compliant) */
export type AuthorizationMode = 'online' | 'offline';

/** TMF-676 Payment method reference */
export interface PaymentMethodRef {
  id: string;
  href?: string;
  name?: string;
  '@referredType'?: string;
  /** Authorization mode - whether method requires online connectivity (TMF-670 field) */
  authorizationMode?: AuthorizationMode;
  /** Whether the payment method requires hardware devices (e.g., card terminal) */
  requiresHardware?: boolean;
}

/** TMF-676 Billing account reference */
export interface BillingAccountRef {
  id: string;
  href?: string;
  name?: string;
}

/** TMF-676 Payment item */
export interface PaymentItem {
  id: string;
  amount: Money;
  appliedAmount?: Money;
  status?: PaymentStatus;
  billingAccount?: BillingAccountRef;
  paymentDate?: string;
  description?: string;
}

/** TMF-676 Payment status */
export type PaymentStatus =
  | 'initialized'
  | 'pending'
  | 'authorized'
  | 'completed'
  | 'partiallyApplied'
  | 'failed'
  | 'cancelled'
  | 'refunded';

/** TMF-676 Payment */
export interface Payment {
  id: string;
  href?: string;
  externalId?: string;
  status?: PaymentStatus;
  paymentDate?: string;
  completionDate?: string;
  amount?: Money;
  receivedAmount?: Money;
  remainingAmount?: Money;
  description?: string;
  isRefund?: boolean;
  originalPaymentId?: string;
  paymentMethod?: PaymentMethodRef;
  relatedParty?: RelatedParty[];
  paymentItem?: PaymentItem[];
  note?: Array<{
    id?: string;
    author?: string;
    date?: string;
    text: string;
  }>;
  '@type'?: string;
  '@schemaLocation'?: string;
  '@baseType'?: string;
}

/** TMF-676 Create payment request */
export interface CreatePaymentRequest {
  externalId?: string;
  paymentDate?: string;
  amount: Money;
  description?: string;
  isRefund?: boolean;
  originalPaymentId?: string;
  paymentMethod?: PaymentMethodRef;
  relatedParty?: RelatedParty[];
  paymentItem?: Array<{
    id: string;
    amount: Money;
    billingAccount?: BillingAccountRef;
    paymentDate?: string;
    description?: string;
  }>;
}

/** TMF-676 Update payment request */
export interface UpdatePaymentRequest {
  status?: PaymentStatus;
  completionDate?: string;
  description?: string;
  remainingAmount?: Money;
}

/** Search criteria for payments */
export interface PaymentSearchCriteria {
  externalId?: string;
  status?: PaymentStatus;
  billingAccountId?: string;
  customerId?: string;
  paymentDateFrom?: string;
  paymentDateTo?: string;
}

/** Paginated search results for payments */
export interface PaginatedPaymentResults {
  items: Payment[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
