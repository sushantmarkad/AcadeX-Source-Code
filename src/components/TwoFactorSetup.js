import React, { useState } from 'react';
import { auth } from '../firebase'; 
import toast from 'react-hot-toast';

// REPLACE WITH YOUR RENDER BACKEND URL
const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com"; 

const TwoFactorSetup = ({ user }) => {
    const [qrCode, setQrCode] = useState(null);
    const [code, setCode] = useState('');
    const [step, setStep] = useState(1); 

    const startSetup = async () => {
        const toastId = toast.loading("Generating Secure Key...");
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch(`${BACKEND_URL}/setup2FA`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if(data.qrImage) {
                setQrCode(data.qrImage);
                setStep(2);
                toast.success("Key Generated!", { id: toastId });
            }
        } catch (e) { toast.error("Setup Failed", { id: toastId }); }
    };

    const verifySetup = async () => {
        if(!code) return toast.error("Enter the code first");
        
        const toastId = toast.loading("Verifying Code...");
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch(`${BACKEND_URL}/verify2FA`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ token: code })
            });
            const data = await res.json();
            if (data.success) {
                setStep(3);
                toast.success("2FA Activated Successfully!", { id: toastId });
            } else {
                toast.error("Invalid Code. Try again.", { id: toastId });
            }
        } catch (e) { toast.error("Verification Error", { id: toastId }); }
    };

    // --- ALREADY ENABLED STATE ---
    if (user?.is2FAEnabled) return (
        <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '12px', border: '1px solid #bbf7d0', textAlign: 'center' }}>
            <div style={{ width: '60px', height: '60px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}>
                <i className="fas fa-shield-alt" style={{ fontSize: '24px', color: '#16a34a' }}></i>
            </div>
            <h3 style={{ margin: '0 0 5px 0', color: '#166534', fontSize: '18px' }}>Security Active</h3>
            <p style={{ margin: 0, color: '#15803d', fontSize: '14px' }}>Two-Factor Authentication is currently enabled on your account.</p>
        </div>
    );

    // --- SETUP FLOW ---
    return (
        <div style={{ textAlign: 'center' }}>
            {step === 1 && (
                <div>
                    <p style={{ color: '#64748b', fontSize: '14px', marginBottom: '20px' }}>
                        Add an extra layer of security. You will need a code from Google Authenticator to log in.
                    </p>
                    <button className="btn-primary" onClick={startSetup} style={{ width: '100%', justifyContent: 'center' }}>
                        <i className="fas fa-qrcode"></i> Setup 2FA Now
                    </button>
                </div>
            )}

            {step === 2 && (
                <div className="animate-fade-in">
                    <div style={{ background: 'white', padding: '10px', borderRadius: '12px', border: '1px solid #e2e8f0', display: 'inline-block', marginBottom: '15px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <img src={qrCode} alt="QR" style={{ width: '180px', height: '180px', display: 'block' }} />
                    </div>
                    
                    <p style={{ fontSize: '13px', color: '#475569', marginBottom: '15px' }}>
                        1. Open <strong>Google Authenticator</strong><br/>
                        2. Scan this QR Code<br/>
                        3. Enter the 6-digit code below
                    </p>
                    
                    <input 
                        type="text" 
                        placeholder="000 000" 
                        value={code} 
                        onChange={e => setCode(e.target.value)} 
                        style={{ 
                            width: '80%', padding: '12px', fontSize: '20px', textAlign: 'center', 
                            borderRadius: '8px', border: '2px solid #e2e8f0', marginBottom: '15px',
                            letterSpacing: '5px', fontWeight: 'bold'
                        }} 
                    />
                    
                    <button className="btn-primary" onClick={verifySetup} style={{ width: '100%', justifyContent: 'center' }}>
                        Verify & Activate
                    </button>
                </div>
            )}

            {step === 3 && (
                <div className="animate-fade-in" style={{ padding: '20px 0' }}>
                    <div style={{ width: '60px', height: '60px', background: '#dcfce7', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 15px auto' }}>
                        <i className="fas fa-check" style={{ fontSize: '24px', color: '#16a34a' }}></i>
                    </div>
                    <h3 style={{ color: '#166534', margin: '0 0 10px 0' }}>All Set!</h3>
                    <p style={{ color: '#64748b' }}>Your account is now secured with 2FA.</p>
                </div>
            )}
            
            <style>{`
                .animate-fade-in { animation: fadeIn 0.4s ease-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
};
export default TwoFactorSetup;