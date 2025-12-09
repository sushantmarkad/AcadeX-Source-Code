import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';
import TwoFactorSetup from '../components/TwoFactorSetup';

// ✅ Import Biometric Hook
import { useBiometricAuth } from '../components/BiometricAuth';

// ✅ Predefined Interest Categories for Deep Data (Judge's Requirement)
const INTEREST_DOMAINS = {
    "Coding & Tech": ["Frontend Dev", "Backend Dev", "Full Stack", "AI/ML", "App Dev", "Cybersecurity", "Blockchain"],
    "Core Engineering": ["Thermodynamics", "Circuit Design", "Mechanics", "Robotics", "Civil Structures", "IoT"],
    "Business & Management": ["Digital Marketing", "Finance", "Startup/Entrepreneurship", "HR", "Supply Chain"],
    "Creative & Design": ["UI/UX Design", "Graphic Design", "Video Editing", "Animation", "Content Writing"],
    "Science & Research": ["Physics", "Chemistry", "Biology", "Space Science", "Environmental Science"]
};

export default function Profile({ user }) {
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState(user || null);

    // 👆 Biometric State
    const { registerPasskey, bioLoading } = useBiometricAuth();

    // Form State including new Deep Data fields
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', phone: '', subject: '', email: '',
        careerGoal: '', year: '', qualification: '',
        // ✅ New Structured Fields
        domain: '',
        subDomain: '',
        specificSkills: ''
    });

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
                        year: data.extras?.year || '',
                        qualification: data.qualification || '',
                        // ✅ Load existing deep data
                        domain: data.domain || '',
                        subDomain: data.subDomain || '',
                        specificSkills: data.specificSkills || ''
                    });
                }
            }
        };
        fetchProfile();
    }, [user, isEditing]);

    const handleSave = async () => {
        const toastId = toast.loading("Updating Profile...");
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);

            const updates = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
                subject: formData.subject,
                email: formData.email,
                qualification: formData.qualification
            };

            if (user.role === 'student') {
                updates.careerGoal = formData.careerGoal;
                updates['extras.year'] = formData.year;

                // ✅ Save Deep Data for AI Context
                updates.domain = formData.domain;
                updates.subDomain = formData.subDomain;
                updates.specificSkills = formData.specificSkills;

                // Save legacy interests string for backward compatibility with simple filters
                updates.interests = `${formData.domain}, ${formData.subDomain}, ${formData.specificSkills}`;
            }

            await updateDoc(userRef, updates);
            toast.success("Profile Updated! AI Recommendations refreshed.", { id: toastId });
            setIsEditing(false);
        } catch (err) {
            toast.error("Error: " + err.message, { id: toastId });
        }
    };

    // 👆 Handle Biometric Setup
    const handleEnableBiometric = async () => {
        if (auth.currentUser) {
            await registerPasskey(auth.currentUser.uid);
        }
    };

    if (!profileData) return <div>Loading...</div>;
    const { skills = [], projects = [] } = profileData.resumeData || {};

    return (
        <div className="content-section">
            <h2 className="content-title">My Profile</h2>

            {/* ✅ INCENTIVE BANNER (Why should I fill this?) */}
            {user.role === 'student' && (
                <div style={{ background: 'linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%)', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ fontSize: '24px' }}>🎓</div>
                    <div>
                        <h4 style={{ margin: 0, color: '#1e40af' }}>Boost Your Internal Marks!</h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#1e3a8a' }}>
                            Complete your <strong>Career Interest Profile</strong> below. The AI uses this to assign tasks that count towards your <strong>Extra Curricular Academic Credits</strong>.
                        </p>
                    </div>
                </div>
            )}

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

                    <div style={{ marginTop: '10px', display: 'flex', gap: '10px' }}>
                        {user.role === 'student' && (
                            <>
                                <span className="status-badge status-approved">Roll: {profileData.rollNo}</span>
                                {/* ✅ Showing Credits instead of just "XP" */}
                                <span className="status-badge" style={{ background: '#e0f2fe', color: '#0284c7' }}>{profileData.xp || 0} Credits Earned</span>
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

            <div className="cards-grid" style={{ alignItems: 'start' }}>

                {/* Personal Details Column */}
                <div className="card">
                    <h3>Personal Details</h3>
                    <div className="input-group"><label>First Name</label><input type="text" disabled={!isEditing} value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} /></div>
                    <div className="input-group"><label>Last Name</label><input type="text" disabled={!isEditing} value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} /></div>
                    <div className="input-group"><label>Email</label><input type="email" disabled={!isEditing} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                    <div className="input-group"><label>Phone Number</label><input type="tel" disabled={!isEditing} placeholder="+91..." value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>

                    {user.role === 'teacher' && (
                        <>
                            <div className="input-group"><label>Subject Specification</label><input type="text" disabled={!isEditing} value={formData.subject} onChange={e => setFormData({ ...formData, subject: e.target.value })} /></div>
                            <div className="input-group"><label>Qualification</label><input type="text" disabled={!isEditing} placeholder="e.g. M.Tech, PhD" value={formData.qualification} onChange={e => setFormData({ ...formData, qualification: e.target.value })} /></div>
                        </>
                    )}

                    {user.role === 'student' && (
                        <>
                            <div className="input-group"><label>Roll Number</label><input type="text" disabled value={user.rollNo} style={{ backgroundColor: '#f9fafb', color: '#6b7280' }} /></div>
                            <div className="input-group">
                                <label>Year</label>
                                <select disabled={!isEditing} value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: isEditing ? 'white' : '#f9fafb' }}>
                                    <option value="FE">FE (First Year)</option>
                                    <option value="SE">SE (Second Year)</option>
                                    <option value="TE">TE (Third Year)</option>
                                    <option value="BE">BE (Final Year)</option>
                                </select>
                            </div>
                        </>
                    )}
                </div>

                {/* ✅ NEW: CAREER INTEREST PROFILE (The Solution to Judge's Question) */}
                {user.role === 'student' && (
                    <div className="card" style={{ border: '2px solid #8b5cf6' }}>
                        <h3 style={{ color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="fas fa-bullseye"></i> Career Focus Area
                        </h3>
                        <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '20px' }}>
                            Select your exact interests so <strong>Grow AI</strong> can generate relevant curriculum tasks for you.
                        </p>

                        {/* 1. Domain Selection */}
                        <div className="input-group">
                            <label>Primary Interest Domain</label>
                            <select
                                disabled={!isEditing}
                                value={formData.domain}
                                onChange={e => setFormData({ ...formData, domain: e.target.value, subDomain: '' })} // Reset sub on change
                                style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: isEditing ? 'white' : '#f9fafb' }}
                            >
                                <option value="">-- Select Domain --</option>
                                {Object.keys(INTEREST_DOMAINS).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>

                        {/* 2. Sub-Domain Selection */}
                        {formData.domain && (
                            <div className="input-group">
                                <label>Specialization</label>
                                <select
                                    disabled={!isEditing}
                                    value={formData.subDomain}
                                    onChange={e => setFormData({ ...formData, subDomain: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb', backgroundColor: isEditing ? 'white' : '#f9fafb' }}
                                >
                                    <option value="">-- Select Specialization --</option>
                                    {INTEREST_DOMAINS[formData.domain].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                </select>
                            </div>
                        )}

                        {/* 3. Specific Skills */}
                        <div className="input-group">
                            <label>Specific Technologies / Topics</label>
                            <input
                                type="text"
                                disabled={!isEditing}
                                placeholder="e.g. React, Python, AutoCAD, Stock Market..."
                                value={formData.specificSkills}
                                onChange={e => setFormData({ ...formData, specificSkills: e.target.value })}
                                style={{ backgroundColor: isEditing ? 'white' : '#f9fafb' }}
                            />
                            <small style={{ color: '#64748b' }}>Used by AI to customize your challenges.</small>
                        </div>

                        <div className="input-group" style={{ marginTop: '10px' }}>
                            <label>Ultimate Career Goal</label>
                            <input type="text" disabled={!isEditing} placeholder="e.g. Google Software Engineer" value={formData.careerGoal} onChange={e => setFormData({ ...formData, careerGoal: e.target.value })} />
                        </div>
                    </div>
                )}

                {/* Portfolio Section */}
                {user.role === 'student' && (
                    <div className="card" style={{ border: 'none', boxShadow: 'none', padding: 0, background: 'transparent' }}>
                        <h3 style={{ fontSize: '18px', marginBottom: '15px', color: '#334155' }}>Professional Portfolio</h3>

                        <div className="card" style={{ marginBottom: '20px' }}>
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

                {/* ✅ SECURITY & LOGIN SECTION */}
                <div className="card">
                     <h3>Security & Login</h3>
                     
                     <div style={{ marginBottom: '20px' }}>
                         <button 
                             onClick={handleEnableBiometric}
                             disabled={bioLoading}
                             style={{
                                width: '100%',
                                padding: '12px',
                                background: 'linear-gradient(135deg, #4f46e5, #4338ca)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
                                fontWeight: '600'
                             }}
                         >
                            {bioLoading ? (
                                <span>Starting setup...</span>
                            ) : (
                                <>
                                    <i className="fas fa-fingerprint" style={{fontSize: '18px'}}></i>
                                    Enable Fingerprint / FaceID
                                </>
                            )}
                         </button>
                         <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', textAlign: 'center' }}>
                             Setup TouchID or FaceID for faster login on this device.
                         </p>
                     </div>

                     <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px' }}>
                         <TwoFactorSetup user={user} />
                     </div>
                </div>

            </div>
        </div>
    );
}