import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import jwt from 'npm:jsonwebtoken@9.0.2';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info"
};
const GITHUB_APP_ID = Deno.env.get('GITHUB_APP_ID');
const rawKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY') || '';
// Fix: Remove outer quotes if present, and replace double escaped newlines with real newlines
const unquotedKey = rawKey.startsWith('"') && rawKey.endsWith('"') ? rawKey.slice(1, -1) : rawKey;
const GITHUB_APP_PRIVATE_KEY = unquotedKey.replace(/\\\\n/g, '\n') // Replace literal "\\n" with newline
.replace(/\r\n/g, '\n') // Normalize Windows newlines
.trim();
console.log('DEBUG: Raw key from env:', rawKey);
console.log('DEBUG: Unquoted key:', unquotedKey);
console.log('DEBUG: Final formatted key:', GITHUB_APP_PRIVATE_KEY);
console.log('DEBUG: Key first line:', GITHUB_APP_PRIVATE_KEY.split('\n')[0]);
console.log('DEBUG: Key last line:', GITHUB_APP_PRIVATE_KEY.split('\n').slice(-1)[0]);
console.log('DEBUG: Key length:', GITHUB_APP_PRIVATE_KEY.length);
async function getGithubUserData(installationId) {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new Error('GitHub App credentials are not configured in environment variables.');
  }
  const payload = {
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + 10 * 60,
    iss: GITHUB_APP_ID
  };
  // Sign JWT with RS256 using properly formatted PEM key
  const appToken = jwt.sign(payload, GITHUB_APP_PRIVATE_KEY, {
    algorithm: 'RS256'
  });
  const installationTokenResponse = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitTalent-App'
    }
  });
  if (!installationTokenResponse.ok) {
    const errorText = await installationTokenResponse.text();
    throw new Error(`Failed to get installation access token: ${errorText}`);
  }
  const installationTokenData = await installationTokenResponse.json();
  const installationToken = installationTokenData.token;
  const installationDetailsResponse = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      'Authorization': `Bearer ${installationToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitTalent-App'
    }
  });
  if (!installationDetailsResponse.ok) {
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
Deno.serve(async (req)=>{
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
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const { login, avatar_url, bio, location } = await getGithubUserData(installationId);
    const { data: existingDeveloper, error: devCheckError } = await supabaseClient.from('developers').select('user_id').eq('user_id', userId).maybeSingle();
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