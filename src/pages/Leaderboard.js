import React, { useState, useEffect } from 'react';
import { auth } from '../firebase'; 
import { motion } from 'framer-motion'; 
import toast from 'react-hot-toast';
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com"; 

// ✅ Single Gender-Neutral Avatar (3D Style)
const DEFAULT_AVATAR = "https://cdn-icons-png.flaticon.com/512/4140/4140037.png";

export default function Leaderboard({ user }) {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myRank, setMyRank] = useState(null);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!user?.uid) return;
            setLoading(true);

            try {
                const token = await auth.currentUser.getIdToken();

                const response = await fetch(`${BACKEND_URL}/getLeaderboard`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ showAll })
                });

                if (!response.ok) throw new Error("Failed to fetch ranks");

                const data = await response.json();
                setLeaders(data.leaders);

                const myIndex = data.leaders.findIndex(u => u.id === user.uid);
                if (myIndex !== -1) setMyRank(myIndex + 1);

            } catch (error) {
                console.error("Leaderboard Error:", error);
                toast.error("Could not load leaderboard.");
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [user?.uid, showAll]);

    // ✅ Simplified Avatar Logic
    const getAvatar = (student) => {
        return student.profilePic || DEFAULT_AVATAR;
    };

    const getDisplayName = (student) => {
        if (student.lastName) return student.lastName.trim().split(' ')[0];
        return student.firstName || "Student";
    };

    const top3 = leaders.slice(0, 3);
    const rest = leaders.slice(3);
    const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean); 

    // ⚡⚡⚡ NEW MODERN LOADER ⚡⚡⚡
    if (loading && leaders.length === 0) {
        return (
            <div className="content-section">
                <div className="lb-loader-container">
                    <div className="lb-spinner"></div>
                    <span className="lb-loading-text">Summoning Champions...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="content-section">
            <div className="leaderboard-header-banner">
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h2 className="content-title" style={{color:'white', marginBottom:0, fontSize:'24px'}}>🏆 Champions League</h2>
                    <p style={{color:'rgba(255,255,255,0.9)', margin:'5px 0 20px 0', fontSize:'14px'}}>
                        {user.year === 'FE' 
                            ? 'Top Performers in First Year' 
                            : `Top Performers in ${user.year} ${user.department}`}
                    </p>
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
                                
                                <div className="lb-dept">
                                    {student.year} 
                                    {student.department && student.department !== student.year && ` ${student.department}`}
                                    {student.division && <span style={{opacity:0.8}}> • Div {student.division}</span>}
                                </div>

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