import React, { useState, useEffect } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { User } from '../../types';

export const RecruiterProfileForm = () => {
  const { user, userProfile, loading: authLoading, refreshUserProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [profilePic, setProfilePic] = useState<File | null>(null);
  const [companyLogo, setCompanyLogo] = useState<File | null>(null);
  const [profilePicUrl, setProfilePicUrl] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');

  useEffect(() => {
    const fetchRecruiterProfile = async () => {
      if (userProfile) {
        const { data: recruiterData, error: recruiterError } = await supabase
          .from('recruiters')
          .select('company_name')
          .eq('user_id', userProfile.id)
          .single();
        if (recruiterData) {
          setCompanyName(recruiterData.company_name || '');
        }
        setProfilePicUrl(userProfile.profile_pic_url || '');
        setCompanyLogoUrl(userProfile.company_logo_url || '');
      }
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

      const { error: updateRecruiterError } = await supabase
        .from('recruiters')
        .update({ company_name: companyName })
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
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
