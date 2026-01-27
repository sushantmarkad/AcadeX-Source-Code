import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';
import TwoFactorSetup from '../components/TwoFactorSetup';

// ✅ Predefined Interest Categories
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

    // Form State
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', phone: '', subject: '', email: '',
        careerGoal: '', year: '', qualification: '',
        domain: '',
        subDomain: '',
        specificSkills: ''
    });

    useEffect(() => {
        if (!auth.currentUser) return;

        const unsub = onSnapshot(doc(db, 'users', auth.currentUser.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setProfileData(data);
                
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

    if (!profileData) return <div>Loading...</div>;

    return (
        <div className="content-section">
            <h2 className="content-title">My Profile</h2>

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

                {/* ✅ SECURITY SECTION: 2-Factor Auth (Kept 2FA, Removed Device Link) */}
                <div className="card">
                    <h3 style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <i className="fas fa-shield-alt"></i> Security
                    </h3>
                    <div style={{ marginTop: '10px' }}>
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