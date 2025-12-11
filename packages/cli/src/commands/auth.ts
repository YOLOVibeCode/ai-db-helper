/**
 * Auth Command - Manage Azure AD authentication
 */

import inquirer from 'inquirer';
import ora from 'ora';
import chalk from 'chalk';
import {
  DirectoryManager,
  AzureAuthProvider
} from '@aidb/core';

interface AuthOptions {
  tenant?: string;
  account?: string;
}

/**
 * List cached Azure accounts
 */
export async function authListCommand() {
  console.log(chalk.blue.bold('\n🔐 Azure Authentication - List Accounts\n'));

  try {
    const dirManager = new DirectoryManager();
    await dirManager.initialize();

    const authProvider = new AzureAuthProvider(dirManager);
    const accounts = await authProvider.listAccounts();

    if (accounts.length === 0) {
      console.log(chalk.yellow('No cached Azure accounts found.\n'));
      console.log(chalk.gray('Run "aidb auth login" to sign in.\n'));
      return;
    }

    console.log(chalk.white('Cached Azure accounts:\n'));
    accounts.forEach((account, index) => {
      const expiresIn = Math.floor((account.tokenExpiresOn.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      const expiresStatus = expiresIn > 0 
        ? chalk.green(`${expiresIn} days remaining`)
        : chalk.red('expired');

      console.log(chalk.white(`  ${index + 1}. ${chalk.bold(account.username)}`));
      console.log(chalk.gray(`     Tenant: ${account.tenantId}${account.tenantDomain ? ` (${account.tenantDomain})` : ''}`));
      console.log(chalk.gray(`     Token expires: ${account.tokenExpiresOn.toLocaleDateString()} (${expiresStatus})`));
      console.log(chalk.gray(`     Can refresh: ${account.canRefresh ? 'Yes' : 'No'}`));
      console.log('');
    });

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Sign in to Azure AD
 */
export async function authLoginCommand(options: AuthOptions) {
  console.log(chalk.blue.bold('\n🔐 Azure Authentication - Sign In\n'));

  try {
    const dirManager = new DirectoryManager();
    await dirManager.initialize();

    const authProvider = new AzureAuthProvider(dirManager);

    // Prompt for tenant if not provided
    let tenant = options.tenant;
    if (!tenant) {
      const tenantAnswer = await inquirer.prompt([
        {
          type: 'input',
          name: 'tenant',
          message: 'Azure AD Tenant (leave empty for common/multi-tenant):',
          default: '',
          validate: (input: string) => {
            if (!input) return true;
            const domainPattern = /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]\.onmicrosoft\.com$/;
            const guidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            return domainPattern.test(input) || guidPattern.test(input) || 'Invalid tenant format';
          }
        }
      ]);
      tenant = tenantAnswer.tenant || undefined;
    }

    const spinner = ora('Authenticating...').start();

    try {
      const tokenResponse = await authProvider.signIn(tenant);
      
      spinner.succeed(chalk.green('Signed in successfully!'));
      console.log(chalk.white(`\n  Account: ${chalk.bold(tokenResponse.account.username)}`));
      console.log(chalk.white(`  Tenant: ${tokenResponse.account.tenantId}`));
      console.log(chalk.white(`  Token expires: ${tokenResponse.expiresOn.toLocaleDateString()}\n`));
      console.log(chalk.gray('💡 This token will be cached and automatically refreshed.\n'));

    } catch (error) {
      spinner.fail(chalk.red('Authentication failed'));
      throw error;
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

/**
 * Sign out from Azure AD
 */
export async function authLogoutCommand(options: AuthOptions) {
  console.log(chalk.blue.bold('\n🔐 Azure Authentication - Sign Out\n'));

  try {
    const dirManager = new DirectoryManager();
    await dirManager.initialize();

    const authProvider = new AzureAuthProvider(dirManager);
    const accounts = await authProvider.listAccounts();

    if (accounts.length === 0) {
      console.log(chalk.yellow('No cached accounts to sign out from.\n'));
      return;
    }

    let accountId: string | undefined = options.account;

    // If account specified, use it; otherwise prompt
    if (!accountId && accounts.length > 1) {
      const accountAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'account',
          message: 'Select account to sign out:',
          choices: [
            ...accounts.map(acc => ({
              name: `${acc.username} (${acc.tenantId})`,
              value: acc.tenantId
            })),
            { name: 'All accounts', value: 'all' }
          ]
        }
      ]);
      accountId = accountAnswer.account === 'all' ? undefined : accountAnswer.account;
    } else if (!accountId) {
      accountId = accounts[0].tenantId;
    }

    const spinner = ora('Signing out...').start();
    await authProvider.signOut(accountId);
    spinner.succeed(chalk.green('Signed out successfully!\n'));

  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error instanceof Error ? error.message : error);
    process.exit(1);
  }
}


