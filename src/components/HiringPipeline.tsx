// src/components/HiringPipeline.tsx

import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Developer, SavedCandidate } from '../types';
import { Eye, MessageSquare, Trash2, FileText, Loader, AlertCircle, Code, FileCheck, X } from 'lucide-react';
import SendTestModal from './Assignments/SendTestModal';
import TestResults from './Assignments/TestResults';

interface KanbanViewProps {
    candidates: SavedCandidate[];
    onUpdateStage: (id: string, stage: string, candidate: SavedCandidate) => void;
    onViewDeveloperProfile: (developer: Developer) => void;
    onSendMessage: (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => void;
    onSendTest: (developerId: string, jobId: string) => void;
    onViewResults: (assignmentId: string) => void;
}

const STAGES = ['New', 'Contacted', 'Shortlisted', 'Hired', 'Rejected'];

const KanbanView: React.FC<KanbanViewProps> = ({ candidates, onUpdateStage, onViewDeveloperProfile, onSendMessage, onSendTest, onViewResults }) => {
    const handleDrop = (e: React.DragEvent<HTMLDivElement>, stage: string) => {
        e.preventDefault();
        const candidateId = e.dataTransfer.getData("candidateId");
        const candidate = candidates.find(c => c.id === candidateId);
        if (candidate) {
            onUpdateStage(candidateId, stage, candidate);
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
                            <p className="font-semibold text-gray-900">{c.developer.user?.name || 'Unknown Developer'}</p>
                            <p className="text-sm text-gray-500">{c.job_role.title}</p>
                            <div className="flex justify-end mt-2 space-x-1">
                                <button
                                    onClick={() => onViewDeveloperProfile(c.developer)}
                                    className="p-1 hover:bg-gray-50 rounded-full text-gray-500"
                                    title="View Profile"
                                >
                                    <Eye size={16} />
                                </button>
                                <button
                                    onClick={() => onSendMessage(c.developer.user_id, c.developer.user.name || '', c.job_role.id, c.job_role.title)}
                                    className="p-1 hover:bg-gray-50 rounded-full text-gray-500"
                                    title="Send Message"
                                >
                                    <MessageSquare size={16} />
                                </button>
                                {c.status === 'Completed' ? (
                                     <button onClick={() => onViewResults(c.id)} className="p-1 hover:bg-gray-50 rounded-full text-gray-500" title="View Test Results">
                                        <FileCheck size={16} />
                                    </button>
                                ) : (
                                    <button onClick={() => onSendTest(c.developer.id, c.job_role.id)} className="p-1 hover:bg-gray-50 rounded-full text-gray-500" title="Send Test">
                                        <Code size={16} />
                                    </button>
                                )}
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

interface HiringPipelineProps {
    onSendMessage: (developerId: string, developerName: string, jobRoleId?: string, jobRoleTitle?: string) => void;
    onViewDeveloperProfile: (developer: Developer) => void;
    onInitiateHire: (assignment: SavedCandidate) => void;
}

const HiringPipeline: React.FC<HiringPipelineProps> = ({ onSendMessage, onViewDeveloperProfile, onInitiateHire }) => {
    const { userProfile } = useAuth();
    const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
    const [view, setView] = useState('list');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [notes, setNotes] = useState<{ [key: string]: string }>({});
    const [isSendTestModalOpen, setIsSendTestModalOpen] = useState(false);
    const [selectedCandidateForTest, setSelectedCandidateForTest] = useState<{devId: string, jobId: string} | null>(null);
    const [isResultsModalOpen, setIsResultsModalOpen] = useState(false);
    const [selectedAssignmentId, setSelectedAssignmentId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError('');
        if (!userProfile?.id) {
            setLoading(false);
            return;
        }

        try {
            const { data: assignmentsData, error: assignmentsError } = await supabase
                .from('assignments')
                .select(`
                    id,
                    status,
                    notes,
                    assigned_at,
                    developer:developers!inner (
                        user_id,
                        user:users!inner (
                            id,
                            name,
                            avatar_url,
                            profile_pic_url
                        )
                    ),
                    job_role:job_roles!fk_assignments_job_role_id!inner (
                        id,
                        title
                    )
                `)
                .eq('recruiter_id', userProfile.id)
                .neq('status', 'Hired');

            if (assignmentsError) {
                throw assignmentsError;
            }

            setCandidates(assignmentsData || []);

        } catch (err) {
            setError('Failed to fetch pipeline data: ' + (err as Error).message);
            console.error("Error fetching pipeline data:", err);
        } finally {
            setLoading(false);
        }
    }, [userProfile?.id]);

    useEffect(() => {
        if (userProfile?.id) {
            fetchData();
        }
    }, [userProfile, fetchData]);

    const handleUpdateStage = async (candidateId: string, stage: string, candidateToUpdate?: SavedCandidate) => {
        const candidate = candidateToUpdate || candidates.find(c => c.id === candidateId);
        if (!candidate) {
            setError('Candidate not found for update.');
            return;
        }

        if (stage === 'Hired') {
            onInitiateHire(candidate);
        } else {
            const { error } = await supabase.from('assignments').update({ status: stage }).eq('id', candidateId);
            if (error) {
                setError('Failed to update stage: ' + error.message);
            } else {
                fetchData();
            }
        }
    };

    const handleBulkUpdateStage = async (stage: string) => {
        if (stage === 'Hired') {
            setError("Bulk 'hired' status change is not supported.");
            return;
        }
        const { error } = await supabase.from('assignments').update({ status: stage }).in('id', selectedCandidates);
        if (error) {
            setError('Failed to bulk update stages: ' + error.message);
        } else {
            fetchData();
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
        const note = notes[candidateId] || '';
        const { error } = await supabase.from('assignments').update({ notes: note }).eq('id', candidateId);
        if (error) {
            setError("Failed to save notes: " + error.message);
        } else {
            console.log("Note saved.");
        }
    };

    const handleOpenSendTestModal = (developerId: string, jobId: string) => {
        setSelectedCandidateForTest({ devId: developerId, jobId: jobId });
        setIsSendTestModalOpen(true);
    };

    const handleCloseSendTestModal = () => {
        setIsSendTestModalOpen(false);
        setSelectedCandidateForTest(null);
    };

    const handleTestSent = () => {
        // Here you might want to show a success message or refresh data
        console.log("Test sent successfully!");
        fetchData();
    };

    const handleOpenResultsModal = (assignmentId: string) => {
        setSelectedAssignmentId(assignmentId);
        setIsResultsModalOpen(true);
    };

    const handleCloseResultsModal = () => {
        setIsResultsModalOpen(false);
        setSelectedAssignmentId(null);
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
                            {STAGES.filter(s => s !== 'Hired').map(s => <option key={`bulk-${s}`} value={s} className="capitalize">{s}</option>)}
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
                    <p className="text-gray-600">No active candidates in your pipeline. Add them from the job details page.</p>
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
                                    <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Date</th>
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
                                                    src={c.developer.user?.avatar_url || c.developer.user?.profile_pic_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.developer.user?.name || 'U')}&background=random`}
                                                    alt={c.developer.user?.name || 'Unknown'}
                                                    className="h-8 w-8 rounded-full object-cover"
                                                />
                                                <span className="font-medium text-gray-900">{c.developer.user?.name || 'Unknown'}</span>
                                            </div>
                                        </td>
                                        <td className="p-3 text-gray-700">{c.job_role.title}</td>
                                        <td className="p-3 text-sm text-gray-500">{new Date(c.assigned_at).toLocaleDateString()}</td>
                                        <td className="p-3">
                                            <select
                                                value={c.status}
                                                onChange={(e) => handleUpdateStage(c.id, e.target.value, c)}
                                                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                {STAGES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                                            </select>
                                        </td>
                                        <td className="p-3">
                                            <input type="text" value={notes[c.id] || c.notes || ''} onChange={e => setNotes(prev => ({...prev, [c.id]: e.target.value}))} onBlur={() => handleUpdateNotes(c.id)} placeholder="Add notes..." className="w-full border-gray-300 rounded-md text-sm focus:ring-blue-500 focus:border-blue-500" />
                                        </td>
                                        <td className="p-3 flex items-center space-x-2">
                                            <button
                                                onClick={() => onViewDeveloperProfile(c.developer)}
                                                className="p-2 hover:bg-gray-100 rounded-full text-gray-600"
                                                title="View Profile"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => onSendMessage(c.developer.user_id, c.developer.user.name || '', c.job_role.id, c.job_role.title)}
                                                className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Message Candidate"><MessageSquare size={18} />
                                            </button>
                                            {c.status === 'Completed' ? (
                                                <button onClick={() => handleOpenResultsModal(c.id)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="View Test Results">
                                                    <FileCheck size={18} />
                                                </button>
                                            ) : (
                                                <button onClick={() => handleOpenSendTestModal(c.developer.id, c.job_role.id)} className="p-2 hover:bg-gray-100 rounded-full text-gray-600" title="Send Test">
                                                    <Code size={18} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <KanbanView candidates={candidates} onUpdateStage={handleUpdateStage} onViewDeveloperProfile={onViewDeveloperProfile} onSendMessage={onSendMessage} onSendTest={handleOpenSendTestModal} onViewResults={handleOpenResultsModal} />
                )
            )}
             {isSendTestModalOpen && selectedCandidateForTest && (
                <SendTestModal
                    isOpen={isSendTestModalOpen}
                    onClose={handleCloseSendTestModal}
                    developerId={selectedCandidateForTest.devId}
                    jobId={selectedCandidateForTest.jobId}
                    onTestSent={handleTestSent}
                />
            )}
            {isResultsModalOpen && selectedAssignmentId && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-xl font-bold">Test Results</h2>
                            <button onClick={handleCloseResultsModal} className="p-1 rounded-full hover:bg-gray-200">
                                <X size={20} />
                            </button>
                        </div>
                        <TestResults assignmentId={selectedAssignmentId} />
                    </div>
                </div>
            )}
        </div>
    );
};

export default HiringPipeline;
