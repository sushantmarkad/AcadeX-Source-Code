import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, where, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useInstitution } from '../contexts/InstitutionContext'; // Import the config context
import './Dashboard.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://acadex-backend-n2wh.onrender.com";

export default function AddDepartment({ instituteId, instituteName, showModal }) {
    const [deptName, setDeptName] = useState('');
    const [duration, setDuration] = useState(4); // Default to 4 years
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(false);

    // Dynamic terminology based on domain
    const { config } = useInstitution(); 
    const isPharmacy = config?.domain === 'PHARMACY';
    const hierarchyLabel = isPharmacy ? "Program" : "Department";

    // 1. Fetch Departments / Programs
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
        const toastId = toast.loading(`Adding ${hierarchyLabel}...`);

        try {
            await addDoc(collection(db, 'departments'), {
                name: deptName,
                durationInYears: Number(duration), // Save the specific duration
                instituteId: instituteId,
                instituteName: instituteName,
                createdAt: serverTimestamp()
            });
            
            toast.success(`${hierarchyLabel} "${deptName}" added!`, { id: toastId });
            setDeptName('');
            setDuration(4); // Reset to default
        } catch (err) {
            toast.error("Failed: " + err.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // 3. Handle Delete using Modern Modal
    const handleDelete = (deptId, name) => {
        showModal(
            `Delete ${hierarchyLabel}?`, 
            `Are you sure you want to delete the ${name} ${hierarchyLabel.toLowerCase()}?`, 
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

                    toast.success(`${hierarchyLabel} deleted successfully`, { id: toastId });
                } catch (err) {
                    toast.error("Error: " + err.message, { id: toastId });
                }
            }
        );
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Manage {hierarchyLabel}s</h2>
            
            {/* ADD FORM */}
            <div className="card" style={{marginBottom: '30px'}}>
                <h3 style={{marginTop:0}}>Add New {hierarchyLabel}</h3>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '20px', alignItems: 'end' }}>
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>{hierarchyLabel} Name</label>
                            <input 
                                type="text" 
                                placeholder={isPharmacy ? "e.g. B.Pharm, PharmD" : "e.g. Computer Science"} 
                                value={deptName} 
                                onChange={(e) => setDeptName(e.target.value)} 
                                required 
                            />
                        </div>
                        
                        <div className="input-group" style={{ marginBottom: 0 }}>
                            <label>Duration</label>
                            <select 
                                value={duration} 
                                onChange={(e) => setDuration(e.target.value)} 
                                required
                                style={{ 
                                    width: '100%', 
                                    padding: '12px 16px', 
                                    borderRadius: '8px', 
                                    border: '1px solid #cbd5e1', 
                                    background: '#f8fafc',
                                    fontSize: '15px',
                                    color: '#1e293b'
                                }}
                            >
                                <option value="1">1 Year</option>
                                <option value="2">2 Years</option>
                                <option value="3">3 Years</option>
                                <option value="4">4 Years (Default)</option>
                                <option value="5">5 Years</option>
                                <option value="6">6 Years</option>
                            </select>
                        </div>
                    </div>

                    <button type="submit" className="btn-primary" disabled={loading} style={{ marginTop: '20px' }}>
                        {loading ? 'Adding...' : `Add ${hierarchyLabel}`}
                    </button>
                </form>
            </div>

            {/* LIST OF DEPARTMENTS / PROGRAMS */}
            <div className="card card-full-width">
                <h3 style={{marginTop:0}}>Existing {hierarchyLabel}s ({departments.length})</h3>
                <div className="table-wrapper">
                    <table className="attendance-table">
                        <thead>
                            <tr>
                                <th>Name</th>
                                <th style={{textAlign: 'center'}}>Duration</th>
                                <th style={{textAlign: 'right'}}>Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.map(dept => (
                                <tr key={dept.id}>
                                    <td style={{fontWeight:'600', color:'#374151'}}>{dept.name}</td>
                                    
                                    <td style={{textAlign: 'center'}}>
                                        <span style={{ background: '#e0e7ff', color: '#3730a3', padding: '4px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 'bold' }}>
                                            {dept.durationInYears || 4} Years
                                        </span>
                                    </td>

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
                                <tr><td colSpan="3" style={{textAlign:'center', color:'gray'}}>No {hierarchyLabel.toLowerCase()}s found.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}