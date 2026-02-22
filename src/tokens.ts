import * as fs from 'fs';
import * as path from 'path';
import { Tokens } from './types';

export function resolveTokens(provided?: Tokens): Tokens {
  // Priority 1: Directly provided tokens (highest)
  if (provided) {
    return provided;
  }

  // Priority 2: Environment variable
  const envToken = process.env.GMAIL_TOKEN;
  if (envToken) {
    try {
      return JSON.parse(envToken);
    } catch (error) {
      throw new Error('GMAIL_TOKEN environment variable is not valid JSON');
    }
  }

  // Priority 3: JSON file (lowest)
  const tokenFile = process.env.GMAIL_TOKEN_FILE || './token.json';
  const tokenPath = path.resolve(tokenFile);

  if (fs.existsSync(tokenPath)) {
    try {
      const content = fs.readFileSync(tokenPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to read or parse token file at ${tokenPath}`);
    }
  }

  throw new Error(
    'No Gmail tokens found. Provide tokens via: 1) GMAIL_TOKEN env var, 2) GMAIL_TOKEN_FILE env var pointing to JSON file, 3) direct function parameter'
  );
}
