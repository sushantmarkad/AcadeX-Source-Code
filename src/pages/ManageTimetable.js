import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

// --- 🎨 INTERNAL CSS ---
const styles = `
    .timetable-grid-row {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
        margin-bottom: 15px;
    }
    
    /* Toggle Switch Styles */
    .view-toggle {
        display: flex;
        background: #f1f5f9;
        padding: 5px;
        border-radius: 12px;
        margin-bottom: 20px;
    }
    .view-toggle button {
        flex: 1;
        padding: 10px;
        border: none;
        border-radius: 8px;
        font-weight: 700;
        font-size: 13px;
        cursor: pointer;
        transition: all 0.3s ease;
        color: #64748b;
        background: transparent;
    }
    .view-toggle button.active {
        background: white;
        color: #2563eb;
        box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }

    /* Table Styles */
    .timetable-container {
        overflow-x: auto;
        border-radius: 12px;
        border: 1px solid #e2e8f0;
    }
    .modern-table {
        width: 100%;
        border-collapse: collapse;
        min-width: 600px; /* Forces scroll on mobile */
    }
    .modern-table th {
        background: #f8fafc;
        color: #475569;
        font-weight: 700;
        text-transform: uppercase;
        font-size: 12px;
        padding: 15px;
        text-align: left;
        border-bottom: 2px solid #e2e8f0;
        width: 100px;
    }
    .modern-table td {
        padding: 12px;
        border-bottom: 1px solid #f1f5f9;
        vertical-align: top;
    }
    .modern-table tr:last-child td {
        border-bottom: none;
    }
    
    /* Slot Badges in Table */
    .slot-badge {
        display: inline-block;
        padding: 6px 10px;
        border-radius: 8px;
        margin: 0 8px 8px 0;
        font-size: 12px;
        border: 1px solid transparent;
    }
    .slot-badge.Lecture { background: #eff6ff; color: #2563eb; border-color: #dbeafe; }
    .slot-badge.Practical { background: #f0fdf4; color: #16a34a; border-color: #bbf7d0; }
    .slot-badge.Break { background: #fef2f2; color: #dc2626; border-color: #fecaca; }

    @media (max-width: 768px) {
        .timetable-grid-row {
            grid-template-columns: 1fr; 
            gap: 10px;
        }
        .action-buttons-container {
            position: fixed;
            bottom: 85px;
            left: 15px;
            right: 15px;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            padding: 12px;
            border-radius: 20px;
            box-shadow: 0 10px 40px -10px rgba(0,0,0,0.2);
            z-index: 999; 
            display: flex;
            gap: 10px;
            border: 1px solid #f1f5f9;
            animation: slideUp 0.3s ease-out;
        }
        .timetable-card-body {
            padding-bottom: 180px !important; 
        }
        @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }
    }
`;

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
                        {options.find(o => o.value === value)?.label || value}
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

