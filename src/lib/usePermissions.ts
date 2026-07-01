'use client'

import { useEffect, useState, startTransition } from 'react'

export interface Permissions {
  canView: boolean
  canCreate: boolean
  canUpdate: boolean
  canDelete: boolean
}

const NO_ACCESS: Permissions = { canView: false, canCreate: false, canUpdate: false, canDelete: false }

// Client component'lerde izin okumak için. Server component'lerde
// bunun yerine lib/permissions.ts'teki getPermissions() kullanılır.
export function usePermissions(resource: string): Permissions & { loading: boolean } {
  const [permissions, setPermissions] = useState<Permissions>(NO_ACCESS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    startTransition(() => {
      setLoading(true)
    })
    fetch(`/api/permissions?resource=${encodeURIComponent(resource)}`)
      .then((res) => (res.ok ? res.json() : NO_ACCESS))
      .then((data: Permissions) => {
        if (!cancelled) setPermissions(data)
      })
      .catch(() => {
        if (!cancelled) setPermissions(NO_ACCESS)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [resource])

  return { ...permissions, loading }
}
