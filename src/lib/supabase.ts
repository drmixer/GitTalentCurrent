import { createClient } from '@supabase/supabase-js';

// Export Supabase storage bucket names
export const STORAGE_BUCKETS = {
  PROFILE_IMAGES: 'profile_images',
  PORTFOLIO_IMAGES: 'portfolio_images',
  RESUME_FILES: 'resume_files'
};

// Export Supabase realtime listen types for use in components
export const REALTIME_LISTEN_TYPES = {
  INSERT: 'INSERT',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE',
  ALL: '*'
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Check if the required environment variables are missing and throw an error
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL or Anon Key missing in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
});

// Initialize storage buckets
const initializeStorage = async () => {
  try {
    // Check if buckets exist, create them if they don't
    for (const bucket of Object.values(STORAGE_BUCKETS)) {
      try {
        const { data: existingBucket } = await supabase.storage.getBucket(bucket);
        
        if (!existingBucket) {
          const { error } = await supabase.storage.createBucket(bucket, {
            public: true,
            fileSizeLimit: bucket === STORAGE_BUCKETS.RESUME_FILES ? 10485760 : 5242880 // 10MB for resumes, 5MB for images
          });
          
          if (error) {
            console.error(`Error creating bucket ${bucket}:`, error.message);
          } else {
            console.log(`Created storage bucket: ${bucket}`);
          }
        }
      } catch (error) {
        console.error(`Error checking bucket ${bucket}:`, error);
      }
    }
  } catch (error) {
    console.error('Error initializing storage:', error);
  }
};

// Initialize storage buckets when the app starts
initializeStorage();

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