import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';

export const RecruiterProfileForm = () => {
  const { user, userProfile, loading: authLoading, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [companySize, setCompanySize] = useState('');
  const [industry, setIndustry] = useState('');

  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [companyLogo, setCompanyLogo] = useState<File | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');

  // Notification preferences (no "test_assignment" toggle for recruiters)
  const [notifInApp, setNotifInApp] = useState(true);
  const [notifEmail, setNotifEmail] = useState(false);
  const [notifTypes, setNotifTypes] = useState<{ [k: string]: boolean }>({
    message: true,
    job_application: true,
    test_completion: true
  });

  useEffect(() => {
    const fetchRecruiterProfile = async () => {
      if (!userProfile) return;

      const { data: recruiterData } = await supabase
        .from('recruiters')
        .select('company_name, website, company_size, industry, notification_preferences')
        .eq('user_id', userProfile.id)
        .maybeSingle();

      if (recruiterData) {
        setCompanyName(recruiterData.company_name || '');
        setWebsite(recruiterData.website || '');
        setCompanySize(recruiterData.company_size || '');
        setIndustry(recruiterData.industry || '');

        const np = recruiterData.notification_preferences || {};
        setNotifInApp(typeof np.in_app === 'boolean' ? np.in_app : true);
        setNotifEmail(typeof np.email === 'boolean' ? np.email : false);
        const nt = (np.types as any) || {};
        setNotifTypes({
          message: nt.message !== false,
          job_application: nt.job_application !== false,
          // test_assignment intentionally omitted for recruiters
          test_completion: nt.test_completion !== false
        });
      }

      setProfilePicUrl(userProfile.profile_pic_url || '');
      setCompanyLogoUrl(userProfile.company_logo_url || '');
    };

    fetchRecruiterProfile();
  }, [userProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess('');
    setError('');

    try {
      if (!user) throw new Error('You must be logged in to update your profile.');

      const uploadFile = async (file: File, bucket: string) => {
        const { data, error } = await supabase.storage
          .from(bucket)
          .upload(`${user.id}/${file.name}`, file, {
            cacheControl: '3600',
            upsert: true,
          });
        if (error) throw error;
        const { data: signedUrlData, error: signedUrlError } = await supabase.storage
          .from(bucket)
          .createSignedUrl(data.path, 60 * 60 * 24 * 365 * 10); // 10 years
        if (signedUrlError) throw signedUrlError;
        return signedUrlData.signedUrl;
      };

      const newProfilePicUrl = profilePic ? await uploadFile(profilePic, 'profile-pics') : profilePicUrl;
      const newCompanyLogoUrl = companyLogo ? await uploadFile(companyLogo, 'company-logos') : companyLogoUrl;

      const nextPrefs = {
        in_app: notifInApp,
        email: notifEmail,
        types: {
          message: !!notifTypes.message,
          job_application: !!notifTypes.job_application,
          // Do not persist test_assignment in recruiter prefs
          test_completion: !!notifTypes.test_completion,
        },
      };

      const { error: updateRecruiterError } = await supabase
        .from('recruiters')
        .update({
          company_name: companyName,
          website: website,
          company_size: companySize,
          industry: industry,
          notification_preferences: nextPrefs,
        })
        .eq('user_id', user.id);

      if (updateRecruiterError) throw updateRecruiterError;

      const { error: updateUserError } = await supabase
        .from('users')
        .update({
          profile_pic_url: newProfilePicUrl,
          company_logo_url: newCompanyLogoUrl,
        })
        .eq('id', user.id);

      if (updateUserError) throw updateUserError;

      setSuccess('Profile updated successfully!');
      await refreshUserProfile();
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-black text-gray-900">Edit Profile</h2>
      <form onSubmit={handleUpdateProfile} className="space-y-6">
        <div>
          <label htmlFor="companyName" className="block text-sm font-medium text-gray-700">
            Company Name
          </label>
          <input
            type="text"
            id="companyName"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="website" className="block text-sm font-medium text-gray-700">
            Website
          </label>
          <input
            type="text"
            id="website"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="companySize" className="block text-sm font-medium text-gray-700">
            Company Size
          </label>
          <input
            type="text"
            id="companySize"
            value={companySize}
            onChange={(e) => setCompanySize(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div>
          <label htmlFor="industry" className="block text-sm font-medium text-gray-700">
            Industry
          </label>
          <input
            type="text"
            id="industry"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
          />
        </div>

        <div className="mt-8 p-4 border rounded-xl">
          <h3 className="font-semibold mb-3">Notification settings</h3>
          <label className="flex items-center gap-2 mb-2">
            <input type="checkbox" checked={notifInApp} onChange={e => setNotifInApp(e.target.checked)} />
            In‑app notifications
          </label>
          <label className="flex items-center gap-2 mb-4">
            <input type="checkbox" checked={notifEmail} onChange={e => setNotifEmail(e.target.checked)} />
            Email notifications
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifTypes.message}
                onChange={e => setNotifTypes(s => ({ ...s, message: e.target.checked }))}
              />
              Messages
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifTypes.job_application}
                onChange={e => setNotifTypes(s => ({ ...s, job_application: e.target.checked }))}
              />
              Job applications
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={notifTypes.test_completion}
                onChange={e => setNotifTypes(s => ({ ...s, test_completion: e.target.checked }))}
              />
              Test completion
            </label>
          </div>
        </div>

        <div>
          <label htmlFor="profilePic" className="block text-sm font-medium text-gray-700">
            Profile Picture
          </label>
          <input
            type="file"
            id="profilePic"
            onChange={(e) => {
              const file = e.target.files ? e.target.files[0] : null;
              setProfilePic(file);
              if (file) {
                setProfilePicUrl(URL.createObjectURL(file));
              }
            }}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {profilePicUrl && <img src={profilePicUrl} alt="Profile" className="mt-2 h-24 w-24 rounded-full object-cover" />}
        </div>

        <div>
          <label htmlFor="companyLogo" className="block text-sm font-medium text-gray-700">
            Company Logo
          </label>
          <input
            type="file"
            id="companyLogo"
            onChange={(e) => {
              const file = e.target.files ? e.target.files[0] : null;
              setCompanyLogo(file);
              if (file) {
                setCompanyLogoUrl(URL.createObjectURL(file));
              }
            }}
            className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
          />
          {companyLogoUrl && <img src={companyLogoUrl} alt="Company Logo" className="mt-2 h-24 w-auto" />}
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none"
          >
            {loading ? 'Updating...' : 'Update Profile'}
          </button>
        </div>

        {success && <p className="text-green-600">{success}</p>}
        {error && <p className="text-red-600">{error}</p>}
      </form>
    </div>
  );
};
