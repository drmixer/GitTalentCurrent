import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { getInstallationAccessToken } from '../_shared/github-auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info"
};

async function getGithubUserData(installationId: number | string) {
  const installationToken = await getInstallationAccessToken(installationId);

  const installationDetailsResponse = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      'Authorization': `Bearer ${installationToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitTalent-App'
    }
  });

  if (!installationDetailsResponse.ok) {
    const errorText = await installationDetailsResponse.text();
    console.error(`Failed to get installation details from GitHub: ${errorText}`);
    throw new Error('Failed to get installation details from GitHub');
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }

  try {
    const { userId, installationId } = await req.json();
    if (!userId || !installationId) {
      throw new Error("userId and installationId are required");
    }

    console.log(`Processing: user=${userId}, installation=${installationId}`);
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const { login, avatar_url, bio, location } = await getGithubUserData(installationId);

    const { data: existingDeveloper, error: devCheckError } = await supabaseClient
      .from('developers')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (devCheckError) throw devCheckError;

    const developerData = {
      github_installation_id: installationId,
      github_handle: login,
      profile_pic_url: avatar_url,
      bio: bio || '',
      location: location || '',
      updated_at: new Date().toISOString()
    };
    if (existingDeveloper) {
      console.log('Updating existing developer profile.');
      const { error } = await supabaseClient.from('developers').update(developerData).eq('user_id', userId);
      if (error) throw error;
    } else {
      console.log('Creating new developer profile.');
      const { error } = await supabaseClient.from('developers').insert({
        user_id: userId,
        ...developerData
      });
      if (error) throw error;
    }
    return new Response(JSON.stringify({
      success: true,
      message: "Installation successful."
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error('Unhandled error in update-github-installation:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  }
});