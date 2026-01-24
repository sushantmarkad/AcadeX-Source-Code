import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';
import TwoFactorSetup from '../components/TwoFactorSetup';
import FingerprintJS from '@fingerprintjs/fingerprintjs';

// ✅ Import Biometric Hook
import { useBiometricAuth } from '../components/BiometricAuth';

// ✅ Predefined Interest Categories for Deep Data
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
    const [isBioSet, setIsBioSet] = useState(false);
    const [currentDeviceId, setCurrentDeviceId] = useState(''); // ✅ Track current hardware ID

    // 👆 Biometric State
    const { registerPasskey, bioLoading } = useBiometricAuth();

    // Form State
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', phone: '', subject: '', email: '',
        careerGoal: '', year: '', qualification: '',
        domain: '',
        subDomain: '',
        specificSkills: ''
    });

    // ✅ Detect Device ID on Load
    useEffect(() => {
        const getDeviceId = async () => {
            const fp = await FingerprintJS.load();
            const result = await fp.get();
            setCurrentDeviceId(result.visitorId);
        };
        getDeviceId();
    }, []);

    useEffect(() => {
        if (!auth.currentUser) return;

        // ✅ Real-time listener for profile and hardware binding updates
        const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfileData(data);
                
                // ✅ Check if biometric/hardware ID is linked in Firestore
                setIsBioSet(!!(data.authenticators && data.authenticators.length > 0));

                if (!isEditing) {
                    setFormData({
                        firstName: data.firstName || '',
                        lastName: data.lastName || '',
                        phone: data.phone || '',
                        subject: data.subject || '',
                        email: data.email || '',
                        careerGoal: data.careerGoal || '',
                        year: data.year || data.extras?.year || '',
                        qualification: data.qualification || '',
                        domain: data.domain || '',
                        subDomain: data.subDomain || '',
                        specificSkills: data.specificSkills || ''
                    });
                }
            }
        });
        return () => unsub();
    }, [isEditing]);

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
                updates.year = formData.year;
                updates.domain = formData.domain;
                updates.subDomain = formData.subDomain;
                updates.specificSkills = formData.specificSkills;
                updates.interests = `${formData.domain}, ${formData.subDomain}, ${formData.specificSkills}`;
            }

            await updateDoc(userRef, updates);
            toast.success("Profile Updated!", { id: toastId });
            setIsEditing(false);
        } catch (err) {
            toast.error("Error: " + err.message, { id: toastId });
        }
    };

    const handleEnableBiometric = async () => {
        if (auth.currentUser) {
            const success = await registerPasskey(auth.currentUser.uid);
            if (success) {
                toast.success("Device Identity Bound Successfully!");
            }
        }
    };

    if (!profileData) return <div>Loading...</div>;

    return (
        <div className="content-section">
            <h2 className="content-title">My Profile</h2>

            {/* ✅ Attendance Requirement Banner */}
            {user.role === 'student' && (
                <div style={{ background: 'linear-gradient(90deg, #eff6ff 0%, #dbeafe 100%)', padding: '15px', borderRadius: '12px', marginBottom: '20px', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ fontSize: '24px' }}>🛡️</div>
                    <div>
                        <h4 style={{ margin: 0, color: '#1e40af' }}>Hardware Binding Required</h4>
                        <p style={{ margin: 0, fontSize: '13px', color: '#1e3a8a' }}>
                            To prevent proxy attendance, you must link your <strong>Fingerprint/Device ID</strong> below.
                        </p>
                    </div>
                </div>
            )}

            {/* Header Card */}
            <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '25px', background: 'white' }}>
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
                        {profileData.role?.toUpperCase()} • {profileData.department}
                    </p>
                </div>

                <button
                    className={isEditing ? "btn-primary" : "btn-secondary"}
                    style={{ width: 'auto', padding: '8px 24px', marginLeft: 'auto' }}
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                >
                    {isEditing ? 'Save Changes' : 'Edit Profile'}
                </button>
            </div>

            <div className="cards-grid" style={{ alignItems: 'start' }}>

                {/* Personal Details */}
                <div className="card">
                    <h3>Personal Details</h3>
                    <div className="input-group"><label>First Name</label><input type="text" disabled={!isEditing} value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} /></div>
                    <div className="input-group"><label>Last Name</label><input type="text" disabled={!isEditing} value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} /></div>
                    <div className="input-group"><label>Email</label><input type="email" disabled={!isEditing} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} /></div>
                    <div className="input-group"><label>Phone Number</label><input type="tel" disabled={!isEditing} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} /></div>
                    
                    {user.role === 'student' && (
                        <div className="input-group">
                            <label>Year</label>
                            <select disabled={!isEditing} value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                                <option value="FE">FE (First Year)</option>
                                <option value="SE">SE (Second Year)</option>
                                <option value="TE">TE (Third Year)</option>
                                <option value="BE">BE (Final Year)</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* ✅ SECURITY SECTION: Device Info & Biometric Lock */}
                <div className="card" style={{ border: isBioSet ? '2px solid #10b981' : '2px solid #ef4444' }}>
                    <h3 style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <i className="fas fa-fingerprint"></i> Device & Biometric Lock
                    </h3>

                    <div style={{ marginBottom: '20px', padding: '12px', background: '#f8fafc', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>Registered ID:</span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{profileData.registeredDeviceId ? profileData.registeredDeviceId.substring(0, 8) + '...' : 'Unbound'}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '12px', color: '#64748b' }}>Current ID:</span>
                            <span style={{ fontSize: '12px', fontWeight: 'bold', color: (profileData.registeredDeviceId === currentDeviceId) ? '#10b981' : '#f59e0b' }}>{currentDeviceId.substring(0, 8)}...</span>
                        </div>
                        
                        {profileData.registeredDeviceId && currentDeviceId !== profileData.registeredDeviceId && (
                            <div style={{ marginTop: '10px', fontSize: '11px', color: '#ef4444', background: '#fee2e2', padding: '8px', borderRadius: '6px' }}>
                                ⚠️ <strong>Device Mismatch:</strong> Attendance marking is locked to your original device.
                            </div>
                        )}
                    </div>
                     
                    <div style={{ textAlign: 'center' }}>
                         <div style={{ fontSize: '40px', color: isBioSet ? '#10b981' : '#ef4444', marginBottom: '10px' }}>
                             <i className={`fas ${isBioSet ? 'fa-check-circle' : 'fa-exclamation-triangle'}`}></i>
                         </div>
                         <h4 style={{margin:0}}>{isBioSet ? "Hardware Bound" : "No Biometric Set"}</h4>
                         <p style={{ fontSize: '12px', color: '#64748b', margin: '8px 0 15px 0' }}>
                             {isBioSet 
                                ? "Your identity is verified on this hardware." 
                                : "Link your device to enable attendance fallback."}
                         </p>

                         <button 
                             onClick={handleEnableBiometric}
                             disabled={bioLoading}
                             style={{
                                width: '100%',
                                padding: '12px',
                                background: isBioSet ? '#f0fdf4' : 'linear-gradient(135deg, #4f46e5, #4338ca)',
                                color: isBioSet ? '#166534' : 'white',
                                border: isBioSet ? '1px solid #bbf7d0' : 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontWeight: '600'
                             }}
                         >
                            {bioLoading ? "Verifying..." : isBioSet ? "Refresh Device Link" : "Link This Device"}
                         </button>
                    </div>

                    <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '20px', marginTop: '20px' }}>
                        <TwoFactorSetup user={user} />
                    </div>
                </div>

                {/* Career Focus Area */}
                {user.role === 'student' && (
                    <div className="card">
                        <h3 style={{ color: '#7c3aed' }}><i className="fas fa-bullseye"></i> Career Focus</h3>
                        <div className="input-group">
                            <label>Domain</label>
                            <select disabled={!isEditing} value={formData.domain} onChange={e => setFormData({ ...formData, domain: e.target.value, subDomain: '' })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                                <option value="">-- Select Domain --</option>
                                {Object.keys(INTEREST_DOMAINS).map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                        </div>
                        {formData.domain && (
                            <div className="input-group">
                                <label>Specialization</label>
                                <select disabled={!isEditing} value={formData.subDomain} onChange={e => setFormData({ ...formData, subDomain: e.target.value })} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e5e7eb' }}>
                                    <option value="">-- Select Specialization --</option>
                                    {INTEREST_DOMAINS[formData.domain].map(sub => <option key={sub} value={sub}>{sub}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="input-group"><label>Skills</label><input type="text" disabled={!isEditing} value={formData.specificSkills} onChange={e => setFormData({ ...formData, specificSkills: e.target.value })} /></div>
                        <div className="input-group"><label>Goal</label><input type="text" disabled={!isEditing} value={formData.careerGoal} onChange={e => setFormData({ ...formData, careerGoal: e.target.value })} /></div>
                    </div>
                )}
            </div>
        </div>
    );
}