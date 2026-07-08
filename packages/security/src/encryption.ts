import { v4 as uuidv4 } from 'uuid';

/**
 * Represents encrypted data with all necessary metadata for decryption.
 */
export interface EncryptedData {
  /** Initialization vector (base64 encoded) */
  iv: string;
  /** Ciphertext (base64 encoded) */
  ciphertext: string;
  /** Authentication tag for GCM (base64 encoded) */
  authTag: string;
  /** Key identifier used for encryption */
  keyId: string;
  /** Encryption algorithm used */
  algorithm: string;
}

/**
 * A key entry in the key management system.
 */
export interface KeyEntry {
  /** Unique key identifier */
  id: string;
  /** The actual key material (base64 encoded) */
  key: string;
  /** ISO timestamp of creation */
  createdAt: string;
  /** Whether this key is currently active for encryption */
  active: boolean;
  /** Algorithm this key is used with */
  algorithm: string;
  /** Key purpose (encryption, signing, etc.) */
  purpose: 'encryption' | 'signing' | 'envelope';
}

/**
 * A data key used in envelope encryption.
 */
export interface DataKey {
  /** The encrypted data key (base64 encoded) */
  encryptedKey: string;
  /** The key ID of the key encryption key used */
  kekId: string;
  /** The plaintext data key (only available briefly during encryption) */
  plaintextKey?: string;
}

/**
 * Configuration for the encryption service.
 */
export interface EncryptionConfig {
  /** Default encryption algorithm */
  algorithm: string;
  /** Key rotation interval in days */
  keyRotationDays: number;
  /** Whether to enable envelope encryption */
  enableEnvelopeEncryption: boolean;
  /** Minimum key length in bits */
  minimumKeyLength: number;
}

const DEFAULT_CONFIG: EncryptionConfig = {
  algorithm: 'aes-256-gcm',
  keyRotationDays: 90,
  enableEnvelopeEncryption: false,
  minimumKeyLength: 256,
};

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Provides AES-256-GCM encryption/decryption, key management with rotation,
 * envelope encryption support, and an encrypted memory store.
 *
 * Uses the Web Crypto API (available in modern Node.js and browsers).
 */
export class EncryptionService {
  private readonly config: EncryptionConfig;
  private readonly keys: Map<string, KeyEntry> = new Map();
  private readonly encryptedStore: Map<string, EncryptedData> = new Map();

  constructor(config?: Partial<EncryptionConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Generates a new encryption key and registers it with the key manager.
   *
   * @param purpose - The purpose of the key
   * @returns The created key entry (key material only available in the entry)
   */
  async generateKey(purpose: KeyEntry['purpose'] = 'encryption'): Promise<KeyEntry> {
    const keyId = `key_${uuidv4()}`;
    const keyBytes = this.generateRandomBytes(32); // 256 bits
    const keyBase64 = bytesToBase64(keyBytes);

    const entry: KeyEntry = {
      id: keyId,
      key: keyBase64,
      createdAt: new Date().toISOString(),
      active: true,
      algorithm: this.config.algorithm,
      purpose,
    };

    this.keys.set(keyId, entry);
    return entry;
  }

  /**
   * Encrypts plaintext data using AES-256-GCM.
   *
   * @param plaintext - The data to encrypt
   * @param keyId - Optional key identifier (uses the active key if omitted)
   * @returns The encrypted data with metadata
   */
  async encrypt(
    plaintext: string,
    keyId?: string,
  ): Promise<EncryptedData> {
    const key = this.resolveKey(keyId, 'encryption');
    const keyBytes = base64ToBytes(key.key);
    const keyBuffer = keyBytes.slice(0).buffer as ArrayBuffer;
    const iv = this.generateRandomBytes(16);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['encrypt'],
    );

    const encoded = new TextEncoder().encode(plaintext)
      .buffer as unknown as BufferSource;
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
      cryptoKey,
      encoded,
    );

    // GCM appends the auth tag at the end
    const authTagLength = 16;
    const ciphertext = new Uint8Array(
      encrypted.slice(0, encrypted.byteLength - authTagLength),
    );
    const authTag = new Uint8Array(
      encrypted.slice(encrypted.byteLength - authTagLength),
    );

