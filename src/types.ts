export interface Tokens {
  // Support both snake_case (OAuth2 standard) and camelCase
  access_token?: string;
  refresh_token?: string;
  expiry_date?: number;
  token_type?: string;
  accessToken?: string;
  refreshToken?: string;
  expiryDate?: number;
  tokenType?: string;
}

export interface Message {
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

export interface MessagePayload {
  mimeType?: string;
  filename?: string;
  headers?: MessageHeader[];
  body?: MessagePartBody;
  parts?: MessagePayload[];
}

export interface MessageHeader {
  name: string;
  value: string;
}

export interface MessagePartBody {
  size: number;
  data?: string;
  attachmentId?: string;
}

export interface Thread {
  id: string;
  snippet?: string;
  historyId?: string;
  messages?: Message[];
}

export interface Label {
  id: string;
  name: string;
  labelListVisibility?: string;
  messageListVisibility?: string;
  type?: string;
}

export interface Draft {
  id: string;
  message?: Message;
}

export interface ListMessagesOptions {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  includeSpamTrash?: boolean;
  labelIds?: string[];
}

export interface ListThreadsOptions {
  q?: string;
  maxResults?: number;
  pageToken?: string;
  includeSpamTrash?: boolean;
  labelIds?: string[];
}

export interface ModifyLabelsOptions {
  addLabelIds?: string[];
  removeLabelIds?: string[];
}

export interface SendMessageOptions {
  to: string | string[];
  subject?: string;
  body?: string;
  html?: boolean;
  threadId?: string;
  labelIds?: string[];
  inReplyTo?: string;
}

export interface CreateDraftOptions {
  to: string | string[];
  subject?: string;
  body?: string;
  html?: boolean;
  threadId?: string;
}
