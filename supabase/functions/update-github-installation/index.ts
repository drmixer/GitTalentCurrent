import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { sign } from 'npm:jsonwebtoken@9.0.2';

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
    const requestBody = await req.text();
    console.log("Request body received:", requestBody);
    
    let userId, installationId;
    
    try { 
      const parsedBody = JSON.parse(requestBody);
      userId = parsedBody.userId;
      installationId = parsedBody.installationId;
      console.log("Parsed request parameters:", { userId, installationId });
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return new Response(
        JSON.stringify({ error: "Invalid JSON in request body" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders }
        }
      );
    }
    
    // Validate userId parameter
    if (!userId) {
      return new Response(JSON.stringify({ success: false, error: "userId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }

    // Validate installationId parameter
    if (!installationId) {
      return new Response(JSON.stringify({ success: false, error: "installationId is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders }
      });
    }
    
    console.log(`Updating GitHub installation ID for user: ${userId}, installation ID: ${installationId}`);
    
    // Validate the installation ID
    if (installationId === 'pending') {
      return new Response(JSON.stringify({ success: false, error: "Invalid installation ID: 'pending' is not a valid ID" }), {
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
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (developerError) {
      console.error('Error checking developer profile:', developerError);
      return new Response( 
        JSON.stringify({ success: false, error: `Error checking developer profile: ${developerError.message}` }),
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
      console.log('Current installation ID:', developerData.github_installation_id || 'none');
      console.log('New installation ID to set:', installationId);

      try {
        // Get GitHub user data
        const { login, avatar_url } = await getGithubUserData(installationId);

        // Update the existing developer profile
        await supabaseClient
          .from('users')
          .update({
            github_installation_id: installationId,
            github_handle: login,
            avatar_url: avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        const { data, error } = await supabaseClient
          .from('developers')
          .update({
            github_installation_id: installationId,
            github_handle: login,
            avatar_url: avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId)
          .select();

        if (error) {
          throw error;
        }

        result = { updated: true, data, previous_installation_id: developerData.github_installation_id };
        console.log('Developer profile updated successfully');
      } catch (error) {
        console.error('Error updating developer profile:', error);
        return new Response( 
          JSON.stringify({ success: false, error: `Error updating developer profile: ${error.message}` }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    } else {
      console.log('Developer profile not found, checking if user exists');
      // Check if user exists in the users table
      const { data: userData, error: userError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
      
      if (userError) {
        console.error('Error checking user:', userError);
        return new Response( 
          JSON.stringify({ success: false, error: `Error checking user: ${userError.message}` }),
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
          JSON.stringify({ success: false, error: `User not found with ID: ${userId}` }),
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
      console.log('User data found:', userData);

      try {
        // Get GitHub user data
        const { login, avatar_url } = await getGithubUserData(installationId);

        // Create a new developer profile with the installation ID
        await supabaseClient
          .from('users')
          .update({
            github_installation_id: installationId,
            github_handle: login,
            avatar_url: avatar_url,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        const { data, error } = await supabaseClient
          .from('developers')
          .insert({
            user_id: userId,
            github_handle: login,
            avatar_url: avatar_url,
            bio: '',
            availability: true,
            top_languages: [],
            linked_projects: [],
            profile_strength: 10,
            github_installation_id: installationId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select();

        if (error) {
          throw error;
        }

        result = { created: true, data, user: userData };
        console.log('New developer profile created successfully');
      } catch (error) {
        console.error('Error creating developer profile:', error);
        return new Response( 
          JSON.stringify({ success: false, error: `Error creating developer profile: ${error.message}` }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }
    
    // Return the result
    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'GitHub installation ID updated successfully',
        data: result
      }),
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
      JSON.stringify({ 
        success: false,
        error: error.message || "An unexpected error occurred during installation update"
      }),
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

async function getGithubUserData(installationId: string): Promise<{ login: string, avatar_url: string }> {
  const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY');
  if (!privateKey) {
    throw new Error('GITHUB_APP_PRIVATE_KEY is not set');
  }

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iat: now,
    exp: now + 60,
    iss: Deno.env.get('GITHUB_APP_ID'),
  };

  const token = sign(payload, privateKey, { algorithm: 'RS256' });

  const installationTokenResponse = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!installationTokenResponse.ok) {
    throw new Error('Failed to get installation access token');
  }

  const installationTokenData = await installationTokenResponse.json();
  const installationToken = installationTokenData.token;

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      'Authorization': `Bearer ${installationToken}`,
      'Accept': 'application/vnd.github.v3+json',
    },
  });

  if (!userResponse.ok) {
    throw new Error('Failed to get user from GitHub');
  }

  const userData = await userResponse.json();
  return { login: userData.login, avatar_url: userData.avatar_url };
}