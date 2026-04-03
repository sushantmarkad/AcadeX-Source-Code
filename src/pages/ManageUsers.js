import React, { useState, useEffect, useMemo } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';
import { useInstitution } from '../contexts/InstitutionContext';

export default function ManageUsers({ instituteId }) {
    // 🚨 OPTIMIZATION: We store ALL users here, so we only pay for the read ONCE.
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState('student'); 

    const { config } = useInstitution();

    // Fetch users ONLY ONCE when the component mounts
    useEffect(() => {
        const fetchAllUsers = async () => {
            if (!instituteId) return;
            setLoading(true);
            try {
                // Fetch every user for this institute in a single, one-time query
                const q = query(collection(db, 'users'), where('instituteId', '==', instituteId));
                const snapshot = await getDocs(q);
                
                const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                userList.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
                
                setAllUsers(userList);
            } catch (err) {
                console.error(err);
                toast.error("Failed to load users.");
            } finally {
                setLoading(false);
            }
        };

        fetchAllUsers();
    }, [instituteId]); // Notice roleFilter is NO LONGER in this dependency array!

    // 🚨 OPTIMIZATION: Filter instantly in memory (Costs 0 Firebase Reads)
    const displayedUsers = useMemo(() => {
        return allUsers.filter(u => u.role === roleFilter);
    }, [allUsers, roleFilter]);


    const handleDelete = async (userId) => {
        if(!window.confirm("Are you sure? This will delete the user permanently.")) return;
        try {
            await deleteDoc(doc(db, 'users', userId));
            // Remove from local state instantly without re-fetching
            setAllUsers(prev => prev.filter(u => u.id !== userId));
            toast.success("User deleted from database.");
        } catch (err) {
            toast.error("Error deleting user.");
        }
    };

    // --- GROUP STUDENTS BY YEAR LOGIC (Costs 0 reads) ---
    const groupedStudents = useMemo(() => {
        if (roleFilter !== 'student') return {};
        
        return displayedUsers.reduce((acc, user) => {
            const year = user.year || 'Unknown Year';
            if (!acc[year]) acc[year] = [];
            acc[year].push(user);
            return acc;
        }, {});
    }, [displayedUsers, roleFilter]);

    const yearOrder = { 'FE': 1, 'SE': 2, 'TE': 3, 'BE': 4 };
    const sortedYears = Object.keys(groupedStudents).sort((a, b) => (yearOrder[a] || 99) - (yearOrder[b] || 99));

    return (
        <div className="content-section fade-in">
            <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 className="content-title">Manage Users</h2>
                
                {/* Role Filter Toggle */}
                <div style={{ background: '#e2e8f0', padding: '4px', borderRadius: '8px', display: 'flex' }}>
                    <button 
                        onClick={() => setRoleFilter('student')}
                        style={{
                            padding: '6px 15px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize:'13px',
                            background: roleFilter === 'student' ? '#fff' : 'transparent',
                            color: roleFilter === 'student' ? '#2563eb' : '#64748b',
                            boxShadow: roleFilter === 'student' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        Students
                    </button>
                    <button 
                        onClick={() => setRoleFilter('teacher')}
                        style={{
                            padding: '6px 15px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontWeight: '600', fontSize:'13px',
                            background: roleFilter === 'teacher' ? '#fff' : 'transparent',
                            color: roleFilter === 'teacher' ? '#2563eb' : '#64748b',
                            boxShadow: roleFilter === 'teacher' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        Teachers
                    </button>
                </div>
            </div>

            <div className="card card-full-width" style={{ marginTop: '20px', padding: '0', overflow: 'hidden' }}>
                {roleFilter === 'student' ? (
                    <div style={{ padding: '20px' }}>
                        {loading ? (
                            <p style={{ textAlign: 'center', padding: '30px' }}>Loading...</p>
                        ) : displayedUsers.length === 0 ? (
                            <p style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No students found.</p>
                        ) : (
                            sortedYears.map(year => (
                                <div key={year} style={{ marginBottom: '30px', background: 'white', borderRadius: '12px', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
                                    <div style={{ background: '#f8fafc', padding: '15px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ background: '#eff6ff', color: '#3b82f6', width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <i className="fas fa-graduation-cap"></i>
                                            </div>
                                            {year} Class
                                        </h3>
                                        <span className="status-badge-pill" style={{ background: '#eff6ff', color: '#2563eb', fontWeight: 'bold' }}>
                                            {groupedStudents[year].length} Students
                                        </span>
                                    </div>
                                    <div className="table-wrapper" style={{ border: 'none', margin: 0 }}>
                                        <table className="attendance-table" style={{ margin: 0 }}>
                                            <thead style={{ background: 'white' }}>
                                                <tr>
                                                    <th>Name</th>
                                                    <th>Email</th>
                                                    <th>Roll No</th>
                                                    <th>College ID</th>
                                                    <th>Department</th>
                                                    <th style={{ textAlign: 'center' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupedStudents[year].map(user => (
                                                    <tr key={user.id}>
                                                        <td style={{ fontWeight: '600', color: '#334155' }}>
                                                            {user.firstName} {user.lastName}
                                                        </td>
                                                        <td>{user.email}</td>
                                                        <td><span className="status-badge-pill" style={{ background: '#f1f5f9', color: '#475569' }}>{user.rollNo || '-'}</span></td>
                                                        <td style={{ fontFamily: 'monospace', color: '#64748b' }}>{user.collegeId || user.studentId || '-'}</td>
                                                        <td>{user.department || '-'}</td>
                                                        <td style={{ textAlign: 'center' }}>
                                                            <button 
                                                                onClick={() => handleDelete(user.id)}
                                                                style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}
                                                                title="Delete User"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                ) : (
                    /* Existing Teacher Table */
                    <div className="table-wrapper" style={{ border: 'none' }}>
                        <table className="attendance-table">
                            <thead style={{ background: '#f8fafc' }}>
                                <tr>
                                    <th>Name</th>
                                    <th>Email</th>
                                    <th>Department</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px' }}>Loading...</td></tr>
                                ) : displayedUsers.length === 0 ? (
                                    <tr><td colSpan="4" style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No teachers found.</td></tr>
                                ) : (
                                    displayedUsers.map(user => (
                                        <tr key={user.id}>
                                            <td style={{ fontWeight: '600', color: '#334155' }}>
                                                {user.firstName} {user.lastName}
                                            </td>
                                            <td>{user.email}</td>
                                            <td>{user.department || '-'}</td>
                                            <td>
                                                <button 
                                                    onClick={() => handleDelete(user.id)}
                                                    style={{ background: '#fee2e2', color: '#ef4444', border: 'none', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer' }}
                                                    title="Delete User"
                                                >
                                                    <i className="fas fa-trash"></i>
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}