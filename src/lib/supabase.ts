import { createClient } from '@supabase/supabase-js';

// Export Supabase storage bucket names
export const STORAGE_BUCKETS = {
  PROFILE_IMAGES: 'profile_images',
}
export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    console.error('Error during sign-out:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
};