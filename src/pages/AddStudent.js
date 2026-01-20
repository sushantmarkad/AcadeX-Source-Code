import React, { useState, useEffect } from 'react';
import { auth, db, sendPasswordResetEmail } from '../firebase'; 
import { collection, query, where, getDocs } from "firebase/firestore";
import toast from 'react-hot-toast'; 
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function AddStudent({ instituteId, instituteName }) {
    const [form, setForm] = useState({ 
        firstName: "", lastName: "", email: "", rollNo: "", 
        department: "", collegeId: "", 
        year: "", semester: "", // ✅ New Fields
        password: "" 
    });
    
    const [loading, setLoading] = useState(false);
    const [departments, setDepartments] = useState([]);
    const [availableSemesters, setAvailableSemesters] = useState([]);

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

    // 2. Update Semesters based on Year
    useEffect(() => {
        if (form.year === 'FE') setAvailableSemesters(['1', '2']);
        else if (form.year === 'SE') setAvailableSemesters(['3', '4']);
        else if (form.year === 'TE') setAvailableSemesters(['5', '6']);
        else if (form.year === 'BE') setAvailableSemesters(['7', '8']);
        else setAvailableSemesters([]);
        
        setForm(prev => ({ ...prev, semester: '' }));
    }, [form.year]);

    // ✅ Helper function for password validation
    const validatePassword = (password) => {
        if (password.length < 6) return "Password must be at least 6 characters long.";
        if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password must contain at least one special character.";
        return null;
    };

    // 3. Handle Submit
    const handleSubmit = async (e) => {
        e.preventDefault();

        // ✅ Validate Password
        const passwordMsg = validatePassword(form.password);
        if (passwordMsg) {
            toast.error(passwordMsg);
            return;
        }

        setLoading(true);
        const toastId = toast.loading("Verifying Details...");

        try {
            const usersRef = collection(db, "users");

            // Check College ID
            const qColId = query(usersRef, where("instituteId", "==", instituteId), where("collegeId", "==", form.collegeId));
            if (!(await getDocs(qColId)).empty) throw new Error(`College ID "${form.collegeId}" exists!`);

            // Check Roll No
            const qRoll = query(usersRef, where("instituteId", "==", instituteId), where("department", "==", form.department), where("rollNo", "==", form.rollNo));
            if (!(await getDocs(qRoll)).empty) throw new Error(`Roll No. ${form.rollNo} exists in ${form.department}!`);

            // Create User
            toast.loading("Creating Student...", { id: toastId });
            
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...form, 
                    role: 'student', 
                    instituteId, 
                    instituteName,
                    extras: { 
                        collegeId: form.collegeId,
                        year: form.year,       // ✅ Save Year
                        semester: form.semester // ✅ Save Semester
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to create student");

            await sendPasswordResetEmail(auth, form.email);

            toast.success('Student added successfully!', { id: toastId });
            setForm({ firstName: "", lastName: "", email: "", rollNo: "", collegeId: "", department: "", year: "", semester: "", password: "" });

        } catch (err) {
            // ✅ Handle Email Duplicates specifically
            let msg = err.message;
            if (msg.includes("email-already-in-use")) msg = "Email is already registered!";
            
            toast.error("Error: " + msg, { id: toastId });
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
                            {departments.map((dept, index) => <option key={index} value={dept}>{dept}</option>)}
                        </select>
                    </div>

                    {/* ✅ NEW: Year & Semester Row */}
                    <div style={{display:'flex', gap:'15px'}}>
                        <div className="input-group" style={{flex:1}}>
                            <label>Year / Class</label>
                            <select value={form.year} onChange={e => setForm({...form, year: e.target.value})} required>
                                <option value="">Select</option>
                                <option value="FE">FE (First Year)</option>
                                <option value="SE">SE (Second Year)</option>
                                <option value="TE">TE (Third Year)</option>
                                <option value="BE">BE (Final Year)</option>
                            </select>
                        </div>
                        <div className="input-group" style={{flex:1}}>
                            <label>Semester</label>
                            <select value={form.semester} onChange={e => setForm({...form, semester: e.target.value})} required disabled={!form.year}>
                                <option value="">Select</option>
                                {availableSemesters.map(sem => <option key={sem} value={sem}>Sem {sem}</option>)}
                            </select>
                        </div>
                    </div>

                    <div style={{display:'flex', gap:'15px'}}>
                        <div className="input-group" style={{flex:1}}><label>Roll No</label><input type="text" value={form.rollNo} onChange={e => setForm({...form, rollNo: e.target.value})} required /></div>
                        <div className="input-group" style={{flex:1}}><label>College ID</label><input type="text" placeholder="e.g. PRN123" value={form.collegeId} onChange={e => setForm({...form, collegeId: e.target.value})} required /></div>
                    </div>

                    <div className="input-group"><label>Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required /></div>
                    <div className="input-group"><label>Password</label><input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} required /></div>
                    
                    <button className="btn-primary" disabled={loading}>{loading ? 'Adding...' : 'Add Student'}</button>
                </form>
            </div>
        </div>
    );
}