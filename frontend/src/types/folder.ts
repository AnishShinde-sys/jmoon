export interface Folder {
  id: string
  farmId: string
  name: string
  folderId: string // Parent folder ID ('root' for top-level)
  createdAt: string
  updatedAt: string
}

export interface CreateFolderInput {
  farmId: string
  name: string
  folderId: string // Parent folder ID
}

export interface UpdateFolderInput {
  name?: string
  folderId?: string // Move to different parent
}
