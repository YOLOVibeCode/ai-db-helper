/**
 * Credential storage and encryption interface
 */

import { ConnectionCredentials } from '../types/schema-types';

export interface ICredentialVault {
  /**
   * Store encrypted credentials
   */
  store(databaseName: string, credentials: ConnectionCredentials): Promise<void>;

  /**
   * Retrieve and decrypt credentials
   */
  retrieve(databaseName: string): Promise<ConnectionCredentials | null>;

  /**
   * Delete stored credentials
   */
  delete(databaseName: string): Promise<void>;

  /**
   * List all stored database names
   */
  list(): Promise<string[]>;

  /**
   * Check if credentials exist for database
   */
  exists(databaseName: string): Promise<boolean>;

  /**
   * Rotate credentials (update existing)
   */
  rotate(databaseName: string, newCredentials: ConnectionCredentials): Promise<void>;

  /**
   * Validate encryption integrity
   */
  validateIntegrity(): Promise<boolean>;
}

/**
 * Encryption service interface
 */
export interface IEncryptionService {
  /**
   * Encrypt data
   */
  encrypt(plaintext: string, key: Buffer): EncryptedData;

  /**
   * Decrypt data
   */
  decrypt(encrypted: EncryptedData, key: Buffer): string;

  /**
   * Derive key from password
   */
  deriveKey(password: string, salt: Buffer): Promise<Buffer>;

  /**
   * Generate random salt
   */
  generateSalt(): Buffer;

  /**
   * Generate random IV
   */
  generateIV(): Buffer;
}

export interface EncryptedData {
  encrypted: string;
  iv: string;
  salt: string;
  authTag: string;
  algorithm: string;
}
