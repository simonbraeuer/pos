/** TMF-622 Money value with currency */
export interface Money {
  unit: string;
  value: number;
}

/** TMF-622 Price structure */
export interface Price {
  percentage?: number;
  taxRate?: number;
  dutyFreeAmount?: Money;
  taxIncludedAmount?: Money;
}

/** TMF-622 Order price (total or item-level) */
export interface OrderPrice {
  name: string;
  description?: string;
  priceType: 'recurring' | 'oneTime' | 'usage';
  price: Price;
}

/** TMF-622 Product order state */
export type ProductOrderState =
  | 'acknowledged'
  | 'rejected'
  | 'pending'
  | 'held'
  | 'inProgress'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'partial';

/** TMF-622 Product order item state */
export type ProductOrderItemState =
  | 'acknowledged'
  | 'rejected'
  | 'pending'
  | 'held'
  | 'inProgress'
  | 'cancelled'
  | 'completed'
  | 'failed';

/** TMF-622 Related party (customer, contact, etc.) */
export interface RelatedParty {
  id: string;
  href?: string;
  name?: string;
  role: string; // e.g., 'customer', 'billingContact', 'technicalContact'
  '@referredType'?: string;
}

/** TMF-622 Product reference for order items */
export interface ProductRefOrValue {
  id?: string;
  href?: string;
  name?: string;
  description?: string;
  productSerialNumber?: string;
  productCharacteristic?: Array<{
    name: string;
    value: string;
    valueType?: string;
  }>;
}

/** TMF-622 Product order item */
export interface ProductOrderItem {
  id: string;
  quantity: number;
  action: 'add' | 'modify' | 'delete' | 'noChange';
  state?: ProductOrderItemState;
  productOffering?: {
    id: string;
    href?: string;
    name?: string;
  };
  product?: ProductRefOrValue;
  itemPrice?: OrderPrice[];
  itemTotalPrice?: OrderPrice[];
  billingAccount?: {
    id: string;
    href?: string;
  };
  appointment?: {
    id: string;
    href?: string;
    description?: string;
  };
}

/** TMF-622 Note/comment on order */
export interface Note {
  id?: string;
  author?: string;
  date?: string;
  text: string;
}

/** TMF-622 Product Order */
export interface ProductOrder {
  id: string;
  href?: string;
  externalId?: string;
  priority?: string;
  description?: string;
  category?: string;
  state?: ProductOrderState;
  orderDate?: string;
  completionDate?: string;
  requestedStartDate?: string;
  requestedCompletionDate?: string;
  expectedCompletionDate?: string;
  notificationContact?: string;
  relatedParty?: RelatedParty[];
  note?: Note[];
  productOrderItem: ProductOrderItem[];
  orderTotalPrice?: OrderPrice[];
  '@type'?: string;
  '@schemaLocation'?: string;
  '@baseType'?: string;
}

/** TMF-622 Create product order request */
export interface CreateProductOrderRequest {
  externalId?: string;
  priority?: string;
  description?: string;
  category?: string;
  requestedStartDate?: string;
  requestedCompletionDate?: string;
  notificationContact?: string;
  relatedParty?: RelatedParty[];
  note?: Note[];
  productOrderItem: Array<{
    id: string;
    quantity: number;
    action: 'add' | 'modify' | 'delete';
    productOffering: {
      id: string;
      name?: string;
    };
    product?: ProductRefOrValue;
    itemPrice?: OrderPrice[];
  }>;
}

/** TMF-622 Update product order request */
export interface UpdateProductOrderRequest {
  description?: string;
  priority?: string;
  requestedStartDate?: string;
  requestedCompletionDate?: string;
  notificationContact?: string;
  note?: Note[];
}

/** TMF-622 Cancel product order request */
export interface CancelProductOrderRequest {
  cancellationReason?: string;
  note?: string;
}

/** Search criteria for product orders */
export interface ProductOrderSearchCriteria {
  externalId?: string;
  state?: ProductOrderState;
  customerId?: string;
  orderDateFrom?: string;
  orderDateTo?: string;
  priority?: string;
}

/** Paginated search results for product orders */
export interface PaginatedOrderResults {
  items: ProductOrder[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
