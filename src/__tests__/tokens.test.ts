import * as fs from 'fs';
import * as path from 'path';
import { resolveTokens } from '../tokens';
import { Tokens } from '../types';

jest.mock('fs');
jest.mock('path');

const mockTokens: Tokens = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expiry_date: 1234567890,
};

describe('resolveTokens', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.GMAIL_TOKEN;
    delete process.env.GMAIL_TOKEN_FILE;
  });

  it('should return provided tokens directly', () => {
    const result = resolveTokens(mockTokens);
    expect(result).toEqual(mockTokens);
  });

  it('should parse GMAIL_TOKEN environment variable', () => {
    process.env.GMAIL_TOKEN = JSON.stringify(mockTokens);
    const result = resolveTokens();
    expect(result).toEqual(mockTokens);
  });

  it('should throw error if GMAIL_TOKEN is invalid JSON', () => {
    process.env.GMAIL_TOKEN = 'invalid-json{';
    expect(() => resolveTokens()).toThrow('GMAIL_TOKEN environment variable is not valid JSON');
  });

  it('should read tokens from file if GMAIL_TOKEN_FILE is set', () => {
    const filePath = '/custom/path/token.json';
    process.env.GMAIL_TOKEN_FILE = filePath;

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTokens));
    (path.resolve as jest.Mock).mockReturnValue(filePath);

    const result = resolveTokens();
    expect(result).toEqual(mockTokens);
    expect(fs.readFileSync).toHaveBeenCalledWith(filePath, 'utf-8');
  });

  it('should read tokens from default token.json if no env vars', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockTokens));
    (path.resolve as jest.Mock).mockReturnValue(path.resolve('./token.json'));

    const result = resolveTokens();
    expect(result).toEqual(mockTokens);
  });

  it('should throw error if token file does not exist', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    expect(() => resolveTokens()).toThrow(
      /No Gmail tokens found/
    );
  });

  it('should throw error if token file is invalid JSON', () => {
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue('invalid-json{');

    expect(() => resolveTokens()).toThrow('Failed to read or parse token file');
  });

  it('should prioritize directly provided tokens over env vars', () => {
    process.env.GMAIL_TOKEN = JSON.stringify({
      access_token: 'env-token',
    });

    const result = resolveTokens(mockTokens);
    expect(result.access_token).toBe(mockTokens.access_token);
  });

  it('should prioritize env vars over file tokens', () => {
    process.env.GMAIL_TOKEN = JSON.stringify(mockTokens);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify({
      access_token: 'file-token',
    }));

    const result = resolveTokens();
    expect(result.access_token).toBe(mockTokens.access_token);
  });

  it('should accept camelCase token properties', () => {
    const camelCaseTokens: Tokens = {
      accessToken: 'camel-access-token',
      refreshToken: 'camel-refresh-token',
      expiryDate: 9999999999,
      tokenType: 'Bearer',
    };

    const result = resolveTokens(camelCaseTokens);
    expect(result.accessToken).toBe('camel-access-token');
    expect(result.refreshToken).toBe('camel-refresh-token');
  });

  it('should read file with camelCase token format', () => {
    const filePath = '/custom/path/token.json';
    process.env.GMAIL_TOKEN_FILE = filePath;

    const camelCaseTokens = {
      accessToken: 'file-access-token',
      refreshToken: 'file-refresh-token',
      expiryDate: 9999999999,
    };

    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(camelCaseTokens));
    (path.resolve as jest.Mock).mockReturnValue(filePath);

    const result = resolveTokens();
    expect(result.accessToken).toBe('file-access-token');
  });
});
