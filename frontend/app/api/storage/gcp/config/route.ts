import { NextResponse } from 'next/server'

import { getGcpConfig } from '@/lib/server/gcpStorage'

export const dynamic = 'force-dynamic'

export async function GET() {
  const config = getGcpConfig()
  return NextResponse.json({ config })
}


