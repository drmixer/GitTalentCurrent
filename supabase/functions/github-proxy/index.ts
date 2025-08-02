import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
  "Access-Control-Max-Age": "86400"
};

async function getInstallationAccessToken(supabaseClient: SupabaseClient, installationId: number | string): Promise<string | null> {
  try {
    const { data: tokenData, error: tokenError } = await supabaseClient.functions.invoke('get-github-token', {
      body: { installationId },
    });

    if (tokenError) {
      throw tokenError;
    }

    return tokenData.accessToken;
  } catch (error) {
    console.error(`[github-proxy] Error invoking get-github-token for installation ${installationId}:`, error.message);
    return null; // Return null on failure to allow graceful degradation
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { handle, installationId } = await req.json();
    if (!handle) {
      throw new Error("GitHub handle is required");
    }

    const headers: { [key: string]: string } = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GitTalent-App"
    };

    if (installationId) {
      // Create a client to invoke the token function
      const supabaseClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
      const token = await getInstallationAccessToken(supabaseClient, installationId);
      if (token) {
        headers["Authorization"] = `token ${token}`;
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