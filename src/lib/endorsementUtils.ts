// src/lib/endorsementUtils.ts

import { supabase } from './supabase'; // Adjust this path to your Supabase client import
import { Endorsement } from '../types'; // Adjust this path to your Endorsement interface

/**
 * Fetches all endorsements for a given developer.
 * @param developerId The UUID of the developer whose endorsements are to be fetched.
 * @returns A promise that resolves to an array of Endorsement objects, or null if an error occurs.
 */
export async function fetchEndorsementsForDeveloper(developerId: string): Promise<Endorsement[] | null> {
  const { data, error } = await supabase
    .from('endorsements')
    .select('id, developer_id, endorser_id, text, endorser_name, endorser_email, created_at')
    .eq('developer_id', developerId)
    .order('created_at', { ascending: false }); // Order by newest first

  if (error) {
    console.error('Error fetching endorsements for developer:', developerId, error);
    return null;
  }

  return data as Endorsement[];
}
