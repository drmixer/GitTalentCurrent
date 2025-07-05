import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
  "Access-Control-Max-Age": "86400"
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get the request body
    const { userId, installationId } = await req.json();
    
    if (!userId || !installationId) {
      return new Response(
        JSON.stringify({ error: "userId and installationId are required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log(`Updating GitHub installation ID for user: ${userId}, installation ID: ${installationId}`);

    // Create a Supabase client with the Auth context of the user that called the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // First, check if the developer profile exists
    const { data: developerData, error: developerError } = await supabaseClient
      .from('developers')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (developerError) {
      console.error('Error checking developer profile:', developerError);
      return new Response(
        JSON.stringify({ error: `Error checking developer profile: ${developerError.message}` }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    let result;
    
    if (developerData) {
      // Update the existing developer profile
      const { data, error } = await supabaseClient
        .from('developers')
        .update({ github_installation_id: installationId })
        .eq('user_id', userId)
        .select();

      if (error) {
        console.error('Error updating developer profile:', error);
        return new Response(
          JSON.stringify({ error: `Error updating developer profile: ${error.message}` }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
      
      result = { updated: true, data };
    } else {
      // Check if user exists
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('id, role')
        .eq('id', userId)
        .maybeSingle();

      if (userError) {
        console.error('Error checking user:', userError);
        return new Response(
          JSON.stringify({ error: `Error checking user: ${userError.message}` }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      if (!userData) {
        return new Response(
          JSON.stringify({ error: "User not found" }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }

      // Create a new developer profile
      const { data, error } = await supabaseClient
        .from('developers')
        .insert({
          user_id: userId,
          github_handle: '',
          bio: '',
          availability: true,
          github_installation_id: installationId
        })
        .select();

      if (error) {
        console.error('Error creating developer profile:', error);
        return new Response(
          JSON.stringify({ error: `Error creating developer profile: ${error.message}` }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
      
      result = { created: true, data };
    }

    // Return the result
    return new Response(
      JSON.stringify(result),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error('Error in update-github-installation function:', error);
    
    return new Response(
      JSON.stringify({ error: error.message || "An unexpected error occurred" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});