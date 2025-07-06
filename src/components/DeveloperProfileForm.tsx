@@ .. @@
   };
 
   const handleConnectGitHub = () => {
    // Set a flag to indicate we're connecting GitHub
     setConnectingGitHub(true);
    console.log('Navigating to GitHub setup page');
    // Navigate to GitHub setup page instead of direct GitHub App URL
     navigate('/github-setup');
   };