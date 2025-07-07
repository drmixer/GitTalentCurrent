import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Adjust for production
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.");
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { developer_user_id, developer_user_ids } = await req.json();

    if (!developer_user_id && (!developer_user_ids || !Array.isArray(developer_user_ids) || developer_user_ids.length === 0)) {
      return new Response(JSON.stringify({ error: 'developer_user_id or a non-empty array of developer_user_ids is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const idsToIncrement = developer_user_id ? [developer_user_id] : developer_user_ids;

    // Basic abuse prevention: Get the authenticated user ID (viewer)
    // This part is conceptual for now as search page context is needed for true abuse prevention.
    // For now, we assume the call is made by an authenticated recruiter.
    // A more robust solution might involve checking recruiter role or specific permissions.
    // We also don't want developers incrementing their own search appearances if they somehow find this function.
    // However, without the viewer's ID easily available here without complex token handling,
    // we'll rely on RLS on the table for who can *call* this function if needed, or add more logic later.

    // For simplicity in this version, we'll proceed with incrementing.
    // A more advanced version might check if the caller is the developer themselves.

    const errors: any[] = [];
    const successes: any[] = [];

    for (const id of idsToIncrement) {
      const { data: developer, error: fetchError } = await supabaseAdmin
        .from('developers')
        .select('search_appearance_count')
        .eq('user_id', id)
        .single();

      if (fetchError || !developer) {
        console.error(`Error fetching developer ${id}:`, fetchError?.message || 'Not found');
        errors.push({ id, error: fetchError?.message || 'Developer not found' });
        continue;
      }

      const newCount = (developer.search_appearance_count || 0) + 1;

      const { error: updateError } = await supabaseAdmin
        .from('developers')
        .update({ search_appearance_count: newCount })
        .eq('user_id', id);

      if (updateError) {
        console.error(`Error updating search_appearance_count for ${id}:`, updateError);
        errors.push({ id, error: updateError.message });
      } else {
        successes.push({ id, new_search_appearance_count: newCount });
      }
    }

    if (errors.length > 0 && successes.length === 0) {
         throw new Error(`Failed to update search appearance counts for all provided IDs. First error: ${errors[0].error}`);
    }

    return new Response(JSON.stringify({
        message: errors.length > 0 ? 'Search appearance count incremented for some developers with errors for others.' : 'Search appearance counts incremented successfully.',
        successes,
        errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: errors.length > 0 ? 207 : 200, // Multi-Status if there are partial errors
    });

  } catch (error) {
    console.error('Error in log-search-appearance function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
