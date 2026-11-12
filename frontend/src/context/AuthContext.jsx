import { useCallback, useEffect, useMemo, useState } from 'react'

import AuthContext from '@/context/auth'
import { getApiErrorStatus } from '@/lib/api'
import {
  clearStoredSession,
  readStoredToken,
  readStoredUser,
  storeSession,
} from '@/lib/session'
import { fetchCurrentUser, loginUser, signupUser } from '@/services/auth'

function AuthProvider({ children }) {
  const [user, setUser] = useState(() =>
    readStoredToken() ? readStoredUser() : null,
  )
  const [status, setStatus] = useState(() =>
    readStoredToken() ? 'restoring' : 'anonymous',
  )

  useEffect(() => {
    const token = readStoredToken()

    if (!token) {
      return undefined
    }

    let active = true

    fetchCurrentUser()
      .then((me) => {
        if (!active) return
        setUser(me)
        storeSession(token, me)
        setStatus('authenticated')
      })
      .catch((error) => {
        if (!active) return
        // A network failure does not prove the session is invalid; only a
        // 401 (the api interceptor clears storage and redirects then) does.
        if (getApiErrorStatus(error) === 401) {
          setUser(null)
          setStatus('anonymous')
          return
        }
        setStatus('authenticated')
      })

    return () => {
      active = false
    }
  }, [])

  const completeLogin = useCallback((payload) => {
    storeSession(payload.accessToken, payload.user)
    setUser(payload.user)
    setStatus('authenticated')
    return payload.user
  }, [])

  const login = useCallback(
    async (credentials) => completeLogin(await loginUser(credentials)),
    [completeLogin],
  )

  const signup = useCallback(
    async (details) => completeLogin(await signupUser(details)),
    [completeLogin],
  )

  const logout = useCallback(() => {
    clearStoredSession()
    setUser(null)
    setStatus('anonymous')
  }, [])

  const updateUser = useCallback((nextUser) => {
    setUser(nextUser)

    const token = readStoredToken()
    if (token) {
      storeSession(token, nextUser)
    }
  }, [])

  const value = useMemo(
    () => ({ user, status, login, signup, logout, updateUser }),
    [user, status, login, signup, logout, updateUser],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export default AuthProvider
