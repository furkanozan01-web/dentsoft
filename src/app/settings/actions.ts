// Ayarlar server action'ları — domain dosyalarına bölündü, buradan
// yeniden dışa aktarılır. Tüketici dosyalar (KlinikTab, DisHekimiTab,
// KullaniciTab, TarifeTab, RandevuTab, UserModal, SettingsClient,
// settings/page.tsx) './actions' import yolunu değiştirmeden kullanmaya
// devam eder.
//
// NOT: Bu dosyada 'use server' YOK — her domain dosyası (clinicActions.ts
// vb.) kendi 'use server' direktifine sahip; Next.js bir 'use server'
// dosyasından yeniden export (export * veya export {...} from) yapılmasına
// izin vermiyor ("Only async functions are allowed to be exported"), bu
// yüzden bu barrel dosyası işaretsiz düz bir re-export modülü olarak kalır.

export {
  updateClinic,
  updateRandevuSettings,
  saveNightShiftSettings,
  saveAppointmentType,
  uploadClinicLogo,
} from './clinicActions'

export {
  addDoctor,
  updateDoctor,
  deleteDoctor,
  toggleMesulMudur,
  addDoctorShare,
  updateDoctorShare,
  deleteDoctorShare,
} from './doctorActions'

export {
  addUserToAllowlist,
  syncDoctorsToUsers,
  updateUserRole,
  setUserActive,
  getRolePermissions,
  updateRolePermission,
  getRoleTemplate,
  getEffectivePermissions,
  getUserPermissionsPanel,
  updateUserPermission,
  resetUserPermissions,
} from './userActions'
export type { RolePermissionRow, UserPermissionRow, PermissionFields } from './userActions'

export {
  addBranch,
  updateBranch,
  setActiveBranch,
} from './branchActions'

export {
  deleteTariffItem,
  importTdb2024,
  syncTdbProfile,
  importTufanbeyli,
  copyTariffProfile,
  deleteTariffProfile,
  renameTariffProfile,
  setDefaultProfile,
  toggleTariffItemActive,
  updateTariffItemPrice,
  bulkUpdateTariffPrices,
  updateTariffItemDuration,
  updateTariffItemDetails,
  addTariffItemToProfile,
} from './tariffActions'
export type { TariffProfile } from './tariffActions'
