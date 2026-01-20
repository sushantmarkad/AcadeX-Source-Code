import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import logo from "../assets/logo.png";
import './Login.css'; 

import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function StudentRegister() {
    const [step, setStep] = useState(1);
    const [instituteCode, setInstituteCode] = useState('');
    const [instituteData, setInstituteData] = useState(null);
    const [departments, setDepartments] = useState([]);
    
    const [form, setForm] = useState({ 
        firstName: '', lastName: '', email: '', rollNo: '', 
        department: '', year: '', semester: '', 
        collegeId: '', password: '' 
    });
    
    const [availableSemesters, setAvailableSemesters] = useState([]);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const playSound = useIOSSound();

    React.useEffect(() => {
        if (form.year === 'FE') setAvailableSemesters(['1', '2']);
        else if (form.year === 'SE') setAvailableSemesters(['3', '4']);
        else if (form.year === 'TE') setAvailableSemesters(['5', '6']);
        else if (form.year === 'BE') setAvailableSemesters(['7', '8']);
        else setAvailableSemesters([]);
        
        setForm(prev => ({ ...prev, semester: '' }));
    }, [form.year]);

    const handleVerifyCode = async (e) => {
        e.preventDefault(); setLoading(true);
        playSound('tap');

        try {
            const q = query(collection(db, 'institutes'), where('code', '==', instituteCode));
            const snap = await getDocs(q);
            
            if (snap.empty) { 
                playSound('error');
                toast.error('Invalid Institute Code');
                setLoading(false); 
                return; 
            }

            const data = snap.docs[0].data();
            setInstituteData({ id: snap.docs[0].id, ...data });
            
            const deptSnap = await getDocs(query(collection(db, 'departments'), where('instituteId', '==', snap.docs[0].id)));
            setDepartments(deptSnap.docs.map(d => d.data().name));
            
            playSound('success');
            toast.success(`Verified: ${data.instituteName}`);
            setStep(2);

        } catch (err) { 
            playSound('error'); 
            toast.error('Verification failed'); 
        } finally { 
            setLoading(false); 
        }
    };

    // ✅ Helper function for password validation
    const validatePassword = (password) => {
        if (password.length < 6) return "Password must be at least 6 characters long.";
        if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password must contain at least one special character.";
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        
        // 1. Validate Password
        const passwordMsg = validatePassword(form.password);
        if (passwordMsg) {
            playSound('error');
            toast.error(passwordMsg);
            return;
        }

        setLoading(true);
        playSound('tap');
        const toastId = toast.loading("Submitting Application...");
        
        try {
            // ✅ CALL BACKEND (It handles Duplicate Checks safely)
            // If Roll No exists, backend sends 400 error, caught below.
            const response = await fetch(`${BACKEND_URL}/submitStudentRequest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    ...form, 
                    instituteId: instituteData.id, 
                    instituteName: instituteData.instituteName 
                })
            });

            const data = await response.json();

            if (!response.ok) {
                // Throw the error message sent by backend (e.g. "Roll No already exists")
                throw new Error(data.error || "Submission failed");
            }
            
            playSound('success');
            toast.success("Application Submitted!", { id: toastId });
            setStep(3);

        } catch (err) { 
            playSound('error');
            // Show the backend error in the Toast
            toast.error(err.message, { id: toastId }); 
        } finally { 
            setLoading(false); 
        }
    };

    return (
        <IOSPage>
            <div className="login-wrapper">
                <Toaster position="top-center" reverseOrder={false} />
                
                <div className="login-container">
                    <div className="login-header">
                        <img className="login-logo" src={logo} alt="AcadeX" />
                        <h1>Student Registration</h1>
                    </div>

                    {step === 1 && (
                        <form className="login-form" onSubmit={handleVerifyCode}>
                            <p className="subtitle" style={{textAlign:'center'}}>Enter Institute Code provided by Admin</p>
                            <div className="input-group">
                                <input type="text" placeholder="e.g. INS-1234" value={instituteCode} onChange={(e) => setInstituteCode(e.target.value)} required />
                            </div>
                            
                            <motion.button type="submit" className="btn-primary" disabled={loading} variants={buttonTap} whileTap="tap">
                                {loading ? 'Verifying...' : 'Next'}
                            </motion.button>
                            <p style={{marginTop:'15px', textAlign:'center', fontSize:'14px'}}>Already registered? <span style={{color:"#2563eb", cursor:"pointer"}} onClick={() => { playSound('tap'); navigate("/"); }}>Sign In</span></p>
                        </form>
                    )}

                    {step === 2 && (
                        <form className="login-form" onSubmit={handleSubmit}>
                            <p className="subtitle" style={{textAlign:'center', color:'#166534', marginBottom:'15px', background:'#f0fdf4', padding:'8px', borderRadius:'8px', border:'1px solid #bbf7d0'}}>
                                Verified: <strong>{instituteData?.instituteName}</strong>
                            </p>
                            
                            <div className="input-group">
                                <label>Department</label>
                                <select value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} required>
                                    <option value="">Select Department</option>
                                    {departments.map((dept, i) => <option key={i} value={dept}>{dept}</option>)}
                                </select>
                            </div>

                            <div style={{display:'flex', gap:'15px'}}>
                                <div className="input-group" style={{flex:1}}>
                                    <label>Year</label>
                                    <select value={form.year} onChange={(e) => setForm({...form, year: e.target.value})} required>
                                        <option value="">Select</option>
                                        <option value="FE">FE</option>
                                        <option value="SE">SE</option>
                                        <option value="TE">TE</option>
                                        <option value="BE">BE</option>
                                    </select>
                                </div>
                                <div className="input-group" style={{flex:1}}>
                                    <label>Semester</label>
                                    <select value={form.semester} onChange={(e) => setForm({...form, semester: e.target.value})} required disabled={!form.year}>
                                        <option value="">Select</option>
                                        {availableSemesters.map(sem => <option key={sem} value={sem}>{sem}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{display:'flex', gap:'15px'}}>
                                <div className="input-group"><label>Roll No</label><input type="text" placeholder="e.g. 21" required value={form.rollNo} onChange={e => setForm({...form, rollNo: e.target.value})}/></div>
                                <div className="input-group"><label>College ID</label><input type="text" placeholder="e.g. PRN123" required value={form.collegeId} onChange={e => setForm({...form, collegeId: e.target.value})}/></div>
                            </div>

                            <div style={{display:'flex', gap:'15px'}}>
                                <div className="input-group"><label>First Name</label><input type="text" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                                <div className="input-group"><label>Last Name</label><input type="text" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
                            </div>
                            <div className="input-group"><label>Email</label><input type="email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
                            <div className="input-group"><label>Password</label><input type="password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})}/></div>
                            
                            <div style={{display: 'flex', gap: '15px', marginTop: '20px'}}>
                                <motion.button type="button" className="btn-secondary" style={{flex: 1}} onClick={() => { playSound('tap'); setStep(1); }} variants={buttonTap} whileTap="tap">Back</motion.button>
                                <motion.button type="submit" className="btn-primary" disabled={loading} style={{flex: 1}} variants={buttonTap} whileTap="tap">{loading ? '...' : 'Submit'}</motion.button>
                            </div>
                        </form>
                    )}

                    {step === 3 && (
                        <div style={{textAlign: 'center', padding:'20px'}}>
                            <div style={{fontSize: '60px', marginBottom: '10px'}}>🎉</div>
                            <h2 style={{fontSize:'20px', color:'#1e293b', margin:'0 0 10px 0'}}>Application Sent!</h2>
                            <p className="subtitle" style={{marginBottom:'30px'}}>Your request has been sent to the HOD. You will receive an email once approved.</p>
                            <motion.button className="btn-primary" onClick={() => navigate('/')} variants={buttonTap} whileTap="tap">Back to Login</motion.button>
                        </div>
                    )}
                </div>
            </div>
        </IOSPage>
    );
}