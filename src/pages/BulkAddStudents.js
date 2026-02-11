import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { auth, db } from '../firebase'; 
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast'; 
import './Dashboard.css';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com"; 

export default function BulkAddStudents({ instituteId, instituteName }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, skipped: 0 }); // Added 'skipped'
    
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

    // ✅ HELPER: Fetch Existing Roll Numbers to prevent duplicates
    const getExistingRollNumbers = async (year, dept, division) => {
        const q = query(
            collection(db, 'users'),
            where('instituteId', '==', instituteId),
            where('role', '==', 'student'),
            where('year', '==', year),
            where('department', '==', dept)
        );
        
        const snap = await getDocs(q);
        const existingRolls = new Set();
        
        snap.docs.forEach(doc => {
            const data = doc.data();
            // If checking division (FE), filter by it
            if (year === 'FE' && division && data.division !== division) return;
            
            if (data.rollNo) existingRolls.add(String(data.rollNo).trim());
        });

        return existingRolls;
    };

    const generateSystemEmail = (student) => {
        const cleanName = student.firstName ? student.firstName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'student';
        return `${student.rollNo}.${cleanName}@student.app`; 
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        // Validations...
        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            toast.error("❌ Invalid File: Please upload a CSV file.", { duration: 5000 });
            e.target.value = null; return;
        }
        if (selectedYear !== 'FE' && !selectedDept) {
            toast.error("⚠️ Please select a Department first!");
            e.target.value = null; return;
        }
        if (selectedYear === 'FE' && !selectedDivision) {
            toast.error("⚠️ Please select a Division for FE!");
            e.target.value = null; return;
        }

        setLoading(true);
        const toastId = toast.loading("Checking for existing students...");

        Papa.parse(file, {
            header: false,
            skipEmptyLines: 'greedy',
            complete: async (results) => {
                const rows = results.data;
                
                // Find Header
                let headerIndex = -1;
                for(let i=0; i<Math.min(rows.length, 20); i++) {
                    const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
                    if((rowStr.includes('email') || rowStr.includes('roll')) && rowStr.includes('name')) {
                        headerIndex = i; break;
                    }
                }

                if (headerIndex === -1) {
                    toast.error("❌ Could not find header row (Roll No, Name, Email)", { id: toastId });
                    setLoading(false); return;
                }

                const headers = rows[headerIndex].map(h => String(h).toLowerCase().trim());
                const idxEmail = headers.findIndex(h => h.includes('email'));
                const idxRoll = headers.findIndex(h => h.includes('roll'));
                const idxName = headers.findIndex(h => h.includes('name') && !h.includes('user'));
                // ... (other indexes remain same) ...
                const idxSex = headers.findIndex(h => h.includes('sex') || h.includes('gender'));
                const idxCat = headers.findIndex(h => h.includes('category'));
                const idxId = headers.findIndex(h => h.includes('student id') || h.includes('college id'));
                const idxAdmType = headers.findIndex(h => h.includes('admn') || h.includes('type'));

                if (idxRoll === -1) {
                    toast.error("❌ 'Roll No' column is required!", { id: toastId });
                    setLoading(false); return;
                }

                // ✅ 1. FETCH EXISTING STUDENTS FROM DB
                const targetDept = selectedYear === 'FE' ? 'FE' : selectedDept;
                const existingRolls = await getExistingRollNumbers(selectedYear, targetDept, selectedDivision);
                
                let skippedCount = 0;

                // ✅ STEP 2: Filter & Construct Objects
                const cleanStudents = rows.slice(headerIndex + 1).map(row => {
                    const rollNo = row[idxRoll] ? String(row[idxRoll]).trim() : "";
                    const nameRaw = idxName !== -1 ? row[idxName] : "Student";
                    
                    // ✅ NEW LOGIC: Take 2nd word (Actual Student Name)
                    // Input: "Patil Rohit Suresh" -> Splits to ["Patil", "Rohit", "Suresh"] -> Takes "Rohit"
                    const nameParts = nameRaw ? nameRaw.trim().split(/\s+/) : [];
                    const firstName = nameParts.length > 1 ? nameParts[1] : (nameParts[0] || "Student");

                    if (!rollNo) return null;

                    // 🛑 SMART SKIP: If Roll No exists in DB, skip this row
                    if (existingRolls.has(rollNo)) {
                        skippedCount++;
                        return null; 
                    }

                    // 📧 EMAIL LOGIC: Use real email if present, else generate fake one
                    let finalEmail = "";
                    if (idxEmail !== -1 && row[idxEmail] && String(row[idxEmail]).includes('@')) {
                        finalEmail = row[idxEmail].trim();
                    } else {
                        finalEmail = generateSystemEmail({ rollNo, firstName });
                    }

                    return {
                        "email": finalEmail,
                        "name": nameRaw,
                        "rollNo": rollNo,
                        "collegeId": idxId !== -1 ? row[idxId] : "",
                        "gender": idxSex !== -1 ? row[idxSex] : "",
                        "category": idxCat !== -1 ? row[idxCat] : "",
                        "admissionType": idxAdmType !== -1 ? row[idxAdmType] : "",
                        
                        "division": selectedYear === 'FE' ? selectedDivision : null,
                        "department": targetDept,
                        "year": selectedYear
                    };
                }).filter(s => s !== null);

                if (cleanStudents.length === 0) {
                    if (skippedCount > 0) {
                        toast.success(`All ${skippedCount} students already exist! No new accounts needed.`, { id: toastId });
                    } else {
                        toast.error("❌ No valid data found.", { id: toastId });
                    }
                    setLoading(false); 
                    e.target.value = null;
                    return;
                }

                toast.loading(`Skipped ${skippedCount} existing. Uploading ${cleanStudents.length} new...`, { id: toastId });

                // 3. Send to Backend
                try {
                    const response = await fetch(`${BACKEND_URL}/bulkCreateStudents`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            students: cleanStudents, 
                            instituteId, 
                            instituteName,
                            department: targetDept, 
                            year: selectedYear 
                        })
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || "Upload failed");

                    setStats({ 
                        total: cleanStudents.length, 
                        success: data.success.length, 
                        failed: data.errors.length,
                        skipped: skippedCount // Show skipped count in UI
                    });
                    
                    toast.success(
                        <div>
                            Done! Added {data.success.length} new students.<br/>
                            (Skipped {skippedCount} existing accounts)<br/>
                            <b>Default Password: Student@123</b>
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
                    <p className="content-subtitle">Upload CSV. Existing students will be skipped automatically.</p>
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
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
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

                        {selectedYear === 'FE' ? (
                            <div className="animate-fade-in">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>Select Division</label>
                                <select 
                                    value={selectedDivision} 
                                    onChange={(e) => setSelectedDivision(e.target.value)}
                                    className="modern-input"
                                    style={{ width: '100%', padding: '12px', background: '#fff', borderColor: '#2563eb' }}
                                >
                                    {DIVISIONS.map(div => <option key={div} value={div}>Division {div}</option>)}
                                </select>
                            </div>
                        ) : (
                            <div className="animate-fade-in">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>Select Department</label>
                                <select 
                                    value={selectedDept} 
                                    onChange={(e) => setSelectedDept(e.target.value)}
                                    className="modern-input"
                                    style={{ width: '100%', padding: '12px', background: '#fff' }}
                                >
                                    <option value="">-- Choose Department --</option>
                                    {departments.map((dept, idx) => <option key={idx} value={dept}>{dept}</option>)}
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
                    
                    <div className="upload-zone" style={{ border: '2px dashed #cbd5e1', borderRadius: '16px', padding: '40px', textAlign: 'center', background: '#f8fafc', cursor: 'pointer' }}>
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
                            <h4 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>{loading ? 'Processing Files...' : 'Click to Upload CSV'}</h4>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>{loading ? 'Filtering existing students...' : 'Only new students will be added.'}</p>
                        </label>
                    </div>
                </div>

                {/* 3. Results Card */}
                {(stats.total > 0 || stats.skipped > 0) && (
                    <div className="card fade-in">
                        <h3 style={{ marginBottom: '15px' }}>Upload Summary</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '15px' }}>
                            <div style={{ padding: '15px', background: '#f0fdf4', borderRadius: '12px', borderLeft: '5px solid #16a34a' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#166534', textTransform: 'uppercase' }}>Created</div>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: '#15803d' }}>{stats.success}</div>
                            </div>
                            <div style={{ padding: '15px', background: '#eff6ff', borderRadius: '12px', borderLeft: '5px solid #3b82f6' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase' }}>Skipped (Exist)</div>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: '#2563eb' }}>{stats.skipped}</div>
                            </div>
                            <div style={{ padding: '15px', background: '#fef2f2', borderRadius: '12px', borderLeft: '5px solid #dc2626' }}>
                                <div style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase' }}>Failed</div>
                                <div style={{ fontSize: '24px', fontWeight: '800', color: '#b91c1c' }}>{stats.failed}</div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}