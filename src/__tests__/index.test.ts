import { createGmailClient, resolveTokens, Tokens } from '../index';
import * as tokens from '../tokens';

jest.mock('../tokens');

// Create a mock Gmail API instance that will be reused
let mockGmailApi: any;

jest.mock('googleapis', () => ({
  google: {
    gmail: jest.fn(() => {
      if (!mockGmailApi) {
        mockGmailApi = {
          users: {
            messages: {
              list: jest.fn(),
              get: jest.fn(),
              send: jest.fn(),
              modify: jest.fn(),
              trash: jest.fn(),
              untrash: jest.fn(),
            },
            drafts: {
              create: jest.fn(),
            },
            labels: {
              list: jest.fn(),
            },
            threads: {
              list: jest.fn(),
              get: jest.fn(),
            },
          },
        };
      }
      return mockGmailApi;
    }),
  },
}));

jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({
    setCredentials: jest.fn(),
  })),
}));

const mockTokens: Tokens = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  expiry_date: 1234567890,
  token_type: 'Bearer',
};

describe('Gmail Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset the mock Gmail API
    mockGmailApi = null;
    (tokens.resolveTokens as jest.Mock).mockReturnValue(mockTokens);
  });

  describe('createGmailClient', () => {
    it('should create a client with provided tokens', () => {
      const client = createGmailClient({ tokens: mockTokens });
      expect(client).toBeDefined();
    });

    it('should create a client using resolveTokens if no tokens provided', () => {
      createGmailClient();
      expect(tokens.resolveTokens).toHaveBeenCalled();
    });

    it('should create a client with camelCase token properties', () => {
      const camelTokens: Tokens = {
        accessToken: 'camel-access',
        refreshToken: 'camel-refresh',
        expiryDate: 1234567890,
        tokenType: 'Bearer',
      };
      const client = createGmailClient({ tokens: camelTokens });
      expect(client).toBeDefined();
    });

    it('should normalize mixed snake_case and camelCase tokens', () => {
      const mixedTokens: Tokens = {
        access_token: 'snake-access',
        refreshToken: 'camel-refresh',
        expiry_date: 1234567890,
        tokenType: 'Bearer',
      };
      const client = createGmailClient({ tokens: mixedTokens });
      expect(client).toBeDefined();
    });
  });

  describe('listMessages', () => {
    it('should list messages with optional parameters', async () => {
      const mockMessages = [
        { id: 'msg1', threadId: 'thread1' },
        { id: 'msg2', threadId: 'thread2' },
      ];

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.list.mockResolvedValue({
        data: { messages: mockMessages },
      });

      const result = await (client as any).listMessages('me', {
        q: 'is:unread',
        maxResults: 10,
      });

      expect(result).toEqual(mockMessages);
      expect(api.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'me',
          q: 'is:unread',
          maxResults: 10,
        })
      );
    });

    it('should return empty array when no messages found', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.list.mockResolvedValue({
        data: {},
      });

      const result = await (client as any).listMessages('me');
      expect(result).toEqual([]);
    });

    it('should handle API errors', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.list.mockRejectedValue(new Error('API Error'));

      await expect((client as any).listMessages('me')).rejects.toThrow('API Error');
    });
  });

  describe('getMessage', () => {
    it('should get a specific message', async () => {
      const mockMessage = {
        id: 'msg1',
        threadId: 'thread1',
        snippet: 'Test message',
      };

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.get.mockResolvedValue({
        data: mockMessage,
      });

      const result = await (client as any).getMessage('me', 'msg1', 'full');

      expect(result).toEqual(mockMessage);
      expect(api.users.messages.get).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg1',
        format: 'full',
      });
    });

    it('should handle API errors on get message', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.get.mockRejectedValue(new Error('Get message failed'));

      await expect((client as any).getMessage('me', 'msg1')).rejects.toThrow('Get message failed');
    });
  });

  describe('searchMessages', () => {
    it('should search messages with query', async () => {
      const mockMessages = [{ id: 'msg1', threadId: 'thread1' }];

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.list.mockResolvedValue({
        data: { messages: mockMessages },
      });

      const result = await (client as any).searchMessages('me', 'from:test@example.com');

      expect(result).toEqual(mockMessages);
      expect(api.users.messages.list).toHaveBeenCalledWith(
        expect.objectContaining({
          q: 'from:test@example.com',
        })
      );
    });

    it('should handle API errors on search', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.list.mockRejectedValue(new Error('Search failed'));

      await expect((client as any).searchMessages('me', 'is:unread')).rejects.toThrow('Search failed');
    });
  });

  describe('sendMessage', () => {
    it('should send a message', async () => {
      const mockSentMessage = { id: 'sent1', threadId: 'thread1' };

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.send.mockResolvedValue({
        data: mockSentMessage,
      });

      const result = await (client as any).sendMessage('me', {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test body',
      });

      expect(result).toEqual(mockSentMessage);
      expect(api.users.messages.send).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'me',
          requestBody: expect.objectContaining({
            raw: expect.any(String),
          }),
        })
      );
    });

    it('should handle multiple recipients', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.send.mockResolvedValue({
        data: { id: 'sent1' },
      });

      await (client as any).sendMessage('me', {
        to: ['test1@example.com', 'test2@example.com'],
        subject: 'Test',
        body: 'Test body',
      });

      const callArgs = api.users.messages.send.mock.calls[0][0];
      const raw = Buffer.from(callArgs.requestBody.raw, 'base64').toString();
      expect(raw).toContain('To: test1@example.com,test2@example.com');
    });

    it('should send HTML emails', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.send.mockResolvedValue({
        data: { id: 'sent1' },
      });

      await (client as any).sendMessage('me', {
        to: 'test@example.com',
        subject: 'Test',
        body: '<h1>Test</h1>',
        html: true,
      });

      const callArgs = api.users.messages.send.mock.calls[0][0];
      const raw = Buffer.from(callArgs.requestBody.raw, 'base64').toString();
      expect(raw).toContain('Content-Type: text/html');
    });

    it('should include inReplyTo headers when replying', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.send.mockResolvedValue({
        data: { id: 'sent1' },
      });

      await (client as any).sendMessage('me', {
        to: 'test@example.com',
        subject: 'Re: Test',
        body: 'Reply body',
        inReplyTo: 'msg123',
      });

      const callArgs = api.users.messages.send.mock.calls[0][0];
      const raw = Buffer.from(callArgs.requestBody.raw, 'base64').toString();
      expect(raw).toContain('In-Reply-To: msg123');
      expect(raw).toContain('References: msg123');
    });

    it('should handle API errors on send', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.send.mockRejectedValue(new Error('Send failed'));

      await expect((client as any).sendMessage('me', {
        to: 'test@example.com',
        subject: 'Test',
        body: 'Test',
      })).rejects.toThrow('Send failed');
    });
  });

  describe('createDraft', () => {
    it('should create a draft', async () => {
      const mockDraft = { id: 'draft1', message: { id: 'msg1' } };

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.drafts.create.mockResolvedValue({
        data: mockDraft,
      });

      const result = await (client as any).createDraft('me', {
        to: 'test@example.com',
        subject: 'Draft',
        body: 'Draft body',
      });

      expect(result).toEqual(mockDraft);
    });

    it('should handle API errors on draft creation', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.drafts.create.mockRejectedValue(new Error('Draft creation failed'));

      await expect((client as any).createDraft('me', {
        to: 'test@example.com',
        subject: 'Draft',
        body: 'Draft body',
      })).rejects.toThrow('Draft creation failed');
    });
  });

  describe('listLabels', () => {
    it('should list all labels', async () => {
      const mockLabels = [
        { id: 'INBOX', name: 'INBOX' },
        { id: 'SENT', name: 'SENT' },
      ];

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.labels.list.mockResolvedValue({
        data: { labels: mockLabels },
      });

      const result = await (client as any).listLabels('me');

      expect(result).toEqual(mockLabels);
    });

    it('should handle API errors on label list', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.labels.list.mockRejectedValue(new Error('Labels fetch failed'));

      await expect((client as any).listLabels('me')).rejects.toThrow('Labels fetch failed');
    });
  });

  describe('modifyMessageLabels', () => {
    it('should add and remove labels from a message', async () => {
      const mockModifiedMessage = {
        id: 'msg1',
        labelIds: ['INBOX', 'CUSTOM'],
      };

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.modify.mockResolvedValue({
        data: mockModifiedMessage,
      });

      const result = await (client as any).modifyMessageLabels('me', 'msg1', {
        addLabelIds: ['CUSTOM'],
        removeLabelIds: ['DRAFT'],
      });

      expect(result).toEqual(mockModifiedMessage);
      expect(api.users.messages.modify).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'me',
          id: 'msg1',
          requestBody: {
            addLabelIds: ['CUSTOM'],
            removeLabelIds: ['DRAFT'],
          },
        })
      );
    });

    it('should handle API errors on label modification', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.modify.mockRejectedValue(new Error('Modify failed'));

      await expect((client as any).modifyMessageLabels('me', 'msg1', {
        addLabelIds: ['CUSTOM'],
      })).rejects.toThrow('Modify failed');
    });
  });

  describe('trashMessage', () => {
    it('should move message to trash', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.trash.mockResolvedValue({
        data: { id: 'msg1' },
      });

      await (client as any).trashMessage('me', 'msg1');

      expect(api.users.messages.trash).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg1',
      });
    });

    it('should handle API errors on trash', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.trash.mockRejectedValue(new Error('Trash failed'));

      await expect((client as any).trashMessage('me', 'msg1')).rejects.toThrow('Trash failed');
    });
  });

  describe('untrashMessage', () => {
    it('should restore message from trash', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.untrash.mockResolvedValue({
        data: { id: 'msg1' },
      });

      await (client as any).untrashMessage('me', 'msg1');

      expect(api.users.messages.untrash).toHaveBeenCalledWith({
        userId: 'me',
        id: 'msg1',
      });
    });

    it('should handle API errors on untrash', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.messages.untrash.mockRejectedValue(new Error('Untrash failed'));

      await expect((client as any).untrashMessage('me', 'msg1')).rejects.toThrow('Untrash failed');
    });
  });

  describe('listThreads', () => {
    it('should list threads', async () => {
      const mockThreads = [
        { id: 'thread1', snippet: 'Thread snippet' },
      ];

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.threads.list.mockResolvedValue({
        data: { threads: mockThreads },
      });

      const result = await (client as any).listThreads('me');

      expect(result).toEqual(mockThreads);
    });

    it('should handle API errors on thread list', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.threads.list.mockRejectedValue(new Error('Thread list failed'));

      await expect((client as any).listThreads('me')).rejects.toThrow('Thread list failed');
    });
  });

  describe('getThread', () => {
    it('should get a specific thread', async () => {
      const mockThread = {
        id: 'thread1',
        messages: [{ id: 'msg1' }, { id: 'msg2' }],
      };

      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.threads.get.mockResolvedValue({
        data: mockThread,
      });

      const result = await (client as any).getThread('me', 'thread1', 'full');

      expect(result).toEqual(mockThread);
    });

    it('should handle API errors on thread get', async () => {
      const client = createGmailClient({ tokens: mockTokens });
      const googleModule = require('googleapis');
      const api = googleModule.google.gmail();

      api.users.threads.get.mockRejectedValue(new Error('Thread get failed'));

      await expect((client as any).getThread('me', 'thread1')).rejects.toThrow('Thread get failed');
    });
  });
});

