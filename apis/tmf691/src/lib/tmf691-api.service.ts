import { Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { delay } from 'rxjs/operators';
import { instrumentMockHarLogging } from '@pos/tmf688';
import {
  AuthenticationRequest,
  AuthenticationMethod,
  AuthenticationResponse,
  AuthenticationSession,
  IdentityToken,
  UserIdentity,
  TokenRefreshRequest,
  TokenValidationRequest,
  TokenValidationResponse,
  LogoutRequest,
  UserIdentitySearchCriteria,
  SessionSearchCriteria,
  PaginatedUserIdentityResults,
  PaginatedSessionResults,
  IdentityProvider,
} from './models';

const TMF691_SESSIONS_STORAGE_KEY = 'pos_tmf691_sessions';


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
    const err = new Error('Federated Identity service temporarily unavailable') as any;
    err.status = failureStatus;
    return throwError(() => err);
  }
  return null;
}

/** Generate unique session ID */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Generate unique token ID */
function generateTokenId(): string {
  return `token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/** Generate mock JWT-like token */
function generateAccessToken(): string {
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = btoa(
    JSON.stringify({
      sub: 'user-' + Math.random().toString(36).substr(2, 9),
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  );
  const signature = Math.random().toString(36).substr(2, 16);
  return `${header}.${payload}.${signature}`;
}

/** Mock user identities data store */
const MOCK_USER_IDENTITIES: Map<string, UserIdentity> = new Map([
  [
    'user-001',
    {
      id: 'user-001',
      href: '/federatedIdentity/v4/userIdentity/user-001',
      username: 'admin',
      email: 'admin@tmf-telco.local',
      displayName: 'Administrator',
      firstName: 'System',
      lastName: 'Administrator',
      status: 'active',
      identityProvider: {
        id: 'idp-local',
        name: 'TMF Telco GmbH IDP',
      },
      authenticatedAt: '2024-03-01T08:00:00Z',
      lastLoginAt: '2024-03-09T10:30:00Z',
      roles: ['admin', 'user'],
      attributes: {
        department: 'IT-Operations',
        employeeId: 'EMP-AT-001',
      },
    },
  ],
  [
    'user-002',
    {
      id: 'user-002',
      href: '/federatedIdentity/v4/userIdentity/user-002',
      username: 'kassier',
      email: 'kassier@tmf-telco.local',
      displayName: 'Kassier',
      firstName: 'Anna',
      lastName: 'Hoffmann',
      phoneNumber: '+43664123456',
      status: 'active',
      identityProvider: {
        id: 'idp-local',
        name: 'TMF Telco GmbH IDP',
      },
      authenticatedAt: '2024-03-08T09:15:00Z',
      lastLoginAt: '2024-03-09T09:00:00Z',
      roles: ['user'],
      attributes: {
        department: 'Vertrieb',
        employeeId: 'EMP-AT-002',
      },
    },
  ],
]);

/** Mock sessions data store */
const MOCK_SESSIONS: Map<string, AuthenticationSession> = loadSessionsFromStorage();

function loadSessionsFromStorage(): Map<string, AuthenticationSession> {
  if (typeof localStorage === 'undefined') {
    return new Map();
  }

  try {
    const raw = localStorage.getItem(TMF691_SESSIONS_STORAGE_KEY);
    if (!raw) {
      return new Map();
    }

    const entries = JSON.parse(raw) as [string, AuthenticationSession][];
    return new Map(entries);
  } catch {
    return new Map();
  }
}

function persistSessionsToStorage(): void {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(
      TMF691_SESSIONS_STORAGE_KEY,
      JSON.stringify(Array.from(MOCK_SESSIONS.entries()))
    );
  } catch {
    // Ignore persistence failures in mock mode.
  }
}

/** Mock identity providers */
const MOCK_IDENTITY_PROVIDERS: Map<string, IdentityProvider> = new Map([
  [
    'idp-local',
    {
      id: 'idp-local',
      name: 'Local Identity Provider',
      description: 'Built-in local authentication',
      type: 'local',
      status: 'active',
    },
  ],
  [
    'idp-oauth2',
    {
      id: 'idp-oauth2',
      name: 'OAuth2 Provider',
      description: 'External OAuth2 identity provider',
      type: 'oauth2',
      status: 'active',
      authorizationEndpoint: 'https://idp.example.com/oauth2/authorize',
      tokenEndpoint: 'https://idp.example.com/oauth2/token',
      userInfoEndpoint: 'https://idp.example.com/oauth2/userinfo',
      issuer: 'https://idp.example.com',
      clientId: 'pos-client-id',
      scopes: ['openid', 'profile', 'email'],
    },
  ],
]);

/**
 * TMF-691 Federated Identity API Service
 *
 * Provides federated identity and authentication management
 * following the TMForum TMF-691 standard.
 */
@Injectable({ providedIn: 'root' })
export class Tmf691ApiService {
  constructor() {
    instrumentMockHarLogging(this, 'tmf691', '/federatedIdentity/v4');
  }

  /**
   * Create a TMF691 authentication session for a pre-validated user identity.
   * This is useful when credential verification is delegated to another TMF API.
   */
  createSessionForUser(params: {
    userId: string;
    username: string;
    email?: string;
    displayName?: string;
    roles?: string[];
    authenticationMethod?: AuthenticationMethod;
    scope?: string[];
    clientId?: string;
  }): Observable<AuthenticationResponse> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    const existing = MOCK_USER_IDENTITIES.get(params.userId);
    const user: UserIdentity = existing
      ? {
          ...existing,
          username: params.username,
          email: params.email ?? existing.email,
          displayName: params.displayName ?? existing.displayName,
          roles: params.roles ?? existing.roles,
          status: 'active',
          lastLoginAt: new Date().toISOString(),
          authenticatedAt: new Date().toISOString(),
        }
      : {
          id: params.userId,
          href: `/federatedIdentity/v4/userIdentity/${params.userId}`,
          username: params.username,
          email: params.email,
          displayName: params.displayName,
          status: 'active',
          identityProvider: {
            id: 'idp-local',
            name: 'Local Identity Provider',
          },
          authenticatedAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString(),
          roles: params.roles ?? ['user'],
        };

    MOCK_USER_IDENTITIES.set(user.id, user);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600000);

    const token: IdentityToken = {
      id: generateTokenId(),
      tokenType: 'Bearer',
      accessToken: generateAccessToken(),
      refreshToken: generateAccessToken(),
      expiresIn: 3600,
      expiresAt: expiresAt.toISOString(),
      issuedAt: now.toISOString(),
      scope: params.scope?.map((s) => ({ name: s })),
      subject: user.id,
      issuer: 'tmf691-api',
      audience: params.clientId || 'pos-app',
    };

    const sessionId = generateSessionId();
    const session: AuthenticationSession = {
      id: sessionId,
      href: `/federatedIdentity/v4/authenticationSession/${sessionId}`,
      userId: user.id,
      userIdentity: user,
      status: 'active',
      authenticatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastAccessedAt: now.toISOString(),
      authenticationMethod: params.authenticationMethod || 'password',
      tokens: [token],
      claims: {
        sub: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
      },
    };

    MOCK_SESSIONS.set(session.id, session);
    persistSessionsToStorage();

    return of({
      session,
      token,
      userIdentity: user,
    }).pipe(delay(simulateLatency()));
  }

  /**
   * Authenticate a user and create a session
   * @param request Authentication request
   * @returns Observable of authentication response
   */
  authenticate(request: AuthenticationRequest): Observable<AuthenticationResponse> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    // Simple mock authentication - in real system would verify credentials
    const user = Array.from(MOCK_USER_IDENTITIES.values()).find(
      (u) => u.username === request.username
    );

    if (!user || user.status !== 'active') {
      const authError = new Error('Invalid credentials') as any;
      authError.status = 401;
      return throwError(() => authError);
    }

    // For mock purposes, accept any password for existing users in password mode
    if (request.authenticationMethod === 'password' && !request.password) {
      const authError = new Error('Password required') as any;
      authError.status = 400;
      return throwError(() => authError);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600000); // 1 hour

    // Create token
    const token: IdentityToken = {
      id: generateTokenId(),
      tokenType: 'Bearer',
      accessToken: generateAccessToken(),
      refreshToken: generateAccessToken(),
      expiresIn: 3600,
      expiresAt: expiresAt.toISOString(),
      issuedAt: now.toISOString(),
      scope: request.scope?.map((s) => ({ name: s })),
      subject: user.id,
      issuer: 'tmf691-api',
      audience: request.clientId || 'pos-app',
    };

    // Create session
    const session: AuthenticationSession = {
      id: generateSessionId(),
      href: `/federatedIdentity/v4/authenticationSession/${generateSessionId()}`,
      userId: user.id,
      userIdentity: user,
      status: 'active',
      authenticatedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastAccessedAt: now.toISOString(),
      authenticationMethod: request.authenticationMethod,
      tokens: [token],
      claims: {
        sub: user.id,
        username: user.username,
        email: user.email,
        roles: user.roles,
      },
    };

    MOCK_SESSIONS.set(session.id, session);
    persistSessionsToStorage();

    // Update user last login
    user.lastLoginAt = now.toISOString();
    user.authenticatedAt = now.toISOString();

    return of({
      session,
      token,
      userIdentity: user,
    }).pipe(delay(simulateLatency()));
  }

  /**
   * Refresh an access token using a refresh token
   * @param request Token refresh request
   * @returns Observable of new identity token
   */
  refreshToken(request: TokenRefreshRequest): Observable<IdentityToken> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    // Find session with matching refresh token
    const session = Array.from(MOCK_SESSIONS.values()).find((s) =>
      s.tokens?.some((t) => t.refreshToken === request.refreshToken)
    );

    if (!session || session.status !== 'active') {
      const authError = new Error('Invalid refresh token') as any;
      authError.status = 401;
      return throwError(() => authError);
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3600000);

    const newToken: IdentityToken = {
      id: generateTokenId(),
      tokenType: 'Bearer',
      accessToken: generateAccessToken(),
      refreshToken: generateAccessToken(),
      expiresIn: 3600,
      expiresAt: expiresAt.toISOString(),
      issuedAt: now.toISOString(),
      scope: request.scope?.map((s) => ({ name: s })),
      subject: session.userId,
      issuer: 'tmf691-api',
    };

    // Add new token to session
    session.tokens = [...(session.tokens || []), newToken];
    session.lastAccessedAt = now.toISOString();
    persistSessionsToStorage();

    return of(newToken).pipe(delay(simulateLatency()));
  }

  /**
   * Validate an access token
   * @param request Token validation request
   * @returns Observable of validation response
   */
  validateToken(request: TokenValidationRequest): Observable<TokenValidationResponse> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    // Find session with matching token
    const session = Array.from(MOCK_SESSIONS.values()).find((s) =>
      s.tokens?.some((t) => t.accessToken === request.token)
    );

    if (!session) {
      return of({
        valid: false,
        errors: ['Token not found'],
      }).pipe(delay(simulateLatency()));
    }

    const token = session.tokens?.find((t) => t.accessToken === request.token);
    if (!token) {
      return of({
        valid: false,
        errors: ['Token not found'],
      }).pipe(delay(simulateLatency()));
    }

    const now = new Date();
    const expiresAt = new Date(token.expiresAt);
    const expired = expiresAt < now;

    return of({
      valid: !expired && session.status === 'active',
      expired,
      expiresAt: token.expiresAt,
      subject: token.subject,
      scope: token.scope,
      claims: session.claims,
      errors: expired ? ['Token expired'] : undefined,
    }).pipe(delay(simulateLatency()));
  }

  /**
   * Logout/terminate a session
   * @param request Logout request
   * @returns Observable of void
   */
  logout(request: LogoutRequest): Observable<void> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    if (request.sessionId) {
      const session = MOCK_SESSIONS.get(request.sessionId);
      if (session) {
        session.status = 'terminated';
        persistSessionsToStorage();
      }
    } else if (request.token) {
      // Find session by token
      const session = Array.from(MOCK_SESSIONS.values()).find((s) =>
        s.tokens?.some((t) => t.accessToken === request.token)
      );
      if (session) {
        session.status = 'terminated';
        persistSessionsToStorage();
      }
    }

    return of(undefined).pipe(delay(simulateLatency()));
  }

  /**
   * Get user identity by ID
   * @param userId User identity ID
   * @returns Observable of user identity
   */
  getUserIdentity(userId: string): Observable<UserIdentity> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    const user = MOCK_USER_IDENTITIES.get(userId);

    if (!user) {
      const notFoundError = new Error(`User identity ${userId} not found`) as any;
      notFoundError.status = 404;
      return throwError(() => notFoundError);
    }

    return of({ ...user }).pipe(delay(simulateLatency()));
  }

  /**
   * Search user identities
   * @param criteria Search criteria
   * @param page Page number (0-indexed)
   * @param pageSize Number of items per page
   * @returns Observable of paginated results
   */
  searchUserIdentities(
    criteria: UserIdentitySearchCriteria = {},
    page = 0,
    pageSize = 10
  ): Observable<PaginatedUserIdentityResults> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    let users = Array.from(MOCK_USER_IDENTITIES.values());

    // Apply filters
    if (criteria.username) {
      const usernameLower = criteria.username.toLowerCase();
      users = users.filter((u) => u.username.toLowerCase().includes(usernameLower));
    }
    if (criteria.email) {
      const emailLower = criteria.email.toLowerCase();
      users = users.filter((u) => u.email?.toLowerCase().includes(emailLower));
    }
    if (criteria.status) {
      users = users.filter((u) => u.status === criteria.status);
    }
    if (criteria.identityProviderId) {
      users = users.filter((u) => u.identityProvider?.id === criteria.identityProviderId);
    }
    if (criteria.role) {
      users = users.filter((u) => u.roles?.includes(criteria.role!));
    }

    // Pagination
    const total = users.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = users.slice(start, end);
    const hasMore = end < total;

    return of({
      items,
      total,
      page,
      pageSize,
      hasMore,
    }).pipe(delay(simulateLatency()));
  }

  /**
   * Get session by ID
   * @param sessionId Session ID
   * @returns Observable of authentication session
   */
  getSession(sessionId: string): Observable<AuthenticationSession> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    const session = MOCK_SESSIONS.get(sessionId);

    if (!session) {
      const notFoundError = new Error(`Session ${sessionId} not found`) as any;
      notFoundError.status = 404;
      return throwError(() => notFoundError);
    }

    return of({ ...session }).pipe(delay(simulateLatency()));
  }

  /**
   * Get active session by access token.
   * Returns null when the token is unknown, expired, or session is not active.
   */
  getSessionByToken(token: string): Observable<AuthenticationSession | null> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    const session = Array.from(MOCK_SESSIONS.values()).find((s) =>
      s.tokens?.some((t) => t.accessToken === token)
    );

    if (!session || session.status !== 'active') {
      return of(null).pipe(delay(simulateLatency()));
    }

    const activeToken = session.tokens?.find((t) => t.accessToken === token);
    if (!activeToken) {
      return of(null).pipe(delay(simulateLatency()));
    }

    if (new Date(activeToken.expiresAt) < new Date()) {
      session.status = 'expired';
      persistSessionsToStorage();
      return of(null).pipe(delay(simulateLatency()));
    }

    session.lastAccessedAt = new Date().toISOString();
    persistSessionsToStorage();
    return of({ ...session }).pipe(delay(simulateLatency()));
  }

  /**
   * Search sessions
   * @param criteria Search criteria
   * @param page Page number (0-indexed)
   * @param pageSize Number of items per page
   * @returns Observable of paginated results
   */
  searchSessions(
    criteria: SessionSearchCriteria = {},
    page = 0,
    pageSize = 10
  ): Observable<PaginatedSessionResults> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    let sessions = Array.from(MOCK_SESSIONS.values());

    // Apply filters
    if (criteria.userId) {
      sessions = sessions.filter((s) => s.userId === criteria.userId);
    }
    if (criteria.status) {
      sessions = sessions.filter((s) => s.status === criteria.status);
    }
    if (criteria.authenticatedAfter) {
      sessions = sessions.filter((s) => s.authenticatedAt >= criteria.authenticatedAfter!);
    }
    if (criteria.authenticatedBefore) {
      sessions = sessions.filter((s) => s.authenticatedAt <= criteria.authenticatedBefore!);
    }

    // Sort by authenticated time descending
    sessions.sort((a, b) => b.authenticatedAt.localeCompare(a.authenticatedAt));

    // Pagination
    const total = sessions.length;
    const start = page * pageSize;
    const end = start + pageSize;
    const items = sessions.slice(start, end);
    const hasMore = end < total;

    return of({
      items,
      total,
      page,
      pageSize,
      hasMore,
    }).pipe(delay(simulateLatency()));
  }

  /**
   * Get identity provider by ID
   * @param providerId Identity provider ID
   * @returns Observable of identity provider
   */
  getIdentityProvider(providerId: string): Observable<IdentityProvider> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    const provider = MOCK_IDENTITY_PROVIDERS.get(providerId);

    if (!provider) {
      const notFoundError = new Error(`Identity provider ${providerId} not found`) as any;
      notFoundError.status = 404;
      return throwError(() => notFoundError);
    }

    return of({ ...provider }).pipe(delay(simulateLatency()));
  }

  /**
   * List all identity providers
   * @returns Observable of identity providers
   */
  listIdentityProviders(): Observable<IdentityProvider[]> {
    const error = maybeNetworkError();
    if (error) {
      return error;
    }

    return of(Array.from(MOCK_IDENTITY_PROVIDERS.values())).pipe(delay(simulateLatency()));
  }
}
