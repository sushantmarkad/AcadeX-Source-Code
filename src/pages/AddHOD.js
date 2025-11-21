import React, { useState, useEffect } from 'react';
import { auth, sendPasswordResetEmail, db } from '../firebase';
import { collection, query, where, getDocs } from "firebase/firestore";
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function AddHOD({ instituteId, instituteName, showModal }) {
    const [form, setForm] = useState({ firstName: "", lastName: "", email: "", department: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);

    useEffect(() => {
        const fetchDepartments = async () => {
            if (!instituteId) return;
            try {
                const q = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
                const snap = await getDocs(q);
                setDepartments(snap.docs.map(doc => doc.data().name));
            } catch (err) { console.error(err); }
        };
        fetchDepartments();
    }, [instituteId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, role: 'hod', instituteId, instituteName })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);

            await sendPasswordResetEmail(auth, form.email);
            
            // ✅ Use Modal instead of Alert
            showModal('Success', 'HOD Account Created! Password reset email sent.');
            setForm({ firstName: "", lastName: "", email: "", department: "", password: "" });
        } catch (err) {
            showModal('Error', err.message, 'danger');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Add Head of Department</h2>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="input-group"><label>First Name</label><input type="text" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required /></div>
                    <div className="input-group"><label>Last Name</label><input type="text" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required /></div>
                    <div className="input-group">
                        <label>Department</label>
                        <select value={form.department} onChange={e => setForm({...form, department: e.target.value})} required>
                            <option value="">Select Department</option>
                            {departments.map((dept, index) => <option key={index} value={dept}>{dept}</option>)}
                        </select>
                    </div>
                    <div className="input-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
                    <div className="input-group"><label>Temp Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
                    <button className="btn-primary" disabled={loading}>{loading ? 'Creating...' : 'Create HOD'}</button>
                </form>
            </div>
        </div>
    );
}