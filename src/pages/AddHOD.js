import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { useInstitution } from '../contexts/InstitutionContext'; 

// ✅ Make sure this matches your deployed backend URL
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://acadex-backend-n2wh.onrender.com";

// Helper function to generate year labels based on course duration
const generateYearLabels = (duration, isEngg) => {
    const numYears = duration || 4;
    if (isEngg) {
        const engg = ['FE', 'SE', 'TE', 'BE', 'Year 5', 'Year 6'];
        return engg.slice(0, numYears);
    }
    const general = ['FY', 'SY', 'TY', 'Fourth Year', 'Fifth Year', 'Sixth Year'];
    let result = general.slice(0, numYears);
    if (numYears === 4) result[3] = 'Final Year';
    else if (numYears > 4) result[numYears - 1] += ' (Final Year)';
    return result;
};

export default function AddHOD({ instituteId, instituteName }) {
    const { config } = useInstitution();
    const isEngg = config?.domain === 'ENGINEERING';
    const isPharmacy = config?.domain === 'PHARMACY';
    const hierarchyLabel = isPharmacy ? "Program" : "Department";

    const [departments, setDepartments] = useState([]); // These are now Courses/Programs
    const [loading, setLoading] = useState(false);

    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        qualification: '',
        phone: ''
    });

    // ✅ THE NEW RBAC STATE: Array of Jurisdictions
    const [scopes, setScopes] = useState([
        { id: Date.now(), courseId: '', courseName: '', duration: 4, selectedYears: [] }
    ]);

    // Fetch Courses/Programs
    useEffect(() => {
        const fetchDepts = async () => {
            if (!instituteId) return;
            try {
                const q = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
                const snap = await getDocs(q);
                const deptList = snap.docs.map(d => ({
                    id: d.id,
                    name: d.data().name,
                    durationInYears: d.data().durationInYears || 4
                }));
                setDepartments(deptList.sort((a, b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error("Error fetching courses", err);
            }
        };
        fetchDepts();
    }, [instituteId]);

    // --- SCOPE MANAGEMENT LOGIC ---
    const addScope = () => {
        setScopes([...scopes, { id: Date.now(), courseId: '', courseName: '', duration: 4, selectedYears: [] }]);
    };

    const removeScope = (id) => {
        setScopes(scopes.filter(s => s.id !== id));
    };

    const handleCourseChange = (scopeId, courseId) => {
        const selectedCourse = departments.find(d => d.id === courseId);
        setScopes(scopes.map(s => {
            if (s.id === scopeId) {
                return {
                    ...s,
                    courseId: courseId,
                    courseName: selectedCourse ? selectedCourse.name : '',
                    duration: selectedCourse ? selectedCourse.durationInYears : 4,
                    selectedYears: [] // Reset years when course changes
                };
            }
            return s;
        }));
    };

    const toggleYear = (scopeId, yearStr) => {
        setScopes(scopes.map(s => {
            if (s.id === scopeId) {
                const isSelected = s.selectedYears.includes(yearStr);
                return {
                    ...s,
                    selectedYears: isSelected 
                        ? s.selectedYears.filter(y => y !== yearStr) 
                        : [...s.selectedYears, yearStr]
                };
            }
            return s;
        }));
    };

    const toggleAllYears = (scopeId, availableYears) => {
        setScopes(scopes.map(s => {
            if (s.id === scopeId) {
                const isAllSelected = s.selectedYears.length === availableYears.length;
                return { ...s, selectedYears: isAllSelected ? [] : [...availableYears] };
            }
            return s;
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation: Ensure valid scopes
        const validScopes = scopes.filter(s => s.courseId && s.selectedYears.length > 0);
        if (validScopes.length === 0) {
            return toast.error(`Please assign at least one ${hierarchyLabel} and Year.`);
        }

        setLoading(true);
        const toastId = toast.loading("Creating HOD Account...");

        try {
            // 1. Create User via Backend
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    firstName: form.firstName,
                    lastName: form.lastName,
                    email: form.email,
                    password: form.password,
                    role: 'hod',
                    instituteId,
                    instituteName,
                    
                    // ✅ We send the new Array instead of a single string
                    assignedScopes: validScopes.map(s => ({
                        courseId: s.courseId,
                        courseName: s.courseName,
                        years: s.selectedYears
                    })),
                    
                    phone: form.phone,
                    qualification: form.qualification,
                    extras: {
                        qualification: form.qualification,
                        phone: form.phone
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to create HOD");

            // 2. Trigger Email Notification
            try {
                await fetch(`${BACKEND_URL}/sendTeacherCredentials`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: form.email,
                        password: form.password,
                        firstName: form.firstName,
                        lastName: form.lastName,
                        role: 'hod',
                        // Just stringify the scope names for the email body to look clean
                        department: validScopes.map(s => s.courseName).join(', '),
                        academicYear: "2026-2027", 
                        assignedClasses: [] 
                    })
                });
                toast.success(`HOD Appointed & Email Sent!`, { id: toastId });
            } catch (emailErr) {
                console.error("Email failed", emailErr);
                toast.success(`HOD Appointed (Email Failed)`, { id: toastId });
            }

            // Reset Form
            setForm({ firstName: '', lastName: '', email: '', password: '', qualification: '', phone: '' });
            setScopes([{ id: Date.now(), courseId: '', courseName: '', duration: 4, selectedYears: [] }]);

        } catch (error) {
            console.error("Error adding HOD:", error);
            toast.error(error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <h2 className="content-title">Add Head of Department</h2>
            <p className="content-subtitle">Appoint an HOD and define their specific jurisdictions.</p>

            <div className="card fade-in-up" style={{
                background: 'white', borderRadius: '24px', border: 'none',
                boxShadow: '0 20px 50px -10px rgba(0,0,0,0.1)', overflow: 'visible',
                position: 'relative', maxWidth: '850px', padding: '0'
            }}>

                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    padding: '20px 25px', borderRadius: '24px 24px 0 0', position: 'relative', overflow: 'hidden'
                }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-user-shield"></i> HOD Profile Setup
                    </h3>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '80px', height: '80px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '25px' }}>

                    {/* --- SECTION 1: PERSONAL DETAILS --- */}
                    <div style={{ marginBottom: '30px' }}>
                        <h4 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '15px' }}>
                            Personal Details
                        </h4>
                        
                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
                            <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label>First Name</label>
                                <input type="text" required placeholder="e.g. Ramesh" value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label>Last Name</label>
                                <input type="text" required placeholder="e.g. Patil" value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
                            <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label>Email Address</label>
                                <input type="email" required placeholder="hod@college.edu" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label>Temporary Password</label>
                                <input type="password" required placeholder="******" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                            <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label>Qualification (Optional)</label>
                                <input type="text" placeholder="e.g. PhD, M.Tech" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
                            </div>
                            <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                                <label>Phone Number (Optional)</label>
                                <input type="tel" placeholder="+91 9876543210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                            </div>
                        </div>
                    </div>

                    {/* --- SECTION 2: JURISDICTION ASSIGNMENT --- */}
                    <div style={{ marginBottom: '30px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px', marginBottom: '15px' }}>
                            <h4 style={{ fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '1px', margin: 0 }}>
                                Assigned Jurisdictions
                            </h4>
                            <button type="button" onClick={addScope} style={{ background: '#ecfdf5', color: '#10b981', border: 'none', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>
                                <i className="fas fa-plus"></i> Add Scope
                            </button>
                        </div>

                        {scopes.map((scope, index) => {
                            const availableYears = scope.courseId ? generateYearLabels(scope.duration, isEngg) : [];
                            
                            return (
                                <div key={scope.id} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', marginBottom: '15px', position: 'relative' }}>
                                    
                                    {scopes.length > 1 && (
                                        <button type="button" onClick={() => removeScope(scope.id)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#fee2e2', color: '#ef4444', border: 'none', width: '28px', height: '28px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <i className="fas fa-times"></i>
                                        </button>
                                    )}

                                    <div className="input-group" style={{ marginBottom: '15px', width: scopes.length > 1 ? 'calc(100% - 40px)' : '100%' }}>
                                        <label>Select {hierarchyLabel}</label>
                                        <select 
                                            value={scope.courseId}
                                            onChange={(e) => handleCourseChange(scope.id, e.target.value)}
                                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '2px solid #cbd5e1', fontSize: '14px', color: '#1e293b' }}
                                        >
                                            <option value="">-- Choose {hierarchyLabel} --</option>
                                            {departments.map(d => (
                                                <option key={d.id} value={d.id}>{d.name} ({d.durationInYears} Yrs)</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* YEAR CHECKBOXES */}
                                    {scope.courseId && (
                                        <div>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                                <label style={{ fontSize: '12px', fontWeight: 'bold', color: '#475569' }}>Allowed Years</label>
                                                <span onClick={() => toggleAllYears(scope.id, availableYears)} style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 'bold', cursor: 'pointer' }}>
                                                    {scope.selectedYears.length === availableYears.length ? 'Deselect All' : 'Select All'}
                                                </span>
                                            </div>
                                            
                                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                                {availableYears.map(yr => {
                                                    const isChecked = scope.selectedYears.includes(yr);
                                                    return (
                                                        <div 
                                                            key={yr} 
                                                            onClick={() => toggleYear(scope.id, yr)}
                                                            style={{ 
                                                                padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', transition: '0.2s',
                                                                background: isChecked ? '#3b82f6' : 'white',
                                                                color: isChecked ? 'white' : '#64748b',
                                                                border: isChecked ? '1px solid #3b82f6' : '1px solid #cbd5e1'
                                                            }}
                                                        >
                                                            {isChecked && <i className="fas fa-check" style={{ marginRight: '5px' }}></i>}
                                                            {yr}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    <button
                        className="btn-primary"
                        disabled={loading}
                        style={{
                            width: '100%', padding: '14px', borderRadius: '12px', fontSize: '16px', fontWeight: '700',
                            background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none',
                            boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)'
                        }}
                    >
                        {loading ? <span><i className="fas fa-spinner fa-spin"></i> Processing...</span> : <span><i className="fas fa-check-circle"></i> Complete HOD Setup</span>}
                    </button>
                </form>
            </div>
        </div>
    );
}