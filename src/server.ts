#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createGmailClient,
  resolveTokens,
  Tokens,
  Message,
  Label,
  Thread,
  Draft,
} from './index.js';

const server = new Server(
  {
    name: 'gmail-mcp-lib',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// JSON Schema definitions for tool inputs
const tokensSchema = {
  type: 'object' as const,
  properties: {
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiryDate: { type: 'number' },
    tokenType: { type: 'string' },
  },
};

const ListMessagesInputSchema = {
  type: 'object' as const,
  properties: {
    q: { type: 'string', description: 'Gmail search query' },
    maxResults: { type: 'number', description: 'Max results to return' },
    pageToken: { type: 'string', description: 'Pagination token' },
    includeSpamTrash: { type: 'boolean', description: 'Include spam and trash' },
    labelIds: { type: 'array', items: { type: 'string' }, description: 'Label IDs to filter by' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
};

const GetMessageInputSchema = {
  type: 'object' as const,
  properties: {
    messageId: { type: 'string', description: 'The message ID' },
    format: { type: 'string', enum: ['full', 'minimal', 'raw', 'metadata'], description: 'Message format' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
  required: ['messageId'],
};

const SearchMessagesInputSchema = {
  type: 'object' as const,
  properties: {
    query: { type: 'string', description: 'Gmail search query' },
    maxResults: { type: 'number', description: 'Max results to return' },
    pageToken: { type: 'string', description: 'Pagination token' },
    labelIds: { type: 'array', items: { type: 'string' }, description: 'Label IDs to filter by' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
  required: ['query'],
};

const SendMessageInputSchema = {
  type: 'object' as const,
  properties: {
    to: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Recipient(s)' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body' },
    html: { type: 'boolean', description: 'Whether body is HTML' },
    threadId: { type: 'string', description: 'Reply to thread ID' },
    inReplyTo: { type: 'string', description: 'In-Reply-To message ID' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
  required: ['to'],
};

const CreateDraftInputSchema = {
  type: 'object' as const,
  properties: {
    to: { oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }], description: 'Recipient(s)' },
    subject: { type: 'string', description: 'Email subject' },
    body: { type: 'string', description: 'Email body' },
    html: { type: 'boolean', description: 'Whether body is HTML' },
    threadId: { type: 'string', description: 'Reply to thread ID' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
  required: ['to'],
};

const ListLabelsInputSchema = {
  type: 'object' as const,
  properties: {
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
};

const ModifyLabelsInputSchema = {
  type: 'object' as const,
  properties: {
    messageId: { type: 'string', description: 'The message ID' },
    addLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to add' },
    removeLabelIds: { type: 'array', items: { type: 'string' }, description: 'Labels to remove' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
  required: ['messageId'],
};

const TrashMessageInputSchema = {
  type: 'object' as const,
  properties: {
    messageId: { type: 'string', description: 'The message ID' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
  required: ['messageId'],
};

const UntrashMessageInputSchema = {
  type: 'object' as const,
  properties: {
    messageId: { type: 'string', description: 'The message ID' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
  required: ['messageId'],
};

const ListThreadsInputSchema = {
  type: 'object' as const,
  properties: {
    q: { type: 'string', description: 'Gmail search query' },
    maxResults: { type: 'number', description: 'Max results to return' },
    pageToken: { type: 'string', description: 'Pagination token' },
    labelIds: { type: 'array', items: { type: 'string' }, description: 'Label IDs to filter by' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
};

const GetThreadInputSchema = {
  type: 'object' as const,
  properties: {
    threadId: { type: 'string', description: 'The thread ID' },
    format: { type: 'string', enum: ['full', 'minimal', 'metadata'], description: 'Thread format' },
    tokens: { ...tokensSchema, description: 'Gmail authentication tokens' },
  },
  required: ['threadId'],
};

const tools: Tool[] = [
  {
    name: 'gmailListMessages',
    description: 'List messages in the mailbox',
    inputSchema: ListMessagesInputSchema,
  },
  {
    name: 'gmailGetMessage',
    description: 'Get a specific message by ID',
    inputSchema: GetMessageInputSchema,
  },
  {
    name: 'gmailSearchMessages',
    description: 'Search for messages using Gmail search syntax',
    inputSchema: SearchMessagesInputSchema,
  },
  {
    name: 'gmailSendMessage',
    description: 'Send an email message',
    inputSchema: SendMessageInputSchema,
  },
  {
    name: 'gmailCreateDraft',
    description: 'Create a draft email message',
    inputSchema: CreateDraftInputSchema,
  },
  {
    name: 'gmailListLabels',
    description: 'List all labels in the mailbox',
    inputSchema: ListLabelsInputSchema,
  },
  {
    name: 'gmailModifyMessageLabels',
    description: 'Add or remove labels from a message',
    inputSchema: ModifyLabelsInputSchema,
  },
  {
    name: 'gmailTrashMessage',
    description: 'Move a message to trash',
    inputSchema: TrashMessageInputSchema,
  },
  {
    name: 'gmailUntrashMessage',
    description: 'Restore a message from trash',
    inputSchema: UntrashMessageInputSchema,
  },
  {
    name: 'gmailListThreads',
    description: 'List threads in the mailbox',
    inputSchema: ListThreadsInputSchema,
  },
  {
    name: 'gmailGetThread',
    description: 'Get a specific thread by ID',
    inputSchema: GetThreadInputSchema,
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { params } = request;
  const { name, arguments: args } = params;
  const toolArgs = (args || {}) as Record<string, unknown>;
  const tokens = (toolArgs.tokens as Tokens) || undefined;

  try {
    const client = createGmailClient({ tokens });

    switch (name) {
      case 'gmailListMessages':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await (client as any).listMessages('me', {
                  q: toolArgs.q,
                  maxResults: toolArgs.maxResults,
                  pageToken: toolArgs.pageToken,
                  includeSpamTrash: toolArgs.includeSpamTrash,
                  labelIds: toolArgs.labelIds,
                })
              ),
            },
          ],
        };

      case 'gmailGetMessage':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await (client as any).getMessage('me', toolArgs.messageId, toolArgs.format)
              ),
            },
          ],
        };

      case 'gmailSearchMessages':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await (client as any).searchMessages('me', toolArgs.query, {
                  maxResults: toolArgs.maxResults,
                  pageToken: toolArgs.pageToken,
                  labelIds: toolArgs.labelIds,
                })
              ),
            },
          ],
        };

      case 'gmailSendMessage':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await (client as any).sendMessage('me', {
                  to: toolArgs.to,
                  subject: toolArgs.subject,
                  body: toolArgs.body,
                  html: toolArgs.html,
                  threadId: toolArgs.threadId,
                  inReplyTo: toolArgs.inReplyTo,
                })
              ),
            },
          ],
        };

      case 'gmailCreateDraft':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await (client as any).createDraft('me', {
                  to: toolArgs.to,
                  subject: toolArgs.subject,
                  body: toolArgs.body,
                  html: toolArgs.html,
                  threadId: toolArgs.threadId,
                })
              ),
            },
          ],
        };

      case 'gmailListLabels':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await (client as any).listLabels()),
            },
          ],
        };

      case 'gmailModifyMessageLabels':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await (client as any).modifyMessageLabels('me', toolArgs.messageId, {
                  addLabelIds: toolArgs.addLabelIds,
                  removeLabelIds: toolArgs.removeLabelIds,
                })
              ),
            },
          ],
        };

      case 'gmailTrashMessage':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await (client as any).trashMessage('me', toolArgs.messageId)),
            },
          ],
        };

      case 'gmailUntrashMessage':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(await (client as any).untrashMessage('me', toolArgs.messageId)),
            },
          ],
        };

      case 'gmailListThreads':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await (client as any).listThreads('me', {
                  q: toolArgs.q,
                  maxResults: toolArgs.maxResults,
                  pageToken: toolArgs.pageToken,
                  labelIds: toolArgs.labelIds,
                })
              ),
            },
          ],
        };

      case 'gmailGetThread':
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(
                await (client as any).getThread('me', toolArgs.threadId, toolArgs.format)
              ),
            },
          ],
        };

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
          isError: true,
        };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Tool error: ${message}`);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${message}`,
        },
      ],
      isError: true,
    };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Gmail MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
