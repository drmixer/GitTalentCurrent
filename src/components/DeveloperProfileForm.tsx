@@ .. @@
   };
 
   const handleConnectGitHub = () => {
     setConnectingGitHub(true);
     
    // Use the connectGitHubApp function from AuthContext
    connectGitHubApp()
      .catch(error => {
        console.error('Error connecting to GitHub:', error);
        setConnectingGitHub(false);
      });
     navigate('/github-setup');
   };