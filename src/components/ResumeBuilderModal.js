import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { auth } from '../firebase';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function ResumeBuilderModal({ isOpen, onClose, user }) {
    const [loading, setLoading] = useState(false);
    
    // Form State
    const [formData, setFormData] = useState({
        skills: user?.resumeData?.skills || [],
        experience: user?.resumeData?.experience || '',
        projects: user?.resumeData?.projects || []
    });

    const [newSkill, setNewSkill] = useState('');
    const [newProject, setNewProject] = useState({ title: '', desc: '' });

    const addSkill = () => {
        if (newSkill.trim() && !formData.skills.includes(newSkill)) {
            setFormData(prev => ({ ...prev, skills: [...prev.skills, newSkill] }));
            setNewSkill('');
        }
    };

    const removeSkill = (skillToRemove) => {
        setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skillToRemove) }));
    };

    const addProject = () => {
        if (newProject.title && newProject.desc) {
            setFormData(prev => ({ ...prev, projects: [...prev.projects, newProject] }));
            setNewProject({ title: '', desc: '' });
        }
    };

    const removeProject = (index) => {
        setFormData(prev => ({ ...prev, projects: prev.projects.filter((_, i) => i !== index) }));
    };

    const handleSave = async () => {
        setLoading(true);
        const toastId = toast.loading("Saving Profile...");

        try {
            const token = await auth.currentUser.getIdToken();
            const res = await fetch(`${BACKEND_URL}/updateResume`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ resumeData: formData })
            });

            const data = await res.json();
            
            if (res.ok) {
                toast.success(data.message, { id: toastId });
                onClose();
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            toast.error(err.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                    zIndex: 999999,
                    background: 'rgba(15, 23, 42, 0.6)', 
                    backdropFilter: 'blur(12px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px'
                }}
                onClick={onClose}
            >
                <motion.div 
                    initial={{ scale: 0.95, y: 20, opacity: 0 }} 
                    animate={{ scale: 1, y: 0, opacity: 1 }} 
                    exit={{ scale: 0.95, y: 20, opacity: 0 }}
                    onClick={e => e.stopPropagation()}
                    className="card"
                    style={{ 
                        width: '100%', maxWidth: '700px', maxHeight:'85vh', 
                        overflowY:'auto', padding:'0', border:'none',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        background: '#ffffff'
                    }}
                >
                    {/* Header */}
                    <div style={{ 
                        background: 'linear-gradient(135deg, #4f46e5 0%, #3b82f6 100%)', 
                        padding: '30px', color: 'white', position: 'relative', overflow: 'hidden'
                    }}>
                        <div style={{ position: 'relative', zIndex: 2 }}>
                            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', display:'flex', alignItems:'center', gap:'10px' }}>
                                <i className="fas fa-briefcase"></i> Resume Builder
                            </h2>
                            <p style={{ margin: '5px 0 0 0', opacity: 0.9, fontSize:'14px' }}>
                                Build your professional profile to showcase your skills.
                            </p>
                        </div>
                    </div>

                    {/* Body */}
                    <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '30px' }}>
                        
                        {/* Section 1: Skills */}
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                                Core Skills
                            </label>
                            <div style={{ background: '#f8fafc', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
                                    <input 
                                        placeholder="Add a skill (e.g. ReactJS)" 
                                        value={newSkill} 
                                        onChange={e => setNewSkill(e.target.value)}
                                        onKeyPress={e => e.key === 'Enter' && addSkill()}
                                        style={{
                                            flex: 1, padding: '10px 14px', borderRadius: '8px', 
                                            border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none',
                                            transition: 'border-color 0.2s', background: 'white'
                                        }}
                                    />
                                    <button 
                                        onClick={addSkill} 
                                        style={{ 
                                            background: '#3b82f6', color: 'white', border: 'none', 
                                            padding: '0 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' 
                                        }}
                                    >
                                        Add
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    {formData.skills.length > 0 ? formData.skills.map(s => (
                                        <span key={s} style={{ 
                                            background: 'white', border:'1px solid #e2e8f0', color: '#334155', 
                                            padding: '6px 12px', borderRadius: '20px', fontSize: '13px', fontWeight: '600', 
                                            display:'flex', alignItems:'center', gap:'8px', boxShadow:'0 1px 2px rgba(0,0,0,0.05)'
                                        }}>
                                            {s} 
                                            <i className="fas fa-times" style={{cursor:'pointer', color:'#ef4444'}} onClick={() => removeSkill(s)}></i>
                                        </span>
                                    )) : <span style={{color:'#94a3b8', fontSize:'13px', fontStyle:'italic'}}>No skills added yet.</span>}
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Summary */}
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                                Professional Summary
                            </label>
                            <textarea 
                                rows="4" 
                                placeholder="Write a short bio about your career goals and key strengths..."
                                value={formData.experience}
                                onChange={e => setFormData({ ...formData, experience: e.target.value })}
                                style={{
                                    width: '100%', padding: '12px', borderRadius: '12px', 
                                    border: '1px solid #e2e8f0', fontSize: '14px', fontFamily: 'inherit',
                                    outline: 'none', background: '#f8fafc', resize: 'vertical'
                                }}
                            />
                        </div>

                        {/* Section 3: Projects */}
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '8px' }}>
                                Key Projects
                            </label>
                            
                            {/* Project List */}
                            <div style={{display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px'}}>
                                {formData.projects.map((p, i) => (
                                    <div key={i} style={{ 
                                        background: 'white', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0',
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'start',
                                        boxShadow: '0 2px 4px rgba(0,0,0,0.02)'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '15px' }}>{p.title}</div>
                                            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px', lineHeight: '1.4' }}>{p.desc}</div>
                                        </div>
                                        <button onClick={() => removeProject(i)} style={{color:'#94a3b8', background:'none', border:'none', cursor:'pointer', padding:'5px'}}>
                                            <i className="fas fa-trash hover-red"></i>
                                        </button>
                                    </div>
                                ))}
                            </div>

                            {/* Add New Project Form */}
                            <div style={{ background: '#f8fafc', padding: '20px', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                                <h5 style={{margin:'0 0 15px 0', color:'#64748b', fontSize:'12px', textTransform:'uppercase', letterSpacing:'0.5px', fontWeight:'700'}}>Add New Project</h5>
                                
                                <div style={{marginBottom:'12px'}}>
                                    <input 
                                        placeholder="Project Title" 
                                        value={newProject.title}
                                        onChange={e => setNewProject({...newProject, title: e.target.value})}
                                        style={{
                                            width: '100%', padding: '10px 12px', borderRadius: '8px', 
                                            border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none', background:'white'
                                        }}
                                    />
                                </div>
                                <div style={{marginBottom:'15px'}}>
                                    <textarea 
                                        rows="2" 
                                        placeholder="Description (Tech stack, features, role)" 
                                        value={newProject.desc}
                                        onChange={e => setNewProject({...newProject, desc: e.target.value})}
                                        style={{
                                            width: '100%', padding: '10px 12px', borderRadius: '8px', 
                                            border: '1px solid #cbd5e1', fontSize: '14px', fontFamily: 'inherit',
                                            outline: 'none', background:'white', minHeight:'60px'
                                        }}
                                    />
                                </div>
                                <button 
                                    onClick={addProject} 
                                    style={{ 
                                        width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                                        background: '#e0e7ff', color: '#4338ca', fontWeight: '600', 
                                        fontSize: '13px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                    }}
                                >
                                    <i className="fas fa-plus"></i> Add to List
                                </button>
                            </div>
                        </div>

                    </div>

                    {/* Footer Actions (Right Aligned) */}
                    <div style={{ 
                        display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '12px', 
                        padding: '20px 30px', borderTop: '1px solid #f1f5f9', background: '#fff',
                        borderBottomLeftRadius: '16px', borderBottomRightRadius: '16px'
                    }}>
                        <button 
                            onClick={onClose}
                            style={{ 
                                background: 'transparent', border: '1px solid #e2e8f0', color: '#64748b', 
                                padding: '10px 20px', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' 
                            }}
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave} 
                            disabled={loading} 
                            style={{ 
                                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', 
                                border: 'none', color: 'white', padding: '10px 24px', borderRadius: '8px', 
                                fontWeight: '600', cursor: 'pointer', boxShadow: '0 4px 6px -1px rgba(37, 99, 235, 0.3)'
                            }}
                        >
                            {loading ? 'Saving...' : 'Save & Update Profile'}
                        </button>
                    </div>

                </motion.div>
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}