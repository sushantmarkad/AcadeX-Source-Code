import React, { useState, useEffect } from 'react';
import { auth, db, sendPasswordResetEmail } from '../firebase'; 
import { collection, query, where, getDocs } from "firebase/firestore";
import toast from 'react-hot-toast'; 
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function AddStudent({ instituteId, instituteName }) {
    const [form, setForm] = useState({ firstName: "", lastName: "", email: "", rollNo: "", department: "", password: "" });
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);

    // 1. Fetch Departments
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

    // 2. Handle Submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading("Verifying Roll No...");

        try {
            // ✅ STEP 1: Check for Duplicate Roll No
            const q = query(
                collection(db, "users"),
                where("instituteId", "==", instituteId),
                where("department", "==", form.department),
                where("rollNo", "==", form.rollNo)
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                throw new Error(`Roll No. ${form.rollNo} already exists in ${form.department}!`);
            }

            // ✅ STEP 2: Create User in Backend (Database Only)
            toast.loading("Creating Student...", { id: toastId });
            
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...form, 
                    role: 'student', 
                    instituteId, 
                    instituteName 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Failed to create student");
            }

            // ✅ STEP 3: Send Reset Email (Frontend)
            await sendPasswordResetEmail(auth, form.email);

            // Success!
            toast.success('Student added! Reset email sent.', { id: toastId });
            setForm({ firstName: "", lastName: "", email: "", rollNo: "", department: "", password: "" });

        } catch (err) {
            console.error(err);
            toast.error("Error: " + err.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Add Student</h2>
            <div className="card">
                <form onSubmit={handleSubmit}>
                    <div className="input-group"><label>First Name</label><input type="text" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})} required /></div>
                    <div className="input-group"><label>Last Name</label><input type="text" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})} required /></div>
                    
                    <div className="input-group">
                        <label>Department</label>
                        <select value={form.department} onChange={e => setForm({...form, department: e.target.value})} required>
                            <option value="">Select Department</option>
                            {departments.map((dept, index) => (
                                <option key={index} value={dept}>{dept}</option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group"><label>Roll No</label><input type="text" value={form.rollNo} onChange={e => setForm({...form, rollNo: e.target.value})} required /></div>
                    <div className="input-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
                    <div className="input-group"><label>Temp Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
                    
                    <button className="btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Student'}</button>
                </form>
            </div>
        </div>
    );
}