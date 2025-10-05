/**
 * EncryptionService - AES-256-GCM encryption for credential storage
 *
 * Security Features:
 * - AES-256-GCM authenticated encryption
 * - PBKDF2 key derivation (100,000 iterations)
 * - Random salt per credential (32 bytes)
 * - Random IV per encryption (16 bytes)
 * - Authentication tag for integrity verification
 */

import { createCipheriv, createDecipheriv, randomBytes, pbkdf2 } from 'crypto';
import { promisify } from 'util';
import { IEncryptionService, EncryptedData } from '@aidb/contracts';

const pbkdf2Async = promisify(pbkdf2);

export class EncryptionService implements IEncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 256 bits
  private readonly saltLength = 32; // 256 bits
  private readonly ivLength = 16; // 128 bits
  private readonly iterations = 100000; // PBKDF2 iterations
  private readonly digest = 'sha512';

  /**
   * Encrypt plaintext data
   * @param plaintext - Data to encrypt
   * @param key - Encryption key (32 bytes)
   * @returns Encrypted data with IV, salt, and auth tag
   */
  encrypt(plaintext: string, key: Buffer): EncryptedData {
    if (key.length !== this.keyLength) {
      throw new Error(`Invalid key length: expected ${this.keyLength} bytes, got ${key.length}`);
    }

    // Generate random IV
    const iv = this.generateIV();

    // Create cipher
    const cipher = createCipheriv(this.algorithm, key, iv);

    // Encrypt data
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get authentication tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('base64'),
      salt: '', // Salt is stored separately per credential
      authTag: authTag.toString('base64'),
      algorithm: this.algorithm
    };
  }

  /**
   * Decrypt encrypted data
   * @param encrypted - Encrypted data object
   * @param key - Decryption key (32 bytes)
   * @returns Decrypted plaintext
   */
  decrypt(encrypted: EncryptedData, key: Buffer): string {
    if (key.length !== this.keyLength) {
      throw new Error(`Invalid key length: expected ${this.keyLength} bytes, got ${key.length}`);
    }

    // Convert base64 strings back to buffers
    const iv = Buffer.from(encrypted.iv, 'base64');
    const authTag = Buffer.from(encrypted.authTag, 'base64');

    // Create decipher
    const decipher = createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(authTag);

    // Decrypt data
    try {
      let decrypted = decipher.update(encrypted.encrypted, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Invalid key or corrupted data'}`);
    }
  }

  /**
   * Derive encryption key from password using PBKDF2
   * @param password - User password
   * @param salt - Salt buffer
   * @returns Derived key (32 bytes)
   */
  async deriveKey(password: string, salt: Buffer): Promise<Buffer> {
    if (!password || password.length === 0) {
      throw new Error('Password cannot be empty');
    }

    if (salt.length !== this.saltLength) {
      throw new Error(`Invalid salt length: expected ${this.saltLength} bytes, got ${salt.length}`);
    }

    const key = await pbkdf2Async(
      password,
      salt,
      this.iterations,
      this.keyLength,
      this.digest
    );

    return key as Buffer;
  }

  /**
   * Generate random salt
   * @returns 32-byte random salt
   */
  generateSalt(): Buffer {
    return randomBytes(this.saltLength);
  }

  /**
   * Generate random IV
   * @returns 16-byte random IV
   */
  generateIV(): Buffer {
    return randomBytes(this.ivLength);
  }

  /**
   * Encrypt with password (convenience method)
   * Generates salt, derives key, and encrypts in one call
   */
  async encryptWithPassword(plaintext: string, password: string): Promise<EncryptedData> {
    const salt = this.generateSalt();
    const key = await this.deriveKey(password, salt);
    const encrypted = this.encrypt(plaintext, key);

    // Add salt to encrypted data
    encrypted.salt = salt.toString('base64');

    return encrypted;
  }

  /**
   * Decrypt with password (convenience method)
   * Derives key from password and salt, then decrypts
   */
  async decryptWithPassword(encrypted: EncryptedData, password: string): Promise<string> {
    if (!encrypted.salt) {
      throw new Error('Salt is required for password-based decryption');
    }

    const salt = Buffer.from(encrypted.salt, 'base64');
    const key = await this.deriveKey(password, salt);

    return this.decrypt(encrypted, key);
  }

  /**
   * Validate encrypted data structure
   */
  validateEncryptedData(data: any): data is EncryptedData {
    return (
      typeof data === 'object' &&
      typeof data.encrypted === 'string' &&
      typeof data.iv === 'string' &&
      typeof data.authTag === 'string' &&
      typeof data.algorithm === 'string' &&
      data.algorithm === this.algorithm
    );
  }

  /**
   * Get encryption algorithm info
   */
  getAlgorithmInfo() {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      saltLength: this.saltLength,
      ivLength: this.ivLength,
      iterations: this.iterations,
      digest: this.digest
    };
  }
}
