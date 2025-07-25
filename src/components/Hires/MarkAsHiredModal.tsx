// src/components/Hires/MarkAsHiredModal.tsx

import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../lib/supabase';
import { 
  X, 
  Calendar, 
  DollarSign, 
  FileText,
  CheckCircle,
  AlertCircle,
  Loader,
  FileCheck,
  Info
} from 'lucide-react';
import { SavedCandidate } from '../../types';

interface MarkAsHiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: SavedCandidate;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export const MarkAsHiredModal: React.FC<MarkAsHiredModalProps> = ({
  isOpen,
  onClose,
  assignment,
  onSuccess,
  onCancel
}) => {
  const { createHire, userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAgreement, setShowAgreement] = useState(false);
  const [agreementAccepted, setAgreementAccepted] = useState(false);

  const [formData, setFormData] = useState({
    salary: 0,
    hire_date: new Date().toISOString().split('T')[0],
    start_date: '',
    notes: ''
  });

  const resetForm = () => {
    setFormData({
      salary: 0,
      hire_date: new Date().toISOString().split('T')[0],
      start_date: '',
      notes: ''
    });
    setError('');
    setSuccess('');
    setShowAgreement(false);
    setAgreementAccepted(false);
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseInt(value) || 0 : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      if (!formData.salary || formData.salary <= 0) {
        throw new Error('Salary must be greater than 0');
      }
      if (!formData.hire_date) {
        throw new Error('Hire date is required');
      }
      setShowAgreement(true);
    } catch (error: any) {
      setError(error.message || 'Failed to validate hire data');
    } finally {
        setLoading(false);
    }
  };

  const completeHireProcess = async () => {
    if (!agreementAccepted) {
      setError('You must accept the confirmation to proceed');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const hireData = {
        assignment_id: assignment.id,
        salary: formData.salary,
        hire_date: formData.hire_date,
        start_date: formData.start_date || null,
        notes: formData.notes.trim() || ''
      };

      const result = await createHire(hireData);

      if (result) {
        const { error: updateError } = await supabase
          .from('assignments')
          .update({ status: 'Hired' })
          .eq('id', assignment.id);
          
        if (updateError) {
          console.error('Error updating assignment status:', updateError);
        }
        
        setSuccess('Hire recorded successfully!');
        setTimeout(() => {
          onSuccess?.();
          onClose();
          resetForm();
        }, 1500);
      } else {
        throw new Error('Failed to record hire');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to record hire');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md mx-auto flex flex-col max-h-[90vh] shadow-xl">
        
        <div className="flex-shrink-0 p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black text-gray-900">Mark as Hired</h2>
            <button
              onClick={() => {
                onClose();
                resetForm();
              }}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex-grow p-6 overflow-y-auto">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-400 mr-3" />
                <p className="text-sm font-medium text-red-800">{error}</p>
              </div>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border border-green-200 rounded-2xl p-4 mb-6">
              <div className="flex items-center">
                <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                <p className="text-sm font-medium text-green-800">{success}</p>
              </div>
            </div>
          )}

          <div className="bg-gray-50 rounded-xl p-4 mb-6 border border-gray-200">
            <h3 className="font-bold text-gray-900 mb-2">Assignment Details</h3>
            <div className="text-sm text-gray-600 space-y-1">
              <div><strong>Developer:</strong> {assignment.developer.user.name}</div>
              <div><strong>Job:</strong> {assignment.job_role.title}</div>
              <div><strong>Company:</strong> {assignment.recruiter.user.company_name}</div>
            </div>
          </div>

          {!showAgreement ? (
            <form id="hire-form" onSubmit={handleSubmit} className="space-y-6">
              {/* Form fields (salary, dates, notes) */}
              <div>
                <label htmlFor="salary" className="block text-sm font-bold text-gray-700 mb-2">
                  Annual Salary (USD) *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="salary"
                    name="salary"
                    type="number"
                    min="1"
                    required
                    className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                    placeholder="120000"
                    value={formData.salary || ''}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="hire_date" className="block text-sm font-bold text-gray-700 mb-2">
                  Hire Date *
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="hire_date"
                    name="hire_date"
                    type="date"
                    required
                    className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                    value={formData.hire_date}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="start_date" className="block text-sm font-bold text-gray-700 mb-2">
                  Start Date (Optional)
                </label>
                <div className="relative">
                  <Calendar className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    id="start_date"
                    name="start_date"
                    type="date"
                    className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium"
                    value={formData.start_date}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-bold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <div className="relative">
                  <FileText className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                  <textarea
                    id="notes"
                    name="notes"
                    rows={4}
                    className="appearance-none relative block w-full pl-12 pr-4 py-4 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-2xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-medium resize-none"
                    placeholder="Additional notes about the hire..."
                    value={formData.notes}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </form>
          ) : (
            <div className="space-y-6">
              {/* MODIFIED: Info box text changed */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
                <div className="flex items-start">
                  <Info className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
                  <div>
                    <p className="text-sm text-blue-800 font-medium">
                      Please review the details below before confirming this hire.
                    </p>
                  </div>
                </div>
              </div>

              <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
                {/* MODIFIED: Title changed */}
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                  <FileCheck className="w-5 h-5 mr-2 text-blue-600" />
                  Confirm Hire Details
                </h3>
                
                <div className="space-y-4 text-sm text-gray-700">
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <p className="font-semibold mb-2">Summary:</p>
                    <ol className="list-decimal pl-5 space-y-2">
                      {/* MODIFIED: Fee-related list items removed */}
                      <li>The recruiter confirms they have hired {assignment.developer.user.name} for the position of {assignment.job_role.title}.</li>
                      <li>The annual salary for this position is ${formData.salary.toLocaleString()} USD.</li>
                      <li>The hire date is recorded as {new Date(formData.hire_date + 'T00:00:00').toLocaleDateString()}.</li>
                    </ol>
                  </div>
                  
                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <p>By accepting, you confirm that all information provided is accurate.</p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={agreementAccepted}
                      onChange={(e) => setAgreementAccepted(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    {/* MODIFIED: Checkbox label changed */}
                    <span className="ml-2 text-sm text-gray-700">
                      I confirm the details above are correct
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-shrink-0 p-6 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          {!showAgreement ? (
            <div className="flex items-center justify-end space-x-4">
              <button
                type="button"
                onClick={() => { onCancel?.(); onClose(); resetForm(); }}
                className="px-6 py-3 text-gray-600 border border-gray-300 bg-white rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="hire-form"
                disabled={loading}
                className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center min-w-[140px]"
              >
                {loading ? <Loader className="animate-spin h-5 w-5" /> : 'Continue'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-end space-x-4">
              <button
                type="button"
                onClick={() => setShowAgreement(false)}
                className="px-6 py-3 text-gray-600 border border-gray-300 bg-white rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Back
              </button>
              <button
                onClick={completeHireProcess}
                disabled={!agreementAccepted || loading}
                className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center min-w-[160px]"
              >
                {loading ? <Loader className="animate-spin h-5 w-5" /> : 'Confirm Hire'}
              </button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
