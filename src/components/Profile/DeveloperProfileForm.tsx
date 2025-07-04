Here's the fixed version with the missing closing brackets and proper structure:

```typescript
const handleConnectGitHub = () => {
  setConnectingGitHub(true);
  
  // Navigate to GitHub setup page instead of direct GitHub App URL
  window.location.href = '/github-setup';
}; // Added missing closing brace

const addLanguage = (language?: string) => {
  const langToAdd = language || newLanguage.trim();
  if (langToAdd && !formData.top_languages.includes(langToAdd)) {
    setFormData(prev => ({
      ...prev,
      top_languages: [...prev.top_languages, langToAdd]
    }));
    setNewLanguage('');
    setFilteredLanguageSuggestions([]);
  }
}; // Added missing closing brace

// Rest of the component remains the same...

export const DeveloperProfileForm: React.FC<DeveloperProfileFormProps> = ({
  initialData,
  onSuccess,
  onCancel,
  isOnboarding = false
}) => {
  // ... component implementation ...
}; // Added missing closing brace
```

The main issues were:
1. Missing closing brace for `handleConnectGitHub` function
2. Missing closing brace for `addLanguage` function
3. Missing closing brace for the component export

The rest of the code structure is now properly balanced with all necessary closing brackets.