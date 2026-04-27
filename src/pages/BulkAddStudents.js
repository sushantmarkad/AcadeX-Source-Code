import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { auth, db } from '../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';
import { useInstitution } from '../contexts/InstitutionContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "https://acadex-backend-n2wh.onrender.com";

// ✅ Helper to generate dynamic years based on course duration
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

export default function BulkAddStudents({ instituteId, instituteName }) {
    const [loading, setLoading] = useState(false);
    const [stats, setStats] = useState({ total: 0, success: 0, failed: 0, skipped: 0 });

    const [departments, setDepartments] = useState([]);
    const [selectedDeptId, setSelectedDeptId] = useState("");
    const [selectedYear, setSelectedYear] = useState("");
    const [selectedDivision, setSelectedDivision] = useState("A");

    const DIVISIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];

    // 1. PULL CONFIGURATION RULES
    const { config } = useInstitution();
    const isEngg = config?.domain === 'ENGINEERING';
    const isPharmacy = config?.domain === 'PHARMACY';
    const hierarchyLabel = isPharmacy ? "Program" : "Department";

    // 2. DYNAMIC STATE DERIVATION
    const selectedDeptObj = departments.find(d => d.id === selectedDeptId);
    const availableYears = selectedDeptObj ? generateYearLabels(selectedDeptObj.durationInYears, isEngg) : [];
    
    // Division is strictly for First Year Engineering
    const showDivision = isEngg && selectedYear === 'FE';

    // Fetch Programs/Departments with their Durations
    useEffect(() => {
        const fetchDepartments = async () => {
            if (!instituteId) return;
            try {
                const q = query(collection(db, 'departments'), where('instituteId', '==', instituteId));
                const snap = await getDocs(q);
                const deptList = snap.docs.map(doc => ({
                    id: doc.id,
                    name: doc.data().name,
                    durationInYears: doc.data().durationInYears || 4
                }));
                setDepartments(deptList.sort((a,b) => a.name.localeCompare(b.name)));
            } catch (err) {
                console.error("Error fetching departments:", err);
            }
        };
        fetchDepartments();
    }, [instituteId]);

    // Fetch Existing Roll Numbers to prevent duplicates
    const getExistingRollNumbers = async (year, deptName) => {
        const q = query(
            collection(db, 'users'),
            where('instituteId', '==', instituteId),
            where('role', '==', 'student'),
            where('year', '==', year),
            where('department', '==', deptName)
        );

        const snap = await getDocs(q);
        const existingRolls = new Set();
        snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.rollNo) existingRolls.add(String(data.rollNo).trim());
        });
        return existingRolls;
    };

