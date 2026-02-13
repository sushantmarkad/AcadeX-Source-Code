import React, { useState, useEffect } from 'react';
import { db, auth, storage } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';
import ReactDOM from 'react-dom';
import CustomDropdown from '../components/CustomDropdown';
import NativeFriendlyDateInput from '../components/NativeFriendlyDateInput';
import { Capacitor } from '@capacitor/core';



const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function AddTasks({ teacherInfo }) {
    const [activeTab, setActiveTab] = useState('create');
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);

    // --- 🗑️ Delete Modal State ---
    const [deleteModal, setDeleteModal] = useState({ open: false, taskId: null });

    // --- 📝 Form State ---
   const [form, setForm] = useState({ title: '', description: '', targetYear: '', dueDate: '', maxMarks: '100' });
    const [file, setFile] = useState(null);

    // --- 🎓 Grading State ---
    const [gradingId, setGradingId] = useState(null);
    const [marks, setMarks] = useState('');
    const [feedback, setFeedback] = useState('');
    const [maxMarks, setMaxMarks] = useState(100);

    // --- ⚙️ Generate Options for Dropdown (Value = "Year|Div") ---
    const assignedTargets = teacherInfo?.assignedClasses
        ? [...new Set(teacherInfo.assignedClasses.flatMap(c => {
            if (c.year === 'FE' && c.divisions) {
                // Split FE into divisions: "FE|A", "FE|B"
                return c.divisions.split(',').map(d => ({
                    label: `FE - Div ${d.trim()}`,
                    value: `FE|${d.trim()}`
                }));
            }
            // Standard Years: "SE|All", "TE|All"
            return [{ label: `${c.year} Year`, value: `${c.year}|All` }];
        }))]
        : [];

    // --- 📥 Fetch Tasks ---
    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'assignments'), where('teacherId', '==', auth.currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            setTasks(data);
        });
        return () => unsub();
    }, []);

    // --- 📥 REAL-TIME SUBMISSIONS LISTENER ---
    useEffect(() => {
        if (!selectedTask) return;

        setLoading(true); // Show loading spinner in grid (optional)
        
        // Listen to submissions for the selected assignment in Real-Time
        const q = query(
            collection(db, 'submissions'), 
            where('assignmentId', '==', selectedTask.id)
        );

        const unsub = onSnapshot(q, (snapshot) => {
            const subs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setSubmissions(subs);
            setLoading(false);
        }, (error) => {
            console.error("Error fetching submissions:", error);
            toast.error("Sync error");
            setLoading(false);
        });

        return () => unsub();
    }, [selectedTask]);

    // --- 🗑️ DELETE LOGIC (Modal) ---
    const promptDelete = (e, taskId) => {
        e.stopPropagation(); // Stop click from opening submissions view
        setDeleteModal({ open: true, taskId });
    };

    const confirmDelete = async () => {
        if (!deleteModal.taskId) return;

        const toastId = toast.loading("Deleting assignment...");
        try {
            await deleteDoc(doc(db, 'assignments', deleteModal.taskId));
            toast.success("Assignment deleted successfully!", { id: toastId });
            setDeleteModal({ open: false, taskId: null }); // Close Modal
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete task.", { id: toastId });
        }
    };


    // --- 🚀 SUBMIT / CREATE LOGIC (Fixed: Uses Firestore Directly) ---
    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.targetYear) return toast.error("Please select a class.");
        if (!form.dueDate) return toast.error("Please set a due date.");

        setLoading(true);
        const toastId = toast.loading("Publishing Task...");

        try {
            // Parse "Year|Div" into separate variables
            const rawTarget = form.targetYear.includes('|') ? form.targetYear : `${form.targetYear}|All`;
            const [targetYear, targetDivision] = rawTarget.split('|');

            let attachmentUrl = "";
            if (file) {
                const fileRef = ref(storage, `assignments/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                attachmentUrl = await getDownloadURL(fileRef);
            }

            // 1. ✅ SAVE TO FIRESTORE DIRECTLY (Reliable)
            await addDoc(collection(db, 'assignments'), {
                title: form.title,
                description: form.description,
                targetYear: targetYear,        // Clean Year (e.g. "FE")
                division: targetDivision,      // Clean Division (e.g. "A")
                dueDate: form.dueDate,
                maxMarks: form.maxMarks || '100',
                attachmentUrl,
                teacherId: auth.currentUser.uid,
                teacherName: `${teacherInfo.firstName} ${teacherInfo.lastName}`,
                department: teacherInfo.department,
                instituteId: teacherInfo.instituteId,
                createdAt: new Date().toISOString()
            });

            // 2. Trigger Notification (Optional Backend Call - Non-blocking)
            fetch(`${BACKEND_URL}/sendAnnouncementNotification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `📝 New Assignment: ${form.title}`,
                    message: `Due Date: ${new Date(form.dueDate).toLocaleDateString()}. Check app for details.`,
                    targetYear: targetYear,
                    division: targetDivision,
                    instituteId: teacherInfo.instituteId,
                    department: teacherInfo.department,
                    senderName: `${teacherInfo.firstName} ${teacherInfo.lastName}`
                })
            }).catch(err => console.log("Notification trigger skipped:", err));

            toast.success("Assignment Live!", { id: toastId });
            setForm({ title: '', description: '', targetYear: '', dueDate: '' });
            setFile(null);

        } catch (err) {
            console.error(err);
            toast.error(`Failed: ${err.message}`, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

   // --- 📊 GRADING LOGIC (Updated) ---
    // 1. Just set the task (The useEffect below handles the fetching)
    const viewSubmissions = (task) => {
        setSubmissions([]); // Clear previous data instantly to prevent "ghost" data
        setSelectedTask(task);
    };

    const submitGrade = async (submissionId) => {
        if (!marks || marks < 0) return toast.error("Invalid marks");
        if (!maxMarks || maxMarks <= 0) return toast.error("Invalid total marks");
        
        try {
            await fetch(`${BACKEND_URL}/gradeSubmission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                // ✅ Sending maxMarks to backend
                body: JSON.stringify({ submissionId, marks, maxMarks, feedback }) 
            });
            toast.success("Graded!");
            setGradingId(null); 
            setMarks(''); 
            setMaxMarks(100); 
            setFeedback('');
            
            // ✅ Update local state instantly so you see changes immediately
            setSubmissions(prev => prev.map(s => 
                s.id === submissionId 
                ? { ...s, status: 'Graded', marks, maxMarks, feedback } 
                : s
            ));
        } catch (e) { toast.error("Failed to grade"); }
    };

    return (
        <div className="task-page-container">

            {/* --- HEADER --- */}
            <div className="task-header">
                <div>
                    <h2 className="gradient-text">Classroom Tasks</h2>
                    <p className="subtitle">Create assignments & track performance.</p>
                </div>
                <div className="toggle-container">
                    <button onClick={() => setActiveTab('create')} className={`toggle-btn ${activeTab === 'create' ? 'active-create' : ''}`}>
                        <i className="fas fa-plus"></i> Create
                    </button>
                    <button onClick={() => { setActiveTab('evaluate'); setSelectedTask(null); }} className={`toggle-btn ${activeTab === 'evaluate' ? 'active-eval' : ''}`}>
                        <i className="fas fa-check-double"></i> Evaluate
                    </button>
                </div>
            </div>

            {/* --- CREATE MODE --- */}
            {activeTab === 'create' && (
                <div className="create-card">
                    <div className="create-card-header">
                        <h3><i className="fas fa-magic"></i> New Assignment</h3>
                    </div>
                    <form onSubmit={handleCreate} className="create-form">
                        <div className="form-main">
                            <div className="input-group">
                                <label>Title</label>
                                <input required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Thermodynamics Project" />
                            </div>
                            <div className="input-group">
                                <label>Instructions</label>
                                <textarea required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows="6" placeholder="Explain the task details..." />
                            </div>
                        </div>
                        <div className="form-sidebar">
                            <div className="input-group">
                                <label>Target Class</label>
                                <CustomDropdown
                                    value={form.targetYear}
                                    // Safe check for event object vs direct value
                                    onChange={(e) => {
                                        const val = e.target ? e.target.value : e;
                                        setForm({ ...form, targetYear: val });
                                    }}
                                    placeholder="Select Class"
                                    options={assignedTargets}
                                />
                            </div>
                            {/* ✅ NEW: Total Marks Input */}
                            <div className="input-group">
                                <label>Total Marks (Out of)</label>
                                <input 
                                    type="number" 
                                    value={form.maxMarks} 
                                    onChange={(e) => setForm({ ...form, maxMarks: e.target.value })}
                                    placeholder="e.g. 20"
                                    style={{ fontWeight: 'bold', color: '#3b82f6' }}
                                />
                            </div>

                            {/* --- DATE PICKER (FIXED) --- */}
                            <div className="input-group">
                                <label>Deadline</label>
                                <NativeFriendlyDateInput
                                    required
                                    value={form.dueDate}
                                    onChange={(val) => setForm({ ...form, dueDate: val })}
                                    style={{
                                        background: '#f8fafc',
                                        border: '2px solid #f1f5f9',
                                        borderRadius: '10px'
                                    }}
                                />
                            </div>

                            <div className="file-upload-box">
                                <input type="file" id="file-upload" onChange={e => setFile(e.target.files[0])} hidden />
                                <label htmlFor="file-upload">
                                    <i className={`fas ${file ? 'fa-check-circle' : 'fa-cloud-upload-alt'}`}></i>
                                    {/* ✅ FIX: Added Text Truncation Styles */}
                                    <span style={{ 
                                        maxWidth: '220px', 
                                        whiteSpace: 'nowrap', 
                                        overflow: 'hidden', 
                                        textOverflow: 'ellipsis',
                                        display: 'block' 
                                    }}>
                                        {file ? file.name : "Attach PDF / IMG"}
                                    </span>
                                </label>
                            </div>
                            <button className="submit-btn" disabled={loading}>{loading ? 'Publishing...' : 'Publish Task'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- EVALUATE MODE (LIST) --- */}
            {activeTab === 'evaluate' && !selectedTask && (
                <div className="tasks-grid">
                    {tasks.map(task => (
                        <div key={task.id} className="task-card-modern" onClick={() => viewSubmissions(task)}>
                            <div className="card-top">
                                <span className={`badge ${task.targetYear === 'All' ? 'badge-all' : 'badge-year'}`}>
                                    {/* Badge Logic for Div vs All */}
                                    {task.targetYear === 'All'
                                        ? 'All Classes'
                                        : task.division && task.division !== 'All'
                                            ? `${task.targetYear} - Div ${task.division}`
                                            : `${task.targetYear} Year`
                                    }
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {task.attachmentUrl && <i className="fas fa-paperclip attachment-icon"></i>}
                                    <button className="delete-icon-btn" onClick={(e) => promptDelete(e, task.id)} title="Delete">
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            </div>
                            <h4>{task.title}</h4>
                            <div className="card-footer">
                                <span><i className="far fa-clock"></i> {new Date(task.dueDate).toLocaleDateString()}</span>
                                <span className="arrow-link">Open &rarr;</span>
                            </div>
                        </div>
                    ))}
                    {tasks.length === 0 && <div className="empty-state">No active assignments found.</div>}
                </div>
            )}

            {/* --- 🚀 NEW EVALUATION WORKSPACE (Mobile Optimized) --- */}
            {activeTab === 'evaluate' && selectedTask && (
                <div className="eval-workspace">

                    {/* Header */}
                    <div className="eval-header-modern">
                        <button onClick={() => setSelectedTask(null)} className="eval-back-btn">
                            <i className="fas fa-arrow-left"></i>
                        </button>
                        <div className="eval-title-group">
                            <h3>{selectedTask.title}</h3>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <span className="eval-subtitle">{submissions.length} Submissions</span>
                                
                                {/* ✅ NEW: Teacher can view their own uploaded file */}
                                {selectedTask.attachmentUrl && (
                                    <a 
                                        href={selectedTask.attachmentUrl} 
                                        target="_blank" 
                                        rel="noreferrer"
                                        style={{ 
                                            fontSize: '12px', 
                                            color: '#3b82f6', 
                                            textDecoration: 'none', 
                                            fontWeight: '600',
                                            background: '#eff6ff',
                                            padding: '4px 10px',
                                            borderRadius: '20px'
                                        }}
                                    >
                                        <i className="fas fa-paperclip"></i> View My Assignment
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                    {/* Responsive Grid */}
                    <div className="eval-grid">
                        {submissions.map(sub => (
                            <div key={sub.id} className={`eval-card ${sub.status === 'Graded' ? 'is-graded' : ''}`}>
                                
                                {/* Top: Student Info */}
                                <div className="eval-card-top">
                                    <div className="eval-avatar">
                                        {sub.studentName.charAt(0)}
                                    </div>
                                    <div>
                                        <h4 className="eval-student-name">{sub.studentName}</h4>
                                        <span className="eval-roll-badge">Roll No. {sub.rollNo}</span>
                                    </div>
                                    {/* Status Badge */}
                                    <div style={{ marginLeft: 'auto' }}>
                                        {sub.status === 'Graded' ? (
                                            <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                Graded
                                            </span>
                                        ) : (
                                            <span style={{ fontSize: '10px', background: '#f1f5f9', color: '#64748b', padding: '3px 8px', borderRadius: '10px', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                                Pending
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Middle: Document Link */}
                                <div className="eval-content-box">
                                    <a href={sub.documentUrl} target="_blank" rel="noreferrer" className="eval-view-link">
                                        <i className="fas fa-file-pdf"></i> View Submitted Work
                                    </a>
                                </div>

                                {/* ✅ FEEDBACK SECTION (Visible when Graded) */}
                                {sub.status === 'Graded' && sub.feedback && (
                                    <div style={{ 
                                        marginTop: '5px',
                                        padding: '10px 12px', 
                                        background: '#f0fdf4', 
                                        borderLeft: '3px solid #16a34a', 
                                        borderRadius: '6px', 
                                        fontSize: '12px', 
                                        color: '#15803d',
                                        lineHeight: '1.4'
                                    }}>
                                        <div style={{ fontWeight: 'bold', marginBottom: '2px', fontSize: '10px', textTransform: 'uppercase', opacity: 0.8 }}>
                                            <i className="fas fa-comment-dots"></i> Feedback:
                                        </div>
                                        <span style={{ fontStyle: 'italic' }}>"{sub.feedback}"</span>
                                    </div>
                                )}

                                {/* Bottom: Grading Action */}
                                <div className="eval-action-area">
                                    {sub.status === 'Graded' ? (
                                        <div className="eval-score-display" style={{ width: '100%', justifyContent: 'space-between', padding: '5px 0' }}>
                                            <span className="eval-score-label">Final Score</span>
                                            <span className={`eval-score-value ${sub.marks >= (sub.maxMarks * 0.4) ? 'score-pass' : 'score-fail'}`} style={{ fontSize: '20px' }}>
                                                {sub.marks} <span className="eval-total" style={{ fontSize: '14px' }}>/ {sub.maxMarks || 100}</span>
                                            </span>
                                            
                                            {/* Re-Grade Button (Small) */}
                                            <button 
                                                onClick={() => { setGradingId(sub.id); setMarks(sub.marks); setMaxMarks(sub.maxMarks || 100); setFeedback(sub.feedback); }}
                                                style={{ border: 'none', background: 'transparent', color: '#94a3b8', cursor: 'pointer', fontSize: '12px', marginLeft: '10px' }}
                                                title="Edit Grade"
                                            >
                                                <i className="fas fa-pen"></i>
                                            </button>
                                        </div>
                                    ) : gradingId === sub.id ? (
                                        <div className="eval-grading-form" style={{ width: '100%', flexDirection: 'column', gap: '10px' }}>
                                            {/* Marks Inputs */}
                                            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Marks</label>
                                                    <input 
                                                        type="number" 
                                                        value={marks} 
                                                        onChange={e => setMarks(e.target.value)} 
                                                        autoFocus 
                                                        className="eval-input-marks"
                                                        style={{ width: '100%', padding: '8px', border: '2px solid #3b82f6', borderRadius: '8px', fontWeight: 'bold' }}
                                                    />
                                                </div>
                                                <div style={{ flex: 1 }}>
                                                    <label style={{ fontSize: '10px', fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase' }}>Total</label>
                                                    <input 
                                                        type="number" 
                                                        value={maxMarks} 
                                                        onChange={e => setMaxMarks(e.target.value)} 
                                                        className="eval-input-marks"
                                                        style={{ width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '8px', fontWeight: 'bold', background: '#f8fafc' }}
                                                    />
                                                </div>
                                            </div>
                                            
                                            {/* Feedback Input */}
                                            <div style={{ width: '100%' }}>
                                                <input 
                                                    type="text" 
                                                    placeholder="Feedback (Optional)" 
                                                    value={feedback} 
                                                    onChange={e => setFeedback(e.target.value)} 
                                                    className="eval-input-feedback"
                                                    style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: '12px' }}
                                                />
                                            </div>

                                            {/* Action Buttons */}
                                            <div className="eval-form-actions" style={{ flexDirection: 'row', gap: '10px', width: '100%' }}>
                                                <button onClick={() => submitGrade(sub.id)} className="eval-btn-save" style={{ flex: 1, borderRadius: '8px', height: '36px' }}>
                                                    <i className="fas fa-check"></i> Save
                                                </button>
                                                <button onClick={() => setGradingId(null)} className="eval-btn-cancel" style={{ flex: 1, borderRadius: '8px', height: '36px', background: '#f1f5f9', color: '#64748b' }}>
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button 
                                            onClick={() => { 
                                                setGradingId(sub.id); 
                                                setMarks(''); 
                                                // ✅ USE ASSIGNMENT DEFAULT OR 100
                                                setMaxMarks(selectedTask.maxMarks || 100); 
                                                setFeedback(''); 
                                            }} 
                                            className="eval-btn-grade"
                                        >
                                            Grade Work
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        {submissions.length === 0 && (
                            <div className="eval-empty-state">
                                <i className="fas fa-inbox"></i>
                                <p>No submissions received yet.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ✅ DELETE MODAL - NOW USING PORTAL TO COVER SIDEBAR */}
            {deleteModal.open && ReactDOM.createPortal(
                <div className="delete-modal-overlay">
                    <div className="delete-modal-content">
                        <div className="delete-icon-wrapper">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3>Delete Assignment?</h3>
                        <p>This action cannot be undone. All student submissions for this task will also be deleted.</p>
                        <div className="delete-modal-actions">
                            <button
                                className="btn-modal-cancel"
                                onClick={() => setDeleteModal({ open: false, taskId: null })}
                            >
                                Cancel
                            </button>
                            <button
                                className="btn-modal-confirm"
                                onClick={confirmDelete}
                            >
                                Yes, Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body // 👈 This renders it directly on top of the entire page
            )}

            {/* --- CSS STYLES --- */}
            <style>{`
            /* --- 🚀 NEW EVAL STYLES (Mobile First) --- */

/* Workspace Container */
.eval-workspace {
    background: #f8fafc;
    border-radius: 20px;
    min-height: 500px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid #e2e8f0;
}

/* Header */
.eval-header-modern {
    background: white;
    padding: 20px;
    border-bottom: 1px solid #f1f5f9;
    display: flex;
    align-items: center;
    gap: 15px;
    position: sticky;
    top: 0;
    z-index: 10;
}

.eval-back-btn {
    background: #f1f5f9;
    border: none;
    width: 40px;
    height: 40px;
    border-radius: 12px;
    color: #64748b;
    cursor: pointer;
    transition: all 0.2s;
}
.eval-back-btn:hover { background: #e2e8f0; color: #334155; }

.eval-title-group h3 {
    margin: 0;
    font-size: 18px;
    color: #1e293b;
    font-weight: 700;
}
.eval-subtitle {
    font-size: 12px;
    color: #94a3b8;
    font-weight: 600;
}

/* Grid Layout */
.eval-grid {
    padding: 20px;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 20px;
    overflow-y: auto;
    height: 100%;
}

/* Card Style */
.eval-card {
    background: white;
    border-radius: 16px;
    padding: 20px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
    border: 1px solid #f1f5f9;
    transition: transform 0.2s;
    display: flex;
    flex-direction: column;
    gap: 15px;
}
.eval-card.is-graded { border-color: #dcfce7; background: #f0fdf4; }

/* Student Info */
.eval-card-top {
    display: flex;
    align-items: center;
    gap: 12px;
}
.eval-avatar {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: bold;
    font-size: 16px;
}
.eval-student-name {
    margin: 0;
    font-size: 15px;
    color: #334155;
    font-weight: 700;
}
.eval-roll-badge {
    font-size: 11px;
    background: #f1f5f9;
    padding: 2px 8px;
    border-radius: 6px;
    color: #64748b;
    font-weight: 600;
}
.eval-success-icon {
    margin-left: auto;
    color: #16a34a;
    font-size: 18px;
}

/* Document Link */
.eval-content-box {
    background: #f8fafc;
    padding: 10px;
    border-radius: 10px;
    border: 1px dashed #cbd5e1;
    text-align: center;
}
.eval-view-link {
    text-decoration: none;
    color: #2563eb;
    font-size: 13px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
}

/* Grading Area */
.eval-action-area {
    margin-top: auto;
    padding-top: 15px;
    border-top: 1px solid #f1f5f9;
}

/* Button to Grade */
.eval-btn-grade {
    width: 100%;
    padding: 10px;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 10px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);
}

/* Grading Form */
.eval-grading-form {
    display: flex;
    gap: 10px;
    align-items: center;
}
.eval-inputs {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.eval-input-marks {
    padding: 8px;
    border: 1px solid #3b82f6;
    border-radius: 8px;
    outline: none;
    width: 100%;
    font-weight: bold;
}
.eval-input-feedback {
    padding: 8px;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    outline: none;
    width: 100%;
    font-size: 12px;
}
.eval-form-actions {
    display: flex;
    flex-direction: column;
    gap: 5px;
}
.eval-btn-save {
    width: 32px;
    height: 32px;
    background: #16a34a;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}
.eval-btn-cancel {
    width: 32px;
    height: 32px;
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 8px;
    cursor: pointer;
}

/* Score Display */
.eval-score-display {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: white;
}
.eval-score-label {
    font-size: 12px;
    color: #64748b;
    font-weight: 700;
    text-transform: uppercase;
}
.eval-score-value {
    font-size: 18px;
    font-weight: 800;
}
.score-pass { color: #16a34a; }
.score-fail { color: #dc2626; }
.eval-total { font-size: 12px; color: #94a3b8; font-weight: 500; }

.eval-empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 60px;
    color: #cbd5e1;
}
.eval-empty-state i { font-size: 40px; margin-bottom: 10px; }

/* Mobile Adjustments */
@media (max-width: 480px) {
    .eval-grid {
        grid-template-columns: 1fr;
        padding: 15px;
    }
    .eval-workspace {
        border-radius: 0;
        border: none;
    }
}
                .task-page-container { max-width: 1200px; margin: 0 auto; padding-bottom: 50px; }
                .gradient-text { background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-size: 24px; font-weight: 700; margin: 0; }
                .subtitle { color: #64748b; font-size: 14px; margin-top: 5px; }
                .task-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
                
                .toggle-container { background: white; padding: 4px; border-radius: 12px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); display: flex; gap: 5px; }
                .toggle-btn { padding: 8px 16px; border: none; background: transparent; color: #64748b; border-radius: 8px; font-weight: 600; cursor: pointer; transition: all 0.3s; font-size: 13px; }
                .active-create { background: #f3e8ff; color: #7c3aed; }
                .active-eval { background: #fce7f3; color: #db2777; }

                .create-card { background: white; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.08); overflow: visible !important; border: 1px solid #f1f5f9; }
                .create-card-header { background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); padding: 15px 25px; color: white; border-top-left-radius: 20px; border-top-right-radius: 20px; }
                .create-card-header h3 { margin: 0; font-size: 16px; font-weight: 600; }
                .create-form { padding: 25px; display: grid; grid-template-columns: 2fr 1fr; gap: 30px; }

                .input-group label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 6px; text-transform: uppercase; }
                .input-group input, .input-group textarea, .input-group select { width: 100%; padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px; font-size: 14px; background: #f8fafc; color: #334155; }
                .input-group input:focus, .input-group textarea:focus { border-color: #d946ef; outline: none; background: white; }

                .file-upload-box label { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px; border: 2px dashed #cbd5e1; border-radius: 12px; cursor: pointer; color: #64748b; transition: all 0.2s; }
                .file-upload-box label:hover { background: #fdf4ff; border-color: #d946ef; }
                .file-upload-box i { font-size: 24px; margin-bottom: 8px; color: #d946ef; }

                .submit-btn { width: 100%; padding: 14px; background: linear-gradient(90deg, #7c3aed, #db2777); color: white; border: none; border-radius: 10px; font-weight: 600; margin-top: 15px; cursor: pointer; box-shadow: 0 4px 15px rgba(219, 39, 119, 0.3); }

                .tasks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
                .task-card-modern { background: white; border-radius: 16px; padding: 20px; border: 1px solid #f1f5f9; box-shadow: 0 4px 6px rgba(0,0,0,0.02); cursor: pointer; transition: transform 0.2s; }
                .task-card-modern:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08); }
                .card-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
                .badge { font-size: 10px; padding: 4px 10px; border-radius: 20px; font-weight: 700; text-transform: uppercase; }
                .badge-all { background: #f3e8ff; color: #7c3aed; }
                .badge-year { background: #ecfeff; color: #06b6d4; }
                .attachment-icon { color: #cbd5e1; }
                .task-card-modern h4 { margin: 0 0 15px 0; color: #334155; font-size: 16px; line-height: 1.4; }
                .card-footer { border-top: 1px solid #f8fafc; padding-top: 15px; display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; }
                .arrow-link { color: #d946ef; font-weight: 600; }

                /* DELETE ICON BTN */
                .delete-icon-btn { background: #fee2e2; border: none; color: #ef4444; width: 28px; height: 28px; border-radius: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s; font-size: 12px; }
                .delete-icon-btn:hover { background: #ef4444; color: white; transform: scale(1.1); }

                /* DELETE MODAL */
                /* ✅ REPLACE THIS CSS CLASS IN AddTasks.js */
.delete-modal-overlay {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 2147483647; /* 🔥 Max Safe Integer Z-Index to beat Sidebar */
    display: flex;
    align-items: center;
    justify-content: center;
    animation: fadeIn 0.2s ease-out;
}
                .delete-modal-content { background: white; padding: 30px; border-radius: 24px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid #f1f5f9; }
                .delete-icon-wrapper { width: 60px; height: 60px; background: #fef2f2; color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 20px auto; box-shadow: 0 0 0 8px #fff1f2; }
                .delete-modal-content h3 { margin: 0 0 10px 0; color: #1e293b; font-size: 20px; font-weight: 700; }
                .delete-modal-content p { margin: 0 0 25px 0; color: #64748b; font-size: 14px; line-height: 1.5; }
                .delete-modal-actions { display: flex; gap: 12px; }
                .btn-modal-cancel { flex: 1; padding: 12px; border: 1px solid #e2e8f0; background: white; color: #64748b; border-radius: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .btn-modal-cancel:hover { background: #f8fafc; color: #1e293b; }
                .btn-modal-confirm { flex: 1; padding: 12px; border: none; background: #ef4444; color: white; border-radius: 12px; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); transition: all 0.2s; }
                .btn-modal-confirm:hover { background: #dc2626; transform: translateY(-1px); }

                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }

                .grading-container { background: white; border-radius: 16px; box-shadow: 0 4px 20px rgba(0,0,0,0.05); overflow: hidden; }
                .grading-header { padding: 15px 20px; border-bottom: 1px solid #f1f5f9; display: flex; align-items: center; gap: 15px; }
                .back-btn { border: 1px solid #e2e8f0; background: white; padding: 5px 12px; border-radius: 8px; cursor: pointer; color: #64748b; }
                .table-responsive { overflow-x: auto; }
                .modern-table { width: 100%; border-collapse: collapse; min-width: 600px; }
                .modern-table th { text-align: left; padding: 15px 20px; color: #64748b; font-size: 12px; text-transform: uppercase; border-bottom: 1px solid #f1f5f9; background: #fdfbff; }
                .modern-table td { padding: 15px 20px; border-bottom: 1px solid #f8fafc; color: #334155; font-size: 14px; }
                .roll-tag { background: #f1f5f9; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
                .view-doc-btn { text-decoration: none; color: #d946ef; font-weight: 500; font-size: 13px; background: #fdf4ff; padding: 5px 12px; border-radius: 15px; }
                .score { font-weight: 800; font-size: 15px; }
                .pass { color: #10b981; } .fail { color: #ef4444; }
                .btn-grade { background: #fdf4ff; color: #d946ef; border: 1px solid #d946ef; padding: 5px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; font-weight: 600; }
                .grading-inputs { display: flex; gap: 5px; }
                .grading-inputs input { border: 1px solid #cbd5e1; padding: 5px; border-radius: 6px; font-size: 13px; }
                .action-row { display: flex; gap: 5px; }
                .btn-save { background: #10b981; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; }
                .btn-cancel { background: #ef4444; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; }

                @media (max-width: 768px) {
                    .task-header { flex-direction: column; align-items: flex-start; gap: 15px; }
                    .toggle-container { width: 100%; justify-content: space-between; }
                    .toggle-btn { flex: 1; text-align: center; }
                    .create-form { grid-template-columns: 1fr; gap: 20px; padding: 20px; }
                    .tasks-grid { grid-template-columns: 1fr; }
                }
            `}</style>
        </div>
    );
}