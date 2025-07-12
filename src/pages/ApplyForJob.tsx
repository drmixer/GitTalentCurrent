import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { JobRole } from '../types';
import { ArrowLeft, Send, Loader, AlertCircle, MapPin, Building } from 'lucide-react';

export const ApplyForJob: React.FC = () => {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const { developerProfile } = useAuth();

  const [job, setJob] = useState<JobRole | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applicationSuccess, setApplicationSuccess] = useState(false);

  useEffect(() => {
    if (!jobId) {
      setError('Job ID is missing.');
      setLoading(false);
      return;
    }
    fetchJobDetails(jobId);
  }, [jobId]);

  const fetchJobDetails = async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: jobError } = await supabase
        .from('job_roles_with_details') // Using the view
        .select('*')
        .eq('id', id)
        .single();

      if (jobError) throw jobError;
      if (!data) throw new Error('Job not found.');

      setJob(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load job details.');
      console.error("Error fetching job details:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || !developerProfile?.user_id || !job) {
      setError('User or job information is missing.');
      return;
    }

    setApplying(true);
    setError(null);

    try {
      // Check if already applied
      const { data: existingApplication, error: checkError } = await supabase
        .from('applied_jobs')
        .select('id')
        .eq('developer_id', developerProfile.user_id)
        .eq('job_id', jobId)
        .maybeSingle();

      if (checkError) throw checkError;

      if (existingApplication) {
        setError('You have already applied for this job.');
        setApplying(false);
        setApplicationSuccess(true); // To show a similar message as if it was a new success
        return;
      }

      const { error: applyError } = await supabase
        .from('applied_jobs')
        .insert({
          developer_id: developerProfile.user_id,
          job_id: jobId,
          status: 'applied',
          cover_letter: coverLetter,
        });

      if (applyError) throw applyError;

      setApplicationSuccess(true);
      // Optionally, redirect after a delay or provide a link back
      setTimeout(() => navigate('/developer?tab=jobs'), 3000);

    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit application.');
      console.error("Error submitting application:", e);
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader className="animate-spin h-12 w-12 text-blue-600" />
      </div>
    );
  }

  if (error && !job && !applicationSuccess) { // Only show full page error if job details failed to load entirely
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Application Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link
            to="/dashboard/jobs"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  if (applicationSuccess) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <Send className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Application Submitted!</h1>
          <p className="text-gray-600 mb-6">
            {error ? error : `Your application for ${job?.title || 'the job'} has been successfully submitted.`}
          </p>
          <Link
            to="/dashboard/jobs"
            className="inline-flex items-center px-6 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-semibold"
          >
            Continue to Jobs
          </Link>
        </div>
      </div>
    );
  }


  if (!job) { // Handles case where job is null after loading and not due to an error that stopped rendering.
      return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
          <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-6" />
          <h1 className="text-2xl font-bold text-gray-800 mb-3">Job Not Found</h1>
          <p className="text-gray-600 mb-6">The job you are trying to apply for could not be found.</p>
          <Link
            to="/dashboard/jobs"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Jobs
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link
            to="/dashboard/jobs" // Or dynamically to the previous page if possible
            className="inline-flex items-center text-gray-600 hover:text-gray-800 transition-colors font-medium"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Back to Job Listings
          </Link>
        </div>

        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6 sm:p-8">
            <h1 className="text-3xl font-bold text-white mb-2">Apply for: {job.title}</h1>
            <div className="flex flex-wrap items-center text-blue-100 text-sm space-x-4">
              <span className="flex items-center"><Building className="w-4 h-4 mr-1.5" /> {job.company_name || 'N/A Company'}</span>
              <span className="flex items-center"><MapPin className="w-4 h-4 mr-1.5" /> {job.location}</span>
            </div>
          </div>

          <form onSubmit={handleSubmitApplication} className="p-6 sm:p-8 space-y-6">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg relative" role="alert">
                <strong className="font-bold">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            )}

            <div>
              <label htmlFor="coverLetter" className="block text-sm font-medium text-gray-700 mb-1">
                Cover Letter (Optional)
              </label>
              <textarea
                id="coverLetter"
                name="coverLetter"
                rows={8}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                placeholder="Write a brief message to the recruiter highlighting why you're a good fit for this role..."
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
              />
              <p className="mt-2 text-xs text-gray-500">
                Recruiters are more likely to consider applications with a personalized cover letter.
              </p>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={applying}
                className="w-full flex justify-center items-center px-6 py-3 border border-transparent rounded-xl shadow-sm text-base font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-300 transition-colors"
              >
                {applying ? (
                  <>
                    <Loader className="animate-spin h-5 w-5 mr-3" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="h-5 w-5 mr-2" />
                    Submit Application
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
