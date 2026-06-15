import { useQuery } from '@tanstack/react-query'
import { checkBackendReady } from '../../api'

const HEALTH_RETRY_MS = 7000

export function useBackendHealth() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['backendHealth'],
    queryFn: checkBackendReady,
    refetchInterval: (query) => {
      // If the backend is not ready, keep polling
      if (!query.state.data?.ready) {
        return HEALTH_RETRY_MS
      }
      // Optional: poll less frequently when ready, or disable
      return false
    },
    // We want to poll immediately if it fails
    retry: true,
    retryDelay: HEALTH_RETRY_MS,
  })

  // Provide initial fallback state while loading
  const health = data ?? {
    ready: false,
    status: 'checking',
    checks: {},
  }

  return {
    health,
    checked: !isLoading,
    isError,
  }
}
