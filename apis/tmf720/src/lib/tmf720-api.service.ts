/**
 * TMF-720 Digital Identity Management API Service
 * Mock implementation for digital identity operations.
 */
import { Injectable, OnInit, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { IdbService } from '@pos/idb-storage';
import { instrumentMockHarLogging } from '@pos/tmf688';
import type {
  DigitalIdentity,
  DigitalIdentitySearchResult,
  DigitalIdentitySearchParams,
  CreateDigitalIdentityRequest,
  UpdateDigitalIdentityRequest,
  VerifyIdentityRequest,
  VerifyIdentityResponse,
  ManageConsentRequest,
  IdentityConsent,
  VerificationRecord,
  IdentityAttribute,
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
  const jitter = latency * 0.3 * (Math.random() - 0.5) * 2;
  return Math.max(0, Math.round(latency + jitter));
}

function maybeNetworkError(): Observable<never> | null {
  const { errorRate, failureStatus } = getApiBehaviour();
  if (Math.random() < (errorRate / 100)) {
    const err = new Error('Network error: Request timed out') as Error & { status?: number };
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

const STORE_NAME = 'digital-identities';
const DB_NAME = 'pos-tmf720-digital-identity';

@Injectable({
  providedIn: 'root',
})
export class Tmf720ApiService implements OnInit {
  private readonly idb = inject(IdbService);
  private initPromise: Promise<void> | null = null;

  constructor() {
    instrumentMockHarLogging(this, 'tmf720', '/digitalIdentity/v4/digitalIdentity');
  }

  /**
   * Mock digital identity store
   */
  private mockIdentities: DigitalIdentity[] = [
    {
      id: 'di-001',
      href: '/digitalIdentity/di-001',
      identityType: 'individual',
      status: 'verified',
      verificationLevel: 'high',
      createdDate: '2024-01-15T10:30:00Z',
      lastModifiedDate: '2024-01-20T14:22:00Z',
      lastVerifiedDate: '2024-01-20T14:22:00Z',
      credential: [
        {
          id: 'cred-001',
          credentialType: 'password',
          status: 'active',
          createdDate: '2024-01-15T10:30:00Z',
          lastUsedDate: '2024-01-25T09:15:00Z',
          credentialValue: btoa('admin'),
        },
        {
          id: 'cred-002',
          credentialType: 'biometric',
          status: 'active',
          createdDate: '2024-01-20T14:00:00Z',
          credentialValue: 'fingerprint_template_hash',
        },
      ],
      attribute: [
        {
          id: 'attr-000',
          name: 'username',
          value: 'admin',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-15T10:45:00Z',
        },
        {
          id: 'attr-00x',
          name: 'displayName',
          value: 'Administrator',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-15T10:45:00Z',
        },
        {
          id: 'attr-00y',
          name: 'role',
          value: 'admin',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-15T10:45:00Z',
        },
        {
          id: 'attr-001',
          name: 'email',
          value: 'admin@tmf-telco.local',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-15T11:00:00Z',
        },
        {
          id: 'attr-002',
          name: 'phoneNumber',
          value: '+43512123456',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-15T11:30:00Z',
        },
        {
          id: 'attr-003',
          name: 'dateOfBirth',
          value: '1985-06-15',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-20T14:22:00Z',
        },
      ],
      verificationRecord: [
        {
          id: 'ver-001',
          verificationType: 'emailOTP',
          verificationDate: '2024-01-15T11:00:00Z',
          verificationResult: 'passed',
          verificationLevel: 'low',
          verificationMethod: 'one-time-password',
        },
        {
          id: 'ver-002',
          verificationType: 'documentCheck',
          verificationDate: '2024-01-20T14:22:00Z',
          verificationResult: 'passed',
          verificationLevel: 'high',
          verificationMethod: 'passport-verification',
          verificationEvidence: [
            {
              id: 'ev-001',
              evidenceType: 'passport',
              documentId: 'P123456789',
              issuer: 'Government Authority',
              issuedDate: '2020-03-10',
              expiryDate: '2030-03-10',
            },
          ],
        },
      ],
      consent: [
        {
          id: 'con-001',
          consentType: 'dataProcessing',
          status: 'granted',
          consentGivenDate: '2024-01-15T10:30:00Z',
          purpose: 'Account management and service delivery',
          scope: ['profile', 'transactions', 'preferences'],
        },
        {
          id: 'con-002',
          consentType: 'marketing',
          status: 'granted',
          consentGivenDate: '2024-01-15T10:30:00Z',
          purpose: 'Marketing communications',
          scope: ['email', 'sms'],
        },
      ],
      relatedParty: [
        {
          id: 'admin',
          name: 'Administrator',
          role: 'owner',
          '@referredType': 'Individual',
        },
      ],
      '@type': 'DigitalIdentity',
    },
    {
      id: 'di-002',
      href: '/digitalIdentity/di-002',
      identityType: 'individual',
      status: 'pendingVerification',
      verificationLevel: 'low',
      createdDate: '2024-01-24T16:45:00Z',
      lastModifiedDate: '2024-01-24T16:45:00Z',
      credential: [
        {
          id: 'cred-003',
          credentialType: 'password',
          status: 'active',
          createdDate: '2024-01-24T16:45:00Z',
          credentialValue: btoa('kassier'),
        },
      ],
      attribute: [
        {
          id: 'attr-008',
          name: 'username',
          value: 'kassier',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-24T16:50:00Z',
        },
        {
          id: 'attr-009',
          name: 'displayName',
          value: 'Kassier',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-24T16:50:00Z',
        },
        {
          id: 'attr-010',
          name: 'role',
          value: 'user',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-24T16:50:00Z',
        },
        {
          id: 'attr-004',
          name: 'email',
          value: 'kassier@tmf-telco.local',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-24T16:50:00Z',
        },
        {
          id: 'attr-005',
          name: 'phoneNumber',
          value: '+43664123456',
          verificationStatus: 'pending',
        },
      ],
      verificationRecord: [
        {
          id: 'ver-003',
          verificationType: 'emailOTP',
          verificationDate: '2024-01-24T16:50:00Z',
          verificationResult: 'passed',
          verificationLevel: 'low',
          verificationMethod: 'one-time-password',
        },
      ],
      consent: [
        {
          id: 'con-003',
          consentType: 'dataProcessing',
          status: 'granted',
          consentGivenDate: '2024-01-24T16:45:00Z',
          purpose: 'Account management',
          scope: ['profile'],
        },
      ],
      relatedParty: [
        {
          id: 'user',
          name: 'Regular User',
          role: 'owner',
          '@referredType': 'Individual',
        },
      ],
      '@type': 'DigitalIdentity',
    },
    {
      id: 'di-003',
      href: '/digitalIdentity/di-003',
      identityType: 'organization',
      status: 'verified',
      verificationLevel: 'medium',
      createdDate: '2024-01-10T08:00:00Z',
      lastModifiedDate: '2024-01-18T12:00:00Z',
      lastVerifiedDate: '2024-01-18T12:00:00Z',
      credential: [
        {
          id: 'cred-004',
          credentialType: 'certificate',
          status: 'active',
          createdDate: '2024-01-18T12:00:00Z',
          validFor: {
            startDateTime: '2024-01-18T00:00:00Z',
            endDateTime: '2025-01-18T00:00:00Z',
          },
          credentialValue: 'x509_certificate_hash',
        },
      ],
      attribute: [
        {
          id: 'attr-006',
          name: 'legalName',
          value: 'Acme Corporation',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-18T12:00:00Z',
        },
        {
          id: 'attr-007',
          name: 'taxId',
          value: 'TAX-123456789',
          verificationStatus: 'verified',
          verifiedDate: '2024-01-18T12:00:00Z',
        },
      ],
      verificationRecord: [
        {
          id: 'ver-004',
          verificationType: 'documentCheck',
          verificationDate: '2024-01-18T12:00:00Z',
          verificationResult: 'passed',
          verificationLevel: 'medium',
          verificationMethod: 'business-registration-check',
          verificationEvidence: [
            {
              id: 'ev-002',
              evidenceType: 'businessRegistration',
              documentId: 'BR-987654321',
              issuer: 'Business Registry',
              issuedDate: '2020-05-20',
            },
          ],
        },
      ],
      consent: [
        {
          id: 'con-004',
          consentType: 'dataProcessing',
          status: 'granted',
          consentGivenDate: '2024-01-10T08:00:00Z',
          purpose: 'Business account operations',
          scope: ['profile', 'transactions', 'employees'],
        },
      ],
      relatedParty: [
        {
          id: 'org-001',
          name: 'Acme Corporation',
          role: 'owner',
          '@referredType': 'Organization',
        },
        {
          id: 'user-003',
          name: 'Admin User',
          role: 'administrator',
          '@referredType': 'Individual',
        },
      ],
      '@type': 'DigitalIdentity',
    },
  ];

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
        for (const identity of this.mockIdentities) {
          await firstValueFrom(this.idb.put(STORE_NAME, identity));
        }
      }
    })();

    return this.initPromise;
  }

  private ensureInitialized(): Promise<void> {
    return this.initializeDb();
  }

  createDigitalIdentity(request: CreateDigitalIdentityRequest): Observable<DigitalIdentity> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          const existing = await firstValueFrom(this.idb.getAll<DigitalIdentity>(STORE_NAME));
          const newId = `di-${String(existing.length + 1).padStart(3, '0')}`;
          const now = new Date().toISOString();
          const newIdentity: DigitalIdentity = {
            id: newId,
            href: `/digitalIdentity/${newId}`,
            identityType: request.identityType,
            status: 'pendingVerification',
            verificationLevel: request.verificationLevel || 'none',
            createdDate: now,
            lastModifiedDate: now,
            validFor: request.validFor,
            credential: request.credential?.map((cred, idx) => ({
              id: `cred-${newId}-${idx + 1}`,
              ...cred,
              createdDate: now,
            })),
            attribute: request.attribute?.map((attr, idx) => ({
              id: `attr-${newId}-${idx + 1}`,
              ...attr,
            })),
            relatedParty: request.relatedParty,
            verificationRecord: [],
            consent: [],
            '@type': 'DigitalIdentity',
          };

          await firstValueFrom(this.idb.put(STORE_NAME, newIdentity));
          setTimeout(() => {
            subscriber.next(newIdentity);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  getDigitalIdentity(id: string): Observable<DigitalIdentity> {
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
            const identity = await firstValueFrom(this.idb.get<DigitalIdentity>(STORE_NAME, id));
            setTimeout(() => {
              subscriber.next(identity);
              subscriber.complete();
            }, simulateLatency());
          } catch {
            const err = new Error(`Digital identity not found: ${id}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
          }
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  searchDigitalIdentities(params: DigitalIdentitySearchParams = {}): Observable<DigitalIdentitySearchResult> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let filtered = await firstValueFrom(this.idb.getAll<DigitalIdentity>(STORE_NAME));
          if (params.identityType) filtered = filtered.filter((i) => i.identityType === params.identityType);
          if (params.status) filtered = filtered.filter((i) => i.status === params.status);
          if (params.verificationLevel) {
            filtered = filtered.filter((i) => i.verificationLevel === params.verificationLevel);
          }
          if (params.relatedPartyId) {
            filtered = filtered.filter((i) => i.relatedParty?.some((rp) => rp.id === params.relatedPartyId));
          }

          const page = params.page || 1;
          const pageSize = params.pageSize || 10;
          const startIndex = (page - 1) * pageSize;
          const endIndex = startIndex + pageSize;

          const result: DigitalIdentitySearchResult = {
            items: filtered.slice(startIndex, endIndex),
            totalCount: filtered.length,
            page,
            pageSize,
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

  updateDigitalIdentity(id: string, request: UpdateDigitalIdentityRequest): Observable<DigitalIdentity> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let identity: DigitalIdentity;
          try {
            identity = await firstValueFrom(this.idb.get<DigitalIdentity>(STORE_NAME, id));
          } catch {
            const err = new Error(`Digital identity not found: ${id}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          const now = new Date().toISOString();
          if (request.status) identity.status = request.status;
          if (request.verificationLevel) identity.verificationLevel = request.verificationLevel;
          if (request.validFor) identity.validFor = request.validFor;

          if (request.credential) {
            request.credential.forEach((credUpdate) => {
              if (credUpdate.id) {
                const existingCred = identity.credential?.find((c) => c.id === credUpdate.id);
                if (existingCred) Object.assign(existingCred, credUpdate);
              }
            });
          }
          if (request.attribute) {
            request.attribute.forEach((attrUpdate) => {
              if (attrUpdate.id) {
                const existingAttr = identity.attribute?.find((a) => a.id === attrUpdate.id);
                if (existingAttr) Object.assign(existingAttr, attrUpdate);
              }
            });
          }
          if (request.consent) {
            request.consent.forEach((consentUpdate) => {
              if (consentUpdate.id) {
                const existingConsent = identity.consent?.find((c) => c.id === consentUpdate.id);
                if (existingConsent) Object.assign(existingConsent, consentUpdate);
              }
            });
          }

          identity.lastModifiedDate = now;
          await firstValueFrom(this.idb.put(STORE_NAME, identity));
          setTimeout(() => {
            subscriber.next(identity);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  verifyIdentity(id: string, request: VerifyIdentityRequest): Observable<VerifyIdentityResponse> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let identity: DigitalIdentity;
          try {
            identity = await firstValueFrom(this.idb.get<DigitalIdentity>(STORE_NAME, id));
          } catch {
            const err = new Error(`Digital identity not found: ${id}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          const now = new Date().toISOString();
          const verificationRecord: VerificationRecord = {
            id: `ver-${String((identity.verificationRecord?.length || 0) + 1).padStart(3, '0')}`,
            verificationType: request.verificationType,
            verificationDate: now,
            verificationResult: 'passed',
            verificationLevel: this.determineVerificationLevel(request.verificationType),
            verificationMethod: request.verificationMethod,
            verificationEvidence: request.verificationEvidence?.map((ev, idx) => ({
              id: `ev-${identity.id}-${idx + 1}`,
              ...ev,
            })),
          };

          if (!identity.verificationRecord) {
            identity.verificationRecord = [];
          }
          identity.verificationRecord.push(verificationRecord);

          const updatedAttributes: IdentityAttribute[] = [];
          if (request.attributesToVerify && identity.attribute) {
            request.attributesToVerify.forEach((attrName) => {
              const attr = identity.attribute?.find((a) => a.name === attrName || a.id === attrName);
              if (attr) {
                attr.verificationStatus = 'verified';
                attr.verifiedDate = now;
                updatedAttributes.push(attr);
              }
            });
          }

          const newVerificationLevel = verificationRecord.verificationLevel;
          if (this.isHigherVerificationLevel(newVerificationLevel, identity.verificationLevel)) {
            identity.verificationLevel = newVerificationLevel;
          }

          if (identity.status === 'pendingVerification' && this.hasBasicVerification(identity)) {
            identity.status = 'verified';
          }

          identity.lastVerifiedDate = now;
          identity.lastModifiedDate = now;
          await firstValueFrom(this.idb.put(STORE_NAME, identity));

          const response: VerifyIdentityResponse = {
            verificationRecord,
            updatedAttributes,
            newVerificationLevel: identity.verificationLevel,
          };

          setTimeout(() => {
            subscriber.next(response);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  manageConsent(id: string, request: ManageConsentRequest): Observable<IdentityConsent> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let identity: DigitalIdentity;
          try {
            identity = await firstValueFrom(this.idb.get<DigitalIdentity>(STORE_NAME, id));
          } catch {
            const err = new Error(`Digital identity not found: ${id}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          const now = new Date().toISOString();
          let consent = identity.consent?.find((c) => c.consentType === request.consentType);
          if (consent) {
            consent.status = request.status;
            if (request.status === 'revoked') {
              consent.consentExpiryDate = now;
            }
          } else {
            consent = {
              id: `con-${identity.id}-${String((identity.consent?.length || 0) + 1).padStart(3, '0')}`,
              consentType: request.consentType,
              status: request.status,
              consentGivenDate: request.status === 'granted' ? now : undefined,
              purpose: request.purpose,
              scope: request.scope,
              consentExpiryDate: request.expiryDate,
            };

            if (!identity.consent) {
              identity.consent = [];
            }
            identity.consent.push(consent);
          }

          identity.lastModifiedDate = now;
          await firstValueFrom(this.idb.put(STORE_NAME, identity));
          setTimeout(() => {
            subscriber.next(consent);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  deleteDigitalIdentity(id: string): Observable<void> {
    return new Observable((subscriber) => {
      (async () => {
        try {
          await this.ensureInitialized();
          const error = maybeNetworkError();
          if (error) {
            error.subscribe({ error: (err) => subscriber.error(err) });
            return;
          }

          let identity: DigitalIdentity;
          try {
            identity = await firstValueFrom(this.idb.get<DigitalIdentity>(STORE_NAME, id));
          } catch {
            const err = new Error(`Digital identity not found: ${id}`) as Error & { status?: number };
            err.status = 404;
            subscriber.error(err);
            return;
          }

          identity.status = 'revoked';
          identity.lastModifiedDate = new Date().toISOString();
          identity.credential?.forEach((cred) => {
            cred.status = 'revoked';
          });
          identity.consent?.forEach((consent) => {
            consent.status = 'revoked';
          });

          await firstValueFrom(this.idb.put(STORE_NAME, identity));
          setTimeout(() => {
            subscriber.next(undefined);
            subscriber.complete();
          }, simulateLatency());
        } catch (error) {
          subscriber.error(error);
        }
      })();
    });
  }

  /**
   * Helper: Determine verification level based on verification type
   */
  private determineVerificationLevel(verificationType: string): import('./models').VerificationLevel {
    switch (verificationType) {
      case 'emailOTP':
      case 'smsOTP':
        return 'low';
      case 'knowledgeBased':
      case 'phoneCall':
        return 'medium';
      case 'documentCheck':
      case 'biometric':
      case 'inPerson':
        return 'high';
      default:
        return 'low';
    }
  }

  /**
   * Helper: Check if new verification level is higher than current
   */
  private isHigherVerificationLevel(
    newLevel: import('./models').VerificationLevel,
    currentLevel: import('./models').VerificationLevel
  ): boolean {
    const levels: import('./models').VerificationLevel[] = ['none', 'low', 'medium', 'high', 'absolute'];
    return levels.indexOf(newLevel) > levels.indexOf(currentLevel);
  }

  /**
   * Helper: Check if identity has basic verification (email or phone verified)
   */
  private hasBasicVerification(identity: DigitalIdentity): boolean {
    return (
      identity.attribute?.some(
        (attr) =>
          (attr.name === 'email' || attr.name === 'phoneNumber') &&
          attr.verificationStatus === 'verified'
      ) || false
    );
  }
}
