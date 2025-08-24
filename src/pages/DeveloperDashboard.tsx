// src/pages/DeveloperDashboard.tsx

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useNotifications } from '../contexts/NotificationsContext';
import { supabase } from '../lib/supabase';
import fetchEndorsementsForDeveloper, { updateEndorsementVisibility } from '../lib/endorsementUtils';
import {
  DeveloperProfileForm,
  PortfolioManager,
  MessageList,
  MessageThread,
  JobRoleDetails,
  ProfileStrengthIndicator,
  RealGitHubChart,
  GitHubUserActivityDetails,
  GitHubConnectPrompt,
  OverviewTab,
  JobsTab,
} from '../components';
import EndorsementDisplay from '../components/EndorsementDisplay';

import { useGitHub } from '../hooks/useGitHub';
import { useFreshGitHubDataOnce } from '../hooks/useFreshGitHubDataOnce';
import {
  MessageSquare, Github, Loader, AlertCircle,
} from 'lucide-react';
import DeveloperTests from './DeveloperTests';
import {
  Developer,
  JobRole,
  PortfolioItem,
  Endorsement,
  SavedJob,
  AppliedJob,
} from '../types';

// Helper function to calculate calendar year contributions (YTD)
const calculateCalendarYearContributions = (gitHubData: any): number => {
  if (!gitHubData?.contributions) {
    console.log('[GitHubUtils] No contributions data available for calendar year calculation');
    return 0;
  }
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;
  console.log('[GitHubUtils] Calculating calendar year contributions for year:', currentYear);
  if (gitHubData.contributions.calendar && Array.isArray(gitHubData.contributions.calendar)) {
    const calendarYearContributions = gitHubData.contributions.calendar
      .filter((day: any) => {
        const dayDate = day.date || day.occurredAt;
        return dayDate && dayDate >= yearStart;
      })
      .reduce((sum: number, day: any) => {
        const count = day.contributionCount || day.count || 0;
        return sum + count;
      }, 0);
    console.log('[GitHubUtils] Calendar year contributions from calendar data:', calendarYearContributions);
    return calendarYearContributions;
  }
  if (Array.isArray(gitHubData.contributions)) {
    const calendarYearContributions = gitHubData.contributions
      .filter((day: any) => {
        const dayDate = day.date || day.occurredAt;
        return dayDate && dayDate >= yearStart;
      })
      .reduce((sum: number, day: any) => {
        const count = day.contributionCount || day.count || 0;
        return sum + count;
      }, 0);
    console.log('[GitHubUtils] Calendar year contributions from legacy data:', calendarYearContributions);
    return calendarYearContributions;
  }
  console.warn('[GitHubUtils] No valid contribution data structure found for calendar year calculation');
  return 0;
};

interface SelectedMessageThreadDetails {
  otherUserId: string;
  otherUserName: string;
  otherUserRole: string;
  otherUserProfilePicUrl?: string;
  lastMessage: any;
  unreadCount: number;
  jobContext?: { id: string; title: string; };
}

interface Commit {
  sha: string;
  message: string;
  repoName: string;
  date: string;
  url: string;
}

interface DashboardLocationState {
  freshGitHubHandle?: string;
  freshGitHubInstallationId?: string;
  isFreshGitHubSetup?: boolean;
  fromAuthCallback?: boolean;
  ghAppConnected?: boolean;
  focusGitHubHandle?: boolean;
  fromGitHubSetup?: boolean;
  [key: string]: any;
}

const initialStateForGitHubData = { user: null, repos: [], languages: {}, totalStars: 0, contributions: [] };
const validTabs = ['overview', 'profile', 'portfolio', 'github-activity', 'messages', 'jobs', 'endorsements', 'tests'];

