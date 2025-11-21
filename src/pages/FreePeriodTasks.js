import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, doc, setDoc, getDocs, where } from 'firebase/firestore';
import './Dashboard.css';

export default function FreePeriodTasks({ user }) {
    const [tasks, setTasks] = useState([]);
    const [completedTasks, setCompletedTasks] = useState(new Set());
    const [loading, setLoading] = useState(true);

    // ✅ CRITICAL FIX: Filter tasks by Institute AND Department
    useEffect(() => {
        if (!user?.instituteId) return;

        const q = query(
            collection(db, 'tasks'),
            where('instituteId', '==', user.instituteId),
            where('department', '==', user.department || 'General') // Match department
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });
        return () => unsubscribe();
    }, [user]);

    useEffect(() => {
        const fetchCompleted = async () => {
            if (auth.currentUser) {
                const ref = collection(db, "users", auth.currentUser.uid, "completedTasks");
                const snap = await getDocs(ref);
                setCompletedTasks(new Set(snap.docs.map(d => d.id)));
            }
        };
        fetchCompleted();
    }, []);

    const handleComplete = async (taskId) => {
        try {
            await setDoc(doc(db, "users", auth.currentUser.uid, "completedTasks", taskId), { completedAt: new Date() });
            setCompletedTasks(prev => new Set(prev).add(taskId));
        } catch (err) { console.error(err); }
    };

    if (loading) return <div className="content-section"><p>Loading tasks...</p></div>;

    return (
        <div className="content-section">
            <h2 className="content-title">Free Period Tasks</h2>
            <p className="content-subtitle">Tasks assigned by your <strong>{user?.department}</strong> teachers.</p>
            
            <div className="cards-grid">
                {tasks.length > 0 ? (
                    tasks.map(task => {
                        const isCompleted = completedTasks.has(task.id);
                        return (
                            <div key={task.id} className={`card task-card ${isCompleted ? 'completed' : ''}`}>
                                <h3>{task.title}</h3>
                                <p className="task-author">By: {task.teacherName}</p>
                                <p>{task.description}</p>
                                {task.link && <a href={task.link} target="_blank" rel="noopener noreferrer" className="btn-secondary">View Resource</a>}
                                <button 
                                    onClick={() => handleComplete(task.id)} 
                                    className={`btn-primary ${isCompleted ? 'btn-completed' : ''}`}
                                    disabled={isCompleted}
                                    style={{marginTop: '15px'}}
                                >
                                    {isCompleted ? 'Completed ✓' : 'Mark as Complete'}
                                </button>
                            </div>
                        )
                    })
                ) : (
                    <p>No tasks assigned for your department yet.</p>
                )}
            </div>
        </div>
    );
}