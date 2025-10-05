/**
 * CredentialVault - Secure storage for database credentials
 *
 * Features:
 * - Encrypted storage using AES-256-GCM
 * - File-based persistence (.aidb/credentials.enc)
 * - Per-database credential management
 * - Master password protection
 * - Integrity validation
 */

import * as fs from 'fs/promises';
import { ICredentialVault, ConnectionCredentials, EncryptedData } from '@aidb/contracts';
import { EncryptionService } from './EncryptionService';
import { DirectoryManager } from '../infrastructure/DirectoryManager';

export class CredentialVault implements ICredentialVault {
  private readonly encryptionService: EncryptionService;
  private readonly directoryManager: DirectoryManager;
  private masterPassword?: string;

  // In-memory cache of decrypted credentials for the session
  private credentialCache: Map<string, ConnectionCredentials> = new Map();

  constructor(directoryManager: DirectoryManager, encryptionService?: EncryptionService) {
    this.directoryManager = directoryManager;
    this.encryptionService = encryptionService || new EncryptionService();
  }

  /**
   * Set master password for the session
   * This password will be used to encrypt/decrypt credentials
   */
  setMasterPassword(password: string): void {
    if (!password || password.length < 8) {
      throw new Error('Master password must be at least 8 characters');
    }
    this.masterPassword = password;
    // Clear cache when password changes
    this.credentialCache.clear();
  }

  /**
   * Store encrypted credentials
   */
  async store(databaseName: string, credentials: ConnectionCredentials): Promise<void> {
    if (!this.masterPassword) {
      throw new Error('Master password not set. Call setMasterPassword() first.');
    }

    // Validate database name
    this.validateDatabaseName(databaseName);

    // Load existing credentials file
    const allCredentials = await this.loadCredentialsFile();

    // Encrypt credentials
    const credentialsJson = JSON.stringify(credentials);
    const encrypted = await this.encryptionService.encryptWithPassword(
      credentialsJson,
      this.masterPassword
    );

    // Store encrypted credentials
    allCredentials[databaseName] = encrypted;

    // Save to file
    await this.saveCredentialsFile(allCredentials);

    // Update cache
    this.credentialCache.set(databaseName, credentials);

    // Set file permissions to 600 (rw-------)
    const credPath = this.directoryManager.getCredentialsPath();
    await fs.chmod(credPath, 0o600);
  }

  /**
   * Retrieve and decrypt credentials
   */
  async retrieve(databaseName: string): Promise<ConnectionCredentials | null> {
    if (!this.masterPassword) {
      throw new Error('Master password not set. Call setMasterPassword() first.');
    }

    // Check cache first
    if (this.credentialCache.has(databaseName)) {
      return this.credentialCache.get(databaseName)!;
    }

    // Load credentials file
    const allCredentials = await this.loadCredentialsFile();

    // Check if database exists
    if (!(databaseName in allCredentials)) {
      return null;
    }

    // Decrypt credentials
    try {
      const encrypted = allCredentials[databaseName];
      const decryptedJson = await this.encryptionService.decryptWithPassword(
        encrypted,
        this.masterPassword
      );

      const credentials: ConnectionCredentials = JSON.parse(decryptedJson);

      // Cache for session
      this.credentialCache.set(databaseName, credentials);

      return credentials;
    } catch (error) {
      throw new Error(
        `Failed to decrypt credentials for '${databaseName}': ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Delete stored credentials
   */
  async delete(databaseName: string): Promise<void> {
    // Load credentials file
    const allCredentials = await this.loadCredentialsFile();

    // Check if exists
    if (!(databaseName in allCredentials)) {
      throw new Error(`No credentials found for database '${databaseName}'`);
    }

    // Delete from file
    delete allCredentials[databaseName];

    // Save
    await this.saveCredentialsFile(allCredentials);

    // Remove from cache
    this.credentialCache.delete(databaseName);
  }

  /**
   * List all stored database names
   */
  async list(): Promise<string[]> {
    const allCredentials = await this.loadCredentialsFile();
    return Object.keys(allCredentials);
  }

  /**
   * Check if credentials exist for database
   */
  async exists(databaseName: string): Promise<boolean> {
    const allCredentials = await this.loadCredentialsFile();
    return databaseName in allCredentials;
  }

  /**
   * Rotate credentials (update existing)
   */
  async rotate(databaseName: string, newCredentials: ConnectionCredentials): Promise<void> {
    // Check if exists
    if (!(await this.exists(databaseName))) {
      throw new Error(`No credentials found for database '${databaseName}'. Use store() for new credentials.`);
    }

    // Store new credentials (overwrites existing)
    await this.store(databaseName, newCredentials);
  }

  /**
   * Validate encryption integrity
   * Attempts to decrypt all stored credentials
   */
  async validateIntegrity(): Promise<boolean> {
    if (!this.masterPassword) {
      throw new Error('Master password not set. Call setMasterPassword() first.');
    }

    try {
      const allCredentials = await this.loadCredentialsFile();

      // Try to decrypt each credential
      for (const [dbName, encrypted] of Object.entries(allCredentials)) {
        try {
          await this.encryptionService.decryptWithPassword(encrypted, this.masterPassword);
        } catch (error) {
          console.error(`Integrity check failed for '${dbName}': ${error}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error(`Integrity validation error: ${error}`);
      return false;
    }
  }

  /**
   * Clear in-memory credential cache
   */
  clearCache(): void {
    this.credentialCache.clear();
  }

  /**
   * Change master password
   * Re-encrypts all credentials with new password
   */
  async changeMasterPassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!oldPassword || !newPassword) {
      throw new Error('Both old and new passwords are required');
    }

