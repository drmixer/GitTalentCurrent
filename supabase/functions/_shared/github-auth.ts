import { sign } from 'npm:jsonwebtoken@9.0.2';

const GITHUB_APP_ID = Deno.env.get('GITHUB_APP_ID');
const rawKey = Deno.env.get('GITHUB_APP_PRIVATE_KEY') || '';

// This robust key cleaning logic is taken from the original 'update-github-installation' function.
// It handles potential issues from copying/pasting the key into environment variables.
const GITHUB_APP_PRIVATE_KEY = rawKey
  .replace(/\\n/g, '\n')
  .trim();

/**
 * Creates a GitHub App JWT (JSON Web Token) for authenticating as the app.
 * This token is short-lived (10 minutes) and is used to request installation access tokens.
 * @returns {string} The signed JWT.
 * @throws {Error} If GitHub App credentials are not configured.
 */
export function createAppToken(): string {
  if (!GITHUB_APP_ID || !GITHUB_APP_PRIVATE_KEY) {
    throw new Error('GitHub App credentials (GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY) are not configured in environment variables.');
  }

  const payload = {
    iat: Math.floor(Date.now() / 1000) - 60, // Issued at time, 60s in the past to allow for clock drift
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // Expiration time (10 minutes)
    iss: GITHUB_APP_ID, // Issuer: your app's ID
  };

  try {
    const token = sign(payload, GITHUB_APP_PRIVATE_KEY, { algorithm: 'RS256' });
    return token;
  } catch (error) {
    console.error("Error signing JWT:", error);
    // Log key details for easier debugging without exposing the key itself
    console.error("Key details: Length -", GITHUB_APP_PRIVATE_KEY.length, ", Starts with -", GITHUB_APP_PRIVATE_KEY.substring(0, 30));
    throw new Error("Failed to sign JWT. Please check the private key format.", { cause: error });
  }
}

/**
 * Exchanges a GitHub App JWT for an installation-specific access token.
 * @param {number | string} installationId - The ID of the GitHub App installation.
 * @returns {Promise<string>} A promise that resolves to the installation access token.
 * @throws {Error} If the token exchange fails.
 */
export async function getInstallationAccessToken(installationId: number | string): Promise<string> {
  const appToken = createAppToken();

  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitTalent-App',
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`GitHub API error (${response.status}): ${errorBody}`);
    throw new Error(`Failed to get installation access token for installation ID ${installationId}.`);
  }

  const data = await response.json();
  if (!data.token) {
    throw new Error('Token not found in GitHub API response.');
  }

  return data.token;
}
