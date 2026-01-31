import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- HELPER: Random Pastel Color for Avatars ---
const getAvatarColor = (name) => {
    const colors = ['#eff6ff', '#f0fdf4', '#fef2f2', '#fff7ed', '#f0f9ff', '#faf5ff'];
    const textColors = ['#1d4ed8', '#15803d', '#b91c1c', '#c2410c', '#0369a1', '#7e22ce'];
    const index = name.length % colors.length;
    return { bg: colors[index], text: textColors[index] };
};

const Avatar = ({ name }) => {
    const { bg, text } = getAvatarColor(name);
    const initials = name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    return (
        <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            backgroundColor: bg, color: text,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: '700', border: `1px solid ${bg}`
        }}>
            {initials}
        </div>
    );
};

export default function ManageInstituteUsers({ instituteId, showModal }) {
    const [groupedUsers, setGroupedUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);
    const [collapsedDepts, setCollapsedDepts] = useState({});

    useEffect(() => {
        if (!instituteId) return;

        const usersQuery = query(collection(db, "users"), where("instituteId", "==", instituteId));
        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            const groups = {};
            users.forEach(user => {
                const dept = user.department || "General"; 
                if (!groups[dept]) groups[dept] = { hods: [], teachers: [], studentsByYear: {} };
                
                if (user.role === 'hod') groups[dept].hods.push(user);
                if (user.role === 'teacher') groups[dept].teachers.push(user);
                if (user.role === 'student') {
                    const year = user.year || "Unknown";
                    if (!groups[dept].studentsByYear[year]) groups[dept].studentsByYear[year] = [];
                    groups[dept].studentsByYear[year].push(user);
                }
            });
            setGroupedUsers(groups);
            setLoading(false);
        });
        return () => unsubscribe();
    }, [instituteId]);

    // --- ACTIONS ---
    const toggleSelect = (id) => {
        setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    };

    const handleSelectGroup = (users) => {
        const ids = users.map(u => u.id);
        const allSelected = ids.every(id => selectedIds.includes(id));
        setSelectedIds(prev => allSelected ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])]);
    };

    const handleDeleteSelected = () => {
        if (selectedIds.length === 0) return;
        showModal('Delete Users?', `Permanently delete ${selectedIds.length} users?`, 'danger', async () => {
            const toastId = toast.loading("Deleting...");
            try {
                const res = await fetch(`${BACKEND_URL}/deleteUsers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: selectedIds })
                });
                if (!res.ok) throw new Error("Failed");
                toast.success("Deleted successfully", { id: toastId });
                setSelectedIds([]);
            } catch (e) { toast.error("Error deleting", { id: toastId }); }
        });
    };

    if (loading) return <div className="content-section"><p style={{color:'#94a3b8'}}>Loading users...</p></div>;

    return (
        <div className="content-section" style={{ paddingBottom: '100px', position: 'relative' }}>
            <div style={{ marginBottom: '30px' }}>
                <h2 className="content-title">Manage Users</h2>
                <p className="content-subtitle">Organize and manage your institute's members.</p>
            </div>

            {Object.keys(groupedUsers).length === 0 && (
                <div style={{ textAlign: 'center', padding: '60px', color: '#cbd5e1' }}>
                    <i className="fas fa-users" style={{ fontSize: '48px', marginBottom: '15px' }}></i>
                    <p>No users found.</p>
                </div>
            )}

            {Object.keys(groupedUsers).sort().map((dept) => {
                const { hods, teachers, studentsByYear } = groupedUsers[dept];
                const isCollapsed = collapsedDepts[dept];

                // Calculate total users in this department for "Select All" logic
                const allDeptUsers = [...hods, ...teachers, ...Object.values(studentsByYear).flat()];

                return (
                    <div key={dept} className="dept-card-modern">
                        
                        {/* HEADER */}
                        <div className="dept-header" onClick={() => setCollapsedDepts(p => ({...p, [dept]: !p[dept]}))}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div className="dept-icon">
                                    <i className={`fas ${isCollapsed ? 'fa-chevron-right' : 'fa-folder-open'}`}></i>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0, fontSize: '17px', color: '#1e293b' }}>{dept}</h3>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>{allDeptUsers.length} Members</p>
                                </div>
                            </div>

                            <div onClick={(e) => e.stopPropagation()} className="select-all-pill">
                                <input 
                                    type="checkbox" 
                                    checked={allDeptUsers.length > 0 && allDeptUsers.every(u => selectedIds.includes(u.id))}
                                    onChange={() => handleSelectGroup(allDeptUsers)}
                                    className="custom-checkbox"
                                />
                                <span>Select All</span>
                            </div>
                        </div>

                        {/* CONTENT */}
                        {!isCollapsed && (
                            <div className="dept-body">
                                
                                {/* HOD & Teachers Grid */}
                                {(hods.length > 0 || teachers.length > 0) && (
                                    <div className="role-section">
                                        <h4 className="role-title">Faculty</h4>
                                        <div className="user-grid">
                                            {[...hods, ...teachers].map(user => (
                                                <UserCard 
                                                    key={user.id} 
                                                    user={user} 
                                                    isSelected={selectedIds.includes(user.id)} 
                                                    onToggle={() => toggleSelect(user.id)} 
                                                    role={user.role === 'hod' ? 'Head of Dept' : 'Teacher'}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Students Section */}
                                {Object.keys(studentsByYear).length > 0 && (
                                    <div className="role-section">
                                        <h4 className="role-title" style={{marginTop:'20px'}}>Students</h4>
                                        <div className="year-container">
                                            {['FE', 'SE', 'TE', 'BE'].map(year => {
                                                const students = studentsByYear[year] || [];
                                                if (students.length === 0) return null;
                                                
                                                return (
                                                    <div key={year} className="year-column">
                                                        <div className="year-header">
                                                            <span>{year} Year ({students.length})</span>
                                                            <input 
                                                                type="checkbox" 
                                                                className="custom-checkbox"
                                                                checked={students.every(s => selectedIds.includes(s.id))}
                                                                onChange={() => handleSelectGroup(students)}
                                                            />
                                                        </div>
                                                        <div className="student-list">
                                                            {students.sort((a,b)=> (a.rollNo||'').localeCompare(b.rollNo,undefined,{numeric:true})).map(s => (
                                                                <StudentRow 
                                                                    key={s.id} 
                                                                    student={s} 
                                                                    isSelected={selectedIds.includes(s.id)} 
                                                                    onToggle={() => toggleSelect(s.id)} 
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}

            {/* --- FLOATING DELETE BAR (GLASSMORPHISM) --- */}
            <div className={`floating-bar ${selectedIds.length > 0 ? 'visible' : ''}`}>
                <div className="fb-content">
                    <div className="fb-left">
                        <div className="count-circle">{selectedIds.length}</div>
                        <span>Selected</span>
                    </div>
                    <div className="fb-actions">
                        <button className="fb-btn-cancel" onClick={() => setSelectedIds([])}>Unselect</button>
                        <button className="fb-btn-delete" onClick={handleDeleteSelected}>
                            <i className="fas fa-trash-alt"></i> Delete
                        </button>
                    </div>
                </div>
            </div>

            {/* --- STYLES --- */}
            <style>{`
                .dept-card-modern {
                    background: #fff;
                    border-radius: 16px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.03);
                    border: 1px solid #f1f5f9;
                    margin-bottom: 25px;
                    overflow: hidden;
                    transition: all 0.2s ease;
                }
                .dept-card-modern:hover {
                    box-shadow: 0 8px 30px rgba(0,0,0,0.06);
                }

                .dept-header {
                    padding: 18px 24px;
                    background: linear-gradient(to right, #ffffff, #f8fafc);
                    border-bottom: 1px solid #f1f5f9;
                    display: flex; justify-content: space-between; align-items: center;
                    cursor: pointer;
                }
                .dept-icon {
                    width: 38px; height: 38px; border-radius: 10px;
                    background: #eff6ff; color: #2563eb;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 14px;
                }
                .select-all-pill {
                    display: flex; align-items: center; gap: 8px;
                    padding: 6px 12px; background: #fff;
                    border: 1px solid #e2e8f0; border-radius: 20px;
                    font-size: 12px; font-weight: 600; color: #64748b;
                    transition: 0.2s;
                }
                .select-all-pill:hover { background: #f1f5f9; }

                .dept-body { padding: 24px; }
                .role-title {
                    font-size: 11px; text-transform: uppercase; letter-spacing: 1px;
                    color: #94a3b8; font-weight: 700; margin-bottom: 15px;
                }

                /* GRID FOR TEACHERS */
                .user-grid {
                    display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
                    gap: 15px;
                }
                .user-card {
                    display: flex; align-items: center; gap: 12px;
                    padding: 12px; border-radius: 12px;
                    border: 1px solid #f1f5f9; background: #fff;
                    cursor: pointer; transition: 0.2s;
                }
                .user-card:hover { border-color: #bfdbfe; background: #eff6ff; }
                .user-card.selected { background: #eff6ff; border-color: #3b82f6; }

                /* STUDENT COLUMNS */
                .year-container {
                    display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 20px;
                }
                .year-column {
                    background: #f8fafc; border-radius: 12px;
                    border: 1px solid #e2e8f0; overflow: hidden;
                }
                .year-header {
                    padding: 12px 15px; background: #f1f5f9;
                    font-size: 13px; font-weight: 700; color: #475569;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .student-list { max-height: 250px; overflow-y: auto; }
                
                .student-row {
                    display: flex; align-items: center; gap: 10px;
                    padding: 10px 15px; border-bottom: 1px solid #f1f5f9;
                    cursor: pointer; transition: 0.1s;
                }
                .student-row:hover { background: #fff; }
                .student-row.selected { background: #eff6ff; }
                
                /* FLOATING BAR */
                .floating-bar {
                    position: fixed; bottom: 30px; left: 50%;
                    transform: translateX(-50%) translateY(100px);
                    opacity: 0; transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
                    z-index: 1000;
                }
                .floating-bar.visible {
                    transform: translateX(-50%) translateY(0);
                    opacity: 1;
                }
                .fb-content {
                    background: rgba(15, 23, 42, 0.9);
                    backdrop-filter: blur(12px);
                    -webkit-backdrop-filter: blur(12px);
                    padding: 12px 20px; border-radius: 50px;
                    display: flex; align-items: center; gap: 30px;
                    box-shadow: 0 20px 40px rgba(0,0,0,0.2);
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .fb-left { display: flex; align-items: center; gap: 10px; color: white; font-size: 13px; font-weight: 500; }
                .count-circle {
                    background: #3b82f6; width: 24px; height: 24px;
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    font-size: 11px; font-weight: 800; color: white;
                }
                .fb-actions { display: flex; align-items: center; gap: 10px; }
                .fb-btn-cancel {
                    background: transparent; color: #94a3b8; border: none;
                    cursor: pointer; font-size: 12px; font-weight: 600;
                }
                .fb-btn-cancel:hover { color: white; }
                .fb-btn-delete {
                    background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                    color: white; border: none; padding: 8px 18px;
                    border-radius: 20px; font-size: 12px; font-weight: 600;
                    display: flex; align-items: center; gap: 6px; cursor: pointer;
                    box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3);
                }
                .fb-btn-delete:hover { transform: translateY(-1px); box-shadow: 0 6px 15px rgba(239, 68, 68, 0.4); }

                /* Checkbox Reset */
                .custom-checkbox {
                    width: 16px; height: 16px; accent-color: #2563eb; cursor: pointer;
                }
            `}</style>
        </div>
    );
}

// --- SUB COMPONENTS ---

const UserCard = ({ user, isSelected, onToggle, role }) => (
    <div className={`user-card ${isSelected ? 'selected' : ''}`} onClick={onToggle}>
        <input type="checkbox" className="custom-checkbox" checked={isSelected} readOnly />
        <Avatar name={user.firstName + ' ' + user.lastName} />
        <div style={{overflow: 'hidden'}}>
            <h5 style={{margin:0, fontSize:'13px', color:'#1e293b', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>
                {user.firstName} {user.lastName}
            </h5>
            <p style={{margin:0, fontSize:'11px', color: role.includes('Head') ? '#2563eb' : '#059669', fontWeight:'600'}}>
                {role}
            </p>
        </div>
    </div>
);

const StudentRow = ({ student, isSelected, onToggle }) => (
    <div className={`student-row ${isSelected ? 'selected' : ''}`} onClick={onToggle}>
        <input type="checkbox" className="custom-checkbox" checked={isSelected} readOnly />
        <Avatar name={student.firstName + ' ' + student.lastName} />
        <div style={{flex:1}}>
            <div style={{display:'flex', justifyContent:'space-between', width:'100%'}}>
                <span style={{fontSize:'12px', fontWeight:'700', color:'#475569'}}>{student.rollNo || 'N/A'}</span>
            </div>
            <div style={{fontSize:'13px', color:'#1e293b', fontWeight:'500'}}>
                {student.firstName} {student.lastName}
            </div>
        </div>
    </div>
);