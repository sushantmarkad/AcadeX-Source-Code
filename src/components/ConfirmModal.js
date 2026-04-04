import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';

const ConfirmModal = ({ isOpen, title, message, onConfirm, onCancel }) => {
    // Lock background scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => { document.body.style.overflow = 'unset'; };
    }, [isOpen]);

    if (!isOpen) return null;

    const modalContent = (
        <div style={styles.backdrop} onClick={onCancel}>
            <div 
                className="animate-modal-pop" 
                style={styles.modalCard}
                onClick={(e) => e.stopPropagation()} // Prevent clicking inside card from closing it
            >
                <div style={styles.iconContainer}>
                    <div style={styles.iconGlow}></div>
                    <i className="fas fa-shield-slash" style={{ color: '#ef4444', fontSize: '28px', position: 'relative', zIndex: 2 }}></i>
                </div>
                <h3 style={styles.title}>{title}</h3>
                <p style={styles.message}>{message}</p>
                <div style={styles.btnGroup}>
                    <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
                    <button onClick={onConfirm} style={styles.confirmBtn}>Yes, Deactivate</button>
                </div>
            </div>
            
            <style>{`
                .animate-modal-pop {
                    animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
                }
                @keyframes modalPop {
                    0% { opacity: 0; transform: scale(0.9) translateY(10px); }
                    100% { opacity: 1; transform: scale(1) translateY(0); }
                }
            `}</style>
        </div>
    );

    // Using React Portal to inject the modal directly into the <body>
    // This entirely bypasses any Sidebar or Container z-index issues!
    return ReactDOM.createPortal(modalContent, document.body);
};

const styles = {
    backdrop: {
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.6)', 
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        zIndex: 999999, // Absolute highest z-index
        padding: '20px'
    },
    modalCard: {
        background: '#ffffff', 
        padding: '35px', 
        borderRadius: '28px', 
        width: '100%',
        maxWidth: '420px', 
        textAlign: 'center', 
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.3)',
        border: '1px solid #f1f5f9',
        position: 'relative'
    },
    iconContainer: {
        width: '70px', height: '70px', 
        background: '#fef2f2', 
        borderRadius: '50%',
        display: 'flex', alignItems: 'center', justifyContent: 'center', 
        margin: '0 auto 20px auto',
        position: 'relative'
    },
    iconGlow: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        borderRadius: '50%', background: '#ef4444', filter: 'blur(15px)', opacity: 0.2
    },
    title: { margin: '0 0 12px 0', color: '#0f172a', fontSize: '24px', fontWeight: '800', letterSpacing: '-0.5px' },
    message: { color: '#64748b', fontSize: '15px', lineHeight: '1.6', margin: '0 auto 30px auto', maxWidth: '300px' },
    btnGroup: { display: 'flex', gap: '15px' },
    cancelBtn: {
        flex: 1, padding: '15px', borderRadius: '16px', border: '1px solid #e2e8f0',
        background: '#f8fafc', color: '#475569', fontWeight: '700', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s'
    },
    confirmBtn: {
        flex: 1, padding: '15px', borderRadius: '16px', border: 'none',
        background: '#ef4444', color: 'white', fontWeight: '700', cursor: 'pointer', fontSize: '15px', transition: 'all 0.2s', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
    }
};

export default ConfirmModal;