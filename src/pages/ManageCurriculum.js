import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, where, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import toast from 'react-hot-toast';
import { useInstitution } from '../contexts/InstitutionContext';

export default function ManageCurriculum({ instituteId }) {
    const { config } = useInstitution();
    const [departments, setDepartments] = useState([]);
    const [subjects, setSubjects] = useState([]);
    
    // Forms
    const [newDept, setNewDept] = useState('');
    const [newSubject, setNewSubject] = useState({ name: '', departmentId: '', year: '' });

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
        if (!newDept) return toast.error("Enter department name");
        try {
            await addDoc(collection(db, 'departments'), {
                name: newDept,
                instituteId,
                createdAt: serverTimestamp()
            });
            setNewDept('');
            toast.success("Department Added!");
        } catch (err) { toast.error(err.message); }
    };

    const handleAddSubject = async (e) => {
        e.preventDefault();
        if (!newSubject.name || !newSubject.departmentId || !newSubject.year) return toast.error("Fill all fields");
        try {
            await addDoc(collection(db, 'subjects'), {
                ...newSubject,
                instituteId,
                createdAt: serverTimestamp()
            });
            setNewSubject({ name: '', departmentId: '', year: '' });
            toast.success("Subject Added!");
        } catch (err) { toast.error(err.message); }
    };

    const handleDelete = async (collectionName, id) => {
        if(window.confirm(`Delete this ${collectionName.slice(0,-1)}?`)) {
            await deleteDoc(doc(db, collectionName, id));
            toast.success("Deleted successfully");
        }
    }

    return (
        <div className="content-section">
            <h2 className="content-title">Manage Curriculum</h2>
            <p className="content-subtitle">Define the departments and subjects for your college.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '20px' }}>
                {/* DEPARTMENTS CARD */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>1. Departments</h3>
                    <form onSubmit={handleAddDepartment} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                        <input className="prof-input" value={newDept} onChange={e => setNewDept(e.target.value)} placeholder="e.g. Agronomy" required />
                        <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0 20px', height: 'auto' }}>Add</button>
                    </form>
                    <ul style={{ listStyle: 'none', padding: 0 }}>
                        {departments.map(dept => (
                            <li key={dept.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px', background: '#f8fafc', marginBottom: '8px', borderRadius: '8px' }}>
                                <strong>{dept.name}</strong>
                                <i className="fas fa-trash" style={{ color: '#ef4444', cursor: 'pointer' }} onClick={() => handleDelete('departments', dept.id)}></i>
                            </li>
                        ))}
                    </ul>
                </div>

                {/* SUBJECTS CARD */}
                <div className="card" style={{ padding: '20px' }}>
                    <h3 style={{ borderBottom: '1px solid #eee', paddingBottom: '10px', marginBottom: '15px' }}>2. Subjects</h3>
                    <form onSubmit={handleAddSubject} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                        <select className="prof-input" value={newSubject.departmentId} onChange={e => setNewSubject({...newSubject, departmentId: e.target.value})} required>
                            <option value="">Select Department...</option>
                            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                        </select>
                        
                        {/* DYNAMIC YEARS FROM CONFIG */}
                        <select className="prof-input" value={newSubject.year} onChange={e => setNewSubject({...newSubject, year: e.target.value})} required>
                            <option value="">Select Year...</option>
                            {config?.academicYears?.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>

                        <input className="prof-input" value={newSubject.name} onChange={e => setNewSubject({...newSubject, name: e.target.value})} placeholder="Subject Name (e.g. Soil Science)" required />
                        <button type="submit" className="btn-primary" style={{ height: '40px' }}>Add Subject</button>
                    </form>

                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {subjects.map(sub => (
                            <div key={sub.id} style={{ padding: '10px', background: '#f0fdf4', marginBottom: '8px', borderRadius: '8px', borderLeft: '4px solid #22c55e', display: 'flex', justifyContent: 'space-between' }}>
                                <div>
                                    <strong>{sub.name}</strong> <br/>
                                    <small style={{ color: '#64748b' }}>{departments.find(d => d.id === sub.departmentId)?.name} • {sub.year}</small>
                                </div>
                                <i className="fas fa-trash" style={{ color: '#ef4444', cursor: 'pointer' }} onClick={() => handleDelete('subjects', sub.id)}></i>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}