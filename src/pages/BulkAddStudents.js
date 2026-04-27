import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';
import { useInstitution } from '../contexts/InstitutionContext';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function BulkAddStudents({ instituteId, instituteName }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, skipped: 0 });

    const [selectedDept, setSelectedDept] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedDivision, setSelectedDivision] = useState("A");
    const [departments, setDepartments] = useState([]);

    const DIVISIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

    // 👇 1. PULL CONFIGURATION RULES 👇
    const { config } = useInstitution();
    const isAgri = config?.domain === 'AGRICULTURE' || config?.domain === 'MEDICAL' || config?.domain === 'PHARMACY';
    const isEngg = config?.domain === 'ENGINEERING';
    
   // ✅ Strictly force FY/SY/TY based on domain (Ignores stale 'FE' data in database)
    const academicYears = isEngg ? ['FE', 'SE', 'TE', 'BE'] : ['FY', 'SY', 'TY', 'Final Year'];

    // ✅ STRICT LOGIC: 
    // - Engg FE/FY shows Division. 
    // - Engg SE/TE/BE shows Department. 
    // - Agri ALWAYS hides both (dumps into Common Pool).
    const showDivision = !isAgri && (selectedYear === 'FE' || selectedYear === 'FY');
    const showDepartment = !isAgri && selectedYear !== 'FE' && selectedYear !== 'FY';

    useEffect(() => {
        if (academicYears.length > 0 && !selectedYear) {
            setSelectedYear(academicYears[0]);
        }
    }, [academicYears, selectedYear]);

    // Fetch Departments
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

    // Fetch Existing Roll Numbers
    const getExistingRollNumbers = async (year) => {
        const q = query(
            collection(db, 'users'),
            where('instituteId', '==', instituteId),
            where('role', '==', 'student'),
            where('year', '==', year)
        );

        const snap = await getDocs(q);
        const existingRolls = new Set();

        snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.rollNo) existingRolls.add(String(data.rollNo).trim());
        });
        return existingRolls;
    };

    const generateSystemEmail = (student) => {
        const cleanName = student.firstName ? student.firstName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'student';
        const cleanRoll = String(student.rollNo).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        return `${cleanRoll}.${cleanName}@student.app`;
    };

    // 👇 2. DYNAMIC TEMPLATE GENERATOR 👇
    const downloadTemplate = () => {
        if (showDepartment && !selectedDept) {
            return toast.error("Please select a Department first.");
        }

        let headers = "";
        let sampleRow = "";

        /// ✅ AGRI COLLEGES: Name, Roll No, Email
        if (isAgri) {
            headers = "Full Name,Roll No,Email";
            sampleRow = "Rahul Patil,PDVBE/24-01,rahul@example.com";
        } else {
            headers = "First Name,Last Name,Email,Roll No,Year";
            sampleRow = `John,Doe,john.doe@example.com,101,${selectedYear}`;

            if (showDepartment) {
                headers += ",Department";
                sampleRow += `,${selectedDept === 'MIXED' ? 'Agronomy' : selectedDept}`;
            } else {
                headers += ",Department";
                sampleRow += `,${academicYears[0]}`;
            }

            if (showDivision) {
                headers += ",Division";
                sampleRow += `,${selectedDivision}`;
            }
        }

        const csvContent = `${headers}\n${sampleRow}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Student_Upload_${selectedYear.replace(/\s+/g, '_')}${isAgri ? '_' + selectedDept : ''}.csv`;
        link.click();
    };

    // 👇 3. SMART FILE UPLOAD PARSER 👇
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            toast.error("❌ Invalid File: Please upload a CSV file.", { duration: 5000 });
            e.target.value = null; return;
        }
        if (showDepartment && !selectedDept) {
            toast.error("⚠️ Please select a Department!");
            e.target.value = null; return;
        }
        if (showDivision && !selectedDivision) {
            toast.error("⚠️ Please select a Division!");
            e.target.value = null; return;
        }

        setLoading(true);
        const toastId = toast.loading("Processing file & checking duplicates...");

       Papa.parse(file, {
            header: false,
            skipEmptyLines: 'greedy',
            complete: async (results) => {
                const rows = results.data;
                
                let headerIndex = -1;
                for(let i=0; i<Math.min(rows.length, 20); i++) {
                    const rowStr = rows[i].map(c => String(c).toLowerCase()).join(' ');
                    if (rowStr.includes('name') && rowStr.includes('roll')) {
                        headerIndex = i; break;
                    }
                }

                if (headerIndex === -1) {
                    toast.error(`❌ Could not find header row (Ensure 'Name' and 'Roll No' columns exist)`, { id: toastId });
                    setLoading(false); return;
                }

                const headers = rows[headerIndex].map(h => String(h).toLowerCase().trim());
                
                const idxName = headers.findIndex(h => h.includes('name'));
                const idxRoll = headers.findIndex(h => h.includes('roll'));
                const idxEmail = headers.findIndex(h => h.includes('email'));
                const idxSex = headers.findIndex(h => h.includes('sex') || h.includes('gender'));
                const idxCat = headers.findIndex(h => h.includes('category'));
                const idxId = headers.findIndex(h => h.includes('id'));
                const idxDiv = headers.findIndex(h => h === 'division');
                const idxDept = headers.findIndex(h => h === 'department');
                const idxYear = headers.findIndex(h => h === 'year');

                if (idxRoll === -1) {
                    toast.error("❌ 'Roll No' column is required!", { id: toastId });
                    setLoading(false); return;
                }

                if (!isAgri && showDepartment && selectedDept === 'MIXED' && idxDept === -1) {
                    toast.error("❌ 'Department' column missing in CSV.", { id: toastId });
                    setLoading(false); return;
                }

                const existingRolls = await getExistingRollNumbers(selectedYear);
                
                let skippedCount = 0;
                let hasErrors = false;

               const cleanStudents = rows.slice(headerIndex + 1).map((row, index) => {
                    const rollNo = idxRoll !== -1 && row[idxRoll] ? String(row[idxRoll]).trim() : "";
                    if (!rollNo) return null;

                    if (existingRolls.has(rollNo)) {
                        skippedCount++;
                        return null; 
                    }

                    // Robust Name Parsing
                    const rawName = idxName !== -1 && row[idxName] ? String(row[idxName]).trim() : "Student";
                    const nameParts = rawName.split(/\s+/);
                    const firstName = nameParts[0] || "Student";
                    const lastName = nameParts.slice(1).join(' ') || "";

                    // Robust Email Parsing (Auto-generates if missing)
                    let finalEmail = "";
                    if (idxEmail !== -1 && row[idxEmail] && String(row[idxEmail]).includes('@')) {
                        finalEmail = row[idxEmail].trim();
                    } else {
                        finalEmail = generateSystemEmail({ rollNo, firstName });
                    }

                    // Map fields safely
                    const divVal = idxDiv !== -1 && row[idxDiv] ? row[idxDiv] : selectedDivision;
                    let deptVal = selectedDept;
                    if (showDepartment && idxDept !== -1 && row[idxDept]) {
                        deptVal = row[idxDept];
                    }
                    if (deptVal === 'MIXED') deptVal = null;

                    const yearVal = idxYear !== -1 && row[idxYear] ? row[idxYear] : selectedYear;

                    return {
                        "role": "student",      
                        "email": finalEmail,
                        "firstName": firstName,
                        "lastName": lastName,
                        "name": rawName,
                        "rollNo": rollNo,
                        "collegeId": idxId !== -1 && row[idxId] ? row[idxId] : "",
                        "gender": idxSex !== -1 && row[idxSex] ? row[idxSex] : "",
                        "category": idxCat !== -1 && row[idxCat] ? row[idxCat] : "",
                        "division": showDivision ? divVal : null,
                        "department": isAgri ? "Common" : deptVal,
                        "enrolledDepartments": [], 
                        "year": yearVal,
                        "instituteId": instituteId,
                        "instituteName": instituteName
                    };
                }).filter(s => s !== null);

                if (cleanStudents.length === 0) {
                    if (skippedCount > 0) {
                        toast.success(`All ${skippedCount} students already exist!`, { id: toastId });
                    } else if (!hasErrors) {
                        toast.error("❌ No valid data found.", { id: toastId });
                    }
                    setLoading(false); 
                    e.target.value = null;
                    return;
                }

                toast.loading(`Skipped ${skippedCount} existing. Uploading ${cleanStudents.length} new...`, { id: toastId });

                try {
                    const response = await fetch(`${BACKEND_URL}/bulkCreateStudents`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            students: cleanStudents, 
                            instituteId, 
                            instituteName
                        })
                    });

                    const data = await response.json();
                    if (!response.ok) throw new Error(data.error || "Upload failed");

                    setStats({ 
                        total: cleanStudents.length, 
                        success: data.success.length, 
                        failed: data.errors.length,
                        skipped: skippedCount
                    });
                    
                    toast.success(
                        <div>
                            Done! Added {data.success.length} new students.<br/>
                            (Skipped {skippedCount} existing)<br/>
                            <b>Default Password: Student@123</b>
                        </div>, 
                        { id: toastId, duration: 6000 }
                    );

                } catch (err) {
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
                <div className="icon-box-modern" style={{ background: '#e0e7ff', color: '#4338ca' }}>
                    <i className="fas fa-file-upload"></i>
                </div>
            </div>

            <div className="cards-grid" style={{ gridTemplateColumns: '1fr' }}>

                {/* 1. Configuration Card */}
                <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
                        <h3 style={{ color: '#1e293b', margin: 0, display: 'flex', alignItems: 'center' }}>
                            <span style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', marginRight: '10px', fontWeight: 'bold' }}>1</span>
                            Batch Configuration
                        </h3>

                        <button
                            onClick={downloadTemplate}
                            style={{
                                background: '#10b981', color: 'white', border: 'none', padding: '8px 16px',
                                borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s ease'
                            }}
                            onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(16, 185, 129, 0.3)'; }}
                            onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 6px rgba(16, 185, 129, 0.2)'; }}
                        >
                            <i className="fas fa-file-csv" style={{ fontSize: '14px' }}></i>
                            Download CSV Template
                        </button>
                    </div>

                    {/* 📊 BULK UPLOAD FILTERS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>

                        {/* 1. YEAR SELECTOR (Always Visible) */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>Select Class / Year *</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => {
                                    setSelectedYear(e.target.value);
                                    // If Engg and First Year is selected, auto-set department to FE/FY and set default division
                                    if (!isAgri && (e.target.value === 'FE' || e.target.value === 'FY')) {
                                        setSelectedDept(e.target.value); // dynamically sets 'FE' or 'FY'
                                        setSelectedDivision('A'); // Set a default
                                    } else {
                                        setSelectedDept('');
                                    }
                                }}
                                className="modern-input"
                                style={{ width: '100%', padding: '12px', background: '#fff' }}
                            >
                                <option value="">-- Choose Year --</option>
                                {academicYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

                        {/* 2. DEPARTMENT SELECTOR */}
                        {showDepartment && (
                            <div className="animate-fade-in">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>Select Department *</label>
                                <select
                                    value={selectedDept}
                                    onChange={(e) => setSelectedDept(e.target.value)}
                                    className="modern-input"
                                    style={{ width: '100%', padding: '12px', background: '#fff' }}
                                >
                                    <option value="">-- Choose Department --</option>
                                    {!isAgri && <option value="MIXED" style={{ fontWeight: 'bold', color: '#2563eb' }}>📂 Multiple Departments (From CSV)</option>}
                                    {departments.map((dept, idx) => (
                                        // ✅ Added "FY" to the exclusion list so it correctly hides for upper years
                                        (isAgri || (dept !== 'FE' && dept !== 'FY' && dept !== 'First Year' && dept !== 'FirstYear')) &&
                                        <option key={idx} value={dept}>{dept}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* 3. DIVISION SELECTOR (Strictly for Engineering FE) */}
                        {showDivision && (
                            <div className="animate-fade-in">
                                <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>Select Division *</label>
                                <select
                                    value={selectedDivision}
                                    onChange={(e) => setSelectedDivision(e.target.value)}
                                    className="modern-input"
                                    style={{ width: '100%', padding: '12px', background: '#fff', borderColor: '#2563eb' }}
                                >
                                    <option value="">-- Choose Division --</option>
                                    {DIVISIONS.map(div => <option key={div} value={div}>Division {div}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Upload Card */}
                <div className="card">
                    <h3 style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '15px', color: '#1e293b', display: 'flex', alignItems: 'center' }}>
                        <span style={{ background: '#3b82f6', color: 'white', borderRadius: '50%', width: '26px', height: '26px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', marginRight: '10px', fontWeight: 'bold' }}>2</span>
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
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                                {isAgri ? "CSV must contain: Full Name, Roll No, Email" : "CSV must contain: Name, Email, Roll No"}
                            </p>
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