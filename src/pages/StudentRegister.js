import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import './Login.css'; 

export default function StudentRegister() {
    const [step, setStep] = useState(1);
    const [instituteCode, setInstituteCode] = useState('');
    const [instituteData, setInstituteData] = useState(null);
    const [departments, setDepartments] = useState([]);
    
    // ✅ Added rollNo to initial state
    const [form, setForm] = useState({ firstName: '', lastName: '', email: '', rollNo: '', department: '', collegeId: '', password: '' });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleVerifyCode = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            const q = query(collection(db, 'institutes'), where('code', '==', instituteCode));
            const snap = await getDocs(q);
            if (snap.empty) { setError('❌ Invalid Institute Code'); setLoading(false); return; }
            
            const data = snap.docs[0].data();
            setInstituteData({ id: snap.docs[0].id, ...data });

            const deptSnap = await getDocs(query(collection(db, 'departments'), where('instituteId', '==', snap.docs[0].id)));
            setDepartments(deptSnap.docs.map(d => d.data().name));
            setStep(2);
        } catch (err) { setError('Verification failed'); } finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault(); setError(''); setLoading(true);
        try {
            await addDoc(collection(db, 'student_requests'), { ...form, instituteId: instituteData.id, instituteName: instituteData.instituteName, status: 'pending', createdAt: serverTimestamp() });
            setStep(3);
        } catch (err) { setError(err.message); } finally { setLoading(false); }
    };

    return (
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
                    <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Verifying...' : 'Next'}</button>
                    <p style={{marginTop:'15px', textAlign:'center', fontSize:'14px'}}>Already registered? <span style={{color:"#2563eb", cursor:"pointer"}} onClick={() => navigate("/")}>Sign In</span></p>
                </form>
            )}

            {step === 2 && (
                <form className="login-form" onSubmit={handleSubmit}>
                    <p className="subtitle" style={{textAlign:'center', color:'green', marginBottom:'15px'}}>Verified: <strong>{instituteData?.instituteName}</strong></p>
                    
                    <div className="input-group">
                        <select value={form.department} onChange={(e) => setForm({...form, department: e.target.value})} required>
                            <option value="">Select Department</option>
                            {departments.map((dept, i) => <option key={i} value={dept}>{dept}</option>)}
                        </select>
                    </div>

                    {/* ✅ FIXED: Added Roll No Input */}
                    <div style={{display:'flex', gap:'10px'}}>
                         <div className="input-group">
                            <input type="text" placeholder="Roll No" required value={form.rollNo} onChange={e => setForm({...form, rollNo: e.target.value})}/>
                        </div>
                        <div className="input-group">
                            <input type="text" placeholder="College ID / PRN" required value={form.collegeId} onChange={e => setForm({...form, collegeId: e.target.value})}/>
                        </div>
                    </div>

                    <div style={{display:'flex', gap:'10px'}}>
                        <div className="input-group"><input type="text" placeholder="First Name" required value={form.firstName} onChange={e => setForm({...form, firstName: e.target.value})}/></div>
                        <div className="input-group"><input type="text" placeholder="Last Name" required value={form.lastName} onChange={e => setForm({...form, lastName: e.target.value})}/></div>
                    </div>
                    <div className="input-group"><input type="email" placeholder="Email" required value={form.email} onChange={e => setForm({...form, email: e.target.value})}/></div>
                    <div className="input-group"><input type="password" placeholder="Create Password" required value={form.password} onChange={e => setForm({...form, password: e.target.value})}/></div>

                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" className="btn-primary" disabled={loading}>{loading ? 'Submitting...' : 'Submit'}</button>
                    
                    {/* ✅ FIXED: Back Button Class */}
                    <button type="button" className="btn-secondary" style={{marginTop:'10px', width:'100%'}} onClick={() => setStep(1)}>Back</button>
                </form>
            )}

            {step === 3 && (
                <div style={{textAlign: 'center', padding:'20px'}}>
                    <div style={{fontSize: '50px', marginBottom: '20px'}}>🎉</div>
                    <p className="success-message">Application Submitted! Wait for HOD approval.</p>
                    <button className="btn-primary" onClick={() => navigate('/')}>Back to Home</button>
                </div>
            )}
        </div>
    );
}