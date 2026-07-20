import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  deleteConversation,
  getConversation,
  listConversations,
  renameConversation,
} from '../../api'

export function useConversations(token: string) {
  const queryClient = useQueryClient()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const queryKey = ['conversations', token]

  const query = useQuery({
    queryKey,
    queryFn: () => listConversations(token),
    enabled: Boolean(token),
  })

  const renameMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      renameConversation(token, id, title),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteConversation(token, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  })

  const load = async (id: string) => {
    setLoadingId(id)
    try {
      return await getConversation(token, id)
    } finally {
      setLoadingId(null)
    }
  }

  const refresh = () => queryClient.invalidateQueries({ queryKey })

  return {
    conversations: query.data?.conversations ?? [],
    isLoading: query.isLoading,
    loadingId,
    load,
    rename: renameMutation.mutateAsync,
    remove: deleteMutation.mutateAsync,
    isMutating: renameMutation.isPending || deleteMutation.isPending,
    refresh,
  }
}
