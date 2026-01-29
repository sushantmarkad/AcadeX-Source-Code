import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db, auth } from '../firebase'; // Ensure auth is imported for password reset if needed
import { collection, query, where, getDocs } from 'firebase/firestore';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function AddHOD({ instituteId, instituteName, showModal }) {
    const [departments, setDepartments] = useState([]);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        department: '',
        qualification: '', // ✅ New Field
        phone: ''          // ✅ New Field
    });
    const [loading, setLoading] = useState(false);

    // Fetch Departments for Dropdown
    useEffect(() => {
        const fetchDepts = async () => {
            if (!instituteId) return;
            const q = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
            const snap = await getDocs(q);
            setDepartments(snap.docs.map(d => d.data().name));
        };
        fetchDepts();
    }, [instituteId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Adding HOD...");

        try {
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: form.firstName,
                    lastName: form.lastName,
                    email: form.email,
                    password: form.password,
                    role: 'hod', // Explicitly setting role
                    instituteId,
                    instituteName,
                    department: form.department,
                    // ✅ Sending Extra Fields in 'extras' object or top-level depending on backend
                    // If your backend handles top-level fields, use this:
                    phone: form.phone,
                    qualification: form.qualification,
                    
                    // If your backend puts unknown fields into 'extras', use this:
                    extras: {
                        qualification: form.qualification,
                        phone: form.phone
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to create HOD");

            toast.success("HOD Added Successfully!", { id: toastId });
            setForm({ firstName: '', lastName: '', email: '', password: '', department: '', qualification: '', phone: '' });
            
        } catch (error) {
            console.error("Error adding HOD:", error);
            toast.error(error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Add Head of Department</h2>
            <p className="content-subtitle">Appoint an HOD for a department.</p>

            <div className="card" style={{ maxWidth: '800px' }}>
                <form onSubmit={handleSubmit}>
                    <div style={{ display: 'flex', gap: '15px', flexWrap:'wrap' }}>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label>First Name</label>
                            <input type="text" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label>Last Name</label>
                            <input type="text" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', flexWrap:'wrap' }}>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label>Email Address</label>
                            <input type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label>Password</label>
                            <input type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                        </div>
                    </div>

                    <div className="input-group">
                        <label>Department</label>
                        <select required value={form.department} onChange={e => setForm({ ...form, department: e.target.value })} className="modern-select">
                            <option value="">Select Department</option>
                            {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                        </select>
                    </div>

                    {/* ✅ NEW FIELDS */}
                    <div style={{ display: 'flex', gap: '15px', flexWrap:'wrap' }}>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label>Qualification</label>
                            <input 
                                type="text" 
                                placeholder="e.g. PhD, M.Tech" 
                                value={form.qualification} 
                                onChange={e => setForm({ ...form, qualification: e.target.value })} 
                            />
                        </div>
                        <div className="input-group" style={{ flex: 1 }}>
                            <label>Phone Number</label>
                            <input 
                                type="tel" 
                                placeholder="e.g. +91 9876543210" 
                                value={form.phone} 
                                onChange={e => setForm({ ...form, phone: e.target.value })} 
                            />
                        </div>
                    </div>

                    <button className="btn-primary" disabled={loading} style={{ marginTop: '10px' }}>
                        {loading ? 'Adding HOD...' : 'Appoint HOD'}
                    </button>
                </form>
            </div>
        </div>
    );
}