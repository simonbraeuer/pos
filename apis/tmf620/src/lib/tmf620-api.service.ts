import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import {
  ProductOffering,
  ProductOfferingPrice,
  ProductOfferingSearchResult,
  ProductOfferingSearchCriteria,
  PaginatedProductResults,
  CreateProductOfferingRequest,
  UpdateProductOfferingRequest,
  ProductSpecificationCharacteristic,
} from './models';


// --- API Behaviour Config ---
interface ApiBehaviourConfig {
  latency: number;
  errorRate: number;
  failureStatus: number;
}

const API_BEHAVIOUR_KEY = 'pos_api_behaviour';
function getApiBehaviour(): ApiBehaviourConfig {
  try {
    const raw = localStorage.getItem(API_BEHAVIOUR_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { latency: 300, errorRate: 5, failureStatus: 503 };
}

function simulateLatency(): number {
  const { latency } = getApiBehaviour();
  // Add jitter: ±30%
  const jitter = latency * 0.3 * (Math.random() - 0.5) * 2;
  return Math.max(0, Math.round(latency + jitter));
}

function maybeNetworkError(): Observable<never> | null {
  const { errorRate, failureStatus } = getApiBehaviour();
  if (Math.random() < (errorRate / 100)) {
    const err = new Error('Product Catalog service temporarily unavailable') as any;
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

function normalizeSearch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Initial product catalog seed data */
const INITIAL_PRODUCT_OFFERINGS: ProductOffering[] = Array.from(new Map<string, ProductOffering>([
  [
    'offer-prod-sim-bundle-01',
    {
      id: 'offer-prod-sim-bundle-01',
      href: '/productCatalogManagement/v4/productOffering/offer-prod-sim-bundle-01',
      name: 'A-Netz SIM Starter Pack',
      description: '5er Paket 5G SIM-Karten für Österreich mit unbegrenztem Roaming in der EU',
      lifecycleStatus: 'active',
      isBundle: false,
      productOfferingPrice: [
        {
          id: 'price-sim-bundle-01',
          name: 'Einmaliger Kaufpreis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 15.99 },
            taxIncludedAmount: { unit: 'EUR', value: 19.19 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'SIM-A-NETZ-5G' },
        { name: 'category', value: 'Mobilfunk' },
      ],
    },
  ],
  [
    'offer-prod-mobile-phone-01',
    {
      id: 'offer-prod-mobile-phone-01',
      href: '/productCatalogManagement/v4/productOffering/offer-prod-mobile-phone-01',
      name: 'Premium Smartphone 5G',
      description: 'Top-Modell Smartphone mit 5G-Konnektivität für optimale Netzwerkbandbreite',
      lifecycleStatus: 'active',
      isBundle: false,
      productOfferingPrice: [
        {
          id: 'price-mobile-phone-01',
          name: 'Einmaliger Kaufpreis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 249.99 },
            taxIncludedAmount: { unit: 'EUR', value: 299.99 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'PHN-PREM-5G' },
        { name: 'category', value: 'Mobilgerät' },
        { name: 'requiresSerialNumber', value: 'true' },
        { name: 'knownSerialNumbers', value: 'SER-MOB-001,SER-MOB-002' },
      ],
    },
  ],
  [
    'offer-prod-phone-case-01',
    {
      id: 'offer-prod-phone-case-01',
      href: '/productCatalogManagement/v4/productOffering/offer-prod-phone-case-01',
      name: 'Business Smartphone Schutzbundle',
      description: '3er Set Premium Schutzhüllen mit Displayschutzer für professionelle Nutzung',
      lifecycleStatus: 'active',
      isBundle: false,
      productOfferingPrice: [
        {
          id: 'price-phone-case-01',
          name: 'Einmaliger Kaufpreis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 12.49 },
            taxIncludedAmount: { unit: 'EUR', value: 14.99 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'CASE-PROT-BIZ' },
        { name: 'category', value: 'Zubehör' },
      ],
    },
  ],
  [
    'offer-prod-network-cable-01',
    {
      id: 'offer-prod-network-cable-01',
      href: '/productCatalogManagement/v4/productOffering/offer-prod-network-cable-01',
      name: 'Glasfaser-Installationsset',
      description: '20er Paket hochperformante Glasfaserkabel für die Datenleitung zu österreichischen Geschäftskunden',
      lifecycleStatus: 'active',
      isBundle: false,
      productOfferingPrice: [
        {
          id: 'price-network-cable-01',
          name: 'Einmaliger Kaufpreis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 8.25 },
            taxIncludedAmount: { unit: 'EUR', value: 9.9 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'FIB-GF-KIT-20' },
        { name: 'category', value: 'Netzwerk-Equipment' },
      ],
    },
  ],
  [
    'offer-prod-broadband-router-01',
    {
      id: 'offer-prod-broadband-router-01',
      href: '/productCatalogManagement/v4/productOffering/offer-prod-broadband-router-01',
      name: 'ASTL-10G Glasfaser-Router',
      description: 'Enterprise 5G/Glasfaser Router mit Mesh-Netzwerk und Lastverteilung für Unternehmensstandorte',
      lifecycleStatus: 'active',
      isBundle: false,
      productOfferingPrice: [
        {
          id: 'price-broadband-router-01',
          name: 'Einmaliger Kaufpreis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 107.5 },
            taxIncludedAmount: { unit: 'EUR', value: 129.0 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'RTR-ASTL-10G' },
        { name: 'category', value: 'Netzwerk-Equipment' },
        { name: 'requiresSerialNumber', value: 'true' },
        { name: 'knownSerialNumbers', value: 'SER-RTR-001,SER-RTR-002' },
      ],
    },
  ],
  [
    'offer-prod-voip-phone-01',
    {
      id: 'offer-prod-voip-phone-01',
      href: '/productCatalogManagement/v4/productOffering/offer-prod-voip-phone-01',
      name: 'VoIP-Telefon Systeme Kompakt',
      description: 'Kompaktes VoIP-Telefonsystem für kleine und mittlere Unternehmen in Österreich',
      lifecycleStatus: 'active',
      isBundle: false,
      productOfferingPrice: [
        {
          id: 'price-voip-phone-01',
          name: 'Einmaliger Kaufpreis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 165.83 },
            taxIncludedAmount: { unit: 'EUR', value: 199.0 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'VOIP-KMP-48' },
        { name: 'category', value: 'Kommunikations-Equipment' },
        { name: 'knownSerialNumbers', value: 'SER-VOIP-A1,SER-VOIP-B2' },
      ],
    },
  ],
  [
    'offer-prod-business-gateway-01',
    {
      id: 'offer-prod-business-gateway-01',
      href: '/productCatalogManagement/v4/productOffering/offer-prod-business-gateway-01',
      name: 'IoT Cellular Gateway Pro AT',
      description: 'Professionelles IoT-Mobilfunk-Gateway mit 4G/5G Backup-Konnektivität für Österreich',
      lifecycleStatus: 'active',
      isBundle: false,
      productOfferingPrice: [
        {
          id: 'price-business-gateway-01',
          name: 'Einmaliger Kaufpreis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 74.58 },
            taxIncludedAmount: { unit: 'EUR', value: 89.5 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'GW-IOT-5G-AT' },
        { name: 'category', value: 'IoT-Equipment' },
        { name: 'requiresSerialNumber', value: 'true' },
        { name: 'knownSerialNumbers', value: 'SER-GW-IOT-01,SER-GW-IOT-02' },
      ],
    },
  ],
  [
    'offer-bundle-telco-01',
    {
      id: 'offer-bundle-telco-01',
      href: '/productCatalogManagement/v4/productOffering/offer-bundle-telco-01',
      name: 'TMF Telco GmbH Plus Bundle',
      description: 'Komplette Telekommunikationslösung: Mobilfunk + Glasfaser-Internetverbindung + VoIP-System',
      lifecycleStatus: 'active',
      isBundle: true,
      productOfferingPrice: [
        {
          id: 'price-bundle-telco-01',
          name: 'Bundle-Preis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 1082.5 },
            taxIncludedAmount: { unit: 'EUR', value: 1299.0 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'BND-AT-PLUS' },
        { name: 'category', value: 'Bundle' },
        { name: 'requiresCustomerReference', value: 'true' },
      ],
    },
  ],
  [
    'offer-prod-fast-charger-01',
    {
      id: 'offer-prod-fast-charger-01',
      href: '/productCatalogManagement/v4/productOffering/offer-prod-fast-charger-01',
      name: 'USB-C Schnellladegerät für Smartphones',
      description: 'Hochleistungs USB-C Schnellladegerät für Mehrgeräte-Unterstützung',
      lifecycleStatus: 'active',
      isBundle: false,
      productOfferingPrice: [
        {
          id: 'price-fast-charger-01',
          name: 'Einmaliger Kaufpreis',
          priceType: 'oneTime',
          price: {
            dutyFreeAmount: { unit: 'EUR', value: 49.92 },
            taxIncludedAmount: { unit: 'EUR', value: 59.9 },
            taxRate: 20,
          },
        },
      ],
      productSpecCharacteristic: [
        { name: 'productNumber', value: 'CHG-USB-C-65' },
        { name: 'category', value: 'Zubehör' },
        { name: 'knownSerialNumbers', value: 'SER-CHG-001,SER-CHG-002' },
      ],
    },
  ],
]).values());

const STORE_NAME = 'product-offerings';
const DB_NAME = 'pos-tmf620-product-catalog';

/**
 * TMF-620 Product Catalog Management API Service
 * 
 * Provides access to product offerings, prices, and specifications
 * following the TMForum TMF-620 standard.
 */
@Injectable({ providedIn: 'root' })
export class Tmf620ApiService implements OnInit {
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'tmf620', '/productCatalogManagement/v4/productOffering');
  }

  ngOnInit(): void {
    this.initializeDb();
  }

  private initializeDb(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      await this.idb.initialize(DB_NAME, [{ name: STORE_NAME, keyPath: 'id', autoIncrement: false }]);
      const count = await firstValueFrom(this.idb.count(STORE_NAME));
      if (count === 0) {
        for (const offering of INITIAL_PRODUCT_OFFERINGS) {
          await firstValueFrom(this.idb.put(STORE_NAME, offering));
        }
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  /**
   * Retrieve a product offering by ID
   * @param offeringId The unique identifier of the product offering
   * @returns Observable of the product offering or error
   */
  getProductOffering(offeringId: string): Observable<ProductOffering> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          try {
            const offering = await firstValueFrom(this.idb.get<ProductOffering>(STORE_NAME, offeringId));
            setTimeout(() => {
              subscriber.next(offering);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Product offering not found: ${offeringId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * List all product offerings
   * @returns Observable of product offering array
   */
  listProductOfferings(): Observable<ProductOffering[]> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const offerings = (await firstValueFrom(this.idb.getAll<ProductOffering>(STORE_NAME))).filter(
            (o) => o.lifecycleStatus === 'active'
          );
          setTimeout(() => {
            subscriber.next(offerings);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Search product offerings by name, product number, or serial number
   * Optimized for shopping cart operations.
   * 
   * @param searchTerm Search query (name, product number, or serial number)
   * @returns Observable of search results
   */
  searchProductOfferings(searchTerm: string): Observable<ProductOfferingSearchResult[]> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const q = searchTerm.trim().toLowerCase();
          const nq = normalizeSearch(searchTerm.trim());
          const qTokens = q.split(/\s+/).filter(Boolean);
          const nTokens = nq.split(/\s+/).filter(Boolean);

          const offerings = (await firstValueFrom(this.idb.getAll<ProductOffering>(STORE_NAME))).filter(
            (o) => o.lifecycleStatus === 'active'
          );

    // Return all if no search term
          if (!q) {
            const results = offerings.map((o) => this.toSearchResult(o));
            setTimeout(() => {
              subscriber.next(results.sort((a, b) => a.cheapestPrice - b.cheapestPrice));
              subscriber.complete();
            }, simulateLatency());
            return;
          }

    // Search with LIKE-style matching
          const results = offerings
      .filter(offering => {
        const productNumber = this.getCharacteristic(offering, 'productNumber') || '';
        const knownSerials = this.getCharacteristic(offering, 'knownSerialNumbers') || '';
        
        const textHaystack = [
          offering.id,
          offering.name,
          productNumber,
          offering.description ?? '',
          knownSerials,
        ]
          .join(' ')
          .toLowerCase();

        const normalizedHaystack = normalizeSearch(textHaystack);

        // Broad LIKE-style behavior: phrase match or any term match.
        const phraseMatch = textHaystack.includes(q);
        const normalizedPhraseMatch = normalizedHaystack.includes(nq);
        const tokenLikeMatch = qTokens.some(token => textHaystack.includes(token));
        const normalizedLikeMatch = nTokens.some(token => normalizedHaystack.includes(token));

        return phraseMatch || normalizedPhraseMatch || tokenLikeMatch || normalizedLikeMatch;
      })
      .map(o => this.toSearchResult(o))
      .sort((a, b) => a.cheapestPrice - b.cheapestPrice);

          setTimeout(() => {
            subscriber.next(results);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Convert a ProductOffering to a simplified SearchResult format
   * optimized for cart operations.
   */
  private toSearchResult(offering: ProductOffering): ProductOfferingSearchResult {
    const productNumber = this.getCharacteristic(offering, 'productNumber') || '';
    const requiresSerialNumber = this.getCharacteristic(offering, 'requiresSerialNumber') === 'true';
    const requiresCustomerReference = this.getCharacteristic(offering, 'requiresCustomerReference') === 'true';
    const knownSerialsStr = this.getCharacteristic(offering, 'knownSerialNumbers') || '';
    const knownSerialNumbers = knownSerialsStr ? knownSerialsStr.split(',') : undefined;

    const requiredFields: ('serialNumber' | 'customerReference')[] = [];
    if (requiresSerialNumber) requiredFields.push('serialNumber');
    if (requiresCustomerReference) requiredFields.push('customerReference');

    // Get cheapest price
    const prices = offering.productOfferingPrice || [];
    const cheapestPrice = prices.length > 0
      ? Math.min(...prices.map(p => p.price.taxIncludedAmount?.value || 0))
      : 0;

    const currency = prices[0]?.price.taxIncludedAmount?.unit || 'EUR';

    return {
      id: offering.id,
      kind: offering.isBundle ? 'bundle' : 'product',
      name: offering.name,
      productNumber,
      description: offering.description,
      currency,
      cheapestPrice,
      requiredFields,
      knownSerialNumbers,
    };
  }

  /**
   * Get a characteristic value from a product offering
   */
  private getCharacteristic(offering: ProductOffering, name: string): string | undefined {
    return offering.productSpecCharacteristic?.find(c => c.name === name)?.value;
  }

  /**
   * Search product offerings with pagination and filters
   * @param criteria Search criteria
   * @param page Page number (0-indexed)
   * @param pageSize Number of items per page
   * @returns Observable of paginated results
   */
  searchProductOfferingsPaginated(
    criteria: ProductOfferingSearchCriteria,
    page = 0,
    pageSize = 10
  ): Observable<PaginatedProductResults> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let offerings = await firstValueFrom(this.idb.getAll<ProductOffering>(STORE_NAME));

    // Filter by lifecycle status
    if (criteria.lifecycleStatus) {
      offerings = offerings.filter(o => o.lifecycleStatus === criteria.lifecycleStatus);
    }

    // Filter by bundle flag
    if (criteria.isBundle !== undefined) {
      offerings = offerings.filter(o => o.isBundle === criteria.isBundle);
    }

    // Filter by name
    if (criteria.name) {
      const nameLower = criteria.name.toLowerCase();
      offerings = offerings.filter(o => o.name.toLowerCase().includes(nameLower));
    }

    // Filter by product number
    if (criteria.productNumber) {
      const productNumberLower = criteria.productNumber.toLowerCase();
      offerings = offerings.filter(o => {
        const productNumber = this.getCharacteristic(o, 'productNumber') || '';
        return productNumber.toLowerCase().includes(productNumberLower);
      });
    }

    // Filter by serial number
    if (criteria.serialNumber) {
      const serialLower = criteria.serialNumber.toLowerCase();
      offerings = offerings.filter(o => {
        const serials = this.getCharacteristic(o, 'knownSerialNumbers') || '';
        return serials.toLowerCase().includes(serialLower);
      });
    }

    const total = offerings.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = offerings.slice(start, end);
    const hasMore = end < total;

          const result: PaginatedProductResults = {
            items,
            total,
            page,
            pageSize,
            hasMore,
          };

          setTimeout(() => {
            subscriber.next(result);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Create a new product offering
   * @param request Product offering creation data
   * @returns Observable of the created product offering
   */
  createProductOffering(request: CreateProductOfferingRequest): Observable<ProductOffering> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const newId = `offer-${request.isBundle ? 'bundle' : 'prod'}-${Date.now()}`;
    
    const characteristics: ProductSpecificationCharacteristic[] = [
      { name: 'productNumber', value: request.productNumber },
    ];

    if (request.category) {
      characteristics.push({ name: 'category', value: request.category });
    }

    if (request.requiresSerialNumber) {
      characteristics.push({ name: 'requiresSerialNumber', value: 'true' });
    }

    if (request.requiresCustomerReference) {
      characteristics.push({ name: 'requiresCustomerReference', value: 'true' });
    }

    if (request.knownSerialNumbers && request.knownSerialNumbers.length > 0) {
      characteristics.push({
        name: 'knownSerialNumbers',
        value: request.knownSerialNumbers.join(','),
      });
    }

    // Add custom characteristics
    if (request.customCharacteristics && request.customCharacteristics.length > 0) {
      request.customCharacteristics.forEach(char => {
        characteristics.push({
          name: char.name,
          value: char.value,
          valueType: char.valueType,
        });
      });
    }

    const prices: ProductOfferingPrice[] = request.prices.map((p, idx) => ({
      id: `price-${newId}-${idx}`,
      name: p.name,
      priceType: p.priceType,
      price: {
        dutyFreeAmount: { unit: 'EUR', value: p.dutyFreeAmount },
        taxIncludedAmount: { unit: 'EUR', value: p.taxIncludedAmount },
        taxRate: p.taxRate,
      },
    }));

    const newOffering: ProductOffering = {
      id: newId,
      href: `/productCatalogManagement/v4/productOffering/${newId}`,
      name: request.name,
      description: request.description,
      lifecycleStatus: request.lifecycleStatus || 'active',
      isBundle: request.isBundle || false,
      productOfferingPrice: prices,
      productSpecCharacteristic: characteristics,
      lastUpdate: new Date().toISOString(),
    };

          await firstValueFrom(this.idb.put(STORE_NAME, newOffering));
          setTimeout(() => {
            subscriber.next(newOffering);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Update an existing product offering
   * @param offeringId The ID of the product offering to update
   * @param updates Partial product offering data to update
   * @returns Observable of the updated product offering
   */
  updateProductOffering(
    offeringId: string,
    updates: UpdateProductOfferingRequest
  ): Observable<ProductOffering> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let offering: ProductOffering;
          try {
            offering = await firstValueFrom(this.idb.get<ProductOffering>(STORE_NAME, offeringId));
          } catch {
            const err = new Error(`Product offering not found: ${offeringId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

    // Update basic fields
    if (updates.name !== undefined) offering.name = updates.name;
    if (updates.description !== undefined) offering.description = updates.description;
    if (updates.lifecycleStatus !== undefined) offering.lifecycleStatus = updates.lifecycleStatus;
    if (updates.isBundle !== undefined) offering.isBundle = updates.isBundle;

    // Update characteristics
    const characteristics = offering.productSpecCharacteristic || [];
    
    if (updates.productNumber !== undefined) {
      const idx = characteristics.findIndex(c => c.name === 'productNumber');
      if (idx >= 0) {
        characteristics[idx].value = updates.productNumber;
      } else {
        characteristics.push({ name: 'productNumber', value: updates.productNumber });
      }
    }

    if (updates.category !== undefined) {
      const idx = characteristics.findIndex(c => c.name === 'category');
      if (idx >= 0) {
        characteristics[idx].value = updates.category;
      } else {
        characteristics.push({ name: 'category', value: updates.category });
      }
    }

    if (updates.requiresSerialNumber !== undefined) {
      const idx = characteristics.findIndex(c => c.name === 'requiresSerialNumber');
      const value = updates.requiresSerialNumber ? 'true' : 'false';
      if (idx >= 0) {
        characteristics[idx].value = value;
      } else {
        characteristics.push({ name: 'requiresSerialNumber', value });
      }
    }

    if (updates.requiresCustomerReference !== undefined) {
      const idx = characteristics.findIndex(c => c.name === 'requiresCustomerReference');
      const value = updates.requiresCustomerReference ? 'true' : 'false';
      if (idx >= 0) {
        characteristics[idx].value = value;
      } else {
        characteristics.push({ name: 'requiresCustomerReference', value });
      }
    }

    if (updates.knownSerialNumbers !== undefined) {
      const idx = characteristics.findIndex(c => c.name === 'knownSerialNumbers');
      const value = updates.knownSerialNumbers.join(',');
      if (idx >= 0) {
        characteristics[idx].value = value;
      } else {
        characteristics.push({ name: 'knownSerialNumbers', value });
      }
    }

    // Update custom characteristics
    if (updates.customCharacteristics !== undefined) {
      // Define the reserved characteristic names
      const reservedNames = [
        'productNumber',
        'category',
        'requiresSerialNumber',
        'requiresCustomerReference',
        'knownSerialNumbers',
      ];

      // Remove all non-reserved characteristics (custom ones)
      const filteredChars = characteristics.filter(c => reservedNames.includes(c.name));

      // Add the new custom characteristics
      updates.customCharacteristics.forEach(char => {
        filteredChars.push({
          name: char.name,
          value: char.value,
          valueType: char.valueType,
        });
      });

      offering.productSpecCharacteristic = filteredChars;
    } else {
      offering.productSpecCharacteristic = characteristics;
    }

    // Update prices
    if (updates.prices !== undefined) {
      offering.productOfferingPrice = updates.prices.map((p, idx) => ({
        id: `price-${offeringId}-${idx}`,
        name: p.name,
        priceType: p.priceType,
        price: {
          dutyFreeAmount: { unit: 'EUR', value: p.dutyFreeAmount },
          taxIncludedAmount: { unit: 'EUR', value: p.taxIncludedAmount },
          taxRate: p.taxRate,
        },
      }));
    }

          offering.lastUpdate = new Date().toISOString();
          await firstValueFrom(this.idb.put(STORE_NAME, offering));
          setTimeout(() => {
            subscriber.next(offering);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Delete a product offering
   * @param offeringId The ID of the product offering to delete
   * @returns Observable that completes when deletion is done
   */
  deleteProductOffering(offeringId: string): Observable<void> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          try {
            await firstValueFrom(this.idb.get<ProductOffering>(STORE_NAME, offeringId));
            await firstValueFrom(this.idb.delete(STORE_NAME, offeringId));
            setTimeout(() => {
              subscriber.next(undefined);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Product offering not found: ${offeringId}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }
}
