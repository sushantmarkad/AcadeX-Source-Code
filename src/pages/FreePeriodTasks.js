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

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- 1. ORIGINAL CONSTANTS (Preserved) ---
const ALL_ACTIVITIES = [
    // 💻 ENGINEERING & TECH
    { id: 1, title: 'Daily Coding Challenge', type: 'Coding', xp: 50, color: '#6366f1', icon: 'fa-laptop-code', tags: ['coding', 'computer science', 'tech'] },
    { id: 2, title: 'Debug a React Component', type: 'Coding', xp: 45, color: '#0ea5e9', icon: 'fa-bug', tags: ['frontend', 'react', 'tech'] },
    { id: 3, title: 'SQL Query Optimization', type: 'Coding', xp: 35, color: '#3b82f6', icon: 'fa-database', tags: ['database', 'backend', 'tech'] },
    { id: 4, title: 'Circuit Design Logic', type: 'Puzzle', xp: 40, color: '#eab308', icon: 'fa-microchip', tags: ['electronics', 'hardware', 'engineering'] },
    { id: 5, title: 'Thermodynamics Quiz', type: 'Quiz', xp: 30, color: '#ef4444', icon: 'fa-fire', tags: ['mechanical', 'physics', 'engineering'] },

    // 🏥 MEDICAL & SCIENCE
    { id: 6, title: 'Anatomy Labeling', type: 'Quiz', xp: 30, color: '#ef4444', icon: 'fa-heartbeat', tags: ['medical', 'biology', 'health'] },
    { id: 7, title: 'Medical Case Study', type: 'Reading', xp: 40, color: '#10b981', icon: 'fa-user-md', tags: ['medical', 'doctor', 'nursing'] },
    { id: 8, title: 'Periodic Table Speed Run', type: 'Game', xp: 25, color: '#8b5cf6', icon: 'fa-flask', tags: ['chemistry', 'science'] },
    { id: 9, title: 'Plant Identification', type: 'Puzzle', xp: 20, color: '#15803d', icon: 'fa-leaf', tags: ['biology', 'botany', 'agriculture'] },

    // 💰 COMMERCE & BUSINESS
    { id: 10, title: 'Stock Market Analysis', type: 'Analysis', xp: 35, color: '#10b981', icon: 'fa-chart-line', tags: ['finance', 'business', 'commerce'] },
    { id: 11, title: 'Create a Budget Plan', type: 'Finance', xp: 30, color: '#059669', icon: 'fa-wallet', tags: ['finance', 'accounting', 'commerce'] },
    { id: 12, title: 'Marketing Case Study', type: 'Reading', xp: 30, color: '#f97316', icon: 'fa-bullhorn', tags: ['marketing', 'business', 'mba'] },
    { id: 13, title: 'SWOT Analysis', type: 'Writing', xp: 25, color: '#3b82f6', icon: 'fa-project-diagram', tags: ['business', 'management'] },

    // 🚀 UNIVERSAL / PRODUCTIVITY
    { id: 19, title: 'Update Resume', type: 'Career', xp: 50, color: '#2563eb', icon: 'fa-file-alt', tags: ['career', 'job', 'universal'] },
    { id: 20, title: 'Speed Typing Test', type: 'Typing', xp: 20, color: '#f59e0b', icon: 'fa-keyboard', tags: ['productivity', 'universal'] },
    { id: 21, title: 'Mental Math Drill', type: 'Drill', xp: 15, color: '#06b6d4', icon: 'fa-calculator', tags: ['math', 'universal'] },
    { id: 24, title: 'Sudoku Challenge', type: 'Brain', xp: 25, color: '#7c3aed', icon: 'fa-puzzle-piece', tags: ['logic', 'universal'] }
];

