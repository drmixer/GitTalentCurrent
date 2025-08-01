import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import jwt from 'npm:jsonwebtoken@9.0.2';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info"
};
const GITHUB_APP_ID = Deno.env.get('GITHUB_APP_ID');
const GITHUB_APP_PRIVATE_KEY = Deno.env.get('GITHUB_APP_PRIVATE_KEY')?.replace(/\\n/g, "\n");
async function getAppToken() {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    console.error('GitHub App credentials are not configured.');
    return null;
  }
  try {
    const payload = {
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + 10 * 60,
      iss: GITHUB_APP_ID
    };
    return jwt.sign(payload, GITHUB_APP_PRIVATE_KEY, {
      algorithm: 'RS256'
    });
  } catch (error) {
    console.error("Error generating GitHub App JWT:", error.message);
    return null;
  }
}
async function getInstallationAccessToken(installationId) {
  const appToken = await getAppToken();
  if (!appToken) return null;
  try {
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${appToken}`,
        'User-Agent': 'GitTalent-App'
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Installation token fetch failed: ${response.status} - ${errorText}`);
      return null;
    }
    const { token } = await response.json();
    return token;
  } catch (error) {
    console.error(`Error fetching installation access token:`, error.message);
    return null;
  }
}
async function getGitHubUserDetails(installationId) {
  const installationToken = await getInstallationAccessToken(installationId);
  if (!installationToken) return null;
  try {
    // **THE FIX:** Using native fetch instead of Octokit
    const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${installationToken}`,
        'User-Agent': 'GitTalent-App'
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Get installation details failed: ${response.status} - ${errorText}`);
      return null;
    }
    const installationData = await response.json();
    return installationData?.account; // Return the account object
  } catch (error) {
    console.error('Error fetching GitHub user details:', error.message);
    return null;
  }
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  try {
    const { userId, installationId: rawInstallationId } = await req.json();
    if (!userId || rawInstallationId == null) {
      throw new Error("userId and installationId are required");
    }
    const installationIdNum = parseInt(String(rawInstallationId), 10);
    if (isNaN(installationIdNum)) {
      throw new Error("Invalid installationId");
    }
    console.log(`Processing: user=${userId}, installation=${installationIdNum}`);
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const ghAccount = await getGitHubUserDetails(installationIdNum);
    if (!ghAccount || !ghAccount.login) {
      throw new Error("Could not fetch GitHub account details for the installation.");
    }
    const { data: existingDeveloper, error: devCheckError } = await supabaseClient.from('developers').select('user_id').eq('user_id', userId).maybeSingle();
    if (devCheckError) throw devCheckError;
    const developerData = {
      github_installation_id: String(installationIdNum),
      github_handle: ghAccount.login,
      profile_pic_url: ghAccount.avatar_url,
      bio: ghAccount.bio,
      location: ghAccount.location,
      updated_at: new Date().toISOString()
    };
    let resultData;
    if (existingDeveloper) {
      const { data, error } = await supabaseClient.from('developers').update(developerData).eq('user_id', userId).select().single();
      if (error) throw error;
      resultData = data;
    } else {
      const { data, error } = await supabaseClient.from('developers').insert({
        user_id: userId,
        ...developerData
      }).select().single();
      if (error) throw error;
      resultData = data;
    }
    return new Response(JSON.stringify({
      success: true,
      data: resultData
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