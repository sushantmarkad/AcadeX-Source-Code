import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { motion } from 'framer-motion'; 
import './Dashboard.css';

const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/3135/3135715.png";

export default function Leaderboard({ user }) {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myRank, setMyRank] = useState(null);

    useEffect(() => {
        if (!user?.instituteId) return;

        const q = query(
            collection(db, 'users'),
            where('instituteId', '==', user.instituteId),
            where('role', '==', 'student'),
            orderBy('xp', 'desc'),
            limit(50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setLeaders(data);
            
            // Find my rank
            const myIndex = data.findIndex(u => u.id === user.uid);
            if (myIndex !== -1) setMyRank(myIndex + 1);
            
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.instituteId, user.uid]);

    const top3 = leaders.slice(0, 3);
    const rest = leaders.slice(3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); 

    if (loading) return <div className="lb-loading">Loading Ranks...</div>;

    return (
        <div className="content-section">
            
            {/* 🏆 HEADER & MY STATS */}
            <div className="leaderboard-header-banner">
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h2 className="content-title" style={{color:'white', marginBottom:0, fontSize:'24px'}}>🏆 Champions League</h2>
                    <p style={{color:'rgba(255,255,255,0.9)', margin:'5px 0 20px 0', fontSize:'14px'}}> compete with the best minds.</p>
                    
                    {/* Mini Stats Card */}
                    <div className="lb-my-stats">
                        <div className="stat-item">
                            <span className="stat-label">YOUR RANK</span>
                            <span className="stat-val">{myRank ? `#${myRank}` : 'N/A'}</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-label">YOUR XP</span>
                            <span className="stat-val">{user.xp || 0}</span>
                        </div>
                    </div>
                </div>
                {/* Background Decor */}
                <div className="lb-banner-decor"></div>
            </div>

            {/* --- 🥇 PODIUM SECTION --- */}
            <div className="podium-stage-container">
                <div className="podium-stage">
                    {podiumOrder.map((student, index) => {
                        if (!student) return null;
                        const rank = leaders.indexOf(student) + 1;
                        const isFirst = rank === 1;
                        
                        return (
                            <motion.div 
                                key={student.id}
                                className={`podium-item rank-${rank}`}
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ delay: index * 0.2, type: 'spring' }}
                            >
                                {isFirst && <div className="crown-icon">👑</div>}
                                
                                <div className="podium-avatar-container">
                                    <img src={student.photoURL || DEFAULT_AVATAR} alt="avatar" className="podium-avatar" />
                                    <div className="podium-badge">{rank}</div>
                                </div>

                                <div className="podium-info">
                                    <div className="podium-name-row">
                                        <span className="p-name">{student.firstName}</span>
                                        {user.uid === student.id && <span className="me-pill">YOU</span>}
                                    </div>
                                    <div className="podium-xp">{student.xp || 0} XP</div>
                                </div>

                                <div className={`podium-stand stand-${rank}`}></div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>

            {/* --- 📜 LIST SECTION --- */}
            <div className="leaderboard-list-container">
                {rest.map((student, index) => (
                    <motion.div 
                        key={student.id}
                        className={`lb-list-item ${user.uid === student.id ? 'is-me' : ''}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 + (index * 0.05) }}
                    >
                        <div className="lb-rank-col">
                            <span className="lb-rank-circle">{index + 4}</span>
                        </div>
                        
                        <div className="lb-user-col">
                            <img src={student.photoURL || DEFAULT_AVATAR} className="lb-list-avatar" alt="user" />
                            <div className="lb-text-info">
                                <div className="lb-name-row">
                                    <span className="lb-name-text">{student.firstName} {student.lastName}</span>
                                    {user.uid === student.id && <span className="me-pill-small">YOU</span>}
                                </div>
                                <div className="lb-dept">{student.department || 'General'}</div>
                            </div>
                        </div>

                        <div className="lb-badges-col">
                            {student.badges?.slice(0, 3).map((badge, i) => (
                                <span key={i} className="mini-badge" title={badge}>
                                    {badge === 'novice' ? '🌱' : badge === 'expert' ? '🔥' : '🏅'}
                                </span>
                            ))}
                        </div>

                        <div className="lb-xp-col">
                            {student.xp || 0} XP
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}