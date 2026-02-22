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

// Zod schemas for tool inputs
const TokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string().optional(),
  expiryDate: z.number().optional(),
  tokenType: z.string().optional(),
});

const ListMessagesInputSchema = z.object({
  q: z.string().optional().describe('Gmail search query'),
  maxResults: z.number().optional().describe('Max results to return'),
  pageToken: z.string().optional().describe('Pagination token'),
  includeSpamTrash: z.boolean().optional().describe('Include spam and trash'),
  labelIds: z.array(z.string()).optional().describe('Label IDs to filter by'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const GetMessageInputSchema = z.object({
  messageId: z.string().describe('The message ID'),
  format: z.enum(['full', 'minimal', 'raw', 'metadata']).optional().default('full'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const SearchMessagesInputSchema = z.object({
  query: z.string().describe('Gmail search query'),
  maxResults: z.number().optional().describe('Max results to return'),
  pageToken: z.string().optional().describe('Pagination token'),
  labelIds: z.array(z.string()).optional().describe('Label IDs to filter by'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const SendMessageInputSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]).describe('Recipient(s)'),
  subject: z.string().optional().describe('Email subject'),
  body: z.string().optional().describe('Email body'),
  html: z.boolean().optional().default(false).describe('Whether body is HTML'),
  threadId: z.string().optional().describe('Reply to thread ID'),
  inReplyTo: z.string().optional().describe('In-Reply-To message ID'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const CreateDraftInputSchema = z.object({
  to: z.union([z.string(), z.array(z.string())]).describe('Recipient(s)'),
  subject: z.string().optional().describe('Email subject'),
  body: z.string().optional().describe('Email body'),
  html: z.boolean().optional().default(false).describe('Whether body is HTML'),
  threadId: z.string().optional().describe('Reply to thread ID'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const ListLabelsInputSchema = z.object({
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const ModifyLabelsInputSchema = z.object({
  messageId: z.string().describe('The message ID'),
  addLabelIds: z.array(z.string()).optional().describe('Labels to add'),
  removeLabelIds: z.array(z.string()).optional().describe('Labels to remove'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const TrashMessageInputSchema = z.object({
  messageId: z.string().describe('The message ID'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const UntrashMessageInputSchema = z.object({
  messageId: z.string().describe('The message ID'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const ListThreadsInputSchema = z.object({
  q: z.string().optional().describe('Gmail search query'),
  maxResults: z.number().optional().describe('Max results to return'),
  pageToken: z.string().optional().describe('Pagination token'),
  labelIds: z.array(z.string()).optional().describe('Label IDs to filter by'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

const GetThreadInputSchema = z.object({
  threadId: z.string().describe('The thread ID'),
  format: z.enum(['full', 'minimal', 'metadata']).optional().default('full'),
  tokens: TokensSchema.optional().describe('Gmail authentication tokens'),
});

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
  const { name, arguments: args } = request;
  const toolArgs = args as Record<string, unknown>;
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
