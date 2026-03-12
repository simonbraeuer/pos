/** TMF-620 Money value with currency */
export interface Money {
  unit: string;
  value: number;
}

/** TMF-620 Product Offering Price */
export interface ProductOfferingPrice {
  id: string;
  href?: string;
  name: string;
  description?: string;
  priceType: 'recurring' | 'oneTime' | 'usage';
  price: {
    percentage?: number;
    taxRate?: number;
    dutyFreeAmount?: Money;
    taxIncludedAmount?: Money;
  };
  validFor?: {
    startDateTime?: string;
    endDateTime?: string;
  };
}

/** TMF-620 Product Specification Characteristic */
export interface ProductSpecificationCharacteristic {
  name: string;
  value: string;
  valueType?: string;
}

/** TMF-620 Product Offering */
export interface ProductOffering {
  id: string;
  href?: string;
  name: string;
  description?: string;
  version?: string;
  lastUpdate?: string;
  lifecycleStatus?: 'active' | 'inactive' | 'retired';
  validFor?: {
    startDateTime?: string;
    endDateTime?: string;
  };
  isBundle?: boolean;
  productOfferingPrice?: ProductOfferingPrice[];
  productSpecCharacteristic?: ProductSpecificationCharacteristic[];
}

/** Field names that may be required before a product can be ordered. */
export type RequiredProductField = 'serialNumber' | 'customerReference';

/** Enhanced search result for product offerings optimized for cart operations */
export interface ProductOfferingSearchResult {
  id: string;
  kind: 'product' | 'bundle';
  name: string;
  productNumber: string;
  description?: string;
  currency: string;
  cheapestPrice: number;
  requiredFields: RequiredProductField[];
  knownSerialNumbers?: string[];
}

/** Search criteria for product offerings */
export interface ProductOfferingSearchCriteria {
  name?: string;
  productNumber?: string;
  serialNumber?: string;
  lifecycleStatus?: 'active' | 'inactive' | 'retired';
  isBundle?: boolean;
}

/** Paginated search results for product offerings */
export interface PaginatedProductResults {
  items: ProductOffering[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Request to create a new product offering */
export interface CreateProductOfferingRequest {
  name: string;
  description?: string;
  isBundle?: boolean;
  lifecycleStatus?: 'active' | 'inactive' | 'retired';
  productNumber: string;
  category?: string;
  requiresSerialNumber?: boolean;
  requiresCustomerReference?: boolean;
  knownSerialNumbers?: string[];
  customCharacteristics?: { name: string; value: string; valueType?: string }[];
  prices: {
    name: string;
    priceType: 'recurring' | 'oneTime' | 'usage';
    dutyFreeAmount: number;
    taxIncludedAmount: number;
    taxRate: number;
  }[];
}

/** Request to update an existing product offering */
export interface UpdateProductOfferingRequest {
  name?: string;
  description?: string;
  isBundle?: boolean;
  lifecycleStatus?: 'active' | 'inactive' | 'retired';
  productNumber?: string;
  category?: string;
  requiresSerialNumber?: boolean;
  requiresCustomerReference?: boolean;
  knownSerialNumbers?: string[];
  customCharacteristics?: { name: string; value: string; valueType?: string }[];
  prices?: {
    name: string;
    priceType: 'recurring' | 'oneTime' | 'usage';
    dutyFreeAmount: number;
    taxIncludedAmount: number;
    taxRate: number;
  }[];
}
