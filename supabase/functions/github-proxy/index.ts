import { create as createJwt } from "https://deno.land/x/djwt@v2.2/mod.ts";
import { crypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
  "Access-Control-Max-Age": "86400"
};
const GITHUB_APP_ID = Deno.env.get("GITHUB_APP_ID");
const GITHUB_APP_PRIVATE_KEY = Deno.env.get("GITHUB_APP_PRIVATE_KEY")?.replace(/\\n/g, "\n");
function pemToBinary(pem) {
  const lines = pem.split('\n');
  let base64 = '';
  for (const line of lines){
    if (line.startsWith('-----BEGIN') || line.startsWith('-----END')) continue;
    base64 += line.trim();
  }
  const binaryDer = atob(base64);
  const buffer = new ArrayBuffer(binaryDer.length);
  const view = new Uint8Array(buffer);
  for(let i = 0; i < binaryDer.length; i++){
    view[i] = binaryDer.charCodeAt(i);
  }
  return buffer;
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }
  try {
    const { handle, installationId } = await req.json();
    if (!handle) throw new Error("GitHub handle is required");
    let headers = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GitTalent-App"
    };
    if (GITHUB_APP_ID && GITHUB_APP_PRIVATE_KEY && installationId) {
      try {
        const privateKey = await crypto.subtle.importKey("pkcs8", pemToBinary(GITHUB_APP_PRIVATE_KEY), {
          name: "RSASSA-PKCS1-v1_5",
          hash: "SHA-256"
        }, true, [
          "sign"
        ]);
        const payload = {
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 10 * 60,
          iss: GITHUB_APP_ID
        };
        const appToken = await createJwt({
          alg: "RS256",
          typ: "JWT"
        }, payload, privateKey);
        const tokenResponse = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
          method: 'POST',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${appToken}`,
            'User-Agent': 'GitTalent-App'
          }
        });
        if (!tokenResponse.ok) throw new Error(`Failed to get installation token: ${tokenResponse.status}`);
        const { token } = await tokenResponse.json();
        headers["Authorization"] = `token ${token}`;
      } catch (error) {
        console.error("Error generating GitHub App token:", error.message);
      }
    }
    const userUrl = `https://api.github.com/users/${handle}`;
    const userResponse = await fetch(userUrl, {
      headers
    });
    if (!userResponse.ok) throw new Error(`GitHub user API error: ${userResponse.status}`);
    const userData = await userResponse.json();
    const reposUrl = `https://api.github.com/users/${handle}/repos?sort=updated&per_page=100&type=public`;
    const reposResponse = await fetch(reposUrl, {
      headers
    });
    if (!reposResponse.ok) throw new Error(`GitHub repos API error: ${reposResponse.status}`);
    const reposData = await reposResponse.json();
    const contributionData = await fetchContributionData(handle, headers["Authorization"]);
    return new Response(JSON.stringify({
      user: userData,
      repos: reposData,
      contributions: contributionData
    }), {
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders
      }
    });
  } catch (error) {
    console.error("Error in GitHub proxy:", error);
    return new Response(JSON.stringify({
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
async function fetchContributionData(username, authToken) {
  if (!authToken) return []; // Return empty if no auth token
  const query = `
      query($username: String!) {
        user(login: $username) {
          contributionsCollection {
            contributionCalendar {
              weeks {
                contributionDays {
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    }`;
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Authorization': authToken,
      'Content-Type': 'application/json',
      'User-Agent': 'GitTalent-App'
    },
    body: JSON.stringify({
      query,
      variables: {
        username
      }
    })
  });
  if (!response.ok) throw new Error(`GraphQL request failed: ${response.status}`);
  const data = await response.json();
  if (data.errors) throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
  return data.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((w)=>w.contributionDays);
}