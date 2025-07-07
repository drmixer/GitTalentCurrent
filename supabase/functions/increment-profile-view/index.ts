import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust for production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle OPTIONS request for CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    }

    // Create a Supabase client with the service role key to bypass RLS for incrementing
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get the developer_user_id from the request body
    const { developer_user_id } = await req.json();

    if (!developer_user_id) {
      return new Response(JSON.stringify({ error: 'developer_user_id is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // --- Abuse Prevention (Basic) ---
    // Get the authenticated user ID from the request headers (if available)
    // The JWT is automatically verified by Supabase if the function is invoked with user's token
    const authHeader = req.headers.get('Authorization');
    let currentUserId = null;

    if (authHeader) {
        const token = authHeader.replace('Bearer ', '');
        // Create a Supabase client with the user's token to get their ID
        const supabaseUserClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        });
        const { data: { user } } = await supabaseUserClient.auth.getUser();
        if (user) {
            currentUserId = user.id;
        }
    }

    // Don't increment if the viewer is the owner of the profile
    if (currentUserId && currentUserId === developer_user_id) {
      return new Response(JSON.stringify({ message: 'Owner viewing own profile; view not counted.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200, // Or 204 No Content
      });
    }
    // --- End Abuse Prevention ---


    // Increment the profile_view_count for the specified developer
    // Using RPC call to an SQL function for atomicity if preferred, or direct update:
    // For direct update (simpler for now):
    const { data: developer, error: fetchError } = await supabaseAdmin
      .from('developers')
      .select('profile_view_count')
      .eq('user_id', developer_user_id)
      .single();

    if (fetchError) {
      console.error('Error fetching developer:', fetchError);
      throw new Error(`Developer not found or DB error: ${fetchError.message}`);
    }

    if (!developer) {
        return new Response(JSON.stringify({ error: 'Developer not found' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 404,
        });
    }

    const newViewCount = (developer.profile_view_count || 0) + 1;

    const { error: updateError } = await supabaseAdmin
      .from('developers')
      .update({ profile_view_count: newViewCount })
      .eq('user_id', developer_user_id);

    if (updateError) {
      console.error('Error updating profile_view_count:', updateError);
      throw new Error(`Failed to update view count: ${updateError.message}`);
    }

    return new Response(JSON.stringify({ message: 'Profile view count incremented successfully', new_view_count: newViewCount }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Error in increment-profile-view function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