// ✅ CRITICAL FIX: Injects Course Name into email to prevent Auth Collisions across Programs
    const generateSystemEmail = (student, courseName) => {
        const cleanName = student.firstName ? student.firstName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() : 'student';
        const cleanRoll = String(student.rollNo).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const cleanCourse = courseName ? String(courseName).replace(/[^a-zA-Z0-9]/g, '').toLowerCase().substring(0, 5) : 'dept';
        return `${cleanRoll}.${cleanName}.${cleanCourse}@student.app`;
    };

    // 3. DYNAMIC TEMPLATE GENERATOR (Super Clean!)
    const downloadTemplate = () => {
        if (!selectedDeptId) return toast.error(`Please select a ${hierarchyLabel} first.`);
        if (!selectedYear) return toast.error("Please select a Year.");

        // Because we route via UI, the CSV doesn't need 'Department' or 'Year' columns!
        let headers = "First Name,Last Name,Email,Roll No";
        let sampleRow = "John,Doe,john.doe@example.com,101";

        if (showDivision) {
            headers += ",Division";
            sampleRow += ",A";
        }

        const csvContent = `${headers}\n${sampleRow}`;
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `Students_${selectedDeptObj.name.replace(/\s+/g, '_')}_${selectedYear.replace(/\s+/g, '_')}.csv`;
        link.click();
    };

    // 4. SMART FILE UPLOAD PARSER
    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
            toast.error("❌ Invalid File: Please upload a CSV file.", { duration: 5000 });
            e.target.value = null; return;
        }
        if (!selectedDeptId) {
            toast.error(`⚠️ Please select a ${hierarchyLabel}!`);
            e.target.value = null; return;
        }
        if (!selectedYear) {
            toast.error("⚠️ Please select a Year!");
            e.target.value = null; return;
        }
        if (showDivision && !selectedDivision) {
            toast.error("⚠️ Please select a Division!");
            e.target.value = null; return;
        }

        setLoading(true);
        const toastId = toast.loading(`Uploading to ${selectedDeptObj.name} - ${selectedYear}...`);

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
                    toast.error(`❌ Could not find header row (Ensure 'Name' and 'Roll No' exist)`, { id: toastId });
                    setLoading(false); return;
                }

                const headers = rows[headerIndex].map(h => String(h).toLowerCase().trim());
                
                const idxName = headers.findIndex(h => h.includes('name'));
                const idxRoll = headers.findIndex(h => h.includes('roll'));
                const idxEmail = headers.findIndex(h => h.includes('email'));
                const idxDiv = headers.findIndex(h => h === 'division');

                if (idxRoll === -1) {
                    toast.error("❌ 'Roll No' column is required!", { id: toastId });
                    setLoading(false); return;
                }

                const existingRolls = await getExistingRollNumbers(selectedYear, selectedDeptObj.name);
                
                let skippedCount = 0;
                let hasErrors = false;

               const cleanStudents = rows.slice(headerIndex + 1).map((row) => {
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

                  // Robust Email Parsing
                    let finalEmail = "";
                    if (idxEmail !== -1 && row[idxEmail] && String(row[idxEmail]).includes('@')) {
                        finalEmail = String(row[idxEmail]).trim();
                    } else {
                        // ✅ CRITICAL FIX: Pass the department name to prevent cross-course collision!
                        finalEmail = generateSystemEmail({ rollNo, firstName }, selectedDeptObj.name);
                    }

                    const divVal = idxDiv !== -1 && row[idxDiv] ? String(row[idxDiv]).trim() : selectedDivision;

                    return {
                        "role": "student",      
                        "email": finalEmail,
                        "firstName": firstName,
                        "lastName": lastName,
                        "name": rawName,
                        "rollNo": rollNo,
                        "division": showDivision ? divVal : null,
                        
                        // ✅ We inject the UI-selected routing data here!
                        "department": selectedDeptObj.name,
                        "year": selectedYear,
                        
                        "enrolledDepartments": [], 
                        "extras": { "year": selectedYear },
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

                toast.loading(`Skipped ${skippedCount}. Uploading ${cleanStudents.length} new...`, { id: toastId });

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
                            Done! Added {data.success.length} students to {selectedDeptObj.name} ({selectedYear}).<br/>
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
                    <p className="content-subtitle">Select the destination, then upload the CSV.</p>
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
                            Batch Destination
                        </h3>

                        <button
                            onClick={downloadTemplate}
                            style={{
                                background: '#10b981', color: 'white', border: 'none', padding: '8px 16px',
                                borderRadius: '8px', fontSize: '13px', fontWeight: '700', cursor: 'pointer',
                                display: 'inline-flex', alignItems: 'center', gap: '8px',
                                boxShadow: '0 4px 6px rgba(16, 185, 129, 0.2)', transition: 'all 0.2s ease'
                            }}
                        >
                            <i className="fas fa-file-csv" style={{ fontSize: '14px' }}></i>
                            Download Clean Template
                        </button>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>

                        {/* 1. PROGRAM / COURSE SELECTOR */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>Select {hierarchyLabel} *</label>
                            <select
                                value={selectedDeptId}
                                onChange={(e) => {
                                    setSelectedDeptId(e.target.value);
                                    setSelectedYear(""); // Reset year when course changes
                                }}
                                className="modern-input"
                                style={{ width: '100%', padding: '12px', background: '#fff' }}
                            >
                                <option value="">-- Choose {hierarchyLabel} --</option>
                                {departments.map(dept => (
                                    <option key={dept.id} value={dept.id}>{dept.name} ({dept.durationInYears} Yrs)</option>
                                ))}
                            </select>
                        </div>

                        {/* 2. YEAR SELECTOR */}
                        <div>
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#64748b', fontSize: '13px' }}>Select Year *</label>
                            <select
                                value={selectedYear}
                                onChange={(e) => setSelectedYear(e.target.value)}
                                disabled={!selectedDeptId}
                                className="modern-input"
                                style={{ width: '100%', padding: '12px', background: !selectedDeptId ? '#f1f5f9' : '#fff', opacity: !selectedDeptId ? 0.6 : 1 }}
                            >
                                <option value="">{selectedDeptId ? "-- Choose Year --" : `Select ${hierarchyLabel} First`}</option>
                                {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                            </select>
                        </div>

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
                                    {DIVISIONS.map(div => <option key={div} value={div}>Division {div}</option>)}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Upload Card */}
                <div className="card" style={{ opacity: (!selectedDeptId || !selectedYear) ? 0.5 : 1, pointerEvents: (!selectedDeptId || !selectedYear) ? 'none' : 'auto', transition: '0.3s' }}>
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
                            disabled={loading || !selectedDeptId || !selectedYear}
                        />
                        <label htmlFor="csvUpload" style={{ cursor: loading ? 'not-allowed' : 'pointer', width: '100%', height: '100%', display: 'block' }}>
                            <div style={{ fontSize: '40px', color: '#3b82f6', marginBottom: '15px' }}>
                                <i className={loading ? "fas fa-cog fa-spin" : "fas fa-cloud-upload-alt"}></i>
                            </div>
                            <h4 style={{ margin: '0 0 5px 0', color: '#1e293b' }}>
                                {loading ? 'Processing Files...' : `Upload to ${selectedDeptObj?.name || '...'} (${selectedYear || '...'})`}
                            </h4>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>
                                CSV must contain: Name, Email, Roll No
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