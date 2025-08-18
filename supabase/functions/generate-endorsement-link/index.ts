import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
// Define the CORS headers
// IMPORTANT: 'Access-Control-Allow-Origin' must match your frontend's domain exactly.
// For your case, it's 'https://gittalent.dev'.
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://gittalent.dev',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  // ADDED 'x-client-info' and 'apikey' to the allowed headers
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-client-info, apikey'
};
serve(async (req)=>{
  // --- Handle CORS preflight request ---
  // Browsers send an OPTIONS request before the actual POST request
  // to check if the server allows the cross-origin call.
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    });
  }
  // --- Main Function Logic ---
  try {
    // Initialize the Supabase client for backend operations.
    // We use the 'SERVICE_ROLE_KEY' to bypass Row Level Security if needed for your logic.
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL'), Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    // Parse the request body to get the developerId
    const { developerId } = await req.json();
    // Validate that developerId is provided
    if (!developerId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Developer ID is required.'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        },
        status: 400
      });
    }
    // --- Construct the shareable link ---
    // This example assumes your public profile endorsement page looks like:
    // https://gittalent.dev/u/[developer_user_id]/endorse
    // You should adjust this URL structure to match your actual application's routing.
    const publicFrontendBaseUrl = 'https://gittalent.dev'; // Your deployed frontend base URL
    // You might also want to set this as an environment variable in your Supabase Function settings
    // E.g., const publicFrontendBaseUrl = Deno.env.get('PUBLIC_GITTALENT_BASE_URL') || 'https://gittalent.dev';
    const endorsementLink = `${publicFrontendBaseUrl}/u/${developerId}/endorse`;
    // --- Return the generated link ---
    return new Response(JSON.stringify({
      success: true,
      link: endorsementLink
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 200
    });
  } catch (error) {
    // --- Handle any errors during function execution ---
    console.error('Error in generate-endorsement-link function:', error.message);
    return new Response(JSON.stringify({
      success: false,
      message: `Internal Server Error: ${error.message || 'Unknown error'}`
    }), {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      },
      status: 500
    });
  }
});
