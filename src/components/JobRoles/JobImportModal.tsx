import React, { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { 
  X, 
  Upload, 
  FileText, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  Download,
  Info
} from 'lucide-react';
import Papa from 'papaparse';
import { JobRole } from '../../types';

interface JobImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface CSVJobData {
  title: string;
  description: string;
  location: string;
  job_type: string;
  tech_stack: string;
  salary_min: string | number;
  salary_max: string | number;
  experience_required: string;
  is_active: string | boolean;
}

export const JobImportModal: React.FC<JobImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess
}) => {
  const { createJobRole } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<CSVJobData[]>([]);
  const [validationErrors, setValidationErrors] = useState<{[key: number]: string[]}>({});
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importStats, setImportStats] = useState({ total: 0, success: 0, failed: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFile(null);
    setParsedData([]);
    setValidationErrors({});
    setError('');
    setSuccess('');
    setImportStats({ total: 0, success: 0, failed: 0 });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setSuccess('');
    setValidationErrors({});
    setParsedData([]);
    
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    if (selectedFile.type !== 'text/csv' && !selectedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      return;
    }
    
    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    setLoading(true);
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setLoading(false);
        
        if (results.errors.length > 0) {
          setError(`CSV parsing error: ${results.errors[0].message}`);
          return;
        }
        
        const data = results.data as CSVJobData[];
        
        if (data.length === 0) {
          setError('The CSV file is empty');
          return;
        }
        
        // Validate required headers
        const requiredHeaders = ['title', 'description', 'location', 'job_type', 'tech_stack', 'salary_min', 'salary_max'];
        const missingHeaders = requiredHeaders.filter(header => 
          !results.meta.fields?.includes(header)
        );
        
        if (missingHeaders.length > 0) {
          setError(`Missing required columns: ${missingHeaders.join(', ')}`);
          return;
        }
        
        // Validate each row
        const errors: {[key: number]: string[]} = {};
        data.forEach((row, index) => {
          const rowErrors: string[] = [];
          
          if (!row.title) rowErrors.push('Title is required');
          if (!row.description) rowErrors.push('Description is required');
          if (!row.location) rowErrors.push('Location is required');
          
          if (!row.job_type) {
            rowErrors.push('Job type is required');
          } else if (!['Full-time', 'Part-time', 'Contract', 'Freelance'].includes(row.job_type)) {
            rowErrors.push('Job type must be one of: Full-time, Part-time, Contract, Freelance');
          }
          
          if (!row.salary_min) {
            rowErrors.push('Minimum salary is required');
          } else if (isNaN(Number(row.salary_min))) {
            rowErrors.push('Minimum salary must be a number');
          }
          
          if (!row.salary_max) {
            rowErrors.push('Maximum salary is required');
          } else if (isNaN(Number(row.salary_max))) {
            rowErrors.push('Maximum salary must be a number');
          } else if (Number(row.salary_min) > Number(row.salary_max)) {
            rowErrors.push('Minimum salary cannot be greater than maximum salary');
          }
          
          if (rowErrors.length > 0) {
            errors[index] = rowErrors;
          }
        });
        
        setValidationErrors(errors);
        setParsedData(data);
        
        if (Object.keys(errors).length > 0) {
          setError(`Found validation errors in ${Object.keys(errors).length} rows`);
        } else {
          setSuccess(`Successfully parsed ${data.length} job postings. Ready to import.`);
        }
      },
      error: (error) => {
        setLoading(false);
        setError(`Error parsing CSV: ${error.message}`);
      }
    });
  };

  const handleImport = async () => {
    if (Object.keys(validationErrors).length > 0) {
      setError('Please fix validation errors before importing');
      return;
    }
    
    if (parsedData.length === 0) {
      setError('No data to import');
      return;
    }
    
    setImporting(true);
    setError('');
    setSuccess('');
    
    const stats = { total: parsedData.length, success: 0, failed: 0 };
    
    for (let i = 0; i < parsedData.length; i++) {
      const row = parsedData[i];
      
      try {
        // Convert CSV data to JobRole format
        const jobData: Partial<JobRole> = {
          title: row.title,
          description: row.description,
          location: row.location,
          job_type: row.job_type as 'Full-time' | 'Part-time' | 'Contract' | 'Freelance',
          tech_stack: row.tech_stack.split(',').map(tech => tech.trim()),
          salary_min: Number(row.salary_min),
          salary_max: Number(row.salary_max),
          experience_required: row.experience_required || '',
          is_active: typeof row.is_active === 'string' 
            ? row.is_active.toLowerCase() === 'true'
            : Boolean(row.is_active)
        };
        
        const result = await createJobRole(jobData);
        
        if (result) {
          stats.success++;
        } else {
          stats.failed++;
        }
      } catch (error) {
        console.error('Error importing job:', error);
        stats.failed++;
      }
    }
    
    setImportStats(stats);
    
    if (stats.failed === 0) {
      setSuccess(`Successfully imported all ${stats.total} job postings!`);
    } else {
      setError(`Imported ${stats.success} out of ${stats.total} job postings. ${stats.failed} failed.`);
    }
    
    setImporting(false);
    
    if (stats.success > 0 && onSuccess) {
      setTimeout(() => {
        onSuccess();
      }, 2000);
    }
  };

  const downloadSampleCSV = () => {
    const sampleData = [
      {
        title: 'Senior Frontend Developer',
        description: 'Looking for a React expert to join our product team.',
        location: 'Remote',
        job_type: 'Full-time',
        tech_stack: 'React, TypeScript, Tailwind',
        salary_min: 100000,
        salary_max: 130000,
        experience_required: '3+ years with React',
        is_active: true
      },
      {
        title: 'Backend Engineer',
        description: 'Join our team to build scalable APIs and microservices.',
        location: 'New York, NY',
        job_type: 'Full-time',
        tech_stack: 'Node.js, Express, PostgreSQL',
        salary_min: 110000,
        salary_max: 140000,
        experience_required: '2+ years with Node.js',
        is_active: true
      }
    ];
    
    const csv = Papa.unparse(sampleData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_jobs.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black text-gray-900">Import Jobs from CSV</h2>
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

        {/* CSV Format Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 mb-6">
          <div className="flex items-start">
            <Info className="h-5 w-5 text-blue-500 mr-3 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-blue-800 mb-2">CSV Format Requirements</h3>
              <p className="text-sm text-blue-700 mb-2">
                Your CSV file should include the following columns:
              </p>
              <ul className="text-xs text-blue-700 list-disc pl-5 mb-2 space-y-1">
                <li><span className="font-semibold">title</span> - Job title (required)</li>
                <li><span className="font-semibold">description</span> - Job description (required)</li>
                <li><span className="font-semibold">location</span> - Job location (required)</li>
                <li><span className="font-semibold">job_type</span> - One of: Full-time, Part-time, Contract, Freelance (required)</li>
                <li><span className="font-semibold">tech_stack</span> - Comma-separated list of technologies (required)</li>
                <li><span className="font-semibold">salary_min</span> - Minimum salary in USD (required)</li>
                <li><span className="font-semibold">salary_max</span> - Maximum salary in USD (required)</li>
                <li><span className="font-semibold">experience_required</span> - Experience requirements (optional)</li>
                <li><span className="font-semibold">is_active</span> - true or false (optional, defaults to true)</li>
              </ul>
              <button
                onClick={downloadSampleCSV}
                className="text-xs flex items-center font-medium text-blue-600 hover:text-blue-800"
              >
                <Download className="w-3 h-3 mr-1" />
                Download Sample CSV
              </button>
            </div>
          </div>
        </div>

        {/* File Upload */}
        <div className="mb-6">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
              ref={fileInputRef}
              disabled={importing}
            />
            
            {!file ? (
              <div>
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-4">Drag and drop your CSV file here, or click to browse</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Select CSV File
                </button>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-center mb-4">
                  <FileText className="w-8 h-8 text-blue-500 mr-3" />
                  <span className="text-lg font-semibold text-gray-900">{file.name}</span>
                </div>
                
                {loading ? (
                  <div className="flex items-center justify-center">
                    <Loader className="animate-spin h-5 w-5 text-blue-600 mr-2" />
                    <span className="text-gray-600">Parsing CSV...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center space-x-4">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={importing}
                      className="px-4 py-2 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Change File
                    </button>
                    <button
                      onClick={resetForm}
                      disabled={importing}
                      className="px-4 py-2 text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Parsed Data Preview */}
        {parsedData.length > 0 && !loading && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-gray-900 mb-3">Preview ({parsedData.length} jobs)</h3>
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Location</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Job Type</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Salary Range</th>
                      <th className="px-4 py-3 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {parsedData.slice(0, 5).map((job, index) => (
                      <tr key={index} className={validationErrors[index] ? 'bg-red-50' : ''}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {job.title || <span className="text-red-500">Missing</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {job.location || <span className="text-red-500">Missing</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          {job.job_type || <span className="text-red-500">Missing</span>}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                          ${job.salary_min || 0} - ${job.salary_max || 0}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {validationErrors[index] ? (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                              Error
                            </span>
                          ) : (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Valid
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {parsedData.length > 5 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-3 text-sm text-gray-500 text-center">
                          ... and {parsedData.length - 5} more jobs
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            
            {/* Validation Errors */}
            {Object.keys(validationErrors).length > 0 && (
              <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-4">
                <h4 className="text-sm font-bold text-red-800 mb-2">Validation Errors</h4>
                <div className="max-h-40 overflow-y-auto">
                  {Object.entries(validationErrors).map(([rowIndex, errors]) => (
                    <div key={rowIndex} className="mb-2 last:mb-0">
                      <p className="text-sm font-semibold text-red-700">Row {parseInt(rowIndex) + 1} ({parsedData[parseInt(rowIndex)]?.title || 'Unnamed job'}):</p>
                      <ul className="list-disc pl-5">
                        {errors.map((error, i) => (
                          <li key={i} className="text-xs text-red-600">{error}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Import Stats */}
        {importStats.total > 0 && (
          <div className="mb-6 bg-gray-50 rounded-xl p-4">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Import Results</h3>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-gray-900">{importStats.total}</div>
                <div className="text-xs text-gray-600">Total Jobs</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-600">{importStats.success}</div>
                <div className="text-xs text-gray-600">Successfully Imported</div>
              </div>
              <div>
                <div className="text-lg font-bold text-red-600">{importStats.failed}</div>
                <div className="text-xs text-gray-600">Failed to Import</div>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4 pt-4">
          <button
            onClick={() => {
              onClose();
              resetForm();
            }}
            className="px-6 py-3 text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors font-semibold"
          >
            Cancel
          </button>
          
          <button
            onClick={handleImport}
            disabled={parsedData.length === 0 || Object.keys(validationErrors).length > 0 || importing || loading}
            className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transition-all duration-300"
          >
            {importing ? (
              <div className="flex items-center">
                <Loader className="animate-spin rounded-full h-5 w-5 mr-3" />
                Importing Jobs...
              </div>
            ) : (
              <div className="flex items-center">
                <Upload className="w-5 h-5 mr-3" />
                Import {parsedData.length} Jobs
              </div>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};