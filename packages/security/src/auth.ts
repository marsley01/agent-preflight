import { v4 as uuidv4 } from 'uuid';

import { AuthMethod } from './types.js';

/**
 * Payload contained within a JWT token.
 */
export interface TokenPayload {
  /** Subject identifier (user or agent) */
  sub: string;
  /** Issuer identifier */
  iss: string;
  /** Audience the token is intended for */
  aud: string[];
  /** Expiration time (Unix timestamp in seconds) */
  exp: number;
  /** Issued at (Unix timestamp in seconds) */
  iat: number;
  /** Token identifier for revocation */
  jti: string;
  /** Custom claims */
  [key: string]: unknown;
}

/**
 * Represents an active session.
 */
export interface Session {
  /** Session identifier */
  id: string;
  /** User or agent identifier */
  principalId: string;
  /** Authentication method used */
  authMethod: AuthMethod;
  /** ISO timestamp of session creation */
  createdAt: string;
  /** ISO timestamp of last activity */
  lastActivity: string;
  /** ISO timestamp of session expiry */
  expiresAt: string;
  /** IP address the session was created from */
  ipAddress: string | undefined;
  /** Additional metadata */
  metadata: Record<string, unknown>;
  /** Whether the session has been revoked */
  revoked: boolean;
}

/**
 * Result of an authentication attempt.
 */
export interface AuthResult {
  /** Whether authentication was successful */
  authenticated: boolean;
  /** The authenticated principal identifier */
  principalId: string | null;
  /** The auth method used */
  method: AuthMethod;
  /** Session identifier if a session was created */
  sessionId: string | null;
  /** Token string if a token was issued */
  token: string | null;
  /** Error message if authentication failed */
  error?: string;
}

/**
 * Credentials for API key authentication.
 */
export interface ApiKeyCredentials {
  apiKey: string;
}

/**
 * Credentials for JWT authentication.
 */
export interface JwtCredentials {
  token: string;
}

/**
 * Credentials for OAuth authentication.
 */
export interface OAuthCredentials {
  provider: string;
  accessToken: string;
  refreshToken?: string;
}

/**
 * MFA challenge interface for multi-factor authentication.
 */
export interface MfaChallenge {
  /** Unique challenge identifier */
  challengeId: string;
  /** The principal being challenged */
  principalId: string;
  /** MFA method (totp, sms, email, etc.) */
  method: string;
  /** ISO timestamp when the challenge was created */
  createdAt: string;
  /** ISO timestamp when the challenge expires */
  expiresAt: string;
  /** Whether the challenge has been fulfilled */
  fulfilled: boolean;
}

/**
 * Configured API key entry.
 */
export interface ApiKeyEntry {
  /** The hashed API key */
  keyHash: string;
  /** Principal associated with this key */
  principalId: string;
  /** Human-readable label */
  label: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** ISO timestamp of expiry (or null for no expiry) */
  expiresAt: string | null;
  /** Whether the key is active */
  enabled: boolean;
  /** Allowed operations for this key */
  scopes: string[];
}

/**
 * Configuration for the authenticator.
 */
export interface AuthenticatorConfig {
  /** Secret key for signing tokens (use a strong, random value in production) */
  signingSecret: string;
  /** Default token expiry in seconds */
  tokenExpirySeconds: number;
  /** Default session expiry in seconds */
  sessionExpirySeconds: number;
  /** Issuer identifier for tokens */
  issuer: string;
  /** Allowed authentication methods */
  allowedMethods: AuthMethod[];
  /** Whether to enable session management */
  enableSessions: boolean;
  /** Whether MFA is required */
  mfaRequired: boolean;
}

const DEFAULT_CONFIG: AuthenticatorConfig = {
  signingSecret: 'change-me-in-production',
  tokenExpirySeconds: 3600, // 1 hour
  sessionExpirySeconds: 86400, // 24 hours
  issuer: 'agent-preflight',
  allowedMethods: [AuthMethod.API_KEY, AuthMethod.JWT],
  enableSessions: true,
  mfaRequired: false,
};

/**
 * Authenticator supporting multiple authentication methods including
 * API keys, JWT tokens, OAuth, session management, and MFA.
 */
export class Authenticator {
  private readonly config: AuthenticatorConfig;
  private readonly apiKeys: Map<string, ApiKeyEntry> = new Map();
  private readonly sessions: Map<string, Session> = new Map();
  private readonly mfaChallenges: Map<string, MfaChallenge> = new Map();
  private readonly revokedTokens: Set<string> = new Set();

