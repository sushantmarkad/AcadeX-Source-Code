import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast, { Toaster } from 'react-hot-toast';
import logo from "../assets/logo.png";

// Re-using the premium Login.css layout
import './Login.css'; 

import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion, AnimatePresence } from "framer-motion";
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
    const [showPassword, setShowPassword] = useState(false);

    React.useEffect(() => {
        if (form.year === 'FE') setAvailableSemesters(['1', '2']);
        else if (form.year === 'SE') setAvailableSemesters(['3', '4']);
        else if (form.year === 'TE') setAvailableSemesters(['5', '6']);
        else if (form.year === 'BE') setAvailableSemesters(['7', '8']);
        else setAvailableSemesters([]);
        setForm(prev => ({ ...prev, semester: '' }));
    }, [form.year]);

    const handleVerifyCode = async (e) => {
        e.preventDefault(); setLoading(true); playSound('tap');
        try {
            const q = query(collection(db, 'institutes'), where('code', '==', instituteCode));
            const snap = await getDocs(q);
            if (snap.empty) { 
                playSound('error'); toast.error('Invalid Institute Code'); setLoading(false); return; 
            }
            const data = snap.docs[0].data();
            setInstituteData({ id: snap.docs[0].id, ...data });
            const deptSnap = await getDocs(query(collection(db, 'departments'), where('instituteId', '==', snap.docs[0].id)));
            setDepartments(deptSnap.docs.map(d => d.data().name));
            playSound('success'); toast.success(`Verified: ${data.instituteName}`);
            setStep(2);
        } catch (err) { 
            playSound('error'); toast.error('Verification failed'); 
        } finally { setLoading(false); }
    };

    const validatePassword = (password) => {
        if (password.length < 6) return "Password must be at least 6 characters long.";
        if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return "Password must contain at least one special character.";
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); 
        const passwordMsg = validatePassword(form.password);
        if (passwordMsg) { playSound('error'); toast.error(passwordMsg); return; }
        
        setLoading(true); playSound('tap');
        const toastId = toast.loading("Submitting Application...");
        try {
            const response = await fetch(`${BACKEND_URL}/submitStudentRequest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...form, instituteId: instituteData.id, instituteName: instituteData.instituteName })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Submission failed");
            
            playSound('success'); toast.success("Application Submitted!", { id: toastId });
            setStep(3);
        } catch (err) { 
            playSound('error'); toast.error(err.message, { id: toastId }); 
        } finally { setLoading(false); }
    };

    return (
        <IOSPage>
            <div className="split-layout-wrapper">
                <Toaster position="top-center" reverseOrder={false} />
                
                <div className="split-layout-container">
                    {/* LEFT PANEL */}
                    <div className="left-panel" style={{ background: "linear-gradient(135deg, #eff6ff 0%, #bfdbfe 100%)" }}>
                        <img className="panel-logo" src={logo} alt="trackee Logo" />
                        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="graphic-content">
                            <div className="hero-icon" style={{ color: "#3b82f6" }}><i className="fas fa-user-graduate"></i></div>
                            <h2>Join Your<br/>Institute</h2>
                            <p>Register with your official institute code to access your academic dashboard, track attendance, and stay updated.</p>
                        </motion.div>
                    </div>

                    {/* RIGHT PANEL */}
                    <div className="right-panel" style={{ '--theme-color': '#3b82f6', overflowY: 'auto' }}>
                        
                        {/* Headers (Mirrors Login.js) */}
                        <div className="login-header-mobile">
                            <img className="mobile-logo" src={logo} alt="trackee Logo" />
                            <h1>Welcome to <span style={{ color: "#3b82f6" }}>trackee</span></h1>
                        </div>
                        <div className="desktop-brand-header">
                            <img className="desktop-brand-logo" src={logo} alt="trackee Logo" />
                            <h1 className="desktop-brand-name" style={{ color: "#3b82f6" }}>trackee</h1>
                        </div>

                        {/* Form Content */}
                        <AnimatePresence mode="wait">
                            {step === 1 && (
                                <motion.form key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="login-form" onSubmit={handleVerifyCode}>
                                    <div className="form-header">
                                        <h3 className="form-title">Student Registration</h3>
                                        <p className="form-subtitle">Enter the Institute Code provided by your Admin or Faculty.</p>
                                    </div>
                                    <div className="input-group">
                                        <label>Institute Code</label>
                                        <div className="input-with-icon">
                                            <i className="fas fa-qrcode input-icon"></i>
                                            <input type="text" placeholder="e.g. INS-1234" value={instituteCode} onChange={(e) => setInstituteCode(e.target.value)} required />
                                        </div>
                                    </div>
                                    <motion.button type="submit" className="btn-primary main-submit-btn" disabled={loading} variants={buttonTap} whileTap="tap">
                                        {loading ? 'Verifying...' : 'Continue'} <i className="fas fa-arrow-right ml-2"></i>
                                    </motion.button>
                                    <div className="global-footer-links">
                                        <p>Already registered? <span className="text-link" onClick={() => { playSound('tap'); navigate("/"); }}>Sign In here</span></p>
                                    </div>
                                </motion.form>
                            )}

                            {step === 2 && (
                                <motion.form key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="login-form" onSubmit={handleSubmit}>
                                    <div className="form-header" style={{ marginBottom: '20px' }}>
                                        <h3 className="form-title">Complete Profile</h3>
                                        <p className="form-subtitle" style={{ color: '#10b981', fontWeight: '700' }}>
                                            <i className="fas fa-check-circle"></i> Verified: {instituteData?.instituteName}
                                        </p>
                                    </div>
                                    
                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <div className="input-group" style={{ flex: 1 }}><label>First Name</label><input type="text" required placeholder="John" value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                                        <div className="input-group" style={{ flex: 1 }}><label>Last Name</label><input type="text" required placeholder="Doe" value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
                                    </div>

                                    <div className="input-group">
                                        <label>Department</label>
                                        <select value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid transparent', backgroundColor: '#f8fafc', fontSize: '16px', fontWeight: '600', fontFamily: 'Plus Jakarta Sans' }}>
                                            <option value="">Select Department</option>
                                            {departments.map((dept, i) => <option key={i} value={dept}>{dept}</option>)}
                                        </select>
                                    </div>

                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label>Year</label>
                                            <select value={form.year} onChange={(e) => setForm({...form, year: e.target.value})} required style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid transparent', backgroundColor: '#f8fafc', fontSize: '16px', fontWeight: '600', fontFamily: 'Plus Jakarta Sans' }}>
                                                <option value="">Select</option>
                                                <option value="FE">First Year (FE)</option>
                                                <option value="SE">Second Year (SE)</option>
                                                <option value="TE">Third Year (TE)</option>
                                                <option value="BE">Final Year (BE)</option>
                                            </select>
                                        </div>
                                        <div className="input-group" style={{ flex: 1 }}>
                                            <label>Semester</label>
                                            <select value={form.semester} onChange={(e) => setForm({...form, semester: e.target.value})} required disabled={!form.year} style={{ width: '100%', padding: '16px', borderRadius: '16px', border: '2px solid transparent', backgroundColor: '#f8fafc', fontSize: '16px', fontWeight: '600', fontFamily: 'Plus Jakarta Sans' }}>
                                                <option value="">Select</option>
                                                {availableSemesters.map(sem => <option key={sem} value={sem}>Sem {sem}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '15px' }}>
                                        <div className="input-group" style={{ flex: 1 }}><label>Roll No</label><input type="text" placeholder="e.g. 21" required value={form.rollNo} onChange={e => setForm({...form, rollNo: e.target.value})}/></div>
                                        <div className="input-group" style={{ flex: 1 }}><label>College ID (PRN)</label><input type="text" placeholder="e.g. PRN123" required value={form.collegeId} onChange={e => setForm({...form, collegeId: e.target.value})}/></div>
                                    </div>

                                    <div className="input-group"><label>Email Address</label><input type="email" placeholder="student@college.edu" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
                                    
                                    <div className="input-group">
                                        <label>Create Password</label>
                                        <div className="input-with-icon">
                                            <input type={showPassword ? "text" : "password"} placeholder="••••••••" required value={form.password} onChange={e => setForm({...form, password: e.target.value})} style={{ letterSpacing: showPassword ? '0.5px' : '3px', transition: 'letter-spacing 0.2s ease', width: '100%', paddingLeft: '16px', paddingRight: '48px' }} />
                                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="eye-toggle-btn">
                                                <i className={showPassword ? "fas fa-eye-slash" : "fas fa-eye"}></i>
                                            </button>
                                        </div>
                                    </div>

                                    <div style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                        <motion.button type="button" className="btn-primary" style={{ flex: 1, backgroundColor: '#cbd5e1', color: '#334155', boxShadow: 'none' }} onClick={() => { playSound('tap'); setStep(1); }} variants={buttonTap} whileTap="tap">Back</motion.button>
                                        <motion.button type="submit" className="btn-primary main-submit-btn" disabled={loading} style={{ flex: 2 }} variants={buttonTap} whileTap="tap">{loading ? 'Submitting...' : 'Submit Request'}</motion.button>
                                    </div>
                                </motion.form>
                            )}

                            {step === 3 && (
                                <motion.div key="step3" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="form-header" style={{ textAlign: 'center', marginTop: '40px' }}>
                                    <div style={{ fontSize: '72px', marginBottom: '20px' }}>🎉</div>
                                    <h2 className="form-title">Application Sent!</h2>
                                    <p className="form-subtitle" style={{ marginBottom: '40px' }}>Your registration request has been securely sent to your Department HOD. You will receive an email once your account is approved.</p>
                                    <motion.button className="btn-primary main-submit-btn" onClick={() => navigate('/')} variants={buttonTap} whileTap="tap">Back to Login</motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </IOSPage>
    );
}