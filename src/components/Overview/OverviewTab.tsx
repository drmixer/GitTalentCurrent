import React, { useState } from 'react'; // <--- ADDED useState
import { Developer, PortfolioItem, MessageThreadType, JobRole, Endorsement, User as UserType } from '../../types';
import { User, Briefcase, MessageSquare, GitCommit, Award, CheckSquare, TrendingUp, Link as LinkIcon, HardDrive, Users, FileText, Star, Package } from 'lucide-react';
import { SnapshotCard } from './SnapshotCard';
import { FeaturedProject } from './FeaturedProject';
import { RecentGitHubActivity } from './RecentGitHubActivity';
import { LatestEndorsements } from './LatestEndorsements';
import { ProfileStrengthIndicator } from '../Profile/ProfileStrengthIndicator';
import { useNavigate } from 'react-router-dom';
import { InviteEndorsementsModal } from './InviteEndorsementsModal'; // <--- ADDED MODAL IMPORT


// Define a simple type for a commit for now. This should ideally come from your GitHub data types.
interface Commit {
  sha: string;
  message: string;
  repoName: string;
  date: string;
  url: string;
}

interface OverviewTabProps {
  developer: Developer | null;
  portfolioItems: PortfolioItem[];
  messages: MessageThreadType[]; // Used for unread messages count
  // savedJobs and appliedJobs props might be removed if only counts are needed and they come from developer object or overrides
  // For now, keeping them, but they might be empty arrays from DeveloperDashboard
  savedJobs: JobRole[];
  appliedJobs: JobRole[];
  savedJobsCountOverride?: number | null;
  appliedJobsCountOverride?: number | null;
  endorsements: Endorsement[];
  recentCommits?: Commit[];
  githubProfileUrl?: string;
  loading?: boolean;
  onNavigateToTab?: (tabName: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  developer,
  portfolioItems,
  messages,
  savedJobs,
  appliedJobs,
  savedJobsCountOverride,
  appliedJobsCountOverride,
  endorsements,
  recentCommits,
  githubProfileUrl,
  loading,
  onNavigateToTab,
}) => {
  const navigate = useNavigate();
  // State to control modal visibility
  const [showInviteEndorsementsModal, setShowInviteEndorsementsModal] = useState(false); // <--- ADDED STATE

  if (loading) {
    // A more sophisticated loading skeleton could be implemented here
    return <div className="p-6 text-center text-gray-500">Loading overview data...</div>;
  }

  if (!developer) {
    return <div className="p-6 text-center text-red-500">Developer data not available. Please try again later.</div>;
  }

  const featuredProject = portfolioItems.find(item => item.featured);
  // Ensure last_message_sender_id and developer.user_id are valid before comparison
  const unreadMessagesCount = messages.filter(thread =>
    thread.messages && thread.messages.length > 0 &&
    !thread.messages[thread.messages.length -1].is_read &&
    thread.messages[thread.messages.length -1].sender_id !== developer.user_id
  ).length;


  const portfolioCount = portfolioItems.length;
  // Use optional chaining and nullish coalescing for safety
  const endorsementsCount = developer.endorsements_count ?? endorsements.length;
  const commitsYTD = developer.annual_contributions ?? 0;

  // Use override if available, then developer object, then length of passed array (which might be empty)
  // The props 'savedJobsCountOverride', 'appliedJobsCountOverride', 'savedJobs', 'appliedJobs'
  // are destructured in the function signature, so we use them directly.
  const savedJobsCount = savedJobsCountOverride ?? developer.saved_jobs_count ?? savedJobs.length;
  const appliedJobsCount = appliedJobsCountOverride ?? developer.applied_jobs_count ?? appliedJobs.length;

  const handleNavigation = (tab: string) => {
    if (onNavigateToTab) {
      onNavigateToTab(tab);
    } else {
      // Fallback if the callback is not provided, though it should be
      navigate(`/developer?tab=${tab}`);
    }
  };

  // Developer's name, handling cases where user object might be missing
  const developerName = developer.user?.name || 'Developer';
  const developerFirstName = developerName.split(' ')[0];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="bg-white shadow sm:rounded-lg p-6 border border-gray-200/80">
        <div className="flex flex-col sm:flex-row items-start sm:items-center sm:space-x-4">
          <img
            className="h-20 w-20 rounded-full object-cover mb-3 sm:mb-0 border-2 border-gray-100"
            src={developer.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(developerName)}&background=random&color=fff&font-size=0.33`}
            alt={`${developerName}'s avatar`}
          />
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Welcome back, {developerFirstName}!</h1>
            <p className="text-gray-600">Here's a snapshot of your GitTalent activity.</p>
            {developer.public_profile_slug && developer.public_profile_enabled && (
              <a
                href={`https://gittalent.dev/u/${developer.public_profile_slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 text-sm text-blue-600 hover:text-blue-800 hover:underline flex items-center group"
              >
                View Public Profile <LinkIcon size={14} className="ml-1.5 group-hover:translate-x-0.5 transition-transform" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Snapshot Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
        <SnapshotCard
          title="Portfolio Items"
          value={portfolioCount}
          icon={Package}
          iconColor="text-indigo-600" bgColor="bg-indigo-50"
          action={{ label: "Manage", onClick: () => handleNavigation('portfolio') }}
        />
        <SnapshotCard
          title="Endorsements"
          value={endorsementsCount}
          icon={Star}
          iconColor="text-amber-600" bgColor="bg-amber-50"
          // action={{ label: "View", onClick: () => {} }} // TODO: Link to endorsements section if one exists
        />
        <SnapshotCard
          title="Commits (YTD)"
          value={commitsYTD}
          icon={GitCommit}
          iconColor="text-emerald-600" bgColor="bg-emerald-50"
          action={{ label: "View GitHub", onClick: () => handleNavigation('github-activity') }}
        />
        <SnapshotCard
          title="Unread Messages"
          value={unreadMessagesCount}
          icon={MessageSquare}
          iconColor="text-sky-600" bgColor="bg-sky-50"
          action={{ label: "Inbox", onClick: () => handleNavigation('messages') }}
        />
        <SnapshotCard
          title="Jobs (Saved/Applied)"
          value={`${savedJobsCount} / ${appliedJobsCount}`}
          icon={Briefcase}
          iconColor="text-rose-600" bgColor="bg-rose-50"
          action={{ label: "View Jobs", onClick: () => handleNavigation('jobs') }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Featured Project & Recent GitHub Activity */}
        <div className="lg:col-span-2 space-y-6">
          <FeaturedProject project={featuredProject} />
          <RecentGitHubActivity
            commits={recentCommits}
            loading={loading} // Pass down loading state if activity is fetched separately
            githubProfileUrl={githubProfileUrl}
          />
        </div>

        {/* Right Column: Latest Endorsements & CTAs */}
        <div className="lg:col-span-1 space-y-6">
          <LatestEndorsements endorsements={endorsements} loading={loading} />

          <div className="bg-white shadow rounded-lg p-6 border border-gray-200/80">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">Profile Status</h3>
            <div className="mb-4">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>Profile Strength</span>
                <span className="font-semibold text-blue-600">{developer.profile_strength || 0}%</span>
              </div>
              <ProfileStrengthIndicator strength={developer.profile_strength || 0} />
            </div>
            <button
              onClick={() => handleNavigation('profile')}
              className="w-full text-sm bg-blue-600 hover:bg-blue-700 text-white py-2.5 px-4 rounded-md transition-colors duration-150 font-medium flex items-center justify-center"
            >
              <User size={16} className="mr-2"/> Complete Your Profile
            </button>
            {/* TODO: Implement endorsement invitation functionality */}
            <button
              onClick={() => setShowInviteEndorsementsModal(true)} // <--- UPDATED onClick HANDLER
              className="mt-3 w-full text-sm bg-green-500 hover:bg-green-600 text-white py-2.5 px-4 rounded-md transition-colors duration-150 font-medium flex items-center justify-center"
            >
              <Users size={16} className="mr-2"/> Invite Endorsements
            </button>
          </div>
        </div>
      </div>

      {/* RENDER THE MODAL CONDITIONALLY */}
      <InviteEndorsementsModal // <--- ADDED MODAL RENDERING
        isOpen={showInviteEndorsementsModal}
        onClose={() => setShowInviteEndorsementsModal(false)}
        developer={developer} // Pass the developer object to the modal
      />
    </div>
  );
};