  constructor(config?: Partial<AuthenticatorConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Authenticates using the specified method and credentials.
   *
   * @param method - The authentication method
   * @param credentials - The credentials object
   * @returns Authentication result with session/token details
   */
  async authenticate(
    method: AuthMethod,
    credentials: ApiKeyCredentials | JwtCredentials | OAuthCredentials,
  ): Promise<AuthResult> {
    if (!this.config.allowedMethods.includes(method)) {
      return {
        authenticated: false,
        principalId: null,
        method,
        sessionId: null,
        token: null,
        error: `Authentication method "${method}" is not allowed`,
      };
    }

    switch (method) {
      case 'API_KEY':
        return this.authenticateWithApiKey(credentials as ApiKeyCredentials);
      case 'JWT':
        return this.authenticateWithJwt(credentials as JwtCredentials);
      case 'OAUTH':
        return this.authenticateWithOAuth(credentials as OAuthCredentials);
      case 'NONE':
        return {
          authenticated: true,
          principalId: 'anonymous',
          method,
          sessionId: null,
          token: null,
        };
      default:
        return {
          authenticated: false,
          principalId: null,
          method,
          sessionId: null,
          token: null,
          error: `Unsupported authentication method: ${method}`,
        };
    }
  }

  /**
   * Validates an API key and returns the associated principal.
   *
   * @param apiKey - The API key to validate
   * @returns The principal ID if valid, null otherwise
   */
  validateApiKey(apiKey: string): string | null {
    const hash = this.hashString(apiKey);
    const entry = this.apiKeys.get(hash);

    if (!entry || !entry.enabled) {
      return null;
    }

    if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
      return null;
    }

    return entry.principalId;
  }

  /**
   * Registers a new API key.
   *
   * @param principalId - The principal to associate the key with
   * @param label - A human-readable label for the key
   * @param scopes - Optional scopes for the key
   * @param expiresAt - Optional expiry date
   * @returns The generated API key (plaintext — show once)
   */
  createApiKey(
    principalId: string,
    label: string,
    scopes?: string[],
    expiresAt?: string | null,
  ): string {
    const apiKey = `ap_${uuidv4().replace(/-/g, '')}${uuidv4().replace(/-/g, '').slice(0, 16)}`;
    const hash = this.hashString(apiKey);

    this.apiKeys.set(hash, {
      keyHash: hash,
      principalId,
      label,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt ?? null,
      enabled: true,
      scopes: scopes ?? ['*'],
    });

    return apiKey;
  }

  /**
   * Revokes an API key.
   *
   * @param apiKey - The API key to revoke
   */
  revokeApiKey(apiKey: string): void {
    const hash = this.hashString(apiKey);
    const entry = this.apiKeys.get(hash);
    if (entry) {
      entry.enabled = false;
    }
  }

  /**
   * Generates a JWT token for a given principal.
   *
   * @param payload - Custom claims to include in the token
   * @param expirySeconds - Token expiry in seconds (defaults to config)
   * @returns The signed JWT token string
   */
  generateToken(
    payload: Record<string, unknown>,
    expirySeconds?: number,
  ): string {
    const now = Math.floor(Date.now() / 1000);
    const exp = now + (expirySeconds ?? this.config.tokenExpirySeconds);

    const tokenPayload: TokenPayload = {
      sub: String(payload['sub'] ?? ''),
      iss: this.config.issuer,
      aud: Array.isArray(payload['aud']) ? payload['aud'] as string[] : ['agent-preflight'],
      exp,
      iat: now,
      jti: uuidv4(),
    };

    return this.encodeJwt(tokenPayload);
  }

