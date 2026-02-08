import React, { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import { db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

// ✅ Make sure this matches your deployed backend URL
const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- 📱 HELPER: CUSTOM MOBILE SELECT ---
const CustomMobileSelect = ({ label, value, onChange, options, icon }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="custom-select-container" style={{ position: 'relative', width: '100%', marginBottom: '0' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {label}
            </label>

            <div
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    padding: '14px 16px', borderRadius: '12px', background: '#f8fafc',
                    border: isOpen ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                    color: '#1e293b', fontWeight: '700', cursor: 'pointer',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    transition: 'all 0.2s ease', width: '100%'
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    {icon && <div style={{ minWidth: '24px', width: '24px', height: '24px', borderRadius: '6px', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}><i className={`fas ${icon}`}></i></div>}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {options.find(o => o.value === value)?.label || "Select Department..."}
                    </span>
                </div>
                <i className={`fas fa-chevron-down ${isOpen ? 'fa-rotate-180' : ''}`} style={{ transition: '0.3s', color: isOpen ? '#3b82f6' : '#94a3b8' }}></i>
            </div>

            {isOpen && (
                <>
                    <div className="mobile-dropdown-menu" style={{
                        position: 'absolute', top: '110%', left: 0, right: 0,
                        background: 'white', borderRadius: '12px',
                        boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)',
                        zIndex: 100, maxHeight: '250px', overflowY: 'auto'
                    }}>
                        {options.map((opt) => (
                            <div
                                key={opt.value}
                                onClick={() => { onChange(opt.value); setIsOpen(false); }}
                                style={{
                                    padding: '12px 16px', borderBottom: '1px solid #f8fafc',
                                    color: value === opt.value ? '#2563eb' : '#475569',
                                    fontWeight: value === opt.value ? '700' : '600',
                                    background: value === opt.value ? '#eff6ff' : 'transparent',
                                    cursor: 'pointer', fontSize: '13px'
                                }}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setIsOpen(false)}></div>
                </>
            )}
        </div>
    );
};

export default function AddHOD({ instituteId, instituteName }) {
    const [departments, setDepartments] = useState([]);
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        department: '',
        qualification: '',
        phone: ''
    });
    const [loading, setLoading] = useState(false);

    // Fetch Departments for Dropdown
    useEffect(() => {
        const fetchDepts = async () => {
            if (!instituteId) return;
            try {
                const q = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
                const snap = await getDocs(q);
                // Filter out 'FE' if it exists in DB to avoid duplicates
                const deptList = snap.docs.map(d => d.data().name).filter(name => name !== 'FE');
                setDepartments(deptList.sort());
            } catch (err) {
                console.error("Error fetching departments", err);
            }
        };
        fetchDepts();
    }, [instituteId]);

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                    department: form.department,
                    phone: form.phone,
                    qualification: form.qualification,
                    // Sending extra fields for Firestore storage
                    extras: {
                        qualification: form.qualification,
                        phone: form.phone
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to create HOD");

            // 2. Trigger Email Notification (Using the same route as Teachers)
            try {
                await fetch(`${BACKEND_URL}/sendTeacherCredentials`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: form.email,
                        password: form.password,
                        firstName: form.firstName,
                        lastName: form.lastName,      // <--- Make sure this is sent
                        role: 'hod',                  // <--- Make sure this is sent
                        department: form.department,
                        academicYear: "2026-2027",    // <--- You can also make this dynamic if needed
                        assignedClasses: [] // HODs might not have direct classes initially
                    })
                });
                toast.success(`HOD Appointed & Email Sent!`, { id: toastId });
            } catch (emailErr) {
                console.error("Email failed", emailErr);
                toast.success(`HOD Appointed (Email Failed)`, { id: toastId });
            }

            setForm({ firstName: '', lastName: '', email: '', password: '', department: '', qualification: '', phone: '' });

        } catch (error) {
            console.error("Error adding HOD:", error);
            toast.error(error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // Prepare Options for Custom Dropdown
    const deptOptions = [
        { value: 'FE', label: 'First Year (FE) - General Science' },
        ...departments.map(dept => ({ value: dept, label: dept }))
    ];

    return (
        <div className="content-section">
            <h2 className="content-title">Add Head of Department</h2>
            <p className="content-subtitle">Appoint an HOD for a department or First Year.</p>

            <div className="card fade-in-up" style={{
                background: 'white', borderRadius: '24px', border: 'none',
                boxShadow: '0 20px 50px -10px rgba(0,0,0,0.1)', overflow: 'visible',
                position: 'relative', maxWidth: '800px', padding: '0'
            }}>

                {/* Header */}
                <div style={{
                    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                    padding: '20px 25px', borderRadius: '24px 24px 0 0', position: 'relative', overflow: 'hidden'
                }}>
                    <h3 style={{ margin: 0, color: 'white', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-user-tie"></i> Appoint HOD
                    </h3>
                    <div style={{ position: 'absolute', top: '-10px', right: '-10px', width: '80px', height: '80px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
                </div>

                <form onSubmit={handleSubmit} style={{ padding: '25px' }}>

                    {/* Row 1: Name */}
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

                    {/* Row 2: Department (Custom Dropdown) */}
                    <div style={{ marginBottom: '20px' }}>
                        <CustomMobileSelect
                            label="Department / Class"
                            icon="fa-building"
                            value={form.department}
                            onChange={(val) => setForm({ ...form, department: val })}
                            options={deptOptions}
                        />
                    </div>

                    {/* Row 3: Credentials */}
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '15px' }}>
                        <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                            <label>Email Address</label>
                            <input type="email" required placeholder="hod@college.edu" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
                        </div>
                        <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                            <label>Password</label>
                            <input type="password" required placeholder="******" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
                        </div>
                    </div>

                    {/* Row 4: Extra Details */}
                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', marginBottom: '20px' }}>
                        <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                            <label>Qualification</label>
                            <input type="text" placeholder="e.g. PhD, M.Tech" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
                        </div>
                        <div className="input-group" style={{ flex: 1, minWidth: '200px' }}>
                            <label>Phone Number</label>
                            <input type="tel" placeholder="+91 9876543210" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
                        </div>
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
                        {loading ? <span><i className="fas fa-spinner fa-spin"></i> Processing...</span> : <span><i className="fas fa-check-circle"></i> Appoint HOD</span>}
                    </button>
                </form>
            </div>
        </div>
    );
}