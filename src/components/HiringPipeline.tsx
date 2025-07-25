import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { User, JobRole, AppliedJob, Developer } from '../types';
import { Eye, MessageSquare, ChevronDown, MoreVertical, Trash2, CheckSquare, Edit, FileText, Loader, AlertCircle } from 'lucide-react';

interface SavedCandidate extends AppliedJob {
    developer: Developer & { user: User }; // Refined to reflect nested user object
    job_role: JobRole;
}

// Define props for KanbanView to accept the new onViewDeveloperProfile callback
interface KanbanViewProps {
    candidates: SavedCandidate[];
    onUpdateStage: (id: string, stage: string, candidate: SavedCandidate) => void; // MODIFIED: Added candidate for 'hired' logic
    onViewDeveloperProfile: (developer: SavedCandidate['developer']) => void; // Added for eye icon
}

const STAGES = ['applied', 'viewed', 'contacted', 'interviewing', 'offer', 'hired', 'rejected'];

const KanbanView: React.FC<KanbanViewProps> = ({ candidates, onUpdateStage, onViewDeveloperProfile }) => {
    // This is a simplified version. A real implementation would use a drag and drop library.
    const handleDrop = (e: React.DragEvent<HTMLDivElement>, stage: string) => {
        e.preventDefault();
        const candidateId = e.dataTransfer.getData("candidateId");
        const candidate = candidates.find(c => c.id === candidateId);
        if (candidate) {
            onUpdateStage(candidateId, stage, candidate); // Pass candidate object
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, candidateId: string) => {
        e.dataTransfer.setData("candidateId", candidateId);
    };

    return (
        <div className="flex space-x-4 overflow-x-auto pb-4">
            {STAGES.map(stage => (
                <div key={stage} className="min-w-[250px] bg-gray-100 p-3 rounded-lg flex-shrink-0" onDrop={(e) => handleDrop(e, stage)} onDragOver={handleDragOver}>
                    <h2 className="font-bold mb-3 capitalize text-gray-700">{stage}</h2>
                    {candidates.filter(c => c.status === stage).map(c => (
                        <div key={c.id} draggable onDragStart={(e) => handleDragStart(e, c.id)} className="p-3 bg-white rounded-lg shadow-sm mb-3 cursor-grab border border-gray-200">
                            <p className="font-semibold text-gray-900">{c.developer.user?.name || c.developer.github_handle || 'Unknown Developer'}</p>
                            <p className="text-sm text-gray-500">{c.job_role.title}</p>
                            <div className="flex justify-end mt-2 space-x-1">
                                {/* Updated Eye icon onClick */}
                                <button
                                    onClick={() => onViewDeveloperProfile(c.developer)}
                                    className="p-1 hover:bg-gray-50 rounded-full text-gray-500"
                                    title="View Profile"
                                >
                                    <Eye size={16} />
                                </button>
                                <button className="p-1 hover:bg-gray-50 rounded-full text-gray-500"><MessageSquare size={16} /></button>
                            </div>
                        </div>
                    ))}
                    {candidates.filter(c => c.status === stage).length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-4">No candidates in this stage.</p>
                    )}
                </div>
            ))}
        </div>
    );
};

// Define props for HiringPipeline to accept the new onViewDeveloperProfile callback
interface HiringPipelineProps {
    onViewDeveloperProfile: (developer: SavedCandidate['developer']) => void;
    // ADDED: onInitiateHire prop
    onInitiateHire: (candidate: SavedCandidate, jobRole: JobRole) => void;
}

