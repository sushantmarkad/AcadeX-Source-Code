import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import './Dashboard.css';

// ✅ Import Modals
import ResumeBuilderModal from '../components/ResumeBuilderModal';
import CodingChallengeModal from '../components/CodingChallengeModal';
import TypingTestModal from '../components/TypingTestModal';
import FlashCardModal from '../components/FlashCardModal';
import FreePeriodQuiz from '../components/FreePeriodQuiz';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// Updated Activities List with new Types
const ALL_ACTIVITIES = [
    { id: 1, title: 'Daily Coding Challenge', type: 'Coding', xp: 50, color: '#6366f1', icon: 'fa-laptop-code', tags: ['coding', 'tech'] },
    { id: 2, title: 'Speed Typing Test', type: 'Typing', xp: 20, color: '#f59e0b', icon: 'fa-keyboard', tags: ['productivity', 'universal'] },
    { id: 3, title: 'Concept Flashcards', type: 'FlashCard', xp: 30, color: '#ec4899', icon: 'fa-layer-group', tags: ['learning', 'universal'] },
    { id: 4, title: 'Debug a React Component', type: 'Coding', xp: 45, color: '#0ea5e9', icon: 'fa-bug', tags: ['frontend', 'react'] },
    { id: 5, title: 'SQL Query Optimization', type: 'Coding', xp: 35, color: '#3b82f6', icon: 'fa-database', tags: ['database'] },
    { id: 19, title: 'Update Resume', type: 'Career', xp: 50, color: '#2563eb', icon: 'fa-file-alt', tags: ['career', 'job', 'universal'] },
];

