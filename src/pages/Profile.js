import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import './Dashboard.css';

export default function Profile({ user }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        subject: '',
        email: ''
    });

    // ✅ Local Modal State (Self-contained)
    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', type: 'info' });
    const showModal = (title, message, type = 'info') => setModal({ isOpen: true, title, message, type });
    const closeModal = () => setModal({ ...modal, isOpen: false });

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                phone: user.phone || '',
                subject: user.subject || '',
                email: user.email || ''
            });
        }
    }, [user]);

    const handleSave = async () => {
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                subject: formData.subject,
                email: formData.email 
            });
            showModal('Success', "Profile Updated Successfully!");
            setIsEditing(false);
        } catch (err) {
            showModal('Error', "Error updating profile: " + err.message, 'danger');
        }
    };

    return (
        <div className="content-section">
             {/* ✅ CUSTOM MODAL */}
             {modal.isOpen && (
                <div className="custom-modal-overlay">
                    <div className="custom-modal-box">
                        <div className={`modal-icon ${modal.type === 'danger' ? 'icon-danger' : 'icon-info'}`}>
                            <i className={`fas ${modal.type === 'danger' ? 'fa-exclamation-triangle' : 'fa-info-circle'}`}></i>
                        </div>
                        <h3>{modal.title}</h3>
                        <p>{modal.message}</p>
                        <div className="modal-actions">
                            <button className="btn-primary" onClick={closeModal}>Okay</button>
                        </div>
                    </div>
                </div>
            )}

            <h2 className="content-title">My Profile</h2>
            <div className="card">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h3>Personal Details</h3>
                    <button 
                        className={isEditing ? "btn-primary" : "btn-secondary"}
                        style={{ width: 'auto', padding: '10px 20px' }}
                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    >
                        {isEditing ? 'Save Changes' : 'Edit Profile'}
                    </button>
                </div>

                <div className="input-group">
                    <label>First Name</label>
                    <input type="text" disabled={!isEditing} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                </div>
                <div className="input-group">
                    <label>Last Name</label>
                    <input type="text" disabled={!isEditing} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
                </div>
                <div className="input-group">
                    <label>Email</label>
                    <input type="email" disabled={!isEditing} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                    {isEditing && <small style={{color:'gray', display:'block', marginTop:'5px'}}>Note: Updating email here does not change your login email.</small>}
                </div>
                <div className="input-group">
                    <label>Phone Number</label>
                    <input type="tel" disabled={!isEditing} placeholder="+91..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} />
                </div>

                {user.role === 'teacher' && (
                    <div className="input-group">
                        <label>Subject</label>
                        <input type="text" disabled={!isEditing} value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} />
                    </div>
                )}
                
                {user.role === 'student' && (
                    <div className="input-group">
                        <label>Roll Number</label>
                        <input type="text" disabled value={user.rollNo} style={{backgroundColor: '#f9fafb', color:'#6b7280'}} />
                    </div>
                )}
            </div>
        </div>
    );
}