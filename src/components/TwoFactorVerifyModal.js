import React, { useState } from 'react';
import './TwoFactorVerifyModal.css'; // Uses your uploaded CSS

const TwoFactorVerifyModal = ({ isOpen, onClose, onVerify, isLoading, onBiometricAuth }) => {
    const [code, setCode] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (code.length === 6) {
            onVerify(code);
        }
    };

    return (
        <div className="modal-backdrop">
            <div className="tfa-verify-card">
                <div className="tfa-verify-icon">🔐</div>
                <h2 style={{margin: '10px 0', color: '#1e293b'}}>Security Check</h2>
                <p style={{color: '#64748b', marginBottom: '20px'}}>
                    Enter the 6-digit code from your Authenticator App.
                </p>
                
                <form onSubmit={handleSubmit}>
                    <input 
                        type="text" 
                        className="verify-input"
                        placeholder="000 000"
                        maxLength={6}
                        value={code}
                        onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                        autoFocus
                    />
                    
                    <div className="verify-actions">
                        <button type="button" className="btn-cancel" onClick={onClose} disabled={isLoading}>
                            Cancel
                        </button>
                        <button type="submit" className="btn-confirm" disabled={code.length !== 6 || isLoading} style={{background: '#10b981', color: 'white', border: 'none', padding: '12px', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', flex: 1}}>
                            {isLoading ? 'Verifying...' : 'Verify'}
                        </button>
                    </div>
                </form>

                {/* ✅ ADDED: Biometric Button Section */}
                {onBiometricAuth && (
                    <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '1px solid #e2e8f0' }}>
                        <button 
                            onClick={onBiometricAuth}
                            style={{ 
                                background: 'transparent', border: 'none', 
                                color: '#3b82f6', fontWeight: '600', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                                width: '100%', fontSize: '14px'
                            }}
                        >
                            <i className="fas fa-fingerprint" style={{fontSize: '16px'}}></i> 
                            Use Biometrics Instead
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default TwoFactorVerifyModal;