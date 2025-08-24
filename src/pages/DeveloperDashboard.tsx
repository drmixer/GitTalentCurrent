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
    developerProfile, // Use this as the single source of truth
    loading: authContextLoading,
    refreshProfile,
  } = useAuth();
  const { notifications: ctxNotifications, displayNotifications, markAsReadByType } = useNotifications();

  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as DashboardLocationState | null;

  const params = new URLSearchParams(location.search);
  const activeTab = validTabs.includes(params.get('tab') || '') ? params.get('tab') : 'overview';

  // REMOVED: const [developerData, setDeveloperData] = useState<Developer | null>(null);
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
      const handle = developerProfile?.github_handle || locationState.freshGitHubHandle;
      if (handle) { return { handle, installId: locationState.freshGitHubInstallationId }; }
    }
    return null;
  }, [locationState?.isFreshGitHubSetup, locationState?.freshGitHubInstallationId, locationState?.freshGitHubHandle, developerProfile?.github_handle]);

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

  // SIMPLIFIED: Fetch only non-profile data (portfolio, endorsements)
  const fetchDashboardData = useCallback(async () => {
    if (!authUser?.id) {
      console.log('🔍 [DASHBOARD] No user ID available for data fetch');
      setDashboardPageLoading(false);
      setIsLoadingEndorsements(false);
      setEndorsementError("User not logged in.");
      return;
    }

    setDashboardPageLoading(true);
    console.log('🚀 [DASHBOARD] ===== STARTING DASHBOARD DATA FETCH =====');
    console.log('🔍 [DASHBOARD] User ID:', authUser.id);
    
    try {
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
      console.error('💥 [DASHBOARD] Critical error in fetchDashboardData:', error);
      setIsLoadingEndorsements(false);
      setEndorsementError("An unexpected error occurred while loading endorsements.");
    } finally {
      setDashboardPageLoading(false);
      console.log('🏁 [DASHBOARD] ===== FINISHED DASHBOARD DATA FETCH =====');
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

  // SIMPLIFIED: Only fetch dashboard data (not profile data)
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

    console.log('👤 [DASHBOARD] User authenticated, fetching dashboard data for:', authUser.id);
    fetchDashboardData();
  }, [authUser, authContextLoading, fetchDashboardData]);

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
    if (finalGitHubDataToShow && developerProfile?.id) {
      let totalContributions = 0;
      console.log('[DASHBOARD] Processing GitHub data for annual contributions (rolling year for DB sync):', {
        hasContributions: !!finalGitHubDataToShow.contributions,
        contributionsType: typeof finalGitHubDataToShow.contributions,
        hasCalendar: !!finalGitHubDataToShow.contributions?.calendar,
        hasTotalContributions: !!finalGitHubDataToShow.contributions?.totalContributions,
        currentAnnualContributions: developerProfile?.annual_contributions
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
      
      if (totalContributions >= 0 && totalContributions !== (developerProfile.annual_contributions || 0)) {
        const updateAnnualContributions = async () => {
          try {
            const { error } = await supabase
              .from('developers')
              .update({ 
                annual_contributions: totalContributions,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', developerProfile.user_id || authUser?.id);
            if (error) console.error('[DASHBOARD] Failed to update annual_contributions in database:', error);
          } catch (updateError) {
            console.error('[DASHBOARD] Error updating annual_contributions:', updateError);
          }
        };
        updateAnnualContributions();
      }
    }
  }, [finalGitHubDataToShow, developerProfile?.id, developerProfile?.annual_contributions, authUser?.id]);

  // CRITICAL FIX: Force refresh profile form when developer profile changes
  useEffect(() => {
    if (authUser?.id && developerProfile) {
      console.log('🔄 [DASHBOARD] Developer profile updated, forcing profile form refresh');
      console.log('🔍 [DASHBOARD] Profile data:', {
        github_handle: developerProfile.github_handle,
        bio_length: developerProfile.bio?.length || 0,
        location_length: developerProfile.location?.length || 0
      });
      setProfileFormKey(prev => {
        const newKey = prev + 1;
        console.log('🔑 [DASHBOARD] Profile form key updated from', prev, 'to', newKey);
        return newKey;
      });
    }
  }, [authUser, developerProfile]);

  // CRITICAL FIX: Force refresh when switching to profile tab
  useEffect(() => {
    if (activeTab === 'profile' && developerProfile) {
      console.log('🔄 [DASHBOARD] Profile tab activated, forcing form refresh');
      console.log('🔍 [DASHBOARD] Profile data for form:', {
        github_handle: developerProfile.github_handle,
        bio_length: developerProfile.bio?.length || 0,
        location_length: developerProfile.location?.length || 0
      });
      setProfileFormKey(prev => {
        const newKey = prev + 1;
        console.log('🔑 [DASHBOARD] Profile form key updated for tab switch from', prev, 'to', newKey);
        return newKey;
      });
    }
  }, [activeTab, developerProfile]);

  const renderOverview = () => {
    if (!developerProfile) {
      return <div className="p-6 text-center">Loading developer profile...</div>;
    }
    return (
      <OverviewTab
        developer={developerProfile}
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
        githubProfileUrl={developerProfile.github_handle ? `https://github.com/${developerProfile.github_handle}` : undefined}
        loading={dashboardPageLoading || authContextLoading || gitHubDataLoadingToShow}
        onNavigateToTab={(tab) => navigate(`/developer?tab=${tab}`)}
        calendarYearContributions={calendarYearContributions}
      />
    );
  };

  // SIMPLIFIED: Handle profile form success with only auth context refresh
  const handleProfileFormSuccess = useCallback(async () => {
    console.log('🎉 [DASHBOARD] ===== PROFILE FORM SUCCESS - STARTING REFRESH =====');
    
    if (refreshProfile) {
      await refreshProfile();
      console.log('✅ [DASHBOARD] Auth profile refresh completed');
    }
    
    console.log('🏁 [DASHBOARD] ===== PROFILE FORM SUCCESS REFRESH COMPLETE =====');
  }, [refreshProfile]);

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

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-8 max-w-screen-xl mx-auto">
      {showGitHubConnectModal && developerProfile?.github_handle && (
        <GitHubConnectPrompt
          githubHandle={developerProfile.github_handle}
          onClose={() => setShowGitHubConnectModal(false)}
          onConnect={() => navigate('/github-setup')}
        />
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
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-8">
        {activeTab === 'overview' && renderOverview()}

        {activeTab === 'profile' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Developer Profile</h2>
            {developerProfile ? (
              <DeveloperProfileForm
                key={profileFormKey}
                developer={developerProfile}
                onSuccess={handleProfileFormSuccess}
              />
            ) : (
              <div className="text-center text-gray-500">
                <Loader className="animate-spin h-8 w-8 mx-auto mb-4" />
                Loading profile data...
              </div>
            )}
          </div>
        )}

        {activeTab === 'portfolio' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Portfolio</h2>
            {developerProfile ? (
              <PortfolioManager
                developerId={developerProfile.user_id}
                initialItems={portfolioItems}
                onItemsChange={setPortfolioItems}
              />
            ) : (
              <div className="text-center text-gray-500">Loading portfolio...</div>
            )}
          </div>
        )}

        {activeTab === 'github-activity' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center mb-6">
              <Github className="h-6 w-6 mr-3 text-gray-700" />
              <h2 className="text-2xl font-bold text-gray-900">GitHub Activity</h2>
            </div>
            {developerProfile?.github_handle ? (
              <div className="space-y-6">
                {finalGitHubDataToShow && !gitHubDataLoadingToShow && !gitHubDataErrorToShow ? (
                  <>
                    <RealGitHubChart gitHubData={finalGitHubDataToShow} />
                    <GitHubUserActivityDetails gitHubData={finalGitHubDataToShow} />
                  </>
                ) : gitHubDataLoadingToShow ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader className="animate-spin h-8 w-8 text-blue-500" />
                    <span className="ml-3 text-gray-600">Loading GitHub data...</span>
                  </div>
                ) : gitHubDataErrorToShow ? (
                  <div className="flex items-center justify-center py-12 text-red-600">
                    <AlertCircle className="h-6 w-6 mr-2" />
                    <span>Failed to load GitHub data: {gitHubDataErrorToShow}</span>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    No GitHub data available
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <Github className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">Connect your GitHub account to see your activity</p>
                <button
                  onClick={() => setShowGitHubConnectModal(true)}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Connect GitHub
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'messages' && (
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <MessageSquare className="h-6 w-6 mr-3 text-gray-700" />
                <h2 className="text-2xl font-bold text-gray-900">Messages</h2>
              </div>
            </div>
            <div className="flex h-96">
              <div className="w-1/3 border-r border-gray-200">
                <MessageList
                  userId={authUser?.id || ''}
                  onSelectThread={(threadDetails) => {
                    setSelectedMessageThreadDetails(threadDetails);
                  }}
                />
              </div>
              <div className="w-2/3">
                {selectedMessageThreadDetails ? (
                  <MessageThread
                    currentUserId={authUser?.id || ''}
                    otherUserId={selectedMessageThreadDetails.otherUserId}
                    otherUserName={selectedMessageThreadDetails.otherUserName}
                    otherUserRole={selectedMessageThreadDetails.otherUserRole}
                    otherUserProfilePicUrl={selectedMessageThreadDetails.otherUserProfilePicUrl}
                    jobContext={selectedMessageThreadDetails.jobContext}
                    onBack={() => setSelectedMessageThreadDetails(null)}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-500">
                    Select a conversation to start messaging
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'jobs' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Jobs</h2>
            {developerProfile ? (
              <JobsTab developerId={developerProfile.user_id} />
            ) : (
              <div className="text-center text-gray-500">Loading jobs data...</div>
            )}
          </div>
        )}

        {activeTab === 'endorsements' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Endorsements</h2>
            <EndorsementDisplay
              endorsements={endorsements}
              loading={isLoadingEndorsements}
              error={endorsementError}
              onToggleVisibility={handleToggleEndorsementVisibility}
              showVisibilityControls={true}
            />
          </div>
        )}

        {activeTab === 'tests' && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Skill Tests</h2>
            {developerProfile ? (
              <DeveloperTests developerId={developerProfile.user_id} />
            ) : (
              <div className="text-center text-gray-500">Loading tests data...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
