import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function Profile({ user }) {
    const [isEditing, setIsEditing] = useState(false);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        subject: '',
        email: '',
        careerGoal: '' // ✅ NEW FIELD
    });

    useEffect(() => {
        if (user) {
            setFormData({
                firstName: user.firstName || '',
                lastName: user.lastName || '',
                phone: user.phone || '',
                subject: user.subject || '',
                email: user.email || '',
                careerGoal: user.careerGoal || '' // ✅ Load existing goal
            });
        }
    }, [user]);

    const handleSave = async () => {
        const toastId = toast.loading("Updating Profile...");
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                subject: formData.subject,
                email: formData.email,
                careerGoal: formData.careerGoal // ✅ Save goal to DB
            });
            toast.success("Profile Updated!", { id: toastId });
            setIsEditing(false);
        } catch (err) {
            toast.error("Error: " + err.message, { id: toastId });
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">My Profile</h2>
            <div className="card">
                <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                    <h3>Personal Details</h3>
                    <button 
                        className={isEditing ? "btn-primary" : "btn-secondary"}
                        style={{ width: 'auto', padding: '10px 20px', marginTop:0 }}
                        onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    >
                        {isEditing ? 'Save Changes' : 'Edit Profile'}
                    </button>
                </div>

                <div className="input-group"><label>First Name</label><input type="text" disabled={!isEditing} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} /></div>
                <div className="input-group"><label>Last Name</label><input type="text" disabled={!isEditing} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} /></div>
                <div className="input-group"><label>Email</label><input type="email" disabled={!isEditing} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                <div className="input-group"><label>Phone Number</label><input type="tel" disabled={!isEditing} placeholder="+91..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>

                {user.role === 'teacher' && (
                    <div className="input-group"><label>Subject</label><input type="text" disabled={!isEditing} value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} /></div>
                )}
                
                {user.role === 'student' && (
                    <>
                        <div className="input-group"><label>Roll Number</label><input type="text" disabled value={user.rollNo} style={{backgroundColor: '#f9fafb', color:'#6b7280'}} /></div>
                        
                        {/* ✅ NEW: Career Goal Input */}
                        <div className="input-group" style={{marginTop:'10px'}}>
                            <label style={{color:'#2563eb', fontWeight:'bold'}}>🎯 Career Goal</label>
                            <input 
                                type="text" 
                                disabled={!isEditing} 
                                placeholder="e.g. Full Stack Developer, GATE, UPSC..." 
                                value={formData.careerGoal} 
                                onChange={e => setFormData({...formData, careerGoal: e.target.value})} 
                                style={{border: isEditing ? '2px solid #2563eb' : '1px solid #e2e8f0'}}
                            />
                            {!isEditing && !formData.careerGoal && <small style={{color:'#ef4444'}}>* Please set a goal to unlock the AI Roadmap.</small>}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}