export default function FreePeriodTasks({ user, isFreePeriod }) {
    const [activeTab, setActiveTab] = useState('assignments'); 
    
    useEffect(() => { 
        if (isFreePeriod) setActiveTab('gamified'); 
    }, [isFreePeriod]);

    // Data States
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState({}); 
    const [recommendedTasks, setRecommendedTasks] = useState([]);
    
    // Interactive States
    const [submitModal, setSubmitModal] = useState({ open: false, taskId: null });
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    
    // Modals State
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
    const [showCodingModal, setShowCodingModal] = useState(false);
    const [showTypingModal, setShowTypingModal] = useState(false);
    const [showFlashCardModal, setShowFlashCardModal] = useState(false);

    const [credits, setCredits] = useState(user?.xp || 0);
    useEffect(() => { if (user?.xp !== undefined) setCredits(user.xp); }, [user?.xp]);
    const cgpaBoost = (credits / 5000).toFixed(2);

    // --- FETCH ASSIGNMENTS ---
    useEffect(() => {
        const fetchAssignments = async () => {
            if (!user) return;
            try {
                const res = await fetch(`${BACKEND_URL}/getAssignments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ department: user.department, year: user.year || 'All' })
                });
                const data = await res.json();
                setAssignments(data.tasks || []);
            } catch (err) { console.error(err); }
        };
        fetchAssignments();
    }, [user]);

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'submissions'), where('studentId', '==', auth.currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            const subMap = {};
            snap.docs.forEach(doc => { 
                const data = doc.data(); 
                subMap[data.assignmentId] = data; 
            });
            setSubmissions(subMap);
        });
        return () => unsub();
    }, []);

    // --- RECOMMENDATION LOGIC ---
    useEffect(() => {
        if (!user) return;
        const interestString = `${user.department || ''} ${user.domain || ''}`.toLowerCase();
        const strictMatches = ALL_ACTIVITIES.filter(task => {
            if (task.tags.includes('universal')) return true;
            return task.tags.some(tag => interestString.includes(tag));
        });
        setRecommendedTasks(strictMatches.slice(0, 8));
    }, [user]);

    // --- START TASK HANDLER ---
    const startTask = (task) => {
        if (task.title === 'Update Resume') { setIsResumeModalOpen(true); return; }
        
        // Open appropriate modal based on type
        if (task.type === 'Coding') setShowCodingModal(true);
        else if (task.type === 'Typing') setShowTypingModal(true);
        else if (task.type === 'FlashCard') setShowFlashCardModal(true);
        else toast("Coming soon!", { icon: '🚧' });
    };

    const handleTaskComplete = async (earnedCredits) => {
        toast.success(`🎉 +${earnedCredits} XP Earned!`);
        if (auth.currentUser) {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, { xp: increment(earnedCredits) });
            setCredits(prev => prev + earnedCredits);
        }
        setShowCodingModal(false);
        setShowTypingModal(false);
        setShowFlashCardModal(false);
    };

    const handleSubmitFile = async () => {
        if (!file || !submitModal.taskId) return toast.error("Please select a file.");
        setUploading(true);
        const toastId = toast.loading("Uploading...");
        try {
            const formData = new FormData();
            formData.append('document', file); 
            formData.append('assignmentId', submitModal.taskId);
            formData.append('studentId', user.uid);
            formData.append('studentName', `${user.firstName} ${user.lastName}`);
            formData.append('rollNo', user.rollNo || 'N/A');

            const res = await fetch(`${BACKEND_URL}/submitAssignment`, { method: 'POST', body: formData });
            if (!res.ok) throw new Error("Submission failed");

            toast.success("Submitted!", { id: toastId });
            setSubmissions(prev => ({
                ...prev,
                [submitModal.taskId]: { status: 'Pending', submittedAt: new Date(), documentUrl: URL.createObjectURL(file) } 
            }));
            setSubmitModal({ open: false, taskId: null }); setFile(null);
        } catch (error) { toast.error("Error submitting", { id: toastId }); } 
        finally { setUploading(false); }
    };

    return (
        <div className="content-section">
            <div className="tasks-header">
                <div>
                    <h2 className="content-title">My Tasks</h2>
                    <p className="content-subtitle">Earn <span className="highlight-text">Academic Credits</span>.</p>
                </div>
                <div className="credits-display">
                    <div className="credits-count">{credits} <span>XP</span></div>
                    <div className="cgpa-pill">📈 +{cgpaBoost} Projected CGPA</div>
                </div>
            </div>
            
            <div className="glass-tabs">
                <button className={`glass-tab ${activeTab === 'assignments' ? 'active' : ''}`} onClick={() => setActiveTab('assignments')}>
                    <i className="fas fa-book"></i> Assignments
                </button>
                <button className={`glass-tab ${activeTab === 'gamified' ? 'active' : ''}`} onClick={() => setActiveTab('gamified')}>
                    <i className="fas fa-rocket"></i> Quick Picks
                    {isFreePeriod && <span className="tab-badge pulse">LIVE</span>}
                </button>
            </div>

            {/* TAB 1: ASSIGNMENTS */}
            {activeTab === 'assignments' && (
                <div className="tasks-grid">
                    <AnimatePresence>
                        {assignments.length > 0 ? assignments.map((task, index) => {
                            const sub = submissions[task.id]; 
                            const isSubmitted = !!sub;
                            const isGraded = sub?.status === 'Graded';
                            let statusText = isGraded ? `${sub.marks}/100` : isSubmitted ? 'Submitted' : 'Pending';
                            let statusClass = isGraded ? 'status-graded' : isSubmitted ? 'status-submitted' : 'status-pending';

                            return (
                                <motion.div key={task.id} className="task-card-modern" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                                    <div className="card-header-row">
                                        <div className="task-icon-circle"><i className="fas fa-book-open"></i></div>
                                        <span className={`modern-status-pill ${statusClass}`}>{statusText}</span>
                                    </div>
                                    <div>
                                        <h3 className="modern-title">{task.title}</h3>
                                        <div className="modern-meta"><i className="far fa-calendar-alt"></i> Due: {new Date(task.dueDate).toLocaleDateString()}</div>
                                        <p className="modern-desc">{task.description}</p>
                                    </div>
                                    <div className="action-area">
                                        {isGraded ? <div className="submitted-area"><i className="fas fa-star"></i> Feedback: "{sub.feedback}"</div> :
                                         isSubmitted ? <div className="submitted-area"><i className="fas fa-check-circle"></i> Done</div> : 
                                        <button className="btn-upload-glow" onClick={() => setSubmitModal({ open: true, taskId: task.id })}><i className="fas fa-cloud-upload-alt"></i> Upload</button>}
                                    </div>
                                </motion.div>
                            );
                        }) : <div className="empty-state-glass"><h3>No Assignments</h3></div>}
                    </AnimatePresence>
                </div>
            )}

            {/* TAB 2: QUICK PICKS */}
            {activeTab === 'gamified' && (
                <div>
                    {/* Free Period Quiz Component */}
                    <FreePeriodQuiz user={user} isFree={isFreePeriod} />

                    <h3 className="section-heading" style={{marginTop:'20px'}}>Quick Picks</h3>
                    <div className="tasks-grid">
                        {recommendedTasks.map((task) => (
                            <motion.div key={task.id} className="task-card-modern" whileHover={{ y: -5 }} onClick={() => startTask(task)} style={{cursor: 'pointer'}}>
                                <div className="card-header-row">
                                    <div className="task-icon-circle" style={{background: `${task.color}15`, color: task.color}}><i className={`fas ${task.icon}`}></i></div>
                                    <span className="xp-badge">+{task.xp} XP</span>
                                </div>
                                <div>
                                    <h3 className="modern-title">{task.title}</h3>
                                    <div className="tags">{task.tags.slice(0,2).map(t => <span key={t} className="tiny-tag">#{t}</span>)}</div>
                                </div>
                                <button className="btn-modern-outline" style={{marginTop:'auto'}}>Start Activity</button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}
            {submitModal.open && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box glass-modal">
                        <h3>Submit Assignment</h3>
                        <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                        <div className="modal-actions" style={{marginTop:'20px'}}>
                            <button onClick={() => setSubmitModal({ open: false, taskId: null })}>Cancel</button>
                            <button className="btn-primary" onClick={handleSubmitFile} disabled={uploading}>{uploading ? '...' : 'Submit'}</button>
                        </div>
                    </div>
                </div>
            )}

            <ResumeBuilderModal isOpen={isResumeModalOpen} onClose={() => setIsResumeModalOpen(false)} user={user} />
            <CodingChallengeModal isOpen={showCodingModal} onClose={() => setShowCodingModal(false)} user={user} onComplete={handleTaskComplete} />
            <TypingTestModal isOpen={showTypingModal} onClose={() => setShowTypingModal(false)} onComplete={handleTaskComplete} />
            <FlashCardModal isOpen={showFlashCardModal} onClose={() => setShowFlashCardModal(false)} user={user} onComplete={handleTaskComplete} />
        </div>
    );
}