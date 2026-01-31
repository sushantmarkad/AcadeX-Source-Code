import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import TwoFactorSetup from '../components/TwoFactorSetup'; // ✅ Import 2FA Component
import './Dashboard.css'; 

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

const INTEREST_DOMAINS = {
    "Coding & Tech": ["Frontend Dev", "Backend Dev", "Full Stack", "AI/ML", "App Dev", "Cybersecurity", "Blockchain"],
    "Core Engineering": ["Thermodynamics", "Circuit Design", "Mechanics", "Robotics", "Civil Structures", "IoT"],
    "Business & Management": ["Digital Marketing", "Finance", "Startup/Entrepreneurship", "HR", "Supply Chain"],
    "Creative & Design": ["UI/UX Design", "Graphic Design", "Video Editing", "Animation", "Content Writing"],
    "Science & Research": ["Physics", "Chemistry", "Biology", "Space Science", "Environmental Science"]
};

// Helper for Avatar Colors
const getAvatarGradient = (name) => {
    const gradients = [
        'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', // Blue
        'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Emerald
        'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Amber
        'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)', // Violet
        'linear-gradient(135deg, #ec4899 0%, #db2777 100%)'  // Pink
    ];
    return gradients[(name?.length || 0) % gradients.length];
};

export default function Profile({ user }) {
    const [activeTab, setActiveTab] = useState('details'); 
    const [isEditing, setIsEditing] = useState(false);
    const [profileData, setProfileData] = useState(user || null);
    
    // Password State
    const [passData, setPassData] = useState({ newPass: '', confirmPass: '' });
    const [passLoading, setPassLoading] = useState(false);

    // Profile Form State
    const [formData, setFormData] = useState({
        firstName: '', lastName: '', phone: '', 
        careerGoal: '', domain: '', subDomain: '', specificSkills: ''
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
                        careerGoal: data.careerGoal || '',
                        domain: data.domain || '',
                        subDomain: data.subDomain || '',
                        specificSkills: data.specificSkills || ''
                    });
                }
            }
        });
        return () => unsub();
    }, [isEditing]);

    const handleSaveProfile = async () => {
        const toastId = toast.loading("Saving changes...");
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            const updates = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                phone: formData.phone,
            };

            if (user.role === 'student') {
                updates.careerGoal = formData.careerGoal;
                updates.domain = formData.domain;
                updates.subDomain = formData.subDomain;
                updates.specificSkills = formData.specificSkills;
            }

            await updateDoc(userRef, updates);
            toast.success("Profile Updated!", { id: toastId });
            setIsEditing(false);
        } catch (err) {
            toast.error(err.message, { id: toastId });
        }
    };

    const handleUpdatePassword = async (e) => {
        e.preventDefault();
        if (passData.newPass.length < 6) return toast.error("Password too short (min 6 chars)");
        if (passData.newPass !== passData.confirmPass) return toast.error("Passwords do not match");

        setPassLoading(true);
        const toastId = toast.loading("Updating Password...");

        try {
            const token = await auth.currentUser.getIdToken();
            const response = await fetch(`${BACKEND_URL}/updatePassword`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ newPassword: passData.newPass })
            });

            const data = await response.json();
            if (response.ok) {
                toast.success("Password Updated Successfully!", { id: toastId });
                setPassData({ newPass: '', confirmPass: '' });
            } else {
                throw new Error(data.error || "Update failed");
            }
        } catch (err) {
            toast.error(err.message, { id: toastId });
        } finally {
            setPassLoading(false);
        }
    };

    if (!profileData) return <div className="content-section">Loading...</div>;

    const avatarGradient = getAvatarGradient(profileData.firstName);

    return (
        <div className="content-section" style={{maxWidth: '1100px', margin: '0 auto'}}>
            
            {/* --- PREMIUM HEADER CARD --- */}
            <div className="prof-header-card">
                <div className="prof-header-bg"></div>
                <div className="prof-header-content">
                    <div className="prof-avatar" style={{ background: avatarGradient }}>
                        {profileData.firstName?.[0]}{profileData.lastName?.[0]}
                    </div>
                    <div className="prof-info">
                        <h2 className="prof-name">{profileData.firstName} {profileData.lastName}</h2>
                        <div className="prof-badges">
                            <span className="prof-badge-role">{profileData.role?.toUpperCase()}</span>
                            <span className="prof-badge-dept">{profileData.department}</span>
                            {profileData.year && <span className="prof-badge-year">{profileData.year} Year</span>}
                        </div>
                    </div>
                    {activeTab === 'details' && (
                        <button 
                            className={`prof-btn ${isEditing ? 'prof-btn-save' : 'prof-btn-edit'}`}
                            onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}
                        >
                            <i className={`fas ${isEditing ? 'fa-check' : 'fa-pen'}`}></i>
                            {isEditing ? 'Save Changes' : 'Edit Profile'}
                        </button>
                    )}
                </div>
            </div>

            {/* --- MODERN TABS --- */}
            <div className="prof-tabs-container">
                <div className="prof-tabs">
                    <button 
                        className={`prof-tab-item ${activeTab === 'details' ? 'active' : ''}`}
                        onClick={() => setActiveTab('details')}
                    >
                        Personal Details
                    </button>
                    <button 
                        className={`prof-tab-item ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        Security & 2FA
                    </button>
                </div>
            </div>

            {/* --- CONTENT AREA --- */}
            <div className="prof-content-area">
                
                {/* === DETAILS TAB === */}
                {activeTab === 'details' && (
                    <div className="prof-grid">
                        
                        {/* LEFT: Basic Info */}
                        <div className="prof-card">
                            <div className="prof-card-header">
                                <div className="prof-icon-box" style={{background:'#eff6ff', color:'#3b82f6'}}>
                                    <i className="fas fa-user"></i>
                                </div>
                                <h3>Basic Information</h3>
                            </div>
                            
                            <div className="prof-form-grid">
                                <ProfInput label="First Name" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} disabled={!isEditing} />
                                <ProfInput label="Last Name" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} disabled={!isEditing} />
                                <ProfInput label="Phone Number" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} disabled={!isEditing} />
                                <ProfInput label="Email Address" value={profileData.email} disabled={true} lockIcon={true} />
                                <ProfInput label="Department" value={profileData.department} disabled={true} lockIcon={true} />
                                {user.role === 'student' && (
                                    <ProfInput label="Academic Year" value={profileData.year || "N/A"} disabled={true} lockIcon={true} />
                                )}
                            </div>
                        </div>

                        {/* RIGHT: Career (Student Only) */}
                        {user.role === 'student' && (
                            <div className="prof-card prof-card-highlight">
                                <div className="prof-card-header">
                                    <div className="prof-icon-box" style={{background:'#f3e8ff', color:'#9333ea'}}>
                                        <i className="fas fa-rocket"></i>
                                    </div>
                                    <h3>Career & Skills</h3>
                                </div>
                                
                                <div className="prof-form-stack">
                                    <div className="prof-input-group">
                                        <label className="prof-label">Interest Domain</label>
                                        <div className="prof-select-wrapper">
                                            <select 
                                                className="prof-select"
                                                disabled={!isEditing}
                                                value={formData.domain}
                                                onChange={e => setFormData({...formData, domain: e.target.value, subDomain: ''})}
                                            >
                                                <option value="">Select Domain</option>
                                                {Object.keys(INTEREST_DOMAINS).map(d => <option key={d} value={d}>{d}</option>)}
                                            </select>
                                            <i className="fas fa-chevron-down prof-select-icon"></i>
                                        </div>
                                    </div>

                                    {formData.domain && (
                                        <div className="prof-input-group animate-fade-in">
                                            <label className="prof-label">Specialization</label>
                                            <div className="prof-select-wrapper">
                                                <select 
                                                    className="prof-select"
                                                    disabled={!isEditing}
                                                    value={formData.subDomain}
                                                    onChange={e => setFormData({...formData, subDomain: e.target.value})}
                                                >
                                                    <option value="">Select Specialization</option>
                                                    {INTEREST_DOMAINS[formData.domain].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <i className="fas fa-chevron-down prof-select-icon"></i>
                                            </div>
                                        </div>
                                    )}

                                    <ProfInput label="Specific Skills" value={formData.specificSkills} onChange={e => setFormData({...formData, specificSkills: e.target.value})} disabled={!isEditing} placeholder="e.g. React, Python" />
                                    <ProfInput label="Career Goal" value={formData.careerGoal} onChange={e => setFormData({...formData, careerGoal: e.target.value})} disabled={!isEditing} placeholder="e.g. Software Engineer at Google" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* === SECURITY TAB (With 2FA) === */}
                {activeTab === 'security' && (
                    <div className="prof-grid">
                        
                        {/* 1. 2FA SETUP (NEW) */}
                        <div className="prof-card" style={{borderLeft: '4px solid #10b981'}}>
                            <div className="prof-card-header">
                                <div className="prof-icon-box" style={{background:'#dcfce7', color:'#16a34a'}}>
                                    <i className="fas fa-shield-alt"></i>
                                </div>
                                <div>
                                    <h3 style={{margin:0}}>Two-Factor Authentication</h3>
                                    <p style={{margin:0, fontSize:'13px', color:'#64748b'}}>Secure your account with Google Authenticator.</p>
                                </div>
                            </div>
                            <div style={{padding:'0 5px'}}>
                                <TwoFactorSetup user={profileData} />
                            </div>
                        </div>

                        {/* 2. CHANGE PASSWORD */}
                        <div className="prof-card">
                            <div className="prof-card-header">
                                <div className="prof-icon-box" style={{background:'#fee2e2', color:'#ef4444'}}>
                                    <i className="fas fa-key"></i>
                                </div>
                                <h3>Change Password</h3>
                            </div>
                            <form onSubmit={handleUpdatePassword} className="prof-form-stack">
                                <ProfInput 
                                    label="New Password" 
                                    type="password" 
                                    value={passData.newPass} 
                                    onChange={e => setPassData({...passData, newPass: e.target.value})} 
                                    placeholder="Enter new password"
                                />
                                <ProfInput 
                                    label="Confirm Password" 
                                    type="password" 
                                    value={passData.confirmPass} 
                                    onChange={e => setPassData({...passData, confirmPass: e.target.value})} 
                                    placeholder="Re-enter new password"
                                />
                                <button className="prof-btn prof-btn-save" style={{width:'100%', justifyContent:'center', marginTop:'10px'}} disabled={passLoading}>
                                    {passLoading ? "Updating..." : "Update Password"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            {/* --- PREMIUM SCOPED STYLES --- */}
            <style>{`
                /* Header Card */
                .prof-header-card {
                    position: relative;
                    background: white;
                    border-radius: 20px;
                    box-shadow: 0 10px 30px -10px rgba(0,0,0,0.1);
                    border: 1px solid rgba(255,255,255,0.5);
                    overflow: hidden;
                    margin-bottom: 30px;
                }
                .prof-header-bg {
                    height: 100px;
                    background: linear-gradient(120deg, #3b82f6 0%, #8b5cf6 100%);
                    opacity: 0.9;
                }
                .prof-header-content {
                    padding: 0 30px 30px 30px;
                    margin-top: -50px;
                    display: flex;
                    align-items: flex-end;
                    gap: 25px;
                    position: relative;
                }
                .prof-avatar {
                    width: 110px; height: 110px;
                    border-radius: 50%;
                    border: 5px solid white;
                    display: flex; align-items: center; justify-content: center;
                    color: white; font-size: 42px; font-weight: 800;
                    box-shadow: 0 8px 20px rgba(0,0,0,0.15);
                }
                .prof-info { flex: 1; padding-bottom: 5px; }
                .prof-name { margin: 0; font-size: 28px; color: #1e293b; font-weight: 800; letter-spacing: -0.5px; }
                .prof-badges { display: flex; gap: 10px; margin-top: 8px; flex-wrap: wrap; }
                
                .prof-badge-role { background: #eff6ff; color: #2563eb; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; border: 1px solid #bfdbfe; }
                .prof-badge-dept { background: #f8fafc; color: #475569; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid #e2e8f0; }
                .prof-badge-year { background: #f0fdf4; color: #16a34a; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; border: 1px solid #bbf7d0; }

                /* Buttons */
                .prof-btn {
                    padding: 10px 24px; border-radius: 12px; border: none;
                    font-size: 14px; font-weight: 600; cursor: pointer;
                    display: flex; align-items: center; gap: 8px;
                    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                }
                .prof-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
                .prof-btn-edit { background: white; color: #334155; border: 1px solid #e2e8f0; }
                .prof-btn-edit:hover { border-color: #cbd5e1; background: #f8fafc; }
                .prof-btn-save { background: #2563eb; color: white; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.3); }
                .prof-btn-save:hover { background: #1d4ed8; }

                /* Tabs */
                .prof-tabs-container { margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; }
                .prof-tabs { display: flex; gap: 30px; }
                .prof-tab-item {
                    background: none; border: none; padding: 12px 0;
                    font-size: 15px; font-weight: 600; color: #64748b;
                    cursor: pointer; position: relative;
                    transition: color 0.2s;
                }
                .prof-tab-item:hover { color: #334155; }
                .prof-tab-item.active { color: #2563eb; }
                .prof-tab-item.active::after {
                    content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 3px;
                    background: #2563eb; border-radius: 3px 3px 0 0;
                }

                /* Grid Layout */
                .prof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 30px; }
                
                /* Cards */
                .prof-card {
                    background: white; border-radius: 20px; padding: 30px;
                    border: 1px solid #f1f5f9;
                    box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -1px rgba(0,0,0,0.02);
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }
                .prof-card:hover { transform: translateY(-3px); box-shadow: 0 12px 25px -5px rgba(0,0,0,0.08); }
                .prof-card-highlight { border-top: 4px solid #8b5cf6; }

                .prof-card-header { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; }
                .prof-card-header h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; }
                .prof-icon-box {
                    width: 40px; height: 40px; border-radius: 12px;
                    display: flex; align-items: center; justify-content: center;
                    font-size: 18px;
                }

                /* Form Elements */
                .prof-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                .prof-form-stack { display: flex; flex-direction: column; gap: 20px; }
                
                .prof-input-group { position: relative; }
                .prof-label {
                    display: flex; justify-content: space-between; align-items: center;
                    font-size: 12px; font-weight: 700; color: #64748b;
                    margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.6px;
                }
                
                .prof-input, .prof-select {
                    width: 100%; padding: 12px 16px; border-radius: 12px;
                    border: 2px solid #f1f5f9; background: #f8fafc;
                    color: #1e293b; font-size: 14px; font-weight: 500;
                    transition: all 0.2s; -webkit-appearance: none;
                }
                .prof-input:focus, .prof-select:focus {
                    background: white; border-color: #3b82f6; outline: none;
                    box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
                }
                .prof-input:disabled {
                    background: #f1f5f9; border-color: transparent; color: #64748b; cursor: not-allowed;
                }
                .prof-select-wrapper { position: relative; }
                .prof-select-icon {
                    position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
                    color: #94a3b8; pointer-events: none; font-size: 12px;
                }

                /* Mobile Responsive */
                @media (max-width: 768px) {
                    .prof-header-content { flex-direction: column; align-items: center; text-align: center; }
                    .prof-grid { grid-template-columns: 1fr; }
                    .prof-form-grid { grid-template-columns: 1fr; }
                    .prof-badges { justify-content: center; }
                    .prof-btn { width: 100%; justify-content: center; }
                    .prof-tabs { width: 100%; justify-content: space-between; }
                    .prof-tab-item { flex: 1; text-align: center; }
                }

                .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
            `}</style>
        </div>
    );
}

// Reusable Input Component
const ProfInput = ({ label, value, onChange, disabled, type="text", placeholder, lockIcon }) => (
    <div className="prof-input-group">
        <label className="prof-label">
            {label}
            {lockIcon && <i className="fas fa-lock" style={{fontSize:'10px', color:'#94a3b8'}}></i>}
        </label>
        <input 
            type={type} 
            className="prof-input"
            value={value} 
            onChange={onChange} 
            disabled={disabled}
            placeholder={placeholder}
        />
    </div>
);