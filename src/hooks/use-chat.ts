import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store';
import { Message, ApiResponse, Conversation } from '@shared/types';
import { toast } from 'sonner';
export function useChat(conversationId: string | null) {
  const queryClient = useQueryClient();
  const token = useAuthStore(s => s.token);
  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId) return [];
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json() as ApiResponse<Message[]>;
      return json.data || [];
    },
    enabled: !!conversationId,
    refetchInterval: 3000,
  });
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!conversationId) throw new Error('No active conversation');
      const res = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ content }),
      });
      const json = await res.json() as ApiResponse<Message>;
      if (!json.success) throw new Error(json.error);
      return json.data!;
    },
    onSuccess: (newMessage) => {
      queryClient.setQueryData(['messages', conversationId], (old: Message[] = []) => [...old, newMessage]);
    },
    onError: (err) => toast.error(err.message),
  });
  const claimMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}/claim`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json() as ApiResponse<Conversation>;
      if (!json.success) throw new Error(json.error);
      return json.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Conversation claimed');
    },
    onError: (err) => toast.error(err.message),
  });
  return {
    messages,
    isLoading,
    sendMessage: sendMutation.mutate,
    isSending: sendMutation.isPending,
    claimConversation: claimMutation.mutate,
  };
}