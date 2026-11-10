'use client'

import {
  useState,
  useCallback,
  useTransition,
  Fragment,
} from 'react'
import { toast } from 'sonner'
import { updateRolePermission, type RolePermissionRow } from './actions'
import { SettingsIconBox, IconInfo } from './SettingsSharedUI'
import type { R } from './types'
import { RESOURCE_GROUPS, IconShield } from './kullaniciShared'

// ---- Rol İzin Matrisi (role_permissions tablosundan gerçek veri) ----
export const ROLE_OPTIONS: { key: string; label: string }[] = [
  { key: 'bashekim', label: 'Başhekim' },
  { key: 'responsible_manager', label: 'Mesul Müdür' },
  { key: 'hekim', label: 'Hekim' },
  { key: 'asistan', label: 'Asistan' },
]
export type PermRow = { can_view: boolean; can_create: boolean; can_update: boolean; can_delete: boolean }
export const EMPTY_PERM: PermRow = { can_view: false, can_create: false, can_update: false, can_delete: false }
export function RolePermissionMatrix({ rolePermissions, isAdmin }: { rolePermissions: RolePermissionRow[]; isAdmin: boolean }) {
  const [selectedRole, setSelectedRole] = useState('bashekim')
  const [pending, startTransition] = useTransition()
  const [overrides, setOverrides] = useState<Record<string, PermRow>>({})

  // Rol değişince override'ları sıfırla — render sırasında (effect'te değil),
  // React'in "resetting state when a prop changes" desenine uygun.
  const [lastRole, setLastRole] = useState(selectedRole)
  if (selectedRole !== lastRole) {
    setLastRole(selectedRole)
    setOverrides({})
  }

  const getRow = useCallback((resource: string): PermRow => {
    if (overrides[resource]) return overrides[resource]
    const found = rolePermissions.find((p) => p.role_name === selectedRole && p.resource === resource)
    return found
      ? { can_view: found.can_view, can_create: found.can_create, can_update: found.can_update, can_delete: found.can_delete }
      : EMPTY_PERM
  }, [overrides, rolePermissions, selectedRole])

  const persist = (resource: string, current: PermRow, next: PermRow) => {
    setOverrides((prev) => ({ ...prev, [resource]: next }))
    startTransition(async () => {
      const res = await updateRolePermission({
        roleName: selectedRole,
        resource,
        canView: next.can_view,
        canCreate: next.can_create,
        canUpdate: next.can_update,
        canDelete: next.can_delete,
      })
      if ((res as R)?.error) {
        toast.error((res as R)!.error!)
        setOverrides((prev) => ({ ...prev, [resource]: current }))
      } else {
        toast.success('İzin güncellendi')
      }
    })
  }

  const handleToggle = (resource: string, field: keyof PermRow, value: boolean) => {
    if (!isAdmin) return
    const current = getRow(resource)
    persist(resource, current, { ...current, [field]: value })
  }

  const handleToggleAll = (resource: string, value: boolean) => {
    if (!isAdmin) return
    const current = getRow(resource)
    persist(resource, current, { can_view: value, can_create: value, can_update: value, can_delete: value })
  }

  return (
    <section className="overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div className="border-b border-[#EEF2F6] px-6 py-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <SettingsIconBox><IconShield /></SettingsIconBox>
            <div>
              <h2 className="text-base font-black text-[#142536]">Rol İzin Matrisi</h2>
              <p className="mt-1 text-sm font-medium text-slate-400">Modüllere göre rollerin görüntüleme/yazma yetkileri</p>
            </div>
          </div>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="h-10 rounded-full border border-[#E7ECF2] bg-white px-4 text-xs font-bold text-[#142536] outline-none transition focus:border-[#5FD3C1] focus:ring-4 focus:ring-[#5FD3C1]/15"
          >
            {ROLE_OPTIONS.map((r) => (
              <option key={r.key} value={r.key}>{r.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-start gap-2 rounded-[14px] border border-[#E7ECF2] bg-[#F8FAFC] px-4 py-3 text-xs font-semibold text-slate-500">
          <IconInfo />
          <span>{isAdmin ? 'Değişiklikler anında kaydedilir.' : 'Sadece başhekim düzenleyebilir — görüntüleme modundasınız.'}</span>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-[#FAFBFC]">
            <tr className="h-12 border-b border-[#EEF2F6] text-slate-400">
              <th className="px-5 text-left text-xs font-black uppercase tracking-wide">Modül</th>
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
                  const row = getRow(item.key)
                  const allChecked = row.can_view && row.can_create && row.can_update && row.can_delete
                  const disabled = !isAdmin || pending
                  return (
                    <tr key={item.key} className="h-14 border-b border-[#EEF2F6] transition last:border-0 hover:bg-[#5FD3C1]/[0.04]">
                      <td className="px-5 py-2 font-bold text-[#142536]">{item.label}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.can_view} disabled={disabled} onChange={(e) => handleToggle(item.key, 'can_view', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.can_create} disabled={disabled} onChange={(e) => handleToggle(item.key, 'can_create', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.can_update} disabled={disabled} onChange={(e) => handleToggle(item.key, 'can_update', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={row.can_delete} disabled={disabled} onChange={(e) => handleToggle(item.key, 'can_delete', e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="checkbox" checked={allChecked} disabled={disabled} onChange={(e) => handleToggleAll(item.key, e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#1EAEA0] focus:ring-[#5FD3C1] disabled:opacity-40" />
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
