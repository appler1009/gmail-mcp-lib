# gmail-mcp-lib

A TypeScript npm package providing Gmail access via the official Google SDK with dual mode support: standalone MCP (Model Context Protocol) stdio server and library for easy integration into Node.js/TypeScript projects.

## Features

- **Dual Mode**: Use as a standalone MCP server or import as a library
- **Type-Safe**: Fully typed TypeScript interfaces for all Gmail operations
- **Flexible Token Resolution**: Support for JSON files, environment variables, and direct parameters
- **Complete Gmail API Support**: Access messages, threads, labels, drafts, and more
- **MCP Tools**: All functions exposed as MCP tools with Zod schemas for validation
- **Error Handling**: Proper error handling and reporting to stderr

## Installation

```bash
npm install gmail-mcp-lib
```

## Setup

Before using `gmail-mcp-lib`, you need to set up Google OAuth2 credentials:

1. Create a Google Cloud project at https://console.cloud.google.com
2. Enable the Gmail API
3. Create OAuth2 credentials (Desktop application)
4. Set the following environment variables:

```bash
export GOOGLE_CLIENT_ID="your-client-id"
export GOOGLE_CLIENT_SECRET="your-client-secret"
export GOOGLE_REDIRECT_URL="http://localhost:3000/callback" # or your redirect URL
```

## Token Resolution

Tokens are resolved using the following priority (highest to lowest):

1. **Direct Parameter**: Tokens passed directly to functions
2. **Environment Variable**: `GMAIL_TOKEN` as a JSON string
3. **File**: `token.json` or custom path via `GMAIL_TOKEN_FILE`

### Example: Using Token File

Create a `token.json` file with your OAuth2 credentials:

```json
{
  "accessToken": "ya29.a0AfH6SMBx...",
  "refreshToken": "1//0gKn...",
  "expiryDate": 1234567890,
  "tokenType": "Bearer"
}
```

### Example: Using Environment Variable

```bash
export GMAIL_TOKEN='{"accessToken":"ya29.a0AfH6SMBx...","refreshToken":"1//0gKn...","expiryDate":1234567890,"tokenType":"Bearer"}'
```

### Example: Direct Parameter

```typescript
const tokens = {
  accessToken: 'ya29.a0AfH6SMBx...',
  refreshToken: '1//0gKn...',
  expiryDate: 1234567890,
  tokenType: 'Bearer',
};

const messages = await listMessages('me', {}, tokens);
```

## Usage

### As a Library

Import and use individual functions or create a client instance:

#### Using Individual Functions

```typescript
import { listMessages, sendMessage, searchMessages } from 'gmail-mcp-lib';

// List messages
const messages = await listMessages('me', {
  maxResults: 10,
});

// Search messages
const unread = await searchMessages('is:unread', {
  maxResults: 5,
});

// Send message
const sent = await sendMessage({
  to: 'recipient@example.com',
  subject: 'Hello',
  body: 'This is a test email',
});
```

#### Using Client Instance

```typescript
import { createGmailClient } from 'gmail-mcp-lib';

const client = createGmailClient();

// List messages
const messages = await client.listMessages('me', {
  q: 'is:unread',
  maxResults: 10,
});

// Get specific message
const message = await client.getMessage('me', 'messageId');

// Send message
const sent = await client.sendMessage('me', {
  to: 'recipient@example.com',
  subject: 'Hello',
  body: 'This is a test email',
  html: false,
});

// Search messages
const results = await client.searchMessages('me', 'from:sender@example.com');

// Create draft
const draft = await client.createDraft('me', {
  to: 'recipient@example.com',
  subject: 'Draft Email',
  body: 'Draft content',
});

// List labels
const labels = await client.listLabels('me');

// Modify message labels
const modified = await client.modifyMessageLabels('me', 'messageId', {
  addLabelIds: ['LABEL_ID'],
  removeLabelIds: ['DRAFT'],
});

// Move to trash
const trashed = await client.trashMessage('me', 'messageId');

// Restore from trash
const restored = await client.untrashMessage('me', 'messageId');

// Archive message (remove from inbox)
const archived = await client.archiveMessage('me', 'messageId');

// Unarchive message (restore to inbox)
const unarchived = await client.unarchiveMessage('me', 'messageId');

// List threads
const threads = await client.listThreads('me', {
  q: 'is:unread',
  maxResults: 5,
});

// Get specific thread
const thread = await client.getThread('me', 'threadId');
```

