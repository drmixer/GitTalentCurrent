import { createClient } from 'npm:@supabase/supabase-js@2.39.0';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    // Get GitHub handle from request
    const { handle } = await req.json();
    
    if (!handle) {
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

    console.log(`Fetching GitHub data for: ${handle}`);

    // GitHub API URLs
    const userUrl = `https://api.github.com/users/${handle}`;
    const reposUrl = `https://api.github.com/users/${handle}/repos?sort=updated&per_page=100&type=public`;

    // GitHub API headers - using public access for now (rate limited but works for basic data)
    // We'll remove the token authorization since it's not set up yet
    const headers = {
      "Accept": "application/vnd.github.v3+json",
      "User-Agent": "GitTalent-App",
    };

    // Fetch user data
    const userResponse = await fetch(userUrl, { headers });
    
    if (!userResponse.ok) {
      if (userResponse.status === 404) {
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
    const reposResponse = await fetch(reposUrl, { headers });
    
    if (!reposResponse.ok) {
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

    // Generate contribution data based on repository activity
    const contributionData = generateContributionsFromRepos(filteredRepos);

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