import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { auth } from '../firebase';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function ResumeBuilderModal({ isOpen, onClose, user }) {
    const [loading, setLoading] = useState(false);
    
    // Data State
    const [formData, setFormData] = useState({
        summary: user?.resumeData?.summary || '',
        achievements: user?.resumeData?.achievements || [], 
        skills: user?.resumeData?.skills || [],
        projects: user?.resumeData?.projects || [],
        education: user?.resumeData?.education || [],
        links: user?.resumeData?.links || { linkedin: '', github: '', portfolio: '' }
    });

    // Inputs
    const [newAchieve, setNewAchieve] = useState('');
    const [newSkill, setNewSkill] = useState('');
    const [newProject, setNewProject] = useState({ title: '', desc: '', tech: '' });
    const [newEdu, setNewEdu] = useState({ school: '', degree: '', year: '', score: '' });

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
            <div className="rb-overlay">
                <motion.div 
                    className="rb-modal"
                    initial={{ opacity: 0, y: 100 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 100 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                >
                    {/* --- HEADER (Safe Area for Notch) --- */}
                    <div className="rb-header">
                        <div className="rb-header-content">
                            <div>
                                <h2>Resume Builder</h2>
                                <p>Build a professional profile in minutes.</p>
                            </div>
                            <button onClick={onClose} className="rb-close-btn"><i className="fas fa-times"></i></button>
                        </div>
                    </div>

                    {/* --- SCROLLABLE CONTENT --- */}
                    <div className="rb-content">
                        
                        {/* 1. PROFESSIONAL SUMMARY */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-user-tie"></i> Professional Summary</div>
                            <p className="rb-hint">Write 2-3 lines about your experience, tech stack, and career goals.</p>
                            <textarea 
                                rows="4" 
                                placeholder="E.g. Final year IT student skilled in MERN Stack..."
                                value={formData.summary}
                                onChange={e => setFormData({ ...formData, summary: e.target.value })}
                                className="rb-textarea"
                            />
                        </div>

                        {/* 2. LINKS */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-link"></i> Social Links</div>
                            <div className="rb-grid-2">
                                <input placeholder="LinkedIn URL" value={formData.links.linkedin} onChange={e => setFormData({...formData, links: {...formData.links, linkedin: e.target.value}})} className="rb-input" />
                                <input placeholder="GitHub URL" value={formData.links.github} onChange={e => setFormData({...formData, links: {...formData.links, github: e.target.value}})} className="rb-input" />
                                <input placeholder="Portfolio URL (Optional)" value={formData.links.portfolio} onChange={e => setFormData({...formData, links: {...formData.links, portfolio: e.target.value}})} className="rb-input" style={{gridColumn: '1 / -1'}} />
                            </div>
                        </div>

                        {/* 3. SKILLS */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-tools"></i> Technical Skills</div>
                            <div className="rb-input-group">
                                <input placeholder="Add Skill (e.g. React.js)" value={newSkill} onChange={e => setNewSkill(e.target.value)} className="rb-input" />
                                <button className="rb-btn-icon" onClick={() => { if(newSkill) { setFormData(p => ({...p, skills: [...p.skills, newSkill]})); setNewSkill(''); } }}><i className="fas fa-plus"></i></button>
                            </div>
                            <div className="rb-tags">
                                {formData.skills.map(s => <span key={s} className="rb-tag">{s} <i className="fas fa-times" onClick={() => setFormData(p => ({...p, skills: p.skills.filter(i => i!==s)}))}></i></span>)}
                            </div>
                        </div>

                        {/* 4. EDUCATION */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-graduation-cap"></i> Education</div>
                            <div className="rb-card-list">
                                {formData.education.map((edu, i) => (
                                    <div key={i} className="rb-item-card">
                                        <div><strong>{edu.degree}</strong><div className="rb-subtext">{edu.school} • {edu.year}</div></div>
                                        <button className="rb-del-btn" onClick={() => setFormData(p => ({...p, education: p.education.filter((_, idx) => idx !== i)}))}><i className="fas fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                            <div className="rb-add-box">
                                <input placeholder="Degree (e.g. B.Tech CS)" value={newEdu.degree} onChange={e => setNewEdu({...newEdu, degree: e.target.value})} className="rb-input" />
                                <input placeholder="College Name" value={newEdu.school} onChange={e => setNewEdu({...newEdu, school: e.target.value})} className="rb-input" />
                                <div className="rb-grid-2">
                                    <input placeholder="Score (e.g. 9.0 CGPA)" value={newEdu.score} onChange={e => setNewEdu({...newEdu, score: e.target.value})} className="rb-input" />
                                    <input placeholder="Year (e.g. 2025)" value={newEdu.year} onChange={e => setNewEdu({...newEdu, year: e.target.value})} className="rb-input" />
                                </div>
                                <button className="rb-btn-add" onClick={() => { if(newEdu.school) { setFormData(p => ({...p, education: [...p.education, newEdu]})); setNewEdu({school:'', degree:'', year:'', score:''}); } }}>+ Add Education</button>
                            </div>
                        </div>

                        {/* 5. PROJECTS */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-code"></i> Projects</div>
                            <div className="rb-card-list">
                                {formData.projects.map((p, i) => (
                                    <div key={i} className="rb-item-card">
                                        <div><strong>{p.title}</strong><div className="rb-subtext">{p.tech}</div></div>
                                        <button className="rb-del-btn" onClick={() => setFormData(pr => ({...pr, projects: pr.projects.filter((_, idx) => idx !== i)}))}><i className="fas fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                            <div className="rb-add-box">
                                <input placeholder="Project Title" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} className="rb-input" />
                                <input placeholder="Tech Stack (e.g. Flutter, Firebase)" value={newProject.tech} onChange={e => setNewProject({...newProject, tech: e.target.value})} className="rb-input" />
                                <textarea placeholder="Short Description..." value={newProject.desc} onChange={e => setNewProject({...newProject, desc: e.target.value})} className="rb-textarea" rows="2" />
                                <button className="rb-btn-add" onClick={() => { if(newProject.title) { setFormData(p => ({...p, projects: [...p.projects, newProject]})); setNewProject({title:'', desc:'', tech:''}); } }}>+ Add Project</button>
                            </div>
                        </div>

                        {/* 6. ACHIEVEMENTS */}
                        <div className="rb-section">
                            <div className="rb-section-title"><i className="fas fa-trophy"></i> Achievements</div>
                            <div className="rb-card-list">
                                {formData.achievements.map((ach, i) => (
                                    <div key={i} className="rb-item-card">
                                        <span>• {ach}</span>
                                        <button className="rb-del-btn" onClick={() => setFormData(p => ({...p, achievements: p.achievements.filter((_, idx) => idx !== i)}))}><i className="fas fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                            <div className="rb-input-group">
                                <input placeholder="E.g. 1st Rank in Hackathon..." value={newAchieve} onChange={e => setNewAchieve(e.target.value)} className="rb-input" />
                                <button className="rb-btn-icon" onClick={() => { if(newAchieve) { setFormData(p => ({...p, achievements: [...p.achievements, newAchieve]})); setNewAchieve(''); } }}><i className="fas fa-plus"></i></button>
                            </div>
                        </div>

                        {/* Spacer for Scrolling */}
                        <div style={{height: '20px'}}></div>
                    </div>

                    {/* --- FOOTER (Safe Area for Home Bar) --- */}
                    <div className="rb-footer">
                        <button onClick={onClose} className="rb-btn-cancel">Cancel</button>
                        <button onClick={handleSave} className="rb-btn-save" disabled={loading}>
                            {loading ? 'Saving...' : 'Save Resume'}
                        </button>
                    </div>
                </motion.div>
            </div>

            <style>{`
                /* 1. OVERLAY */
                .rb-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
                    z-index: 10000; display: flex; align-items: center; justify-content: center;
                }

                /* 2. MODAL BOX (Responsive) */
                .rb-modal {
                    width: 100%; max-width: 700px;
                    height: 85vh; /* Desktop Height */
                    background: #f8fafc; border-radius: 20px;
                    display: flex; flex-direction: column;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25);
                    overflow: hidden;
                }

                /* 3. HEADER */
                .rb-header {
                    background: white; border-bottom: 1px solid #e2e8f0;
                    padding: 16px 24px; flex-shrink: 0;
                }
                .rb-header-content { display: flex; justify-content: space-between; align-items: center; }
                .rb-header h2 { margin: 0; font-size: 1.25rem; color: #1e293b; font-weight: 700; }
                .rb-header p { margin: 4px 0 0 0; font-size: 0.85rem; color: #64748b; }
                .rb-close-btn { background: #f1f5f9; border: none; width: 36px; height: 36px; border-radius: 50%; color: #64748b; cursor: pointer; font-size: 16px; }

                /* 4. CONTENT AREA */
                .rb-content {
                    flex: 1; overflow-y: auto; padding: 24px;
                    display: flex; flex-direction: column; gap: 24px;
                    -webkit-overflow-scrolling: touch; /* Smooth scroll on mobile */
                }

                /* 5. FOOTER */
                .rb-footer {
                    background: white; border-top: 1px solid #e2e8f0;
                    padding: 16px 24px; display: flex; justify-content: flex-end; gap: 12px;
                    flex-shrink: 0;
                }

                /* 6. FORM ELEMENTS */
                .rb-section { background: white; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
                .rb-section-title { font-size: 0.9rem; font-weight: 700; color: #3b82f6; text-transform: uppercase; margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
                .rb-hint { font-size: 0.8rem; color: #94a3b8; margin-bottom: 12px; }
                
                .rb-input, .rb-textarea { 
                    width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 10px; 
                    font-size: 0.95rem; outline: none; transition: all 0.2s; background: #fff;
                    box-sizing: border-box; /* Fix width overflow */
                }
                .rb-input:focus, .rb-textarea:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59,130,246,0.1); }
                
                .rb-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
                .rb-input-group { display: flex; gap: 10px; }
                
                .rb-add-box { background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1; display: flex; flex-direction: column; gap: 10px; margin-top: 15px; }
                
                /* Buttons */
                .rb-btn-add { width: 100%; padding: 10px; background: #eff6ff; color: #2563eb; border: 1px solid #bfdbfe; border-radius: 8px; font-weight: 600; cursor: pointer; }
                .rb-btn-icon { width: 48px; background: #2563eb; color: white; border: none; border-radius: 10px; cursor: pointer; font-size: 16px; }
                .rb-btn-save { padding: 12px 24px; background: #2563eb; color: white; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; }
                .rb-btn-cancel { padding: 12px 24px; background: #f1f5f9; color: #475569; border: none; border-radius: 10px; font-weight: 600; cursor: pointer; }

                /* Cards & Tags */
                .rb-card-list { display: flex; flex-direction: column; gap: 10px; }
                .rb-item-card { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; }
                .rb-subtext { font-size: 0.8rem; color: #64748b; margin-top: 2px; }
                .rb-del-btn { background: #fee2e2; color: #ef4444; border: none; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; }
                
                .rb-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
                .rb-tag { background: #eff6ff; color: #1e40af; padding: 6px 12px; border-radius: 20px; font-size: 0.85rem; font-weight: 500; display: flex; align-items: center; gap: 6px; }
                .rb-tag i { cursor: pointer; opacity: 0.6; } .rb-tag i:hover { opacity: 1; }

                /* --- 📱 MOBILE OPTIMIZATION (Safe Area & Layout) --- */
                @media (max-width: 768px) {
                    .rb-overlay { 
                        align-items: flex-end; /* Sheet slides up from bottom */
                        padding: 0;
                    }
                    .rb-modal {
                        width: 100%;
                        height: 100dvh; /* Full Height on Mobile */
                        max-height: none; /* Override desktop max-height */
                        border-radius: 0; /* Square corners */
                    }
                    .rb-header {
                        /* Push header down below Notch/Camera */
                        padding-top: max(16px, env(safe-area-inset-top)); 
                    }
                    .rb-content {
                        padding: 16px; /* Less padding on mobile */
                    }
                    .rb-footer {
                        /* Push footer up above Home Swipe Bar */
                        padding-bottom: max(20px, env(safe-area-inset-bottom)); 
                        background: #fff;
                        box-shadow: 0 -4px 12px rgba(0,0,0,0.05); /* Shadow to separate from content */
                    }
                    .rb-btn-save, .rb-btn-cancel {
                        flex: 1; /* Full width buttons on mobile */
                        padding: 14px;
                        font-size: 1rem;
                    }
                    .rb-grid-2 { grid-template-columns: 1fr; } /* Stack inputs */
                }
            `}</style>
        </AnimatePresence>,
        document.body
    );
}