  /**
   * Validates a JWT token and returns its payload.
   *
   * @param token - The JWT token to validate
   * @returns The decoded payload if valid, null otherwise
   */
  validateToken(token: string): TokenPayload | null {
    try {
      const payload = this.decodeJwt(token);
      if (!payload) {
        return null;
      }

      // Check revocation
      if (payload.jti && this.revokedTokens.has(payload.jti)) {
        return null;
      }

      // Check expiry
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        return null;
      }

      return payload;
    } catch {
      return null;
    }
  }

  /**
   * Revokes a JWT token by its JTI (JWT ID).
   *
   * @param jti - The token identifier to revoke
   */
  revokeToken(jti: string): void {
    this.revokedTokens.add(jti);
  }

  /**
   * Creates a new session for a principal.
   *
   * @param principalId - The principal identifier
   * @param method - The authentication method used
   * @param ipAddress - Optional IP address
   * @param metadata - Optional metadata
   * @returns The created session
   */
  createSession(
    principalId: string,
    method: AuthMethod,
    ipAddress?: string,
    metadata?: Record<string, unknown>,
  ): Session {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.sessionExpirySeconds * 1000,
    );

    const session: Session = {
      id: uuidv4(),
      principalId,
      authMethod: method,
      createdAt: now.toISOString(),
      lastActivity: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      ipAddress,
      metadata: metadata ?? {},
      revoked: false,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  /**
   * Validates whether a session is still active.
   *
   * @param sessionId - The session identifier
   * @returns The session if valid, null otherwise
   */
  validateSession(sessionId: string): Session | null {
    const session = this.sessions.get(sessionId);

    if (!session || session.revoked) {
      return null;
    }

    if (new Date(session.expiresAt) < new Date()) {
      this.sessions.delete(sessionId);
      return null;
    }

    // Update last activity
    session.lastActivity = new Date().toISOString();
    return session;
  }

  /**
   * Revokes a session.
   *
   * @param sessionId - The session identifier
   */
  revokeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.revoked = true;
    }
  }

  /**
   * Creates an MFA challenge for a principal.
   *
   * @param principalId - The principal to challenge
   * @param method - The MFA method (totp, sms, email)
   * @returns The MFA challenge
   */
  createMfaChallenge(principalId: string, method: string): MfaChallenge {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

    const challenge: MfaChallenge = {
      challengeId: uuidv4(),
      principalId,
      method,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      fulfilled: false,
    };

    this.mfaChallenges.set(challenge.challengeId, challenge);
    return challenge;
  }

  /**
   * Fulfills an MFA challenge.
   *
   * @param challengeId - The challenge identifier
   */
  fulfillMfaChallenge(challengeId: string): boolean {
    const challenge = this.mfaChallenges.get(challengeId);

    if (!challenge) {
      return false;
    }

    if (new Date(challenge.expiresAt) < new Date()) {
      this.mfaChallenges.delete(challengeId);
      return false;
    }

    challenge.fulfilled = true;
    return true;
  }

  private async authenticateWithApiKey(
    credentials: ApiKeyCredentials,
  ): Promise<AuthResult> {
    const principalId = this.validateApiKey(credentials.apiKey);

    if (!principalId) {
      return {
        authenticated: false,
        principalId: null,
        method: AuthMethod.API_KEY,
        sessionId: null,
        token: null,
        error: 'Invalid or expired API key',
      };
    }

    let sessionId: string | null = null;
    if (this.config.enableSessions) {
      const session = this.createSession(principalId, AuthMethod.API_KEY);
      sessionId = session.id;
    }

    return {
      authenticated: true,
      principalId,
      method: AuthMethod.API_KEY,
      sessionId,
      token: null,
    };
  }

  private async authenticateWithJwt(
    credentials: JwtCredentials,
  ): Promise<AuthResult> {
    const payload = this.validateToken(credentials.token);

    if (!payload) {
      return {
        authenticated: false,
        principalId: null,
        method: AuthMethod.JWT,
        sessionId: null,
        token: null,
        error: 'Invalid or expired JWT token',
      };
    }

    let sessionId: string | null = null;
    if (this.config.enableSessions) {
      const session = this.createSession(payload.sub, AuthMethod.JWT);
      sessionId = session.id;
    }

    return {
      authenticated: true,
      principalId: payload.sub,
      method: AuthMethod.JWT,
      sessionId,
      token: credentials.token,
    };
  }

  private async authenticateWithOAuth(
    credentials: OAuthCredentials,
  ): Promise<AuthResult> {
    // In production, verify the OAuth token with the provider
    // This is a simplified implementation
    if (!credentials.accessToken) {
      return {
        authenticated: false,
        principalId: null,
        method: AuthMethod.OAUTH,
        sessionId: null,
        token: null,
        error: 'Missing OAuth access token',
      };
    }

    const mockPrincipalId = `oauth_${credentials.provider}_${uuidv4().slice(0, 8)}`;

    let sessionId: string | null = null;
    if (this.config.enableSessions) {
      const session = this.createSession(mockPrincipalId, AuthMethod.OAUTH);
      sessionId = session.id;
    }

    return {
      authenticated: true,
      principalId: mockPrincipalId,
      method: AuthMethod.OAUTH,
      sessionId,
      token: credentials.accessToken,
    };
  }

  private hashString(input: string): string {
    // Simple hash for API key storage (use bcrypt or argon2 in production)
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return `hash_${Math.abs(hash).toString(36)}`;
  }

  private encodeJwt(payload: TokenPayload): string {
    const header = { alg: 'HS256', typ: 'JWT' };
    const encodedHeader = this.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = this.base64UrlEncode(JSON.stringify(payload));
    const signature = this.base64UrlEncode(
      this.sign(`${encodedHeader}.${encodedPayload}`),
    );

    return `${encodedHeader}.${encodedPayload}.${signature}`;
  }

  private decodeJwt(token: string): TokenPayload | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        return null;
      }

      const part0 = parts[0]!;
      const part1 = parts[1]!;
      const part2 = parts[2]!;

      const expectedSignature = this.base64UrlEncode(
        this.sign(`${part0}.${part1}`),
      );

      if (part2 !== expectedSignature) {
        return null;
      }

      const decoded = JSON.parse(
        new TextDecoder().decode(
          new Uint8Array(
            atob(part1.replace(/-/g, '+').replace(/_/g, '/'))
              .split('')
              .map((c) => c.charCodeAt(0)),
          ),
        ),
      );

      return decoded as TokenPayload;
    } catch {
      return null;
    }
  }

  private sign(data: string): string {
    // Simplified signing for development (use HMAC-SHA256 in production)
    const input = data + this.config.signingSecret;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash |= 0;
    }
    return String(Math.abs(hash));
  }

  private base64UrlEncode(data: string): string {
    return btoa(new TextEncoder().encode(data).reduce(
      (acc, byte) => acc + String.fromCharCode(byte),
      '',
    )).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
}