const HiringPipeline: React.FC<HiringPipelineProps> = ({ onViewDeveloperProfile, onInitiateHire }) => { // Deconstruct new prop
    const { user, userProfile } = useAuth();
    const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [view, setView] = useState('list'); // 'list' or 'kanban'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [notes, setNotes] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (userProfile?.id) {
            fetchData();
        }
    }, [userProfile]); // Dependency on userProfile to refetch when it loads

    const fetchData = async () => {
        setLoading(true);
        setError('');
        try {
            // First fetch job roles (full data, not just ID, for onInitiateHire)
            const { data: jobRolesData, error: jobRolesError } = await supabase
                .from('job_roles')
                .select('*') // MODIFIED: Fetch full job role data
                .eq('recruiter_id', userProfile?.id);

            if (jobRolesError) throw jobRolesError;
            setJobRoles(jobRolesData || []);

            const jobIds = jobRolesData?.map(j => j.id) || [];

            if (jobIds.length === 0) {
                setCandidates([]); // No jobs, no candidates
                setLoading(false);
                return;
            }

            // Then fetch candidates using the fetched job IDs
            const { data: candidatesData, error: candidatesError } = await supabase
                .from('applied_jobs')
                .select(`
                    id,
                    developer_id,
                    job_id,
                    applied_at,
                    status,
                    cover_letter,
                    notes,
                    developer:developers!applied_jobs_developer_id_fkey(
                        user_id,
                        github_handle,
                        bio,
                        availability,
                        top_languages,
                        linked_projects,
                        location,
                        experience_years,
                        desired_salary,
                        created_at,
                        updated_at,
                        skills_categories,
                        profile_strength,
                        public_profile_slug,
                        notification_preferences,
                        resume_url,
                        profile_pic_url,
                        github_installation_id,
                        public_profile_enabled,
                        profile_view_count,
                        search_appearance_count,
                        skills,
                        preferred_title,
                        looking_for_job,
                        user:users!developers_user_id_fkey(
                            id,
                            name,
                            email,
                            avatar_url,
                            profile_pic_url
                        )
                    ),
                    job_role:job_roles!applied_jobs_job_id_fkey(
                        id,
                        recruiter_id,
                        title,
                        description,
                        location,
                        job_type,
                        tech_stack,
                        experience_required,
                        is_active,
                        created_at,
                        updated_at,
                        is_featured,
                        salary
                    )
                `); // Removed the incorrect comment from here
            // Ensure the .in() clause is correctly applied.
            if (jobIds.length > 0) {
                const { data: filteredCandidates, error: filterError } = await supabase
                    .from('applied_jobs')
                    .select(`
                        id,
                        developer_id,
                        job_id,
                        applied_at,
                        status,
                        cover_letter,
                        notes,
                        developer:developers!applied_jobs_developer_id_fkey(
                            user_id,
                            github_handle,
                            bio,
                            availability,
                            top_languages,
                            linked_projects,
                            location,
                            experience_years,
                            desired_salary,
                            created_at,
                            updated_at,
                            skills_categories,
                            profile_strength,
                            public_profile_slug,
                            notification_preferences,
                            resume_url,
                            profile_pic_url,
                            github_installation_id,
                            public_profile_enabled,
                            profile_view_count,
                            search_appearance_count,
                            skills,
                            preferred_title,
                            looking_for_job,
                            user:users!developers_user_id_fkey(
                                id,
                                name,
                                email,
                                avatar_url,
                                profile_pic_url
                            )
                        ),
                        job_role:job_roles!applied_jobs_job_id_fkey(
                            id,
                            recruiter_id,
                            title,
                            description,
                            location,
                            job_type,
                            tech_stack,
                            experience_required,
                            is_active,
                            created_at,
                            updated_at,
                            is_featured,
                            salary
                        )
                    `)
                    .in('job_id', jobIds);
                
                if (filterError) throw filterError;
                setCandidates(filteredCandidates as SavedCandidate[] || []);

            } else {
                setCandidates([]); // No job IDs means no candidates to fetch
            }

        } catch (err: any) {
            setError('Failed to fetch pipeline data: ' + err.message);
            console.error("Error fetching pipeline data:", err);
        } finally {
            setLoading(false);
        }
    };


    // MODIFIED: handleUpdateStage to trigger modal for 'hired' status
    const handleUpdateStage = async (candidateId: string, stage: string, candidateToUpdate?: SavedCandidate) => {
        // Find the full candidate object if not passed directly (e.g., from List View)
        const candidate = candidateToUpdate || candidates.find(c => c.id === candidateId);
        if (!candidate) {
            setError('Candidate not found for update.');
            return;
        }

        if (stage === 'hired') {
            // If the new status is 'hired', trigger the hire modal flow
            // The modal and its confirmation will handle the actual DB update
            // and then refresh the pipeline.
            if (candidate.job_role && candidate.developer) { // Ensure both job_role and developer are present
                onInitiateHire(candidate, candidate.job_role);
            } else {
                setError("Cannot initiate hire: Job role or developer details missing for candidate.");
            }
        } else {
            // For any other status change, update directly in the database
            const { error } = await supabase.from('applied_jobs').update({ status: stage }).eq('id', candidateId);
            if (error) {
                setError('Failed to update stage: ' + error.message);
            } else {
                fetchData(); // Refresh all data to reflect the change
            }
        }
    };

    const handleBulkUpdateStage = async (stage: string) => {
        if (stage === 'hired') {
            setError("Bulk 'hired' status change is not supported. Please mark candidates as hired individually to provide details.");
            return;
        }

        const { error } = await supabase.from('applied_jobs').update({ status: stage }).in('id', selectedCandidates);
        if (error) {
            setError('Failed to bulk update stages: ' + error.message);
        } else {
            fetchData(); // Refresh
            setSelectedCandidates([]);
        }
    };

    const handleSelectCandidate = (id: string) => {
        setSelectedCandidates(prev => prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedCandidates(candidates.map(c => c.id));
        } else {
            setSelectedCandidates([]);
        }
    };

    const handleUpdateNotes = async (candidateId: string) => {
        const note = notes[candidateId];
        // In a real app, you'd probably have a dedicated notes table or field in applied_jobs
        // For now, we'll just log it. If 'notes' is a column in applied_jobs, update it here.
        console.log(`Saving note for ${candidateId}: ${note}`);
        // Example: await supabase.from('applied_jobs').update({ notes: note }).eq('id', candidateId);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader className="animate-spin h-8 w-8 text-blue-600 mr-3" />
                <span className="text-gray-600 font-medium">Loading pipeline data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-center">
                    <AlertCircle className="h-5 w-5 text-red-500 mr-3" />
                    <p className="text-red-700 font-medium">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900">Hiring Pipeline</h1>
                <div className="flex rounded-lg overflow-hidden border border-gray-300">
                    <button onClick={() => setView('list')} className={`px-4 py-2 text-sm font-medium ${view === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>List View</button>
                    <button onClick={() => setView('kanban')} className={`px-4 py-2 text-sm font-medium ${view === 'kanban' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}>Kanban Board</button>
                </div>
            </div>

            {selectedCandidates.length > 0 && (
                <div className="mb-4 p-4 bg-blue-50 rounded-lg flex items-center justify-between shadow-sm border border-blue-200">
                    <p className="text-blue-800 font-medium">{selectedCandidates.length} candidate(s) selected</p>
                    <div className="flex items-center space-x-3">
                        <select
                            onChange={(e) => handleBulkUpdateStage(e.target.value)}
                            value=""
                            className="p-2 border border-blue-300 rounded-md text-sm text-blue-700 bg-white focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="">Bulk Change Stage</option>
                            {/* Prevent 'hired' from being a bulk option */}
                            {STAGES.filter(s => s !== 'hired').map(s => <option key={`bulk-${s}`} value={s} className="capitalize">{s}</option>)}
                        </select>
                        <button className="px-3 py-2 border border-red-300 rounded-md text-sm text-red-700 bg-red-50 hover:bg-red-100 transition-colors flex items-center">
                            <Trash2 size={16} className="mr-1" /> Delete
                        </button>
                    </div>
                </div>
            )}

            {candidates.length === 0 && !loading ? (
                <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-gray-200">
                    <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Candidates Found</h3>
                    <p className="text-gray-600">Start by creating job roles or check your filter settings.</p>
                </div>
            ) : (
                view === 'list' ? (
                    <div className="bg-white shadow rounded-xl overflow-hidden border border-gray-200">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="p-3 w-8 text-left"><input type="checkbox" onChange={handleSelectAll} checked={selectedCandidates.length === candidates.length && candidates.length > 0} /></th>
                                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Applied Date</th>
                                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {candidates.map(c => (
                                    <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="p-3"><input type="checkbox" checked={selectedCandidates.includes(c.id)} onChange={() => handleSelectCandidate(c.id)} /></td>
                                        <td className="p-3">
                                            <div className="flex items-center space-x-3">
                                                <img
                                                    src={c.developer.user?.avatar_url || c.developer.user?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.developer.user?.name || c.developer.github_handle || 'U')}&background=random`}
                                                    alt={c.developer.user?.name || 'Unknown'}
                                                    className="h-8 w-8 rounded-full object-cover" // Added alt and styling for image
                                                />
                                                <span className="font-medium text-gray-900">{c.developer.user?.name || c.developer.github_handle || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-700">{c.job_role.title}</td>
                                        <td className="p-3 text-sm text-gray-500">{new Date(c.applied_at).toLocaleDateString()}</td>
                                        <td className="p-3">
                                            <select
                                                value={c.status}
                                                // MODIFIED: Pass the full candidate object to handleUpdateStage
                                                onChange={(e) => handleUpdateStage(c.id, e.target.value, c)}
                                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                {STAGES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-3">
                                            <input type="text" value={notes[c.id] || ''} onChange={e => setNotes(prev => ({...prev, [c.id]: e.target.value}))} onBlur={() => handleUpdateNotes(c.id)} placeholder="Add notes..." className="w-full border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                                        </td>
                                        <td className="p-3 flex items-center space-x-2">
                                            {/* Updated Eye icon onClick */}
                                            <button
                                                onClick={() => onViewDeveloperProfile(c.developer)}
                                                className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                                                title="View Profile"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Message Candidate"><MessageSquare size={18} /></button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <KanbanView candidates={candidates} onUpdateStage={handleUpdateStage} onViewDeveloperProfile={onViewDeveloperProfile} />
                )
            )}
        </div>
    );
};

export default HiringPipeline;
