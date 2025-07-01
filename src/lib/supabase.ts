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

// Initialize storage buckets if they don't exist
export const initializeStorage = async () => {
  try {
    // Check if buckets exist and create them if they don't
    for (const bucket of Object.values(STORAGE_BUCKETS)) {
      const { data: existingBucket } = await supabase.storage.getBucket(bucket);
      
      if (!existingBucket) {
        const { error } = await supabase.storage.createBucket(bucket, {
          public: true,
          fileSizeLimit: 5242880, // 5MB
          allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'application/pdf']
        });
        
        if (error) {
          console.error(`Error creating bucket ${bucket}:`, error);
        } else {
          console.log(`Created storage bucket: ${bucket}`);
          
          // Set public bucket policy
          const { error: policyError } = await supabase.storage.from(bucket).createSignedUrl('test.txt', 60);
          if (policyError && policyError.message.includes('The resource was not found')) {
            console.log(`Bucket ${bucket} created but needs public access policy`);
          }
        }
      }
    }
  } catch (error) {
    console.error('Error initializing storage buckets:', error);
  }
};

// Call initializeStorage when the app starts
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