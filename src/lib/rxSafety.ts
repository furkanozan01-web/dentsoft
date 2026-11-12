// Reçete güvenlik kontrolü — saf eşleme mantığı (istemci + sunucu).
// Hasta anamnezinden `prescription_rules.condition_key` bayrakları ve reçete metninden
// `rule_group` (ilaç sınıfı) çıkarılır; kuralların kendisi veritabanındadır (check_prescription_safety).
import type { Anamnesis } from './anamnesis'

const norm = (s: string) => s.toLocaleLowerCase('tr-TR')

const test = (text: string, re: RegExp) => re.test(norm(text))

/** Anamnezden (hastalıklar + ilaçlar + alerji ayrıntısı + notlar) kural bayrakları */
export function patientFlags(a: Anamnesis): string[] {
  const flags = new Set<string>()
  const has = (k: string) => a.diseases.includes(k)
  const meds = a.medications.join(' ; ')
  const free = [a.allergyDetail ?? '', a.notes ?? '', meds].join(' ; ')

  if (has('Diyabet')) flags.add('diyabet')
  if (has('Astım')) flags.add('astim_nsaii')
  if (has('Hamilelik')) { flags.add('gebelik'); flags.add('emzirme') }
  if (has('Böbrek Yetmezliği')) { flags.add('bobrek_yetmezligi'); flags.add('karaciger_yetmezligi') }
  if (has('Kalp Hastalığı')) { flags.add('kalp_yetmezligi_nyha2_4'); flags.add('iskemik_kalp_hastaligi') }
  if (has('Kanama Bozukluğu')) flags.add('ilac_antikoagulan')

  if (test(meds, /coumadin|varfarin|warfarin|kumadin|pradaxa|dabigatran|xarelto|rivaroksaban|eliquis|apiksaban|kan sulandır/)) flags.add('ilac_antikoagulan')
  if (test(meds, /aspirin|coraspin|disprin|klopidogrel|plavix|ticagrelor|brilinta|prasugrel/)) flags.add('ilac_antiplatelet')
  if (test(meds, /metotreksat|methotrexate|trexall/)) flags.add('ilac_metotreksat')
  if (test(meds, /sertralin|lustral|fluoksetin|prozac|essitalopram|cipralex|sitalopram|cipram|paroksetin|seroxat|venlafaksin|effexor|duloksetin|cymbalta/)) flags.add('ilac_ssri_snri')
  if (test(meds, /amiodaron|sotalol|haloperidol|ondansetron|moksifloksasin/)) flags.add('ilac_qt_uzatan')

  if (has('Alerji')) {
    const al = a.allergyDetail ?? ''
    if (test(al, /nsaii|nsaid|aspirin|diklofenak|ibuprofen|naproksen|ağrı kesici|agri kesici/)) flags.add('alerji_nsaii')
    if (test(al, /penisilin|amoksisilin|augmentin|ampisilin/)) flags.add('alerji_penisilin')
    if (test(al, /sefalosporin|sefuroksim|sefaleksin|sefazolin/)) flags.add('alerji_sefalosporin')
    if (test(al, /makrolid|azitromisin|klaritromisin|eritromisin/)) flags.add('alerji_makrolid')
    if (test(al, /klindamisin|linkozamid/)) flags.add('alerji_klindamisin')
    if (test(al, /parasetamol|parol/)) flags.add('alerji_parasetamol')
    if (test(al, /kortikosteroid|kortizon|prednol|prednizolon|deksametazon/)) flags.add('alerji_kortikosteroid')
    if (test(al, /klorheksidin/)) flags.add('alerji_klorheksidin')
    if (test(al, /asiklovir|aklovir/)) flags.add('alerji_asiklovir')
  }

  if (test(free, /ülser|ulser|gastrit|mide kanama/)) flags.add('peptik_ulser')
  if (test(free, /alkol/)) flags.add('madde_alkol')
  if (test(free, /karaciğer yetmez|karaciger yetmez|siroz/)) flags.add('karaciger_yetmezligi')
  return [...flags]
}

const GROUPS: { group: string; label: string; re: RegExp }[] = [
  { group: 'nsaii_im_dikloron', label: 'Dikloron (IM)', re: /dikloron/ },
  { group: 'nsaii_oral', label: 'NSAİİ', re: /apranax|aprol|arveles|naproksen|deksketoprofen|tilcotil|tenoksikam|ibuprofen|brufen|nurofen|majezik|flurbiprofen|nimesulid|dolorex|voltaren|cataflam|diklofenak/ },
  { group: 'kortikosteroid_mp', label: 'Kortikosteroid', re: /prednol|metilprednizolon|deksametazon|dekort|kortizon/ },
  { group: 'penisilin', label: 'Penisilin grubu antibiyotik', re: /augmentin|amoklavin|amoksisilin|klavulan|amoxil|largopen|penisilin/ },
  { group: 'sefalosporin', label: 'Sefalosporin', re: /aksef|sefuroksim|sefaleksin|sefdinir|sefiksim|sefazolin|zinnat/ },
  { group: 'makrolid', label: 'Makrolid', re: /azitro|azitromisin|klaritromisin|klacid|eritromisin|zithromax/ },
  { group: 'metronidazol', label: 'Metronidazol', re: /flagyl|metronidazol|metrogyl/ },
  { group: 'klindamisin', label: 'Klindamisin', re: /klindan|klindamisin|dalacin/ },
  { group: 'parasetamol', label: 'Parasetamol', re: /parol|parasetamol|calpol|tylol|minoset|vermidon/ },
  { group: 'tiyokolsikosid', label: 'Tiyokolşikosid (kas gevşetici)', re: /muscoril|tiyokolsikosid|tiyokolşikosid/ },
  { group: 'aftojel_topikal', label: 'Aftojel', re: /aftojel/ },
  { group: 'asiklovir_topikal', label: 'Asiklovir', re: /aklovir|asiklovir|zovirax/ },
  { group: 'klorheksidin_benzidamin_topikal', label: 'Klorheksidin / benzidamin', re: /kloroben|klorheksidin|benzidamin|andolex/ },
]

/** Reçete metninde geçen ilaç sınıfları */
export function drugGroups(content: string): { group: string; label: string }[] {
  const text = norm(content)
  return GROUPS.filter((g) => g.re.test(text)).map(({ group, label }) => ({ group, label }))
}

export interface RxWarning {
  label: string
  severity: string
  message: string
  ref: string | null
}
