import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// ✅ Receiving 'showModal' prop for the modern popup
export default function AddDepartment({ instituteId, instituteName, showModal }) {
    const [deptName, setDeptName] = useState('');
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);

    // 1. Fetch Departments
    useEffect(() => {
        if (!instituteId) return;
        
        const q = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const deptList = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDepartments(deptList);
        });

        return () => unsubscribe();
    }, [instituteId]);

    // 2. Handle Add
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Adding Department...");

        try {
            await addDoc(collection(db, 'departments'), {
                name: deptName,
                instituteId: instituteId,
                instituteName: instituteName,
                createdAt: serverTimestamp()
            });
            
            toast.success(`Department "${deptName}" added!`, { id: toastId });
            setDeptName('');
        } catch (err) {
            toast.error("Failed: " + err.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // 3. ✅ FIXED: Handle Delete using Modern Modal (No more 'localhost says')
    const handleDelete = (deptId, name) => {
        // Use the custom modal passed from Dashboard
        showModal(
            'Delete Department?', 
            `Are you sure you want to delete the ${name} department?`, 
            'danger', 
            async () => {
                const toastId = toast.loading("Deleting...");
                try {
                    const response = await fetch(`${BACKEND_URL}/deleteDepartment`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ deptId })
                    });

                    if(!response.ok) throw new Error("Delete failed");

                    toast.success("Department deleted successfully", { id: toastId });
                } catch (err) {
                    toast.error("Error: " + err.message, { id: toastId });
                }
            }
        );
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Manage Departments</h2>
            
            {/* ADD FORM */}
            <div className="card" style={{marginBottom: '30px'}}>
                <h3 style={{marginTop:0}}>Add New</h3>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label>Department Name</label>
                        <input 
                            type="text" 
                            placeholder="e.g. Computer Science" 
                            value={deptName} 
                            onChange={(e) => setDeptName(e.target.value)} 
                            required 
                        />
                    </div>
                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Adding...' : 'Add Department'}
                    </button>
                </form>
            </div>

            {/* LIST OF DEPARTMENTS */}
            <div className="card card-full-width">
                <h3 style={{marginTop:0}}>Existing Departments ({departments.length})</h3>
                <div className="table-wrapper">
                    <table className="attendance-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th style={{textAlign: 'right'}}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map(dept => (
                                <tr key={dept.id}>
                                    <td style={{fontWeight:'600', color:'#374151'}}>{dept.name}</td>
                                    <td style={{textAlign: 'right'}}>
                                        <button 
                                            onClick={() => handleDelete(dept.id, dept.name)}
                                            className="btn-delete"
                                            style={{width: 'auto', padding: '6px 12px', fontSize: '12px'}}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {departments.length === 0 && (
                                <tr><td colSpan="2" style={{textAlign:'center', color:'gray'}}>No departments found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}