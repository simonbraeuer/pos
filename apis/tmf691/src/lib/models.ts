/** TMF-691 Token type */
export type TokenType = 'Bearer' | 'OAuth' | 'JWT' | 'SAML';

/** TMF-691 Identity status */
export type IdentityStatus = 'active' | 'inactive' | 'suspended' | 'revoked';

/** TMF-691 Authentication method */
export type AuthenticationMethod =
  | 'password'
  | 'otp'
  | 'biometric'
  | 'certificate'
  | 'oauth'
  | 'saml';

/** TMF-691 Scope/permission */
export interface Scope {
  name: string;
  description?: string;
  resource?: string;
}

/** TMF-691 Identity Token */
export interface IdentityToken {
  id: string;
  href?: string;
  tokenType: TokenType;
  accessToken: string;
  refreshToken?: string;
  expiresIn: number; // seconds
  expiresAt: string; // ISO timestamp
  issuedAt: string; // ISO timestamp
  scope?: Scope[];
  subject?: string; // User/subject identifier
  issuer?: string; // Token issuer
  audience?: string; // Intended recipient
}

/** TMF-691 Identity Provider */
export interface IdentityProvider {
  id: string;
  href?: string;
  name: string;
  description?: string;
  type: 'oauth2' | 'saml' | 'oidc' | 'ldap' | 'local';
  status: IdentityStatus;
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  userInfoEndpoint?: string;
  jwksUri?: string;
  issuer?: string;
  clientId?: string;
  scopes?: string[];
}

/** TMF-691 User Identity */
export interface UserIdentity {
  id: string;
  href?: string;
  username: string;
  email?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  phoneNumber?: string;
  status: IdentityStatus;
  identityProvider?: {
    id: string;
    name?: string;
  };
  externalId?: string; // ID from external identity provider
  authenticatedAt?: string;
  lastLoginAt?: string;
  roles?: string[];
  attributes?: Record<string, string>;
  '@type'?: string;
}

/** TMF-691 Authentication Session */
export interface AuthenticationSession {
  id: string;
  href?: string;
  userId: string;
  userIdentity?: UserIdentity;
  status: 'active' | 'expired' | 'terminated';
  authenticatedAt: string;
  expiresAt: string;
  lastAccessedAt?: string;
  authenticationMethod: AuthenticationMethod;
  ipAddress?: string;
  userAgent?: string;
  tokens?: IdentityToken[];
  claims?: Record<string, any>;
}

/** TMF-691 Authentication Request */
export interface AuthenticationRequest {
  username: string;
  password?: string;
  authenticationMethod: AuthenticationMethod;
  identityProviderId?: string;
  scope?: string[];
  otpCode?: string;
  clientId?: string;
  redirectUri?: string;
}

/** TMF-691 Authentication Response */
export interface AuthenticationResponse {
  session: AuthenticationSession;
  token: IdentityToken;
  userIdentity: UserIdentity;
}

/** TMF-691 Token Refresh Request */
export interface TokenRefreshRequest {
  refreshToken: string;
  scope?: string[];
}

/** TMF-691 Token Validation Request */
export interface TokenValidationRequest {
  token: string;
  tokenType?: TokenType;
}

/** TMF-691 Token Validation Response */
export interface TokenValidationResponse {
  valid: boolean;
  expired?: boolean;
  expiresAt?: string;
  subject?: string;
  scope?: Scope[];
  claims?: Record<string, any>;
  errors?: string[];
}

/** TMF-691 Logout Request */
export interface LogoutRequest {
  sessionId?: string;
  token?: string;
  allSessions?: boolean;
}

/** Search criteria for user identities */
export interface UserIdentitySearchCriteria {
  username?: string;
  email?: string;
  status?: IdentityStatus;
  identityProviderId?: string;
  externalId?: string;
  role?: string;
}

/** Search criteria for sessions */
export interface SessionSearchCriteria {
  userId?: string;
  status?: 'active' | 'expired' | 'terminated';
  authenticatedAfter?: string;
  authenticatedBefore?: string;
}

/** Paginated search results for user identities */
export interface PaginatedUserIdentityResults {
  items: UserIdentity[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/** Paginated search results for sessions */
export interface PaginatedSessionResults {
  items: AuthenticationSession[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
