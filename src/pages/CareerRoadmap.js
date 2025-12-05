import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import ReactDOM from 'react-dom';
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function CareerRoadmap({ user }) {
    const [roadmap, setRoadmap] = useState(null);
    const [generating, setGenerating] = useState(false);
    
    // Modal State for XP Claim
    const [verifyModal, setVerifyModal] = useState({ isOpen: false, weekIndex: null, topicIndex: null });
    const [summary, setSummary] = useState("");

    useEffect(() => {
        if (user?.roadmap) {
            setRoadmap(user.roadmap);
        }
    }, [user]);

    // 1. Generate Logic (Calls AI)
    const generateRoadmap = async () => {
        setGenerating(true);
        const toastId = toast.loading("AI is building your career path...");

        try {
            const response = await fetch(`${BACKEND_URL}/generateRoadmap`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    goal: user.careerGoal, 
                    department: user.department 
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Generation failed");

            let newRoadmap = data.roadmap;
            // Sanitize: Pre-fill 'completed' array with false
            newRoadmap.weeks = newRoadmap.weeks.map(week => ({
                ...week,
                completed: new Array(week.topics.length).fill(false)
            }));

            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { roadmap: newRoadmap });

            setRoadmap(newRoadmap);
            toast.success("Roadmap Generated!", { id: toastId });

        } catch (err) {
            console.error(err);
            toast.error("AI Error: " + err.message, { id: toastId });
        } finally {
            setGenerating(false);
        }
    };

    // 2. Handle Regenerate Click (Safety Check)
    const handleGenerateClick = () => {
        if (!user.careerGoal) {
            toast.error("Please set a Career Goal in your Profile first!");
            return;
        }

        if (!roadmap) {
            generateRoadmap();
            return;
        }

        // Toast Confirmation for Regeneration
        toast((t) => (
            <div style={{textAlign: 'center'}}>
                <p style={{margin: '0 0 10px 0', fontWeight: '600', color:'#1f2937'}}>Regenerate Roadmap?</p>
                <p style={{margin: '0 0 15px 0', fontSize:'13px', color:'#64748b'}}>This will reset your progress.</p>
                <div style={{display: 'flex', gap: '10px', justifyContent: 'center'}}>
                    <button 
                        onClick={() => toast.dismiss(t.id)}
                        style={{padding: '8px 16px', borderRadius: '8px', border: '1px solid #e5e7eb', background: 'white', cursor: 'pointer', fontSize:'13px', fontWeight:600}}
                    >
                        Cancel
                    </button>
                    <button 
                        onClick={() => {
                            toast.dismiss(t.id);
                            setRoadmap(null);
                            generateRoadmap();
                        }}
                        style={{padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#ef4444', color: 'white', cursor: 'pointer', fontSize:'13px', fontWeight:600}}
                    >
                        Regenerate
                    </button>
                </div>
            </div>
        ), { duration: 5000, style: { minWidth: '300px', padding: '16px' } });
    };

    // 3. Handle Topic Click
    const handleTopicClick = (weekIndex, topicIndex) => {
        const isCompleted = roadmap.weeks[weekIndex].completed?.[topicIndex];
        
        if (isCompleted) {
            // If already done, just uncheck it (No XP penalty)
            toggleLocalState(weekIndex, topicIndex, false);
        } else {
            // If NOT done, open verification modal
            setVerifyModal({ isOpen: true, weekIndex, topicIndex });
            setSummary(""); 
        }
    };

    // 4. Submit Verification & Claim XP
    const submitVerification = async () => {
        if (summary.length < 10) {
            toast.error("Please write at least 10 characters about what you learned.");
            return;
        }

        const { weekIndex, topicIndex } = verifyModal;
        const toastId = toast.loading("Verifying...");

        try {
            // Call Backend to Award XP
            const response = await fetch(`${BACKEND_URL}/completeTask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: user.uid, taskSummary: summary })
            });

            const data = await response.json();

            if (!response.ok) throw new Error(data.error || "Verification failed");

            toast.success(data.message, { id: toastId }); // "+50 XP"
            
            // 🎉 CHECK FOR NEW BADGES
            if (data.newBadges && data.newBadges.length > 0) {
                data.newBadges.forEach(badge => {
                    setTimeout(() => {
                        toast(`🏆 New Badge Unlocked: ${badge.toUpperCase()}!`, {
                            icon: '🎉',
                            duration: 5000,
                            style: { border: '2px solid #fbbf24', background: '#fffbeb', color: '#b45309' }
                        });
                    }, 1000);
                });
            }

            toggleLocalState(weekIndex, topicIndex, true); 
            setVerifyModal({ isOpen: false, weekIndex: null, topicIndex: null });

        } catch (err) {
            toast.error(err.message, { id: toastId });
        }
    };

    // Helper: Update State & DB
    const toggleLocalState = async (weekIndex, topicIndex, status) => {
        const newRoadmap = JSON.parse(JSON.stringify(roadmap));
        if (!newRoadmap.weeks[weekIndex].completed) newRoadmap.weeks[weekIndex].completed = [];
        newRoadmap.weeks[weekIndex].completed[topicIndex] = status;
        
        setRoadmap(newRoadmap);
        try {
            const userRef = doc(db, 'users', user.uid);
            await updateDoc(userRef, { roadmap: newRoadmap });
        } catch (e) { console.error(e); }
    };

    // --- RENDER ---
    
    if (!user.careerGoal) return (
        <div className="content-section" style={{textAlign:'center', padding:'40px'}}>
            <div className="card" style={{maxWidth: '500px', margin: '0 auto', padding: '40px 20px'}}>
                <div style={{fontSize:'50px', marginBottom:'20px'}}>🎯</div>
                <h2 style={{marginBottom: '10px'}}>Set a Goal First!</h2>
                <p style={{color:'#64748b', marginBottom: '20px'}}>Go to your Profile and tell us what you want to become (e.g., "Data Scientist").</p>
            </div>
        </div>
    );

    if (generating) return (
        <div className="content-section" style={{textAlign:'center', padding:'50px'}}>
            <div className="pulsate" style={{fontSize:'40px'}}>🧠</div>
            <h3 style={{marginTop:'20px'}}>AI is thinking...</h3>
            <p style={{color:'#64748b'}}>Curating the best topics for {user.careerGoal}...</p>
        </div>
    );

    if (!roadmap) return (
        <div className="content-section" style={{textAlign:'center', padding:'40px'}}>
            <div className="card" style={{maxWidth: '600px', margin: '0 auto', padding: '40px'}}>
                <div style={{fontSize:'50px', marginBottom:'20px'}}>🚀</div>
                <h2 style={{marginBottom:'10px'}}>Your Goal: <span style={{color:'#2563eb'}}>{user.careerGoal}</span></h2>
                <p style={{color:'#64748b', marginBottom:'30px'}}>
                    AcadeX AI can build a personalized 4-week learning schedule for you.
                </p>
                <button className="btn-primary" style={{width:'auto', padding:'12px 30px', margin: '0 auto'}} onClick={handleGenerateClick}>
                    Generate My Roadmap
                </button>
            </div>
        </div>
    );

    return (
        <div className="content-section">
            {/* ✅ VERIFICATION MODAL */}
            {/* ✅ VERIFICATION MODAL (Fixed with Portal) */}
{verifyModal.isOpen && ReactDOM.createPortal(
    <div className="custom-modal-overlay" style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
        zIndex: 99999, // Ensure this is higher than sidebar (usually 10000)
        background: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(5px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
    }}>
        <div className="custom-modal-box">
            <h3>Claim Your XP 🎯</h3>
            <p style={{fontSize:'13px', color:'#64748b', marginBottom:'15px'}}>Briefly summarize what you learned to complete this task:</p>
            <textarea 
                className="modern-input" 
                rows="3"
                placeholder="I learned about..."
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
            />
            <div className="modal-actions">
                <button className="btn-secondary" onClick={() => setVerifyModal({ isOpen: false })}>Cancel</button>
                <button className="btn-primary" onClick={submitVerification}>Claim 50 XP</button>
            </div>
        </div>
    </div>,
    document.body // 👈 This pushes it to the top level of the DOM
)}

            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'30px'}}>
                <div>
                    <h2 className="content-title">🚀 Career Roadmap</h2>
                    <p className="content-subtitle">Path to becoming a <strong>{user.careerGoal}</strong></p>
                </div>
                
                <button onClick={handleGenerateClick} className="btn-ghost">
                    <i className="fas fa-sync-alt"></i> Regenerate
                </button>
            </div>

            <div className="roadmap-container">
                {roadmap.weeks.map((week, wIndex) => {
                    const total = week.topics.length;
                    const done = week.completed ? week.completed.filter(Boolean).length : 0;
                    const progress = total === 0 ? 0 : Math.round((done / total) * 100);

                    return (
                        <div key={wIndex} className="card roadmap-card">
                            <div className="roadmap-header">
                                <span className="week-badge">WEEK {week.week}</span>
                                <h3 style={{margin:0, fontSize:'16px'}}>{week.theme}</h3>
                                <span style={{marginLeft:'auto', fontSize:'12px', fontWeight:'bold', color: progress===100?'#10b981':'#64748b'}}>
                                    {progress}% Done
                                </span>
                            </div>
                            <div style={{width:'100%', height:'6px', background:'#f1f5f9', margin:'15px 0', borderRadius:'3px'}}>
                                <div style={{width:`${progress}%`, height:'100%', background: progress===100?'#10b981':'#3b82f6', borderRadius:'3px', transition:'width 0.3s'}}></div>
                            </div>
                            <div className="topic-list">
                                {week.topics.map((topic, tIndex) => (
                                    <div 
                                        key={tIndex} 
                                        className={`topic-item ${week.completed?.[tIndex] ? 'done' : ''}`}
                                        onClick={() => handleTopicClick(wIndex, tIndex)}
                                    >
                                        <div className="checkbox-circle">
                                            {week.completed?.[tIndex] && <i className="fas fa-check" style={{fontSize:'10px'}}></i>}
                                        </div>
                                        <span>{topic}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
}