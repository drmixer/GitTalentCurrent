import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { User, JobRole, AppliedJob } from '../types';
import { Eye, MessageSquare, ChevronDown, MoreVertical, Trash2, CheckSquare, Edit, FileText } from 'lucide-react';
import { DeveloperProfileModal } from './DeveloperProfileModal';

interface SavedCandidate extends AppliedJob {
    developer: User;
    job_role: JobRole;
}

const STAGES = ['applied', 'viewed', 'contacted', 'interviewing', 'offer', 'hired', 'rejected'];

const KanbanView: React.FC<{ candidates: SavedCandidate[], onUpdateStage: (id: string, stage: string) => void }> = ({ candidates, onUpdateStage }) => {
    // This is a simplified version. A real implementation would use a drag and drop library.
    const handleDrop = (e: React.DragEvent<HTMLDivElement>, stage: string) => {
        e.preventDefault();
        const candidateId = e.dataTransfer.getData("candidateId");
        onUpdateStage(candidateId, stage);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, candidateId: string) => {
        e.dataTransfer.setData("candidateId", candidateId);
    };

    return (
        <div className="flex space-x-4">
            {STAGES.map(stage => (
                <div key={stage} className="w-1/4 bg-gray-100 p-2 rounded-lg" onDrop={(e) => handleDrop(e, stage)} onDragOver={handleDragOver}>
                    <h2 className="font-bold mb-2 capitalize">{stage}</h2>
                    {candidates.filter(c => c.status === stage).map(c => (
                        <div key={c.id} draggable onDragStart={(e) => handleDragStart(e, c.id)} className="p-2 bg-white rounded shadow mb-2 cursor-grab">
                            <p className="font-semibold">{c.developer.name}</p>
                            <p className="text-sm text-gray-500">{c.job_role.title}</p>
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
};


const HiringPipeline: React.FC = () => {
    const { user, userProfile } = useAuth();
    const [candidates, setCandidates] = useState<SavedCandidate[]>([]);
    const [jobRoles, setJobRoles] = useState<JobRole[]>([]);
    const [view, setView] = useState('list'); // 'list' or 'kanban'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedCandidates, setSelectedCandidates] = useState<string[]>([]);
    const [selectedDeveloper, setSelectedDeveloper] = useState<User | null>(null);
    const [notes, setNotes] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (userProfile?.id) {
            fetchData();
        }
    }, [userProfile]);

    const fetchData = async () => {
        setLoading(true);
        await fetchJobRoles();
        await fetchCandidates();
        setLoading(false);
    }

    const fetchJobRoles = async () => {
        if (!userProfile) return;
        const { data, error } = await supabase.from('job_roles').select('*').eq('recruiter_id', userProfile.id);
        if (error) console.error("Error fetching job roles:", error);
        else setJobRoles(data || []);
    };

    const fetchCandidates = async () => {
        if (!userProfile) return;
        const { data, error } = await supabase
            .from('applied_jobs')
            .select(`*, developer:developers(*, user:users(*)), job_role:job_roles(*)`)
            .in('job_role_id', jobRoles.map(j => j.id));

        if (error) {
            setError('Failed to fetch candidates');
            console.error(error);
        } else {
            setCandidates(data as any || []);
        }
    };

    const handleUpdateStage = async (candidateId: string, stage: string) => {
        const { error } = await supabase.from('applied_jobs').update({ status: stage }).eq('id', candidateId);
        if (error) {
            setError('Failed to update stage');
        } else {
            fetchCandidates(); // Refresh
        }
    };

    const handleBulkUpdateStage = async (stage: string) => {
        const { error } = await supabase.from('applied_jobs').update({ status: stage }).in('id', selectedCandidates);
        if (error) {
            setError('Failed to bulk update stages');
        } else {
            fetchCandidates(); // Refresh
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
        // In a real app, you'd probably have a dedicated notes table
        // For now, we'll just log it.
        console.log(`Saving note for ${candidateId}: ${note}`);
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold">Hiring Pipeline</h1>
                <div>
                    <button onClick={() => setView('list')} className={`p-2 ${view === 'list' ? 'bg-blue-500 text-white' : ''}`}>List</button>
                    <button onClick={() => setView('kanban')} className={`p-2 ${view === 'kanban' ? 'bg-blue-500 text-white' : ''}`}>Pipeline</button>
                </div>
            </div>

            {selectedCandidates.length > 0 && (
                <div className="mb-4 p-2 bg-gray-100 rounded flex items-center space-x-4">
                    <p>{selectedCandidates.length} candidates selected</p>
                    <div className="relative">
                        <button className="flex items-center space-x-2 p-2 border rounded">
                            <span>Change Stage</span>
                            <ChevronDown size={16} />
                        </button>
                        {/* Dropdown for bulk actions */}
                    </div>
                    <button className="p-2 border rounded"><Trash2 size={16} /> Delete</button>
                </div>
            )}

            {view === 'list' ? (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="p-3 w-8"><input type="checkbox" onChange={handleSelectAll} /></th>
                                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Candidate</th>
                                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Job</th>
                                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                                <th className="p-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {candidates.map(c => (
                                <tr key={c.id}>
                                    <td className="p-3"><input type="checkbox" checked={selectedCandidates.includes(c.id)} onChange={() => handleSelectCandidate(c.id)} /></td>
                                    <td className="p-3">{c.developer.name}</td>
                                    <td className="p-3">{c.job_role.title}</td>
                                    <td className="p-3">
                                        <select value={c.status} onChange={(e) => handleUpdateStage(c.id, e.target.value)} className="text-sm border-gray-300 rounded-md">
                                            {STAGES.map(s => <option key={s} value={s} className="capitalize">{s}</option>)}
                                        </select>
                                    </td>
                                    <td className="p-3">
                                        <input type="text" value={notes[c.id] || ''} onChange={e => setNotes(prev => ({...prev, [c.id]: e.target.value}))} onBlur={() => handleUpdateNotes(c.id)} className="w-full border-gray-300 rounded-md" />
                                    </td>
                                    <td className="p-3 flex items-center space-x-2">
                                        <button onClick={() => setSelectedDeveloper(c.developer)} className="p-2 hover:bg-gray-100 rounded-full"><Eye size={18} /></button>
                                        <button className="p-2 hover:bg-gray-100 rounded-full"><MessageSquare size={18} /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <KanbanView candidates={candidates} onUpdateStage={handleUpdateStage} />
            )}

            {selectedDeveloper && (
                <DeveloperProfileModal
                    developer={selectedDeveloper as any}
                    onClose={() => setSelectedDeveloper(null)}
                />
            )}
        </div>
    );
};

export default HiringPipeline;
