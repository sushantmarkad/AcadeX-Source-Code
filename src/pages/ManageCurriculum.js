import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { useInstitution } from '../contexts/InstitutionContext';

export default function ManageCurriculum({ instituteId }) {
    const { config } = useInstitution();
    const [departments, setDepartments] = useState([]);
    const [subjects, setSubjects] = useState([]);
    
    // Form States
    const [newDept, setNewDept] = useState('');
    const [newSubject, setNewSubject] = useState({ 
        name: '', 
        departmentId: '', 
        year: '', // This is the Class (e.g., First Year, FE)
        academicYear: '2024-2025' // Default Calendar Year
    });

    const ACADEMIC_YEARS = ['2023-2024', '2024-2025', '2025-2026', '2026-2027'];
    
    // ✅ FIX: Safe fallback if the college was created before we added the rules!
    const classLevels = config?.academicYears || (config?.domain === 'AGRICULTURE' 
        ? ['First Year', 'Second Year', 'Third Year', 'Fourth Year'] 
        : ['FE', 'SE', 'TE', 'BE']);

    // Fetch Data
    useEffect(() => {
        if (!instituteId) return;
        
        const qDept = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
        const unsubDept = onSnapshot(qDept, snap => setDepartments(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        const qSubj = query(collection(db, 'subjects'), where('instituteId', '==', instituteId));
        const unsubSubj = onSnapshot(qSubj, snap => setSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

        return () => { unsubDept(); unsubSubj(); };
    }, [instituteId]);

    const handleAddDepartment = async (e) => {
        e.preventDefault();
        if (!newDept.trim()) return toast.error("Enter department name");
        try {
            await addDoc(collection(db, 'departments'), {
                name: newDept.trim(),
                instituteId,
                createdAt: serverTimestamp()
            });
            setNewDept('');
            toast.success("Department Added!");
        } catch (err) { toast.error(err.message); }
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();
        if (!newSubject.name.trim() || !newSubject.departmentId || !newSubject.year || !newSubject.academicYear) {
            return toast.error("Please fill all fields");
        }
        try {
            await addDoc(collection(db, 'subjects'), {
                ...newSubject,
                name: newSubject.name.trim(),
                instituteId,
                createdAt: serverTimestamp()
            });
            setNewSubject({ ...newSubject, name: '' }); // Keep dropdowns selected, clear text
            toast.success("Subject Added!");
        } catch (err) { toast.error(err.message); }
    };

    const handleDelete = async (collectionName, id) => {
        if(window.confirm(`Are you sure you want to delete this ${collectionName === 'departments' ? 'department' : 'subject'}?`)) {
            try {
                await deleteDoc(doc(db, collectionName, id));
                toast.success("Deleted successfully");
            } catch (err) { toast.error("Failed to delete"); }
        }
    }

    return (
        <div className="content-section fade-in">
            <div className="curr-header">
                <div>
                    <h2 className="content-title">Manage Curriculum</h2>
                    <p className="content-subtitle">Define the departments and subjects for your institution.</p>
                </div>
                <div className="curr-icon-box">
                    <i className="fas fa-book-open"></i>
                </div>
            </div>

            <div className="curr-grid">
                {/* DEPARTMENTS CARD */}
                <div className="curr-card">
                    <div className="curr-card-header">
                        <div className="curr-card-icon" style={{ background: '#eff6ff', color: '#3b82f6' }}>
                            <i className="fas fa-building"></i>
                        </div>
                        <h3>1. Departments</h3>
                    </div>
                    
                    <form onSubmit={handleAddDepartment} className="curr-form-row">
                        <input 
                            className="curr-input" 
                            value={newDept} 
                            onChange={e => setNewDept(e.target.value)} 
                            placeholder="e.g. Agronomy, Computer Science" 
                            required 
                        />
                        <button type="submit" className="curr-btn curr-btn-blue">Add</button>
                    </form>

                    <div className="curr-list-container">
                        {departments.length === 0 ? (
                            <p className="curr-empty">No departments added yet.</p>
                        ) : (
                            departments.map(dept => (
                                <div key={dept.id} className="curr-list-item">
                                    <span className="curr-item-text">{dept.name}</span>
                                    <button onClick={() => handleDelete('departments', dept.id)} className="curr-delete-btn" title="Delete Department">
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* SUBJECTS CARD */}
                <div className="curr-card">
                    <div className="curr-card-header">
                        <div className="curr-card-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}>
                            <i className="fas fa-book"></i>
                        </div>
                        <h3>2. Subjects</h3>
                    </div>

                    <form onSubmit={handleAddSubject} className="curr-form-col">
                        <select 
                            className="curr-input" 
                            value={newSubject.departmentId} 
                            onChange={e => setNewSubject({...newSubject, departmentId: e.target.value})} 
                            required
                        >
                            <option value="">-- Select Department --</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            {/* ✅ FIX: Now perfectly uses the classLevels fallback array! */}
                            <select 
                                className="curr-input" 
                                value={newSubject.year} 
                                onChange={e => setNewSubject({...newSubject, year: e.target.value})} 
                                required
                            >
                                <option value="">-- Select Class --</option>
                                {classLevels.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>

                            <select 
                                className="curr-input" 
                                value={newSubject.academicYear} 
                                onChange={e => setNewSubject({...newSubject, academicYear: e.target.value})} 
                                required
                            >
                                <option value="">-- Calendar Year --</option>
                                {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        <input 
                            className="curr-input" 
                            value={newSubject.name} 
                            onChange={e => setNewSubject({...newSubject, name: e.target.value})} 
                            placeholder="Subject Name (e.g. Soil Science)" 
                            required 
                        />
                        <button type="submit" className="curr-btn curr-btn-green">Add Subject</button>
                    </form>

                    <div className="curr-list-container">
                        {subjects.length === 0 ? (
                            <p className="curr-empty">No subjects added yet.</p>
                        ) : (
                            subjects.map(sub => (
                                <div key={sub.id} className="curr-list-item curr-subject-item">
                                    <div className="curr-subject-info">
                                        <strong style={{ color: '#1e293b', fontSize: '14px' }}>{sub.name}</strong>
                                        <span className="curr-subject-meta">
                                            {departments.find(d => d.id === sub.departmentId)?.name || 'Unknown'} • {sub.year} • {sub.academicYear}
                                        </span>
                                    </div>
                                    <button onClick={() => handleDelete('subjects', sub.id)} className="curr-delete-btn" title="Delete Subject">
                                        <i className="fas fa-trash-alt"></i>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                .curr-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
                .curr-icon-box { width: 48px; height: 48px; background: white; border-radius: 12px; display: flex; justify-content: center; align-items: center; font-size: 20px; color: #3b82f6; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
                .curr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; }
                .curr-card { background: white; border-radius: 20px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.05); border: 1px solid #f1f5f9; display: flex; flex-direction: column; }
                .curr-card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; border-bottom: 1px solid #f1f5f9; padding-bottom: 15px; }
                .curr-card-header h3 { margin: 0; font-size: 18px; font-weight: 700; color: #1e293b; }
                .curr-card-icon { width: 36px; height: 36px; border-radius: 10px; display: flex; justify-content: center; align-items: center; font-size: 16px; }
                .curr-input { width: 100%; padding: 12px 16px; border: 2px solid #e2e8f0; border-radius: 12px; background: #f8fafc; font-size: 14px; color: #334155; transition: all 0.2s; outline: none; }
                .curr-input:focus { border-color: #3b82f6; background: white; box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1); }
                .curr-btn { padding: 12px 20px; border-radius: 12px; border: none; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; color: white; display: flex; justify-content: center; align-items: center; }
                .curr-btn:active { transform: scale(0.98); }
                .curr-btn-blue { background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); box-shadow: 0 4px 10px rgba(37,99,235,0.2); }
                .curr-btn-green { background: linear-gradient(135deg, #10b981 0%, #059669 100%); box-shadow: 0 4px 10px rgba(16,185,129,0.2); }
                .curr-form-row { display: flex; gap: 12px; margin-bottom: 20px; }
                .curr-form-col { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
                .curr-list-container { flex: 1; overflow-y: auto; max-height: 350px; padding-right: 5px; }
                .curr-list-container::-webkit-scrollbar { width: 6px; }
                .curr-list-container::-webkit-scrollbar-thumb { background-color: #cbd5e1; border-radius: 10px; }
                .curr-empty { text-align: center; color: #94a3b8; font-size: 13px; font-style: italic; padding: 20px 0; }
                .curr-list-item { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; margin-bottom: 10px; transition: all 0.2s; }
                .curr-item-text { font-weight: 600; color: #334155; font-size: 14px; }
                .curr-subject-item { flex-direction: row; align-items: center; border-left: 4px solid #10b981; }
                .curr-subject-info { display: flex; flex-direction: column; gap: 4px; }
                .curr-subject-meta { font-size: 11px; color: #64748b; background: #f1f5f9; padding: 2px 8px; border-radius: 6px; display: inline-block; width: fit-content; font-weight: bold; }
                .curr-delete-btn { background: #fee2e2; color: #ef4444; border: none; width: 32px; height: 32px; border-radius: 8px; display: flex; justify-content: center; align-items: center; cursor: pointer; }
            `}</style>
        </div>
    );
}