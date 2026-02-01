import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { auth } from '../firebase';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function ResumeBuilderModal({ isOpen, onClose, user }) {
    const [loading, setLoading] = useState(false);
    
    // ✅ Data Initialization with new fields
    const [formData, setFormData] = useState({
        summary: user?.resumeData?.summary || '',
        achievements: user?.resumeData?.achievements || [], // NEW: Key Achievements
        skills: user?.resumeData?.skills || [],
        projects: user?.resumeData?.projects || [],
        education: user?.resumeData?.education || [],
        experience: Array.isArray(user?.resumeData?.experience) ? user.resumeData.experience : [],
        certifications: user?.resumeData?.certifications || [],
        languages: user?.resumeData?.languages || [],
        links: user?.resumeData?.links || { linkedin: '', github: '', portfolio: '' }
    });

    // Temporary Inputs
    const [newAchieve, setNewAchieve] = useState('');
    const [newSkill, setNewSkill] = useState('');
    const [newProject, setNewProject] = useState({ title: '', desc: '', tech: '' }); // Added Tech Stack
    const [newEdu, setNewEdu] = useState({ school: '', degree: '', year: '', score: '' }); // Added Score/CGPA
    const [newWork, setNewWork] = useState({ company: '', role: '', duration: '', desc: '' });
    const [newCert, setNewCert] = useState({ name: '', issuer: '', year: '' });

    const handleSave = async () => {
        setLoading(true);
        const toastId = toast.loading("Saving Resume...");
        try {
            const token = await auth.currentUser.getIdToken();
            await fetch(`${BACKEND_URL}/updateResume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ resumeData: formData })
            });
            toast.success("Resume Updated!", { id: toastId });
            onClose();
        } catch (err) {
            toast.error("Failed to save.", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <div className="rb-overlay" onClick={onClose}>
                <motion.div 
                    className="rb-modal"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* --- HEADER --- */}
                    <div className="rb-header">
                        <div className="rb-header-text">
                            <h2>Resume Builder</h2>
                            <p>Fill in the details below to generate a professional resume.</p>
                        </div>
                        <button onClick={onClose} className="rb-close-btn"><i className="fas fa-times"></i></button>
                    </div>

                    {/* --- SCROLLABLE CONTENT --- */}
                    <div className="rb-content">
                        
                        {/* 1. PROFESSIONAL SUMMARY */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-user-tie"></i> Professional Summary</div>
                            <textarea 
                                rows="3" 
                                placeholder="Example: As a Team Leader of Team Nexus... I focus on building responsive applications..."
                                value={formData.summary}
                                onChange={e => setFormData({ ...formData, summary: e.target.value })}
                                className="rb-textarea"
                            />
                        </div>

                        {/* 2. KEY ACHIEVEMENTS (NEW) */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-trophy"></i> Key Achievements</div>
                            <div className="rb-card-list">
                                {formData.achievements.map((ach, i) => (
                                    <div key={i} className="rb-item-card">
                                        <div className="rb-item-main"><span>• {ach}</span></div>
                                        <button className="rb-del-btn" onClick={() => setFormData(p => ({...p, achievements: p.achievements.filter((_, idx) => idx !== i)}))}><i className="fas fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                            <div className="rb-row mt-2">
                                <input placeholder="e.g. 1st Runner-up, Smart India Hackathon 2025..." value={newAchieve} onChange={e => setNewAchieve(e.target.value)} className="rb-input" />
                                <button className="rb-icon-btn" onClick={() => {
                                    if(newAchieve) { setFormData(p => ({...p, achievements: [...p.achievements, newAchieve]})); setNewAchieve(''); }
                                }}><i className="fas fa-plus"></i></button>
                            </div>
                        </div>

                        {/* 3. EDUCATION */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-graduation-cap"></i> Education</div>
                            <div className="rb-card-list">
                                {formData.education.map((edu, i) => (
                                    <div key={i} className="rb-item-card">
                                        <div className="rb-item-main">
                                            <strong>{edu.degree}</strong>
                                            <span style={{fontSize:'12px', color:'#64748b'}}>{edu.school} | {edu.score} | {edu.year}</span>
                                        </div>
                                        <button className="rb-del-btn" onClick={() => setFormData(p => ({...p, education: p.education.filter((_, idx) => idx !== i)}))}><i className="fas fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                            <div className="rb-add-box">
                                <input placeholder="Degree (e.g. B.E. Information Technology)" value={newEdu.degree} onChange={e => setNewEdu({...newEdu, degree: e.target.value})} className="rb-input" />
                                <input placeholder="School / College Name" value={newEdu.school} onChange={e => setNewEdu({...newEdu, school: e.target.value})} className="rb-input" />
                                <div className="rb-row">
                                    <input placeholder="Score (e.g. CGPA: 9.18 or HSC: 78%)" value={newEdu.score} onChange={e => setNewEdu({...newEdu, score: e.target.value})} className="rb-input" />
                                    <input placeholder="Year (e.g. 2025)" value={newEdu.year} onChange={e => setNewEdu({...newEdu, year: e.target.value})} className="rb-input" />
                                </div>
                                <button className="rb-add-btn" onClick={() => {
                                    if(newEdu.school) { setFormData(p => ({...p, education: [...p.education, newEdu]})); setNewEdu({school:'', degree:'', year:'', score:''}); }
                                }}>+ Add Education</button>
                            </div>
                        </div>

                        {/* 4. PROJECTS */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-code"></i> Projects</div>
                            <div className="rb-card-list">
                                {formData.projects.map((p, i) => (
                                    <div key={i} className="rb-item-card">
                                        <div className="rb-item-main"><strong>{p.title}</strong><span style={{fontSize:'11px', color:'#3b82f6'}}>{p.tech}</span></div>
                                        <button className="rb-del-btn" onClick={() => setFormData(pr => ({...pr, projects: pr.projects.filter((_, idx) => idx !== i)}))}><i className="fas fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                            <div className="rb-add-box">
                                <input placeholder="Project Title (e.g. AcadeX - Smart Attendance App)" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} className="rb-input" />
                                <input placeholder="Tech Stack (e.g. React.js | Firebase | Node.js)" value={newProject.tech} onChange={e => setNewProject({...newProject, tech: e.target.value})} className="rb-input" />
                                <textarea placeholder="Description: e.g. Built an AI-driven platform to automate attendance..." value={newProject.desc} onChange={e => setNewProject({...newProject, desc: e.target.value})} className="rb-textarea" rows="2" />
                                <button className="rb-add-btn" onClick={() => {
                                    if(newProject.title) { setFormData(p => ({...p, projects: [...p.projects, newProject]})); setNewProject({title:'', desc:'', tech:''}); }
                                }}>+ Add Project</button>
                            </div>
                        </div>

                        {/* 5. SKILLS & LINKS */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-link"></i> Skills & Links</div>
                            
                            <label className="rb-label">Social Links</label>
                            <input placeholder="LinkedIn URL" value={formData.links.linkedin} onChange={e => setFormData({...formData, links: {...formData.links, linkedin: e.target.value}})} className="rb-input mb-2" />
                            <input placeholder="GitHub URL" value={formData.links.github} onChange={e => setFormData({...formData, links: {...formData.links, github: e.target.value}})} className="rb-input mb-2" />
                            <input placeholder="Portfolio URL" value={formData.links.portfolio} onChange={e => setFormData({...formData, links: {...formData.links, portfolio: e.target.value}})} className="rb-input mb-2" />

                            <label className="rb-label mt-2">Technical Skills</label>
                            <div className="rb-row">
                                <input placeholder="Add Skill (e.g. React.js, Node.js)..." value={newSkill} onChange={e => setNewSkill(e.target.value)} className="rb-input" />
                                <button className="rb-icon-btn" onClick={() => {
                                    if(newSkill && !formData.skills.includes(newSkill)) { setFormData(p => ({...p, skills: [...p.skills, newSkill]})); setNewSkill(''); }
                                }}><i className="fas fa-plus"></i></button>
                            </div>
                            <div className="rb-tags">
                                {formData.skills.map(s => <span key={s} className="rb-tag">{s} <i className="fas fa-times" onClick={() => setFormData(p => ({...p, skills: p.skills.filter(i => i!==s)}))}></i></span>)}
                            </div>
                        </div>

                    </div>

                    {/* --- FOOTER --- */}
                    <div className="rb-footer">
                        <button onClick={onClose} className="rb-cancel-btn">Close</button>
                        <button onClick={handleSave} className="rb-save-btn" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Resume'}
                        </button>
                    </div>
                </motion.div>
            </div>

            <style>{`
                /* --- CENTERED OVERLAY --- */
                .rb-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.5); backdrop-filter: blur(5px);
                    z-index: 10000; display: flex; align-items: center; justify-content: center;
                    padding: 20px; box-sizing: border-box;
                }

                /* --- MODAL CONTAINER --- */
                .rb-modal {
                    width: 100%; max-width: 800px;
                    height: 100%; max-height: 90vh; /* Dynamic Height */
                    background: #f8fafc; 
                    border-radius: 16px; 
                    display: flex; flex-direction: column;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
                    overflow: hidden; 
                    position: relative;
                }

                /* --- HEADER --- */
                .rb-header {
                    padding: 16px 24px; background: white; border-bottom: 1px solid #e2e8f0;
                    display: flex; justify-content: space-between; align-items: center;
                    flex-shrink: 0;
                }
                .rb-header h2 { margin: 0; font-size: 18px; color: #1e293b; font-weight: 700; }
                .rb-header p { margin: 2px 0 0 0; font-size: 13px; color: #64748b; }
                .rb-close-btn { background: #f1f5f9; border: none; width: 32px; height: 32px; border-radius: 50%; color: #64748b; cursor: pointer; display: flex; align-items: center; justify-content: center; }

                /* --- CONTENT AREA --- */
                .rb-content {
                    flex: 1; overflow-y: auto; padding: 20px;
                    display: flex; flex-direction: column; gap: 20px;
                    background: #f8fafc;
                }

                /* --- FOOTER --- */
                .rb-footer {
                    padding: 16px 24px; background: white; border-top: 1px solid #e2e8f0;
                    display: flex; gap: 10px; flex-shrink: 0; justify-content: flex-end;
                }
                .rb-cancel-btn { padding: 10px 20px; background: #f1f5f9; border: none; border-radius: 8px; color: #475569; font-weight: 600; cursor: pointer; }
                .rb-save-btn { padding: 10px 24px; background: #2563eb; border: none; border-radius: 8px; color: white; font-weight: 600; cursor: pointer; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2); }

                /* --- COMPONENTS --- */
                .rb-section { background: white; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0; }
                .rb-section-title { font-size: 14px; font-weight: 700; color: #3b82f6; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px; }
                
                .rb-add-box { background: #eff6ff; border: 1px dashed #bfdbfe; padding: 15px; border-radius: 8px; display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
                
                .rb-input, .rb-textarea { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none; box-sizing: border-box; }
                .rb-input:focus, .rb-textarea:focus { border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.1); }
                
                .rb-row { display: flex; gap: 10px; }
                .rb-add-btn { width: 100%; padding: 10px; background: #2563eb; color: white; border: none; border-radius: 6px; font-weight: 600; cursor: pointer; font-size: 13px; }
                .rb-icon-btn { width: 42px; background: #2563eb; color: white; border: none; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; }

                .rb-card-list { display: flex; flex-direction: column; gap: 8px; }
                .rb-item-card { background: white; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; }
                .rb-item-main { display: flex; flex-direction: column; font-size: 14px; color: #334155; }
                .rb-del-btn { color: #ef4444; background: none; border: none; cursor: pointer; padding: 5px; font-size: 14px; }

                .rb-label { font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 5px; display: block; text-transform: uppercase; }
                .rb-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
                .rb-tag { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 4px 10px; border-radius: 12px; font-size: 12px; color: #475569; display: flex; align-items: center; gap: 5px; }

                .mb-2 { margin-bottom: 10px; } .mt-2 { margin-top: 10px; }

                /* --- MOBILE SPECIFIC --- */
                @media (max-width: 600px) {
                    .rb-modal { max-height: 100dvh; border-radius: 12px; }
                    .rb-overlay { padding: 10px; }
                    .rb-row { flex-direction: column; gap: 8px; }
                    .rb-header { padding: 12px 16px; }
                    .rb-footer { padding: 12px 16px; }
                }
            `}</style>
        </AnimatePresence>,
        document.body
    );
}