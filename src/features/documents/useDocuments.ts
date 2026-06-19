import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDocuments,
  uploadPdf,
  deleteDocument,
  openDocumentEventSource,
} from '../../api'
import type { DocumentItem, DocumentListResponse } from '../../api'

export function useDocuments(token: string, backendReady: boolean, page: number, pageSize: number) {
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['documents', page, pageSize],
    queryFn: () => listDocuments(token, page, pageSize),
    enabled: !!token && backendReady,
  })

  useEffect(() => {
    if (!token || !backendReady) return

    let es: EventSource | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let attempt = 0
    let cancelled = false

    const handleStatus = (event: Event) => {
      const eventData = JSON.parse((event as MessageEvent).data) as {
        document_id: string
        status: string
        chunk_count: number
        stored_chunk_count: number
      }

      queryClient.setQueryData(
        ['documents', page, pageSize],
        (oldData: DocumentListResponse | undefined) => {
          if (!oldData) return oldData
          return {
            ...oldData,
            documents: oldData.documents.map((doc: DocumentItem) =>
              doc.document_id === eventData.document_id
                ? {
                    ...doc,
                    status: eventData.status,
                    chunk_count: eventData.chunk_count,
                    stored_chunk_count: eventData.stored_chunk_count,
                  }
                : doc
            ),
          }
        },
      )
    }

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer) return
      // Each ticket is single-use, so native auto-reconnect can't work — mint a
      // fresh one. Exponential backoff capped at 30s avoids hammering a down API.
      const delay = Math.min(1000 * 2 ** attempt, 30000)
      attempt += 1
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        void connect()
      }, delay)
    }

    const connect = async () => {
      if (cancelled) return

      let source: EventSource
      try {
        source = await openDocumentEventSource(token)
      } catch {
        scheduleReconnect()
        return
      }

      // The effect may have been cleaned up while the ticket request was in flight.
      if (cancelled) {
        source.close()
        return
      }

      es = source
      es.addEventListener('document_status', handleStatus)
      es.onopen = () => {
        attempt = 0 // Connection is healthy again; reset backoff.
      }
      es.onerror = () => {
        es?.close()
        es = null
        scheduleReconnect()
      }
    }

    void connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      es?.close()
    }
  }, [token, backendReady, queryClient, page, pageSize])

  const uploadMutation = useMutation({
    mutationFn: (file: File) => uploadPdf(token, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (documentId: string) => deleteDocument(token, documentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] })
    },
  })

  return {
    documents: data?.documents ?? [],
    totalDocs: data?.total ?? 0,
    totalPages: data?.pages ?? 1,
    isLoading,
    isError,
    error,
    refetch,
    uploadDocument: uploadMutation.mutateAsync,
    isUploading: uploadMutation.isPending,
    deleteDocument: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deletingId: deleteMutation.variables,
  }
}
