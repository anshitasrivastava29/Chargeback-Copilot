import { useCallback, useEffect, useRef, useState } from 'react'

import {
  getApiErrorMessage,
  getApiErrorStatus,
  isCanceledError,
} from '@/lib/api'

const INITIAL_STATE = {
  data: null,
  error: null,
  statusCode: null,
  status: 'loading',
  updatedAt: null,
  key: null,
}

export function useApiQuery(queryKey, fetcher) {
  const fetcherRef = useRef(fetcher)

  useEffect(() => {
    fetcherRef.current = fetcher
  })

  const [state, setState] = useState(INITIAL_STATE)
  const [reloadKey, setReloadKey] = useState(0)

  const requestKey = `${queryKey}:${reloadKey}`

  useEffect(() => {
    const controller = new AbortController()
    let active = true

    fetcherRef
      .current(controller.signal)
      .then((data) => {
        if (!active) {
          return
        }
        setState({
          data,
          error: null,
          statusCode: null,
          status: 'success',
          updatedAt: Date.now(),
          key: requestKey,
        })
      })
      .catch((error) => {
        if (!active || isCanceledError(error)) {
          return
        }
        setState((previous) => ({
          ...previous,
          error: getApiErrorMessage(error),
          statusCode: getApiErrorStatus(error),
          status: 'error',
          key: requestKey,
        }))
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [queryKey, reloadKey, requestKey])

  const reload = useCallback(() => {
    setReloadKey((value) => value + 1)
  }, [])

  const isPending = state.key !== requestKey
  const status = isPending
    ? state.data === null
      ? 'loading'
      : 'refreshing'
    : state.status

  return {
    ...state,
    error: isPending ? null : state.error,
    statusCode: isPending ? null : state.statusCode,
    status,
    isLoading: status === 'loading',
    isRefreshing: status === 'refreshing',
    isError: status === 'error',
    reload,
  }
}
