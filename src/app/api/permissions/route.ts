import { NextRequest, NextResponse } from 'next/server'
import { getPermissions, canSeeAyarlarNav, type Permissions } from '@/lib/permissions'

export async function GET(req: NextRequest): Promise<NextResponse<Permissions>> {
  const resource = req.nextUrl.searchParams.get('resource')
  const noAccess: Permissions = { canView: false, canCreate: false, canUpdate: false, canDelete: false }

  if (!resource) {
    return NextResponse.json(noAccess, { status: 400 })
  }

  // Özel sanal kaynak: Ayarlar alt kaynaklarının herhangi birinde
  // görüntüleme izni varsa true — Sidebar "Ayarlar" linkini bu şekilde kontrol eder.
  if (resource === 'ayarlar_any') {
    const canView = await canSeeAyarlarNav()
    return NextResponse.json({ canView, canCreate: false, canUpdate: false, canDelete: false })
  }

  const permissions = await getPermissions(resource)
  return NextResponse.json(permissions)
}