    return {
      iv: bytesToBase64(iv),
      ciphertext: bytesToBase64(ciphertext),
      authTag: bytesToBase64(authTag),
      keyId: key.id,
      algorithm: this.config.algorithm,
    };
  }

  /**
   * Decrypts data that was encrypted with AES-256-GCM.
   *
   * @param data - The encrypted data to decrypt
   * @returns The decrypted plaintext string
   * @throws If decryption fails (wrong key, tampered data, etc.)
   */
  async decrypt(data: EncryptedData): Promise<string> {
    const keyEntry = this.keys.get(data.keyId);
    if (!keyEntry) {
      throw new Error(`Key "${data.keyId}" not found`);
    }

    const kekBytes = base64ToBytes(keyEntry.key);
    const keyBuffer = kekBytes.slice(0).buffer as ArrayBuffer;
    const iv = base64ToBytes(data.iv);
    const ciphertext = base64ToBytes(data.ciphertext);
    const authTag = base64ToBytes(data.authTag);

    // Combine ciphertext and auth tag as GCM expects
    const combined = new Uint8Array(
      ciphertext.length + authTag.length,
    ) as unknown as BufferSource;
    (combined as Uint8Array).set(ciphertext, 0);
    (combined as Uint8Array).set(authTag, ciphertext.length);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'AES-GCM' },
      false,
      ['decrypt'],
    );

    try {
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource, tagLength: 128 },
        cryptoKey,
        combined,
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      throw new Error(
        `Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Rotates the active encryption key.
   * The old key is deactivated but kept for decryption of existing data.
   *
   * @returns The new active key entry
   */
  async rotateKey(): Promise<KeyEntry> {
    // Deactivate all current encryption keys
    for (const entry of this.keys.values()) {
      if (entry.purpose === 'encryption') {
        entry.active = false;
      }
    }

    return this.generateKey('encryption');
  }

  /**
   * Implements envelope encryption: encrypts a data key (DEK) with a
   * key encryption key (KEK). The DEK can be used to encrypt actual data.
   *
   * @param kekId - The key encryption key identifier
   * @returns A data key (plaintext key is returned for one-time use)
   */
  async createEnvelopeKey(kekId: string): Promise<DataKey> {
    const kek = this.keys.get(kekId);
    if (!kek) {
      throw new Error(`Key encryption key "${kekId}" not found`);
    }

    // Generate a random data encryption key
    const dekBytes = this.generateRandomBytes(32);
    const dekBase64 = bytesToBase64(dekBytes);

    // Encrypt the DEK with the KEK
    const encryptedDek = await this.encrypt(dekBase64, kekId);
    const encryptedDekJson = JSON.stringify(encryptedDek);

    return {
      encryptedKey: btoa(encryptedDekJson),
      kekId,
      plaintextKey: dekBase64,
    };
  }

  /**
   * Decrypts an envelope-encrypted data key to retrieve the plaintext DEK.
   *
   * @param dataKey - The envelope-encrypted data key
   * @returns The plaintext data encryption key (base64 encoded)
   */
  async decryptEnvelopeKey(dataKey: DataKey): Promise<string> {
    const encryptedJson = atob(dataKey.encryptedKey);
    const encryptedData = JSON.parse(encryptedJson) as EncryptedData;
    return this.decrypt(encryptedData);
  }

  /**
   * Stores a value in the encrypted memory store.
   *
   * @param key - The storage key
   * @param value - The value to store (will be encrypted)
   */
  async store(key: string, value: string): Promise<void> {
    const encrypted = await this.encrypt(value);
    this.encryptedStore.set(key, encrypted);
  }

  /**
   * Retrieves and decrypts a value from the encrypted memory store.
   *
   * @param key - The storage key
   * @returns The decrypted value, or null if not found
   */
  async retrieve(key: string): Promise<string | null> {
    const encrypted = this.encryptedStore.get(key);
    if (!encrypted) {
      return null;
    }

    try {
      return await this.decrypt(encrypted);
    } catch {
      return null;
    }
  }

  /**
   * Removes a value from the encrypted memory store.
   *
   * @param key - The storage key to remove
   */
  async erase(key: string): Promise<void> {
    this.encryptedStore.delete(key);
  }

  /**
   * Lists all key IDs managed by this service.
   */
  listKeys(): KeyEntry[] {
    return Array.from(this.keys.values()).map((entry) => ({
      ...entry,
      key: '[REDACTED]',
    }));
  }

  /**
   * Retrieves metadata about a specific key (without exposing key material).
   *
   * @param keyId - The key identifier
   */
  getKeyInfo(keyId: string): Omit<KeyEntry, 'key'> | undefined {
    const entry = this.keys.get(keyId);
    if (!entry) {
      return undefined;
    }
    const { key: _, ...info } = entry;
    return info;
  }

  /**
   * Deletes a key from the key manager.
   * WARNING: Data encrypted with this key will become permanently undecryptable.
   *
   * @param keyId - The key identifier to delete
   */
  deleteKey(keyId: string): void {
    this.keys.delete(keyId);
  }

  private resolveKey(keyId?: string, purpose?: KeyEntry['purpose']): KeyEntry {
    if (keyId) {
      const key = this.keys.get(keyId);
      if (!key) {
        throw new Error(`Key "${keyId}" not found`);
      }
      return key;
    }

    // Find the most recent active key for the specified purpose
    const candidates = Array.from(this.keys.values())
      .filter((k) => k.active && (!purpose || k.purpose === purpose))
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

    if (candidates.length === 0) {
      throw new Error('No active encryption key available');
    }

    return candidates[0]!;
  }

  private generateRandomBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    crypto.getRandomValues(bytes);
    return bytes;
  }

  /**
   * Returns TLS configuration defaults for securing data in transit.
   */
  static getTlsDefaults(): Record<string, unknown> {
    return {
      minVersion: 'TLSv1.3',
      ciphers: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
      ].join(':'),
      honorCipherOrder: true,
      rejectUnauthorized: true,
    };
  }
}
