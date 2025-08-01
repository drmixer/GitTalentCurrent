import jwt from 'npm:jsonwebtoken@9.0.2';
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
  "Access-Control-Max-Age": "86400"
};
// Correctly read the App ID and Private Key from environment secrets.
const GITHUB_APP_ID = Deno.env.get("GITHUB_APP_ID");
const GITHUB_APP_PRIVATE_KEY = Deno.env.get("GITHUB_APP_PRIVATE_KEY")?.replace(/\\n/g, "\n");
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
    const headers = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GitTalent-App"
    };
    if (GITHUB_APP_ID && GITHUB_APP_PRIVATE_KEY && installationId) {
      try {
        const payload = {
          iat: Math.floor(Date.now() / 1000) - 60,
          exp: Math.floor(Date.now() / 1000) + 10 * 60,
          iss: GITHUB_APP_ID
        };
        const appToken = jwt.sign(payload, GITHUB_APP_PRIVATE_KEY, {
          algorithm: 'RS256'
        });
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
    const filteredRepos = reposData.filter((repo)=>!repo.fork || repo.stargazers_count > 5);
    const totalStars = filteredRepos.reduce((sum, repo)=>sum + repo.stargazers_count, 0);
    let contributionData;
    if (headers["Authorization"]) {
      try {
        contributionData = await fetchContributionData(handle, headers["Authorization"]);
      } catch (error) {
        console.error("Error fetching contribution data:", error);
        contributionData = [];
      }
    } else {
      contributionData = [];
    }
    return new Response(JSON.stringify({
      user: userData,
      repos: filteredRepos,
      totalStars,
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
  `;
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
  return data.data.user.contributionsCollection.contributionCalendar.weeks.flatMap((week)=>week.contributionDays);
}