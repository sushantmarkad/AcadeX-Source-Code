import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import './Dashboard.css';

export default function ManageTimetable({ hodInfo }) {
    const [semester, setSemester] = useState('1');
    const [day, setDay] = useState('Monday');
    const [loading, setLoading] = useState(false);
    
    // ✅ Empty by default so HOD can build it
    const [slots, setSlots] = useState([]);

    // Fetch Data
    useEffect(() => {
        const fetchTimetable = async () => {
            if (!hodInfo?.department) return;
            const docId = `${hodInfo.department}_Sem${semester}_${day}`;
            const docRef = doc(db, 'timetables', docId);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                setSlots(docSnap.data().slots);
            } else {
                // Default starter slot if empty
                setSlots([{ startTime: '09:00', endTime: '10:00', subject: '', type: 'Lecture' }]); 
            }
        };
        fetchTimetable();
    }, [semester, day, hodInfo]);

    // ✅ Add New Slot Row
    const addSlot = () => {
        setSlots([...slots, { startTime: '', endTime: '', subject: '', type: 'Lecture' }]);
    };

    // ✅ Remove Slot Row
    const removeSlot = (index) => {
        const newSlots = slots.filter((_, i) => i !== index);
        setSlots(newSlots);
    };

    // Handle Changes
    const handleSlotChange = (index, field, value) => {
        const newSlots = [...slots];
        newSlots[index][field] = value;
        setSlots(newSlots);
    };

    const handleSave = async () => {
        setLoading(true);
        const toastId = toast.loading("Saving Timetable...");
        try {
            const docId = `${hodInfo.department}_Sem${semester}_${day}`;
            await setDoc(doc(db, 'timetables', docId), {
                department: hodInfo.department,
                semester: semester,
                day: day,
                slots: slots,
                updatedAt: new Date()
            });
            toast.success("Timetable Saved!", { id: toastId });
        } catch (error) {
            toast.error("Failed to save.", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="content-section">
            <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px'}}>
                <h2 className="content-title">Manage Timetable</h2>
                {/* ✅ ADDED btn-mobile-auto to prevent stretching on mobile */}
                <button onClick={handleSave} className="btn-primary btn-mobile-auto" style={{width:'auto', padding:'10px 20px'}} disabled={loading}>
                    {loading ? "Saving..." : "Save Changes"}
                </button>
            </div>

            <div className="card">
                {/* Filters */}
                <div style={{display: 'flex', gap: '15px', marginBottom: '25px', flexWrap:'wrap'}}>
                    <div className="input-group" style={{flex: 1}}>
                        <label>Semester</label>
                        <select value={semester} onChange={e => setSemester(e.target.value)}>
                            {[1,2,3,4,5,6,7,8].map(n => <option key={n} value={n}>Semester {n}</option>)}
                        </select>
                    </div>
                    <div className="input-group" style={{flex: 1}}>
                        <label>Day</label>
                        <select value={day} onChange={e => setDay(e.target.value)}>
                            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                    </div>
                </div>

                {/* Slots Editor */}
                <div className="table-wrapper">
                    <table className="attendance-table">
                        <thead>
                            <tr>
                                <th style={{width:'140px'}}>Time (Start - End)</th>
                                <th>Subject / Activity</th>
                                <th style={{width:'120px'}}>Type</th>
                                <th style={{width:'50px'}}></th>
                            </tr>
                        </thead>
                        <tbody>
                            {slots.map((slot, index) => (
                                <tr key={index}>
                                    <td>
                                        <div style={{display:'flex', alignItems:'center', gap:'5px'}}>
                                            <input type="time" value={slot.startTime} onChange={e => handleSlotChange(index, 'startTime', e.target.value)} style={{padding:'6px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'13px'}} />
                                            <span>-</span>
                                            <input type="time" value={slot.endTime} onChange={e => handleSlotChange(index, 'endTime', e.target.value)} style={{padding:'6px', borderRadius:'6px', border:'1px solid #e2e8f0', fontSize:'13px'}} />
                                        </div>
                                    </td>
                                    <td>
                                        <input 
                                            type="text" 
                                            placeholder="Subject Name"
                                            value={slot.subject}
                                            onChange={(e) => handleSlotChange(index, 'subject', e.target.value)}
                                            style={{width: '100%', padding:'8px', border:'1px solid #e2e8f0', borderRadius:'6px'}}
                                        />
                                    </td>
                                    <td>
                                        <select 
                                            value={slot.type}
                                            onChange={(e) => handleSlotChange(index, 'type', e.target.value)}
                                            style={{width: '100%', padding:'8px', border:'1px solid #e2e8f0', borderRadius:'6px', backgroundColor: slot.type === 'Break' ? '#fef3c7' : slot.type === 'Lab' ? '#e0f2fe' : 'white'}}
                                        >
                                            <option value="Lecture">Lecture</option>
                                            <option value="Lab">Lab</option>
                                            <option value="Break">Break</option>
                                            <option value="Free">Free</option>
                                        </select>
                                    </td>
                                    <td style={{textAlign:'center'}}>
                                        <button onClick={() => removeSlot(index)} style={{background:'transparent', border:'none', color:'#ef4444', cursor:'pointer', fontSize:'16px'}}>
                                            <i className="fas fa-trash"></i>
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                
                <button onClick={addSlot} className="btn-secondary" style={{marginTop:'15px', width:'100%', borderStyle:'dashed'}}>
                    + Add New Slot
                </button>
            </div>
        </div>
    );
}