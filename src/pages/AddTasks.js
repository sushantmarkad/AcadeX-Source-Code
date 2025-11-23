import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, doc, getDoc, deleteDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function AddTasks() {
    const [task, setTask] = useState({ title: '', description: '', link: '', deadline: '', assignTo: 'All Students' });
    const [myTasks, setMyTasks] = useState([]);
    const [teacherInfo, setTeacherInfo] = useState(null);
    const [loading, setLoading] = useState(false);

    // 1. Fetch Teacher Info
    useEffect(() => {
        const fetchTeacherData = async () => {
            if (auth.currentUser) {
                const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
                if (userDoc.exists()) {
                    setTeacherInfo(userDoc.data());
                }
            }
        };
        fetchTeacherData();
    }, []);

    // 2. Fetch Recent Tasks
    useEffect(() => {
        if (auth.currentUser) {
            const q = query(
                collection(db, 'tasks'), 
                where('teacherId', '==', auth.currentUser.uid)
            );
            const unsubscribe = onSnapshot(q, (snapshot) => {
                const tasksData = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
                tasksData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                setMyTasks(tasksData);
            });
            return () => unsubscribe();
        }
    }, []);

    // 3. Create Task
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!teacherInfo) return;

        setLoading(true);
        const toastId = toast.loading("Assigning Task...");

        try {
            await addDoc(collection(db, 'tasks'), {
                ...task,
                teacherId: auth.currentUser.uid,
                teacherName: `${teacherInfo.firstName} ${teacherInfo.lastName}`,
                instituteId: teacherInfo.instituteId,
                department: teacherInfo.department,
                createdAt: serverTimestamp(),
                status: 'active'
            });
            toast.success("Task Assigned!", { id: toastId });
            setTask({ title: '', description: '', link: '', deadline: '', assignTo: 'All Students' });
        } catch (error) {
            toast.error("Error: " + error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // 4. ✅ FIXED: Delete Task (Modern Custom Toast)
    const handleDelete = (id) => {
        toast((t) => (
            <div style={{textAlign: 'center'}}>
                <p style={{margin: '0 0 10px 0', fontWeight: '600', color:'#1f2937'}}>Delete Task?</p>
                <p style={{margin: '0 0 15px 0', fontSize:'13px', color:'#64748b'}}>This cannot be undone.</p>
                <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                    <button 
                        onClick={() => toast.dismiss(t.id)}
                        style={{padding: '6px 12px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize:'13px', fontWeight:'600'}}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            toast.dismiss(t.id);
                            performDelete(id);
                        }}
                        style={{padding: '6px 12px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize:'13px', fontWeight:'600'}}
                    >
                        Delete
                    </button>
                </div>
            </div>
        ), { duration: 5000, style: { minWidth: '250px' } });
    };

    const performDelete = async (id) => {
        const toastId = toast.loading("Deleting...");
        try {
            await deleteDoc(doc(db, "tasks", id));
            toast.success("Task deleted", { id: toastId });
        } catch(e) { 
            toast.error("Failed to delete", { id: toastId }); 
        }
    };

    return (
        <div className="content-section">
            <div style={{display:'grid', gap:'30px', gridTemplateColumns: '1fr 1fr'}}>
                
                {/* LEFT: CREATE FORM */}
                <div>
                    <h2 className="content-title">Assign New Task</h2>
                    <div className="card">
                        <form onSubmit={handleSubmit}>
                            <div className="input-group">
                                <label>Task Title</label>
                                <input type="text" required value={task.title} onChange={e => setTask({...task, title: e.target.value})} />
                            </div>
                            <div className="input-group">
                                <label>Description</label>
                                <textarea className="modern-input" rows="3" required value={task.description} onChange={e => setTask({...task, description: e.target.value})} />
                            </div>
                            <div className="input-group">
                                <label>Link (Optional)</label>
                                <input type="url" value={task.link} onChange={e => setTask({...task, link: e.target.value})} />
                            </div>
                            <div className="input-group">
                                <label>Deadline</label>
                                <input type="datetime-local" value={task.deadline} onChange={e => setTask({...task, deadline: e.target.value})} />
                            </div>
                            <button className="btn-primary" disabled={loading}>{loading ? 'Assigning...' : 'Assign Task'}</button>
                        </form>
                    </div>
                </div>

                {/* RIGHT: MY RECENT TASKS */}
                <div>
                    <h2 className="content-title">My Active Tasks</h2>
                    <div className="cards-grid" style={{gridTemplateColumns:'1fr'}}>
                        {myTasks.length > 0 ? (
                            myTasks.map(t => (
                                <div key={t.id} className="card" style={{padding:'15px', position:'relative'}}>
                                    <h4 style={{margin:'0 0 5px 0'}}>{t.title}</h4>
                                    <p style={{fontSize:'13px', color:'#64748b', margin:'0 0 10px 0'}}>{t.description}</p>
                                    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <span className="status-badge-pill" style={{fontSize:'11px'}}>
                                            To: {t.department}
                                        </span>
                                        <button onClick={() => handleDelete(t.id)} style={{background:'none', border:'none', color:'#ef4444', cursor:'pointer'}}>
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p style={{color:'#64748b', fontStyle:'italic'}}>No tasks created yet.</p>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}