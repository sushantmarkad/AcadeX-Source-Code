import React, { useState } from 'react';
import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import './Dashboard.css';

export default function AddDepartment({ instituteId, instituteName, showModal }) {
    const [deptName, setDeptName] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await addDoc(collection(db, 'departments'), {
                name: deptName,
                instituteId: instituteId,
                instituteName: instituteName,
                createdAt: serverTimestamp()
            });
            // ✅ Custom Modal Success
            showModal('Success', `Department "${deptName}" added successfully!`);
            setDeptName('');
        } catch (err) {
            // ✅ Custom Modal Error
            showModal('Error', "Failed to add department. " + err.message, 'danger');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Add New Department</h2>
            <div className="card">
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
        </div>
    );
}