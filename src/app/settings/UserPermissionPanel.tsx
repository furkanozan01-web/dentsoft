'use client'

import {
  useState,
  useEffect,
  useRef,
  startTransition,
  Fragment,
} from 'react'
import { toast } from 'sonner'
import {
  getUserPermissionsPanel,
  updateUserPermission,
  resetUserPermissions,
  type RolePermissionRow,
  type UserPermissionRow,
} from './actions'
import { ROLE_LABEL } from './constants'
import type { Profile, R } from './types'
import { RESOURCE_GROUPS } from './kullaniciShared'

// ---- Kullanıcı Bazlı İzin Paneli (rol şablonu + kişisel override) ----
export type PermField = 'can_view' | 'can_create' | 'can_update' | 'can_delete'
export type RowStatus = 'idle' | 'pending' | 'success' | 'error'
export const EMPTY_OVERRIDE: Omit<UserPermissionRow, 'resource'> = { can_view: null, can_create: null, can_update: null, can_delete: null }
export function UserPermissionPanel({ user, isAdmin, onClose }: { user: Profile; isAdmin: boolean; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [role, setRole] = useState<string>(user.role)
  const [template, setTemplate] = useState<Record<string, RolePermissionRow>>({})
  const [overrides, setOverrides] = useState<Record<string, UserPermissionRow>>({})
  const [rowStatus, setRowStatus] = useState<Record<string, RowStatus>>({})
  const [resetting, setResetting] = useState(false)
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  useEffect(() => {
    let cancelled = false
    startTransition(() => {
      setLoading(true)
    })
    getUserPermissionsPanel(user.id).then((res) => {
      if (cancelled) return
      if (res.error || !res.data) {
        toast.error(res.error ?? 'İzinler yüklenemedi')
        setLoading(false)
        return
      }
      setRole(res.data.role)
      setTemplate(Object.fromEntries(res.data.template.map((row) => [row.resource, row])))
      setOverrides(Object.fromEntries(res.data.overrides.map((row) => [row.resource, row])))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [user.id])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  const effective = (resource: string, field: PermField): boolean => {
    const ov = overrides[resource]?.[field]
    if (ov !== undefined && ov !== null) return ov
    return template[resource]?.[field] === true
  }

  const isOverridden = (resource: string, field: PermField): boolean => {
    const ov = overrides[resource]?.[field]
    return ov !== undefined && ov !== null && ov !== (template[resource]?.[field] === true)
  }

  const setStatus = (resource: string, status: RowStatus) => {
    setRowStatus((s) => ({ ...s, [resource]: status }))
    if (status === 'success') {
      setTimeout(() => setRowStatus((s) => (s[resource] === 'success' ? { ...s, [resource]: 'idle' } : s)), 1500)
    }
  }

  const persist = (resource: string, patch: Partial<Record<'canView' | 'canCreate' | 'canUpdate' | 'canDelete', boolean>>, prevOverride: UserPermissionRow | undefined) => {
    setStatus(resource, 'pending')
    clearTimeout(timersRef.current[resource])
    timersRef.current[resource] = setTimeout(() => {
      updateUserPermission({ userId: user.id, resource, ...patch }).then((res) => {
        if ((res as R)?.error) {
          toast.error((res as R)!.error!)
          setOverrides((o) => ({ ...o, [resource]: prevOverride ?? { resource, ...EMPTY_OVERRIDE } }))
          setStatus(resource, 'error')
        } else {
          setStatus(resource, 'success')
        }
      })
    }, 500)
  }

  const handleToggle = (resource: string, field: PermField, value: boolean) => {
    if (!isAdmin) return
    const prevOverride = overrides[resource]
    const nextOverride: UserPermissionRow = {
      resource,
      can_view: prevOverride?.can_view ?? null,
      can_create: prevOverride?.can_create ?? null,
      can_update: prevOverride?.can_update ?? null,
      can_delete: prevOverride?.can_delete ?? null,
      [field]: value,
    }
    setOverrides((o) => ({ ...o, [resource]: nextOverride }))
    const fieldKey = { can_view: 'canView', can_create: 'canCreate', can_update: 'canUpdate', can_delete: 'canDelete' }[field] as 'canView' | 'canCreate' | 'canUpdate' | 'canDelete'
    persist(resource, { [fieldKey]: value }, prevOverride)
  }

  const handleToggleAll = (resource: string, value: boolean) => {
    if (!isAdmin) return
    const prevOverride = overrides[resource]
    const nextOverride: UserPermissionRow = { resource, can_view: value, can_create: value, can_update: value, can_delete: value }
    setOverrides((o) => ({ ...o, [resource]: nextOverride }))
    persist(resource, { canView: value, canCreate: value, canUpdate: value, canDelete: value }, prevOverride)
  }

  const handleReset = async () => {
    setResetting(true)
    const res = await resetUserPermissions(user.id)
    setResetting(false)
    if ((res as R)?.error) {
      toast.error((res as R)!.error!)
      return
    }
    setOverrides({})
    toast.success('Kullanıcı rol şablonuna döndürüldü')
  }

  const roleLabel = ROLE_LABEL[role] ?? role

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-[#142536]"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            Geri
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <h2 className="text-base font-black text-[#0F2B3D]">
              {user.full_name ?? user.email ?? 'Kullanıcı'} — {roleLabel}
            </h2>
            <p className="mt-0.5 text-xs text-gray-400">
              {isAdmin ? 'Rol şablonundan farklı hücreler sarı ile işaretlenir.' : 'Sadece görüntüleme modundasınız.'}
            </p>
          </div>
        </div>
        {isAdmin && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="inline-flex h-9 items-center justify-center rounded-xl border border-gray-200 px-3 text-xs font-bold text-slate-500 transition hover:bg-gray-50 disabled:opacity-50"
          >
            {resetting ? 'Sıfırlanıyor…' : 'Rol Şablonunu Sıfırla'}
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div className="max-h-[75vh] overflow-y-auto">
          {loading ? (
            <div className="flex h-40 items-center justify-center text-sm font-semibold text-slate-400">Yükleniyor…</div>
          ) : (
            <table className="w-full min-w-[640px] text-sm">
              <thead className="sticky top-0 bg-[#FAFBFC]">
                <tr className="h-12 border-b border-[#EEF2F6] text-slate-400">
                  <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Kaynak</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Göster</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Yeni</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Değiştir</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Sil</th>
                  <th className="px-3 text-center text-xs font-black uppercase tracking-wide">Tümü</th>
                </tr>
              </thead>
              <tbody>
                {RESOURCE_GROUPS.map((group) => (
                  <Fragment key={group.title}>
                    <tr className="bg-[#FAFBFC]">
                      <td colSpan={6} className="px-5 pt-4 pb-1 text-[11px] font-black uppercase tracking-wide text-slate-400">{group.title}</td>
                    </tr>
                    {group.items.map((item) => {
                      const fields: PermField[] = ['can_view', 'can_create', 'can_update', 'can_delete']
                      const values = fields.map((f) => effective(item.key, f))
                      const allState: 'all' | 'none' | 'mixed' = values.every(Boolean) ? 'all' : values.every((v) => !v) ? 'none' : 'mixed'
                      const status = rowStatus[item.key] ?? 'idle'
                      const disabled = !isAdmin
                      return (
                        <tr key={item.key} className="h-14 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                          <td className="px-5 py-2 font-bold text-[#142536]">
                            <span className="inline-flex items-center gap-2">
                              {item.label}
                              {status === 'pending' && <span className="h-2 w-2 animate-pulse rounded-full bg-slate-300" />}
                              {status === 'success' && <IconCheckTiny />}
                              {status === 'error' && <IconAlertTiny />}
                            </span>
                          </td>
                          {fields.map((field) => (
                            <td key={field} className={`px-3 py-2 text-center ${isOverridden(item.key, field) ? 'bg-amber-50' : ''}`}>
                              <input
                                type="checkbox"
                                checked={effective(item.key, field)}
                                disabled={disabled}
                                onChange={(e) => handleToggle(item.key, field, e.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40"
                              />
                            </td>
                          ))}
                          <td className="px-3 py-2 text-center">
                            <TriStateCheckbox state={allState} disabled={disabled} onChange={(v) => handleToggleAll(item.key, v)} />
                          </td>
                        </tr>
                      )
                    })}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
export function TriStateCheckbox({ state, disabled, onChange }: { state: 'all' | 'none' | 'mixed'; disabled: boolean; onChange: (v: boolean) => void }) {
  return (
    <input
      type="checkbox"
      ref={(el) => { if (el) el.indeterminate = state === 'mixed' }}
      checked={state === 'all'}
      disabled={disabled}
      onChange={(e) => onChange(e.target.checked)}
      className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40"
    />
  )
}
export function IconCheckTiny() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-green-600"><path d="m20 6-11 11-5-5" /></svg>
}
export function IconAlertTiny() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-red-600"><path d="M12 9v4" /><path d="M12 17h.01" /><circle cx="12" cy="12" r="10" /></svg>
}
