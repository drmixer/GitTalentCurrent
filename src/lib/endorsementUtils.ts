// src/lib/endorsementUtils.ts

import { supabase } from './supabase';
import { Endorsement } from '../types'; // Assuming '../types' resolves to types/index.ts due to module resolution

/**
 * Fetches endorsements for a specific developer.
 * @param developerId The ID of the developer.
 * @param isPublicOnly If true, only fetches endorsements marked as public.
 * @returns An array of Endorsement objects, or null if an error occurs.
 */
export const fetchEndorsementsForDeveloper = async (
  developerId: string,
  isPublicOnly: boolean = false
): Promise<Endorsement[] | null> => {
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

    // Supabase often returns nested data as an array even if it's a one-to-one relationship.
    // The type casting `as Endorsement[]` assumes this structure will be correct.
    return data as Endorsement[];

  } catch (error) {
    console.error('Unexpected error in fetchEndorsementsForDeveloper:', error);
    return null;
  }
};
