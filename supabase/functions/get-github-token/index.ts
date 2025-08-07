import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { create } from 'https://deno.land/x/djwt@v3.0.1/mod.ts';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};
// Helper function to convert PKCS#1 to PKCS#8 format
function pkcs1ToPkcs8(pkcs1Key) {
  // PKCS#8 wrapper for RSA private key
  const pkcs8Header = new Uint8Array([
    0x30,
    0x82,
    0x00,
    0x00,
    0x02,
    0x01,
    0x00,
    0x30,
    0x0d,
    0x06,
    0x09,
    0x2a,
    0x86,
    0x48,
    0x86,
    0xf7,
    0x0d,
    0x01,
    0x01,
    0x01,
    0x05,
    0x00,
    0x04,
    0x82,
    0x00,
    0x00 // OCTET STRING, length will be calculated
  ]);
  const totalLength = pkcs8Header.length + pkcs1Key.length;
  const result = new Uint8Array(totalLength);
  // Set the lengths
  pkcs8Header[2] = totalLength - 4 >> 8;
  pkcs8Header[3] = totalLength - 4 & 0xff;
  pkcs8Header[pkcs8Header.length - 2] = pkcs1Key.length >> 8;
  pkcs8Header[pkcs8Header.length - 1] = pkcs1Key.length & 0xff;
  // Combine header and key
  result.set(pkcs8Header);
  result.set(pkcs1Key, pkcs8Header.length);
  return result;
}
async function generateJWT(appId, privateKey) {
  console.log(`[get-github-token] Generating JWT for app ID: ${appId}`);
  console.log(`[get-github-token] Private key format check - starts with: ${privateKey.substring(0, 50)}...`);
  // Ensure we have a proper PEM key
  if (!privateKey.includes('-----BEGIN') || !privateKey.includes('-----END')) {
    throw new Error('Private key must be in PEM format with BEGIN/END markers');
  }
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: appId,
    iat: now - 60,
    exp: now + 600
  };
  try {
    // Extract the base64 content from PEM
    const pemHeader = "-----BEGIN RSA PRIVATE KEY-----";
    const pemFooter = "-----END RSA PRIVATE KEY-----";
    const pemContents = privateKey.replace(pemHeader, "").replace(pemFooter, "").replace(/\s/g, "");
    // Decode base64 to get PKCS#1 DER
    const pkcs1Der = Uint8Array.from(atob(pemContents), (c)=>c.charCodeAt(0));
    // Convert PKCS#1 to PKCS#8
    const pkcs8Der = pkcs1ToPkcs8(pkcs1Der);
    // Import the private key for signing
    const key = await crypto.subtle.importKey('pkcs8', pkcs8Der, {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256'
    }, false, [
      'sign'
    ]);
    const jwt = await create({
      alg: 'RS256',
      typ: 'JWT'
    }, payload, key);
    console.log(`[get-github-token] JWT generated successfully`);
    return jwt;
  } catch (error) {
    console.error(`[get-github-token] JWT generation failed:`, error);
    throw new Error(`Failed to generate JWT: ${error.message}`);
  }
}
async function getInstallationAccessToken(supabaseClient, installationId) {
  console.log(`[get-github-token] Authenticating for installation=${installationId}`);
  const appId = Deno.env.get('GITHUB_APP_ID');
  const privateKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY');
  if (!appId || !privateKey) {
    console.error('[get-github-token] Missing environment variables');
    throw new Error('GitHub App credentials not configured');
  }
  console.log(`[get-github-token] App ID: ${appId}`);
  console.log(`[get-github-token] Private key length: ${privateKey.length} chars`);
  console.log(`[get-github-token] Private key starts with: ${privateKey.substring(0, 50)}`);
  try {
    console.log(`[get-github-token] Private key format validated, generating JWT`);
    const jwt = await generateJWT(appId, privateKey);
    const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwt}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitTalent-App'
      }
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[get-github-token] GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
      return null;
    }
    const data = await response.json();
    console.log(`[get-github-token] Successfully generated token for installation=${installationId}`);
    return data.token;
  } catch (error) {
    console.error(`[get-github-token] Error:`, error);
    return null;
  }
}
Deno.serve(async (req)=>{
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  try {
    const { installationId } = await req.json();
    if (!installationId) {
      return new Response(JSON.stringify({
        error: 'Installation ID is required'
      }), {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    const supabaseClient = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const token = await getInstallationAccessToken(supabaseClient, installationId);
    if (!token) {
      return new Response(JSON.stringify({
        error: 'Failed to generate access token'
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    // FIXED: Changed 'token' to 'accessToken' to match what github-proxy expects
    return new Response(JSON.stringify({
      accessToken: token // This now matches github-proxy's expectation
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  } catch (error) {
    console.error('[get-github-token] Unhandled error:', error.message);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
