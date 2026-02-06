import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { auth, db, sendPasswordResetEmail } from '../firebase'; 
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast'; 
import './Dashboard.css';

// ✅ Make sure this matches your deployed backend URL
const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com"; 

export default function BulkAddStudents({ instituteId, instituteName }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, success: 0, failed: 0 });
    
    // Batch Configuration State
    const [selectedDept, setSelectedDept] = useState("");
    const [selectedYear, setSelectedYear] = useState("FE");
    const [selectedDivision, setSelectedDivision] = useState("A");
    const [departments, setDepartments] = useState([]);

    const DIVISIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

    // 1. Fetch Departments on Load
    useEffect(() => {
        const fetchDepartments = async () => {
            if (!instituteId) return;
            try {
                const q = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
                const snap = await getDocs(q);
                const deptList = snap.docs.map(doc => doc.data().name); 
                setDepartments(deptList.sort());
            } catch (err) {
                console.error("Error fetching departments:", err);
            }
        };
        fetchDepartments();
    }, [instituteId]);

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // 🛑 Check for Excel files
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            toast.error("❌ Invalid File: Please upload a CSV file.\n(Save As > CSV in Excel)", { duration: 5000 });
            e.target.value = null; 
            return;
        }

        // ✅ LOGIC CHANGE: Only check Dept if NOT FE
        if (selectedYear !== 'FE' && !selectedDept) {
            toast.error("⚠️ Please select a Department first!");
            e.target.value = null; 
            return;
        }

        // ✅ LOGIC CHANGE: Check Division if FE
        if (selectedYear === 'FE' && !selectedDivision) {
            toast.error("⚠️ Please select a Division for FE!");
            e.target.value = null; 
            return;
        }

        setLoading(true);
        const toastId = toast.loading("Scanning file structure...");

        // 2. Parse CSV as Raw Arrays (Smart Scan)
        Papa.parse(file, {
            header: false, // We will find the header manually
            skipEmptyLines: 'greedy',
            complete: async (results) => {
                const rows = results.data;
                
                // 3. Find the Header Row dynamically
                let headerIndex = -1;
                for(let i=0; i<Math.min(rows.length, 20); i++) {
                    const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
                    if(rowStr.includes('email') && (rowStr.includes('roll') || rowStr.includes('name'))) {
                        headerIndex = i;
                        break;
                    }
                }

                if (headerIndex === -1) {
                    toast.error("❌ Could not find 'Email' or 'Roll No' columns.", { id: toastId });
                    setLoading(false); 
                    return;
                }

                // 4. Map Columns (The "Smart" Part)
                const headers = rows[headerIndex].map(h => String(h).toLowerCase().trim());
                
                const idxEmail = headers.findIndex(h => h.includes('email'));
                const idxRoll = headers.findIndex(h => h.includes('roll'));
                const idxName = headers.findIndex(h => h.includes('name') && !h.includes('user'));
                const idxSex = headers.findIndex(h => h.includes('sex') || h.includes('gender'));
                const idxCat = headers.findIndex(h => h.includes('category'));
                const idxId = headers.findIndex(h => h.includes('student id') || h.includes('college id') || h.includes('prn'));
                const idxAdmType = headers.findIndex(h => h.includes('admn') || h.includes('type'));

                if (idxEmail === -1) {
                    toast.error("❌ 'Email' column is missing!", { id: toastId });
                    setLoading(false); return;
                }

                // 5. Construct Objects
                const cleanStudents = rows.slice(headerIndex + 1).map(row => {
                    if (!row[idxEmail] || !String(row[idxEmail]).includes('@')) return null;

                    return {
                        "email": row[idxEmail].trim(),
                        "name": idxName !== -1 ? row[idxName].trim() : "Student",
                        "rollNo": idxRoll !== -1 ? row[idxRoll] : "",
                        "collegeId": idxId !== -1 ? row[idxId] : "",
                        "sex": idxSex !== -1 ? row[idxSex] : "",
                        "category": idxCat !== -1 ? row[idxCat] : "",
                        "admissionType": idxAdmType !== -1 ? row[idxAdmType] : "",
                        
                        // ✅ Division only for FE
                        "division": selectedYear === 'FE' ? selectedDivision : null,

                        // ✅ Department Logic: If FE, set as 'FE', else use selected
                        "department": selectedYear === 'FE' ? 'FE' : selectedDept,
                        "year": selectedYear
                    };
                }).filter(s => s !== null);

                if (cleanStudents.length === 0) {
                    toast.error("❌ No valid students found in file.", { id: toastId });
                    setLoading(false); 
                    return;
                }

                toast.loading(`Uploading ${cleanStudents.length} students...`, { id: toastId });

                try {
                    // 6. Send to Backend
                    const response = await fetch(`${BACKEND_URL}/bulkCreateStudents`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            students: cleanStudents, 
                            instituteId, 
                            instituteName,
                            // ✅ Send 'FE' as department if it's First Year
                            department: selectedYear === 'FE' ? 'FE' : selectedDept, 
                            year: selectedYear,
                            defaultPassword: "Student@123"
                        })
                    });

                    const data = await response.json();

                    if (!response.ok) throw new Error(data.error || "Upload failed");

                    setStats({ 
                        total: cleanStudents.length, 
                        success: data.success.length, 
                        failed: data.errors.length 
                    });
                    
                    toast.success(
                        <div>
                            Done! Created {data.success.length} accounts.<br/>
                            <b>Default Password: Student@123</b><br/>
                            (Share this with students)
                        </div>, 
                        { id: toastId, duration: 6000 }
                    );

                } catch (err) {
                    console.error(err);
                    toast.error("Server Error: " + err.message, { id: toastId });
                } finally {
                    setLoading(false);
                    e.target.value = null; 
                }

            },
            error: (err) => {
                toast.error("CSV Parse Error: " + err.message, { id: toastId });
                setLoading(false);
            }
        });
    };

    return (
        <div className="content-section fade-in">
            <div className="header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div>
                    <h2 className="content-title">Bulk Student Upload</h2>
                    <p className="content-subtitle">Upload student data from your college CSV.</p>
                </div>
                <div className="icon-box-modern" style={{background: '#e0e7ff', color: '#4338ca'}}>
                    <i className="fas fa-file-upload"></i>
                </div>
            </div>
            
            <div className="cards-grid" style={{ gridTemplateColumns: '1fr' }}>
                
                {/* 1. Configuration Card */}
                <div className="card">
                    <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px', color: '#1e293b' }}>
                        <span style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', marginRight: '8px' }}>1</span>
                        Batch Configuration
                    </h3>
                    
                    {/* ✅ Two columns for both cases (Just different inputs) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        
                        {/* 1. Year Selector (Always Visible) */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>Select Class / Year</label>
                            <select 
                                value={selectedYear} 
                                onChange={(e) => setSelectedYear(e.target.value)}
                                className="modern-input"
                                style={{ width: '100%', padding: '12px', background: '#fff' }}
                            >
                                <option value="FE">FE (First Year)</option>
                                <option value="SE">SE (Second Year)</option>
                                <option value="TE">TE (Third Year)</option>
                                <option value="BE">BE (Final Year)</option>
                            </select>
                        </div>

                        {/* 2. Logic Switch: Department OR Division */}
                        {selectedYear === 'FE' ? (
                            // ✅ Case A: FE -> Show Division
                            <div className="animate-fade-in">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>
                                    Select Division
                                </label>
                                <select 
                                    value={selectedDivision} 
                                    onChange={(e) => setSelectedDivision(e.target.value)}
                                    className="modern-input"
                                    style={{ width: '100%', padding: '12px', background: '#fff', borderColor: '#2563eb' }}
                                >
                                    {DIVISIONS.map(div => (
                                        <option key={div} value={div}>Division {div}</option>
                                    ))}
                                </select>
                            </div>
                        ) : (
                            // ✅ Case B: SE/TE/BE -> Show Department
                            <div className="animate-fade-in">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>
                                    Select Department
                                </label>
                                <select 
                                    value={selectedDept} 
                                    onChange={(e) => setSelectedDept(e.target.value)}
                                    className="modern-input"
                                    style={{ width: '100%', padding: '12px', background: '#fff' }}
                                >
                                    <option value="">-- Choose Department --</option>
                                    {departments.length > 0 ? (
                                        departments.map((dept, idx) => (
                                            <option key={idx} value={dept}>{dept}</option>
                                        ))
                                    ) : (
                                        <option disabled>No departments found</option>
                                    )}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Upload Card */}
                <div className="card">
                    <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px', color: '#1e293b' }}>
                        <span style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: '24px', height: '24px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', marginRight: '8px' }}>2</span>
                        Upload Data
                    </h3>
                    
                    <div className="upload-zone" style={{ 
                        border: '2px dashed #cbd5e1', 
                        borderRadius: '16px', 
                        padding: '40px', 
                        textAlign: 'center', 
                        background: '#f8fafc',
                        cursor: 'pointer'
                    }}>
                        <input 
                            type="file" 
                            accept=".csv" 
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                            id="csvUpload"
                            disabled={loading}
                        />
                        <label htmlFor="csvUpload" style={{ cursor: loading ? 'not-allowed' : 'pointer', width: '100%', height: '100%', display: 'block' }}>
                            <div style={{ fontSize: '40px', color: '#3b82f6', marginBottom: '15px' }}>
                                <i className={loading ? "fas fa-cog fa-spin" : "fas fa-cloud-upload-alt"}></i>
                            </div>
                            <h4 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>
                                {loading ? 'Processing Files...' : 'Click to Upload CSV'}
                            </h4>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                                {loading ? 'Checking for valid columns...' : 'Must be .csv file'}
                            </p>
                        </label>
                    </div>

                    <div style={{ marginTop: '15px', padding: '15px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fcd34d', fontSize: '13px', color: '#92400e', display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <i className="fas fa-info-circle"></i>
                        <span>
                            <strong>Note:</strong> File must contain 'Roll No' and 'Email' columns. Headers are auto-detected.
                        </span>
                    </div>
                </div>

                {/* 3. Results Card */}
                {stats.total > 0 && (
                    <div className="card fade-in">
                        <h3 style={{ marginBottom: '15px' }}>Upload Summary</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '15px' }}>
                            <div style={{ padding: '15px', background: '#f0fdf4', borderRadius: '12px', borderLeft: '5px solid #16a34a' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>Success</div>
                                <div style={{ fontSize: '28px', fontWeight: '800', color: '#15803d' }}>{stats.success}</div>
                                <div style={{ fontSize: '12px', color: '#166534' }}>Accounts Created</div>
                            </div>
                            <div style={{ padding: '15px', background: '#fef2f2', borderRadius: '12px', borderLeft: '5px solid #dc2626' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase' }}>Failed</div>
                                <div style={{ fontSize: '28px', fontWeight: '800', color: '#b91c1c' }}>{stats.failed}</div>
                                <div style={{ fontSize: '12px', color: '#991b1b' }}>Duplicates / Errors</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}