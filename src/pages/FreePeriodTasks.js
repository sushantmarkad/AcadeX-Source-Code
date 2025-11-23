import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, doc, getDocs, where, updateDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';
import FocusTimer from './FocusTimer'; // ✅ Import Timer

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function FreePeriodTasks({ user }) {
    const [tasks, setTasks] = useState([]);
    const [completedTasks, setCompletedTasks] = useState(new Set());
    const [nudgeTasks, setNudgeTasks] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // Timer State
    const [activeTask, setActiveTask] = useState(null);
    const [showTimer, setShowTimer] = useState(false);

    // 1. Load Teacher Tasks
    useEffect(() => {
        if (!user?.instituteId || !user?.department) return;

        const q = query(
            collection(db, 'tasks'),
            where('instituteId', '==', user.instituteId),
            where('department', '==', user.department || 'General') 
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoading(false);
        });

        // Load Completed History
        const fetchCompleted = async () => {
            if (auth.currentUser) {
                const ref = collection(db, "users", auth.currentUser.uid, "completedTasks");
                const snap = await getDocs(ref);
                setCompletedTasks(new Set(snap.docs.map(d => d.id)));
            }
        };
        fetchCompleted();

        return () => unsubscribe();
    }, [user]);

    // 2. Smart Nudge Logic (Find Next Roadmap Step)
    useEffect(() => {
        const roadmap = user?.roadmap;
        if (!roadmap || !user.careerGoal) {
            setNudgeTasks([]);
            return;
        }

        let nextTask = null;
        for (let wIndex = 0; wIndex < roadmap.weeks.length; wIndex++) {
            const week = roadmap.weeks[wIndex];
            if (week.topics) {
                for (let tIndex = 0; tIndex < week.topics.length; tIndex++) {
                    if (!week.completed[tIndex]) {
                        nextTask = {
                            id: `roadmap_${wIndex}_${tIndex}`,
                            title: week.topics[tIndex],
                            week: week.week,
                            theme: week.theme,
                            type: 'Roadmap',
                            wIndex: wIndex,
                            tIndex: tIndex
                        };
                        break;
                    }
                }
            }
            if (nextTask) break;
        }
        setNudgeTasks(nextTask ? [nextTask] : []); 
    }, [user.roadmap, user.careerGoal]);


    // 3. Start Timer Logic
    const startSession = (task) => {
        setActiveTask(task);
        setShowTimer(true);
    };

    // 4. Handle Timer Finish (Claim XP)
    const handleTimerComplete = async () => {
        setShowTimer(false);
        const toastId = toast.loading("Session Done! Claiming XP...");

        try {
            // Call Backend
            const response = await fetch(`${BACKEND_URL}/completeTask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, taskSummary: `Focus Session: ${activeTask.title}` })
            });
            const data = await response.json();
            if(!response.ok) throw new Error(data.error);

            // Update DB based on task type
            if (activeTask.type === 'Roadmap') {
                const newRoadmap = JSON.parse(JSON.stringify(user.roadmap));
                newRoadmap.weeks[activeTask.wIndex].completed[activeTask.tIndex] = true;
                await updateDoc(doc(db, 'users', user.uid), { roadmap: newRoadmap });
            } else {
                await setDoc(doc(db, "users", auth.currentUser.uid, "completedTasks", activeTask.id), { completedAt: new Date() });
                setCompletedTasks(prev => new Set(prev).add(activeTask.id));
            }

            toast.success("Awesome! +50 XP Earned 🎓", { id: toastId });
            if (data.newBadges?.length > 0) data.newBadges.forEach(b => toast(`🏆 Unlocked: ${b}!`, { icon: '🎉' }));
            
            setActiveTask(null);

        } catch (err) {
            toast.error(err.message, { id: toastId });
        }
    };

    if (loading) return <div className="content-section"><p>Loading tasks...</p></div>;

    return (
        <div className="content-section">
            {/* ✅ TIMER OVERLAY */}
            {showTimer && activeTask && (
                <FocusTimer 
                    durationMinutes={60} 
                    taskTitle={activeTask.title}
                    onComplete={handleTimerComplete}
                    onCancel={() => setShowTimer(false)}
                />
            )}

            <h2 className="content-title">Free Period Tasks</h2>
            <p className="content-subtitle">Your personalized learning hub.</p>

            {/* 1. SMART NUDGE */}
            {nudgeTasks.length > 0 && (
                <div style={{ marginBottom: '30px' }}>
                    <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
                         <div className="icon-box-modern" style={{background:'#e0f2fe', color:'#0284c7'}}><i className="fas fa-robot"></i></div>
                        <h3 style={{margin:0, fontSize:'18px', color:'#0c4a6e'}}>AI Recommendation</h3>
                    </div>
                    {nudgeTasks.map((task, index) => (
                        <div key={index} className="card" style={{ padding: '24px', borderLeft: '5px solid #3b82f6', background: 'linear-gradient(to right, #f0f9ff, white)' }}>
                            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#64748b' }}>WEEK {task.week}: {task.theme}</span>
                            <h3 style={{ margin: '8px 0 15px 0', fontSize: '18px' }}>{task.title}</h3>
                            <button onClick={() => startSession(task)} className="btn-primary" style={{width:'auto', padding:'10px 20px', fontSize:'13px'}}>
                                <i className="fas fa-play" style={{marginRight:'8px'}}></i> Start 1-Hour Focus
                            </button>
                        </div>
                    ))}
                </div>
            )}
            
            {/* 2. TEACHER ASSIGNMENTS */}
            <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px', marginTop:'30px'}}>
                <div className="icon-box-modern" style={{background:'#ffedd5', color:'#c2410c'}}><i className="fas fa-chalkboard-teacher"></i></div>
                <h3 style={{margin:0, fontSize:'18px', color:'#7c2d12'}}>Class Assignments</h3>
            </div>

            <div className="cards-grid">
                {tasks.length > 0 ? (
                    tasks.map(task => {
                        const isCompleted = completedTasks.has(task.id);
                        return (
                            <div key={task.id} className={`card task-card ${isCompleted ? 'completed' : ''}`} style={{opacity: isCompleted ? 0.7 : 1}}>
                                <h4 style={{fontSize:'16px', marginBottom:'5px'}}>{task.title} {isCompleted && '✅'}</h4>
                                <p style={{fontSize:'12px', color:'#64748b'}}>By: {task.teacherName}</p>
                                <p style={{fontSize:'14px', color:'#334155', marginBottom:'15px'}}>{task.description}</p>
                                <div style={{marginTop:'auto', display:'flex', gap:'10px'}}>
                                    {task.link && <a href={task.link} target="_blank" rel="noreferrer" className="btn-secondary" style={{flex:1, textAlign:'center', textDecoration:'none', padding:'8px'}}>View</a>}
                                    <button 
                                        onClick={() => !isCompleted && startSession(task)} 
                                        className={isCompleted ? "btn-secondary" : "btn-primary"}
                                        disabled={isCompleted}
                                        style={{flex:1, padding:'8px', background: isCompleted ? '#f1f5f9' : ''}}
                                    >
                                        {isCompleted ? 'Done' : 'Start'}
                                    </button>
                                </div>
                            </div>
                        )
                    })
                ) : (
                    <p style={{color:'#64748b', fontStyle:'italic'}}>No pending assignments.</p>
                )}
            </div>
        </div>
    );
}