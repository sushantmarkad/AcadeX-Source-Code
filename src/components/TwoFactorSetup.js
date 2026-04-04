import React, { useState } from 'react';
import { auth } from '../firebase'; 
import toast from 'react-hot-toast';
import ConfirmModal from './ConfirmModal';
import './TwoFactorSetup.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com"; 

const TwoFactorSetup = ({ user }) => {
    const [qrCode, setQrCode] = useState(null);
    const [code, setCode] = useState('');
    const [step, setStep] = useState(1); 
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- SETUP LOGIC ---
    const startSetup = async () => {
        const toastId = toast.loading("Generating Key...");
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
                toast.success("Ready to Scan!", { id: toastId });
            }
        } catch (e) { 
            toast.error("Setup Failed", { id: toastId }); 
        }
    };

    const verifySetup = async () => {
        if(!code || code.length !== 6) return toast.error("Enter a valid 6-digit code");
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
                toast.success("Security Activated!", { id: toastId });
                setTimeout(() => window.location.reload(), 1500);
            } else {
                toast.error("Invalid Code. Try again.", { id: toastId });
            }
        } catch (e) { 
            toast.error("Error verifying", { id: toastId }); 
        }
    };

    // --- DEACTIVATION LOGIC ---
    const handleDeactivate = async () => {
        setIsModalOpen(false); 
        const toastId = toast.loading("Deactivating 2FA...");
        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch(`${BACKEND_URL}/deactivate2FA`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) {
                toast.success("Security Disabled", { id: toastId });
                setTimeout(() => window.location.reload(), 1000);
            } else {
                toast.error("Failed to deactivate", { id: toastId });
            }
        } catch (e) { 
            toast.error("Network Error", { id: toastId }); 
        }
    };

    return (
        <>
            <div className="tfa-premium-card">
                {user?.is2FAEnabled ? (
                    /* ENABLED STATE */
                    <div className="animate-fade-in">
                        <div className="tfa-status-badge">
                            <i className="fas fa-shield-check"></i> 2FA Active
                        </div>
                        <div className="tfa-shield-icon active">
                            <i className="fas fa-lock"></i>
                        </div>
                        <h3 className="tfa-title">Protection Enabled</h3>
                        <p className="tfa-desc">Your account is highly secured with Google Authenticator. A code is required for every login.</p>
                        <button className="tfa-btn tfa-btn-deactivate" onClick={() => setIsModalOpen(true)}>
                            Deactivate Security
                        </button>
                    </div>
                ) : (
                    /* SETUP STATE */
                    <div>
                        {step === 1 && (
                            <div className="animate-fade-in">
                                <div className="tfa-shield-icon">
                                    <i className="fas fa-shield-alt"></i>
                                </div>
                                <h3 className="tfa-title">Two-Factor Security</h3>
                                <p className="tfa-desc">Protect your account from unauthorized access by requiring a secondary code when you log in.</p>
                                <button className="tfa-btn tfa-btn-primary" onClick={startSetup}>
                                    Enable Security
                                </button>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="animate-fade-in">
                                <span className="tfa-step-badge">Step 2 of 3</span>
                                <h3 className="tfa-title" style={{ fontSize: '20px' }}>Scan & Verify</h3>
                                <div className="qr-premium-container">
                                    <img src={qrCode} alt="QR" className="qr-img" />
                                </div>
                                <p className="tfa-desc" style={{ marginBottom: '15px' }}>Scan using <b>Google Authenticator</b> and enter the 6-digit code below.</p>
                                
                                <input 
                                    type="text" 
                                    inputMode="numeric"
                                    pattern="[0-9]*"
                                    maxLength="6"
                                    placeholder="000000" 
                                    className="otp-premium-input"
                                    value={code} 
                                    onChange={e => setCode(e.target.value.replace(/\D/g, ''))} // strictly numbers
                                />
                                
                                <button className="tfa-btn tfa-btn-primary" onClick={verifySetup}>
                                    Verify & Activate
                                </button>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="animate-fade-in">
                                <div className="tfa-shield-icon success">
                                    <i className="fas fa-check"></i>
                                </div>
                                <h3 className="tfa-title">Setup Complete!</h3>
                                <p className="tfa-desc">Your account is now secured. Page will refresh shortly.</p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ConfirmModal 
                isOpen={isModalOpen}
                title="Disable Security?"
                message="Turning off 2FA will remove the extra layer of protection from your account."
                onConfirm={handleDeactivate}
                onCancel={() => setIsModalOpen(false)}
            />
        </>
    );
};

export default TwoFactorSetup;