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
  isActive: boolean;
  createdAt: number;
  lastLogin?: number;
  passwordHashStub?: string;
}
export interface UserCreateInput {
  email: string;
  name: string;
  role: UserRole;
  tenantId?: string;
  password?: string;
}
export interface UserUpdateInput {
  name?: string;
  role?: UserRole;
  tenantId?: string;
  isActive?: boolean;
}
export type OfflineRequestStatus = 'pending' | 'dispatched';
export interface OfflineRequest {
  id: string;
  tenantId: string;
  queueId?: string;
  visitorName: string;
  visitorEmail: string;
  subject: string;
  message: string;
  status: OfflineRequestStatus;
  createdAt: number;
  dispatchTimestamp?: number;
  dispatchedBy?: string;
}
export interface QueueStatus {
  available: boolean;
  agentsOnline: number;
  capacityUsed: number;
  capacityMax: number;
  isFull: boolean;
}
export interface QueueJoinLeaveInput {
  queueId: string;
  action: 'join' | 'leave';
}
export interface MetricPoint {
  timestamp: string;
  value: number;
}
export interface SystemMetrics {
  hourlyMessageVolume: MetricPoint[];
  avgResponseTime: number;
  resolutionRate: number;
  activeAgents: number;
  totalConvs: number;
}
export interface GlobalMetrics {
  totalTenants: number;
  totalMessages: number;
  activeAgentsPlatform: number;
  uptime: string;
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
export interface TenantSite {
  id: string;
  name: string;
  key: string;
  defaultQueueId?: string;
}
export interface AuthPolicy {
  allowLocalAuth: boolean;
  entraClientId?: string;
  entraClientSecretStub?: string;
}
export interface Tenant {
  id: string;
  name: string;
  sites: TenantSite[];
  branding: {
    primaryColor: string;
    logoUrl?: string;
    welcomeMessage: string;
    fontFamily?: string;
    widgetPosition?: 'bottom-right' | 'bottom-left';
    themePreset?: 'modern' | 'glass' | 'classic';
    allowedOrigins?: string[];
  };
  queues: Queue[];
  workflows: Workflow[];
  authPolicy?: AuthPolicy;
}
export interface Queue {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  assignedAgentIds: string[];
  capacityMax?: number;
  priority?: number;
  isDeleted?: boolean;
  autoAssignEnabled?: boolean;
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
  availableTenants?: { id: string; name: string }[];
}
export interface PublicConfig {
  tenantId: string;
  name: string;
  branding: Tenant['branding'];
  queues: { id: string; name: string; priority: number }[];
  defaultQueueId?: string;
  initialQueueStatus?: QueueStatus;
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