describe('Error handling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGmailApi = null;
    (tokens.resolveTokens as jest.Mock).mockReturnValue(mockTokens);
  });

  it('should handle unknown error types', async () => {
    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    // Mock with a non-Error object
    api.users.messages.list.mockRejectedValue('string error');

    await expect((client as any).listMessages('me')).rejects.toThrow('Unknown Gmail API error');
  });
});

describe('Exported standalone functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGmailApi = null;
    (tokens.resolveTokens as jest.Mock).mockReturnValue(mockTokens);
  });

  it('listMessages should use tokens parameter if provided', async () => {
    const { listMessages } = require('../index');
    const mockMessages = [{ id: 'msg1', threadId: 'thread1' }];

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.messages.list.mockResolvedValue({
      data: { messages: mockMessages },
    });

    const result = await listMessages('me', {}, mockTokens);
    expect(result).toEqual(mockMessages);
  });

  it('getMessage should use tokens parameter if provided', async () => {
    const { getMessage } = require('../index');
    const mockMessage = { id: 'msg1', threadId: 'thread1' };

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.messages.get.mockResolvedValue({
      data: mockMessage,
    });

    const result = await getMessage('msg1', mockTokens);
    expect(result).toEqual(mockMessage);
  });

  it('searchMessages should use tokens parameter if provided', async () => {
    const { searchMessages } = require('../index');
    const mockMessages = [{ id: 'msg1', threadId: 'thread1' }];

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.messages.list.mockResolvedValue({
      data: { messages: mockMessages },
    });

    const result = await searchMessages('is:unread', mockTokens);
    expect(result).toEqual(mockMessages);
  });

  it('sendMessage should use tokens parameter if provided', async () => {
    const { sendMessage } = require('../index');
    const mockSent = { id: 'sent1', threadId: 'thread1' };

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.messages.send.mockResolvedValue({
      data: mockSent,
    });

    const result = await sendMessage({
      to: 'test@example.com',
      subject: 'Test',
      body: 'Test',
    }, mockTokens);
    expect(result).toEqual(mockSent);
  });

  it('createDraft should use tokens parameter if provided', async () => {
    const { createDraft } = require('../index');
    const mockDraft = { id: 'draft1', message: { id: 'msg1' } };

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.drafts.create.mockResolvedValue({
      data: mockDraft,
    });

    const result = await createDraft({
      to: 'test@example.com',
      subject: 'Draft',
      body: 'Draft',
    }, mockTokens);
    expect(result).toEqual(mockDraft);
  });

  it('listLabels should use tokens parameter if provided', async () => {
    const { listLabels } = require('../index');
    const mockLabels = [{ id: 'INBOX', name: 'INBOX' }];

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.labels.list.mockResolvedValue({
      data: { labels: mockLabels },
    });

    const result = await listLabels(mockTokens);
    expect(result).toEqual(mockLabels);
  });

  it('modifyMessageLabels should use tokens parameter if provided', async () => {
    const { modifyMessageLabels } = require('../index');
    const mockModified = { id: 'msg1', labelIds: ['INBOX'] };

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.messages.modify.mockResolvedValue({
      data: mockModified,
    });

    const result = await modifyMessageLabels('msg1', {
      addLabelIds: ['INBOX'],
    }, mockTokens);
    expect(result).toEqual(mockModified);
  });

  it('trashMessage should use tokens parameter if provided', async () => {
    const { trashMessage } = require('../index');

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.messages.trash.mockResolvedValue({
      data: { id: 'msg1' },
    });

    await trashMessage('msg1', mockTokens);
    expect(api.users.messages.trash).toHaveBeenCalled();
  });

  it('untrashMessage should use tokens parameter if provided', async () => {
    const { untrashMessage } = require('../index');

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.messages.untrash.mockResolvedValue({
      data: { id: 'msg1' },
    });

    await untrashMessage('msg1', mockTokens);
    expect(api.users.messages.untrash).toHaveBeenCalled();
  });

  it('listThreads should use tokens parameter if provided', async () => {
    const { listThreads } = require('../index');
    const mockThreads = [{ id: 'thread1', snippet: 'Test' }];

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.threads.list.mockResolvedValue({
      data: { threads: mockThreads },
    });

    const result = await listThreads(mockTokens);
    expect(result).toEqual(mockThreads);
  });

  it('getThread should use tokens parameter if provided', async () => {
    const { getThread } = require('../index');
    const mockThread = { id: 'thread1', messages: [] };

    const client = createGmailClient({ tokens: mockTokens });
    const googleModule = require('googleapis');
    const api = googleModule.google.gmail();

    api.users.threads.get.mockResolvedValue({
      data: mockThread,
    });

    const result = await getThread('thread1', mockTokens);
    expect(result).toEqual(mockThread);
  });
});
