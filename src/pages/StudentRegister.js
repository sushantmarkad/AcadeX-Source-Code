import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './Login.css'; 

// Animation Imports
import IOSPage from "../components/IOSPage";
import useIOSSound from "../hooks/useIOSSound";
import { motion } from "framer-motion";
import { buttonTap } from "../animations/interactionVariants";

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
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const playSound = useIOSSound();

    // Update Semester options when Year changes
    React.useEffect(() => {
        if (form.year === 'FE') setAvailableSemesters(['1', '2']);
        else if (form.year === 'SE') setAvailableSemesters(['3', '4']);
        else if (form.year === 'TE') setAvailableSemesters(['5', '6']);
        else if (form.year === 'BE') setAvailableSemesters(['7', '8']);
        else setAvailableSemesters([]);
        
        setForm(prev => ({ ...prev, semester: '' }));
    }, [form.year]);

    const handleVerifyCode = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        playSound('tap');
        try {
            const q = query(collection(db, 'institutes'), where('code', '==', instituteCode));
            const snap = await getDocs(q);
            if (snap.empty) { 
                playSound('error');
                setError('❌ Invalid Institute Code'); 
                setLoading(false); 
                return; 
            }
            const data = snap.docs[0].data();
            setInstituteData({ id: snap.docs[0].id, ...data });
            const deptSnap = await getDocs(query(collection(db, 'departments'), where('instituteId', '==', snap.docs[0].id)));
            setDepartments(deptSnap.docs.map(d => d.data().name));
            playSound('success');
            setStep(2);
        } catch (err) { playSound('error'); setError('Verification failed'); } finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        playSound('tap');
        try {
            await addDoc(collection(db, 'student_requests'), { 
                ...form, 
                instituteId: instituteData.id, 
                instituteName: instituteData.instituteName, 
                status: 'pending', 
                createdAt: serverTimestamp() 
            });
            playSound('success');
            setStep(3);
        } catch (err) { playSound('error'); setError(err.message); } finally { setLoading(false); }
    };

    return (
        <IOSPage>
            <div className="login-wrapper">
                <div className="login-container">
                    <div className="login-header">
                        <img className="login-logo" src="https://iili.io/KoAVeZg.md.png" alt="AcadeX" />
                        <h1>Student Registration</h1>
                    </div>

                    {step === 1 && (
                        <form className="login-form" onSubmit={handleVerifyCode}>
                            <p className="subtitle" style={{textAlign:'center'}}>Enter Institute Code</p>
                            <div className="input-group">
                                <input type="text" placeholder="e.g. INS-1234" value={instituteCode} onChange={(e) => setInstituteCode(e.target.value)} required />
                            </div>
                            {error && <p className="error-message">{error}</p>}
                            <motion.button type="submit" className="btn-primary" disabled={loading} variants={buttonTap} whileTap="tap">
                                {loading ? 'Verifying...' : 'Next'}
                            </motion.button>
                            <p style={{marginTop:'15px', textAlign:'center', fontSize:'14px'}}>Already registered? <span style={{color:"#2563eb", cursor:"pointer"}} onClick={() => { playSound('tap'); navigate("/"); }}>Sign In</span></p>
                        </form>
                    )}

                    {step === 2 && (
                        <form className="login-form" onSubmit={handleSubmit}>
                            <p className="subtitle" style={{textAlign:'center', color:'green', marginBottom:'15px'}}>Verified: <strong>{instituteData?.instituteName}</strong></p>
                            
                            <div className="input-group">
                                <label style={{marginBottom:'5px', display:'block', fontSize:'12px', fontWeight:'600'}}>Department</label>
                                <select value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} required>
                                    <option value="">Select Department</option>
                                    {departments.map((dept, i) => <option key={i} value={dept}>{dept}</option>)}
                                </select>
                            </div>

                            <div style={{display:'flex', gap:'10px'}}>
                                <div className="input-group" style={{flex:1}}>
                                    <label style={{marginBottom:'5px', display:'block', fontSize:'12px', fontWeight:'600'}}>Year</label>
                                    <select value={form.year} onChange={(e) => setForm({...form, year: e.target.value})} required>
                                        <option value="">Year</option>
                                        <option value="FE">FE</option>
                                        <option value="SE">SE</option>
                                        <option value="TE">TE</option>
                                        <option value="BE">BE</option>
                                    </select>
                                </div>
                                <div className="input-group" style={{flex:1}}>
                                    <label style={{marginBottom:'5px', display:'block', fontSize:'12px', fontWeight:'600'}}>Semester</label>
                                    <select value={form.semester} onChange={(e) => setForm({...form, semester: e.target.value})} required disabled={!form.year}>
                                        <option value="">Sem</option>
                                        {availableSemesters.map(sem => <option key={sem} value={sem}>{sem}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div style={{display:'flex', gap:'10px'}}>
                                <div className="input-group"><input type="text" placeholder="Roll No" required value={form.rollNo} onChange={e => setForm({...form, rollNo: e.target.value})}/></div>
                                <div className="input-group"><input type="text" placeholder="College ID" required value={form.collegeId} onChange={e => setForm({...form, collegeId: e.target.value})}/></div>
                            </div>

                            <div style={{display:'flex', gap:'10px'}}>
                                <div className="input-group"><input type="text" placeholder="First Name" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                                <div className="input-group"><input type="text" placeholder="Last Name" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
                            </div>
                            <div className="input-group"><input type="email" placeholder="Email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
                            <div className="input-group"><input type="password" placeholder="Create Password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})}/></div>

                            {error && <p className="error-message">{error}</p>}
                            
                            {/* ✅ FIXED: Buttons Side-by-Side */}
                            <div style={{display: 'flex', gap: '15px', marginTop: '20px'}}>
                                <motion.button 
                                    type="button" 
                                    className="btn-secondary" 
                                    style={{flex: 1, marginTop: 0}} 
                                    onClick={() => { playSound('tap'); setStep(1); }}
                                    variants={buttonTap}
                                    whileTap="tap"
                                >
                                    Back
                                </motion.button>

                                <motion.button 
                                    type="submit" 
                                    className="btn-primary" 
                                    disabled={loading}
                                    style={{flex: 1, marginTop: 0}}
                                    variants={buttonTap}
                                    whileTap="tap"
                                >
                                    {loading ? '...' : 'Submit'}
                                </motion.button>
                            </div>

                        </form>
                    )}

                    {step === 3 && (
                        <div style={{textAlign: 'center', padding:'20px'}}>
                            <div style={{fontSize: '50px', marginBottom: '20px'}}>🎉</div>
                            <p className="success-message">Application Submitted! Wait for HOD approval.</p>
                            <motion.button className="btn-primary" onClick={() => navigate('/')} variants={buttonTap} whileTap="tap">Back to Home</motion.button>
                        </div>
                    )}
                </div>
            </div>
        </IOSPage>
    );
}