export default function FreePeriodTasks({ user, isFreePeriod }) {
    const [activeTab, setActiveTab] = useState('assignments'); 
    
    // Auto-switch to Quick Picks if Free Period Detected
    useEffect(() => { 
        if (isFreePeriod) setActiveTab('gamified'); 
    }, [isFreePeriod]);

    // Data States
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState({}); 
    const [recommendedTasks, setRecommendedTasks] = useState([]);
    
    // AI & Interactive States
    const [loading, setLoading] = useState(false);
    
    // ✅ NEW: Store the generated task data
    const [activeAiTask, setActiveAiTask] = useState(null); 
    
    // Verification & Modals
    const [submitModal, setSubmitModal] = useState({ open: false, taskId: null });
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);
    
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);

    // Stats State
    const [credits, setCredits] = useState(user?.xp || 0);
    
    // Sync local credits
    useEffect(() => {
        if (user?.xp !== undefined) setCredits(user.xp);
    }, [user?.xp]);

    const cgpaBoost = (credits / 5000).toFixed(2);

    // --- 1. FETCH ASSIGNMENTS ---
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
        // Listen to submissions collection for the current user's submissions
        const q = query(collection(db, 'submissions'), where('studentId', '==', auth.currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            const subMap = {};
            // Map the submissions by assignmentId for easy lookup
            snap.docs.forEach(doc => { 
                const data = doc.data(); 
                subMap[data.assignmentId] = data; 
            });
            setSubmissions(subMap);
        });
        return () => unsub();
    }, []);

    // --- 2. RECOMMENDATION LOGIC (Preserved) ---
    useEffect(() => {
        if (!user) return;
        
        const interestString = `${user.department || ''} ${user.domain || ''} ${user.subDomain || ''} ${user.specificSkills || ''}`.toLowerCase();
        
        const strictMatches = ALL_ACTIVITIES.filter(task => {
            if (task.tags.includes('universal')) return true;
            return task.tags.some(tag => interestString.includes(tag));
        });

        const relevant = strictMatches.filter(t => !t.tags.includes('universal'));
        const universal = strictMatches.filter(t => t.tags.includes('universal'));
        
        let finalDisplay = [...relevant, ...universal];

        if (finalDisplay.length < 6) {
            const moreUniversal = ALL_ACTIVITIES.filter(t => t.tags.includes('universal') && !finalDisplay.includes(t));
            finalDisplay = [...finalDisplay, ...moreUniversal];
        }

        setRecommendedTasks(finalDisplay.slice(0, 8));
    }, [user]);

    // --- 3. INTERACTIVE TASK HANDLERS (UPDATED) ---
    
    // ✅ Logic: When user clicks a card, we ask AI to generate the content for that specific type
    const startTask = async (task) => {
        // Special Cases
        if (task.title === 'Update Resume') { setIsResumeModalOpen(true); return; }
        
        setLoading(true);
        try {
            // Ask Backend to generate content for this specific task
            const res = await fetch(`${BACKEND_URL}/generatePersonalizedTasks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    userProfile: { 
                        domain: user.domain || "General", 
                        subDomain: user.subDomain || "Technology",
                        specificSkills: user.specificSkills || "General"
                    },
                    // Force generate 1 task of this type
                    forceType: task.type 
                })
            });

            const data = await res.json();
            
            // Find the task that matches the type we clicked
            let generatedTask = data.tasks.find(t => t.type === task.type);
            
            // If AI didn't give exact match, use fallback
            if (!generatedTask) {
                if (task.type === 'Coding') generatedTask = { type: 'Coding', title: task.title, content: { problemStatement: "Write a function to reverse a string.", starterCode: "function reverse(str) {}" }, xp: task.xp };
                else if (task.type === 'Typing') generatedTask = { type: 'Typing', title: task.title, content: { targetText: "Technology is the application of scientific knowledge for practical purposes." }, xp: task.xp };
                else generatedTask = { type: 'Coding', title: task.title, content: { problemStatement: "Solve this logic puzzle.", starterCode: "// Answer here" }, xp: task.xp };
            }

            // Open the Modal
            setActiveAiTask(generatedTask);

        } catch (err) {
            toast.error("AI Busy, try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleAiTaskComplete = async (earnedCredits) => {
        setActiveAiTask(null);
        toast.success(`🎉 +${earnedCredits} XP Earned!`);
        if (auth.currentUser) {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, { xp: increment(earnedCredits) });
            setCredits(prev => prev + earnedCredits);
        }
    };

   const handleSubmitFile = async () => {
        if (!file || !submitModal.taskId) return toast.error("Please select a file.");

        // Check File Size (Max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            return toast.error("File is too large. Max 5MB.");
        }

        setUploading(true);
        const toastId = toast.loading("Uploading & Submitting...");

        try {
            const formData = new FormData();
            
            // 1. MUST match backend 'upload.single("document")'
            formData.append('document', file); 
            
            // 2. Append required metadata for Backend Route 22
            formData.append('assignmentId', submitModal.taskId);
            formData.append('studentId', user.uid);
            formData.append('studentName', `${user.firstName} ${user.lastName}`);
            formData.append('rollNo', user.rollNo || 'N/A'); // Fallback if rollNo is missing

            // 3. Send to the CORRECT backend route
            // This route handles both file upload (e.g., to Firebase Storage) and saving metadata to Firestore 'submissions'
            const res = await fetch(`${BACKEND_URL}/submitAssignment`, {
                method: 'POST',
                body: formData
            });

            const data = await res.json();

            if (!res.ok) {
                // Handle "Already submitted" or other errors
                throw new Error(data.error || "Submission failed");
            }

            // 4. Success! (Backend handles the DB save, so we just update UI)
            toast.success("Assignment Submitted Successfully!", { id: toastId });
            
            // Update local state to show "Submitted" immediately without refresh
            setSubmissions(prev => ({
                ...prev,
                // The status must be 'Pending' for teacher review
                [submitModal.taskId]: { status: 'Pending', submittedAt: new Date() } 
            }));

            setSubmitModal({ open: false, taskId: null });
            setFile(null);

        } catch (error) {
            console.error(error);
            toast.error(error.message, { id: toastId });
        } finally {
            setUploading(false);
        }
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
                    {assignments.length > 0 ? assignments.map((task, index) => {
                         const sub = submissions[task.id]; 
                         const isSubmitted = !!sub; // Check if submission object exists
                         const isGraded = sub?.status === 'Graded';
                         
                         // Determine the display status for the pill
                         let statusText = 'Pending';
                         let statusClass = 'pending'; // Default style
                         
                         if (isGraded) {
                            statusText = `${sub.marks}/100`;
                            statusClass = 'graded';
                         } else if (isSubmitted) {
                            statusText = 'Submitted';
                            statusClass = 'submitted';
                         }

                         return (
                            <motion.div 
                                key={task.id} 
                                className={`task-card modern-card ${isSubmitted ? 'submitted-card' : ''}`} 
                                initial={{ opacity: 0, y: 10 }} 
                                animate={{ opacity: 1, y: 0 }} 
                                transition={{ delay: index * 0.05 }}
                                // Highlight submitted card with a subtle shadow/border change
                                style={{ border: isSubmitted ? '2px solid #10b981' : '1px solid #ddd' }}
                            >
                                <div className="card-top">
                                    <div className="icon-square" style={{ background: '#e0f2fe', color: '#0284c7' }}><i className="fas fa-book-open"></i></div>
                                    <span className={`status-pill ${statusClass}`}>
                                        {statusText}
                                    </span>
                                </div>
                                <div className="card-body">
                                    <h3>{task.title}</h3>
                                    <p>{task.description}</p>
                                    <small><i className="far fa-clock"></i> Due: {new Date(task.dueDate).toLocaleDateString()}</small>
                                </div>
                                
                                {/* Action Button Logic */}
                                {isGraded && <div className="btn-modern-secondary">View Grade & Feedback</div>}
                                {!isSubmitted && <button className="btn-modern-primary" onClick={() => setSubmitModal({ open: true, taskId: task.id })}>Upload PDF</button>}
                                {isSubmitted && !isGraded && (
                                    <div className="submitted-msg">
                                        <i className="fas fa-check-circle"></i> Submission recorded. Waiting for teacher evaluation.
                                    </div>
                                )}
                            </motion.div>
                        );
                    }) : (
                        <div className="empty-state-glass"><h3>No Assignments</h3></div>
                    )}
                </div>
            )}

            {/* TAB 2: CURRICULUM & QUICK PICKS */}
            {activeTab === 'gamified' && (
                <div>
                    {isFreePeriod && (
                        <motion.div className="free-period-alert" initial={{ scale: 0.95 }} animate={{ scale: 1 }}>
                            <div className="alert-icon"><i className="fas fa-bolt"></i></div>
                            <div className="alert-content">
                                <h3>Free Period Detected</h3>
                                <p>Time to boost your CGPA.</p>
                            </div>
                        </motion.div>
                    )}

                    <h3 className="section-heading">Quick Picks</h3>
                    <div className="tasks-grid">
                        {recommendedTasks.map((task, index) => (
                            <motion.div 
                                key={task.id} 
                                className="task-card modern-card" 
                                whileHover={{ y: -5 }} 
                                initial={{ opacity: 0 }} 
                                animate={{ opacity: 1 }} 
                                transition={{ delay: index * 0.05 }}
                            >
                                <div className="card-top">
                                    <div className="icon-square" style={{ background: `${task.color}15`, color: task.color }}>
                                        <i className={`fas ${task.icon}`}></i>
                                    </div>
                                    <span className="xp-pill">+{task.xp} XP</span>
                                </div>
                                <div className="card-body">
                                    <h3>{task.title}</h3>
                                    <div className="tags">
                                        {task.tags.slice(0,2).map(t => <span key={t} className="tiny-tag">#{t}</span>)}
                                    </div>
                                    <p className="time-est"><i className="far fa-clock"></i> 5 min</p>
                                </div>
                                {/* ✅ BUTTON TRIGGERS AI MODAL */}
                                <button className="btn-modern-outline" onClick={() => startTask(task)} disabled={loading}>
                                    {loading ? 'Starting...' : 'Start'}
                                </button>
                            </motion.div>
                        ))}
                    </div>
                </div>
            )}

            {/* --- MODALS --- */}
            
            {/* File Upload Modal */}
            <AnimatePresence>
                {submitModal.open && (
                    <div className="custom-modal-overlay">
                        <motion.div className="custom-modal-box glass-modal" initial={{ scale: 0.9 }} animate={{ scale: 1 }}>
                            <h3>Submit Assignment</h3>
                            <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => setFile(e.target.files[0])} style={{marginBottom:'20px', marginTop:'10px'}} />
                            <div className="modal-actions">
                                <button className="btn-modern-ghost" onClick={() => setSubmitModal({ open: false, taskId: null })}>Cancel</button>
                                <button className="btn-modern-primary" onClick={handleSubmitFile} disabled={uploading}>
                                    {uploading ? 'Uploading...' : 'Submit'}
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ResumeBuilderModal isOpen={isResumeModalOpen} onClose={() => setIsResumeModalOpen(false)} user={user} />
            
            {/* ✅ NEW AI MODALS */}
            {activeAiTask?.type === 'Coding' && (
                <CodingChallengeModal 
                    isOpen={true} 
                    task={activeAiTask} 
                    onClose={() => setActiveAiTask(null)}
                    onComplete={handleAiTaskComplete}
                />
            )}

            {activeAiTask?.type === 'Typing' && (
                <TypingTestModal 
                    isOpen={true} 
                    task={activeAiTask} 
                    onClose={() => setActiveAiTask(null)}
                    onComplete={handleAiTaskComplete}
                />
            )}
        </div>
    );
}