import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot, deleteDoc, doc } from 'firebase/firestore';
import './Dashboard.css';

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
                    groups[dept] = { hods: [], teachers: [], students: [] };
                }
                if (user.role === 'hod') groups[dept].hods.push(user);
                if (user.role === 'teacher') groups[dept].teachers.push(user);
                if (user.role === 'student') groups[dept].students.push(user);
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

        showModal(
            'Delete Users?', 
            `Are you sure you want to delete ${selectedIds.length} users? This cannot be undone.`, 
            'danger',
            async () => {
                try {
                    const promises = selectedIds.map(id => deleteDoc(doc(db, "users", id)));
                    await Promise.all(promises);
                    setSelectedIds([]); // Clear selection
                    // No alert needed, modal closes automatically via callback wrapper in parent
                } catch (error) {
                    console.error(error);
                    alert("Failed to delete users.");
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
                    <p className="content-subtitle">Users organized by department.</p>
                </div>
                {selectedIds.length > 0 && (
                    <button 
                        onClick={handleDeleteSelected} 
                        className="btn-primary btn-danger-solid" 
                        style={{width:'auto', padding:'10px 20px'}}
                    >
                        Delete Selected ({selectedIds.length})
                    </button>
                )}
            </div>

            {Object.keys(groupedUsers).length === 0 && <p style={{textAlign:'center', color:'#666'}}>No users found.</p>}

            {Object.keys(groupedUsers).sort().map((deptName) => {
                const { hods, teachers, students } = groupedUsers[deptName];

                return (
                    <div key={deptName} style={{marginBottom: '40px'}}>
                        <div style={{display:'flex', alignItems:'center', gap:'10px', marginBottom:'15px'}}>
                            <div className="icon-box-modern" style={{background: '#dbeafe', color: '#1e40af'}}>
                                <i className="fas fa-building"></i>
                            </div>
                            <h2 style={{margin:0, color:'#1e3a8a', fontSize:'22px'}}>{deptName} Department</h2>
                        </div>

                        {/* 1. HOD CARD (No Checkbox usually for HOD, but adding for consistency if you want) */}
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
                                        {hods.length === 0 && <tr><td colSpan="4" style={{fontStyle:'italic', color:'gray'}}>No HOD assigned.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="cards-grid">
                            {/* 2. TEACHERS CARD */}
                            <div className="card">
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                                    <h4 style={{margin:0}}>Teachers</h4>
                                    <span className="nav-badge" style={{background:'#059669'}}>{teachers.length}</span>
                                </div>
                                <div className="table-wrapper">
                                    <table className="attendance-table">
                                        <thead><tr><th style={{width:'40px'}}></th><th>Name</th><th>Subject</th></tr></thead>
                                        <tbody>
                                            {teachers.map(t => (
                                                <tr key={t.id} className={selectedIds.includes(t.id) ? 'row-selected' : ''}>
                                                    <td><input type="checkbox" className="custom-checkbox" checked={selectedIds.includes(t.id)} onChange={() => toggleSelect(t.id)}/></td>
                                                    <td>{t.firstName} {t.lastName}</td>
                                                    <td>{t.subject}</td>
                                                </tr>
                                            ))}
                                            {teachers.length === 0 && <tr><td colSpan="3" style={{color:'gray'}}>No teachers.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            {/* 3. STUDENTS CARD */}
                            <div className="card">
                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'15px'}}>
                                    <h4 style={{margin:0}}>Students</h4>
                                    <span className="nav-badge" style={{background:'#2563eb'}}>{students.length}</span>
                                </div>
                                <div className="table-wrapper">
                                    <table className="attendance-table">
                                        <thead><tr><th style={{width:'40px'}}></th><th>Roll No</th><th>Name</th></tr></thead>
                                        <tbody>
                                            {students.sort((a,b) => (a.rollNo || "").localeCompare(b.rollNo, undefined, {numeric: true})).map(s => (
                                                <tr key={s.id} className={selectedIds.includes(s.id) ? 'row-selected' : ''}>
                                                    <td><input type="checkbox" className="custom-checkbox" checked={selectedIds.includes(s.id)} onChange={() => toggleSelect(s.id)}/></td>
                                                    <td>{s.rollNo}</td>
                                                    <td>{s.firstName} {s.lastName}</td>
                                                </tr>
                                            ))}
                                            {students.length === 0 && <tr><td colSpan="3" style={{color:'gray'}}>No students.</td></tr>}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}