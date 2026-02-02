import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function ManageTimetable({ hodInfo }) {
    const [year, setYear] = useState('FE'); // ✅ Changed from 'semester' to 'year'
    const [day, setDay] = useState('Monday');
    const [loading, setLoading] = useState(false);

    // Editor State
    const [slots, setSlots] = useState([]);

    // Full Weekly Data State
    const [weeklySchedule, setWeeklySchedule] = useState({});
    const [loadingWeek, setLoadingWeek] = useState(false);

    // Standard Grid Times
    const timeGrid = [
        "10:00 - 11:00",
        "11:00 - 12:00",
        "12:00 - 01:00",
        "01:00 - 02:00",
        "02:00 - 03:00",
        "03:00 - 04:00"
    ];

    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const years = ['FE', 'SE', 'TE', 'BE']; // ✅ Year Options

    // --- 1. FETCH EDITOR DATA (Single Day) ---
    useEffect(() => {
        const fetchDailySlot = async () => {
            if (!hodInfo?.department) return;
            // ✅ Doc ID now uses Year (e.g., DYP_IT_FE_Monday)
            const docId = `${hodInfo.instituteId}_${hodInfo.department}_${year}_${day}`;
            const docRef = doc(db, 'timetables', docId);
            try {
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setSlots(docSnap.data().slots || []);
                } else {
                    // Initialize empty standard slots
                    const initialSlots = timeGrid.map(time => ({
                        startTime: time.split(' - ')[0],
                        endTime: time.split(' - ')[1],
                        subject: '',
                        type: 'Lecture'
                    }));
                    setSlots(initialSlots);
                }
            } catch (err) {
                console.error(err);
                toast.error("Error loading day schedule");
            }
        };
        fetchDailySlot();
    }, [year, day, hodInfo]);

    // --- 2. FETCH FULL WEEKLY PREVIEW ---
    const fetchWeeklySchedule = async () => {
        if (!hodInfo?.department) return;
        setLoadingWeek(true);
        const weekData = {};

        try {
            const promises = weekDays.map(async (d) => {
                // ✅ Fetch based on Year
                const docId = `${hodInfo.instituteId}_${hodInfo.department}_${year}_${d}`;
                const docSnap = await getDoc(doc(db, 'timetables', docId));
                if (docSnap.exists()) {
                    weekData[d] = docSnap.data().slots;
                } else {
                    weekData[d] = [];
                }
            });
            await Promise.all(promises);
            setWeeklySchedule(weekData);
        } catch (error) {
            console.error("Error fetching weekly view:", error);
        } finally {
            setLoadingWeek(false);
        }
    };

    // Fetch weekly schedule whenever Year changes
    useEffect(() => {
        fetchWeeklySchedule();
    }, [year, hodInfo]);

    // --- 3. HANDLERS ---
    const handleSlotChange = (index, field, value) => {
        const newSlots = [...slots];
        newSlots[index][field] = value;
        setSlots(newSlots);
    };

    const handleSave = async () => {
        setLoading(true);
        const toastId = toast.loading("Saving Timetable...");
        try {
            const docId = `${hodInfo.instituteId}_${hodInfo.department}_${year}_${day}`;
            await setDoc(doc(db, 'timetables', docId), {
                instituteId: hodInfo.instituteId,
                department: hodInfo.department,
                year: year, // ✅ Save Year
                day: day,
                slots: slots,
                updatedAt: serverTimestamp()
            });
            toast.success("Saved Successfully!", { id: toastId });

            // Refresh the Weekly View after saving
            fetchWeeklySchedule();

        } catch (error) {
            toast.error("Failed to save.", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // --- 🎨 HELPERS ---
    const getStyles = (type) => {
        switch (type) {
            case 'Lab': return { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe', icon: 'fa-flask' };
            case 'Break': return { bg: '#fff7ed', color: '#c2410c', border: '#fed7aa', icon: 'fa-mug-hot' };
            case 'Free': return { bg: '#f0fdf4', color: '#15803d', border: '#bbf7d0', icon: 'fa-smile' };
            default: return { bg: '#ffffff', color: '#334155', border: '#e2e8f0', icon: 'fa-book' };
        }
    };

    return (
        <div className="content-section">
            {/* --- HEADER --- */}
            <div className="mobile-header-stack" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', gap: '15px', marginTop: '15px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <div style={{ width: '45px', height: '45px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '20px', boxShadow: '0 4px 10px rgba(37, 99, 235, 0.3)' }}>
                        <i className="fas fa-calendar-alt"></i>
                    </div>
                    <div>
                        <h2 className="content-title" style={{ margin: 0, fontSize: '22px', color: '#1e293b' }}>Manage Timetable</h2>
                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '13px' }}>Configure weekly schedule for <strong>{year} Year</strong>.</p>
                    </div>
                </div>
                <button
                    onClick={handleSave}
                    className="btn-primary btn-mobile-full"
                    disabled={loading}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 24px', width: 'auto', borderRadius: '10px', fontSize: '14px', fontWeight: '600' }}
                >
                    {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                    <span>{loading ? 'Saving...' : 'Save Changes'}</span>
                </button>
            </div>

            {/* --- FILTERS & EDITOR --- */}
            <div className="card" style={{ padding: '25px', border: 'none', boxShadow: '0 4px 20px -5px rgba(0,0,0,0.05)', borderRadius: '16px', marginBottom: '30px', background: 'white' }}>
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '20px' }}>

                    {/* ✅ YEAR SELECTION (Native Dropdown for Android Reliability) */}
                    <div className="input-group" style={{ flex: 1, minWidth: '180px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Class Year</label>
                        <div style={{ position: 'relative' }}>
                            <i className="fas fa-graduation-cap" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                            <select value={year} onChange={e => setYear(e.target.value)} className="modern-select" style={{ paddingLeft: '35px' }}>
                                {years.map(y => <option key={y} value={y}>{y} Year</option>)}
                            </select>
                            <i className="fas fa-chevron-down" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1', pointerEvents: 'none', fontSize: '12px' }}></i>
                        </div>
                    </div>

                    <div className="input-group" style={{ flex: 1, minWidth: '180px' }}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Day to Edit</label>
                        <div style={{ position: 'relative' }}>
                            <i className="fas fa-edit" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                            <select value={day} onChange={e => setDay(e.target.value)} className="modern-select" style={{ paddingLeft: '35px' }}>
                                {weekDays.map(d => <option key={d} value={d}>{d}</option>)}
                            </select>
                            <i className="fas fa-chevron-down" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: '#cbd5e1', pointerEvents: 'none', fontSize: '12px' }}></i>
                        </div>
                    </div>
                </div>

                <div className="card" style={{ padding: '0', overflow: 'hidden', borderRadius: '16px' }}>
                    {/* ✅ FIX: Added dedicated scroll wrapper for mobile */}
                    <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                        <table className="attendance-table" style={{ minWidth: '800px', width: '100%' }}>
                            <thead>
                                <tr style={{ background: '#f8fafc' }}>
                                    <th style={{ width: '250px', padding: '15px' }}>Time Slot</th>
                                    <th style={{ minWidth: '250px' }}>Subject</th>
                                    <th style={{ width: '200px' }}>Type</th>
                                </tr>
                            </thead>
                            <tbody>
                                {slots.map((slot, index) => (
                                    <tr key={index}>
                                        <td style={{ padding: '10px' }}>
                                            {/* ✅ FIX: Native Android Time Picker Support */}
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#fff', padding: '5px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                                <input
                                                    type="time"
                                                    value={slot.startTime}
                                                    onChange={e => handleSlotChange(index, 'startTime', e.target.value)}
                                                    className="mobile-time-fix"
                                                />
                                                <span style={{ fontSize: '12px' }}>to</span>
                                                <input
                                                    type="time"
                                                    value={slot.endTime}
                                                    onChange={e => handleSlotChange(index, 'endTime', e.target.value)}
                                                    className="mobile-time-fix"
                                                />
                                            </div>
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <input
                                                type="text"
                                                placeholder="Subject Name"
                                                value={slot.subject}
                                                onChange={(e) => handleSlotChange(index, 'subject', e.target.value)}
                                                className="subject-input-modern"
                                            />
                                        </td>
                                        <td style={{ padding: '10px' }}>
                                            <select
                                                value={slot.type}
                                                onChange={(e) => handleSlotChange(index, 'type', e.target.value)}
                                                className="type-select-modern"
                                                style={{ width: '100%', height: '45px' }} // Height fix for Android tap area
                                            >
                                                <option value="Lecture">Lecture</option>
                                                <option value="Lab">Lab</option>
                                                <option value="Break">Break</option>
                                                <option value="Free">Free</option>
                                            </select>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* --- FULL WEEKLY PREVIEW --- */}
            <div className="card" style={{ padding: '0', border: 'none', boxShadow: '0 10px 40px -10px rgba(0,0,0,0.08)', borderRadius: '20px', overflow: 'hidden', background: 'white' }}>
                <div style={{ padding: '20px 25px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <i className="fas fa-table" style={{ color: '#2563eb' }}></i> Full Weekly Schedule ({year} Year)
                    </h3>
                    <button onClick={fetchWeeklySchedule} style={{ background: 'white', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', color: '#64748b' }}>
                        <i className="fas fa-sync-alt"></i> Refresh
                    </button>
                </div>

                <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                    <table className="attendance-table" style={{ minWidth: '1000px', width: '100%' }}>
                        <thead>
                            <tr style={{ background: 'white', borderBottom: '2px solid #f1f5f9' }}>
                                <th style={{ width: '100px', padding: '15px', textAlign: 'center', color: '#94a3b8', fontSize: '11px', textTransform: 'uppercase' }}>Day / Time</th>
                                {timeGrid.map((time, i) => (
                                    <th key={i} style={{ padding: '15px', textAlign: 'center', color: '#475569', fontSize: '12px', fontWeight: '700', borderLeft: '1px solid #f8fafc' }}>
                                        {time}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {loadingWeek ? (
                                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>Loading weekly data...</td></tr>
                            ) : (
                                weekDays.map((d) => (
                                    <tr key={d} style={{ borderBottom: '1px solid #f8fafc' }}>
                                        <td style={{ padding: '15px', fontWeight: '700', color: '#1e293b', fontSize: '13px', background: '#fcfcfc', borderRight: '1px solid #f1f5f9', textAlign: 'center' }}>
                                            {d.substring(0, 3)}
                                        </td>
                                        {timeGrid.map((timeStr, timeIdx) => {
                                            const daySlots = weeklySchedule[d] || [];
                                            const slot = daySlots.find(s => s.startTime === timeStr.split(' - ')[0]) || {};
                                            const style = slot.type ? getStyles(slot.type) : { bg: 'white', color: '#cbd5e1' };

                                            return (
                                                <td key={timeIdx} style={{ padding: '8px', borderLeft: '1px solid #f8fafc', verticalAlign: 'middle' }}>
                                                    {slot.subject ? (
                                                        <div style={{ background: style.bg, padding: '8px', borderRadius: '8px', border: `1px solid ${style.border || '#f1f5f9'}`, textAlign: 'center', minHeight: '50px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                                                            <div style={{ fontSize: '12px', fontWeight: '700', color: style.color, marginBottom: '2px', lineHeight: '1.2' }}>{slot.subject}</div>
                                                            {slot.type !== 'Lecture' && <div style={{ fontSize: '10px', opacity: 0.8, color: style.color }}>{slot.type}</div>}
                                                        </div>
                                                    ) : (
                                                        <div style={{ textAlign: 'center', color: '#e2e8f0', fontSize: '18px' }}>-</div>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* CSS Styles */}
            <style>{`
                .modern-select { width: 100%; padding: 12px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 14px; color: #334155; background: white; appearance: none; cursor: pointer; transition: all 0.2s; font-weight: 500; }
                .modern-select:focus { border-color: #3b82f6; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); outline: none; }
                
                /* ✅ FIXED: Increased width to 110px so text fits comfortably */
                .time-input-clean { border: none; outline: none; font-size: 13px; font-weight: 700; color: #475569; width: 110px; background: transparent; font-family: 'Inter', sans-serif; cursor: pointer; }
                
                .subject-input-modern { width: 100%; padding: 12px 15px; border-radius: 10px; border: 1px solid #e2e8f0; font-size: 14px; outline: none; transition: all 0.2s; font-weight: 500; }
                .subject-input-modern:focus { border-color: #3b82f6 !important; box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1); }
                .type-select-modern { width: 100%; padding: 10px 15px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; appearance: none; border: 1px solid transparent; transition: all 0.2s; }
                .type-select-modern:focus { opacity: 0.9; }
                @media (max-width: 768px) {
                    .mobile-header-stack { flex-direction: column; align-items: flex-start; gap: 15px; }
                    .btn-mobile-full { width: 100%; justify-content: center; }
                }
            `}</style>
            <style>{`
    .mobile-time-fix {
        border: none;
        background: transparent;
        font-size: 14px;
        width: 100px;
        height: 40px; /* Bigger tap area for Android */
        color: #334155;
        font-weight: 600;
    }
    @media (max-width: 600px) {
        .attendance-table { font-size: 14px; }
    }
`}</style>
        </div>
    );
}