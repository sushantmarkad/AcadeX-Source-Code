import React, { useState, useEffect } from 'react';
import { db, auth, storage } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import toast from 'react-hot-toast';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function AddTasks({ teacherInfo }) {
    const [activeTab, setActiveTab] = useState('create'); 
    const [tasks, setTasks] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null); 
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(false);

    // Form State
    const [form, setForm] = useState({ title: '', description: '', targetYear: '', dueDate: '' });
    const [file, setFile] = useState(null);

    // Grading State
    const [gradingId, setGradingId] = useState(null);
    const [marks, setMarks] = useState('');
    const [feedback, setFeedback] = useState('');

    const assignedYears = teacherInfo?.assignedClasses 
        ? [...new Set(teacherInfo.assignedClasses.map(c => c.year))] 
        : [];

    useEffect(() => {
        if (!auth.currentUser) return;
        const q = query(collection(db, 'assignments'), where('teacherId', '==', auth.currentUser.uid));
        const unsub = onSnapshot(q, (snap) => {
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
            data.sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt));
            setTasks(data);
        });
        return () => unsub();
    }, []);

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!form.targetYear) return toast.error("Please select a class.");
        if (!form.dueDate) return toast.error("Please set a due date.");
        
        setLoading(true);
        const toastId = toast.loading("Publishing Task...");
        
        try {
            let attachmentUrl = "";
            if (file) {
                const fileRef = ref(storage, `assignments/${auth.currentUser.uid}/${Date.now()}_${file.name}`);
                await uploadBytes(fileRef, file);
                attachmentUrl = await getDownloadURL(fileRef);
            }

            const taskData = {
                ...form,
                attachmentUrl,
                teacherId: auth.currentUser.uid,
                teacherName: `${teacherInfo.firstName} ${teacherInfo.lastName}`,
                department: teacherInfo.department,
                instituteId: teacherInfo.instituteId,
                createdAt: new Date().toISOString()
            };

            const response = await fetch(`${BACKEND_URL}/createAssignment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            
            if (!response.ok) throw new Error("Backend failed");

            toast.success("Assignment Live!", { id: toastId });
            setForm({ title: '', description: '', targetYear: '', dueDate: '' });
            setFile(null);

        } catch (err) { 
            toast.error(`Failed: ${err.message}`, { id: toastId }); 
        } finally { 
            setLoading(false); 
        }
    };

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
        if(!marks || marks > 100 || marks < 0) return toast.error("Enter valid marks (0-100)");
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
                    <button 
                        onClick={() => setActiveTab('create')} 
                        className={`toggle-btn ${activeTab === 'create' ? 'active-create' : ''}`}>
                        <i className="fas fa-plus"></i> Create
                    </button>
                    <button 
                        onClick={() => { setActiveTab('evaluate'); setSelectedTask(null); }} 
                        className={`toggle-btn ${activeTab === 'evaluate' ? 'active-eval' : ''}`}>
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
                        {/* Main Inputs */}
                        <div className="form-main">
                            <div className="input-group">
                                <label>Title</label>
                                <input required value={form.title} onChange={e => setForm({...form, title: e.target.value})} placeholder="e.g. Thermodynamics Project" />
                            </div>
                            <div className="input-group">
                                <label>Instructions</label>
                                <textarea required value={form.description} onChange={e => setForm({...form, description: e.target.value})} rows="6" placeholder="Explain the task details..." />
                            </div>
                        </div>

                        {/* Sidebar Inputs */}
                        <div className="form-sidebar">
                            <div className="input-group">
                                <label>Class</label>
                                <select value={form.targetYear} onChange={e => setForm({...form, targetYear: e.target.value})} required>
                                    <option value="">Select Target Class</option>
                                    <option value="All">All Classes</option>
                                    {assignedYears.map(year => <option key={year} value={year}>{year} Year</option>)}
                                </select>
                            </div>

                            <div className="input-group">
                                <label>Deadline</label>
                                <input type="date" required value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
                            </div>

                            {/* File Upload */}
                            <div className="file-upload-box">
                                <input type="file" id="file-upload" onChange={e => setFile(e.target.files[0])} hidden />
                                <label htmlFor="file-upload">
                                    <i className={`fas ${file ? 'fa-check-circle' : 'fa-cloud-upload-alt'}`}></i>
                                    <span>{file ? file.name : "Attach PDF / IMG"}</span>
                                </label>
                            </div>

                            <button className="submit-btn" disabled={loading}>
                                {loading ? 'Publishing...' : 'Publish Task'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* --- EVALUATE MODE --- */}
            {activeTab === 'evaluate' && !selectedTask && (
                <div className="tasks-grid">
                    {tasks.map(task => (
                        <div key={task.id} className="task-card-modern" onClick={() => viewSubmissions(task)}>
                            <div className="card-top">
                                <span className={`badge ${task.targetYear === 'All' ? 'badge-all' : 'badge-year'}`}>
                                    {task.targetYear === 'All' ? 'All' : `${task.targetYear} Year`}
                                </span>
                                {task.attachmentUrl && <i className="fas fa-paperclip attachment-icon"></i>}
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
                        <button onClick={() => setSelectedTask(null)} className="back-btn">
                            <i className="fas fa-chevron-left"></i> Back
                        </button>
                        <h3>{selectedTask.title} <span style={{fontWeight:'400', fontSize:'14px', opacity:0.7}}>| Submissions</span></h3>
                    </div>
                    
                    <div className="table-responsive">
                        <table className="modern-table">
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Roll No</th>
                                    <th>Work</th>
                                    <th>Score</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map(sub => (
                                    <tr key={sub.id}>
                                        <td className="fw-bold">{sub.studentName}</td>
                                        <td><span className="roll-tag">{sub.rollNo}</span></td>
                                        <td>
                                            <a href={sub.documentUrl} target="_blank" rel="noreferrer" className="view-doc-btn">
                                                <i className="fas fa-eye"></i> View
                                            </a>
                                        </td>
                                        <td>
                                            {sub.status === 'Graded' ? (
                                                <span className={`score ${sub.marks >= 40 ? 'pass' : 'fail'}`}>{sub.marks}/100</span>
                                            ) : (
                                                gradingId === sub.id ? (
                                                    <div className="grading-inputs">
                                                        <input type="number" placeholder="00" value={marks} onChange={e => setMarks(e.target.value)} autoFocus />
                                                        <input type="text" placeholder="Note..." value={feedback} onChange={e => setFeedback(e.target.value)} />
                                                    </div>
                                                ) : <span className="status-pending">Pending</span>
                                            )}
                                        </td>
                                        <td>
                                            {sub.status !== 'Graded' && (
                                                gradingId === sub.id ? (
                                                    <div className="action-row">
                                                        <button onClick={() => submitGrade(sub.id)} className="btn-save"><i className="fas fa-check"></i></button>
                                                        <button onClick={() => setGradingId(null)} className="btn-cancel"><i className="fas fa-times"></i></button>
                                                    </div>
                                                ) : (
                                                    <button onClick={() => { setGradingId(sub.id); setMarks(''); setFeedback(''); }} className="btn-grade">
                                                        Grade
                                                    </button>
                                                )
                                            )}
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

            {/* --- RESPONSIVE & THEME CSS --- */}
            <style>{`
                /* Container */
                .task-page-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding-bottom: 80px; /* Space for mobile footer */
                }

                /* Gradient Text */
                .gradient-text {
                    background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    font-size: 24px;
                    margin: 0;
                }
                .subtitle { color: #64748b; font-size: 14px; margin-top: 5px; }

                /* Header Layout */
                .task-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 25px;
                }

                /* Toggle Buttons */
                .toggle-container {
                    background: white;
                    padding: 4px;
                    border-radius: 12px;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.05);
                    display: flex;
                    gap: 5px;
                }
                .toggle-btn {
                    padding: 8px 16px;
                    border: none;
                    background: transparent;
                    color: #64748b;
                    border-radius: 8px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s;
                    font-size: 13px;
                }
                .active-create { background: #f3e8ff; color: #7c3aed; }
                .active-eval { background: #fce7f3; color: #db2777; }

                /* Create Card */
                .create-card {
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.08);
                    overflow: hidden;
                    border: 1px solid #f1f5f9;
                }
                .create-card-header {
                    background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%);
                    padding: 15px 25px;
                    color: white;
                }
                .create-card-header h3 { margin: 0; font-size: 16px; font-weight: 600; }

                .create-form {
                    padding: 25px;
                    display: grid;
                    grid-template-columns: 2fr 1fr;
                    gap: 30px;
                }

                /* Form Elements */
                .input-group label {
                    display: block;
                    font-size: 12px;
                    font-weight: 700;
                    color: #64748b;
                    margin-bottom: 6px;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .input-group input, .input-group textarea, .input-group select {
                    width: 100%;
                    padding: 12px;
                    border: 2px solid #f1f5f9;
                    border-radius: 10px;
                    font-size: 14px;
                    transition: border 0.2s;
                    background: #f8fafc;
                    color: #334155;
                }
                .input-group input:focus, .input-group textarea:focus {
                    border-color: #d946ef;
                    outline: none;
                    background: white;
                }

                /* File Upload */
                .file-upload-box label {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                    border: 2px dashed #cbd5e1;
                    border-radius: 12px;
                    cursor: pointer;
                    color: #64748b;
                    transition: all 0.2s;
                }
                .file-upload-box label:hover { background: #fdf4ff; border-color: #d946ef; }
                .file-upload-box i { font-size: 24px; margin-bottom: 8px; color: #d946ef; }

                /* Submit Button */
                .submit-btn {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(90deg, #7c3aed, #db2777);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-weight: 600;
                    margin-top: 15px;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(219, 39, 119, 0.3);
                }

                /* Task Grid */
                .tasks-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                    gap: 20px;
                }
                .task-card-modern {
                    background: white;
                    border-radius: 16px;
                    padding: 20px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.02);
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                .task-card-modern:hover { transform: translateY(-5px); box-shadow: 0 10px 20px rgba(0,0,0,0.08); }
                .card-top { display: flex; justify-content: space-between; margin-bottom: 12px; }
                .badge { font-size: 10px; padding: 4px 10px; border-radius: 20px; font-weight: 700; text-transform: uppercase; }
                .badge-all { background: #f3e8ff; color: #7c3aed; }
                .badge-year { background: #ecfeff; color: #06b6d4; }
                .attachment-icon { color: #cbd5e1; }
                .task-card-modern h4 { margin: 0 0 15px 0; color: #334155; font-size: 16px; line-height: 1.4; }
                .card-footer { border-top: 1px solid #f8fafc; padding-top: 15px; display: flex; justify-content: space-between; font-size: 12px; color: #94a3b8; }
                .arrow-link { color: #d946ef; font-weight: 600; }

                /* Table Styling */
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

                /* Grading Inputs */
                .grading-inputs { display: flex; gap: 5px; }
                .grading-inputs input { border: 1px solid #cbd5e1; padding: 5px; border-radius: 6px; font-size: 13px; }
                .action-row { display: flex; gap: 5px; }
                .btn-save { background: #10b981; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; }
                .btn-cancel { background: #ef4444; color: white; border: none; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; }

                /* --- MOBILE RESPONSIVE --- */
                @media (max-width: 768px) {
                    .task-header { flex-direction: column; align-items: flex-start; gap: 15px; }
                    .toggle-container { width: 100%; justify-content: space-between; }
                    .toggle-btn { flex: 1; text-align: center; }
                    
                    /* Stack form vertically */
                    .create-form { grid-template-columns: 1fr; gap: 20px; padding: 20px; }
                    
                    /* Adjust cards for mobile */
                    .tasks-grid { grid-template-columns: 1fr; }
                    
                    /* Table adjustments */
                    .modern-table th, .modern-table td { padding: 12px 15px; }
                    .grading-header h3 { font-size: 14px; }
                }
            `}</style>
        </div>
    );
}