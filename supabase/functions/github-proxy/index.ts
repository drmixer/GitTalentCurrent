import jwt from 'npm:jsonwebtoken@9.0.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
  "Access-Control-Max-Age": "86400"
};

async function getInstallationAccessToken(installationId: number | string): Promise<string> {
  const GITHUB_APP_ID = Deno.env.get('GITHUB_APP_ID');
  const rawKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY') || '';

  if (!GITHUB_APP_ID || !rawKey) {
    throw new Error('GitHub App credentials are not configured in environment variables.');
  }

  const GITHUB_APP_PRIVATE_KEY = rawKey.replace(/\\n/g, '\n').trim();

  const payload = {
    iat: Math.floor(Date.now() / 1000) - 60,
    exp: Math.floor(Date.now() / 1000) + (10 * 60),
    iss: GITHUB_APP_ID
  };

  const appToken = jwt.sign(payload, GITHUB_APP_PRIVATE_KEY, { algorithm: 'RS256' });

  const tokenResponse = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${appToken}`,
      'User-Agent': 'GitTalent-App'
    }
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    throw new Error(`Failed to get installation token: ${errorText}`);
  }

  const { token } = await tokenResponse.json();
  return token;
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

    const headers: { [key: string]: string } = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GitTalent-App"
    };

    if (installationId) {
      try {
        const token = await getInstallationAccessToken(installationId);
        headers["Authorization"] = `token ${token}`;
      } catch (error) {
        console.error(`Failed to get installation token for installationId ${installationId}:`, error.message);
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