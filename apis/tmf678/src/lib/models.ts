/** TMF-678 Money value with currency */
export interface Money {
  unit: string;
  value: number;
}

/** TMF-678 Tax item */
export interface TaxItem {
  taxCategory: string;
  taxRate: number;
  taxAmount: Money;
}

/** TMF-678 Applied customer billing rate */
export interface AppliedBillingRate {
  name?: string;
  description?: string;
  type?: string;
  taxIncludedAmount?: Money;
  taxExcludedAmount?: Money;
  taxItem?: TaxItem[];
}

/** TMF-678 Applied payment */
export interface AppliedPayment {
  payment: {
    id: string;
    href?: string;
    name?: string;
  };
  appliedAmount: Money;
}

/** TMF-678 Related party */
export interface RelatedParty {
  id: string;
  href?: string;
  name?: string;
  role?: string;
  '@referredType'?: string;
}

/** TMF-678 Time period */
export interface TimePeriod {
  startDateTime?: string;
  endDateTime?: string;
}

/** TMF-678 Billing account reference */
export interface BillingAccountRef {
  id: string;
  href?: string;
  name?: string;
}

export type ReceiptRenderFormat = 'pdfA4' | 'epsonTmt88';

export interface ReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: Money;
  lineTotal: Money;
}

export interface ReceiptRenderContext {
  companyName: string;
  shopName?: string;
  shopAddress?: string;
  cashierName?: string;
  cashierCode?: string;
  customerName?: string;
  items: ReceiptLineItem[];
}

export interface RenderReceiptDocumentRequest {
  format: ReceiptRenderFormat;
  context: ReceiptRenderContext;
}

/** TMF-678 Payment method reference */
export interface PaymentMethodRef {
  id: string;
  href?: string;
  name?: string;
  '@referredType'?: string;
}

/** TMF-678 Bill state */
export type CustomerBillState =
  | 'new'
  | 'onHold'
  | 'validated'
  | 'sent'
  | 'partiallyPaid'
  | 'settled'
  | 'rejected'
  | 'cancelled';

/** TMF-678 Customer Bill */
export interface CustomerBill {
  id: string;
  href?: string;
  billNo?: string;
  runType?: string;
  category?: string;
  state?: CustomerBillState;
  lastUpdate?: string;
  billDate?: string;
  nextBillDate?: string;
  paymentDueDate?: string;
  billingPeriod?: TimePeriod;
  amountDue?: Money;
  taxIncludedAmount?: Money;
  taxExcludedAmount?: Money;
  remainingAmount?: Money;
  billingAccount?: BillingAccountRef;
  appliedPayment?: AppliedPayment[];
  paymentMethod?: PaymentMethodRef[];
  relatedParty?: RelatedParty[];
  taxItem?: TaxItem[];
  billDocument?: Array<{
    id: string;
    href?: string;
    name?: string;
    description?: string;
    mimeType?: string;
    url?: string;
    renderFormat?: ReceiptRenderFormat;
    contentEncoding?: 'base64';
    contentBase64?: string;
  }>;
  '@type'?: string;
  '@schemaLocation'?: string;
  '@baseType'?: string;
}

/** TMF-678 Create customer bill request */
export interface CreateCustomerBillRequest {
  billNo?: string;
  runType?: string;
  category?: string;
  billDate?: string;
  paymentDueDate?: string;
  billingPeriod?: TimePeriod;
  billingAccount: BillingAccountRef;
  amountDue?: Money;
  taxIncludedAmount?: Money;
  taxExcludedAmount?: Money;
  state?: CustomerBillState;
  appliedPayment?: AppliedPayment[];
  taxItem?: TaxItem[];
  paymentMethod?: PaymentMethodRef[];
  relatedParty?: RelatedParty[];
  renderReceipt?: RenderReceiptDocumentRequest;
}

/** TMF-678 Update customer bill request */
export interface UpdateCustomerBillRequest {
  state?: CustomerBillState;
  paymentDueDate?: string;
  appliedPayment?: AppliedPayment[];
  taxItem?: TaxItem[];
  paymentMethod?: PaymentMethodRef[];
}

/** Search criteria for customer bills */
export interface CustomerBillSearchCriteria {
  billNo?: string;
  state?: CustomerBillState;
  billingAccountId?: string;
  customerId?: string;
  billDateFrom?: string;
  billDateTo?: string;
  paymentDueDateFrom?: string;
  paymentDueDateTo?: string;
}

/** Paginated search results for customer bills */
export interface PaginatedCustomerBillResults {
  items: CustomerBill[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
