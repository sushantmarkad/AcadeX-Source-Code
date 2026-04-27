import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { useInstitution } from '../contexts/InstitutionContext';
import { createPortal } from 'react-dom';

// Helper function to dynamically generate academic year labels
const generateYearLabels = (duration, isEngg) => {
    const numYears = duration || 4; // Default to 4 if not specified
    
    if (isEngg) {
        const engg = ['FE', 'SE', 'TE', 'BE', 'Year 5', 'Year 6'];
        return engg.slice(0, numYears);
    }

    const general = ['FY', 'SY', 'TY', 'Fourth Year', 'Fifth Year', 'Sixth Year'];
    let result = general.slice(0, numYears);
    
    // For a standard 4-year non-engg course, call the last one 'Final Year' to match your old format
    if (numYears === 4) {
        result[3] = 'Final Year';
    } else if (numYears > 4) {
        result[numYears - 1] += ' (Final Year)';
    }
    
    return result;
};

export default function ManageCurriculum({ instituteId }) {
    const { config } = useInstitution();
    const [departments, setDepartments] = useState([]); // This holds our Courses/Programs
    const [subjects, setSubjects] = useState([]);
    
    // Form States
    const [newSubject, setNewSubject] = useState({ 
        name: '', 
        departmentId: '', 
        year: '', 
        academicYear: '2024-2025' 
    });
    const [editingSubject, setEditingSubject] = useState(null);

    const [deleteModal, setDeleteModal] = useState({ isOpen: false, collectionName: '', id: '', itemName: '' });

    const ACADEMIC_YEARS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];
    
    // Dynamic naming
    const isPharmacy = config?.domain === 'PHARMACY';
    const isEngg = config?.domain === 'ENGINEERING';
    const hierarchyLabel = isPharmacy ? "Program" : "Department";
    const levelNomenclature = config?.academicConfig?.levelNomenclature || (isEngg ? 'Class' : 'Year');

    // Fetch Data
    useEffect(() => {
        if (!instituteId) return;
        
        // Fetch Courses/Programs
        const qDept = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
        const unsubDept = onSnapshot(qDept, snap => setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        // Fetch Subjects
        const qSubj = query(collection(db, 'subjects'), where('instituteId', '==', instituteId));
        const unsubSubj = onSnapshot(qSubj, snap => setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { unsubDept(); unsubSubj(); };
    }, [instituteId]);

    const handleAddOrUpdateSubject = async (e) => {
        e.preventDefault();
        const target = editingSubject || newSubject;

        if (!target.name.trim() || !target.departmentId || !target.year || !target.academicYear) {
            return toast.error("Please fill all fields");
        }
        
        try {
            if (editingSubject) {
                await updateDoc(doc(db, 'subjects', editingSubject.id), {
                    name: editingSubject.name.trim(),
                    departmentId: editingSubject.departmentId,
                    year: editingSubject.year,
                    academicYear: editingSubject.academicYear
                });
                setEditingSubject(null);
                toast.success("Subject Updated!");
            } else {
                await addDoc(collection(db, 'subjects'), {
                    ...newSubject,
                    name: newSubject.name.trim(),
                    instituteId,
                    createdAt: serverTimestamp()
                });
                setNewSubject({ ...newSubject, name: '' }); 
                toast.success("Subject Added!");
            }
        } catch (err) { 
            toast.error(err.message); 
        }
    };

    // MODAL TRIGGERS
    const initiateDelete = (collectionName, id, itemName) => {
        setDeleteModal({ isOpen: true, collectionName, id, itemName });
    };

    const confirmDelete = async () => {
        const { collectionName, id } = deleteModal;
        try {
            await deleteDoc(doc(db, collectionName, id));
            toast.success("Deleted successfully");
            setDeleteModal({ isOpen: false, collectionName: '', id: '', itemName: '' });
        } catch (err) { 
            toast.error("Failed to delete"); 
        }
    };

    // --- DYNAMIC YEAR DROPDOWN LOGIC ---
    // Get the currently selected course's ID
    const currentDeptId = editingSubject ? editingSubject.departmentId : newSubject.departmentId;
    // Find the course object in our fetched list
    const selectedDept = departments.find(d => d.id === currentDeptId);
    // Generate the exact number of years based on that course's duration
    const availableYears = selectedDept ? generateYearLabels(selectedDept.durationInYears, isEngg) : [];

    return (
        <div className="content-section fade-in" style={{ position: 'relative' }}>
            <div className="curr-header">
                <div>
                    <h2 className="content-title">Manage Subjects</h2>
                    <p className="content-subtitle">Define the subjects for your specific {hierarchyLabel.toLowerCase()}s and years.</p>
                </div>
                <div className="curr-icon-box">
                    <i className="fas fa-book-open"></i>
                </div>
            </div>

            <div className="curr-grid" style={{ gridTemplateColumns: '1fr', maxWidth: '800px', margin: '0 auto' }}>
                
                {/* SUBJECTS CARD */}
                <div className="curr-card">
                    <div className="curr-card-header">
                        <div className="curr-card-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            <i className="fas fa-book"></i>
                        </div>
                        <h3>Add/Edit Subjects</h3>
                    </div>

                    <form onSubmit={handleAddOrUpdateSubject} className="curr-form-col" style={{ background: editingSubject ? '#fefce8' : 'transparent', padding: editingSubject ? '15px' : '0', borderRadius: '12px', border: editingSubject ? '1px dashed #eab308' : 'none' }}>
                        
                        {editingSubject && <div style={{ fontSize: '13px', color: '#a16207', fontWeight: 'bold', marginBottom: '5px' }}><i className="fas fa-pen"></i> Editing Subject</div>}
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {/* 1. SELECT COURSE / PROGRAM */}
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' }}>Select {hierarchyLabel}</label>
                                <select 
                                    className="curr-input" 
                                    value={currentDeptId} 
                                    onChange={e => {
                                        if(editingSubject) {
                                            setEditingSubject({...editingSubject, departmentId: e.target.value, year: ''}) // Reset year on course change
                                        } else {
                                            setNewSubject({...newSubject, departmentId: e.target.value, year: ''}) // Reset year on course change
                                        }
                                    }} 
                                    required
                                >
                                    <option value="">-- Choose {hierarchyLabel} --</option>
                                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.durationInYears || 4} Yrs)</option>)}
                                </select>
                            </div>
                            
                            {/* 2. SELECT ACADEMIC YEAR (e.g. 2024-2025) */}
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' }}>Academic Session</label>
                                <select 
                                    className="curr-input" 
                                    value={editingSubject ? editingSubject.academicYear : newSubject.academicYear} 
                                    onChange={e => editingSubject ? setEditingSubject({...editingSubject, academicYear: e.target.value}) : setNewSubject({...newSubject, academicYear: e.target.value})} 
                                    required
                                >
                                    <option value="">-- Calendar Year --</option>
                                    {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                            {/* 3. DYNAMIC YEAR SELECTION (Only shows after course is selected) */}
                            <div style={{ flex: 1 }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' }}>Select {levelNomenclature}</label>
                                <select 
                                    className="curr-input" 
                                    value={editingSubject ? editingSubject.year : newSubject.year} 
                                    onChange={e => editingSubject ? setEditingSubject({...editingSubject, year: e.target.value}) : setNewSubject({...newSubject, year: e.target.value})} 
                                    required
                                    disabled={!currentDeptId} // Disabled until course is chosen
                                    style={{ opacity: !currentDeptId ? 0.6 : 1, cursor: !currentDeptId ? 'not-allowed' : 'pointer' }}
                                >
                                    <option value="">{currentDeptId ? `-- Choose ${levelNomenclature} --` : `Select ${hierarchyLabel} first`}</option>
                                    {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                                </select>
                            </div>

                            {/* 4. SUBJECT NAME */}
                            <div style={{ flex: 2 }}>
                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#64748b', marginBottom: '5px', display: 'block' }}>Subject Name</label>
                                <input 
                                    className="curr-input" 
                                    value={editingSubject ? editingSubject.name : newSubject.name} 
                                    onChange={e => editingSubject ? setEditingSubject({...editingSubject, name: e.target.value}) : setNewSubject({...newSubject, name: e.target.value})} 
                                    placeholder="e.g. Human Anatomy, Soil Science" 
                                    required 
                                />
                            </div>
                        </div>
                        
                        <div style={{display: 'flex', gap: '10px', marginTop: '10px'}}>
                            <button type="submit" className="curr-btn curr-btn-green" style={{flex: 1}}>
                                {editingSubject ? 'Update Subject' : 'Add Subject'}
                            </button>
                            {editingSubject && (
                                <button type="button" onClick={() => setEditingSubject(null)} className="curr-btn" style={{background: '#f1f5f9', color: '#475569'}}>
                                    Cancel
                                </button>
                            )}
                        </div>
                    </form>

                    <div className="curr-list-container scrollable-list" style={{ marginTop: '30px' }}>
                        {subjects.length === 0 ? (
                            <p className="curr-empty">No subjects added yet.</p>
                        ) : (
                            // Group subjects by Department/Course to make the UI look clean
                            departments.map(dept => {
                                const deptSubjects = subjects.filter(sub => sub.departmentId === dept.id);
                                if (deptSubjects.length === 0) return null;
                                
                                return (
                                    <div key={dept.id} style={{ marginBottom: '20px' }}>
                                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '10px', borderBottom: '1px solid #e2e8f0', paddingBottom: '5px' }}>
                                            {dept.name}
                                        </div>
                                        {deptSubjects.sort((a,b) => a.year.localeCompare(b.year)).map(sub => (
                                            <div key={sub.id} className="curr-list-item curr-subject-item">
                                                <div className="curr-subject-info">
                                                    <strong style={{ color: '#1e293b', fontSize: '14px' }}>{sub.name}</strong>
                                                    <span className="curr-subject-meta">
                                                        {sub.year} • {sub.academicYear}
                                                    </span>
                                                </div>
                                                <div style={{display: 'flex', gap: '5px'}}>
                                                    <button onClick={() => setEditingSubject(sub)} className="curr-action-btn edit-btn" title="Edit Subject">
                                                        <i className="fas fa-pen"></i>
                                                    </button>
                                                    <button onClick={() => initiateDelete('subjects', sub.id, sub.name)} className="curr-action-btn delete-btn" title="Delete Subject">
                                                        <i className="fas fa-trash-alt"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>

            {/* DELETE MODAL USING PORTAL */}
            {deleteModal.isOpen && createPortal(
                <div className="curr-modal-overlay" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}>
                    <div className="curr-modal-content" onClick={e => e.stopPropagation()}>
                        <div className="curr-modal-icon">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <h3>Confirm Deletion</h3>
                        <p>
                            Are you sure you want to delete <strong>{deleteModal.itemName}</strong>? 
                            This action cannot be undone.
                        </p>
                        <div className="curr-modal-actions">
                            <button className="curr-modal-btn cancel" onClick={() => setDeleteModal({ ...deleteModal, isOpen: false })}>
                                Cancel
                            </button>
                            <button className="curr-modal-btn confirm" onClick={confirmDelete}>
                                Delete
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            <style>{`
                /* Keep the exact same CSS as your original file here */
                .curr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .curr-icon-box { width: 48px; height: 48px; background: white; border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 20px; color: #3b82f6; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                .curr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
                .curr-card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; display: flex; flex-direction: column; }
                .curr-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
                .curr-card-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #1e293b; }
                .curr-card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; justify-content: center; align-items: center; font-size: 16px; }
                .curr-input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; background: #f8fafc; font-size: 14px; color: #334155; transition: all 0.2s; outline: none; box-sizing: border-box; }
                .curr-input:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
                .curr-btn { padding: 12px 20px; border-radius: 12px; border: none; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; color: white; display: flex; justify-content: center; align-items: center; }
                .curr-btn:active { transform: scale(0.98); }
                .curr-btn-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 10px rgba(37,99,235,0.2); }
                .curr-btn-green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 4px 10px rgba(16,185,129,0.2); }
                .curr-form-row { display: flex; gap: 12px; margin-bottom: 20px; }
                .curr-form-col { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
                .curr-list-container { flex: 1; overflow-y: auto; max-height: 500px; padding-right: 5px; }
                .curr-list-container::-webkit-scrollbar { width: 6px; }
                .curr-list-container::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
                .curr-empty { text-align: center; color: #94a3b8; font-size: 13px; font-style: italic; padding: 20px 0; }
                .curr-list-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 10px; transition: all 0.2s; }
                .scrollable-list { overflow-y: auto; max-height: 400px; padding-right: 8px; }
                .scrollable-list::-webkit-scrollbar { width: 6px; }
                .scrollable-list::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
                .curr-action-btn { width: 32px; height: 32px; border-radius: 8px; display: flex; justify-content: center; align-items: center; cursor: pointer; border: none; transition: 0.2s; }
                .edit-btn { background: #fefce8; color: #ca8a04; }
                .edit-btn:hover { background: #fef08a; }
                .delete-btn { background: #fee2e2; color: #ef4444; }
                .delete-btn:hover { background: #fecaca; }
                .curr-item-text { font-weight: 600; color: #334155; font-size: 14px; }
                .curr-subject-item { flex-direction: row; align-items: center; border-left: 4px solid #10b981; }
                .curr-subject-info { display: flex; flex-direction: column; gap: 4px; }
                .curr-subject-meta { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; display: inline-block; width: fit-content; font-weight: bold; }
                
               .curr-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.5); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 999999 !important; animation: fadeIn 0.2s ease-out; }
                .curr-modal-content { background: white; padding: 30px; border-radius: 20px; width: 90%; max-width: 400px; text-align: center; box-shadow: 0 20px 40px -10px rgba(0,0,0,0.2); animation: scaleUp 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .curr-modal-icon { width: 60px; height: 60px; background: #fef2f2; color: #ef4444; font-size: 24px; border-radius: 50%; display: flex; justify-content: center; align-items: center; margin: 0 auto 20px; }
                .curr-modal-content h3 { margin: 0 0 10px 0; color: #1e293b; font-size: 20px; font-weight: 800; }
                .curr-modal-content p { margin: 0 0 25px 0; color: #64748b; font-size: 15px; line-height: 1.5; }
                .curr-modal-actions { display: flex; gap: 15px; }
                .curr-modal-btn { flex: 1; padding: 12px; border-radius: 12px; font-size: 15px; font-weight: bold; cursor: pointer; border: none; transition: all 0.2s; }
                .curr-modal-btn.cancel { background: #f1f5f9; color: #475569; }
                .curr-modal-btn.cancel:hover { background: #e2e8f0; }
                .curr-modal-btn.confirm { background: #ef4444; color: white; box-shadow: 0 4px 10px rgba(239, 68, 68, 0.2); }
                .curr-modal-btn.confirm:hover { background: #dc2626; transform: translateY(-2px); }
                
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes scaleUp { from { opacity: 0; transform: scale(0.9) translateY(20px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            `}</style>
        </div>
    );
}