// --- ⏰ HELPER: CUSTOM TIME PICKER ---
const CustomTimePicker = ({ label, value, onChange }) => {
    const [h, m] = (value || "09:00").split(':');
    let hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12; 

    const handleUpdate = (type, val) => {
        let newH = parseInt(h);
        let newM = parseInt(m);

        if (type === 'hour') {
            const isPM = newH >= 12;
            newH = (parseInt(val) % 12) + (isPM ? 12 : 0);
            if (newH === 12 && !isPM) newH = 0; 
            if (newH === 12 && isPM) newH = 12;
        }
        if (type === 'minute') newM = parseInt(val);
        if (type === 'ampm') {
            if (val === 'AM' && newH >= 12) newH -= 12;
            if (val === 'PM' && newH < 12) newH += 12;
        }

        const strH = newH.toString().padStart(2, '0');
        const strM = newM.toString().padStart(2, '0');
        onChange(`${strH}:${strM}`);
    };

    return (
        <div style={{ marginBottom: '5px' }}>
            <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '6px', display: 'block', textTransform: 'uppercase' }}>{label}</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <CustomMobileSelect 
                    label="Hr"
                    value={hour.toString()} 
                    options={Array.from({length:12}, (_, i) => ({ value: (i+1).toString(), label: (i+1).toString() }))} 
                    onChange={(v) => handleUpdate('hour', v)} 
                />
                <CustomMobileSelect 
                    label="Min"
                    value={parseInt(m).toString()} 
                    options={['00', '15', '30', '45', '10', '20', '50'].map(min => ({ value: parseInt(min).toString(), label: min }))} 
                    onChange={(v) => handleUpdate('minute', v)} 
                />
                <div style={{ marginTop: '23px', display: 'flex', borderRadius: '12px', overflow: 'hidden', border: '2px solid #e2e8f0', height: '48px' }}>
                    {['AM', 'PM'].map((p) => (
                        <button key={p} onClick={() => handleUpdate('ampm', p)} 
                            style={{ 
                                flex: 1, border: 'none', 
                                background: ampm === p ? '#3b82f6' : '#f8fafc', 
                                color: ampm === p ? 'white' : '#64748b', 
                                fontWeight: '700', fontSize: '12px' 
                            }}>
                            {p}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default function ManageTimetable({ hodInfo }) {
    // Include Styles
    useEffect(() => {
        const styleSheet = document.createElement("style");
        styleSheet.innerText = styles;
        document.head.appendChild(styleSheet);
        return () => document.head.removeChild(styleSheet);
    }, []);

    const isFE = hodInfo?.department === 'FE' || hodInfo?.department === 'First Year';

    const yearOptions = isFE 
        ? [{ value: 'FE', label: 'First Year (FE)' }] 
        : [
            { value: 'SE', label: 'Second Year (SE)' },
            { value: 'TE', label: 'Third Year (TE)' },
            { value: 'BE', label: 'Final Year (BE)' }
          ];

    const [viewMode, setViewMode] = useState('edit'); // 'edit' or 'table'
    const [year, setYear] = useState(isFE ? 'FE' : 'SE');
    const [division, setDivision] = useState('A'); 
    const [day, setDay] = useState('Monday');
    const [loading, setLoading] = useState(false);
    
    // Data States
    const [slots, setSlots] = useState([]); // Current Day Slots (For Edit Mode)
    const [fullSchedule, setFullSchedule] = useState({}); // Entire Week Data (For Table Mode)

    useEffect(() => {
        if(isFE && year !== 'FE') setYear('FE');
        if(!isFE && year === 'FE') setYear('SE');
    }, [isFE]);

    const weekDays = [
        { value: 'Monday', label: 'Monday' },
        { value: 'Tuesday', label: 'Tuesday' },
        { value: 'Wednesday', label: 'Wednesday' },
        { value: 'Thursday', label: 'Thursday' },
        { value: 'Friday', label: 'Friday' },
        { value: 'Saturday', label: 'Saturday' }
    ];

    const divisions = [
        { value: 'A', label: 'Div A' }, { value: 'B', label: 'Div B' }, { value: 'C', label: 'Div C' }, { value: 'D', label: 'Div D' },
        { value: 'E', label: 'Div E' }, { value: 'F', label: 'Div F' }, { value: 'G', label: 'Div G' }, { value: 'H', label: 'Div H' },
        { value: 'I', label: 'Div I' }, { value: 'J', label: 'Div J' }, { value: 'K', label: 'Div K' }, { value: 'L', label: 'Div L' }
    ];

    // --- FETCH TIMETABLE (Load Full Document) ---
    useEffect(() => {
        if (!hodInfo?.department) return;
        const fetchTimetable = async () => {
            setLoading(true);
            try {
                let docId = `${hodInfo.instituteId}_${hodInfo.department}_${year}_Timetable`;
                if (year === 'FE') {
                    docId = `${hodInfo.instituteId}_${hodInfo.department}_${year}_${division}_Timetable`;
                }

                const docRef = doc(db, 'timetables', docId);
                const docSnap = await getDoc(docRef);

                if (docSnap.exists()) {
                    const data = docSnap.data();
                    setFullSchedule(data); // Store Full Data
                    setSlots(data[day] || []); // Store Current Day Slots
                } else {
                    setFullSchedule({});
                    setSlots([]);
                }
            } catch (error) {
                console.error("Error fetching timetable:", error);
                toast.error("Failed to load timetable");
            } finally {
                setLoading(false);
            }
        };
        fetchTimetable();
    }, [hodInfo, year, day, division]); 

    // --- UPDATE HANDLERS ---
    const handleSlotChange = (index, field, value) => {
        const newSlots = [...slots];
        newSlots[index][field] = value;
        setSlots(newSlots);
    };

    const addSlot = () => {
        setSlots([...slots, { startTime: '09:00', endTime: '10:00', subject: '', type: 'Lecture', teacher: '' }]);
    };

    const removeSlot = (index) => {
        const newSlots = slots.filter((_, i) => i !== index);
        setSlots(newSlots);
    };

    const saveTimetable = async () => {
        setLoading(true);
        try {
            let docId = `${hodInfo.instituteId}_${hodInfo.department}_${year}_Timetable`;
            if (year === 'FE') {
                docId = `${hodInfo.instituteId}_${hodInfo.department}_${year}_${division}_Timetable`;
            }

            const docRef = doc(db, 'timetables', docId);
            
            // We update ONLY the specific day's array within the full document
            await setDoc(docRef, {
                [day]: slots,
                lastUpdated: serverTimestamp(),
                department: hodInfo.department,
                year: year,
                division: year === 'FE' ? division : null,
                instituteId: hodInfo.instituteId
            }, { merge: true });

            // Update local state to reflect changes in "View Mode" immediately
            setFullSchedule(prev => ({ ...prev, [day]: slots }));

            toast.success(`${day} Timetable Updated!`);
        } catch (error) {
            console.error("Error saving:", error);
            toast.error("Failed to save changes");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="card fade-in-up" style={{ 
            background: 'white', borderRadius: '24px', border: 'none', 
            boxShadow: '0 20px 50px -10px rgba(0,0,0,0.1)', overflow: 'visible', 
            position: 'relative', marginBottom: '30px', zIndex: 5 
        }}>
            
            {/* --- HEADER --- */}
            <div style={{ 
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', 
                padding: '25px', position: 'relative', borderRadius: '24px 24px 0 0', overflow: 'hidden'
            }}>
                <div style={{ position: 'relative', zIndex: 2 }}>
                    <h3 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: '800', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-calendar-alt"></i> Manage Timetable
                    </h3>
                    <p style={{ color: 'rgba(255,255,255,0.8)', margin: '5px 0 0 0', fontSize: '13px' }}>
                        {year === 'FE' ? `Scheduling for FE - Div ${division}` : `Scheduling for ${year} Department`}
                    </p>
                </div>
                <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
                <div style={{ position: 'absolute', bottom: '-10px', left: '20px', width: '60px', height: '60px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%' }}></div>
            </div>

            {/* --- CONTROLS --- */}
            <div className="timetable-card-body" style={{ padding: '20px' }}>
                
                {/* 1. Filter Controls */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '20px' }}>
                    <div style={{ flex: '1 1 120px' }}><CustomMobileSelect label="Class" icon="fa-graduation-cap" value={year} onChange={setYear} options={yearOptions} /></div>
                    {year === 'FE' && (<div style={{ flex: '1 1 100px' }}><CustomMobileSelect label="Division" icon="fa-users" value={division} onChange={setDivision} options={divisions} /></div>)}
                    {/* Only show Day Selector in Edit Mode */}
                    {viewMode === 'edit' && (
                        <div style={{ flex: '1 1 120px' }}><CustomMobileSelect label="Day to Edit" icon="fa-calendar-day" value={day} onChange={setDay} options={weekDays} /></div>
                    )}
                </div>

                {/* 2. View Switcher */}
                <div className="view-toggle">
                    <button className={viewMode === 'edit' ? 'active' : ''} onClick={() => setViewMode('edit')}>
                        <i className="fas fa-edit"></i> Edit Mode
                    </button>
                    <button className={viewMode === 'table' ? 'active' : ''} onClick={() => setViewMode('table')}>
                        <i className="fas fa-table"></i> View Full Table
                    </button>
                </div>

                <div style={{ borderTop: '1px solid #f1f5f9', margin: '10px 0 20px 0' }}></div>

                {/* --- MAIN CONTENT AREA --- */}
                
                {loading ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}><i className="fas fa-circle-notch fa-spin fa-2x"></i></div>
                ) : (
                    <>
                        {/* ================= VIEW MODE: TABLE ================= */}
                        {viewMode === 'table' && (
                            <div className="timetable-container fade-in-up">
                                <table className="modern-table">
                                    <thead>
                                        <tr>
                                            <th>Day</th>
                                            <th>Schedule</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {weekDays.map((wd) => {
                                            const daySlots = fullSchedule[wd.value] || [];
                                            return (
                                                <tr key={wd.value}>
                                                    <td>{wd.label}</td>
                                                    <td>
                                                        {daySlots.length === 0 ? (
                                                            <span style={{ color: '#cbd5e1', fontSize: '13px', fontStyle: 'italic' }}>No classes</span>
                                                        ) : (
                                                            <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                                                                {daySlots.map((s, i) => (
                                                                    <div key={i} className={`slot-badge ${s.type || 'Lecture'}`}>
                                                                        <b>{s.startTime} - {s.endTime}</b>
                                                                        <br/>
                                                                        {s.subject || 'Untitled'}
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* ================= VIEW MODE: EDITOR ================= */}
                        {viewMode === 'edit' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {slots.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '30px', background: '#f8fafc', borderRadius: '16px', border: '2px dashed #e2e8f0' }}>
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '14px', fontWeight: '600' }}>No lectures for {day}.</p>
                                    </div>
                                )}

                                {slots.map((slot, index) => (
                                    <div key={index} className="fade-in-up" style={{ 
                                        background: 'white', border: '1px solid #e2e8f0', borderRadius: '16px', 
                                        padding: '20px', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)', position: 'relative', zIndex: 1 
                                    }}>
                                        <button onClick={() => removeSlot(index)} style={{ position: 'absolute', top: '15px', right: '15px', background: '#fee2e2', color: '#ef4444', width: '32px', height: '32px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className="fas fa-trash-alt" style={{ fontSize: '14px' }}></i></button>

                                        <div className="timetable-grid-row">
                                            <CustomTimePicker label="Start Time" value={slot.startTime} onChange={(val) => handleSlotChange(index, 'startTime', val)} />
                                            <CustomTimePicker label="End Time" value={slot.endTime} onChange={(val) => handleSlotChange(index, 'endTime', val)} />
                                        </div>

                                        <div style={{ marginBottom: '15px' }}>
                                            <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block', textTransform: 'uppercase' }}>Subject Name</label>
                                            <input type="text" placeholder="e.g. Data Structures" value={slot.subject} onChange={(e) => handleSlotChange(index, 'subject', e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: '600', fontSize: '14px', outline: 'none' }} />
                                        </div>

                                        <CustomMobileSelect label="Session Type" value={slot.type} onChange={(val) => handleSlotChange(index, 'type', val)} options={[{ value: 'Lecture', label: 'Theory Lecture' }, { value: 'Practical', label: 'Practical / Lab' }, { value: 'Break', label: 'Break / Recess' }]} />
                                    </div>
                                ))}

                                {/* --- ACTIONS (STICKY ON MOBILE) --- */}
                                <div className="action-buttons-container" style={{ display: 'flex', gap: '15px', marginTop: '10px' }}>
                                    <button onClick={addSlot} style={{ flex: 1, padding: '16px', background: '#eff6ff', color: '#2563eb', border: '2px dashed #bfdbfe', borderRadius: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <i className="fas fa-plus"></i> Add Slot
                                    </button>
                                    <button onClick={saveTimetable} style={{ flex: 1, padding: '16px', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', color: 'white', border: 'none', borderRadius: '14px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 15px rgba(37, 99, 235, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                        <i className="fas fa-save"></i> Save Day
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}