export const DeveloperDashboard: React.FC = () => {
  const {
    user: authUser,
    userProfile,
    developerProfile: contextDeveloperProfile,
    loading: authContextLoading,
    refreshProfile,
  } = useAuth();
  const { notifications: ctxNotifications, displayNotifications, markAsReadByType } = useNotifications();

  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as DashboardLocationState | null;

  const params = new URLSearchParams(location.search);
  const activeTab = validTabs.includes(params.get('tab') || '') ? params.get('tab') : 'overview';

  const [developerData, setDeveloperData] = useState<Developer | null>(null);
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [endorsements, setEndorsements] = useState<Endorsement[]>([]);
  const [isLoadingEndorsements, setIsLoadingEndorsements] = useState(true);
  const [endorsementError, setEndorsementError] = useState<string | null>(null);
  const [recentCommits, setRecentCommits] = useState<Commit[]>([]);

  const [selectedMessageThreadDetails, setSelectedMessageThreadDetails] = useState<SelectedMessageThreadDetails | null>(null);

  const [showGitHubConnectModal, setShowGitHubConnectModal] = useState(false);

  const [dashboardPageLoading, setDashboardPageLoading] = useState(true);
  const [hasFreshDataBeenProcessed, setHasFreshDataBeenProcessed] = useState(false);
  const [latchedSuccessfullyFetchedFreshData, setLatchedSuccessfullyFetchedFreshData] = useState<typeof initialStateForGitHubData | null>(null);

  // NEW: State to track calendar year contributions for YTD display
  const [calendarYearContributions, setCalendarYearContributions] = useState<number>(0);

  // CRITICAL FIX: Add state to track when profile form should be force-refreshed
  const [profileFormKey, setProfileFormKey] = useState(0);

  // CRITICAL DEBUG: Add comprehensive data flow debugging
  const [dashboardDebugInfo, setDashboardDebugInfo] = useState<any>({});

  // Badge: derive unread test assignments from deduped list so it matches the bell
  const unreadTestsBadge = useMemo(
    () =>
      (displayNotifications || []).filter(
        (n: any) => !n.is_read && (n.type || '').toLowerCase() === 'test_assignment'
      ).length,
    [displayNotifications]
  );

  // Badge: derive unread messages (optional)
  const unreadMessagesBadge = useMemo(
    () =>
      (displayNotifications || []).filter(
        (n: any) => !n.is_read && (n.type || '').toLowerCase().includes('message')
      ).length,
    [displayNotifications]
  );

  const freshLoadParams = useMemo(() => {
    if (locationState?.isFreshGitHubSetup && locationState?.freshGitHubInstallationId) {
      const handle = contextDeveloperProfile?.github_handle || locationState.freshGitHubHandle;
      if (handle) { return { handle, installId: locationState.freshGitHubInstallationId }; }
    }
    return null;
  }, [locationState?.isFreshGitHubSetup, locationState?.freshGitHubInstallationId, locationState?.freshGitHubHandle, contextDeveloperProfile?.github_handle]);

  const {
    gitHubData: freshGitHubDataFromHook, loading: freshGitHubLoading, error: freshGitHubError
  } = useFreshGitHubDataOnce({ handle: freshLoadParams?.handle, installationId: freshLoadParams?.installId });

  const {
    gitHubData: standardGitHubData, loading: standardGitHubLoading, error: standardGitHubError
  } = useGitHub();

  const shouldUseFreshDataSource = !!freshLoadParams;

  let finalGitHubDataToShow = standardGitHubData;
  let gitHubDataLoadingToShow = standardGitHubLoading;
  let gitHubDataErrorToShow = standardGitHubError;

  if (latchedSuccessfullyFetchedFreshData) {
    finalGitHubDataToShow = latchedSuccessfullyFetchedFreshData;
    gitHubDataLoadingToShow = false;
    gitHubDataErrorToShow = null;
  } else if (shouldUseFreshDataSource) {
    finalGitHubDataToShow = freshGitHubDataFromHook;
    gitHubDataLoadingToShow = freshGitHubLoading;
    gitHubDataErrorToShow = freshGitHubError;
  }

  // CRITICAL DEBUG: Enhanced developer data fetching with comprehensive debugging
  const fetchDeveloperPageData = useCallback(async () => {
    if (!authUser?.id) {
      console.log('🔍 [DASHBOARD] No user ID available for data fetch');
      setDashboardPageLoading(false);
      setIsLoadingEndorsements(false);
      setEndorsementError("User not logged in.");
      return;
    }

    setDashboardPageLoading(true);
    console.log('🚀 [DASHBOARD] ===== STARTING COMPREHENSIVE DATA FETCH =====');
    console.log('🔍 [DASHBOARD] User ID:', authUser.id);
    console.log('🔍 [DASHBOARD] Auth User Metadata:', {
      keys: Object.keys(authUser.user_metadata || {}),
      bio: authUser.user_metadata?.bio,
      location: authUser.user_metadata?.location,
      login: authUser.user_metadata?.login,
      github_installation_id: authUser.user_metadata?.github_installation_id,
      installation_id: authUser.user_metadata?.installation_id
    });
    
    try {
      // ENHANCED: Fetch developer data with more comprehensive query
      console.log('📋 [DASHBOARD] Fetching developer profile from database...');
      const { data: devData, error: devError } = await supabase
        .from('developers')
        .select(`
          *,
          user:users(name, email, created_at)
        `)
        .eq('user_id', authUser.id)
        .single();

      if (devError && devError.code !== 'PGRST116') {
        console.error('❌ [DASHBOARD] Error fetching developer data:', devError);
        // Don't throw here, continue with context data
      } else if (devData) {
        console.log('✅ [DASHBOARD] Developer data fetched from database:', {
          id: devData.id,
          github_handle: `"${devData.github_handle}"`,
          github_handle_length: devData.github_handle?.length || 0,
          bio: `"${devData.bio}"`,
          bio_length: devData.bio?.length || 0,
          location: `"${devData.location}"`,
          location_length: devData.location?.length || 0,
          installation_id: devData.github_installation_id ? 'present' : 'missing',
          profile_strength: devData.profile_strength,
          created_at: devData.created_at,
          updated_at: devData.updated_at
        });
        setDeveloperData(devData as Developer);
      } else {
        console.log('🔍 [DASHBOARD] No developer data found in database, using context data');
        setDeveloperData(null);
      }

      // Fetch portfolio items
      console.log('🎨 [DASHBOARD] Fetching portfolio items...');
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio_items')
        .select('*')
        .eq('developer_id', authUser.id)
        .order('created_at', { ascending: false });
      
      if (portfolioError) {
        console.error('❌ [DASHBOARD] Error fetching portfolio items:', portfolioError);
      } else {
        console.log('✅ [DASHBOARD] Portfolio items fetched:', portfolioData?.length || 0, 'items');
        setPortfolioItems(portfolioData || []);
      }

      // Fetch endorsements
      console.log('⭐ [DASHBOARD] Fetching endorsements...');
      setIsLoadingEndorsements(true);
      setEndorsementError(null);
      
      const fetchedEndorsements = await fetchEndorsementsForDeveloper(authUser.id, false);
      if (fetchedEndorsements) {
        setEndorsements(fetchedEndorsements);
        console.log('✅ [DASHBOARD] Endorsements fetched:', fetchedEndorsements.length, 'items');
      } else {
        console.warn('⚠️ [DASHBOARD] Failed to fetch endorsements');
        setEndorsementError("Failed to load endorsements.");
      }
      setIsLoadingEndorsements(false);

    } catch (error) {
      console.error('💥 [DASHBOARD] Critical error in fetchDeveloperPageData:', error);
      setIsLoadingEndorsements(false);
      setEndorsementError("An unexpected error occurred while loading endorsements.");
    } finally {
      setDashboardPageLoading(false);
      console.log('🏁 [DASHBOARD] ===== FINISHED DATA FETCH =====');
    }
  }, [authUser?.id]);

  // Toggle endorsement visibility
  const handleToggleEndorsementVisibility = useCallback(async (endorsementId: string, currentIsPublic: boolean) => {
    setIsLoadingEndorsements(true);
    setEndorsementError(null);
    const success = await updateEndorsementVisibility(endorsementId, !currentIsPublic);
    if (success) {
      setEndorsements(prev => prev.map(e =>
        e.id === endorsementId ? { ...e, is_public: !currentIsPublic } : e
      ));
      console.log(`Endorsement ${endorsementId} visibility toggled to ${!currentIsPublic}`);
    } else {
      setEndorsementError("Failed to update endorsement visibility.");
      console.error(`Failed to toggle visibility for endorsement ${endorsementId}`);
    }
    setIsLoadingEndorsements(false);
  }, []);

  // CRITICAL DEBUG: Enhanced effect to handle both auth loading and user changes
  useEffect(() => {
    console.log('🔄 [DASHBOARD] Auth state changed:', {
      authContextLoading,
      hasAuthUser: !!authUser?.id,
      userId: authUser?.id,
      timestamp: new Date().toISOString()
    });

    if (authContextLoading) {
      console.log('⏳ [DASHBOARD] Auth context still loading...');
      return;
    }

    if (!authUser?.id) {
      console.log('❌ [DASHBOARD] No authenticated user found');
      setDashboardPageLoading(false);
      setIsLoadingEndorsements(false);
      setEndorsementError("Not authenticated to load endorsements.");
      return;
    }

    console.log('👤 [DASHBOARD] User authenticated, fetching data for:', authUser.id);
    fetchDeveloperPageData();
  }, [authUser, authContextLoading, fetchDeveloperPageData]);

  // Clear notifications when accessing relevant tabs
  useEffect(() => {
    if (userProfile?.id && activeTab) {
      console.log('🔄 [DASHBOARD] Clearing notifications for tab:', activeTab);
      if (activeTab === 'tests') {
        markAsReadByType('test_assignment');
      } else if (activeTab === 'messages') {
        // Message notifications are cleared when the specific thread opens
      } else if (activeTab === 'jobs') {
        markAsReadByType('job_application');
        markAsReadByType('application_viewed'); 
        markAsReadByType('hired');
      }
    }
  }, [activeTab, userProfile, markAsReadByType]);

  // GitHub recent commits derivation
  useEffect(() => {
    if (finalGitHubDataToShow) {
      console.log('[DASHBOARD] Processing GitHub data:', finalGitHubDataToShow);
      if (finalGitHubDataToShow.recentCommits && Array.isArray(finalGitHubDataToShow.recentCommits)) {
        const formattedCommits = finalGitHubDataToShow.recentCommits.slice(0, 3).map((commit: any) => ({
          sha: commit.sha || Math.random().toString(36).substring(7),
          message: commit.message || 'Commit message unavailable',
          repoName: commit.repoName || 'Unknown Repo',
          date: commit.date || new Date().toISOString(),
          url: commit.url || '#',
        }));
        setRecentCommits(formattedCommits);
        console.log('[DASHBOARD] Set recent commits:', formattedCommits);
      } else if (finalGitHubDataToShow.contributions?.recentActivity && Array.isArray(finalGitHubDataToShow.contributions.recentActivity)) {
        const commitActivities = finalGitHubDataToShow.contributions.recentActivity
          .filter((activity: any) => activity.type === 'commit')
          .slice(0, 3)
          .map((activity: any) => ({
            sha: activity.sha || Math.random().toString(36).substring(7),
            message: `${activity.commitCount || 1} commits`,
            repoName: activity.repository || 'Unknown Repo',
            date: activity.occurredAt || new Date().toISOString(),
            url: '#',
          }));
        setRecentCommits(commitActivities);
        console.log('[DASHBOARD] Set commits from recentActivity:', commitActivities);
      } else if (finalGitHubDataToShow.contributions && Array.isArray(finalGitHubDataToShow.contributions)) {
        const formattedCommits = finalGitHubDataToShow.contributions.slice(0, 3).map((contrib: any) => ({
          sha: contrib.oid || contrib.id || Math.random().toString(36).substring(7),
          message: contrib.messageHeadline || contrib.message || 'Commit message unavailable',
          repoName: contrib.repository?.nameWithOwner || contrib.repo?.name || 'Unknown Repo',
          date: contrib.occurredAt || contrib.created_at || new Date().toISOString(),
          url: contrib.commitUrl || contrib.url || '#',
        }));
        setRecentCommits(formattedCommits);
        console.log('[DASHBOARD] Set commits from legacy contributions:', formattedCommits);
      } else {
        console.log('[DASHBOARD] No recent commits data found');
        setRecentCommits([]);
      }
    }
  }, [finalGitHubDataToShow]);

  // NEW: Calculate calendar year contributions for YTD display
  useEffect(() => {
    if (finalGitHubDataToShow) {
      const ytdContributions = calculateCalendarYearContributions(finalGitHubDataToShow);
      setCalendarYearContributions(ytdContributions);
      console.log('[DASHBOARD] Calendar year (YTD) contributions calculated:', ytdContributions);
    }
  }, [finalGitHubDataToShow]);

  // FIXED: Annual contributions processing - sync ROLLING YEAR total to database
  useEffect(() => {
    if (finalGitHubDataToShow && developerData?.id) {
      let totalContributions = 0;
      console.log('[DASHBOARD] Processing GitHub data for annual contributions (rolling year for DB sync):', {
        hasContributions: !!finalGitHubDataToShow.contributions,
        contributionsType: typeof finalGitHubDataToShow.contributions,
        hasCalendar: !!finalGitHubDataToShow.contributions?.calendar,
        hasTotalContributions: !!finalGitHubDataToShow.contributions?.totalContributions,
        currentAnnualContributions: developerData?.annual_contributions
      });
      
      // CRITICAL FIX: Proper contribution calculation logic
      if (finalGitHubDataToShow.contributions?.totalContributions && typeof finalGitHubDataToShow.contributions.totalContributions === 'number') {
        totalContributions = finalGitHubDataToShow.contributions.totalContributions;
      } else if (finalGitHubDataToShow.contributions?.calendar && Array.isArray(finalGitHubDataToShow.contributions.calendar)) {
        totalContributions = finalGitHubDataToShow.contributions.calendar.reduce(
          (sum: number, day: any) => sum + (day.contributionCount || day.count || 0), 0
        );
      } else if (Array.isArray(finalGitHubDataToShow.contributions)) {
        totalContributions = finalGitHubDataToShow.contributions.reduce(
          (sum: number, day: any) => sum + (day.contributionCount || day.count || 0), 0
        );
      }
      
      if (totalContributions >= 0 && totalContributions !== (developerData.annual_contributions || 0)) {
        setDeveloperData(prev => prev ? { ...prev, annual_contributions: totalContributions } : prev);
        const updateAnnualContributions = async () => {
          try {
            const { error } = await supabase
              .from('developers')
              .update({ 
                annual_contributions: totalContributions,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', developerData.user_id || authUser?.id);
            if (error) console.error('[DASHBOARD] Failed to update annual_contributions in database:', error);
          } catch (updateError) {
            console.error('[DASHBOARD] Error updating annual_contributions:', updateError);
          }
        };
        updateAnnualContributions();
      }
    }
  }, [finalGitHubDataToShow, developerData?.id, developerData?.annual_contributions, authUser?.id]);

  // CRITICAL DEBUG: Enhanced developer profile merging with REAL-TIME AUTH DATA INJECTION and comprehensive debugging
  const currentDeveloperProfile = useMemo(() => {
    console.log('🔄 [DASHBOARD PROFILE] ===== COMPUTING CURRENT DEVELOPER PROFILE =====');
    console.log('🔍 [DASHBOARD PROFILE] Input data sources:', {
      hasContextProfile: !!contextDeveloperProfile,
      hasDeveloperData: !!developerData,
      hasAuthUser: !!authUser,
      contextProfile: contextDeveloperProfile ? {
        github_handle: `"${contextDeveloperProfile.github_handle}"`,
        bio: `"${contextDeveloperProfile.bio}"`,
        location: `"${contextDeveloperProfile.location}"`,
        bio_length: contextDeveloperProfile.bio?.length || 0,
        location_length: contextDeveloperProfile.location?.length || 0
      } : 'none',
      developerData: developerData ? {
        github_handle: `"${developerData.github_handle}"`,
        bio: `"${developerData.bio}"`,
        location: `"${developerData.location}"`,
        bio_length: developerData.bio?.length || 0,
        location_length: developerData.location?.length || 0
      } : 'none',
      authUserMetadata: {
        login: authUser?.user_metadata?.login,
        bio: `"${authUser?.user_metadata?.bio || ''}"`,
        location: `"${authUser?.user_metadata?.location || ''}"`,
        bio_length: authUser?.user_metadata?.bio?.length || 0,
        location_length: authUser?.user_metadata?.location?.length || 0,
        github_installation_id: authUser?.user_metadata?.github_installation_id ? 'present' : 'missing',
        installation_id: authUser?.user_metadata?.installation_id ? 'present' : 'missing'
      }
    });

    // CRITICAL FIX: Always prioritize contextDeveloperProfile as it has the most up-to-date data
    let profile = contextDeveloperProfile || developerData;
    
    if (!profile && authUser?.id) {
      console.log('🔧 [DASHBOARD PROFILE] Creating minimal profile from auth user');
      // Create a minimal profile if none exists
      profile = {
        user_id: authUser.id,
        github_handle: '',
        bio: '',
        location: '',
        availability: true,
        profile_strength: 10,
        // Add other required fields with defaults
        linked_projects: [],
        experience_years: 0,
        desired_salary: 0,
        skills: [],
        skills_categories: {},
        public_profile_slug: '',
        notification_preferences: {
          email: true,
          in_app: true,
          messages: true,
          assignments: true
        }
      } as Developer;
    }

    if (!profile) {
      console.log('❌ [DASHBOARD PROFILE] No profile data available');
      return null;
    }

    // CRITICAL DEBUG: Log pre-merge state
    console.log('🔍 [DASHBOARD PROFILE] Profile before merging:', {
      github_handle: `"${profile.github_handle}"`,
      bio: `"${profile.bio}"`,
      location: `"${profile.location}"`,
      bio_length: profile.bio?.length || 0,
      location_length: profile.location?.length || 0,
      installation_id: profile.github_installation_id ? 'present' : 'missing'
    });

    // CRITICAL FIX: AGGRESSIVE merging with auth user metadata to fill empty fields
    const mergedProfile = {
      ...profile,
      // CRITICAL: Always inject fresh auth data when database fields are empty or missing
      github_handle: profile.github_handle || authUser?.user_metadata?.login || authUser?.user_metadata?.user_name || authUser?.user_metadata?.preferred_username || '',
      bio: profile.bio || authUser?.user_metadata?.bio || '',
      location: profile.location || authUser?.user_metadata?.location || '',
      profile_pic_url: profile.profile_pic_url || authUser?.user_metadata?.avatar_url || '',
      github_installation_id: profile.github_installation_id || authUser?.user_metadata?.github_installation_id || authUser?.user_metadata?.installation_id || '',
      
      // Merge user data if needed
      user: profile.user || (authUser ? {
        name: authUser.user_metadata?.name || authUser.user_metadata?.full_name || authUser.email,
        email: authUser.email,
        id: authUser.id
      } : undefined)
    };
    
    console.log('✅ [DASHBOARD PROFILE] Final merged profile created:', {
      github_handle: `"${mergedProfile.github_handle}"`,
      github_handle_length: mergedProfile.github_handle?.length || 0,
      bio: `"${mergedProfile.bio}"`,
      bio_length: mergedProfile.bio?.length || 0,
      location: `"${mergedProfile.location}"`,
      location_length: mergedProfile.location?.length || 0,
      installation_id: mergedProfile.github_installation_id ? 'present' : 'missing',
      profile_pic_url: mergedProfile.profile_pic_url ? 'present' : 'missing',
      source: contextDeveloperProfile ? 'context+auth' : developerData ? 'database+auth' : 'auth_only',
      timestamp: new Date().toISOString()
    });

    // CRITICAL DEBUG: Update debug info
    setDashboardDebugInfo({
      timestamp: new Date().toISOString(),
      profileSource: contextDeveloperProfile ? 'context+auth' : developerData ? 'database+auth' : 'auth_only',
      mergedProfileData: {
        github_handle: mergedProfile.github_handle,
        bio_length: mergedProfile.bio?.length || 0,
        location_length: mergedProfile.location?.length || 0,
        installation_id: mergedProfile.github_installation_id ? 'present' : 'missing'
      }
    });
    
    console.log('🏁 [DASHBOARD PROFILE] ===== PROFILE COMPUTATION COMPLETE =====');
    return mergedProfile;
  }, [contextDeveloperProfile, developerData, authUser]);

  // CRITICAL DEBUG: Force refresh profile form when auth context changes
  useEffect(() => {
    if (authUser?.id && contextDeveloperProfile) {
      console.log('🔄 [DASHBOARD] Auth context updated, forcing profile form refresh');
      console.log('🔍 [DASHBOARD] Context profile data:', {
        github_handle: contextDeveloperProfile.github_handle,
        bio_length: contextDeveloperProfile.bio?.length || 0,
        location_length: contextDeveloperProfile.location?.length || 0
      });
      setProfileFormKey(prev => {
        const newKey = prev + 1;
        console.log('🔑 [DASHBOARD] Profile form key updated from', prev, 'to', newKey);
        return newKey;
      });
    }
  }, [authUser, contextDeveloperProfile]);

  // CRITICAL DEBUG: Force refresh when switching to profile tab
  useEffect(() => {
    if (activeTab === 'profile' && currentDeveloperProfile) {
      console.log('🔄 [DASHBOARD] Profile tab activated, forcing form refresh');
      console.log('🔍 [DASHBOARD] Current profile data for form:', {
        github_handle: currentDeveloperProfile.github_handle,
        bio_length: currentDeveloperProfile.bio?.length || 0,
        location_length: currentDeveloperProfile.location?.length || 0
      });
      setProfileFormKey(prev => {
        const newKey = prev + 1;
        console.log('🔑 [DASHBOARD] Profile form key updated for tab switch from', prev, 'to', newKey);
        return newKey;
      });
    }
  }, [activeTab, currentDeveloperProfile]);

  const renderOverview = () => {
    if (!currentDeveloperProfile) {
      return <div className="p-6 text-center">Loading developer profile...</div>;
    }
    return (
      <OverviewTab
        developer={currentDeveloperProfile}
        portfolioItems={portfolioItems}
        messages={[]}
        savedJobsCountOverride={null}
        appliedJobsCountOverride={null}
        savedJobs={[]}
        appliedJobs={[]}
        endorsements={endorsements}
        endorsementsLoading={isLoadingEndorsements}
        endorsementsError={endorsementError}
        recentCommits={recentCommits}
        githubProfileUrl={currentDeveloperProfile.github_handle ? `https://github.com/${currentDeveloperProfile.github_handle}` : undefined}
        loading={dashboardPageLoading || authContextLoading || gitHubDataLoadingToShow}
        onNavigateToTab={(tab) => navigate(`/developer?tab=${tab}`)}
        calendarYearContributions={calendarYearContributions}
      />
    );
  };

  // ENHANCED: Handle profile form success with comprehensive refresh and debugging
  const handleProfileFormSuccess = useCallback(async () => {
    console.log('🎉 [DASHBOARD] ===== PROFILE FORM SUCCESS - STARTING REFRESH =====');
    
    try {
      // Refresh auth context first
      if (refreshProfile) {
        console.log('🔄 [DASHBOARD] Refreshing auth profile...');
        await refreshProfile();
        console.log('✅ [DASHBOARD] Auth profile refresh completed');
      }
      
      // Then refresh local data
      console.log('🔄 [DASHBOARD] Refreshing dashboard data...');
      await fetchDeveloperPageData();
      console.log('✅ [DASHBOARD] Dashboard data refresh completed');
      
      // Force refresh the profile form with a delay to ensure data propagation
      setTimeout(() => {
        console.log('🔄 [DASHBOARD] Force refreshing profile form component');
        setProfileFormKey(prev => {
          const newKey = prev + 1;
          console.log('🔑 [DASHBOARD] Profile form key updated after success from', prev, 'to', newKey);
          return newKey;
        });
      }, 500);
      
      console.log('✅ [DASHBOARD] Profile refresh completed successfully');
    } catch (error) {
      console.error('💥 [DASHBOARD] Error during profile refresh:', error);
    }

    console.log('🏁 [DASHBOARD] ===== PROFILE FORM SUCCESS REFRESH COMPLETE =====');
  }, [refreshProfile, fetchDeveloperPageData]);

  if (authContextLoading || (!authUser && !authContextLoading && !dashboardPageLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader className="animate-spin h-10 w-10 text-blue-500" />
        <p className="ml-3 text-gray-600">Loading user authentication...</p>
      </div>
    );
  }
  if (dashboardPageLoading && !authContextLoading && authUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <Loader className="animate-spin h-10 w-10 text-blue-500" />
        <p className="ml-3 text-gray-600">Loading your dashboard data...</p>
      </div>
    );
  }
  if (!userProfile && !authContextLoading && !dashboardPageLoading) {
    console.warn("User authenticated but no profile found. Redirecting to setup.");
    navigate('/onboarding', { replace: true });
    return null;
  }

  const displayDeveloperProfileForForm = currentDeveloperProfile;

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-screen-xl mx-auto">
      {showGitHubConnectModal && currentDeveloperProfile?.github_handle && (
        <GitHubConnectPrompt
          githubHandle={currentDeveloperProfile.github_handle}
          onClose={() => setShowGitHubConnectModal(false)}
          onConnect={() => navigate('/github-setup')}
        />
      )}

      {/* CRITICAL DEBUG: Dashboard Debug Information */}
      {process.env.NODE_ENV === 'development' && activeTab === 'profile' && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-sm">
          <details>
            <summary className="font-medium text-yellow-800 cursor-pointer">🔍 Dashboard Debug Info (Click to expand)</summary>
            <div className="mt-2 text-yellow-600 space-y-1">
              <p><strong>Dashboard Timestamp:</strong> {dashboardDebugInfo.timestamp || 'Not set'}</p>
              <p><strong>Profile Source:</strong> {dashboardDebugInfo.profileSource || 'Unknown'}</p>
              <p><strong>Profile Form Key:</strong> {profileFormKey}</p>
              <p><strong>Auth Context Loading:</strong> {authContextLoading ? 'Yes' : 'No'}</p>
              <p><strong>Dashboard Loading:</strong> {dashboardPageLoading ? 'Yes' : 'No'}</p>
              <p><strong>Has Context Profile:</strong> {contextDeveloperProfile ? 'Yes' : 'No'}</p>
              <p><strong>Has Developer Data:</strong> {developerData ? 'Yes' : 'No'}</p>
              <p><strong>Current Profile Data:</strong> {currentDeveloperProfile ? 'Yes' : 'No'}</p>
              {currentDeveloperProfile && (
                <div className="mt-2 p-2 bg-white rounded border">
                  <p><strong>GitHub Handle:</strong> "{currentDeveloperProfile.github_handle}"</p>
                  <p><strong>Bio Length:</strong> {currentDeveloperProfile.bio?.length || 0}</p>
                  <p><strong>Location Length:</strong> {currentDeveloperProfile.location?.length || 0}</p>
                  <p><strong>Installation ID:</strong> {currentDeveloperProfile.github_installation_id ? 'Present' : 'Missing'}</p>
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      <div className="mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto" aria-label="Tabs">
          {validTabs.map((tabName) => (
            <button
              key={tabName}
              onClick={() => navigate(`/developer?tab=${tabName}`)}
              className={`whitespace-nowrap py-4 px-1 sm:px-3 border-b-2 font-bold text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 ${
                activeTab === tabName ? 'border-blue-600 text-blue-700 bg-gray-100' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tabName.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              {tabName === 'tests' && unreadTestsBadge > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadTestsBadge}
                </span>
              )}
              {tabName === 'messages' && unreadMessagesBadge > 0 && (
                <span className="ml-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadMessagesBadge}
                </span>
