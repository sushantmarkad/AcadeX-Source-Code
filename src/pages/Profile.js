import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function Profile({ user }) {
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState(user || null); // Hold full profile data (including resumeData)
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        subject: '',
        email: '',
        careerGoal: '',
        year: '',       // ✅ Added for Students
        qualification: '' // ✅ Added for Teachers
    });

    // Fetch latest data (including resumeData) on mount
    useEffect(() => {
        const fetchProfile = async () => {
            if (auth.currentUser) {
                const docRef = doc(db, 'users', auth.currentUser.uid);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setProfileData(data);
                    setFormData({
                        firstName: data.firstName || '',
                        lastName: data.lastName || '',
                        phone: data.phone || '',
                        subject: data.subject || '',
                        email: data.email || '',
                        careerGoal: data.careerGoal || '',
                        year: data.extras?.year || '', // Fetch from extras or top-level
                        qualification: data.qualification || ''
                    });
                }
            }
        };
        fetchProfile();
    }, [user, isEditing]); // Re-fetch when editing toggles (to reset or update)

    const handleSave = async () => {
        const toastId = toast.loading("Updating Profile...");
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            
            // Construct update object
            const updates = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                subject: formData.subject,
                email: formData.email,
                qualification: formData.qualification
            };

            // Handle Student Specifics
            if (user.role === 'student') {
                updates.careerGoal = formData.careerGoal;
                // Store year in 'extras' or top level depending on your schema. 
                // Using top-level for easier access, but merging into extras is also fine.
                updates['extras.year'] = formData.year; 
            }

            await updateDoc(userRef, updates);
            toast.success("Profile Updated!", { id: toastId });
            setIsEditing(false);
        } catch (err) {
            toast.error("Error: " + err.message, { id: toastId });
        }
    };

    if (!profileData) return <div>Loading...</div>;

    // Destructure resume data safely (only for students)
    const { skills = [], experience = "", projects = [] } = profileData.resumeData || {};

    return (
        <div className="content-section">
            <h2 className="content-title">My Profile</h2>
            
            {/* Header Card */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '25px', background: 'linear-gradient(135deg, #fff 0%, #f8fafc 100%)' }}>
                <div style={{ 
                    width: '80px', height: '80px', borderRadius: '50%', 
                    background: '#eff6ff', color: '#2563eb', fontSize: '30px', 
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' 
                }}>
                    {profileData.firstName?.[0]}{profileData.lastName?.[0]}
                </div>
                <div>
                    <h2 style={{ margin: 0, fontSize: '22px' }}>{profileData.firstName} {profileData.lastName}</h2>
                    <p style={{ margin: '5px 0 0 0', color: '#64748b' }}>
                        {profileData.role === 'hod' ? 'HOD' : profileData.role === 'teacher' ? 'Teacher' : 'Student'} • {profileData.department}
                    </p>
                    
                    {/* Role Specific Badge */}
                    <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                        {user.role === 'student' && (
                            <>
                                <span className="status-badge status-approved">Roll: {profileData.rollNo}</span>
                                <span className="status-badge" style={{background:'#e0f2fe', color:'#0284c7'}}>{profileData.xp || 0} XP</span>
                            </>
                        )}
                        {user.role === 'teacher' && (
                            <span className="status-badge status-approved">{formData.qualification || 'Faculty'}</span>
                        )}
                    </div>
                </div>
                
                <button 
                    className={isEditing ? "btn-primary" : "btn-secondary"}
                    style={{ width: 'auto', padding: '8px 16px', marginLeft: 'auto' }}
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                >
                    {isEditing ? 'Save' : 'Edit'}
                </button>
            </div>

            <div className="cards-grid" style={{alignItems: 'start'}}> 
                
                {/* --- LEFT COLUMN: PERSONAL DETAILS --- */}
                <div className="card">
                    <h3>Personal Details</h3>
                    <div className="input-group"><label>First Name</label><input type="text" disabled={!isEditing} value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} /></div>
                    <div className="input-group"><label>Last Name</label><input type="text" disabled={!isEditing} value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} /></div>
                    <div className="input-group"><label>Email</label><input type="email" disabled={!isEditing} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
                    <div className="input-group"><label>Phone Number</label><input type="tel" disabled={!isEditing} placeholder="+91..." value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>

                    {/* TEACHER FIELDS */}
                    {user.role === 'teacher' && (
                        <>
                            <div className="input-group"><label>Subject Specification</label><input type="text" disabled={!isEditing} value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} /></div>
                            <div className="input-group"><label>Qualification</label><input type="text" disabled={!isEditing} placeholder="e.g. M.Tech, PhD" value={formData.qualification} onChange={e => setFormData({...formData, qualification: e.target.value})} /></div>
                        </>
                    )}
                    
                    {/* STUDENT FIELDS */}
                    {user.role === 'student' && (
                        <>
                            <div className="input-group"><label>Roll Number</label><input type="text" disabled value={user.rollNo} style={{backgroundColor: '#f9fafb', color:'#6b7280'}} /></div>
                            
                            <div className="input-group">
                                <label>Year</label>
                                <select 
                                    disabled={!isEditing} 
                                    value={formData.year} 
                                    onChange={e => setFormData({...formData, year: e.target.value})}
                                    style={{width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: isEditing ? 'white' : '#f9fafb'}}
                                >
                                    <option value="FE">FE (First Year)</option>
                                    <option value="SE">SE (Second Year)</option>
                                    <option value="TE">TE (Third Year)</option>
                                    <option value="BE">BE (Final Year)</option>
                                </select>
                            </div>

                            <div className="input-group" style={{marginTop:'10px'}}>
                                <label style={{color:'#2563eb', fontWeight:'bold'}}>🎯 Career Goal</label>
                                <input 
                                    type="text" 
                                    disabled={!isEditing} 
                                    placeholder="e.g. Full Stack Developer..." 
                                    value={formData.careerGoal} 
                                    onChange={e => setFormData({...formData, careerGoal: e.target.value})} 
                                    style={{border: isEditing ? '2px solid #2563eb' : '1px solid #e2e8f0'}}
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* --- RIGHT COLUMN: PORTFOLIO (STUDENTS ONLY) --- */}
                {user.role === 'student' && (
                    <div className="card" style={{border: 'none', boxShadow: 'none', padding: 0, background: 'transparent'}}>
                        <h3 style={{ fontSize: '18px', marginBottom: '15px', color: '#334155' }}>Professional Portfolio</h3>
                        
                        {/* Skills */}
                        <div className="card" style={{marginBottom: '20px'}}>
                            <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fas fa-tools" style={{ color: '#3b82f6' }}></i> Skills
                            </h4>
                            {skills.length > 0 ? (
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {skills.map((skill, index) => (
                                        <span key={index} style={{ background: '#eff6ff', color: '#2563eb', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            ) : <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '14px' }}>No skills added.</p>}
                        </div>

                        {/* Projects */}
                        <div className="card">
                            <h4 style={{ margin: '0 0 15px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fas fa-laptop-code" style={{ color: '#8b5cf6' }}></i> Key Projects
                            </h4>
                            {projects.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                    {projects.map((p, i) => (
                                        <div key={i} style={{ padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                            <div style={{ fontWeight: '700', color: '#1e293b' }}>{p.title}</div>
                                            <div style={{ fontSize: '13px', color: '#64748b' }}>{p.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            ) : <p style={{ color: '#94a3b8', fontStyle: 'italic', fontSize: '14px' }}>No projects added.</p>}
                        </div>
                    </div>
                )}

            </div>
        </div>
    );
}