    if (newPassword.length < 8) {
      throw new Error('New password must be at least 8 characters');
    }

    // Load and decrypt with old password
    this.setMasterPassword(oldPassword);
    const allCredentials = await this.loadCredentialsFile();

    // Decrypt all credentials
    const decryptedCreds: Record<string, ConnectionCredentials> = {};
    for (const [dbName, encrypted] of Object.entries(allCredentials)) {
      const decryptedJson = await this.encryptionService.decryptWithPassword(encrypted, oldPassword);
      decryptedCreds[dbName] = JSON.parse(decryptedJson);
    }

    // Re-encrypt with new password
    this.setMasterPassword(newPassword);
    const reencrypted: Record<string, EncryptedData> = {};

    for (const [dbName, credentials] of Object.entries(decryptedCreds)) {
      const credentialsJson = JSON.stringify(credentials);
      const encrypted = await this.encryptionService.encryptWithPassword(credentialsJson, newPassword);
      reencrypted[dbName] = encrypted;
    }

    // Save re-encrypted credentials
    await this.saveCredentialsFile(reencrypted);

    // Update cache
    this.credentialCache = new Map(Object.entries(decryptedCreds));
  }

  /**
   * Load credentials file
   */
  private async loadCredentialsFile(): Promise<Record<string, EncryptedData>> {
    const credPath = this.directoryManager.getCredentialsPath();

    try {
      const content = await fs.readFile(credPath, 'utf-8');
      return JSON.parse(content);
    } catch (error: any) {
      // File doesn't exist yet
      if (error.code === 'ENOENT') {
        return {};
      }
      throw new Error(`Failed to load credentials file: ${error.message}`);
    }
  }

  /**
   * Save credentials file
   */
  private async saveCredentialsFile(credentials: Record<string, EncryptedData>): Promise<void> {
    const credPath = this.directoryManager.getCredentialsPath();
    const content = JSON.stringify(credentials, null, 2);

    await fs.writeFile(credPath, content, 'utf-8');
  }

  /**
   * Validate database name
   */
  private validateDatabaseName(name: string): void {
    if (!name || name.trim().length === 0) {
      throw new Error('Database name cannot be empty');
    }

    // Prevent path traversal
    if (name.includes('..') || name.includes('/') || name.includes('\\')) {
      throw new Error('Invalid database name: cannot contain path separators');
    }
  }
}
