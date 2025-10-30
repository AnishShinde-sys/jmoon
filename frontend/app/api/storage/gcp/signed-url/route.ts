import { NextResponse } from 'next/server'

import { generateSignedUrl, getGcpConfig } from '@/lib/server/gcpStorage'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { filePath, expiresInMinutes } = await request.json()

    const url = await generateSignedUrl(filePath, expiresInMinutes)
    const config = getGcpConfig()

    return NextResponse.json({ url, config })
  } catch (error: any) {
    return NextResponse.json(
      {
        message: error?.message ?? 'Failed to generate signed URL',
      },
      { status: 400 }
    )
  }
}


