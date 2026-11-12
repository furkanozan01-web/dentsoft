// Hasta modülü server action'ları — domain dosyalarına bölündü, buradan
// yeniden dışa aktarılır; tüketici dosyalar './actions' import yolunu değiştirmeden
// kullanır. NOT: Bu dosyada 'use server' YOK (bkz. settings/actions.ts) —
// Next.js bir 'use server' dosyasından yeniden export'a izin vermiyor.

export {
  createPatient,
  updatePatient,
  deletePatient,
  getAnamnesis,
  getPatientTc,
  getDoctorTc,
  updateAnamnesis,
  setUntrusted,
} from './patientActions'

export {
  addTreatment,
  closeTreatmentAccount,
  applyTreatmentAdjustment,
  cancelTreatment,
  updateTreatmentFee,
  getPatientTreatmentHistory,
} from './treatmentActions'

export {
  sendInvoiceToInstitution,
  getNextInvoiceNo,
  addInstallment,
  autoInstallment,
  markInstallmentPaid,
  deleteInstallment,
  deletePayment,
  addPaymentWithCurrency,
  createPromissoryPlan,
} from './paymentActions'

export {
  addPrescription,
  deletePrescription,
  addNote,
  updateNote,
  setNoteImportance,
  dismissImportantNotes,
  deleteNote,
  addImageMeta,
  deleteImage,
  addReminder,
  markReminderDone,
  deleteReminder,
} from './noteActions'

export {
  createPatientFromPeri,
  updatePatientFromPeri,
  updateAnamnesisFromPeri,
  addNoteFromPeri,
} from './periActions'
