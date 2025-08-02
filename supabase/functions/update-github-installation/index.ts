import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info"
};

// This function now invokes the dedicated token generation function
async function getGithubUserData(supabaseClient: SupabaseClient, installationId: number | string) {

  // Invoke the get-github-token function to get a token
  const { data: tokenData, error: tokenError } = await supabaseClient.functions.invoke('get-github-token', {
    body: { installationId },
  });

  if (tokenError) {
    console.error(`Error invoking get-github-token function:`, tokenError);
    throw new Error(`Failed to get installation token: ${tokenError.message}`);
  }

  const installationToken = tokenData.accessToken;
  if (!installationToken) {
      throw new Error("No access token returned from get-github-token function");
  }

  // Use the retrieved token to fetch installation details
  const installationDetailsResponse = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      'Authorization': `Bearer ${installationToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitTalent-App'
    }
  });

  if (!installationDetailsResponse.ok) {
    const errorText = await installationDetailsResponse.text();
    throw new Error(`Failed to get installation details from GitHub: ${errorText}`);
  }

  const installationDetails = await installationDetailsResponse.json();
  const userData = installationDetails.account;

  if (!userData || !userData.login) {
    throw new Error('Could not extract user account from installation details');
  }

  return {
    login: userData.login,
    avatar_url: userData.avatar_url,
    bio: userData.bio,
    location: userData.location
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { userId, installationId } = await req.json();
    if (!userId || !installationId) {
      throw new Error("userId and installationId are required");
    }

    console.log(`[update-github-installation] Processing for user=${userId}, installation=${installationId}`);

    // Create a Supabase client with the service role key to invoke other functions
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { login, avatar_url, bio, location } = await getGithubUserData(supabaseClient, installationId);

    const developerData = {
      github_installation_id: installationId,
      github_handle: login,
      profile_pic_url: avatar_url,
      bio: bio || '',
      location: location || '',
      updated_at: new Date().toISOString()
    };

    // Use upsert for cleaner logic: it will insert or update as needed.
    const { error } = await supabaseClient
      .from('developers')
      .upsert({ user_id: userId, ...developerData }, { onConflict: 'user_id' });

    if (error) {
        console.error("Supabase upsert error:", error);
        throw error;
    }

    console.log(`[update-github-installation] Successfully upserted developer profile for user ${userId}`);

    return new Response(JSON.stringify({ success: true, message: "Installation successful." }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('[update-github-installation] Unhandled error:', error.message);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});