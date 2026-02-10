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
    const [form, setForm] = useState({ title: '', description: '', targetYear: '', dueDate: '' });
    const [file, setFile] = useState(null);

    // --- 🎓 Grading State ---
    const [gradingId, setGradingId] = useState(null);
    const [marks, setMarks] = useState('');
    const [feedback, setFeedback] = useState('');

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

    // --- 📊 GRADING LOGIC ---
    const viewSubmissions = async (task) => {
        setSelectedTask(task);
        const toastId = toast.loading("Fetching Submissions...");
        try {
            const res = await fetch(`${BACKEND_URL}/getSubmissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ assignmentId: task.id })
            });
            const data = await res.json();
            setSubmissions(data.submissions);
            toast.dismiss(toastId);
        } catch (err) { toast.error("Error fetching.", { id: toastId }); }
    };

    const submitGrade = async (submissionId) => {
        if (!marks || marks > 100 || marks < 0) return toast.error("Invalid marks (0-100)");
        try {
            await fetch(`${BACKEND_URL}/gradeSubmission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, marks, feedback })
            });
            toast.success("Graded!");
            setGradingId(null); setMarks(''); setFeedback('');
            setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'Graded', marks, feedback } : s));
        } catch (e) { toast.error("Failed"); }
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
                                    <span>{file ? file.name : "Attach PDF / IMG"}</span>
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

            {/* --- GRADING TABLE --- */}
            {activeTab === 'evaluate' && selectedTask && (
                <div className="grading-container">
                    <div className="grading-header">
                        <button onClick={() => setSelectedTask(null)} className="back-btn"><i className="fas fa-chevron-left"></i> Back</button>
                        <h3>{selectedTask.title} <span style={{ fontWeight: '400', fontSize: '14px', opacity: 0.7 }}>| Submissions</span></h3>
                    </div>
                    <div className="table-responsive">
                        <table className="modern-table">
                            <thead><tr><th>Student</th><th>Roll No</th><th>Work</th><th>Score</th><th>Action</th></tr></thead>
                            <tbody>
                                {submissions.map(sub => (
                                    <tr key={sub.id}>
                                        <td className="fw-bold">{sub.studentName}</td>
                                        <td><span className="roll-tag">{sub.rollNo}</span></td>
                                        <td><a href={sub.documentUrl} target="_blank" rel="noreferrer" className="view-doc-btn"><i className="fas fa-eye"></i> View</a></td>
                                        <td>
                                            {sub.status === 'Graded' ? <span className={`score ${sub.marks >= 40 ? 'pass' : 'fail'}`}>{sub.marks}/100</span> : 
                                            gradingId === sub.id ? (
                                                <div className="grading-inputs">
                                                    <input type="number" placeholder="00" value={marks} onChange={e => setMarks(e.target.value)} autoFocus />
                                                    <input type="text" placeholder="Note..." value={feedback} onChange={e => setFeedback(e.target.value)} />
                                                </div>
                                            ) : <span className="status-pending">Pending</span>}
                                        </td>
                                        <td>
                                            {sub.status !== 'Graded' && (gradingId === sub.id ? (
                                                <div className="action-row">
                                                    <button onClick={() => submitGrade(sub.id)} className="btn-save"><i className="fas fa-check"></i></button>
                                                    <button onClick={() => setGradingId(null)} className="btn-cancel"><i className="fas fa-times"></i></button>
                                                </div>
                                            ) : <button onClick={() => { setGradingId(sub.id); setMarks(''); setFeedback(''); }} className="btn-grade">Grade</button>)}
                                            {sub.status === 'Graded' && <i className="fas fa-check-circle text-success"></i>}
                                        </td>
                                    </tr>
                                ))}
                                {submissions.length === 0 && <tr><td colSpan="5" className="text-center">No submissions yet.</td></tr>}
                            </tbody>
                        </table>
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