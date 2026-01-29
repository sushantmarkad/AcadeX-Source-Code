import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// ✅ 1. Accept 'teacherInfo' as a prop (Passed from TeacherDashboard)
export default function AddTasks({ teacherInfo }) {
    const [activeTab, setActiveTab] = useState('create'); 
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null); 
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [form, setForm] = useState({ title: '', description: '', targetYear: '', dueDate: '' });
    
    // Grading State
    const [gradingId, setGradingId] = useState(null);
    const [marks, setMarks] = useState('');
    const [feedback, setFeedback] = useState('');

    // ✅ 2. Extract Assigned Years (Filter for Dropdown)
    const assignedYears = teacherInfo?.assignedClasses 
        ? [...new Set(teacherInfo.assignedClasses.map(c => c.year))] 
        : [];

    // Fetch Tasks Created by this Teacher
    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'assignments'), where('teacherId', '==', auth.currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            setTasks(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        
        if (!teacherInfo || !auth.currentUser) {
            toast.error("Profile data missing. Please refresh.");
            return;
        }

        if (!form.targetYear) {
            return toast.error("Please select a target class.");
        }
        
        setLoading(true);
        const toastId = toast.loading("Assigning Task...");
        
        try {
            if (!form.dueDate) {
                 toast.error("Please set a due date.", { id: toastId });
                 setLoading(false);
                 return;
            }
            if (new Date(form.dueDate) < new Date(new Date().setHours(0,0,0,0))) {
                toast.error("Due date must be in the future.", { id: toastId });
                setLoading(false);
                return;
            }

            // Prepare task data using teacherInfo prop
            const taskData = {
                ...form,
                teacherId: auth.currentUser.uid,
                teacherName: teacherInfo.firstName || 'Staff Teacher',
                department: teacherInfo.department || 'General',
                instituteId: teacherInfo.instituteId 
            };

            const response = await fetch(`${BACKEND_URL}/createAssignment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Backend responded with status: ${response.status}`);
            }

            toast.success("Task Assigned!", { id: toastId });

            // Reset form
            setForm({ title: '', description: '', targetYear: '', dueDate: '' });

        } catch (err) { 
            console.error("Task creation failed:", err);
            toast.error(`Failed: ${err.message}`, { id: toastId }); 
        }
        finally { setLoading(false); }
    };

    const viewSubmissions = async (task) => {
        setSelectedTask(task);
        const toastId = toast.loading("Loading Submissions...");
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
        if(!marks) return toast.error("Enter marks!");
        if(marks > 100 || marks < 0) return toast.error("Marks must be 0-100");
        
        try {
            await fetch(`${BACKEND_URL}/gradeSubmission`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ submissionId, marks, feedback })
            });
            toast.success("Graded successfully!");
            setGradingId(null);
            setMarks('');
            setFeedback('');
            // Update local state to reflect the grading immediately
            setSubmissions(prev => prev.map(s => s.id === submissionId ? { ...s, status: 'Graded', marks, feedback } : s));
        } catch (e) { toast.error("Failed to save grade"); }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Assignments & Grading</h2>
            
            <div className="task-tabs">
                <button className={`task-tab ${activeTab === 'create' ? 'active' : ''}`} onClick={() => setActiveTab('create')}>Create New</button>
                <button className={`task-tab ${activeTab === 'evaluate' ? 'active' : ''}`} onClick={() => { setActiveTab('evaluate'); setSelectedTask(null); }}>Evaluate</button>
            </div>

            {/* --- CREATE MODE --- */}
            {activeTab === 'create' && (
                <div className="card">
                    <h3>Assign New Task</h3>
                    <form onSubmit={handleCreate} style={{marginTop:'20px'}}>
                        <div className="input-group">
                            <label>Target Audience</label>
                            {/* ✅ UPDATED: Only shows assigned years */}
                            <select 
                                value={form.targetYear} 
                                onChange={e => setForm({...form, targetYear: e.target.value})}
                                required
                                className="modern-select"
                            >
                                <option value="">Select Class</option>
                                <option value="All">All My Classes</option>
                                {assignedYears.length > 0 ? (
                                    assignedYears.map(year => (
                                        <option key={year} value={year}>{year} Year</option>
                                    ))
                                ) : (
                                    <option disabled>No classes assigned</option>
                                )}
                            </select>
                        </div>
                        <div className="input-group"><label>Title</label><input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Write a Report on AI" /></div>
                        <div className="input-group"><label>Description</label><textarea className="modern-input" rows="4" required value={form.description} onChange={e => setForm({...form, description: e.target.value})} style={{lineHeight:'1.6'}} /></div>
                        <div className="input-group"><label>Due Date</label><input type="date" required value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} /></div>
                        <button className="btn-primary" disabled={loading}>{loading ? 'Assigning...' : 'Assign Task'}</button>
                    </form>
                </div>
            )}

            {/* --- EVALUATE MODE (Modern Card List) --- */}
            {activeTab === 'evaluate' && !selectedTask && (
                <div className="tasks-grid">
                    {tasks.map(task => (
                        <div key={task.id} className="task-card" onClick={() => viewSubmissions(task)} style={{cursor: 'pointer'}}>
                            <div className="task-card-header">
                                <div className="task-icon" style={{background:'#eff6ff', color:'#2563eb'}}><i className="fas fa-clipboard-list"></i></div>
                                <span className="status-badge-pill" style={{background:'#f3f4f6', color:'#4b5563'}}>
                                    {task.targetYear === 'All' ? 'All Years' : task.targetYear}
                                </span>
                            </div>
                            
                            <h3 className="task-title" style={{marginBottom:'8px'}}>{task.title}</h3>
                            
                            <div className="task-meta" style={{marginTop:'auto'}}>
                                <span><i className="far fa-calendar-alt"></i> Due: {new Date(task.dueDate).toLocaleDateString()}</span>
                            </div>

                            <button className="btn-secondary" style={{marginTop:'15px', width:'100%', fontSize:'13px'}}>
                                View Submissions &rarr;
                            </button>
                        </div>
                    ))}
                    {tasks.length === 0 && <div className="empty-state-card"><p>No tasks created yet.</p></div>}
                </div>
            )}

            {/* --- GRADING VIEW --- */}
            {activeTab === 'evaluate' && selectedTask && (
                <div>
                    <div style={{display:'flex', alignItems:'center', gap:'15px', marginBottom:'20px'}}>
                        <button onClick={() => setSelectedTask(null)} className="btn-ghost" style={{width:'auto'}}>← Back</button>
                        <h3 style={{margin:0}}>Submissions: {selectedTask.title}</h3>
                    </div>
                    
                    <div className="table-wrapper">
                        <table className="attendance-table">
                            <thead><tr><th>Student</th><th>Roll No</th><th>Document</th><th>Marks / Status</th><th>Action</th></tr></thead>
                            <tbody>
                                {submissions.map(sub => (
                                    <tr key={sub.id}>
                                        <td style={{fontWeight:'600'}}>{sub.studentName}</td>
                                        <td>{sub.rollNo}</td>
                                        <td>
                                            <a href={sub.documentUrl} target="_blank" rel="noreferrer" className="btn-link-doc">
                                                <i className="fas fa-file-pdf"></i> View PDF
                                            </a>
                                        </td>
                                        <td>
                                            {sub.status === 'Graded' ? (
                                                <div>
                                                    <span style={{fontSize:'15px', fontWeight:'800', color:'#15803d'}}>{sub.marks}</span>
                                                    <span style={{fontSize:'12px', color:'#64748b'}}>/100</span>
                                                    {sub.feedback && <div style={{fontSize:'11px', color:'#64748b', marginTop:'2px'}}>"{sub.feedback}"</div>}
                                                </div>
                                            ) : (
                                                gradingId === sub.id ? (
                                                    <div className="grading-wrapper">
                                                        <input type="number" className="grading-input" placeholder="0-100" value={marks} onChange={e => setMarks(e.target.value)} autoFocus />
                                                        <input type="text" className="grading-input-text" placeholder="Feedback (opt)..." value={feedback} onChange={e => setFeedback(e.target.value)} />
                                                    </div>
                                                ) : <span className="status-badge status-pending">Pending</span>
                                            )}
                                        </td>
                                        <td>
                                            {sub.status !== 'Graded' && (
                                                gradingId === sub.id ? (
                                                    <div style={{display:'flex', gap:'5px'}}>
                                                        <button onClick={() => submitGrade(sub.id)} className="btn-icon-check" title="Save"><i className="fas fa-check"></i></button>
                                                        <button onClick={() => setGradingId(null)} className="btn-icon-cancel" title="Cancel"><i className="fas fa-times"></i></button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => { setGradingId(sub.id); setMarks(''); setFeedback(''); }} className="btn-primary" style={{padding:'6px 12px', fontSize:'12px', width:'auto', margin:0}}>
                                                        Grade
                                                    </button>
                                                )
                                            )}
                                            {sub.status === 'Graded' && <span className="status-badge status-approved">Done</span>}
                                        </td>
                                    </tr>
                                ))}
                                {submissions.length === 0 && <tr><td colSpan="5" style={{textAlign:'center', padding:'30px', color:'#94a3b8'}}>No submissions received yet.</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}