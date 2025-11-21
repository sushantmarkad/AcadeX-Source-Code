import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import './Dashboard.css'; 
import { collection, addDoc, serverTimestamp, query, where, onSnapshot, deleteDoc, doc, getDoc } from 'firebase/firestore';

export default function AddTasks() {
    const [task, setTask] = useState({ title: '', description: '', link: '' });
    const [myTasks, setMyTasks] = useState([]);
    const [teacherInfo, setTeacherInfo] = useState(null);
    const [success, setSuccess] = useState('');

    useEffect(() => {
        if (auth.currentUser) getDoc(doc(db, "users", auth.currentUser.uid)).then(doc => setTeacherInfo(doc.exists() ? doc.data() : null));
    }, []);

    useEffect(() => {
        if (auth.currentUser) {
            const q = query(collection(db, 'tasks'), where('teacherId', '==', auth.currentUser.uid));
            return onSnapshot(q, (snapshot) => setMyTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() }))));
        }
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'tasks'), {
                ...task, teacherId: auth.currentUser.uid, teacherName: `${teacherInfo.firstName}`, instituteId: teacherInfo.instituteId, department: teacherInfo.department, createdAt: serverTimestamp(),
            });
            setSuccess('Task Assigned!'); setTask({ title: '', description: '', link: '' }); setTimeout(() => setSuccess(''), 3000);
        } catch (err) { alert('Failed'); }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Assign Task</h2>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="input-group"><label>Title</label><input type="text" value={task.title} onChange={(e) => setTask({...task, title: e.target.value})} /></div>
                    <div className="input-group"><label>Description</label><input type="text" value={task.description} onChange={(e) => setTask({...task, description: e.target.value})} /></div>
                    <div className="input-group"><label>Link</label><input type="url" value={task.link} onChange={(e) => setTask({...task, link: e.target.value})} /></div>
                    {success && <p style={{color:'green'}}>{success}</p>}
                    <button type="submit" className="btn-primary">Assign</button>
                </form>
            </div>
            <h3 style={{marginTop:'30px'}}>Active Tasks</h3>
            <div className="cards-grid">
                {myTasks.map(t => (
                    <div key={t.id} className="card">
                        <h4>{t.title}</h4>
                        <p>{t.description}</p>
                        <button onClick={() => deleteDoc(doc(db, "tasks", t.id))} className="btn-delete" style={{marginTop:'10px'}}>Delete</button>
                    </div>
                ))}
            </div>
        </div>
    );
}