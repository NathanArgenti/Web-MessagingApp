export type UserRole = 'superadmin' | 'tenant_admin' | 'agent';
export type PresenceStatus = 'online' | 'away' | 'offline';
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
  avatarUrl?: string;
  isOnline: boolean;
  presenceStatus?: PresenceStatus;
}
export type EventType = 'conversation.started' | 'conversation.ended' | 'agent.assigned';
export type ActionType = 'webhook' | 'email_mock' | 'log';
export interface Workflow {
  id: string;
  name: string;
  eventType: EventType;
  actionType: ActionType;
  targetUrl?: string;
  active: boolean;
}
export interface SystemEvent {
  id: string;
  tenantId: string;
  type: EventType;
  payload: Record<string, any>;
  timestamp: number;
  processed: boolean;
}
export interface Tenant {
  id: string;
  name: string;
  siteKey: string;
  branding: {
    primaryColor: string;
    logoUrl?: string;
    welcomeMessage: string;
  };
  queues: Queue[];
  workflows: Workflow[];
}
export interface Queue {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
}
export type ConversationStatus = 'unassigned' | 'owned' | 'ended';
export interface Conversation {
  id: string;
  tenantId: string;
  queueId: string;
  status: ConversationStatus;
  ownerId?: string;
  contactName: string;
  contactEmail?: string;
  createdAt: number;
  updatedAt: number;
}
export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  senderType: 'agent' | 'visitor' | 'system';
  content: string;
  timestamp: number;
  metadata?: Record<string, any>;
}
export interface ConversationWithMessages extends Conversation {
  messages: Message[];
}
export interface AuthPayload {
  user: User;
  token: string;
  tenant?: Tenant;
}
export interface PublicConfig {
  tenantId: string;
  name: string;
  branding: {
    primaryColor: string;
    logoUrl?: string;
    welcomeMessage: string;
  };
  queues: { id: string; name: string }[];
}
export interface SuperAdminStats {
  totalTenants: number;
  activeAgents: number;
  totalConversations: number;
}
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
export interface DemoItem {
  id: string;
  name: string;
  value: number;
}