// This is the successful "Minimal Test" function, now promoted to a production utility.
// Its only job is to securely generate a GitHub installation access token.

import jwt from 'npm:jsonwebtoken@9.0.2';
import { decode as decodeBase64 } from 'https://deno.land/std@0.208.0/encoding/base64.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Or lock down to your app's domain
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey, x-client-info"
};

// The user's provided helper function to decode Base64.
// Note: new TextDecoder().decode(decodeBase64(str)) is a more modern equivalent.
function atob_portable(str: string): string {
  const decoded = decodeBase64(str);
  let result = '';
  for (let i = 0; i < decoded.length; i++) {
    result += String.fromCharCode(decoded[i]);
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const { installationId } = await req.json();
    if (!installationId) {
      throw new Error("installationId is required");
    }

    console.log(`[get-github-token] Authenticating for installation=${installationId}`);

    const GITHUB_APP_ID = Deno.env.get('GITHUB_APP_ID');
    const base64EncodedKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY') || '';

    if (!GITHUB_APP_ID || !base64EncodedKey) {
      throw new Error('[get-github-token] GitHub App credentials are not configured.');
    }

    const GITHUB_APP_PRIVATE_KEY = atob_portable(base64EncodedKey);

    const payload = {
      iat: Math.floor(Date.now() / 1000) - 60,
      exp: Math.floor(Date.now() / 1000) + (10 * 60),
      iss: GITHUB_APP_ID
    };

    const appToken = jwt.sign(payload, GITHUB_APP_PRIVATE_KEY, { algorithm: 'RS256' });

    const tokenResponse = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${appToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitTalent-App'
      }
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error(`[get-github-token] GitHub API failed with status ${tokenResponse.status}: ${errorText}`);
      throw new Error(`GitHub API error: ${errorText}`);
    }

    const tokenData = await tokenResponse.json();

    console.log(`[get-github-token] Successfully generated token for installation=${installationId}`);

    return new Response(JSON.stringify({ accessToken: tokenData.token }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });

  } catch (error) {
    console.error('[get-github-token] Unhandled error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders }
    });
  }
});
