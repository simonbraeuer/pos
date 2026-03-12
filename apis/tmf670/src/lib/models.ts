/** TMF-670 Money value with currency */
export interface Money {
  unit: string;
  value: number;
}

/** TMF-670 Payment method type */
export type PaymentMethodType =
  | 'cash'
  | 'creditCard'
  | 'debitCard'
  | 'bankTransfer'
  | 'directDebit'
  | 'digitalWallet'
  | 'voucher'
  | 'loyaltyPoints'
  | 'other';

/** TMF-670 Payment method status */
export type PaymentMethodStatus =
  | 'active'
  | 'inactive'
  | 'suspended'
  | 'expired';

/** Authorization mode for payment methods */
export type AuthorizationMode = 'online' | 'offline';

/** TMF-670 Related party */
export interface RelatedParty {
  id: string;
  href?: string;
  name?: string;
  role?: string;
  '@referredType'?: string;
}

/** TMF-670 Validity period */
export interface ValidFor {
  startDateTime?: string;
  endDateTime?: string;
}

/** TMF-670 Bank account details */
export interface BankAccountRef {
  id: string;
  href?: string;
  accountNumber?: string;
  bankCode?: string;
  iban?: string;
  bic?: string;
  accountHolder?: string;
}

/** TMF-670 Card details */
export interface CardRef {
  id: string;
  href?: string;
  brand?: string;
  cardNumber?: string; // Masked, e.g., "**** **** **** 1234"
  expiryDate?: string; // Format: MM/YY
  cardHolder?: string;
  cardType?: 'credit' | 'debit' | 'prepaid';
}

/** TMF-670 Digital wallet reference */
export interface DigitalWalletRef {
  id: string;
  href?: string;
  walletId?: string;
  provider?: string; // e.g., "PayPal", "Apple Pay", "Google Pay"
  accountEmail?: string;
}

/** TMF-670 Payment method */
export interface PaymentMethod {
  id: string;
  href?: string;
  name: string;
  description?: string;
  type: PaymentMethodType;
  status?: PaymentMethodStatus;
  isPreferred?: boolean;
  validFor?: ValidFor;
  relatedParty?: RelatedParty[];
  bankAccount?: BankAccountRef;
  card?: CardRef;
  digitalWallet?: DigitalWalletRef;
  authorizationCode?: string;
  /** Authorization mode - whether method requires online connectivity */
  authorizationMode?: AuthorizationMode;
  /** Whether the payment method requires hardware devices (e.g., card terminal) */
  requiresHardware?: boolean;
  /** ID of the device (EFT terminal or cash drawer) mapped to this payment method */
  deviceId?: number;
  '@type'?: string;
  '@schemaLocation'?: string;
  '@baseType'?: string;
}

/** TMF-670 Create payment method request */
export interface CreatePaymentMethodRequest {
  name: string;
  description?: string;
  type: PaymentMethodType;
  isPreferred?: boolean;
  validFor?: ValidFor;
  relatedParty?: RelatedParty[];
  bankAccount?: BankAccountRef;
  card?: Omit<CardRef, 'id' | 'href'>;
  digitalWallet?: Omit<DigitalWalletRef, 'id' | 'href'>;
  authorizationCode?: string;
  authorizationMode?: AuthorizationMode;
  requiresHardware?: boolean;
  /** ID of the device mapped to this payment method (EFT → EFT device, cash → CASH_DRAWER device) */
  deviceId?: number;
}

/** TMF-670 Update payment method request */
export interface UpdatePaymentMethodRequest {
  name?: string;
  description?: string;
  status?: PaymentMethodStatus;
  isPreferred?: boolean;
  validFor?: ValidFor;
  authorizationMode?: AuthorizationMode;
  requiresHardware?: boolean;
  /** Set or clear the mapped device. Pass null to unmap. */
  deviceId?: number | null;
}

/** Search criteria for payment methods */
export interface PaymentMethodSearchCriteria {
  customerId?: string;
  type?: PaymentMethodType;
  status?: PaymentMethodStatus;
  isPreferred?: boolean;
}

/** Paginated search results for payment methods */
export interface PaginatedPaymentMethodResults {
  items: PaymentMethod[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
