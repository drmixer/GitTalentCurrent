import { createClient } from '@supabase/supabase-js';
import { FunctionsClient } from '@supabase/functions-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;

// Create Supabase client with explicit auth configuration
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Export Supabase storage bucket names
export const STORAGE_BUCKETS = {
  PROFILE_IMAGES: 'profile_images',
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error during sign-out:', error);
      throw error;
    }
    console.log('Sign-out successful');
    
    // Clear any local storage items that might be causing issues
    localStorage.removeItem('gittalent-auth-token');
    localStorage.removeItem('sb-' + supabaseUrl.split('//')[1].split('.')[0] + '-auth-token');
    
    // Clear any cookies by setting them to expire
    document.cookie.split(';').forEach(cookie => {
      const [name] = cookie.trim().split('=');
      if (name.includes('supabase') || name.includes('sb-')) {
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
      }
    });
  } catch (error) {
    console.error('Error during sign-out:', error);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) { 
      console.error('Error fetching current user:', error);
      throw error;
    }
    console.log('Current user fetched successfully:', user ? user.id : 'No user found');
    return user;
  } catch (error) {
    console.error('Error fetching current user:', error);
    throw error;
  }
};

// Function to check if we're in a redirect flow
export const isInRedirectFlow = () => {
  return window.location.hash.includes('access_token=') || // Implicit flow
         window.location.hash.includes('error=') || // Error in auth flow
         window.location.search.includes('code='); // PKCE flow
};

// Function to clear auth params from URL
export const clearAuthParams = () => {
  if (window.location.hash || window.location.search.includes('code=')) {
    const cleanUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', cleanUrl);
    return true;
  }
  return false;
};