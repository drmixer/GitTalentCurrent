import { getInstallationAccessToken } from '../_shared/github-auth.ts';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
  "Access-Control-Max-Age": "86400"
};

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
        // We can proceed without an installation token, but requests will be unauthenticated.
        // This maintains partial functionality if the token exchange fails.
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