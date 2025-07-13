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
import { Assignment } from '../../types';

interface MarkAsHiredModalProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: Assignment;
  assignmentId?: string;
  onSuccess?: () => void;
  onHire?: () => void;
  onCancel?: () => void;
}

export const MarkAsHiredModal: React.FC<MarkAsHiredModalProps> = ({
  isOpen,
  onClose,
  assignment,
  assignmentId,
  onSuccess,
  onHire,
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
      // Validate form data
      if (formData.salary <= 0) {
        throw new Error('Salary must be greater than 0');
      }
      if (!formData.hire_date) {
        throw new Error('Hire date is required');
      }

      // Show the digital agreement before proceeding
      setShowAgreement(true);
      setLoading(false);
      return;
    } catch (error: any) {
      console.error('Error validating hire form:', error);
      setError(error.message || 'Failed to validate hire data');
      setLoading(false);
    }
  };

  const completeHireProcess = async () => {
    if (!agreementAccepted) {
      setError('You must accept the agreement to proceed');
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

      const result = await createHire?.(hireData);

      if (result) {
        // Also update the assignment status to "Hired"
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
          onHire?.();
          onClose();
          resetForm();
        }, 1500);
      } else {
        throw new Error('Failed to record hire');
      }
    } catch (error: any) {
      console.error('Error recording hire:', error);
      setError(error.message || 'Failed to record hire');
    } finally {
      setLoading(false);
    }
  };

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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-black text-gray-900">Mark as Hired</h2>
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

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

        {/* Assignment Info */}
        <div className="bg-gray-50 rounded-xl p-4 mb-6">
          <h3 className="font-bold text-gray-900 mb-2">Assignment Details</h3>
          <div className="text-sm text-gray-600">
            <div><strong>Developer:</strong> {assignment.developer?.name || 'Unknown'}</div>
            <div><strong>Job:</strong> {assignment.job_role?.title || 'Unknown'}</div>
          </div>
        </div>

        {!showAgreement ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Salary */}
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
                  value={formData.salary}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* Hire Date */}
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

            {/* Start Date */}
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

            {/* Notes */}
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

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  onCancel?.();
                  onClose();
                  resetForm();
                }}
                className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {loading ? (
                  <div className="flex items-center">
                    <Loader className="animate-spin rounded-full h-5 w-5 mr-3" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-3" />
                    Continue
                  </div>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
              <div className="flex items-start">
                <Info className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">
                    You're about to confirm a successful hire. This will trigger a 15% fee based on the annual salary.
                  </p>
                </div>
              </div>
            </div>

            {/* Digital Agreement */}
            <div className="border border-gray-200 rounded-xl p-6 bg-gray-50">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
                <FileCheck className="w-5 h-5 mr-2 text-blue-600" />
                Digital Hiring Agreement
              </h3>
              
              <div className="space-y-4 text-sm text-gray-700">
                <p>This agreement is made between:</p>
                <p><strong>Recruiter:</strong> {userProfile?.name} (representing {assignment.recruiter?.name})</p>
                <p><strong>Platform:</strong> GitTalent</p>
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p className="font-semibold mb-2">Terms:</p>
                  <ol className="list-decimal pl-5 space-y-2">
                    <li>The recruiter confirms they have hired {assignment.developer?.name} for the position of {assignment.job_role?.title}.</li>
                    <li>The annual salary for this position is ${formData.salary.toLocaleString()} USD.</li>
                    <li>The recruiter agrees to pay a one-time fee of ${Math.round(formData.salary * 0.15).toLocaleString()} USD (15% of annual salary).</li>
                    <li>This fee will be invoiced separately and is due within 30 days of this agreement.</li>
                    <li>The hire date is recorded as {new Date(formData.hire_date).toLocaleDateString()}.</li>
                  </ol>
                </div>
                
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <p>By accepting this agreement, you confirm that all information provided is accurate and you agree to the terms stated above.</p>
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
                  <span className="ml-2 text-sm text-gray-700">
                    I accept the terms of this agreement and confirm the hire
                  </span>
                </label>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowAgreement(false);
                }}
                className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
              >
                Back
              </button>
              <button
                onClick={completeHireProcess}
                disabled={!agreementAccepted || loading}
                className="px-8 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold rounded-xl hover:from-emerald-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {loading ? (
                  <div className="flex items-center">
                    <Loader className="animate-spin rounded-full h-5 w-5 mr-3" />
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckCircle className="w-5 h-5 mr-3" />
                    Confirm Hire
                  </div>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};