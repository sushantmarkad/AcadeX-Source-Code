import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import './Dashboard.css';
const BADGE_ICONS = {
    'novice': '🌱',
    'enthusiast': '🔥',
    'expert': '💎',
    'master': '👑'
};

export default function Leaderboard({ user }) {
    const [leaders, setLeaders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLeaderboard = async () => {
            if (!user?.instituteId || !user?.department) return;

            try {
                // Query: Students in same Dept, sorted by XP
                // Note: You might need to create a Composite Index in Firebase Console for this query to work immediately.
                // (InstituteId + Department + Role + XP)
                const q = query(
                    collection(db, 'users'),
                    where('instituteId', '==', user.instituteId),
                    where('department', '==', user.department),
                    where('role', '==', 'student'),
                    orderBy('xp', 'desc'),
                    limit(10)
                );

                const snap = await getDocs(q);
                const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                setLeaders(data);
            } catch (err) {
                console.error("Leaderboard Error:", err);
                // Fallback if index is missing (shows unsorted or partial data)
                setLeaders([]);
            } finally {
                setLoading(false);
            }
        };

        fetchLeaderboard();
    }, [user]);

    // Rank Styling Helper
    const getRankStyle = (index) => {
        if (index === 0) return { background: '#fff7ed', color: '#d97706', border: '2px solid #fbbf24', fontSize: '18px' }; // Gold
        if (index === 1) return { background: '#f8fafc', color: '#475569', border: '2px solid #94a3b8', fontSize: '16px' }; // Silver
        if (index === 2) return { background: '#fff1f2', color: '#be123c', border: '2px solid #fda4af', fontSize: '16px' }; // Bronze
        return { background: 'white', color: '#64748b', border: '1px solid #e2e8f0', fontSize: '14px' };
    };

    return (
        <div className="content-section">
            <div style={{marginBottom:'30px'}}>
                <h2 className="content-title">🏆 Top Performers</h2>
                <p className="content-subtitle">Leaderboard for {user.department}</p>
            </div>

            {/* Current User Stats Card */}
            <div className="card" style={{
                background: 'linear-gradient(135deg, #4f46e5, #7c3aed)', 
                color:'white', 
                marginBottom:'25px', 
                textAlign:'center',
                padding: '30px'
            }}>
                <h1 style={{margin:0, fontSize:'48px', fontWeight:'800'}}>{user.xp || 0}</h1>
                <p style={{margin:0, fontSize:'14px', opacity:0.9, textTransform:'uppercase', letterSpacing:'1px', fontWeight:'600'}}>Your Total XP</p>
            </div>

            <div className="card card-full-width">
                {loading ? <p style={{textAlign:'center', padding:'20px'}}>Loading rankings...</p> : (
                    <div className="leaderboard-list">
                        {leaders.map((student, index) => (
                            <div 
                                key={student.id} 
                                className="leaderboard-item" 
                                style={student.uid === user.uid ? {backgroundColor:'#eff6ff', borderColor:'#3b82f6', transform:'scale(1.02)'} : {}}
                            >
                                <div className="rank-circle" style={getRankStyle(index)}>
                                    {index === 0 ? '👑' : index + 1}
                                </div>
                                
                                <div className="student-details">
    <h4 style={{margin:0, fontSize:'16px', color:'#1e293b', display:'flex', alignItems:'center', gap:'6px'}}>
        {student.firstName} {student.lastName} 
        
        {/* ✅ SHOW BADGES */}
        {student.badges && student.badges.map(b => (
            <span key={b} title={b} style={{fontSize:'14px'}}>{BADGE_ICONS[b]}</span>
        ))}
        
        {student.uid === user.uid && <span style={{fontSize:'11px', marginLeft:'4px', color:'#3b82f6'}}>(You)</span>}
    </h4>
    <small style={{color:'#64748b', fontSize:'12px'}}>Roll No: {student.rollNo || '-'}</small>
</div>
                                
                                <div className="xp-badge">
                                    {student.xp || 0} XP
                                </div>
                            </div>
                        ))}
                        
                        {leaders.length === 0 && (
                            <div style={{textAlign:'center', padding:'30px', color:'#64748b'}}>
                                <i className="fas fa-trophy" style={{fontSize:'30px', marginBottom:'10px', opacity:0.5}}></i>
                                <p>No ranked students yet. Start earning XP!</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}