/** TMF-679 qualification issue linked to a cart or cart position. */
export interface CartValidationIssue {
  code: string;
  message: string;
  itemId?: string;
}

/** Qualification item request for one cart position/offering context. */
export interface ProductOfferingQualificationItem {
  itemId: string;
  productOfferingId: string;
  quantity: number;
  isBundle?: boolean;
  requiresCustomerReference?: boolean;
  hasCustomerReference?: boolean;
  lifecycleStatus?: 'active' | 'inactive' | 'retired';
}

/** TMF-679 qualification request payload. */
export interface ProductOfferingQualificationRequest {
  cartId: string;
  items: ProductOfferingQualificationItem[];
}

/** TMF-679 qualification result payload. */
export interface ProductOfferingQualificationResult {
  eligible: boolean;
  issues: CartValidationIssue[];
  qualifiedAt: string;
}
