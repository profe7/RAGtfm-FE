import { useQuery } from '@tanstack/react-query'
import { checkBackendReady } from '../../api'

const HEALTH_RETRY_MS = 7000

export function useBackendHealth() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['backendHealth'],
    queryFn: checkBackendReady,
    refetchInterval: (query) => {
      if (!query.state.data?.ready) {
        return HEALTH_RETRY_MS
      }
      return false
    },
    retry: true,
    retryDelay: HEALTH_RETRY_MS,
  })

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
