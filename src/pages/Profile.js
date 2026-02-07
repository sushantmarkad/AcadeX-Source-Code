import React, { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { doc, updateDoc, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import TwoFactorSetup from '../components/TwoFactorSetup'; // ✅ Import 2FA Component
import './Dashboard.css';
import ResumeBuilderModal from '../components/ResumeBuilderModal';
import { Printer } from '@bcyesil/capacitor-plugin-printer';
import { Capacitor } from '@capacitor/core';

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

// --- PDF DOWNLOAD HELPER (Blue Links for Visibility) ---
// --- PDF DOWNLOAD HELPER (Native Mobile + Web Support) ---
const downloadResumePDF = async (user) => {
    const resume = user.resumeData || {};

    // 1. Generate Content (With Blue Links & Professional Styling)
    const htmlContent = `
        <html>
        <head>
            <title>${user.firstName}_Resume</title>
            <style>
                @page { size: A4; margin: 0.5in; }
                body { 
                    font-family: 'Times New Roman', serif; 
                    color: #000; 
                    line-height: 1.4; 
                    margin: 0; 
                    padding: 20px;
                }
                
                /* HEADER */
                .header { text-align: center; margin-bottom: 20px; border-bottom: 1px solid #000; padding-bottom: 10px; }
                h1 { margin: 0; font-size: 24pt; text-transform: uppercase; font-weight: bold; }
                .contact { font-size: 10pt; margin-top: 5px; }
                
                /* LINK STYLING (BLUE) */
                .contact a { 
                    color: #2563eb; /* Professional Blue */
                    text-decoration: none; 
                    font-weight: bold;
                }
                .contact a:hover { text-decoration: underline; }
                
                /* SECTIONS */
                h2 { 
                    font-size: 12pt; font-weight: bold; text-transform: uppercase; 
                    border-bottom: 1px solid #000; margin-top: 15px; margin-bottom: 5px; 
                    padding-bottom: 2px;
                }

                /* CONTENT */
                p { margin: 0 0 5px 0; text-align: justify; font-size: 11pt; }
                ul { margin: 0; padding-left: 20px; font-size: 11pt; }
                li { margin-bottom: 2px; }

                /* ITEMS */
                .item { margin-bottom: 8px; }
                .item-head { display: flex; justify-content: space-between; font-weight: bold; font-size: 11pt; }
                .item-sub { font-style: italic; font-size: 11pt; }
                .item-desc { font-size: 11pt; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>${user.firstName} ${user.lastName}</h1>
                <div class="contact">
                    <a href="mailto:${user.email}">${user.email}</a> 
                    
                    ${user.phone ? ` | ${user.phone}` : ''} 
                    
                    ${resume.links?.linkedin ? ` | <a href="${resume.links.linkedin}" target="_blank">LinkedIn</a>` : ''} 
                    ${resume.links?.portfolio ? ` | <a href="${resume.links.portfolio}" target="_blank">Portfolio</a>` : ''} 
                    ${resume.links?.github ? ` | <a href="${resume.links.github}" target="_blank">GitHub</a>` : ''}
                </div>
            </div>

            ${resume.summary ? `
                <h2>Professional Summary</h2>
                <p>${resume.summary}</p>
            ` : ''}

            ${resume.achievements?.length ? `
                <h2>Key Achievements</h2>
                <ul>
                    ${resume.achievements.map(ach => `<li>${ach}</li>`).join('')}
                </ul>
            ` : ''}

            ${resume.skills?.length ? `
                <h2>Technical Skills</h2>
                <p><strong>Core Skills:</strong> ${resume.skills.join(' • ')}</p>
            ` : ''}

            ${resume.projects?.length ? `
                <h2>Projects</h2>
                ${resume.projects.map(p => `
                    <div class="item">
                        <div class="item-head"><span>${p.title}</span></div>
                        <div class="item-desc">${p.desc}</div>
                        ${p.tech ? `<div style="font-size: 10pt; font-style: italic;">Stack: ${p.tech}</div>` : ''}
                    </div>
                `).join('')}
            ` : ''}

            ${resume.experience?.length ? `
                <h2>Experience</h2>
                ${resume.experience.map(exp => `
                    <div class="item">
                        <div class="item-head"><span>${exp.company}</span> <span>${exp.duration}</span></div>
                        <div class="item-sub">${exp.role}</div>
                        <div class="item-desc">${exp.desc}</div>
                    </div>
                `).join('')}
            ` : ''}

            ${resume.education?.length ? `
                <h2>Education</h2>
                ${resume.education.map(edu => `
                    <div class="item">
                        <div class="item-head"><span>${edu.degree}</span> <span>${edu.year}</span></div>
                        <div class="item-sub">${edu.school} ${edu.score ? `| ${edu.score}` : ''}</div>
                    </div>
                `).join('')}
            ` : ''}
        </body>
        </html>
    `;

    // 2. Platform Specific Print Logic
    try {
        if (Capacitor.isNativePlatform()) {
            // 📱 ANDROID APP: Use Native Printer Plugin
            await Printer.print({
                content: htmlContent,
                name: `${user.firstName}_Resume`
            });
        } else {
            // 💻 WEB BROWSER: Use Iframe Method
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.right = '0';
            iframe.style.bottom = '0';
            iframe.style.width = '0';
            iframe.style.height = '0';
            iframe.style.border = '0';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(htmlContent);
            doc.close();

            // Trigger Print
            setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                setTimeout(() => {
                    document.body.removeChild(iframe);
                }, 1000);
            }, 500);
        }
    } catch (error) {
        console.error("Printing failed:", error);
        alert("Unable to download PDF. Please try again.");
    }
};
export default function Profile({ user }) {
    const [isResumeModalOpen, setIsResumeModalOpen] = useState(false);
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
    // ✅ EXPANDED AVATAR OPTIONS
    const AVATAR_OPTIONS = [
        // Boy Avatars
        { id: 'm1', url: 'https://cdn-icons-png.flaticon.com/512/4140/4140048.png', label: 'Boy 1' },
        { id: 'm2', url: 'https://cdn-icons-png.flaticon.com/512/4139/4139948.png', label: 'Boy 2' },
        { id: 'm3', url: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png', label: 'Boy 3' },
        { id: 'm4', url: 'https://cdn-icons-png.flaticon.com/512/4140/4140061.png', label: 'Boy 4' },

        // Girl Avatars
        { id: 'f1', url: 'https://cdn-icons-png.flaticon.com/512/4140/4140047.png', label: 'Girl 1' },
        { id: 'f2', url: 'https://cdn-icons-png.flaticon.com/512/4139/4139951.png', label: 'Girl 2' },
        { id: 'f3', url: 'https://cdn-icons-png.flaticon.com/512/4140/4140051.png', label: 'Girl 3' },
        { id: 'f4', url: 'https://cdn-icons-png.flaticon.com/512/6997/6997662.png', label: 'Girl 4' },

        // Neutral / Fun Avatars
        { id: 'n1', url: 'https://cdn-icons-png.flaticon.com/512/11498/11498793.png', label: 'Robot' },
        { id: 'n2', url: 'https://cdn-icons-png.flaticon.com/512/9408/9408175.png', label: 'Astronaut' }
    ];

    const handleAvatarSelect = async (url) => {
        const toastId = toast.loading("Updating avatar...");
        try {
            const userRef = doc(db, 'users', auth.currentUser.uid);

            // ✅ IMPROVED GENDER DETECTION Logic
            // If the URL contains girl-related IDs or if you want to manual map them:
            const femaleIds = ['f1', 'f2', 'f3', 'f4'];
            const selectedAvatar = AVATAR_OPTIONS.find(a => a.url === url);
            const detectedGender = femaleIds.includes(selectedAvatar?.id) ? 'female' : 'male';

            await updateDoc(userRef, {
                profilePic: url,
                gender: detectedGender // Syncs gender field for defaults
            });

            toast.success("Avatar updated!", { id: toastId });
        } catch (err) {
            toast.error("Failed to update avatar", { id: toastId });
        }
    };

    if (!profileData) return <div className="content-section">Loading...</div>;

    return (
        <div className="content-section" style={{ maxWidth: '1100px', margin: '0 auto' }}>

            {/* --- PREMIUM HEADER CARD (Sunset Violet Theme) --- */}
            <div className="prof-header-card">
                <div className="prof-header-content">
                    {/* ✅ Updated Profile Avatar Logic with Defaults */}
                    <div className="prof-avatar" style={{
                        background: user.profilePic ? 'transparent' : getAvatarGradient(user.firstName),
                        overflow: 'hidden'
                    }}>
                        {user.profilePic ? (
                            <img src={user.profilePic} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            /* Fallback to Gender Default or Initials */
                            profileData.gender === 'male' ? (
                                <img src="https://cdn-icons-png.flaticon.com/512/4140/4140048.png" alt="Male Default" style={{ width: '100%', height: '100%' }} />
                            ) : user.gender === 'female' ? (
                                <img src="https://cdn-icons-png.flaticon.com/512/4140/4140047.png" alt="Female Default" style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <>{user.firstName?.charAt(0)}{user.lastName?.charAt(0)}</>
                            )
                        )}
                    </div>

                    <div className="prof-info">
                        <h2 className="prof-name">{profileData.firstName} {profileData.lastName}</h2>
                        <div className="prof-badges">
                            <span className="prof-badge-glass">{profileData.role?.toUpperCase()}</span>
                            <span className="prof-badge-glass">{profileData.department}</span>

                            {/* ✅ FIX: Hide "Year" badge if it matches Department (Prevents "FE FE Year") */}
                            {profileData.year && profileData.year !== profileData.department && (
                                <span className="prof-badge-glass">{profileData.year} Year</span>
                            )}

                            {/* ✅ Show Division Badge (Supports both 'div' and 'division' fields) */}
                            {(profileData.division || profileData.div) && (
                                <span className="prof-badge-glass">Div {profileData.division || profileData.div}</span>
                            )}
                        </div>
                    </div>

                    {/* ✅ FIXED BUTTON GROUP */}
                    {/* ✅ RESUME & EDIT BUTTONS */}
                    {activeTab === 'details' && (
                        <div style={{ display: 'flex', gap: '10px', marginTop: '15px', flexWrap: 'wrap' }}>
                            {/* Edit / Save Button */}
                            <button className={`prof-btn ${isEditing ? 'prof-btn-save' : 'prof-btn-edit'}`} onClick={() => isEditing ? handleSaveProfile() : setIsEditing(true)}>
                                <i className={`fas ${isEditing ? 'fa-check' : 'fa-pen'}`}></i> {isEditing ? 'Save Profile' : 'Edit Profile'}
                            </button>

                            {/* Build Resume Button */}
                            <button className="prof-btn" style={{ background: 'rgba(255,255,255,0.2)', color: 'white', border: '1px solid rgba(255,255,255,0.3)' }} onClick={() => setIsResumeModalOpen(true)}>
                                <i className="fas fa-file-contract"></i> Build Resume
                            </button>

                            {/* Download PDF Button */}
                            {/* Download PDF Button */}
                            <button
                                className="prof-btn"
                                style={{ background: '#3b82f6', color: 'white' }}
                                onClick={() => downloadResumePDF(profileData)}
                            >
                                <i className="fas fa-file-pdf"></i> Download PDF
                            </button>
                        </div>
                    )}
                    <ResumeBuilderModal
                        isOpen={isResumeModalOpen}
                        onClose={() => setIsResumeModalOpen(false)}
                        user={profileData}
                    />

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
               {/* === DETAILS TAB === */}
                {activeTab === 'details' && (
                    <div className="prof-grid">

                        {/* LEFT: Basic Information */}
                        <div className="prof-card">
                            <div className="prof-card-header">
                                <div className="prof-icon-box" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                                    <i className="fas fa-user"></i>
                                </div>
                                <h3>Basic Information</h3>
                            </div>

                            <div className="prof-form-grid">
                                <ProfInput label="First Name" value={formData.firstName} onChange={e => setFormData({ ...formData, firstName: e.target.value })} disabled={!isEditing} />
                                <ProfInput label="Last Name" value={formData.lastName} onChange={e => setFormData({ ...formData, lastName: e.target.value })} disabled={!isEditing} />
                                <ProfInput label="Phone Number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} disabled={!isEditing} />
                                <ProfInput label="Email Address" value={profileData.email} disabled={true} lockIcon={true} />
                                <ProfInput label="Department" value={profileData.department} disabled={true} lockIcon={true} />

                                {/* ✅ CONSOLIDATED ACADEMIC YEAR (Checks root, extras, then assignedClasses) */}
                                <ProfInput 
                                    label="Academic Year" 
                                    value={
                                        profileData.academicYear || 
                                        profileData.extras?.academicYear || 
                                        (profileData.assignedClasses?.[0]?.academicYear) || 
                                        "Not Assigned"
                                    } 
                                    disabled={true} 
                                    lockIcon={true} 
                                />
                                
                                {/* --- STUDENT SPECIFIC FIELDS --- */}
                                {user.role === 'student' && (
                                    <>
                                        <ProfInput label="Current Class" value={profileData.year || "N/A"} disabled={true} lockIcon={true} />
                                        <ProfInput 
                                            label="Division" 
                                            value={profileData.division || profileData.div || "N/A"} 
                                            disabled={true} 
                                            lockIcon={true} 
                                        />
                                    </>
                                )}

                                {/* --- TEACHER SPECIFIC FIELDS (Full Width) --- */}
                                {user.role === 'teacher' && (
                                    <div style={{ gridColumn: '1 / -1' }}>
                                        <ProfInput 
                                            label="Assigned Classes" 
                                            lockIcon 
                                            disabled 
                                            value={
                                                profileData.assignedClasses && profileData.assignedClasses.length > 0
                                                    ? profileData.assignedClasses.map(c => {
                                                        // ✅ FE: Show "FE (Div A)"
                                                        if (c.year === 'FE') return `FE (Div ${c.divisions || 'All'})`;
                                                        // ✅ SE/TE/BE: Just Show Year
                                                        return c.year;
                                                      }).join(' | ')
                                                    : "No Classes Assigned"
                                            } 
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* ✅ Avatar Selection (Kept Intact) */}
                        <div className="prof-card" style={{ marginTop: '20px' }}>
                            <div className="prof-card-header">
                                <div className="prof-icon-box" style={{ background: '#fef3c7', color: '#d97706' }}>
                                    <i className="fas fa-paint-brush"></i>
                                </div>
                                <h3>Choose Your Avatar</h3>
                            </div>
                            <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
                                {AVATAR_OPTIONS.map((avatar) => (
                                    <div
                                        key={avatar.id}
                                        onClick={() => handleAvatarSelect(avatar.url)}
                                        style={{
                                            cursor: 'pointer', padding: '5px', borderRadius: '50%',
                                            border: profileData.profilePic === avatar.url ? '3px solid #db2777' : '3px solid transparent',
                                            transition: 'all 0.2s', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                                        }}
                                    >
                                        <img src={avatar.url} alt={avatar.label} style={{ width: '55px', height: '55px', borderRadius: '50%' }} />
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: Career (Student Only) */}
                        {user.role === 'student' && (
                            <div className="prof-card prof-card-highlight">
                                <div className="prof-card-header">
                                    <div className="prof-icon-box" style={{ background: '#f3e8ff', color: '#9333ea' }}>
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
                                                onChange={e => setFormData({ ...formData, domain: e.target.value, subDomain: '' })}
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
                                                    onChange={e => setFormData({ ...formData, subDomain: e.target.value })}
                                                >
                                                    <option value="">Select Specialization</option>
                                                    {INTEREST_DOMAINS[formData.domain].map(s => <option key={s} value={s}>{s}</option>)}
                                                </select>
                                                <i className="fas fa-chevron-down prof-select-icon"></i>
                                            </div>
                                        </div>
                                    )}

                                    <ProfInput label="Specific Skills" value={formData.specificSkills} onChange={e => setFormData({ ...formData, specificSkills: e.target.value })} disabled={!isEditing} placeholder="e.g. React, Python" />
                                    <ProfInput label="Career Goal" value={formData.careerGoal} onChange={e => setFormData({ ...formData, careerGoal: e.target.value })} disabled={!isEditing} placeholder="e.g. Software Engineer at Google" />
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* === SECURITY TAB (With 2FA) === */}
                {activeTab === 'security' && (
                    <div className="prof-grid">

                        {/* 1. 2FA SETUP (NEW) */}
                        <div className="prof-card" style={{ borderLeft: '4px solid #10b981' }}>
                            <div className="prof-card-header">
                                <div className="prof-icon-box" style={{ background: '#dcfce7', color: '#16a34a' }}>
                                    <i className="fas fa-shield-alt"></i>
                                </div>
                                <div>
                                    <h3 style={{ margin: 0 }}>Two-Factor Authentication</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Secure your account with Google Authenticator.</p>
                                </div>
                            </div>
                            <div style={{ padding: '0 5px' }}>
                                <TwoFactorSetup user={profileData} />
                            </div>
                        </div>

                        {/* 2. CHANGE PASSWORD */}
                        <div className="prof-card">
                            <div className="prof-card-header">
                                <div className="prof-icon-box" style={{ background: '#fee2e2', color: '#ef4444' }}>
                                    <i className="fas fa-key"></i>
                                </div>
                                <h3>Change Password</h3>
                            </div>
                            <form onSubmit={handleUpdatePassword} className="prof-form-stack">
                                <ProfInput
                                    label="New Password"
                                    type="password"
                                    value={passData.newPass}
                                    onChange={e => setPassData({ ...passData, newPass: e.target.value })}
                                    placeholder="Enter new password"
                                />
                                <ProfInput
                                    label="Confirm Password"
                                    type="password"
                                    value={passData.confirmPass}
                                    onChange={e => setPassData({ ...passData, confirmPass: e.target.value })}
                                    placeholder="Re-enter new password"
                                />
                                <button className="prof-btn prof-btn-save" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }} disabled={passLoading}>
                                    {passLoading ? "Updating..." : "Update Password"}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </div>

            <style>{`
    /* --- Full Gradient Header Card --- */
    .prof-header-card {
        background: linear-gradient(135deg, #7c3aed 0%, #db2777 100%); /* Sunset Violet */
        border-radius: 20px;
        box-shadow: 0 10px 30px rgba(219, 39, 119, 0.25);
        overflow: hidden;
        margin-bottom: 30px;
        position: relative;
        border: 1px solid rgba(255,255,255,0.2);
    }

    /* Content Layout */
    .prof-header-content {
        padding: 40px;
        display: flex;
        align-items: center;
        gap: 30px;
    }

    /* --- Avatar (White with Color Text) --- */
    /* ✅ FIXED: Added min-width/height and flex-shrink to prevent oval shape */
    .prof-avatar {
        width: 100px; height: 100px;
        min-width: 100px; min-height: 100px;
        border-radius: 50%;
        flex-shrink: 0; 
        background: rgba(255, 255, 255, 0.95);
        border: 4px solid rgba(255,255,255,0.3); /* Glass Border */
        display: flex; align-items: center; justify-content: center;
        color: #db2777; /* Matching Text Color */
        font-size: 36px; font-weight: 800;
        box-shadow: 0 8px 20px rgba(0,0,0,0.2);
    }

    /* --- Info Section --- */
    .prof-info { flex: 1; }
    
    .prof-name { 
        margin: 0; 
        font-size: 32px; 
        color: white; 
        font-weight: 800; 
        letter-spacing: -0.5px;
        text-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .prof-badges { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; }
    
    /* Glass Badges */
    .prof-badge-glass { 
        background: rgba(255, 255, 255, 0.2); 
        color: white; 
        padding: 5px 14px; 
        border-radius: 20px; 
        font-size: 11px; 
        font-weight: 700; 
        text-transform: uppercase; 
        letter-spacing: 0.5px; 
        border: 1px solid rgba(255, 255, 255, 0.3);
        backdrop-filter: blur(5px);
    }

    /* --- Buttons (White Glass) --- */
    .prof-btn {
        padding: 10px 24px; border-radius: 12px; border: none;
        font-size: 14px; font-weight: 600; cursor: pointer;
        display: flex; align-items: center; gap: 8px;
        transition: all 0.2s ease;
        box-shadow: 0 4px 10px rgba(0,0,0,0.1);
        white-space: nowrap;
    }
    .prof-btn:hover { transform: translateY(-2px); }

    .prof-btn-edit { 
        background: white; 
        color: #db2777; 
    }
    .prof-btn-save { 
        background: #10b981; 
        color: white; 
        box-shadow: 0 4px 15px rgba(16, 185, 129, 0.4);
    }

    /* --- Tabs --- */
    .prof-tabs-container { margin-bottom: 30px; border-bottom: 1px solid #e2e8f0; }
    .prof-tabs { display: flex; gap: 30px; overflow-x: auto; }
    .prof-tab-item {
        background: none; border: none; padding: 12px 0;
        font-size: 15px; font-weight: 600; color: #64748b;
        cursor: pointer; position: relative; transition: color 0.2s; white-space: nowrap;
    }
    .prof-tab-item:hover { color: #334155; }
    .prof-tab-item.active { color: #db2777; } /* Matches Theme */
    .prof-tab-item.active::after {
        content: ''; position: absolute; bottom: -1px; left: 0; width: 100%; height: 3px;
        background: #db2777; border-radius: 3px 3px 0 0;
    }

    /* --- Layout & Forms --- */
    .prof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 30px; }
    
    .prof-card {
        background: white; border-radius: 20px; padding: 30px;
        border: 1px solid #f1f5f9;
        box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02);
        transition: transform 0.3s ease;
    }
    .prof-card:hover { transform: translateY(-3px); box-shadow: 0 12px 25px -5px rgba(0,0,0,0.08); }
    .prof-card-highlight { border-top: 4px solid #d946ef; }

    .prof-card-header { display: flex; align-items: center; gap: 15px; margin-bottom: 25px; }
    .prof-card-header h3 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; }
    .prof-icon-box {
        width: 40px; height: 40px; border-radius: 12px;
        display: flex; align-items: center; justify-content: center;
        font-size: 18px;
    }

    /* Form Grids */
    .prof-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .prof-form-stack { display: flex; flex-direction: column; gap: 20px; }
    
    .prof-input-group { position: relative; }
    .prof-label {
        display: flex; justify-content: space-between; align-items: center;
        font-size: 12px; font-weight: 700; color: #64748b;
        margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.6px;
    }
    
    /* ✅ FIXED: Added appearance:none to hide default arrow (fixes double dropdown) */
    .prof-input, .prof-select {
        width: 100%; padding: 12px 16px; border-radius: 12px;
        border: 2px solid #f1f5f9; background: #f8fafc;
        color: #1e293b; font-size: 14px; font-weight: 500;
        transition: all 0.2s; box-sizing: border-box; 
        appearance: none;
        -webkit-appearance: none;
        -moz-appearance: none;
    }
    .prof-input:focus, .prof-select:focus {
        background: white; border-color: #d946ef; outline: none;
        box-shadow: 0 0 0 4px rgba(217, 70, 239, 0.1);
    }
    .prof-input:disabled { background: #f1f5f9; border-color: transparent; color: #64748b; cursor: not-allowed; }
    
    .prof-select-wrapper { position: relative; }
    .prof-select-icon {
        position: absolute; right: 16px; top: 50%; transform: translateY(-50%);
        color: #94a3b8; pointer-events: none; font-size: 12px;
    }

    /* --- MOBILE RESPONSIVE --- */
    @media (max-width: 768px) {
        .prof-header-content { 
            flex-direction: column; 
            text-align: center; 
            padding: 30px;
        }
        .prof-avatar { width: 90px; height: 90px; font-size: 32px; }
        .prof-name { font-size: 24px; }
        .prof-badges { justify-content: center; }
        .prof-btn { width: 100%; justify-content: center; margin-top: 10px; }
        
        /* Grid Stacking */
        .prof-grid { grid-template-columns: 1fr; }
        .prof-form-grid { grid-template-columns: 1fr; }
        .prof-tabs { justify-content: space-between; }
        .prof-tab-item { flex: 1; text-align: center; }
    }

    .animate-fade-in { animation: fadeIn 0.3s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
`}</style>
        </div>
    );
}

// Reusable Input Component
const ProfInput = ({ label, value, onChange, disabled, type = "text", placeholder, lockIcon }) => (
    <div className="prof-input-group">
        <label className="prof-label">
            {label}
            {lockIcon && <i className="fas fa-lock" style={{ fontSize: '10px', color: '#94a3b8' }}></i>}
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