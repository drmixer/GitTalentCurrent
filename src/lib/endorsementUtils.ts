// src/lib/endorsementUtils.ts

import { supabase } from './supabase';
import { Endorsement } from '../types'; // Assuming '../types' resolves to types/index.ts due to module resolution

/**
 * Fetches endorsements for a specific developer.
 * @param developerId The ID of the developer.
 * @param isPublicOnly If true, only fetches endorsements marked as public. Defaults to false.
 * @returns An array of Endorsement objects, or null if an error occurs.
 */
// CORRECTED: Changed to default export
export default async function fetchEndorsementsForDeveloper(
  developerId: string,
  isPublicOnly: boolean = false
): Promise<Endorsement[] | null> {
  try {
    let query = supabase
      .from('endorsements')
      .select(`
        id, created_at, developer_id, endorser_id, endorser_email, endorser_role, comment, is_anonymous, is_public,
        endorser_user:endorser_id(  // Join with the 'users' table using endorser_id as foreign key
          name,
          developers(public_profile_slug) // Nested join to the 'developers' table for the public profile slug
        )
      `)
      .eq('developer_id', developerId)
      .order('created_at', { ascending: false });

    if (isPublicOnly) {
      query = query.eq('is_public', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching endorsements:', error);
      return null;
    }

    return data as Endorsement[];

  } catch (error) {
    console.error('Unexpected error in fetchEndorsementsForDeveloper:', error);
    return null;
  }
}

/**
 * Updates the visibility status (is_public) of a specific endorsement.
 * @param endorsementId The ID of the endorsement to update.
 * @param isPublic The new public status (true for public, false for hidden).
 * @returns A promise that resolves to true if successful, false otherwise.
 */
// This remains a named export as it's only used in DeveloperDashboard.tsx
export async function updateEndorsementVisibility(endorsementId: string, isPublic: boolean): Promise<boolean> {
  const { error } = await supabase
    .from('endorsements')
    .update({ is_public: isPublic })
    .eq('id', endorsementId);

  if (error) {
    console.error(`Error updating endorsement (ID: ${endorsementId}) visibility to ${isPublic}:`, error);
    return false;
  }
  return true;
}
