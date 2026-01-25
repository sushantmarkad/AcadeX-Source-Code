import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, deleteDoc, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function ManageUsers({ instituteId }) {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [roleFilter, setRoleFilter] = useState('student'); // Default to students

    useEffect(() => {
        fetchUsers();
    }, [instituteId, roleFilter]);

    const fetchUsers = async () => {
        if (!instituteId) return;
        setLoading(true);
        try {
            // Fetch users based on Institute + Role
            const q = query(
                collection(db, 'users'), 
                where('instituteId', '==', instituteId),
                where('role', '==', roleFilter)
            );
            
            const snapshot = await getDocs(q);
            const userList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            // Sort by Name
            userList.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || ''));
            
            setUsers(userList);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load users.");
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (userId) => {
        if(!window.confirm("Are you sure? This will delete the user permanently.")) return;
        
        try {
            await deleteDoc(doc(db, 'users', userId));
            // Optional: You should also delete from Auth via Backend API if needed
            setUsers(users.filter(u => u.id !== userId));
            toast.success("User deleted from database.");
        } catch (err) {
            toast.error("Error deleting user.");
        }
    };

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
                <div className="table-wrapper" style={{ border: 'none' }}>
                    <table className="attendance-table">
                        <thead style={{ background: '#f8fafc' }}>
                            <tr>
                                <th>Name</th>
                                <th>Email</th>
                                {roleFilter === 'student' && <th>Roll No</th>}
                                
                                {/* ✅ ADDED COLLEGE ID COLUMN HERE */}
                                {roleFilter === 'student' && <th>College ID</th>} 
                                
                                <th>Department</th>
                                {roleFilter === 'student' && <th>Year</th>}
                                <th>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr><td colSpan="7" style={{textAlign:'center', padding:'30px'}}>Loading...</td></tr>
                            ) : users.length === 0 ? (
                                <tr><td colSpan="7" style={{textAlign:'center', padding:'30px', color:'#94a3b8'}}>No users found.</td></tr>
                            ) : (
                                users.map(user => (
                                    <tr key={user.id}>
                                        <td style={{ fontWeight: '600', color: '#334155' }}>
                                            {user.firstName} {user.lastName}
                                        </td>
                                        <td>{user.email}</td>
                                        
                                        {/* Roll No */}
                                        {roleFilter === 'student' && (
                                            <td><span className="status-badge-pill" style={{background:'#f1f5f9', color:'#475569'}}>{user.rollNo || '-'}</span></td>
                                        )}

                                        {/* ✅ DISPLAYING COLLEGE ID */}
                                        {roleFilter === 'student' && (
                                            <td style={{ fontFamily:'monospace', color:'#64748b' }}>
                                                {user.collegeId || user.studentId || '-'}
                                            </td>
                                        )}

                                        <td>{user.department || '-'}</td>
                                        
                                        {/* Year */}
                                        {roleFilter === 'student' && (
                                            <td><span className="status-badge status-pending">{user.year || '-'}</span></td>
                                        )}

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
            </div>
        </div>
    );
}