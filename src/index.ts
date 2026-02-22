import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import {
  Tokens,
  Message,
  Thread,
  Label,
  Draft,
  ListMessagesOptions,
  ListThreadsOptions,
  ModifyLabelsOptions,
  SendMessageOptions,
  CreateDraftOptions,
} from './types';
import { resolveTokens } from './tokens';

export * from './types';
export { resolveTokens };

interface GmailClientOptions {
  tokens?: Tokens;
}

class GmailClient {
  private oauth2Client: OAuth2Client;
  private gmail: ReturnType<typeof google.gmail>;

  constructor(tokens: Tokens) {
    this.oauth2Client = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URL || 'http://localhost:3000/callback'
    );

    // Normalize tokens to snake_case for OAuth2Client
    const normalizedTokens = {
      access_token: tokens.access_token || tokens.accessToken,
      refresh_token: tokens.refresh_token || tokens.refreshToken,
      expiry_date: tokens.expiry_date || tokens.expiryDate,
      token_type: tokens.token_type || tokens.tokenType,
    };

    this.oauth2Client.setCredentials(normalizedTokens);
    this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
  }

  async listMessages(userId: string = 'me', options?: ListMessagesOptions): Promise<Message[]> {
    try {
      const response = await this.gmail.users.messages.list({
        userId,
        q: options?.q,
        maxResults: options?.maxResults,
        pageToken: options?.pageToken,
        includeSpamTrash: options?.includeSpamTrash,
        labelIds: options?.labelIds,
      });

      return (response.data.messages || []) as Message[];
    } catch (error) {
      this.handleError(error);
    }
  }

  async getMessage(userId: string = 'me', messageId: string, format: 'full' | 'minimal' | 'raw' | 'metadata' = 'full'): Promise<Message> {
    try {
      const response = await this.gmail.users.messages.get({
        userId,
        id: messageId,
        format,
      });

      return response.data as Message;
    } catch (error) {
      this.handleError(error);
    }
  }

  async searchMessages(userId: string = 'me', query: string, options?: Omit<ListMessagesOptions, 'q'>): Promise<Message[]> {
    try {
      const response = await this.gmail.users.messages.list({
        userId,
        q: query,
        maxResults: options?.maxResults,
        pageToken: options?.pageToken,
        includeSpamTrash: options?.includeSpamTrash,
        labelIds: options?.labelIds,
      });

      return (response.data.messages || []) as Message[];
    } catch (error) {
      this.handleError(error);
    }
  }

  async sendMessage(userId: string = 'me', options: SendMessageOptions): Promise<Message> {
    try {
      const email = this.buildMessage(options);
      const response = await this.gmail.users.messages.send({
        userId,
        requestBody: {
          raw: Buffer.from(email).toString('base64'),
          threadId: options.threadId,
          labelIds: options.labelIds,
        },
      });

      return response.data as Message;
    } catch (error) {
      this.handleError(error);
    }
  }

  async createDraft(userId: string = 'me', options: CreateDraftOptions): Promise<Draft> {
    try {
      const email = this.buildMessage(options);
      const response = await this.gmail.users.drafts.create({
        userId,
        requestBody: {
          message: {
            raw: Buffer.from(email).toString('base64'),
            threadId: options.threadId,
          },
        },
      });

      return response.data as Draft;
    } catch (error) {
      this.handleError(error);
    }
  }

  async listLabels(userId: string = 'me'): Promise<Label[]> {
    try {
      const response = await this.gmail.users.labels.list({ userId });
      return (response.data.labels || []) as Label[];
    } catch (error) {
      this.handleError(error);
    }
  }

  async modifyMessageLabels(userId: string = 'me', messageId: string, options: ModifyLabelsOptions): Promise<Message> {
    try {
      const response = await this.gmail.users.messages.modify({
        userId,
        id: messageId,
        requestBody: {
          addLabelIds: options.addLabelIds,
          removeLabelIds: options.removeLabelIds,
        },
      });

      return response.data as Message;
    } catch (error) {
      this.handleError(error);
    }
  }

  async trashMessage(userId: string = 'me', messageId: string): Promise<Message> {
    try {
      const response = await this.gmail.users.messages.trash({
        userId,
        id: messageId,
      });

      return response.data as Message;
    } catch (error) {
      this.handleError(error);
    }
  }

  async untrashMessage(userId: string = 'me', messageId: string): Promise<Message> {
    try {
      const response = await this.gmail.users.messages.untrash({
        userId,
        id: messageId,
      });

      return response.data as Message;
    } catch (error) {
      this.handleError(error);
    }
  }

  async listThreads(userId: string = 'me', options?: ListThreadsOptions): Promise<Thread[]> {
    try {
      const response = await this.gmail.users.threads.list({
        userId,
        q: options?.q,
        maxResults: options?.maxResults,
        pageToken: options?.pageToken,
        includeSpamTrash: options?.includeSpamTrash,
        labelIds: options?.labelIds,
      });

      return (response.data.threads || []) as Thread[];
    } catch (error) {
      this.handleError(error);
    }
  }

  async getThread(userId: string = 'me', threadId: string, format: 'full' | 'minimal' | 'metadata' = 'full'): Promise<Thread> {
    try {
      const response = await this.gmail.users.threads.get({
        userId,
        id: threadId,
        format,
      });

      return response.data as Thread;
    } catch (error) {
      this.handleError(error);
    }
  }

  private buildMessage(options: SendMessageOptions | CreateDraftOptions): string {
    const to = Array.isArray(options.to) ? options.to.join(',') : options.to;
    const subject = options.subject || '(no subject)';
    const body = options.body || '';
    const contentType = 'html' in options && options.html ? 'text/html' : 'text/plain';

    const headers = [
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${contentType}; charset="UTF-8"`,
      `MIME-Version: 1.0`,
    ];

    if ('inReplyTo' in options && options.inReplyTo) {
      headers.push(`In-Reply-To: ${options.inReplyTo}`);
      headers.push(`References: ${options.inReplyTo}`);
    }

    return `${headers.join('\r\n')}\r\n\r\n${body}`;
  }

  private handleError(error: unknown): never {
    if (error instanceof Error) {
      console.error(`Gmail API error: ${error.message}`);
      throw error;
    }
    console.error('Unknown Gmail API error:', error);
    throw new Error('Unknown Gmail API error');
  }
}

export function createGmailClient(options?: GmailClientOptions): GmailClient {
  const tokens = resolveTokens(options?.tokens);
  return new GmailClient(tokens);
}

// Export individual functions that use default client
export async function listMessages(userId?: string, options?: ListMessagesOptions, tokens?: Tokens): Promise<Message[]> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.listMessages(userId, options);
}

export async function getMessage(messageId: string, tokens?: Tokens, format?: 'full' | 'minimal' | 'raw' | 'metadata'): Promise<Message> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.getMessage('me', messageId, format);
}

export async function searchMessages(query: string, tokens?: Tokens, options?: Omit<ListMessagesOptions, 'q'>): Promise<Message[]> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.searchMessages('me', query, options);
}

export async function sendMessage(options: SendMessageOptions, tokens?: Tokens): Promise<Message> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.sendMessage('me', options);
}

export async function createDraft(options: CreateDraftOptions, tokens?: Tokens): Promise<Draft> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.createDraft('me', options);
}

export async function listLabels(tokens?: Tokens): Promise<Label[]> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.listLabels();
}

export async function modifyMessageLabels(messageId: string, options: ModifyLabelsOptions, tokens?: Tokens): Promise<Message> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.modifyMessageLabels('me', messageId, options);
}

export async function trashMessage(messageId: string, tokens?: Tokens): Promise<Message> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.trashMessage('me', messageId);
}

export async function untrashMessage(messageId: string, tokens?: Tokens): Promise<Message> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.untrashMessage('me', messageId);
}

export async function listThreads(tokens?: Tokens, options?: ListThreadsOptions): Promise<Thread[]> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.listThreads('me', options);
}

export async function getThread(threadId: string, tokens?: Tokens, format?: 'full' | 'minimal' | 'metadata'): Promise<Thread> {
  const client = new GmailClient(resolveTokens(tokens));
  return client.getThread('me', threadId, format);
}
