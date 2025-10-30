import { notFound } from 'next/navigation'

import { FarmPageClient } from '../_components/FarmPageClient'

interface FarmRoutePageProps {
  params: {
    params?: string[]
  }
}

export default function FarmRoutePage({ params }: FarmRoutePageProps) {
  const [farmId, layerType, layerId] = params.params ?? []

  if (!farmId) {
    return notFound()
  }

  return <FarmPageClient farmId={farmId} layerType={layerType} layerId={layerId} />
}

