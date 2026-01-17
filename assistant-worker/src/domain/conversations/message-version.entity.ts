/**
 * Message Version Entity - immutable record of edits
 */

export interface MessageVersion {
  messageId: string;
  conversationId: string;
  version: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  editedBy?: string;
  editedAt: Date;
  diff?: string; // optional textual diff
  previousRefVersion?: number;
}
