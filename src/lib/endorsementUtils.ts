// src/lib/endorsementUtils.ts

import { supabase } from './supabase';
import { Endorsement } from '../types';

/**
 * Fetches endorsements for a given developer.
 * @param developerId The ID of the developer to fetch endorsements for.
 * @param publicOnly If true, only fetches public endorsements. Defaults to false.
 * @returns An array of Endorsement objects, or null if an error occurs.
 */
export default async function fetchEndorsementsForDeveloper(
  developerId: string,
  publicOnly: boolean = false
): Promise<Endorsement[] | null> {
  try {
    let query = supabase
      .from('endorsements')
      .select(`
        id,
        created_at,
        developer_id,
        endorser_id,
        endorser_email,
        endorser_role,
        comment,
        skill,
        is_anonymous,
        is_public,
        endorser_name,
        endorser_user:endorser_id(
          name,
          profile_pic_url,
          developers(public_profile_slug)
        )
      `)
      .eq('developer_id', developerId)
      .order('created_at', { ascending: false });

    if (publicOnly) {
      query = query.eq('is_public', true);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching endorsements:', error.message);
      return null;
    }

    // Ensure types
    const transformedData: Endorsement[] = (data || []).map((item: any) => ({
      id: item.id,
      created_at: item.created_at,
      developer_id: item.developer_id,
      endorser_id: item.endorser_id,
      endorser_email: item.endorser_email,
      endorser_role: item.endorser_role,
      comment: item.comment,
      skill: item.skill,
      is_anonymous: item.is_anonymous,
      is_public: item.is_public,
      endorser_name: item.endorser_name ?? null,
      endorser_user: item.endorser_user
        ? {
            name: item.endorser_user.name,
            developers: item.endorser_user.developers || [],
          }
        : null,
    }));

    return transformedData;
  } catch (err) {
    console.error('An unexpected error occurred while fetching endorsements:', err);
    return null;
  }
}

/**
 * Updates the visibility status (is_public) of a specific endorsement.
 * @param endorsementId The ID of the endorsement to update.
 * @param isPublic The new public status (true for public, false for hidden).
 * @returns A promise that resolves to true if successful, false otherwise.
 */
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
