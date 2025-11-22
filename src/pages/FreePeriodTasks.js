import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { collection, query, onSnapshot, doc, getDocs, where, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function FreePeriodTasks({ user }) {
    const [tasks, setTasks] = useState([]); // Tasks assigned by Teachers
    const [loadingTeacherTasks, setLoadingTeacherTasks] = useState(true);
    const [nudgeTasks, setNudgeTasks] = useState([]); // Tasks suggested by AI (Roadmap)

    // --- 1. Load Teacher Assigned Tasks (Existing Logic) ---
    useEffect(() => {
        if (!user?.instituteId || !user?.department) return;

        const q = query(
            collection(db, 'tasks'),
            where('instituteId', '==', user.instituteId),
            where('department', '==', user.department || 'General') 
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setTasks(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setLoadingTeacherTasks(false);
        });
        return () => unsubscribe();
    }, [user]);

    // --- 2. Process Roadmap into Nudge Tasks (SMART NUDGE LOGIC) ---
    useEffect(() => {
        const roadmap = user?.roadmap;

        if (!roadmap || !user.careerGoal) {
            setNudgeTasks([]);
            return;
        }

        let unfinishedTasks = [];

        // Find the first 3 unfinished tasks from the roadmap
        for (let wIndex = 0; wIndex < roadmap.weeks.length; wIndex++) {
            const week = roadmap.weeks[wIndex];
            
            // Check if topics array exists and is not null
            if (week.topics && Array.isArray(week.topics)) {
                for (let tIndex = 0; tIndex < week.topics.length; tIndex++) {
                    const isCompleted = week.completed[tIndex];

                    if (!isCompleted && unfinishedTasks.length < 3) {
                        unfinishedTasks.push({
                            title: week.topics[tIndex],
                            week: week.week,
                            theme: week.theme,
                            type: 'Roadmap',
                            wIndex: wIndex,
                            tIndex: tIndex
                        });
                    }
                }
            }
            if (unfinishedTasks.length >= 3) break; 
        }
        
        setNudgeTasks(unfinishedTasks);
    }, [user.roadmap, user.careerGoal]);


    // --- 3. Handle Completion (Awards XP and Updates Roadmap) ---
    const handleCompleteTask = async (task) => {
        const toastId = toast.loading("Claiming XP...");

        try {
            // 1. Call Backend to Award XP (+50 XP and check for badges)
            const xpResponse = await fetch(`${BACKEND_URL}/completeTask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, taskSummary: task.title })
            });
            const xpData = await xpResponse.json();

            if (!xpResponse.ok) throw new Error(xpData.error || "XP claim failed.");
            
            // 2. Update Firestore Roadmap Status
            const newRoadmap = JSON.parse(JSON.stringify(user.roadmap));
            newRoadmap.weeks[task.wIndex].completed[task.tIndex] = true;

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { roadmap: newRoadmap });

            // 3. Notify and Refresh
            toast.success(`Task Complete! +50 XP 🚀`, { id: toastId });
            if (xpData.newBadges && xpData.newBadges.length > 0) {
                toast(`🏆 New Badge Unlocked!`, { icon: '🎉', duration: 5000 });
            }

        } catch (err) {
            toast.error(err.message, { id: toastId });
        }
    };


    if (loadingTeacherTasks) return <div className="content-section"><p>Loading tasks...</p></div>;

    // --- RENDER ---
    return (
        <div className="content-section">
            <h2 className="content-title">Free Period Tasks</h2>
            <p className="content-subtitle">Your personalized learning hub for optimal productivity.</p>

            {/* 1. ROADMAP / AI NUDGE TASKS */}
            {nudgeTasks.length > 0 && (
                <div style={{ marginBottom: '30px', borderBottom: '1px solid #eee', paddingBottom: '15px' }}>
                    <h3 style={{ borderLeft: '4px solid #2563eb', paddingLeft: '10px', color: '#1e3a8a', fontSize: '18px', marginBottom: '15px' }}>
                        🎯 Next Recommended Task
                    </h3>
                    <div className="cards-grid">
                        {nudgeTasks.slice(0, 1).map((task, index) => (
                            <div key={index} className="card" style={{ padding: '20px', borderLeft: '4px solid #3b82f6', background: 'linear-gradient(to right, #eff6ff, white)' }}>
                                <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'bold' }}>WEEK {task.week}: {task.theme}</span>
                                <h4 style={{ margin: '5px 0 15px 0', fontSize: '18px' }}>{task.title}</h4>
                                <button 
                                    onClick={() => handleCompleteTask(task)} 
                                    className="btn-primary" 
                                    style={{ width: 'auto', padding: '10px 20px', fontSize: '13px', marginTop: 'auto', alignSelf: 'flex-start' }}
                                >
                                    Start 1-Hour Task
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            
            {/* 2. TEACHER ASSIGNED TASKS (Existing Functionality) */}
            <h3 style={{ borderLeft: '4px solid #f97316', paddingLeft: '10px', color: '#9a3412', fontSize: '18px', marginBottom: '15px' }}>
                📝 Teacher Assigned Tasks
            </h3>
            
            {tasks.length > 0 ? (
                <div className="cards-grid">
                    {/* Render Teacher Tasks Here */}
                    {tasks.map(task => {
                        return (
                            <div key={task.id} className="card task-card">
                                <h4>{task.title}</h4>
                                <p>{task.description}</p>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="card" style={{padding:'20px', textAlign:'center', color:'#64748b'}}>
                    <p>No tasks currently assigned by your teachers.</p>
                </div>
            )}

            {/* 3. Fallback if no goals are set */}
            {!user.careerGoal && (
                 <div className="card" style={{padding:'20px', textAlign:'center', color:'#64748b', marginTop:'20px'}}>
                    <p>Set a **Career Goal** in your Profile to unlock personalized AI suggestions.</p>
                </div>
            )}
        </div>
    );
}