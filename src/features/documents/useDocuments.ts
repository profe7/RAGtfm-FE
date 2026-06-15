import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  listDocuments,
  uploadPdf,
  deleteDocument,
  openDocumentEventSource,
} from '../../api'
import type { DocumentItem } from '../../api'

export function useDocuments(token: string, backendReady: boolean, page: number, pageSize: number) {
  const queryClient = useQueryClient()

  // 1. Fetch documents
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['documents', page, pageSize],
    queryFn: () => listDocuments(token, page, pageSize),
    enabled: !!token && backendReady,
  })

  // 2. Handle SSE updates
  useEffect(() => {
    if (!token || !backendReady) return

    const es = openDocumentEventSource(token)
    
    es.addEventListener('document_status', (e) => {
      const eventData = JSON.parse((e as MessageEvent).data) as {
        document_id: string
        status: string
        chunk_count: number
        stored_chunk_count: number
      }

      // Update the cache directly
      queryClient.setQueryData(['documents', page, pageSize], (oldData: any) => {
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
      })
    })

    es.onerror = () => es.close()

    return () => {
      es.close()
    }
  }, [token, backendReady, queryClient, page, pageSize])

  // 3. Mutations
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
