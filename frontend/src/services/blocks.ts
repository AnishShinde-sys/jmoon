import apiClient from '@/lib/apiClient'
import { BlockRevision } from '@/types/block'

export async function fetchBlockRevisions(farmId: string, blockId: string): Promise<BlockRevision[]> {
  const response = await apiClient.get<BlockRevision[]>(`/api/farms/${farmId}/blocks/${blockId}/revisions`)
  return response.data || []
}

export async function revertBlockRevision(
  farmId: string,
  blockId: string,
  revisionId: string,
  revisionMessage?: string
): Promise<BlockRevision> {
  const response = await apiClient.post<BlockRevision>(
    `/api/farms/${farmId}/blocks/${blockId}/revisions/${revisionId}/revert`,
    revisionMessage ? { revisionMessage } : undefined
  )
  return response.data
}

