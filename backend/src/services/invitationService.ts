import { gcsClient } from './gcsClient'

interface PendingInvitation {
  email: string
  farmId: string
  role: string
  inviterId: string
  inviterEmail: string
  createdAt: string
}

/**
 * Store a pending invitation for a user who hasn't signed up yet
 */
export async function storePendingInvitation(
  email: string,
  farmId: string,
  role: string,
  inviterId: string,
  inviterEmail: string
): Promise<void> {
  const invitationPath = `invitations/${email}/${farmId}.json`
  
  const invitation: PendingInvitation = {
    email,
    farmId,
    role,
    inviterId,
    inviterEmail,
    createdAt: new Date().toISOString(),
  }

  await gcsClient.writeJSON(invitationPath, invitation)
}

/**
 * Get pending invitations for a user email
 */
export async function getPendingInvitations(email: string): Promise<PendingInvitation[]> {
  const invitationDir = `invitations/${email}/`
  
  // Get all files in this directory
  const files = await gcsClient.listFiles(invitationDir)
  console.log(`Looking for invitations in ${invitationDir}, found ${files.length} files`)
  
  if (files.length === 0) {
    return []
  }

  const invitations: PendingInvitation[] = []
  for (const file of files) {
    try {
      console.log(`Reading invitation from ${file}`)
      const invitation = await gcsClient.readJSON<PendingInvitation>(file)
      invitations.push(invitation)
    } catch (error) {
      console.error(`Error reading invitation file ${file}:`, error)
    }
  }

  return invitations
}

/**
 * Process pending invitations for a user after they sign up
 * This will add them to the farms they were invited to
 */
export async function processPendingInvitations(userId: string, email: string): Promise<void> {
  console.log(`Processing pending invitations for user ${userId} (${email})`)
  const invitations = await getPendingInvitations(email)
  console.log(`Found ${invitations.length} pending invitations`)
  
  for (const invitation of invitations) {
    try {
      console.log(`Processing invitation: ${JSON.stringify(invitation)}`)
      
      // Get the farm
      const farmPath = `farms/${invitation.farmId}/metadata.json`
      const farm = await gcsClient.readJSON<any>(farmPath)
      
      // Add user to farm
      const updatedUsers = [...(farm.users || []), { id: userId }]
      const updatedPermissions = {
        ...(farm.permissions || {}),
        [userId]: invitation.role
      }

      farm.users = updatedUsers
      farm.permissions = updatedPermissions
      farm.updatedAt = new Date().toISOString()

      await gcsClient.writeJSON(farmPath, farm)
      console.log(`Successfully added user ${userId} to farm ${invitation.farmId}`)
      
      // Clean up the invitation file
      const invitationPath = `invitations/${invitation.email}/${invitation.farmId}.json`
      await gcsClient.delete(invitationPath)
    } catch (error) {
      console.error(`Error processing invitation for farm ${invitation.farmId}:`, error)
    }
  }
}

/**
 * Delete invitation file
 */
export async function deleteInvitation(email: string, farmId: string): Promise<void> {
  const invitationPath = `invitations/${email}/${farmId}.json`
  await gcsClient.delete(invitationPath)
}

/**
 * Get pending invitations for a user ID (lookup by email)
 */
export async function getPendingInvitationsByUserId(userId: string): Promise<Array<PendingInvitation & { farmName?: string }>> {
  try {
    // Get user email from profile
    const profilePath = `users/${userId}/profile.json`
    const exists = await gcsClient.exists(profilePath)
    
    if (!exists) {
      return []
    }
    
    const profile = await gcsClient.readJSON<{ email?: string }>(profilePath)
    if (!profile.email) {
      return []
    }
    
    const invitations = await getPendingInvitations(profile.email)
    
    // Enrich with farm names
    const enrichedInvitations = await Promise.all(
      invitations.map(async (inv) => {
        try {
          const farmPath = `farms/${inv.farmId}/metadata.json`
          const farm = await gcsClient.readJSON<{ name?: string }>(farmPath)
          return { ...inv, farmName: farm.name }
        } catch (error) {
          console.error(`Error fetching farm name for ${inv.farmId}:`, error)
          return { ...inv, farmName: 'Unknown Farm' }
        }
      })
    )
    
    return enrichedInvitations
  } catch (error) {
    console.error('Error getting pending invitations by user ID:', error)
    return []
  }
}

