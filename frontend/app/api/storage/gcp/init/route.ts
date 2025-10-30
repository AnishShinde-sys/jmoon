import { NextResponse } from 'next/server'

import { verifyBucketAccess, getGcpConfig } from '@/lib/server/gcpStorage'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const access = await verifyBucketAccess()
    const config = getGcpConfig()

    return NextResponse.json({
      success: true,
      access,
      config,
    })
  } catch (error: any) {
    return NextResponse.json(
      {
        success: false,
        message: error?.message ?? 'Failed to initialize GCP Storage',
      },
      { status: 500 }
    )
  }
}


