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
    
    // Validate required parameters
    if (!userId) {
      return new Response(JSON.stringify({ error: "userId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    if (!installationId) {
      return new Response(JSON.stringify({ error: "installationId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    console.log(`Updating GitHub installation ID for user: ${userId}, installation ID: ${installationId}`);
    
    // Validate the installation ID
    if (installationId === 'pending') {
      return new Response(JSON.stringify({ error: "Invalid installation ID: 'pending' is not a valid ID" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

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
      console.log('Developer profile found, updating installation ID');
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
      console.log('Developer profile not found, checking if user exists');
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
        console.error('User not found:', userId);
        return new Response( 
          JSON.stringify({ error: `User not found with ID: ${userId}` }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
      
      console.log('User found, creating new developer profile with installation ID');
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
      JSON.stringify({ error: error.message || "An unexpected error occurred during installation update" }),
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