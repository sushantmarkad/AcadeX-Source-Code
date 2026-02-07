import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, doc, updateDoc, increment } from 'firebase/firestore';
import './Dashboard.css';

// Import Modals
import ResumeBuilderModal from '../components/ResumeBuilderModal';
import CodingChallengeModal from '../components/CodingChallengeModal';
import TypingTestModal from '../components/TypingTestModal';
import FlashCardModal from '../components/FlashCardModal';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

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

    // Data States
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submissions, setSubmissions] = useState({});
    const [recommendedTasks, setRecommendedTasks] = useState([]);

    // Interactive States
    const [submitModal, setSubmitModal] = useState({ open: false, taskId: null });
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // Modals
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
    const [showCodingModal, setShowCodingModal] = useState(false);
    const [showTypingModal, setShowTypingModal] = useState(false);
    const [showFlashCardModal, setShowFlashCardModal] = useState(false);

    const [credits, setCredits] = useState(user?.xp || 0);
    useEffect(() => { if (user?.xp !== undefined) setCredits(user.xp); }, [user?.xp]);
    const cgpaBoost = (credits / 5000).toFixed(2);

    // --- ANIMATION VARIANTS (Only for Quick Picks now) ---
    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.05 } }
    };

    const cardVariants = {
        hidden: { opacity: 0, y: 15 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 20 } }
    };

    // --- FETCH DATA (Instant Cache) ---
    useEffect(() => {
        const fetchAssignments = async () => {
            if (!user) return;

            // ✅ 1. Get User Division (Handle both 'div' and 'division' fields)
            const userDiv = user.division || user.div || 'All';

            // ✅ 2. Update Cache Key to include Division (So Div A doesn't see Div B's cache)
            const cacheKey = `assignments_${user.department || 'gen'}_${user.year || 'all'}_${userDiv}`;
            const cachedData = localStorage.getItem(cacheKey);

            if (cachedData) {
                setAssignments(JSON.parse(cachedData));
                setLoading(false);
            } else {
                setLoading(true);
            }

            try {
                const res = await fetch(`${BACKEND_URL}/getAssignments`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        department: user.department,
                        year: user.year || 'All',
                        division: userDiv // ✅ 3. Send Division to Backend
                    })
                });

                if (res.ok) {
                    const data = await res.json();

                    // ✅ 4. CLIENT-SIDE FILTERING (Double Safety)
                    // Ensures that even if the backend returns mixed data, we filter it here.
                    const filteredTasks = (data.tasks || []).filter(task => {
                        // If task has no division or is 'All', everyone sees it
                        if (!task.division || task.division === 'All') return true;

                        // If specific division, it must match the user's division
                        return task.division === userDiv;
                    });

                    if (JSON.stringify(filteredTasks) !== cachedData) {
                        setAssignments(filteredTasks);
                        localStorage.setItem(cacheKey, JSON.stringify(filteredTasks));
                    }
                }
            } catch (err) {
                console.error("Background sync failed:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAssignments();
    }, [user?.department, user?.year, user?.division, user?.div]); // ✅ Added Division dependencies

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'submissions'), where('studentId', '==', auth.currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            const subMap = {};
            snap.docs.forEach(doc => { subMap[doc.data().assignmentId] = doc.data(); });
            setSubmissions(subMap);
        });
        return () => unsub();
    }, []);

    useEffect(() => {
        if (!user) return;
        const interestString = `${user.department || ''} ${user.domain || ''}`.toLowerCase();
        const strictMatches = ALL_ACTIVITIES.filter(task => {
            if (task.tags.includes('universal')) return true;
            return task.tags.some(tag => interestString.includes(tag));
        });
        setRecommendedTasks(strictMatches.slice(0, 8));
    }, [user]);

    const startTask = (task) => {
        if (task.title === 'Update Resume') { setIsResumeModalOpen(true); return; }
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
        setShowCodingModal(false); setShowTypingModal(false); setShowFlashCardModal(false);
    };

    const handleSubmitFile = async () => {
        if (!file || !submitModal.taskId) return toast.error("Please select a file.");
        setUploading(true);
        const toastId = 'upload-toast';
        toast.loading("Uploading...", { id: toastId });

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
        <div className="fp-container">
            {/* Header */}
            <div className="fp-header-row">
                <div className="fp-header-text">
                    <h2 className="fp-title">My Tasks</h2>
                    <p className="fp-subtitle">Complete tasks to earn <span className="fp-gradient-text">Academic Credits</span>.</p>
                </div>
                <div className="fp-stats-card">
                    <div className="fp-xp-count">{credits} <span className="fp-unit">XP</span></div>
                    <div className="fp-cgpa-badge">📈 +{cgpaBoost} Projected CGPA</div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="fp-nav-tabs">
                <button
                    className={`fp-tab ${activeTab === 'assignments' ? 'active' : ''}`}
                    onClick={() => setActiveTab('assignments')}
                >
                    <i className="fas fa-book-open"></i> Assignments
                </button>
                <button
                    className={`fp-tab ${activeTab === 'gamified' ? 'active' : ''}`}
                    onClick={() => setActiveTab('gamified')}
                >
                    <i className="fas fa-rocket"></i> Quick Picks
                    {isFreePeriod && <span className="fp-live-badge">LIVE</span>}
                </button>
            </div>

            {/* CONTENT AREA */}
            {activeTab === 'assignments' ? (
                // ✅ NO MOTION - Pure Divs for Speed
                <div className="fp-grid">
                    {loading ? (
                        <div className="fp-full-width" style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
                            <i className="fas fa-circle-notch fa-spin" style={{ fontSize: '30px', marginBottom: '10px' }}></i>
                            <p>Loading...</p>
                        </div>
                    ) : assignments.length > 0 ? (
                        assignments.map((task) => {
                            const sub = submissions[task.id];
                            /* ✅ REPLACE THE RETURN STATEMENT INSIDE assignments.map(...) */
                            /* ✅ REPLACE THE RETURN STATEMENT INSIDE assignments.map(...) */
                            return (
                                <div key={task.id} className="fp-card">
                                    <div className="fp-card-top">
                                        <div className="fp-icon-square"><i className="fas fa-book"></i></div>
                                        <span className={`fp-status-pill ${sub?.status?.toLowerCase() || 'pending'}`}>
                                            {sub?.status || 'Pending'}
                                        </span>
                                    </div>

                                    {/* Teacher Badge */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', marginTop: '5px', fontSize: '11px', color: '#475569', background: '#f1f5f9', width: 'fit-content', padding: '4px 8px', borderRadius: '6px', fontWeight: '600' }}>
                                        <i className="fas fa-chalkboard-teacher" style={{ color: '#3b82f6' }}></i>
                                        {task.teacherName || "Instructor"}
                                    </div>

                                    <h3 className="fp-card-heading">{task.title}</h3>
                                    <div className="fp-date"><i className="far fa-calendar"></i> {new Date(task.dueDate).toLocaleDateString()}</div>
                                    <p className="fp-desc">{task.description}</p>

                                    {/* 🔥 FIX: MOBILE RESPONSIVE ACTION ROW */}
                                    <div className="fp-action-row"
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            marginTop: '20px',
                                            borderTop: '1px solid #f1f5f9',
                                            paddingTop: '15px',
                                            flexWrap: 'wrap',  /* ✅ Allows wrapping on small screens */
                                            gap: '10px'        /* ✅ Adds spacing when wrapped */
                                        }}>

                                        {/* Left Side: Attachment */}
                                        {task.attachmentUrl ? (
                                            <a href={task.attachmentUrl} target="_blank" rel="noreferrer"
                                                style={{
                                                    textDecoration: 'none', color: '#334155', fontSize: '13px',
                                                    fontWeight: '600', display: 'flex', alignItems: 'center',
                                                    gap: '8px', padding: '8px 14px', background: '#f8fafc',
                                                    borderRadius: '8px', border: '1px solid #e2e8f0', transition: '0.2s',
                                                    flex: '1 1 auto', /* ✅ Allows it to grow/shrink */
                                                    minWidth: '120px', /* ✅ Prevents it from getting too small */
                                                    justifyContent: 'center' /* ✅ Centers text on mobile */
                                                }}>
                                                <i className="fas fa-paperclip" style={{ color: '#6366f1' }}></i> View File
                                            </a>
                                        ) : <div style={{ flex: '1 1 auto' }}></div> /* Spacer */}

                                        {/* Right Side: Action Button */}
                                        {sub ? (
                                            <div className={`fp-result-box ${sub.status === 'Graded' ? 'graded' : 'submitted'}`}
                                                style={{ flex: '1 1 auto', minWidth: '120px', textAlign: 'center', justifyContent: 'center', display: 'flex' }}>
                                                {sub.status === 'Graded' ?
                                                    <><i className="fas fa-star"></i> {sub.marks}/100</> :
                                                    <><i className="fas fa-check-circle"></i> Submitted</>
                                                }
                                            </div>
                                        ) : (
                                            <button className="fp-btn-primary"
                                                onClick={() => setSubmitModal({ open: true, taskId: task.id })}
                                                style={{ flex: '1 1 auto', minWidth: '120px' }}> {/* ✅ Buttons expand on mobile */}
                                                Upload Work
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="fp-empty"><h3>🎉 No pending assignments!</h3></div>
                    )}
                </div>
            ) : (

                // ✅ QUICK PICKS - Keeps Motion
                <div className="fp-full-width">
                    <motion.div
                        className="fp-grid"
                        variants={containerVariants}
                        initial="hidden"
                        animate="show"
                    >
                        {recommendedTasks.map((task) => (
                            <motion.div
                                key={task.id}
                                variants={cardVariants}
                                whileHover={{ y: -5 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => startTask(task)}
                                className="fp-card clickable"
                            >
                                <div className="fp-card-top">
                                    <div className="fp-icon-square" style={{ background: `${task.color}15`, color: task.color }}>
                                        <i className={`fas ${task.icon}`}></i>
                                    </div>
                                    <span className="fp-xp-pill">+{task.xp} XP</span>
                                </div>
                                <h3 className="fp-card-heading">{task.title}</h3>
                                <div className="fp-tags">
                                    {task.tags.slice(0, 2).map(t => <span key={t}>#{t}</span>)}
                                </div>
                                <button className="fp-btn-outline">Start</button>
                            </motion.div>
                        ))}
                    </motion.div>
                </div>
            )}

            {/* Upload Modal */}
            {submitModal.open && ReactDOM.createPortal(
                <div className="fp-modal-overlay">
                    <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="fp-modal">
                        <h3>Submit Assignment</h3>
                        <div className="fp-upload-box">
                            <input type="file" onChange={(e) => setFile(e.target.files[0])} />
                            <i className="fas fa-cloud-upload-alt"></i>
                            <p>{file ? file.name : "Tap to select file"}</p>
                        </div>
                        <div className="fp-modal-btns">
                            <button onClick={() => setSubmitModal({ open: false })} className="fp-btn-ghost">Cancel</button>
                            <button onClick={handleSubmitFile} disabled={uploading} className="fp-btn-primary">
                                {uploading ? 'Uploading...' : 'Submit'}
                            </button>
                        </div>
                    </motion.div>
                </div>,
                document.body
            )}

            {/* Sub-Modals */}
            <ResumeBuilderModal isOpen={isResumeModalOpen} onClose={() => setIsResumeModalOpen(false)} user={user} />
            <CodingChallengeModal isOpen={showCodingModal} onClose={() => setShowCodingModal(false)} user={user} onComplete={handleTaskComplete} />
            <TypingTestModal isOpen={showTypingModal} onClose={() => setShowTypingModal(false)} onComplete={handleTaskComplete} />
            <FlashCardModal isOpen={showFlashCardModal} onClose={() => setShowFlashCardModal(false)} user={user} onComplete={handleTaskComplete} />
        </div>
    );
}