// src/lib/endorsementUtils.ts

import { supabase } from './supabase'; // Adjust this path to your Supabase client import
import { Endorsement } from '../types'; // Adjust this path to your Endorsement interface

/**
 * Fetches endorsements for a given developer.
 * @param developerId The UUID of the developer whose endorsements are to be fetched.
 * @param publicOnly If true, only fetches endorsements marked as public. Defaults to false.
 * @returns A promise that resolves to an array of Endorsement objects, or null if an error occurs.
 */
export async function fetchEndorsementsForDeveloper(developerId: string, publicOnly: boolean = false): Promise<Endorsement[] | null> {
  let query = supabase
    .from('endorsements')
    .select('id, developer_id, endorser_id, text, endorser_name, endorser_email, is_public, created_at') // ADDED 'is_public' to select
    .eq('developer_id', developerId)
    .order('created_at', { ascending: false }); // Order by newest first

  if (publicOnly) {
    query = query.eq('is_public', true); // ADDED filter for publicOnly
  }

  const { data, error } = await query;

  if (error) {
    console.error('Error fetching endorsements for developer:', developerId, error);
    return null;
  }

  return data as Endorsement[];
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
