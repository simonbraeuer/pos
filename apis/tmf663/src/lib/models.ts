/** TMF-663 Shopping Cart Item */
export interface CartItem {
  id: string;
  action?: 'add' | 'modify' | 'delete' | 'noChange';
  quantity: number;
  itemPrice: CartItemPrice[];
  product?: ProductOfferingRef;
  /** Optional bundle breakdown for bundle positions. */
  bundleComponents?: BundleComponent[];
}

/** Editable component entry of a bundle cart position. */
export interface BundleComponent {
  id: string;
  name: string;
  quantity: number;
}

/** Price information for a cart item */
export interface CartItemPrice {
  name: string;
  description?: string;
  priceType: 'recurring' | 'oneTime' | 'usage';
  price: Price;
  productOfferingPrice?: ProductOfferingPriceRef;
}

/** Monetary amount with unit */
export interface Price {
  percentage?: number;
  taxRate?: number;
  dutyFreeAmount?: Money;
  taxIncludedAmount?: Money;
  unit?: string;
}

/** Money value with currency */
export interface Money {
  unit: string;
  value: number;
}

/** Reference to a product offering */
export interface ProductOfferingRef {
  id: string;
  href?: string;
  name: string;
  description?: string;
}

/** Reference to a product offering price */
export interface ProductOfferingPriceRef {
  id: string;
  href?: string;
  name?: string;
}

/** TMF-663 Shopping Cart */
export interface ShoppingCart {
  id: string;
  href?: string;
  cartItem: CartItem[];
  cartTotalPrice?: CartItemPrice[];
  customer?: CartCustomer;
  validFor?: {
    startDateTime?: string;
    endDateTime?: string;
  };
  status?: 'active' | 'cancelled' | 'completed';
}

export interface CartCustomer {
  name: string;
  email?: string;
  phone?: string;
}

/** Search criteria for shopping carts */
export interface CartSearchCriteria {
  id?: string;
  status?: 'active' | 'cancelled' | 'completed';
  minTotal?: number;
  maxTotal?: number;
}

/** Paginated search results */
export interface PaginatedCartResults {
  items: ShoppingCart[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Field names that may be required before a cart position can be created. */
export type MissingPositionField = 'serialNumber' | 'customerReference';

/** 
 * Search result row for sale offers/products/bundles.
 * Re-exported from TMF620 Product Catalog API for convenience.
 * In TMF-compliant architecture, shopping carts consume product offerings
 * from the product catalog management API.
 */
export type { ProductOfferingSearchResult as SaleOfferSearchResult } from '@pos/tmf620';

/** Request to add an offer as a position to a shopping cart. */
export interface AddCartPositionRequest {
  offerId: string;
  quantity: number;
  serialNumber?: string;
  customerReference?: string;
  /**
   * When present the position is treated as a return.
   * The price will be negated (negative gross/net) in the resulting cart item.
   * Provide the unit price of the original order position.
   * `originalQuantity` is the quantity on the source order item and is used
   * to enforce that the same position cannot be returned more times than ordered.
   */
  returnPrice?: { gross: number; net: number; currency: string; originalQuantity?: number };
}
