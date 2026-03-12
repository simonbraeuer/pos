/**
 * TMF-720 Digital Identity Management API Models
 * Provides types for digital identity lifecycle management operations.
 */

/**
 * DigitalIdentity - Core entity representing a user's digital identity
 */
export interface DigitalIdentity {
  id: string;
  href?: string;
  identityType: string; // e.g., 'individual', 'organization', 'device'
  status: DigitalIdentityStatus;
  verificationLevel: VerificationLevel;
  validFor?: TimePeriod;
  createdDate: string; // ISO 8601
  lastModifiedDate?: string; // ISO 8601
  lastVerifiedDate?: string; // ISO 8601
  credential?: IdentityCredential[];
  attribute?: IdentityAttribute[];
  verificationRecord?: VerificationRecord[];
  consent?: IdentityConsent[];
  relatedParty?: RelatedParty[];
  '@type'?: string;
  '@baseType'?: string;
  '@schemaLocation'?: string;
}

/**
 * Status of a digital identity
 */
export type DigitalIdentityStatus = 
  | 'pendingVerification'
  | 'verified'
  | 'active'
  | 'suspended'
  | 'revoked'
  | 'expired';

/**
 * Level of identity verification
 */
export type VerificationLevel = 
  | 'none'
  | 'low'
  | 'medium'
  | 'high'
  | 'absolute';

/**
 * IdentityCredential - Authentication credentials associated with identity
 */
export interface IdentityCredential {
  id: string;
  credentialType: string; // e.g., 'password', 'biometric', 'certificate', 'otp'
  status: 'active' | 'inactive' | 'expired' | 'revoked';
  validFor?: TimePeriod;
  lastUsedDate?: string; // ISO 8601
  createdDate: string; // ISO 8601
  credentialValue?: string; // Encrypted/hashed, never plain text in production
  '@type'?: string;
}

/**
 * IdentityAttribute - Verified attributes/claims about the identity
 */
export interface IdentityAttribute {
  id: string;
  name: string; // e.g., 'email', 'phoneNumber', 'dateOfBirth', 'address'
  value: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  verifiedDate?: string; // ISO 8601
  validFor?: TimePeriod;
  '@type'?: string;
}

/**
 * VerificationRecord - Record of identity verification attempts/results
 */
export interface VerificationRecord {
  id: string;
  verificationType: string; // e.g., 'documentCheck', 'biometric', 'knowledgeBased', 'emailOTP'
  verificationDate: string; // ISO 8601
  verificationResult: 'passed' | 'failed' | 'pending' | 'expired';
  verificationLevel: VerificationLevel;
  verificationMethod?: string;
  verificationEvidence?: VerificationEvidence[];
  '@type'?: string;
}

/**
 * VerificationEvidence - Supporting evidence for verification
 */
export interface VerificationEvidence {
  id: string;
  evidenceType: string; // e.g., 'passport', 'driversLicense', 'utilityBill'
  documentId?: string;
  issuer?: string;
  issuedDate?: string; // ISO 8601
  expiryDate?: string; // ISO 8601
  '@type'?: string;
}

/**
 * IdentityConsent - User consent for data usage and sharing
 */
export interface IdentityConsent {
  id: string;
  consentType: string; // e.g., 'dataProcessing', 'marketing', 'thirdPartySharing'
  status: 'granted' | 'denied' | 'revoked' | 'expired';
  consentGivenDate?: string; // ISO 8601
  consentExpiryDate?: string; // ISO 8601
  purpose?: string;
  scope?: string[];
  '@type'?: string;
}

/**
 * RelatedParty - Parties related to the digital identity
 */
export interface RelatedParty {
  id: string;
  href?: string;
  name?: string;
  role: string; // e.g., 'owner', 'guardian', 'administrator', 'verifier'
  '@referredType'?: string;
}

/**
 * TimePeriod - Time validity period
 */
export interface TimePeriod {
  startDateTime?: string; // ISO 8601
  endDateTime?: string; // ISO 8601
}

/**
 * Request to create a new digital identity
 */
export interface CreateDigitalIdentityRequest {
  identityType: string;
  verificationLevel?: VerificationLevel;
  validFor?: TimePeriod;
  credential?: Omit<IdentityCredential, 'id' | 'createdDate'>[];
  attribute?: Omit<IdentityAttribute, 'id'>[];
  relatedParty?: RelatedParty[];
}

/**
 * Request to update an existing digital identity
 */
export interface UpdateDigitalIdentityRequest {
  status?: DigitalIdentityStatus;
  verificationLevel?: VerificationLevel;
  validFor?: TimePeriod;
  credential?: Partial<IdentityCredential>[];
  attribute?: Partial<IdentityAttribute>[];
  consent?: Partial<IdentityConsent>[];
}

/**
 * Request to verify identity attributes
 */
export interface VerifyIdentityRequest {
  verificationType: string;
  verificationMethod?: string;
  attributesToVerify?: string[]; // attribute IDs or names
  verificationEvidence?: Omit<VerificationEvidence, 'id'>[];
}

/**
 * Response from identity verification
 */
export interface VerifyIdentityResponse {
  verificationRecord: VerificationRecord;
  updatedAttributes?: IdentityAttribute[];
  newVerificationLevel?: VerificationLevel;
}

/**
 * Request to grant or revoke consent
 */
export interface ManageConsentRequest {
  consentType: string;
  status: 'granted' | 'revoked';
  purpose?: string;
  scope?: string[];
  expiryDate?: string; // ISO 8601
}

/**
 * Paginated search results
 */
export interface DigitalIdentitySearchResult {
  items: DigitalIdentity[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/**
 * Search parameters for digital identities
 */
export interface DigitalIdentitySearchParams {
  identityType?: string;
  status?: DigitalIdentityStatus;
  verificationLevel?: VerificationLevel;
  relatedPartyId?: string;
  page?: number;
  pageSize?: number;
}
