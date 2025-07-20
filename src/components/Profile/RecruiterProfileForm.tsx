import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../hooks/useAuth';
import { User } from '../../types';

export const RecruiterProfileForm: React.FC = () => {
  const { user, userProfile, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const [profilePicFile, setProfilePicFile] = useState<File | null>(null);
  const [companyLogoFile, setCompanyLogoFile] = useState<File | null>(null);

  const [profilePicPreview, setProfilePicPreview] = useState<string | null>(null);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null);

  useEffect(() => {
    console.log('RecruiterProfileForm useEffect userProfile:', userProfile);
    if (userProfile?.profile_pic_url) {
      setProfilePicPreview(userProfile.profile_pic_url);
    }
    if (userProfile?.company_logo_url) {
      setCompanyLogoPreview(userProfile.company_logo_url);
    }
  }, [userProfile]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fileType: 'profilePic' | 'companyLogo') => {
    const file = e.target.files?.[0];
    if (file) {
      const previewUrl = URL.createObjectURL(file);
      if (fileType === 'profilePic') {
        setProfilePicFile(file);
        setProfilePicPreview(previewUrl);
      } else {
        setCompanyLogoFile(file);
        setCompanyLogoPreview(previewUrl);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    if (!user) {
      setError('You must be logged in to update your profile.');
      setLoading(false);
      return;
    }

    let profilePicUrl = userProfile?.profile_pic_url;
    let companyLogoUrl = userProfile?.company_logo_url;

    try {
      console.log('user.id:', user.id);
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.error('Error getting session:', sessionError);
      } else {
        console.log('auth.uid():', session?.user?.id);
      }

      if (profilePicFile) {
        const filePath = `${user.id}/${profilePicFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('profile-pics')
          .upload(filePath, profilePicFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('profile-pics')
          .getPublicUrl(filePath);

        profilePicUrl = publicUrlData.publicUrl;
        setProfilePicPreview(profilePicUrl);
      }

      if (companyLogoFile) {
        const filePath = `${user.id}/${companyLogoFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from('company-logos')
          .upload(filePath, companyLogoFile, {
            cacheControl: '3600',
            upsert: true,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('company-logos')
          .getPublicUrl(filePath);

        companyLogoUrl = publicUrlData.publicUrl;
        setCompanyLogoPreview(companyLogoUrl);
      }

      const { error: rpcError } = await supabase.rpc('update_user_profile', {
        user_id: user.id,
        profile_pic_url: profilePicUrl,
        company_logo_url: companyLogoUrl,
      });

      if (rpcError) throw rpcError;

      setSuccess('Profile updated successfully!');
      console.log('Profile updated successfully, calling refreshProfile');
      if(refreshProfile) {
        await refreshProfile();
      }
      console.log('refreshProfile called');
    } catch (err: any) {
      setError(err.message || 'An error occurred while updating your profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h2 className="text-xl font-black text-gray-900 mb-6">Edit Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="flex items-center space-x-6">
          <div className="shrink-0">
            {profilePicPreview ? (
              <img key={profilePicPreview} className="h-20 w-20 object-cover rounded-full" src={profilePicPreview} alt="Profile preview" />
            ) : (
              <div className="h-20 w-20 bg-gray-200 rounded-full flex items-center justify-center text-gray-500">
                <span>Pic</span>
              </div>
            )}
          </div>
          <label className="block">
            <span className="sr-only">Choose profile photo</span>
            <input
              type="file"
              onChange={(e) => handleFileChange(e, 'profilePic')}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </label>
        </div>

        <div className="flex items-center space-x-6">
          <div className="shrink-0">
            {companyLogoPreview ? (
              <img key={companyLogoPreview} className="h-20 w-20 object-contain" src={companyLogoPreview} alt="Company logo preview" />
            ) : (
              <div className="h-20 w-20 bg-gray-200 flex items-center justify-center text-gray-500">
                <span>Logo</span>
              </div>
            )}
          </div>
          <label className="block">
            <span className="sr-only">Choose company logo</span>
            <input
              type="file"
              onChange={(e) => handleFileChange(e, 'companyLogo')}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </label>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:bg-gray-400"
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
