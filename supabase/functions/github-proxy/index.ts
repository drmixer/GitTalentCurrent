import { createClient } from 'npm:@supabase/supabase-js@2.39.0';
import { create } from 'npm:jsonwebtoken@9.0.2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info",
  "Access-Control-Max-Age": "86400"
};

// GitHub App credentials from environment variables
const GITHUB_APP_ID = Deno.env.get("GITHUB_APP_ID");
const GITHUB_APP_PRIVATE_KEY = Deno.env.get("GITHUB_APP_PRIVATE_KEY")?.replace(/\\n/g, "\n");
const GITHUB_APP_CLIENT_ID = Deno.env.get("GITHUB_APP_CLIENT_ID");
const GITHUB_APP_CLIENT_SECRET = Deno.env.get("GITHUB_APP_CLIENT_SECRET");

Deno.serve(async (req: Request) => {
  console.log("GitHub proxy function invoked.");
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    console.log("Handling OPTIONS preflight request.");
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get GitHub handle and installation ID from request
    console.log("Parsing request body...");
    const { handle, installationId } = await req.json();
    console.log(`Request body parsed. Handle: ${handle}, Installation ID: ${installationId}`);
    
    if (!handle) {
      console.error("GitHub handle is missing from the request.");
      return new Response(
        JSON.stringify({ error: "GitHub handle is required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    console.log(`Fetching GitHub data for: ${handle}, Installation ID: ${installationId || 'not provided'}`);

    // Determine if we should use GitHub App authentication or public access
    let headers: Record<string, string> = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GitTalent-App", 
    };

    // If we have GitHub App credentials and an installation ID, use GitHub App authentication
    if (GITHUB_APP_ID && GITHUB_APP_PRIVATE_KEY && installationId) {
      console.log("Using GitHub App authentication with installation ID:", installationId);
      
      try {
        // Generate a JWT for the GitHub App
        const now = Math.floor(Date.now() / 1000);
        const payload = {
          iat: now,
          exp: now + (10 * 60), // JWT expires in 10 minutes
          iss: GITHUB_APP_ID
        };
        
        const jwt = create(payload, GITHUB_APP_PRIVATE_KEY, { algorithm: 'RS256' });
        console.log("JWT generated for GitHub App authentication.");
        
        // Exchange the JWT for an installation access token
        console.log(`Fetching installation access token for installation ID: ${installationId}...`);
        const tokenResponse = await fetch(
          `https://api.github.com/app/installations/${installationId}/access_tokens`,
          {
            method: 'POST',
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `Bearer ${jwt}`,
              'User-Agent': 'GitTalent-App'
            }
          }
        );
        
        if (!tokenResponse.ok) {
          const errorData = await tokenResponse.text();
          console.error(`Error getting installation token: ${tokenResponse.status} ${errorData}`);
          throw new Error(`Failed to get installation token: ${tokenResponse.status}`);
        }
        
        const { token } = await tokenResponse.json();
        
        // Use the installation token for subsequent requests
        headers["Authorization"] = `token ${token}`;
        console.log("Successfully obtained installation access token for installation ID:", installationId);
      } catch (error) {
        console.error("Error generating GitHub App token:", error);
        // Fall back to public access if token generation fails
        console.log("Falling back to public access due to token error");
      }
    } else {
      console.log("Using public access (no GitHub App credentials or installation ID provided)");
    }

    // GitHub API URLs
    const userUrl = `https://api.github.com/users/${handle}`;
    const reposUrl = `https://api.github.com/users/${handle}/repos?sort=updated&per_page=100&type=public`;

    // Fetch user data
    console.log(`Fetching user data from: ${userUrl}`);
    const userResponse = await fetch(userUrl, { headers });
    console.log(`User data response status: ${userResponse.status}`);
    
    if (!userResponse.ok) {
      if (userResponse.status === 404) {
        console.error(`GitHub user '${handle}' not found.`);
        return new Response(
          JSON.stringify({ error: `GitHub user '${handle}' not found` }),
          {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      } else if (userResponse.status === 403) {
        return new Response(
          JSON.stringify({ error: "GitHub API rate limit exceeded. Please try again later." }),
          {
            status: 403,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      } else {
        return new Response(
          JSON.stringify({ error: `GitHub API error: ${userResponse.status}` }),
          {
            status: userResponse.status,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          }
        );
      }
    }

    const userData = await userResponse.json();

    // Fetch repositories
    console.log(`Fetching repositories from: ${reposUrl}`);
    const reposResponse = await fetch(reposUrl, { headers });
    console.log(`Repositories response status: ${reposResponse.status}`);
    
    if (!reposResponse.ok) {
      console.error(`Failed to fetch repositories: ${reposResponse.status}`);
      return new Response(
        JSON.stringify({ error: `Failed to fetch repositories: ${reposResponse.status}` }),
        {
          status: reposResponse.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        }
      );
    }

    const reposData = await reposResponse.json();

    // Filter out forks unless they have significant stars
    const filteredRepos = reposData.filter((repo: any) => 
      !repo.fork || repo.stargazers_count > 5
    );

    // Calculate total stars
    const totalStars = filteredRepos.reduce((sum: number, repo: any) => sum + repo.stargazers_count, 0);

    // Aggregate languages from repositories
    const languageStats: Record<string, number> = {};
    
    // For each repo with a language, fetch detailed language stats
    const languagePromises = filteredRepos.slice(0, 10).map(async (repo: any) => {
      if (repo.language) {
        try {
          const langResponse = await fetch(`https://api.github.com/repos/${repo.full_name}/languages`, { headers });
          
          if (langResponse.ok) {
            const langData = await langResponse.json();
            Object.entries(langData).forEach(([lang, bytes]) => {
              languageStats[lang] = (languageStats[lang] || 0) + (bytes as number);
            });
          } else {
            // Fallback to just counting repos by primary language
            languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
          }
        } catch (error) {
          // Fallback to just counting repos by primary language
          languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
        }
      }
    });

    // Wait for all language requests to complete
    await Promise.all(languagePromises);

    // Try to fetch real contribution data if we have an installation token
    let contributionData;
    if (headers["Authorization"]) {
      try {
        // Attempt to fetch contribution data using GraphQL API
        contributionData = await fetchContributionData(handle, headers["Authorization"]);
      } catch (error) {
        console.error("Error fetching contribution data:", error);
        // Fall back to generated data
        contributionData = generateContributionsFromRepos(filteredRepos);
      }
    } else {
      // Generate contribution data based on repository activity
      contributionData = generateContributionsFromRepos(filteredRepos);
    }

    // Return the combined data
    return new Response(
      JSON.stringify({
        user: userData,
        repos: filteredRepos,
        languages: languageStats,
        totalStars,
        contributions: contributionData
      }),
      {
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  } catch (error) {
    console.error("Error in GitHub proxy:", error);
    
    return new Response(
      JSON.stringify({ error: error.message || "Failed to fetch GitHub data" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders,
        },
      }
    );
  }
});

// Helper function to fetch contribution data using GraphQL API
async function fetchContributionData(username: string, authToken: string) {
  const query = `
    query {
      user(login: "${username}") {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
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
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GraphQL request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  
  if (data.errors) {
    throw new Error(`GraphQL error: ${data.errors[0].message}`);
  }

  // Process the GraphQL response into our expected format
  const calendar = data.data.user.contributionsCollection.contributionCalendar;
  const contributions = [];

  for (const week of calendar.weeks) {
    for (const day of week.contributionDays) {
      let level = 0;
      if (day.contributionLevel === 'FIRST_QUARTILE') level = 1;
      else if (day.contributionLevel === 'SECOND_QUARTILE') level = 2;
      else if (day.contributionLevel === 'THIRD_QUARTILE') level = 3;
      else if (day.contributionLevel === 'FOURTH_QUARTILE') level = 4;

      contributions.push({
        date: day.date,
        count: day.contributionCount,
        level
      });
    }
  }

  return contributions;
}

// Helper function to generate contribution data based on repository activity
function generateContributionsFromRepos(repos: any[]): { date: string; count: number; level: number }[] {
  const today = new Date();
  const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const contributions: { date: string; count: number; level: number }[] = [];
  
  // Initialize all days with zero contributions
  for (let i = 0; i < 365; i++) {
    const date = new Date(oneYearAgo);
    date.setDate(date.getDate() + i);
    contributions.push({
      date: date.toISOString().split('T')[0],
      count: 0,
      level: 0
    });
  }
  
  // Map of dates to contribution counts
  const dateMap: Record<string, number> = {};
  
  // Process repository events to estimate contributions
  repos.forEach(repo => {
    // Use creation date
    const createdAt = new Date(repo.created_at);
    if (createdAt >= oneYearAgo && createdAt <= today) {
      const dateStr = createdAt.toISOString().split('T')[0];
      dateMap[dateStr] = (dateMap[dateStr] || 0) + 3; // Creating a repo counts as 3 contributions
    }
    
    // Use updated date
    const updatedAt = new Date(repo.updated_at);
    if (updatedAt >= oneYearAgo && updatedAt <= today) {
      const dateStr = updatedAt.toISOString().split('T')[0];
      dateMap[dateStr] = (dateMap[dateStr] || 0) + 2; // Updating a repo counts as 2 contributions
    }
    
    // Use pushed date if available
    if (repo.pushed_at) {
      const pushedAt = new Date(repo.pushed_at);
      if (pushedAt >= oneYearAgo && pushedAt <= today) {
        const dateStr = pushedAt.toISOString().split('T')[0];
        dateMap[dateStr] = (dateMap[dateStr] || 0) + 1; // Pushing to a repo counts as 1 contribution
      }
    }
  });
   
  // Apply the counts to our contributions array
  contributions.forEach((day, index) => {
    if (dateMap[day.date]) {
      day.count = dateMap[day.date];
      
      // Set the level based on the count
      if (day.count >= 10) day.level = 4;
      else if (day.count >= 7) day.level = 3;
      else if (day.count >= 4) day.level = 2;
      else if (day.count >= 1) day.level = 1;
    }
  });
  
  return contributions;
}