import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { Message, ApiResponse, Conversation } from '@shared/types';
import { toast } from 'sonner';
export function useChat(conversationId: string | null) {
  const queryClient = useQueryClient();
  const token = useAuthStore(s => s.token);
  const userTenantId = useAuthStore(s => s.user?.tenantId);
  const selectedTenantId = useAuthStore(s => s.selectedTenantId);
  const setActiveConversationId = useAuthStore(s => s.setActiveConversationId);
  const effectiveTenantId = selectedTenantId || userTenantId || '';
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      try {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (effectiveTenantId) headers['X-Tenant-ID'] = effectiveTenantId;
        const res = await fetch(`/api/conversations/${conversationId}/messages`, { headers });
        if (res.status === 404 || res.status === 410) return [];
        const json = await res.json() as ApiResponse<Message[]>;
        return json.data ?? [];
      } catch (e) {
        console.error('[POLL ERROR]', e);
        return [];
      }
    },
    enabled: !!conversationId,
    refetchInterval: 3000,
  });
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) throw new Error('Session inactive');
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (effectiveTenantId) headers['X-Tenant-ID'] = effectiveTenantId;
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content }),
      });
      const json = await res.json() as ApiResponse<Message>;
      if (!json.success) throw new Error(json.error || "Failed to deliver");
      return json.data!;
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData(['messages', conversationId], (old: Message[] = []) => [...old, newMessage]);
    },
  });
  const claimMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers: Record<string, string> = { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': effectiveTenantId };
      const res = await fetch(`/api/conversations/${id}/claim`, { method: 'POST', headers });
      const json = await res.json() as ApiResponse<Conversation>;
      if (!json.success) throw new Error(json.error);
      return json.data!;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conversations', effectiveTenantId] });
      setActiveConversationId(data.id);
      toast.success('Conversation claimed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  const endMutation = useMutation({
    mutationFn: async (id: string) => {
      const headers: Record<string, string> = { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': effectiveTenantId };
      const res = await fetch(`/api/conversations/${id}/end`, { method: 'POST', headers });
      const json = await res.json() as ApiResponse<Conversation>;
      if (!json.success) throw new Error(json.error);
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', effectiveTenantId] });
      setActiveConversationId(null);
      toast.success('Session closed');
    },
    onError: (err: Error) => toast.error(err.message),
  });
  return {
    messages,
    isLoading,
    sendMessage: sendMutation.mutate,
    isSending: sendMutation.isPending,
    claimConversation: claimMutation.mutate,
    endConversation: endMutation.mutate,
    isEnding: endMutation.isPending
  };
}