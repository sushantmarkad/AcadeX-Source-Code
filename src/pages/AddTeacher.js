import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, getDocs } from "firebase/firestore";
import toast from 'react-hot-toast'; 
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function AddTeacher({ instituteId, instituteName }) {
    // ✅ Added assignedYears to state
    const [form, setForm] = useState({ firstName: "", lastName: "", email: "", subject: "", department: "", password: "", assignedYears: [] });
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

    // ✅ Handle Checkbox Change
    const handleYearChange = (year) => {
        setForm(prev => {
            const years = prev.assignedYears.includes(year) 
                ? prev.assignedYears.filter(y => y !== year)
                : [...prev.assignedYears, year];
            return { ...prev, assignedYears: years };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        if (form.assignedYears.length === 0) {
            toast.error("Please assign at least one class year.");
            return;
        }

        setLoading(true);
        const toastId = toast.loading("Adding Teacher...");

        try {
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...form, 
                    role: 'teacher', 
                    instituteId, 
                    instituteName
                })
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || "Failed to create teacher");
            }

            toast.success('Teacher Added Successfully!', { id: toastId });
            setForm({ firstName: "", lastName: "", email: "", subject: "", department: "", password: "", assignedYears: [] });

        } catch (err) {
            toast.error("Error: " + err.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Add Teacher</h2>
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

                    {/* ✅ New Multi-Select for Years */}
                    <div className="input-group">
                        <label>Assign Classes (Years)</label>
                        <div style={{display:'flex', gap:'15px', marginTop:'5px'}}>
                            {['FE', 'SE', 'TE', 'BE'].map(year => (
                                <label key={year} style={{display:'flex', alignItems:'center', gap:'8px', cursor:'pointer', background:'#f1f5f9', padding:'8px 15px', borderRadius:'6px', border: form.assignedYears.includes(year) ? '1px solid #2563eb' : '1px solid transparent'}}>
                                    <input 
                                        type="checkbox" 
                                        checked={form.assignedYears.includes(year)}
                                        onChange={() => handleYearChange(year)}
                                    />
                                    {year}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className="input-group"><label>Subject</label><input type="text" value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required /></div>
                    <div className="input-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
                    <div className="input-group"><label>Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
                    <button className="btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Teacher'}</button>
                </form>
            </div>
        </div>
    );
}