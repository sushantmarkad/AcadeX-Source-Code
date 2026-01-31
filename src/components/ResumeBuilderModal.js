import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { auth } from '../firebase';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function ResumeBuilderModal({ isOpen, onClose, user }) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        skills: user?.resumeData?.skills || [],
        experience: user?.resumeData?.experience || '',
        projects: user?.resumeData?.projects || []
    });
    const [newSkill, setNewSkill] = useState('');
    const [newProject, setNewProject] = useState({ title: '', desc: '' });

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
            // Removed any XP gain logic here
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
                    initial={{ y: 50, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 50, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="rb-header">
                        <h2><i className="fas fa-file-alt"></i> Resume Builder</h2>
                        <button onClick={onClose} className="rb-close"><i className="fas fa-times"></i></button>
                    </div>

                    {/* Content */}
                    <div className="rb-content">
                        {/* Skills Section */}
                        <div className="rb-section">
                            <label>Core Skills</label>
                            <div className="rb-input-row">
                                <input 
                                    placeholder="Add a skill (e.g. Python)" 
                                    value={newSkill} 
                                    onChange={e => setNewSkill(e.target.value)}
                                    className="rb-input"
                                />
                                <button onClick={() => {
                                    if (newSkill.trim() && !formData.skills.includes(newSkill)) {
                                        setFormData(prev => ({ ...prev, skills: [...prev.skills, newSkill] }));
                                        setNewSkill('');
                                    }
                                }} className="rb-add-btn">Add</button>
                            </div>
                            <div className="rb-tags">
                                {formData.skills.map(s => (
                                    <span key={s} className="rb-tag">
                                        {s} <i className="fas fa-times" onClick={() => setFormData(p => ({...p, skills: p.skills.filter(i => i!==s)}))}></i>
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* Summary Section */}
                        <div className="rb-section">
                            <label>Professional Summary</label>
                            <textarea 
                                rows="3" 
                                placeholder="Briefly describe your career goals..."
                                value={formData.experience}
                                onChange={e => setFormData({ ...formData, experience: e.target.value })}
                                className="rb-textarea"
                            />
                        </div>

                        {/* Projects Section */}
                        <div className="rb-section">
                            <label>Projects</label>
                            <div className="rb-project-form">
                                <input 
                                    placeholder="Project Title" 
                                    value={newProject.title} 
                                    onChange={e => setNewProject({...newProject, title: e.target.value})}
                                    className="rb-input" style={{marginBottom:'10px'}}
                                />
                                <textarea 
                                    placeholder="Project Description..." 
                                    value={newProject.desc} 
                                    onChange={e => setNewProject({...newProject, desc: e.target.value})}
                                    className="rb-textarea" style={{marginBottom:'10px'}}
                                />
                                <button onClick={() => {
                                    if (newProject.title) {
                                        setFormData(p => ({ ...p, projects: [...p.projects, newProject] }));
                                        setNewProject({ title: '', desc: '' });
                                    }
                                }} className="rb-dashed-btn">+ Add Project</button>
                            </div>

                            <div className="rb-project-list">
                                {formData.projects.map((p, i) => (
                                    <div key={i} className="rb-project-card">
                                        <div>
                                            <h4>{p.title}</h4>
                                            <p>{p.desc}</p>
                                        </div>
                                        <button onClick={() => setFormData(pr => ({...pr, projects: pr.projects.filter((_, idx) => idx !== i)}))} className="rb-del-btn"><i className="fas fa-trash"></i></button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="rb-footer">
                        <button onClick={onClose} className="rb-btn-cancel">Cancel</button>
                        <button onClick={handleSave} disabled={loading} className="rb-btn-save">
                            {loading ? 'Saving...' : 'Save Resume'}
                        </button>
                    </div>
                </motion.div>
            </div>

            <style>{`
                .rb-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(0,0,0,0.5); backdrop-filter: blur(5px);
                    z-index: 10000; display: flex; justify-content: center; align-items: center;
                }
                .rb-modal {
                    width: 90%; max-width: 600px; max-height: 85vh; background: white;
                    border-radius: 20px; display: flex; flex-direction: column;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.2); overflow: hidden;
                }
                .rb-header {
                    padding: 20px 25px; background: white; border-bottom: 1px solid #f1f5f9;
                    display: flex; justify-content: space-between; align-items: center;
                }
                .rb-header h2 { margin: 0; font-size: 18px; color: #1e293b; display: flex; align-items: center; gap: 10px; }
                .rb-header h2 i { color: #3b82f6; }
                .rb-close { background: none; border: none; font-size: 18px; color: #94a3b8; cursor: pointer; }

                .rb-content { padding: 25px; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 25px; }
                
                .rb-section label { display: block; font-size: 12px; font-weight: 700; color: #64748b; margin-bottom: 8px; text-transform: uppercase; }
                
                .rb-input, .rb-textarea {
                    width: 100%; padding: 12px; border: 2px solid #f1f5f9; border-radius: 10px;
                    font-size: 14px; background: #f8fafc; outline: none; transition: all 0.2s; box-sizing: border-box;
                }
                .rb-input:focus, .rb-textarea:focus { border-color: #3b82f6; background: white; }
                
                .rb-input-row { display: flex; gap: 10px; }
                .rb-add-btn { background: #3b82f6; color: white; border: none; padding: 0 20px; border-radius: 10px; font-weight: 600; cursor: pointer; }
                
                .rb-tags { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
                .rb-tag { background: #eff6ff; color: #2563eb; padding: 6px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; display: flex; alignItems: center; gap: 6px; }
                .rb-tag i { cursor: pointer; opacity: 0.6; } .rb-tag i:hover { opacity: 1; }

                .rb-project-form { background: #f8fafc; padding: 15px; border-radius: 12px; border: 1px dashed #cbd5e1; }
                .rb-dashed-btn { width: 100%; padding: 10px; border: 2px dashed #cbd5e1; background: white; color: #64748b; border-radius: 8px; cursor: pointer; font-weight: 600; }
                .rb-dashed-btn:hover { border-color: #3b82f6; color: #3b82f6; }

                .rb-project-list { display: flex; flex-direction: column; gap: 10px; margin-top: 15px; }
                .rb-project-card { background: white; border: 1px solid #f1f5f9; padding: 15px; border-radius: 10px; display: flex; justify-content: space-between; }
                .rb-project-card h4 { margin: 0 0 5px 0; font-size: 14px; color: #1e293b; }
                .rb-project-card p { margin: 0; font-size: 12px; color: #64748b; }
                .rb-del-btn { background: none; border: none; color: #ef4444; cursor: pointer; opacity: 0.5; } .rb-del-btn:hover { opacity: 1; }

                .rb-footer { padding: 20px; border-top: 1px solid #f1f5f9; display: flex; justify-content: flex-end; gap: 10px; }
                .rb-btn-cancel { padding: 10px 20px; border: 1px solid #e2e8f0; background: white; color: #64748b; border-radius: 10px; cursor: pointer; font-weight: 600; }
                .rb-btn-save { padding: 10px 24px; border: none; background: #3b82f6; color: white; border-radius: 10px; cursor: pointer; font-weight: 600; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3); }
            `}</style>
        </AnimatePresence>,
        document.body
    );
}