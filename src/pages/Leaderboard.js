import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, orderBy, limit } from 'firebase/firestore';
import { motion } from 'framer-motion'; 
import './Dashboard.css';

// ✅ Default Fallback Avatars
const MALE_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140048.png";
const FEMALE_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140047.png";

export default function Leaderboard({ user }) {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myRank, setMyRank] = useState(null);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        if (!user?.instituteId) return;

        setLoading(true);

        const q = query(
            collection(db, 'users'),
            where('instituteId', '==', user.instituteId),
            where('role', '==', 'student'),
            orderBy('xp', 'desc'),
            limit(showAll ? 500 : 50)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            
            setLeaders(data);
            
            const myIndex = data.findIndex(u => u.id === user.uid);
            if (myIndex !== -1) setMyRank(myIndex + 1);
            
            setLoading(false);
        }, (error) => {
            console.error("Leaderboard Error:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.instituteId, user.uid, showAll]);

    // ✅ FIXED: Updated Avatar logic to support Custom Profile Pics + Gender Defaults
    const getAvatar = (student) => {
        if (student.profilePic) return student.profilePic;
        
        const gender = (student.gender || student.sex || 'male').toLowerCase();
        if (gender === 'female' || gender === 'f' || gender === 'girl') {
            return FEMALE_AVATAR;
        }
        return MALE_AVATAR;
    };

    // ✅ Helper to get "Actual Name" (Sushant) instead of "Surname" (Markad)
    const getDisplayName = (student) => {
        if (student.lastName) {
            return student.lastName.trim().split(' ')[0];
        }
        return student.firstName || "Student";
    };

    const top3 = leaders.slice(0, 3);
    const rest = leaders.slice(3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); 

    if (loading && leaders.length === 0) return <div className="lb-loading">Loading Ranks...</div>;

    return (
        <div className="content-section">
            
            {/* HEADER */}
            <div className="leaderboard-header-banner">
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h2 className="content-title" style={{color:'white', marginBottom:0, fontSize:'24px'}}>🏆 Champions League</h2>
                    <p style={{color:'rgba(255,255,255,0.9)', margin:'5px 0 20px 0', fontSize:'14px'}}>Compete with the best minds.</p>
                    
                    <div className="lb-my-stats">
                        <div className="stat-item">
                            <span className="stat-label">YOUR RANK</span>
                            <span className="stat-val">{myRank ? `#${myRank}` : '-'}</span>
                        </div>
                        <div className="stat-divider"></div>
                        <div className="stat-item">
                            <span className="stat-label">YOUR XP</span>
                            <span className="stat-val">{user.xp || 0}</span>
                        </div>
                    </div>
                </div>
                <div className="lb-banner-decor"></div>
            </div>

            {/* PODIUM */}
            <div className="podium-stage-container">
                <div className="podium-stage">
                    {podiumOrder.map((student) => {
                        const rank = leaders.indexOf(student) + 1;
                        const isFirst = rank === 1;
                        return (
                            <motion.div 
                                key={student.id}
                                className={`podium-item rank-${rank}`}
                                initial={{ y: 50, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                transition={{ type: 'spring' }}
                            >
                                {isFirst && <div className="crown-icon">👑</div>}
                                <div className="podium-avatar-container">
                                    <img src={getAvatar(student)} alt="avatar" className="podium-avatar" style={{ objectFit: 'cover' }} />
                                    <div className="podium-badge">{rank}</div>
                                </div>
                                <div className="podium-info">
                                    <div className="podium-name-row">
                                        <span className="p-name">{getDisplayName(student)}</span>
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

            {/* LIST */}
            <div className="leaderboard-list-container">
                {rest.map((student, index) => (
                    <motion.div 
                        key={student.id}
                        className={`lb-list-item ${user.uid === student.id ? 'is-me' : ''}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 * index }}
                    >
                        <div className="lb-rank-col">
                            <span className="lb-rank-circle">{index + 4}</span>
                        </div>
                        <div className="lb-user-col">
                            <img src={getAvatar(student)} className="lb-list-avatar" alt="user" style={{ objectFit: 'cover' }} />
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
                        <div className="lb-xp-col">{student.xp || 0} XP</div>
                    </motion.div>
                ))}

                {!showAll && leaders.length >= 50 && (
                    <div style={{textAlign:'center', marginTop:'20px', paddingBottom:'20px'}}>
                        <button onClick={() => setShowAll(true)} className="btn-ghost" style={{color: '#2563eb', cursor: 'pointer'}}>
                            Load Full Leaderboard
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}