### As an MCP Server

Run the server via stdio:

```bash
gmail-mcp-lib
```

Or if installed locally:

```bash
npx gmail-mcp-lib
```

The server exposes the following tools:

- `gmailListMessages` - List messages in the mailbox
- `gmailGetMessage` - Get a specific message by ID
- `gmailSearchMessages` - Search for messages using Gmail search syntax
- `gmailSendMessage` - Send an email message
- `gmailCreateDraft` - Create a draft email message
- `gmailListLabels` - List all labels in the mailbox
- `gmailModifyMessageLabels` - Add or remove labels from a message
- `gmailTrashMessage` - Move a message to trash
- `gmailUntrashMessage` - Restore a message from trash
- `gmailArchiveMessage` - Archive a message (remove from inbox)
- `gmailUnarchiveMessage` - Unarchive a message (restore to inbox)
- `gmailListThreads` - List threads in the mailbox
- `gmailGetThread` - Get a specific thread by ID

All tools accept tokens as a parameter, following the same token resolution priority.

## API Reference

### Types

```typescript
interface Tokens {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
  tokenType?: string;
}

interface Message {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  historyId?: string;
  internalDate?: string;
  payload?: MessagePayload;
  sizeEstimate?: number;
  raw?: string;
}

interface Thread {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: Message[];
}

interface Label {
  id: string;
  name: string;
  labelListVisibility?: string;
  messageListVisibility?: string;
  type?: string;
}

interface Draft {
  id: string;
  message?: Message;
}

interface SendMessageOptions {
  to: string | string[];
  subject?: string;
  body?: string;
  html?: boolean;
  threadId?: string;
  labelIds?: string[];
  inReplyTo?: string;
}

interface CreateDraftOptions {
  to: string | string[];
  subject?: string;
  body?: string;
  html?: boolean;
  threadId?: string;
}

interface ListMessagesOptions {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  includeSpamTrash?: boolean;
  labelIds?: string[];
}

interface ListThreadsOptions {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  includeSpamTrash?: boolean;
  labelIds?: string[];
}

interface ModifyLabelsOptions {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}
```

### Functions

#### `createGmailClient(options?: GmailClientOptions): GmailClient`

Create a new Gmail client instance.

```typescript
const client = createGmailClient({ tokens: customTokens });
```

#### `resolveTokens(provided?: Tokens): Tokens`

Resolve tokens from the environment and file system.

```typescript
const tokens = resolveTokens();
```

#### Message Functions

```typescript
listMessages(userId?: string, options?: ListMessagesOptions, tokens?: Tokens): Promise<Message[]>
getMessage(messageId: string, tokens?: Tokens, format?: 'full' | 'minimal' | 'raw' | 'metadata'): Promise<Message>
searchMessages(query: string, tokens?: Tokens, options?: Omit<ListMessagesOptions, 'q'>): Promise<Message[]>
sendMessage(options: SendMessageOptions, tokens?: Tokens): Promise<Message>
createDraft(options: CreateDraftOptions, tokens?: Tokens): Promise<Draft>
modifyMessageLabels(messageId: string, options: ModifyLabelsOptions, tokens?: Tokens): Promise<Message>
trashMessage(messageId: string, tokens?: Tokens): Promise<Message>
untrashMessage(messageId: string, tokens?: Tokens): Promise<Message>
archiveMessage(messageId: string, tokens?: Tokens): Promise<Message>
unarchiveMessage(messageId: string, tokens?: Tokens): Promise<Message>
```

#### Label Functions

```typescript
listLabels(tokens?: Tokens): Promise<Label[]>
```

#### Thread Functions

```typescript
listThreads(tokens?: Tokens, options?: ListThreadsOptions): Promise<Thread[]>
getThread(threadId: string, tokens?: Tokens, format?: 'full' | 'minimal' | 'metadata'): Promise<Thread>
```

## Building

```bash
npm run build
```

The compiled JavaScript will be in the `dist` directory.

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run coverage
```

The package aims for 70%+ coverage on branches, functions, lines, and statements.

## Development

Watch mode for development:

```bash
npm run dev
```

## License

MIT

## Author

@appler1009

## Notes

- Token rotation is handled externally; this package does not refresh tokens automatically
- Tokens are not persisted; you must manage token persistence yourself
- Error messages are logged to stderr for both library and server modes
- The MCP server uses 2-space indentation and follows strict TypeScript conventions
