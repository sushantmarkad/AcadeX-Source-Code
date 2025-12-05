import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import './Dashboard.css';
import ResumeBuilderModal from '../components/ResumeBuilderModal';
import CodingChallengeModal from '../components/CodingChallengeModal'; // ✅ Import

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// ✅ Added Coding Challenge
const GAMIFIED_TASKS = [
    { id: 1, title: 'Daily Coding Challenge', time: '20 min', type: 'Coding', xp: 50, color: '#8b5cf6', icon: 'fa-laptop-code' },
    { id: 2, title: 'Read Tech News', time: '10 min', type: 'Reading', xp: 30, color: '#10b981', icon: 'fa-newspaper' },
    { id: 3, title: 'Update Resume', time: '30 min', type: 'Career', xp: 50, color: '#f59e0b', icon: 'fa-file-alt' },
];

export default function FreePeriodTasks({ user }) {
    const [activeTab, setActiveTab] = useState('assignments'); 
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
    const [isCodingModalOpen, setIsCodingModalOpen] = useState(false); // ✅ State
    
    const [assignments, setAssignments] = useState([]);
    const [submissions, setSubmissions] = useState({}); 
    const [submitModal, setSubmitModal] = useState({ open: false, taskId: null });
    const [file, setFile] = useState(null);
    const [uploading, setUploading] = useState(false);

    // ... (Keep existing useEffects & handleSubmitFile unchanged) ...
    useEffect(() => {
        const fetchAssignments = async () => {
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
        if (user) fetchAssignments();
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

    const handleSubmitFile = async () => {
        if (!file) return toast.error("Please select a PDF");
        setUploading(true);
        const toastId = toast.loading("Uploading...");

        const formData = new FormData();
        formData.append('studentId', user.uid);
        formData.append('studentName', `${user.firstName} ${user.lastName}`);
        formData.append('rollNo', user.rollNo);
        formData.append('assignmentId', submitModal.taskId);
        formData.append('document', file);

        try {
            const res = await fetch(`${BACKEND_URL}/submitAssignment`, { method: 'POST', body: formData });
            const data = await res.json();
            if (res.ok) {
                toast.success("Submitted!", { id: toastId });
                setSubmitModal({ open: false, taskId: null });
                setFile(null);
            } else {
                throw new Error(data.error);
            }
        } catch (e) { toast.error(e.message, { id: toastId }); }
        finally { setUploading(false); }
    };


    // ✅ Handle Task Click
    const handleTaskStart = (task) => {
        if (task.title === 'Update Resume') setIsResumeModalOpen(true);
        else if (task.type === 'Coding') setIsCodingModalOpen(true); // ✅ Open Coding Modal
        else toast.success(`Started: ${task.title}`);
    };

    return (
        <div className="content-section">
            <div style={{marginBottom: '30px', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                <div>
                    <h2 className="content-title">My Tasks</h2>
                    <p className="content-subtitle">Manage your homework & personal growth.</p>
                </div>
            </div>
            
            <div className="modern-tabs">
                <button className={`modern-tab ${activeTab === 'assignments' ? 'active' : ''}`} onClick={() => setActiveTab('assignments')}>
                    <i className="fas fa-book-reader"></i> Assignments
                </button>
                <button className={`modern-tab ${activeTab === 'gamified' ? 'active' : ''}`} onClick={() => setActiveTab('gamified')}>
                    <i className="fas fa-rocket"></i> Productivity Hub
                </button>
            </div>

            {/* --- TAB 1: TEACHER ASSIGNMENTS --- */}
            {activeTab === 'assignments' && (
                <div className="tasks-grid">
                    {assignments.map((task, index) => {
                        const sub = submissions[task.id]; 
                        const isGraded = sub?.status === 'Graded';

                        return (
                            <motion.div 
                                key={task.id} className="task-card"
                                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}
                                whileHover={{ y: -5 }}
                            >
                                <div className="task-card-header">
                                    <div className="task-icon-box" style={{ background: '#e0f2fe', color: '#0284c7' }}>
                                        <i className="fas fa-graduation-cap"></i>
                                    </div>
                                    {sub ? (
                                        <span className={`status-pill ${isGraded ? 'graded' : 'submitted'}`}>
                                            {isGraded ? `${sub.marks}/100` : 'Under Review'}
                                        </span>
                                    ) : <span className="status-pill pending">To Do</span>}
                                </div>
                                
                                <div className="task-body">
                                    <h3 className="task-title">{task.title}</h3>
                                    <p className="task-desc">{task.description}</p>
                                </div>
                                
                                <div className="task-meta-row">
                                    <div className="meta-item"><i className="far fa-calendar-alt"></i> {new Date(task.dueDate).toLocaleDateString()}</div>
                                    <div className="meta-item"><i className="fas fa-chalkboard-teacher"></i> {task.teacherName}</div>
                                </div>

                                <div className="task-footer">
                                    {sub ? (
                                        <button className="btn-completed"><i className="fas fa-check-circle"></i> {isGraded ? 'Graded' : 'Submitted'}</button>
                                    ) : (
                                        <button className="btn-primary-action" onClick={() => setSubmitModal({ open: true, taskId: task.id })}>
                                            Submit Assignment <i className="fas fa-arrow-right"></i>
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        );
                    })}
                    {assignments.length === 0 && <div className="empty-state"><div className="empty-icon">🎉</div><h3>All Caught Up!</h3><p>No pending assignments for now.</p></div>}
                </div>
            )}

            {/* --- TAB 2: GAMIFIED TASKS --- */}
            {activeTab === 'gamified' && (
                <div className="tasks-grid">
                    {GAMIFIED_TASKS.map((task, index) => (
                        <motion.div key={task.id} className="task-card" whileHover={{ y: -5 }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }}>
                            <div className="task-card-header">
                                <div className="task-icon-box" style={{ background: `${task.color}15`, color: task.color }}>
                                    <i className={`fas ${task.icon}`}></i>
                                </div>
                                <span className="xp-badge">+{task.xp} XP</span>
                            </div>

                            <div className="task-body">
                                <h3 className="task-title">{task.title}</h3>
                                <p className="task-desc">Boost your career with this quick {task.time} task.</p>
                            </div>
                            
                            <div className="task-meta-row">
                                <div className="meta-item"><i className="far fa-clock"></i> {task.time}</div>
                                <div className="meta-item"><i className="fas fa-tag"></i> {task.type}</div>
                            </div>

                            <div className="task-footer">
                                <button className="btn-start-action" onClick={() => handleTaskStart(task)}>
                                    <i className="fas fa-play"></i> Start Activity
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {submitModal.open && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box">
                        <h3>Upload Submission</h3>
                        <p style={{marginBottom:'20px', color:'#64748b'}}>Select your PDF file to submit.</p>
                        <div className="file-input-wrapper">
                            <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0])} id="file-upload" hidden />
                            <label htmlFor="file-upload" className="file-drop-zone">
                                <i className="fas fa-cloud-upload-alt" style={{fontSize:'24px', marginBottom:'10px', color:'#3b82f6'}}></i>
                                <span>{file ? file.name : "Click to Upload PDF"}</span>
                            </label>
                        </div>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setSubmitModal({ open: false, taskId: null })}>Cancel</button>
                            <button className="btn-primary" onClick={handleSubmitFile} disabled={uploading}>{uploading ? 'Uploading...' : 'Submit Task'}</button>
                        </div>
                    </div>
                </div>
            )}

            <ResumeBuilderModal isOpen={isResumeModalOpen} onClose={() => setIsResumeModalOpen(false)} user={user} />
            
            {/* ✅ CODING MODAL */}
            <CodingChallengeModal isOpen={isCodingModalOpen} onClose={() => setIsCodingModalOpen(false)} user={user} />
        </div>
    );
}