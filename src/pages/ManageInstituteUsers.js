import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function ManageInstituteUsers({ instituteId, showModal }) {
    const [groupedUsers, setGroupedUsers] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedIds, setSelectedIds] = useState([]);

    useEffect(() => {
        if (!instituteId) return;

        // Fetch Users
        const usersQuery = query(collection(db, "users"), where("instituteId", "==", instituteId));
        const unsubscribe = onSnapshot(usersQuery, (snapshot) => {
            const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Group by Department
            const groups = {};

            users.forEach(user => {
                const dept = user.department || "General"; 
                if (!groups[dept]) {
                    groups[dept] = { hods: [], teachers: [], studentsByYear: {} };
                }
                
                if (user.role === 'hod') groups[dept].hods.push(user);
                
                if (user.role === 'teacher') groups[dept].teachers.push(user);
                
                if (user.role === 'student') {
                    const year = user.year || "Unknown";
                    if (!groups[dept].studentsByYear[year]) {
                        groups[dept].studentsByYear[year] = [];
                    }
                    groups[dept].studentsByYear[year].push(user);
                }
            });

            setGroupedUsers(groups);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [instituteId]);

    // --- DELETE LOGIC ---
    const toggleSelect = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(i => i !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const handleDeleteSelected = () => {
        if (selectedIds.length === 0) return;

        // Use Custom Modal for Confirmation
        showModal(
            'Delete Users?', 
            `Are you sure you want to delete ${selectedIds.length} users? This cannot be undone.`, 
            'danger',
            async () => {
                const toastId = toast.loading("Deleting users...");
                try {
                    const response = await fetch(`${BACKEND_URL}/deleteUsers`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ userIds: selectedIds })
                    });

                    if (!response.ok) {
                        const data = await response.json();
                        throw new Error(data.error || "Deletion failed");
                    }

                    toast.success("Users deleted successfully!", { id: toastId });
                    setSelectedIds([]); // Clear selection
                } catch (error) {
                    console.error(error);
                    toast.error("Failed: " + error.message, { id: toastId });
                }
            }
        );
    };

    if (loading) return <div className="content-section"><p>Loading Institute Data...</p></div>;

    return (
        <div className="content-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <div>
                    <h2 className="content-title">Manage Institute Users</h2>
                    <p className="content-subtitle">Users organized by department and year.</p>
                </div>
            </div>

            {Object.keys(groupedUsers).length === 0 && <p style={{textAlign:'center', color:'#666'}}>No users found.</p>}

            {Object.keys(groupedUsers).sort().map((deptName) => {
                const { hods, teachers, studentsByYear } = groupedUsers[deptName];

                return (
                    <div key={deptName} style={{marginBottom: '50px'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px', paddingBottom:'10px', borderBottom:'2px solid #e2e8f0'}}>
                            <div className="icon-box-modern" style={{background: '#dbeafe', color: '#1e40af'}}>
                                <i className="fas fa-building"></i>
                            </div>
                            <h2 style={{margin:0, color:'#1e3a8a', fontSize:'24px'}}>{deptName} Department</h2>
                        </div>

                        {/* 1. HOD CARD */}
                        {hods.length > 0 && (
                            <div className="card card-full-width" style={{marginBottom:'20px', borderLeft:'4px solid #2563eb'}}>
                                <h4 style={{margin:'0 0 15px 0', color:'#1e40af'}}>Head of Department (HOD)</h4>
                                <div className="table-wrapper">
                                    <table className="attendance-table">
                                        <thead><tr><th style={{width:'40px'}}>Select</th><th>Name</th><th>Email</th><th>Status</th></tr></thead>
                                        <tbody>
                                            {hods.map(h => (
                                                <tr key={h.id} className={selectedIds.includes(h.id) ? 'row-selected' : ''}>
                                                    <td><input type="checkbox" className="custom-checkbox" checked={selectedIds.includes(h.id)} onChange={() => toggleSelect(h.id)}/></td>
                                                    <td style={{fontWeight:'bold'}}>{h.firstName} {h.lastName}</td>
                                                    <td>{h.email}</td>
                                                    <td><span className="status-badge status-approved">Active</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* 2. TEACHERS CARD */}
                        <div className="card" style={{marginBottom: '30px'}}>
                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                                <h4 style={{margin:0}}>Teachers</h4>
                                <span className="nav-badge" style={{background:'#059669'}}>{teachers.length}</span>
                            </div>
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th style={{width:'40px'}}></th><th>Name</th><th>Assigned Classes</th></tr></thead>
                                    <tbody>
                                        {teachers.map(t => (
                                            <tr key={t.id} className={selectedIds.includes(t.id) ? 'row-selected' : ''}>
                                                <td><input type="checkbox" className="custom-checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)}/></td>
                                                <td>{t.firstName} {t.lastName}</td>
                                                <td>
                                                    {t.assignedClasses && t.assignedClasses.length > 0 ? (
                                                        <div style={{display:'flex', gap:'5px', flexWrap:'wrap'}}>
                                                            {t.assignedClasses.map((cls, idx) => (
                                                                <span key={idx} className="status-badge-pill" style={{fontSize:'11px', background:'#eff6ff', color:'#1e40af', border:'1px solid #bfdbfe'}}>
                                                                    <strong>{cls.year}</strong>: {cls.subject}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span style={{color:'#9ca3af', fontStyle:'italic'}}>No classes assigned</span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {teachers.length === 0 && <tr><td colSpan="3" style={{color:'gray', textAlign:'center', padding:'20px'}}>No teachers found.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* 3. STUDENTS (Separated by Year) */}
                        <h3 style={{color:'#475569', fontSize:'18px', marginBottom:'15px'}}>Students</h3>
                        
                        {Object.keys(studentsByYear).length === 0 ? (
                            <p style={{color:'gray', fontStyle:'italic'}}>No students in this department.</p>
                        ) : (
                            <div style={{display:'grid', gap:'20px'}}>
                                {['FE', 'SE', 'TE', 'BE'].map(year => {
                                    const yearStudents = studentsByYear[year] || [];
                                    if (yearStudents.length === 0) return null;

                                    return (
                                        <div key={year} className="card">
                                            <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px', alignItems:'center'}}>
                                                <h4 style={{margin:0, color:'#334155'}}>{year} Students</h4>
                                                <span className="nav-badge" style={{background:'#64748b'}}>{yearStudents.length}</span>
                                            </div>
                                            <div className="table-wrapper">
                                                <table className="attendance-table">
                                                    <thead><tr><th style={{width:'40px'}}></th><th>Roll No</th><th>Name</th><th>College ID</th></tr></thead>
                                                    <tbody>
                                                        {yearStudents.sort((a,b) => (a.rollNo || "").localeCompare(b.rollNo, undefined, {numeric: true})).map(s => (
                                                            <tr key={s.id} className={selectedIds.includes(s.id) ? 'row-selected' : ''}>
                                                                <td><input type="checkbox" className="custom-checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)}/></td>
                                                                <td>{s.rollNo}</td>
                                                                <td>{s.firstName} {s.lastName}</td>
                                                                <td style={{fontWeight:'bold', color:'#64748b'}}>{s.collegeId || '-'}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
            
            {/* FLOATING DELETE BUTTON */}
            {selectedIds.length > 0 && (
                <button className="floating-delete-btn" onClick={handleDeleteSelected}>
                    <i className="fas fa-trash-alt"></i> Delete ({selectedIds.length})
                </button>
            )}
        </div>
    );
}