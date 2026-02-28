import React, { useState, useEffect } from 'react';
import { signOut, updatePassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage, sendPasswordResetEmail } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, getDocs, collection, query, where, onSnapshot, deleteDoc, addDoc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
import toast from 'react-hot-toast';
import {
    PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from 'recharts';
import { Timestamp } from 'firebase/firestore';
import logo from "../assets/logo.png";
import './Dashboard.css';
import './HODDashboard.css';
import TwoFactorSetup from '../components/TwoFactorSetup'; // ✅ Add this import
import CustomDropdown from '../components/CustomDropdown';
import ReactDOM from 'react-dom';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


import ManageTimetable from './ManageTimetable';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

// --- 📱 SPECIAL MOBILE DROPDOWN (Fixed Spacing) ---
const CustomMobileSelect = ({ label, value, onChange, options, icon }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        // ✅ Removed marginBottom: '15px' to fix gap issue
        <div className="custom-select-container" style={{ position: 'relative', width: '100%' }}>
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
                    transition: 'all 0.2s ease', width: '100%' // ✅ Force full width
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                    {icon && <i className={`fas ${icon}`} style={{ color: '#3b82f6' }}></i>}
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {options.find(o => o.value == value)?.label || "Select..."}
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
                                    color: value == opt.value ? '#2563eb' : '#475569',
                                    fontWeight: value == opt.value ? '700' : '600',
                                    background: value == opt.value ? '#eff6ff' : 'transparent',
                                    cursor: 'pointer', fontSize: '13px'
                                }}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                    {/* Overlay to close when clicking outside */}
                    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99 }} onClick={() => setIsOpen(false)}></div>
                </>
            )}
        </div>
    );
};

export default function HODDashboard() {
    const [hodInfo, setHodInfo] = useState(null);
    const [studentRequests, setStudentRequests] = useState([]);
    const [deptUsers, setDeptUsers] = useState([]);
    const [leaves, setLeaves] = useState([]);
    const [totalClasses, setTotalClasses] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [analyticsFilter, setAnalyticsFilter] = useState('Overall');
    // --- ✅ FIXED: SPLIT STATE FOR RELIABLE UPDATES ---
    const [allSessions, setAllSessions] = useState([]);
    const [studentAttendanceMap, setStudentAttendanceMap] = useState({}); // { uid: { theory: 5, practical: 2 } }
    const [annoTab, setAnnoTab] = useState('create');
    const [isEditStudentModalOpen, setIsEditStudentModalOpen] = useState(false);
    const [editStudentData, setEditStudentData] = useState(null);

    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    // ✅ NEW STATES
    const [annoFile, setAnnoFile] = useState(null); // For Announcement File
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' }); // For Password Update

    // Timetable States
    const [timetableYear, setTimetableYear] = useState('FE');
    const [currentAcademicYear, setCurrentAcademicYear] = useState('2025-2026');
    const [timetableData, setTimetableData] = useState({});
    const [isSavingTimetable, setIsSavingTimetable] = useState(false);
    const [activeSemesters, setActiveSemesters] = useState({ FE: 1, SE: 3, TE: 5, BE: 7 });

    // Attendance Graph State
    const [attendanceGraph, setAttendanceGraph] = useState([]);
    const [timeRange, setTimeRange] = useState('week');
    const [isEditTeacherModalOpen, setIsEditTeacherModalOpen] = useState(false);
    const [editTeacherData, setEditTeacherData] = useState(null);

    // ✅ Announcement State (Fixed naming consistency)
    const [announcements, setAnnouncements] = useState([]);
    const [announcementForm, setAnnouncementForm] = useState({ title: '', message: '', targetYear: 'All' });

    const [modal, setModal] = useState({ isOpen: false, title: '', message: '', onConfirm: null, type: 'info' });
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

    // ✅ Teacher Form (Includes Phone)
    const [teacherForm, setTeacherForm] = useState({
        firstName: '', lastName: '', email: '', password: '', phone: '', // Added phone
        academicYear: '2024-2025',
        assignedClasses: []
    });
    const [feedbackForm, setFeedbackForm] = useState({
        title: '',
        targetYear: 'All',
        division: 'All',
        questions: [{ id: Date.now(), type: 'mcq', text: '', options: ['', ''] }]
    });
    // HOD Feedback Viewer States
    const [fbTab, setFbTab] = useState('create'); // 'create' or 'view'
    const [hodCreatedForms, setHodCreatedForms] = useState([]);
    const [selectedFormToView, setSelectedFormToView] = useState(null);
    const [formResponses, setFormResponses] = useState([]);
    const [isResponsesLoading, setIsResponsesLoading] = useState(false);
    const [editingFormId, setEditingFormId] = useState(null);



    // ✅ Profile Editing State
    const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', qualification: '', phone: '' });
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [analyticsYear, setAnalyticsYear] = useState('FE');
    const [criteria, setCriteria] = useState({ FE: 75, SE: 75, TE: 75, BE: 75 });

    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [analyticsDivision, setAnalyticsDivision] = useState('All');
    const [classCounts, setClassCounts] = useState({}); // Stores counts like { FE: 10, SE: 20 } or { A: 5, B: 5 }
    const DIVISIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'];
    const isFE = hodInfo?.department === 'FE' || hodInfo?.department === 'First Year';

    useEffect(() => {
        const init = async () => {
            if (!auth.currentUser) return;
            const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
            if (userDoc.exists()) {
                const data = userDoc.data();
                setHodInfo(data);

                // Initialize Profile Form
                setProfileForm({
                    firstName: data.firstName || '',
                    lastName: data.lastName || '',
                    qualification: data.qualification || '',
                    phone: data.phone || ''
                });

                // ✅ UPDATED: Fetch Stats AND Active Academic Year
                const statsRef = doc(db, "department_stats", `${data.instituteId}_${data.department}`);
                const statsDoc = await getDoc(statsRef);

                if (statsDoc.exists()) {
                    setTotalClasses(statsDoc.data().totalClasses || 0);
                    setActiveSemesters(statsDoc.data().activeSemesters || { FE: 1, SE: 3, TE: 5, BE: 7 });

                    // 👇 Load Active Year
                    if (statsDoc.data().currentAcademicYear) {
                        setCurrentAcademicYear(statsDoc.data().currentAcademicYear);
                    }
                } else {
                    // 👇 Create Default if missing
                    const defaultSems = { FE: 1, SE: 3, TE: 5, BE: 7 };
                    await setDoc(statsRef, {
                        activeSemesters: defaultSems,
                        totalClasses: 0,
                        currentAcademicYear: '2025-2026'
                    }, { merge: true });
                    setActiveSemesters(defaultSems);
                }
                // Fetch Requests
                const qRequests = query(collection(db, 'student_requests'), where('instituteId', '==', data.instituteId), where('department', '==', data.department), where('status', '==', 'pending'));
                onSnapshot(qRequests, (snap) => setStudentRequests(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // Fetch Users
                const qUsers = query(collection(db, 'users'), where('instituteId', '==', data.instituteId), where('department', '==', data.department));
                onSnapshot(qUsers, (snap) => setDeptUsers(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // Fetch Leaves
                const qLeaves = query(collection(db, 'leave_requests'), where('instituteId', '==', data.instituteId), where('department', '==', data.department), where('status', '==', 'pending'));
                onSnapshot(qLeaves, (snap) => setLeaves(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

                // Fetch Announcements
                const qAnnouncements = query(collection(db, 'announcements'), where('instituteId', '==', data.instituteId), where('department', '==', data.department));
                onSnapshot(qAnnouncements, (snap) => {
                    const annData = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                    annData.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0));
                    setAnnouncements(annData);
                });
            }
        };
        init();
    }, []);

    // ✅ NEW: Handler to Switch Academic Year
    const handleAcademicYearChange = async (newYear) => {
        if (!hodInfo) return;
        const toastId = toast.loading(`Switching to ${newYear}...`);
        try {
            await updateDoc(doc(db, "department_stats", `${hodInfo.instituteId}_${hodInfo.department}`), {
                currentAcademicYear: newYear
            });
            setCurrentAcademicYear(newYear);
            toast.success(`Active Year: ${newYear}`, { id: toastId });
            // Reload to refresh all data views
            setTimeout(() => window.location.reload(), 1000);
        } catch (error) {
            toast.error("Failed to switch year", { id: toastId });
        }
    };


    useEffect(() => {
        if (hodInfo) {
            // Check if department is First Year
            if (hodInfo.department === 'FE' || hodInfo.department === 'First Year') {
                setAnalyticsDivision('A'); // Select first division by default
            } else {
                setAnalyticsYear('SE');    // Select first valid year (SE) by default
            }
        }
    }, [hodInfo]);

    // --- 1. FETCH SESSIONS (Raw Data for Accurate Math) ---
    useEffect(() => {
        if (!hodInfo) return;
        const qSessions = query(collection(db, 'live_sessions'),
            where('instituteId', '==', hodInfo.instituteId),
            where('department', '==', hodInfo.department),
            where('academicYear', '==', currentAcademicYear)
        );
        const unsub = onSnapshot(qSessions, (snap) => {
            setAllSessions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        return () => unsub();
    }, [hodInfo]);

    useEffect(() => {
        if (activeTab === 'feedback' && fbTab === 'view' && hodInfo) {
            fetch(`${BACKEND_URL}/getHODFeedbackForms`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ department: hodInfo.department, instituteId: hodInfo.instituteId })
            })
                .then(res => res.json())
                .then(data => {
                    // Sort by newest first
                    const sorted = (data.forms || []).sort((a, b) => (b.createdAt?._seconds || 0) - (a.createdAt?._seconds || 0));
                    setHodCreatedForms(sorted);
                });
        }
    }, [activeTab, fbTab, hodInfo]);

    // --- 2. FETCH & PROCESS ATTENDANCE (Student Counts) ---
    useEffect(() => {
        if (!hodInfo || allSessions.length === 0) return;

        // Create a fast lookup dictionary for sessions
        const sessionMeta = {};
        allSessions.forEach(s => sessionMeta[s.id] = s);

        const qAttendance = query(collection(db, 'attendance'),
            where('academicYear', '==', currentAcademicYear),
            where('instituteId', '==', hodInfo.instituteId)
        );

        const unsub = onSnapshot(qAttendance, (snap) => {
            const tempMap = {};
            snap.docs.forEach(doc => {
                const att = doc.data();
                const sessionInfo = sessionMeta[att.sessionId];

                // Only count if it matches a valid department session
                if (sessionInfo) {
                    const uid = att.studentId;
                    if (!tempMap[uid]) tempMap[uid] = { theory: 0, practical: 0 };

                    if (sessionInfo.type === 'practical') tempMap[uid].practical++;
                    else tempMap[uid].theory++;
                }
            });
            setStudentAttendanceMap(tempMap);
        });
        return () => unsub();
    }, [hodInfo, allSessions]);



    // --- 3. FUNCTIONAL ATTENDANCE GRAPH (100% ACCURATE MATH) ---
    useEffect(() => {
        if (!hodInfo || deptUsers.length === 0 || allSessions.length === 0) return;

        const fetchAttendanceStats = async () => {
            const now = new Date();
            const startDate = new Date();
            if (timeRange === 'week') startDate.setDate(now.getDate() - 7);
            else startDate.setDate(now.getDate() - 30);

            try {
                const q = query(
                    collection(db, 'attendance'),
                    where('instituteId', '==', hodInfo.instituteId),
                    where('timestamp', '>=', Timestamp.fromDate(startDate)),
                    where('academicYear', '==', currentAcademicYear)
                );

                onSnapshot(q, (snap) => {
                    const sessionIdsInTimeframe = new Set();
                    const groupAttended = {}; // Total Presents by group

                    // 1. Calculate Actual Attended
                    snap.docs.forEach(doc => {
                        const data = doc.data();
                        sessionIdsInTimeframe.add(data.sessionId);

                        const u = deptUsers.find(user => user.id === data.studentId);
                        if (u && u.role === 'student') {
                            const key = isFE ? (u.division || 'A') : u.year;
                            groupAttended[key] = (groupAttended[key] || 0) + 1;
                        }
                    });

                    const groupExpected = {}; // Total Expected by group

                    // 2. Calculate Exact Expected Attendance (Accounts for batches!)
                    sessionIdsInTimeframe.forEach(sid => {
                        const session = allSessions.find(s => s.id === sid);
                        if (!session) return;

                        const sessionYear = session.targetYear || session.year;

                        deptUsers.forEach(u => {
                            if (u.role !== 'student') return;
                            if (sessionYear !== 'All' && sessionYear !== u.year) return;

                            const groupKey = isFE ? (u.division || 'A') : u.year;

                            if (isFE && session.division && session.division !== 'All' && session.division !== u.division) return;

                            // If it's practical, verify the student's roll number is in the batch!
                            if (session.type === 'practical' && session.rollRange) {
                                const roll = parseInt(u.rollNo);
                                if (roll < session.rollRange.start || roll > session.rollRange.end) return;
                            }

                            groupExpected[groupKey] = (groupExpected[groupKey] || 0) + 1;
                        });
                    });

                    // 3. Generate Graph Data
                    const LABELS = isFE ? DIVISIONS : ['SE', 'TE', 'BE'];
                    const graphData = LABELS.map(label => {
                        const attended = groupAttended[label] || 0;
                        const expected = groupExpected[label] || 0;
                        const avgPct = expected === 0 ? 0 : Math.round((attended / expected) * 100);
                        return { name: label, attendance: avgPct };
                    });

                    setAttendanceGraph(graphData);
                });
            } catch (err) { console.error(err); }
        };
        fetchAttendanceStats();
    }, [hodInfo, deptUsers, timeRange, isFE, allSessions]);

    // ✅ SAVE TEACHER UPDATES (Fixed: Sends Token)
    const handleSaveTeacherUpdates = async () => {
        if (!editTeacherData) return;
        setLoading(true);
        const toastId = toast.loading("Updating Teacher Credentials...");

        try {
            // 1. Get the Security Token
            const token = await auth.currentUser.getIdToken();

            // 2. Call Backend API with Token
            const response = await fetch(`${BACKEND_URL}/updateUser`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // 👈 THIS WAS MISSING
                },
                body: JSON.stringify({
                    uid: editTeacherData.id,
                    email: editTeacherData.email,
                    firstName: editTeacherData.firstName,
                    lastName: editTeacherData.lastName,
                    phone: editTeacherData.phone || '',
                    assignedClasses: editTeacherData.assignedClasses,
                    academicYear: editTeacherData.academicYear || '2024-2025'
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Update Failed");
            }

            toast.success("Teacher Login & Data Updated!", { id: toastId });
            setIsEditTeacherModalOpen(false);
            setEditTeacherData(null);

        } catch (error) {
            console.error("Update Error:", error);
            toast.error("Failed: " + error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleViewFormResponses = async (form) => {
        setSelectedFormToView(form);
        setIsResponsesLoading(true); // 👈 Show Loader

        try {
            const res = await fetch(`${BACKEND_URL}/getFeedbackResponses`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ formId: form.id })
            });
            const data = await res.json();

            // 🕒 Wait 2.5 seconds to simulate secure data compilation
            setTimeout(() => {
                setFormResponses(data.responses || []);
                setIsResponsesLoading(false); // 👈 Hide Loader
            }, 2500);

        } catch (error) {
            toast.error("Failed to load responses");
            setIsResponsesLoading(false);
        }
    };

    // ✅ HANDLE DELETE FORM
    const handleDeleteFeedbackForm = (formId) => {
        confirmAction("Delete Form?", "Are you sure you want to delete this feedback form? This cannot be undone.", async () => {
            closeModal();
            const toastId = toast.loading("Deleting form...");
            try {
                await fetch(`${BACKEND_URL}/deleteFeedbackForm`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ formId })
                });
                setHodCreatedForms(prev => prev.filter(f => f.id !== formId));
                toast.success("Form deleted successfully!", { id: toastId });
            } catch (e) {
                toast.error("Failed to delete", { id: toastId });
            }
        }, "danger");
    };

    // ✅ HANDLE EDIT FORM
    const handleEditFeedbackForm = (form) => {
        setEditingFormId(form.id);
        setFeedbackForm({
            title: form.title,
            targetYear: form.targetYear,
            division: form.division || 'All',
            questions: form.questions
        });
        setFbTab('create'); // Switch back to the create tab to edit
    };

    // ✅ SAVE STUDENT UPDATES (Fixed: Sends Token)
    const handleSaveStudentUpdates = async () => {
        if (!editStudentData) return;
        setLoading(true);
        const toastId = toast.loading("Updating Credentials...");

        try {
            // 1. Get the Security Token
            const token = await auth.currentUser.getIdToken();

            // 2. Call Backend API with Token
            const response = await fetch(`${BACKEND_URL}/updateUser`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // 👈 THIS WAS MISSING
                },
                body: JSON.stringify({
                    uid: editStudentData.id,
                    email: editStudentData.email,
                    firstName: editStudentData.firstName,
                    lastName: editStudentData.lastName,
                    rollNo: editStudentData.rollNo,
                    division: editStudentData.division || null,
                    phone: editStudentData.phone || ''
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Update Failed");
            }

            toast.success("Login & Details Updated!", { id: toastId });
            setIsEditStudentModalOpen(false);
            setEditStudentData(null);

        } catch (error) {
            console.error("Update Error:", error);
            toast.error("Failed: " + error.message, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    // --- 4. PASSWORD CHANGE HANDLER ---
    const handleChangePassword = async (e) => {
        e.preventDefault();
        if (passwordForm.newPassword !== passwordForm.confirmPassword) return toast.error("Passwords do not match!");
        if (passwordForm.newPassword.length < 6) return toast.error("Password too short.");

        const toastId = toast.loading("Updating Password...");
        try {
            await updatePassword(auth.currentUser, passwordForm.newPassword);
            toast.success("Password Changed!", { id: toastId });
            setPasswordForm({ newPassword: '', confirmPassword: '' });
        } catch (error) {
            toast.error("Error: " + error.message, { id: toastId });
            if (error.code === 'auth/requires-recent-login') toast("Please logout and login again.", { icon: '🔒' });
        }
    };

    // --- ANALYTICS CALCULATIONS ---
    const studentsList = deptUsers.filter(u => u.role === 'student');
    const teachersList = deptUsers.filter(u => u.role === 'teacher');

    // ✅ NEW EFFECT: Fetch Accurate Total Classes per Group
    useEffect(() => {
        const fetchSessionCounts = async () => {
            if (!hodInfo) return;

            // Query ALL sessions for this department
            const q = query(collection(db, 'live_sessions'),
                where('instituteId', '==', hodInfo.instituteId),
                where('department', '==', hodInfo.department),
                where('academicYear', '==', currentAcademicYear)
            );

            try {
                const snap = await getDocs(q); // Fetch once

                if (isFE) {
                    // For FE, count by Division
                    const divCounts = {};
                    snap.docs.forEach(doc => {
                        const d = doc.data();
                        if (d.targetYear === 'FE') {
                            const div = d.division || 'A';
                            divCounts[div] = (divCounts[div] || 0) + 1;
                        }
                    });
                    setClassCounts(divCounts);
                } else {
                    // For Dept, count by Year
                    const yearCounts = { SE: 0, TE: 0, BE: 0 };
                    snap.docs.forEach(doc => {
                        const d = doc.data();
                        if (yearCounts[d.targetYear] !== undefined) {
                            yearCounts[d.targetYear]++;
                        }
                    });
                    setClassCounts(yearCounts);
                }
            } catch (e) { console.error("Error counting sessions", e); }
        };
        fetchSessionCounts();
    }, [hodInfo, isFE]);

    // ✅ NEW CALCULATION ENGINE (PER-STUDENT PRECISION)
    const getCalculatedAnalytics = () => {
        let targetStudents = deptUsers.filter(u => u.role === 'student' && u.year === analyticsYear);
        if (isFE && analyticsDivision !== 'All') {
            targetStudents = targetStudents.filter(u => u.division === analyticsDivision);
        }

        const threshold = criteria[analyticsYear] || 75;

        const processed = targetStudents.map(s => {
            const sId = s.id || s.uid;
            const myStats = studentAttendanceMap[sId] || { theory: 0, practical: 0 };
            const userDiv = s.division || 'A';

            let myTotalTheory = 0;
            let myTotalPractical = 0;

            // ✅ Find exactly how many sessions THIS specific student was supposed to attend
            allSessions.forEach(session => {
                const sessionYear = session.targetYear || session.year;
                if (sessionYear !== 'All' && sessionYear !== s.year) return;

                if (isFE && session.division && session.division !== 'All') {
                    if (session.division !== userDiv) return;
                }

                if (session.type === 'practical') {
                    if (session.rollRange) {
                        const roll = parseInt(s.rollNo);
                        // Only count this session if their roll number is in the batch range
                        if (roll >= session.rollRange.start && roll <= session.rollRange.end) {
                            myTotalPractical++;
                        }
                    } else {
                        myTotalPractical++; // Fallback if teacher forgot to set batch limits
                    }
                } else {
                    myTotalTheory++;
                }
            });

            let attended = 0;
            let total = 0;

            if (analyticsFilter === 'Theory') {
                attended = myStats.theory;
                total = myTotalTheory;
            } else if (analyticsFilter === 'Practical') {
                attended = myStats.practical;
                total = myTotalPractical;
            } else {
                attended = myStats.theory + myStats.practical;
                total = myTotalTheory + myTotalPractical;
            }

            const percentage = total === 0 ? 100 : Math.round((attended / total) * 100);

            return { ...s, percentage, attended, total };
        });

        const searchFiltered = processed.filter(s =>
            (s.firstName && s.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (s.rollNo && s.rollNo.toString().includes(searchQuery))
        );

        const safe = searchFiltered.filter(s => s.percentage >= threshold);
        const defaulters = searchFiltered.filter(s => s.percentage < threshold);

        return { total: searchFiltered.length, safe, defaulters, threshold };
    };

    const analyticsData = getCalculatedAnalytics();

    // Pie Chart Data with colors
    const pieData = [
        { name: 'Safe', value: analyticsData.safe.length, color: '#10b981' },
        { name: 'Defaulters', value: analyticsData.defaulters.length, color: '#ef4444' },
    ];

    // --- HELPERS ---
    const confirmAction = (title, message, action, type = 'info') => {
        setModal({ isOpen: true, title, message, onConfirm: action, type });
    };
    const closeModal = () => setModal({ ...modal, isOpen: false });

    const toggleSelectUser = (id) => {
        if (selectedUserIds.includes(id)) setSelectedUserIds(prev => prev.filter(i => i !== id));
        else setSelectedUserIds(prev => [...prev, id]);
    };

    const toggleSelectRequestOne = (id) => {
        if (selectedRequestIds.includes(id)) setSelectedRequestIds(prev => prev.filter(i => i !== id));
        else setSelectedRequestIds(prev => [...prev, id]);
    };

    const toggleSelectRequestAll = () => {
        if (selectedRequestIds.length === studentRequests.length) setSelectedRequestIds([]);
        else setSelectedRequestIds(studentRequests.map(r => r.id));
    };

    // ✅ HANDLE DIVISION CHANGE (Allows typing "A, B" etc.)
    const handleDivisionChange = (year, divisionVal) => {
        setTeacherForm(prev => ({
            ...prev,
            assignedClasses: prev.assignedClasses.map(c =>
                c.year === year ? { ...c, divisions: divisionVal } : c
            )
        }));
    };

    // ✅ NEW: Handle Semester Selection
    const handleSemesterChange = (year, semester) => {
        setTeacherForm(prev => ({
            ...prev,
            assignedClasses: prev.assignedClasses.map(c =>
                c.year === year ? { ...c, semester: Number(semester) } : c
            )
        }));
    };

    // ✅ UPDATE: Ensure new classes get a default semester when toggled
    const handleClassToggle = (year) => {
        setTeacherForm(prev => {
            const exists = prev.assignedClasses.find(c => c.year === year);
            if (exists) {
                return { ...prev, assignedClasses: prev.assignedClasses.filter(c => c.year !== year) };
            } else {
                // Default Semesters: FE->1, SE->3, TE->5, BE->7
                let defaultSem = 1;
                if (year === 'SE') defaultSem = 3;
                if (year === 'TE') defaultSem = 5;
                if (year === 'BE') defaultSem = 7;

                return { ...prev, assignedClasses: [...prev.assignedClasses, { year, subject: '', semester: defaultSem }] };
            }
        });
    };

    const handleSubjectChange = (year, subject) => {
        setTeacherForm(prev => ({
            ...prev,
            assignedClasses: prev.assignedClasses.map(c => c.year === year ? { ...c, subject } : c)
        }));
    };


    // --- ACTIONS ---

    // 1. Update Profile
    const handleUpdateProfile = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
                firstName: profileForm.firstName,
                lastName: profileForm.lastName,
                qualification: profileForm.qualification,
                phone: profileForm.phone
            });
            setHodInfo(prev => ({ ...prev, ...profileForm }));
            setIsEditingProfile(false);
            toast.success("Profile Updated!");
        } catch (error) {
            toast.error("Update Failed");
        } finally {
            setLoading(false);
        }
    };

    const handlePostAnnouncement = async (e) => {
        e.preventDefault();
        const toastId = toast.loading("Posting...");
        try {
            // 1. Upload File (if selected)
            let attachmentUrl = "";
            if (annoFile) {
                const fileRef = ref(storage, `announcements/${auth.currentUser.uid}/${Date.now()}_${annoFile.name}`);
                await uploadBytes(fileRef, annoFile);
                attachmentUrl = await getDownloadURL(fileRef);
            }

            // --- ✅ LOGIC FIX START ---
            let finalTargetYear = announcementForm.targetYear;
            let finalDivision = 'All';

            // 1. Parse Division (e.g. "Division A" -> Year: "FE", Div: "A")
            if (announcementForm.targetYear.startsWith('Division ')) {
                finalTargetYear = 'FE';
                finalDivision = announcementForm.targetYear.split(' ')[1];
            }

            // 2. Normalize Department (Force "First Year" -> "FE")
            let finalDepartment = hodInfo.department;
            if (finalDepartment === 'First Year' || finalDepartment === 'FirstYear') {
                finalDepartment = 'FE';
            }
            // --- ✅ LOGIC FIX END ---

            // 2. Save to Firestore
            await addDoc(collection(db, 'announcements'), {
                title: announcementForm.title,
                message: announcementForm.message,
                targetYear: finalTargetYear,
                division: finalDivision,
                instituteId: hodInfo.instituteId,
                department: finalDepartment, // ✅ Saved as "FE"
                teacherName: `${hodInfo.firstName} ${hodInfo.lastName} (HOD)`,
                role: 'hod',
                attachmentUrl: attachmentUrl,
                createdAt: serverTimestamp()
            });

            // 3. Send Notification
            fetch(`${BACKEND_URL}/sendAnnouncementNotification`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: `📢 HOD Notice: ${announcementForm.title}`,
                    message: announcementForm.message,
                    targetYear: finalTargetYear,
                    division: finalDivision,
                    instituteId: hodInfo.instituteId,
                    department: finalDepartment,
                    senderName: `${hodInfo.firstName} ${hodInfo.lastName}`
                })
            }).catch(err => console.error(err));

            toast.success("Posted Successfully!", { id: toastId });
            setAnnouncementForm({ title: '', message: '', targetYear: 'All' });
            setAnnoFile(null);
        } catch (err) {
            console.error(err);
            toast.error("Failed to post.", { id: toastId });
        }
    };
    const handleDeleteAnnouncement = (id) => {
        // ✅ Use Custom Modal instead of window.confirm
        confirmAction('Delete Notice?', 'Are you sure you want to remove this announcement?', async () => {
            closeModal();
            const toastId = toast.loading("Deleting...");
            try {
                await deleteDoc(doc(db, 'announcements', id));
                toast.success("Deleted", { id: toastId });
            } catch (e) { toast.error("Failed", { id: toastId }); }
        }, 'danger');
    };



    // --- SEND NOTICE FUNCTION (Connected to Backend) ---
    const handleSendNotice = async (student) => {
        const toastId = toast.loading(`Sending notice to ${student.firstName}...`);

        try {
            const response = await fetch(`${BACKEND_URL}/sendNotice`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: student.email,
                    name: `${student.firstName} ${student.lastName}`,
                    subject: "⚠️ Critical Attendance Warning - Action Required",
                    message: `Your attendance has fallen below the <b>${analyticsData.threshold}%</b> threshold. 
                              Your current attendance is <b style="color:red">${student.percentage.toFixed(1)}%</b>. 
                              Please meet the HOD immediately to discuss this issue.`
                })
            });

            const data = await response.json();

            if (response.ok) {
                toast.success("Notice Sent Successfully!", { id: toastId });
            } else {
                throw new Error(data.error || "Failed to send email");
            }
        } catch (error) {
            console.error(error);
            toast.error("Failed to send notice.", { id: toastId });
        }
    };

    const handleDeleteUsers = () => {
        if (selectedUserIds.length === 0) return;
        confirmAction('Delete Users?', `Delete ${selectedUserIds.length} users permanently?`, async () => {
            closeModal();
            const toastId = toast.loading("Deleting...");
            try {
                await fetch(`${BACKEND_URL}/deleteUsers`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userIds: selectedUserIds })
                });
                toast.success("Users Deleted!", { id: toastId });
                setSelectedUserIds([]);
            } catch (error) { toast.error("Delete Failed", { id: toastId }); }
        }, 'danger');
    };

    // 📄 DOWNLOAD TEACHER EMAILS (PDF)
    const downloadTeacherEmails = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.text(`${hodInfo?.department || 'Department'} - Faculty Directory`, 14, 20);
        
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total Teachers: ${teachersList.length}`, 14, 28);

        const tableColumn = ["Name", "Email", "Phone", "Assigned Classes"];
        const tableRows = teachersList.map(t => {
            const classes = (t.assignedClasses || []).map(c => `${c.subject} (${c.year}${c.divisions ? ` Div ${c.divisions}` : ''})`).join(', ');
            return [
                `${t.firstName} ${t.lastName}`,
                t.email,
                t.phone || 'N/A',
                classes || 'None'
            ];
        });

        autoTable(doc, {
            startY: 35,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [59, 130, 246] },
            styles: { fontSize: 9 }
        });

        doc.save(`${hodInfo?.department}_Teachers.pdf`);
        toast.success("Teachers PDF Downloaded!");
    };

    // 📄 DOWNLOAD STUDENT EMAILS (PDF)
    const downloadStudentEmails = () => {
        const doc = new jsPDF();
        doc.setFontSize(18);
        doc.setTextColor(30, 41, 59);
        doc.text(`${hodInfo?.department || 'Department'} - Student Directory`, 14, 20);
        
        doc.setFontSize(11);
        doc.setTextColor(100, 116, 139);
        doc.text(`Total Students: ${studentsList.length}`, 14, 28);

        const tableColumn = ["Roll No", "Name", "Email", "Class / Div"];
        
        // Sort students by Year -> Division -> Roll Number
        const sortedStudents = [...studentsList].sort((a, b) => {
            if (a.year !== b.year) return (a.year || '').localeCompare(b.year || '');
            if (a.division !== b.division) return (a.division || '').localeCompare(b.division || '');
            return (a.rollNo || '').localeCompare(b.rollNo || '', undefined, { numeric: true });
        });

        const tableRows = sortedStudents.map(s => [
            s.rollNo || '-',
            `${s.firstName} ${s.lastName}`,
            s.email,
            `${s.year} ${s.division ? `(Div ${s.division})` : ''}`
        ]);

        autoTable(doc, {
            startY: 35,
            head: [tableColumn],
            body: tableRows,
            theme: 'grid',
            headStyles: { fillColor: [16, 185, 129] }, // Green header for students
            styles: { fontSize: 9 }
        });

        doc.save(`${hodInfo?.department}_Students.pdf`);
        toast.success("Students PDF Downloaded!");
    };

    const handleLeaveAction = async (leaveId, status) => {
        const toastId = toast.loading("Processing...");
        try {
            await fetch(`${BACKEND_URL}/actionLeave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ leaveId, status })
            });
            toast.success(`Leave ${status}`, { id: toastId });
        } catch (e) { toast.error("Failed", { id: toastId }); }
    };

    const executeBulkApprove = async () => {
        closeModal();
        const toastId = toast.loading(`Approving ${selectedRequestIds.length} students...`);
        try {
            const promises = selectedRequestIds.map(async (id) => {
                const req = studentRequests.find(r => r.id === id);
                if (!req) return;
                const finalPassword = req.password || Math.random().toString(36).slice(-8);

                const response = await fetch(`${BACKEND_URL}/createUser`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        email: req.email, password: finalPassword, firstName: req.firstName, lastName: req.lastName, role: 'student', instituteId: req.instituteId, instituteName: req.instituteName, department: req.department,
                        subject: null, rollNo: req.rollNo,
                        extras: { collegeId: req.collegeId, year: req.year, semester: req.semester }
                    })
                });
                if (!response.ok) throw new Error(`Failed: ${req.email}`);
                await sendPasswordResetEmail(auth, req.email);
                await deleteDoc(doc(db, 'student_requests', id));
            });
            await Promise.all(promises);
            toast.success("Selected students approved!", { id: toastId });
            setSelectedRequestIds([]);
        } catch (err) { toast.error("Error: " + err.message, { id: toastId }); }
    };

    const executeSingleApprove = async (req) => {
        closeModal();
        const toastId = toast.loading(`Approving ${req.firstName}...`);
        try {
            const finalPassword = req.password || Math.random().toString(36).slice(-8);
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: req.email, password: finalPassword, firstName: req.firstName, lastName: req.lastName, role: 'student', instituteId: req.instituteId, instituteName: req.instituteName, department: req.department,
                    subject: null, rollNo: req.rollNo,
                    extras: { collegeId: req.collegeId, year: req.year, semester: req.semester }
                })
            });

            if (!response.ok) throw new Error("Backend creation failed");
            await sendPasswordResetEmail(auth, req.email);
            await deleteDoc(doc(db, 'student_requests', req.id));
            toast.success("Student Approved!", { id: toastId });
        } catch (e) { toast.error(e.message, { id: toastId }); }
    };

    const executeReject = async (reqId) => {
        closeModal();
        const toastId = toast.loading("Rejecting...");
        try {
            await deleteDoc(doc(db, 'student_requests', reqId));
            toast.success("Rejected", { id: toastId });
        } catch (e) { toast.error("Error rejecting", { id: toastId }); }
    };

    const handleAddTeacher = async (e) => {
        e.preventDefault();

        const toastId = toast.loading("Creating Teacher Account...");
        setLoading(true);

        try {
            const response = await fetch(`${BACKEND_URL}/createUser`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: teacherForm.email,
                    password: teacherForm.password,
                    firstName: teacherForm.firstName,
                    lastName: teacherForm.lastName,
                    phone: teacherForm.phone,
                    role: 'teacher',
                    instituteId: hodInfo.instituteId,
                    instituteName: hodInfo.instituteName || 'AcadeX Institute',
                    department: hodInfo.department,

                    academicYear: teacherForm.academicYear,
                    assignedClasses: teacherForm.assignedClasses,

                    // ✅ FIX: Add phone to 'extras' so it gets saved to Firestore
                    extras: {
                        phone: teacherForm.phone, // <--- ADDED HERE
                        academicYear: teacherForm.academicYear,
                        createdAt: new Date().toISOString()
                    }
                })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || "Failed to create teacher");

            // 3. Trigger Email Sending
            await fetch(`${BACKEND_URL}/sendTeacherCredentials`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: teacherForm.email,
                    password: teacherForm.password,
                    firstName: teacherForm.firstName,
                    department: hodInfo.department,
                    assignedClasses: teacherForm.assignedClasses,
                    academicYear: teacherForm.academicYear
                })
            });

            toast.success("Teacher Added & Email Sent!", { id: toastId });

            // ✅ Reset Form
            setTeacherForm({
                firstName: '', lastName: '', email: '', password: '', phone: '',
                academicYear: '2025-2026', assignedClasses: []
            });

        } catch (error) {
            console.error("Error adding teacher:", error);
            toast.error(error.message || "Failed to add teacher.", { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const MobileFooter = () => (
        // ✅ Updated Class Name
        <div className="hod-mobile-footer">
            <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>
                <i className="fas fa-th-large"></i><span>Home</span>
            </button>
            <button className={activeTab === 'analytics' ? 'active' : ''} onClick={() => setActiveTab('analytics')}>
                <i className="fas fa-chart-pie"></i><span>Stats</span>
            </button>
            <button className={activeTab === 'announcements' ? 'active' : ''} onClick={() => setActiveTab('announcements')}>
                <i className="fas fa-bullhorn"></i><span>Notices</span>
            </button>
            <button className={activeTab === 'profile' ? 'active' : ''} onClick={() => setActiveTab('profile')}>
                <i className="fas fa-user"></i><span>Profile</span>
            </button>
            <button className={activeTab === 'feedback' ? 'active' : ''} onClick={() => setActiveTab('feedback')}>
                <i className="fas fa-comment-dots"></i><span>Feedback</span>
            </button>
        </div>
    );

    const NavLink = ({ page, iconClass, label, count }) => (
        <li className={activeTab === page ? 'active' : ''} onClick={() => { setActiveTab(page); setIsMobileNavOpen(false); }}>
            <i className={`fas ${iconClass}`} style={{ width: '20px', textAlign: 'center' }}></i>
            <span>{label}</span>
            {count > 0 && <span className="nav-badge">{count}</span>}
        </li>
    );

    // ✅ NEW: Handle Year-Wise Switching via Backend API
    const handleSemesterSwitch = async (year, newSem) => {
        if (!hodInfo) return;

        const toastId = toast.loading(`Updating ${year} to Sem ${newSem}...`);

        try {
            const semInt = parseInt(newSem);

            // 1. Create the updated state object locally first
            const updatedSems = { ...activeSemesters, [year]: semInt };

            // 2. Call the Backend API (Secure Write)
            const response = await fetch(`${BACKEND_URL}/updateDepartmentStats`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    instituteId: hodInfo.instituteId,
                    department: hodInfo.department,
                    activeSemesters: updatedSems
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || "Server failed to update");
            }

            // 3. Update Local State (Only if backend succeeds)
            setActiveSemesters(updatedSems);
            toast.success(`${year} is now in Semester ${semInt}`, { id: toastId });

        } catch (error) {
            console.error("Semester Switch Error:", error);
            toast.error(error.message || "Failed to update semester", { id: toastId });
        }
    };



    return (
        <div className="dashboard-container">


            {modal.isOpen && (
                <div className="hod-modal-overlay">
                    <div className="hod-confirm-box">
                        <div className="hod-modal-icon">
                            <i className={`fas ${modal.type === 'danger' ? 'fa-exclamation-circle' : 'fa-question-circle'}`}></i>
                        </div>
                        <h3>{modal.title}</h3>
                        <p>{modal.message}</p>

                        {/* ✅ UNIQUE FLEX CONTAINER FOR BUTTONS */}
                        <div className="hod-modal-btn-group">
                            <button
                                className="hod-btn-cancel"
                                onClick={closeModal}
                            >
                                No, Cancel
                            </button>
                            <button
                                className={`hod-btn-confirm ${modal.type === 'danger' ? 'danger-bg' : 'primary-bg'}`}
                                onClick={modal.onConfirm}
                            >
                                Yes, Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isMobileNavOpen && <div className="nav-overlay" onClick={() => setIsMobileNavOpen(false)}></div>}

            <aside className={`sidebar ${isMobileNavOpen ? 'open' : ''}`}>
                <div className="logo-container"><img src={logo} alt="Logo" className="sidebar-logo" /><span className="logo-text">trackee</span></div>
                {hodInfo && <div className="teacher-info"><h4>{hodInfo.firstName} (HOD)</h4><p>{hodInfo.department}</p></div>}
                <ul className="menu">
                    <NavLink page="dashboard" iconClass="fa-th-large" label="Dashboard" />
                    <NavLink page="analytics" iconClass="fa-chart-pie" label="Analytics" />
                    <NavLink page="announcements" iconClass="fa-bullhorn" label="Announcements" />
                    <NavLink page="leaves" iconClass="fa-calendar-check" label="Leave Requests" count={leaves.length} />
                    <NavLink page="requests" iconClass="fa-user-clock" label="Applications" count={studentRequests.length} />
                    <NavLink page="manage" iconClass="fa-users" label="Dept Users" />
                    <NavLink page="timetable" iconClass="fa-calendar-alt" label="Timetable" />
                    <NavLink page="addTeacher" iconClass="fa-chalkboard-teacher" label="Add Teacher" />
                    <NavLink page="feedback" iconClass="fa-comment-dots" label="Feedback Forms" />
                    <NavLink page="profile" iconClass="fa-user-cog" label="My Profile" />
                </ul>
                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={() => signOut(auth).then(() => navigate('/'))}>
                        <i className="fas fa-sign-out-alt" style={{ marginRight: '10px' }}></i> Logout
                    </button>
                </div>
            </aside>

            <main className="main-content" style={{ paddingBottom: '20px' }}>
                <header className="mobile-header">
                    <button className="hamburger-btn" onClick={() => setIsMobileNavOpen(true)}><i className="fas fa-bars"></i></button>
                    <div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">trackee</span></div>
                    <div style={{ width: '40px' }}></div>
                </header>

                {activeTab === 'dashboard' && (
                    <div className="content-section">

                        {/* --- 🎓 ACADEMIC SESSION CONTROL (Dynamic for FE/Dept) --- */}
                        <div className="card fade-in-up" style={{
                            background: 'white',
                            borderRadius: '24px',
                            border: 'none',
                            boxShadow: '0 20px 50px -10px rgba(0,0,0,0.1)',
                            overflow: 'visible',
                            position: 'relative',
                            marginBottom: '30px',
                            zIndex: 10
                        }}>
                            {/* Decorative Header */}
                            <div style={{
                                background: 'linear-gradient(135deg, #0f172a 0%, #334155 100%)',
                                padding: '25px',
                                position: 'relative',
                                borderRadius: '24px 24px 0 0',
                                overflow: 'hidden'
                            }}>
                                <div style={{ position: 'relative', zIndex: 2 }}>
                                    <h3 style={{ color: 'white', margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        <i className="fas fa-university" style={{ color: '#38bdf8' }}></i>
                                        Academic Session Control
                                    </h3>
                                    <p style={{ color: 'rgba(255,255,255,0.7)', margin: '6px 0 0 0', fontSize: '13px', maxWidth: '90%' }}>
                                        {hodInfo?.department === 'FE' ? 'Manage First Year Semesters' : 'Manage Department Semesters'}
                                    </p>
                                </div>
                                <div style={{ position: 'absolute', top: '-30px', right: '-20px', width: '120px', height: '120px', background: 'radial-gradient(circle, rgba(56,189,248,0.2) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%' }}></div>
                            </div>

                            <div style={{ padding: '30px 25px' }}>

                                {/* ✅ NEW: Global Academic Year Switcher */}
                                <div style={{ marginBottom: '25px', paddingBottom: '20px', borderBottom: '1px solid #f1f5f9' }}>
                                    <CustomMobileSelect
                                        label="Current Academic Year (Global)"
                                        icon="fa-calendar-alt"
                                        value={currentAcademicYear}
                                        onChange={handleAcademicYearChange}
                                        options={[
                                            { value: '2023-2024', label: '2023-2024 (Archived)' },
                                            { value: '2024-2025', label: '2024-2025 (Previous)' },
                                            { value: '2025-2026', label: '2025-2026 (Current)' },
                                            { value: '2026-2027', label: '2026-2027 (Upcoming)' }
                                        ]}
                                    />
                                    <p style={{ fontSize: '11px', color: '#f59e0b', marginTop: '8px', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '600' }}>
                                        <i className="fas fa-exclamation-triangle"></i>
                                        Warning: Switching this hides all attendance data from other years.
                                    </p>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '20px' }}>

                                    {/* ✅ LOGIC: Show 'FE' only if Dept is FE, otherwise show SE, TE, BE */}
                                    {(hodInfo?.department === 'FE' || hodInfo?.department === 'First Year'
                                        ? ['FE']
                                        : ['SE', 'TE', 'BE']
                                    ).map(year => {
                                        // Define Options Per Year
                                        let options = [];
                                        if (year === 'FE') options = [{ value: 1, label: 'Semester 1' }, { value: 2, label: 'Semester 2' }];
                                        if (year === 'SE') options = [{ value: 3, label: 'Semester 3' }, { value: 4, label: 'Semester 4' }];
                                        if (year === 'TE') options = [{ value: 5, label: 'Semester 5' }, { value: 6, label: 'Semester 6' }];
                                        if (year === 'BE') options = [{ value: 7, label: 'Semester 7' }, { value: 8, label: 'Semester 8' }];

                                        return (
                                            <div key={year}>
                                                <CustomMobileSelect
                                                    label={`${year} Session`}
                                                    icon="fa-graduation-cap"
                                                    value={activeSemesters[year] || options[0].value}
                                                    onChange={(val) => handleSemesterSwitch(year, val)}
                                                    options={options}
                                                />
                                            </div>
                                        )
                                    })}

                                </div>

                                <div style={{ marginTop: '10px', padding: '15px', background: '#eff6ff', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                                    <i className="fas fa-info-circle" style={{ color: '#2563eb', marginTop: '3px' }}></i>
                                    <p style={{ margin: 0, fontSize: '12px', color: '#475569', lineHeight: '1.5' }}>
                                        <strong>Note:</strong> Selected semester will apply to all students and teachers in {hodInfo?.department === 'FE' ? 'First Year' : 'the department'}.
                                    </p>
                                </div>
                            </div>
                        </div>

                        <h2 className="content-title">Department Overview</h2>

                        {/* 1. Student Count by Year (Cards) */}
                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', marginBottom: '20px' }}>

                            {/* ✅ LOGIC: Show Divisions for FE, Years for Dept HOD */}
                            {(isFE ? DIVISIONS : ['SE', 'TE', 'BE']).map(label => {

                                // Count Logic
                                const count = studentsList.filter(s =>
                                    isFE ? s.division === label : s.year === label
                                ).length;

                                // Dynamic Colors
                                const colors = {
                                    'A': '#3b82f6', 'B': '#8b5cf6', 'C': '#f59e0b', 'D': '#10b981',
                                    'E': '#ef4444', 'F': '#06b6d4', 'G': '#ec4899', 'H': '#6366f1',
                                    'SE': '#8b5cf6', 'TE': '#f59e0b', 'BE': '#10b981'
                                };
                                const color = colors[label] || '#64748b';

                                return (
                                    <div key={label} className="card" style={{ border: 'none', borderLeft: `4px solid ${color}`, background: '#fff' }}>
                                        <h3 style={{ margin: 0, color: color, fontSize: '14px' }}>
                                            {isFE ? `Div ${label}` : `${label}`} Students
                                        </h3>
                                        <p style={{ margin: '5px 0 0', fontSize: '28px', fontWeight: '800', color: '#1e293b' }}>
                                            {count}
                                        </p>
                                    </div>
                                );
                            })}

                            <div className="card" style={{ background: '#f8fafc', border: 'none', borderLeft: '4px solid #64748b' }}>
                                <h3 style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>Total Faculty</h3>
                                <p style={{ margin: '5px 0 0', fontSize: '28px', fontWeight: '800', color: '#1e293b' }}>{teachersList.length}</p>
                            </div>
                        </div>

                        {/* 2. Attendance Analytics Graph */}
                        <div className="card" style={{ height: '400px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                <div>
                                    <h3 style={{ margin: 0, color: '#1e293b' }}>Average Attendance</h3>
                                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                                        {isFE ? 'Performance by Division' : 'Performance by Class Year'}
                                    </p>
                                </div>

                                <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '8px', display: 'flex' }}>
                                    <button
                                        onClick={() => setTimeRange('week')}
                                        style={{
                                            padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                            background: timeRange === 'week' ? 'white' : 'transparent',
                                            color: timeRange === 'week' ? '#0f172a' : '#64748b',
                                            boxShadow: timeRange === 'week' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        This Week
                                    </button>
                                    <button
                                        onClick={() => setTimeRange('month')}
                                        style={{
                                            padding: '6px 12px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold',
                                            background: timeRange === 'month' ? 'white' : 'transparent',
                                            color: timeRange === 'month' ? '#0f172a' : '#64748b',
                                            boxShadow: timeRange === 'month' ? '0 2px 5px rgba(0,0,0,0.05)' : 'none'
                                        }}
                                    >
                                        This Month
                                    </button>
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={attendanceGraph} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }}
                                        dy={10}
                                    />
                                    <YAxis
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fill: '#64748b', fontSize: 12 }}
                                    />
                                    <Tooltip
                                        cursor={{ fill: '#f1f5f9' }}
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    />
                                    <Bar dataKey="attendance" name="Avg Attendance %" radius={[6, 6, 0, 0]} barSize={isFE ? 20 : 50} fill="#3b82f6">
                                        {/* Optional: Individual Colors logic if needed */}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}

               {activeTab === 'feedback' && (
                    <div className="content-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '20px' }}>
                            <div>
                                <h2 className="content-title" style={{ margin: 0 }}>Teacher Feedback</h2>
                                <p style={{ color: '#64748b', marginTop: '5px' }}>Create forms and analyze student evaluations.</p>
                            </div>
                        </div>

                        {/* Top Toggle Navigation */}
                        <div className="fb-toggle-nav">
                            <button className={`fb-toggle-btn ${fbTab === 'create' ? 'active' : ''}`} onClick={() => {
                                setFbTab('create');
                                if(!editingFormId) {
                                    setFeedbackForm({ title: '', targetYear: 'All', division: 'All', questions: [{ id: Date.now(), type: 'mcq', text: '', options: ['', ''] }] });
                                }
                            }}>
                                <i className={`fas ${editingFormId ? 'fa-pen' : 'fa-plus-circle'}`} style={{ marginRight: '8px' }}></i> 
                                {editingFormId ? 'Edit Form' : 'Create Form'}
                            </button>
                            <button className={`fb-toggle-btn ${fbTab === 'view' ? 'active' : ''}`} onClick={() => { 
                                setFbTab('view'); 
                                setSelectedFormToView(null); 
                                setEditingFormId(null); // Clear edit state
                                setFeedbackForm({ title: '', targetYear: 'All', division: 'All', questions: [{ id: Date.now(), type: 'mcq', text: '', options: ['', ''] }] });
                            }}>
                                <i className="fas fa-chart-bar" style={{ marginRight: '8px' }}></i> View Responses
                            </button>
                        </div>

                        {/* --- CREATION / EDIT TAB --- */}
                        {fbTab === 'create' && (
                            <div className="fb-creator-container fade-in-up">
                                <div style={{ marginBottom: '25px' }}>
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: '8px', display: 'block', letterSpacing: '0.5px' }}>
                                        <i className="fas fa-heading" style={{ marginRight: '6px', color: '#3b82f6' }}></i> Form Title
                                    </label>
                                    <input 
                                        type="text" 
                                        placeholder="e.g. Mid-Semester Teaching Feedback" 
                                        value={feedbackForm.title}
                                        onChange={e => setFeedbackForm({...feedbackForm, title: e.target.value})}
                                        className="fb-title-input"
                                    />
                                </div>

                                <div className="fb-target-row" style={{ position: 'relative', zIndex: 100 }}>
                                    <div style={{ flex: 1 }}>
                                        <CustomMobileSelect 
                                            label="Target Year"
                                            icon="fa-users"
                                            value={feedbackForm.targetYear}
                                            onChange={(val) => setFeedbackForm({...feedbackForm, targetYear: val, division: 'All'})}
                                            options={isFE ? [
                                                { value: 'All', label: 'All First Year Students' },
                                                { value: 'FE', label: 'First Year (FE)' }
                                            ] : [
                                                { value: 'All', label: 'All Years' },
                                                { value: 'SE', label: 'Second Year (SE)' },
                                                { value: 'TE', label: 'Third Year (TE)' },
                                                { value: 'BE', label: 'Final Year (BE)' }
                                            ]}
                                        />
                                    </div>

                                    {(feedbackForm.targetYear === 'FE' || isFE) && (
                                        <div style={{ flex: 1 }}>
                                            <CustomMobileSelect 
                                                label="Target Division"
                                                icon="fa-layer-group"
                                                value={feedbackForm.division}
                                                onChange={(val) => setFeedbackForm({...feedbackForm, division: val})}
                                                options={[
                                                    { value: 'All', label: 'All Divisions' },
                                                    ...DIVISIONS.map(div => ({ value: div, label: `Division ${div}` }))
                                                ]}
                                            />
                                        </div>
                                    )}
                                </div>

                                <h3 style={{ fontSize: '18px', color: '#1e293b', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', marginBottom: '20px' }}>
                                    Questions Setup
                                </h3>
                                
                                {feedbackForm.questions.map((q, qIndex) => (
                                    <div key={q.id} className="fb-question-card" style={{ zIndex: 90 - qIndex }}>
                                        <button className="fb-delete-q-btn" onClick={() => {
                                            const updated = feedbackForm.questions.filter((_, idx) => idx !== qIndex);
                                            setFeedbackForm({...feedbackForm, questions: updated});
                                        }} title="Remove Question">
                                            <i className="fas fa-trash"></i>
                                        </button>

                                        <div className="fb-question-input-grid">
                                            <div>
                                                <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                    <div style={{ background: '#dbeafe', color: '#2563eb', width: '22px', height: '22px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        {qIndex + 1}
                                                    </div>
                                                    Question Text
                                                </label>
                                                <input 
                                                    type="text" 
                                                    value={q.text}
                                                    onChange={(e) => {
                                                        const updated = [...feedbackForm.questions];
                                                        updated[qIndex].text = e.target.value;
                                                        setFeedbackForm({...feedbackForm, questions: updated});
                                                    }}
                                                    className="fb-input-styled"
                                                    placeholder="What do you want to ask the students?"
                                                />
                                            </div>

                                            <div>
                                                <CustomMobileSelect 
                                                    label="Answer Format"
                                                    icon="fa-sliders-h"
                                                    value={q.type}
                                                    onChange={(val) => {
                                                        const updated = [...feedbackForm.questions];
                                                        updated[qIndex].type = val;
                                                        setFeedbackForm({...feedbackForm, questions: updated});
                                                    }}
                                                    options={[
                                                        { value: 'mcq', label: 'Multiple Choice' },
                                                        { value: 'text', label: 'Short Text Box' }
                                                    ]}
                                                />
                                            </div>
                                        </div>

                                        {q.type === 'mcq' && (
                                            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px dashed #e2e8f0' }}>
                                                <label style={{ fontSize: '11px', fontWeight: '800', color: '#94a3b8', marginBottom: '12px', display: 'block', textTransform: 'uppercase' }}>
                                                    <i className="fas fa-list-ul" style={{ marginRight: '6px' }}></i> Multiple Choice Options
                                                </label>
                                                
                                                {q.options.map((opt, oIndex) => (
                                                    <div key={oIndex} className="fb-option-row">
                                                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #cbd5e1', background: 'white' }}></div>
                                                        <input 
                                                            type="text" 
                                                            value={opt}
                                                            onChange={(e) => {
                                                                const updated = [...feedbackForm.questions];
                                                                updated[qIndex].options[oIndex] = e.target.value;
                                                                setFeedbackForm({...feedbackForm, questions: updated});
                                                            }}
                                                            className="fb-option-input"
                                                            placeholder={`Option ${oIndex + 1}`}
                                                        />
                                                        <button onClick={() => {
                                                            const updated = [...feedbackForm.questions];
                                                            updated[qIndex].options = updated[qIndex].options.filter((_, idx) => idx !== oIndex);
                                                            setFeedbackForm({...feedbackForm, questions: updated});
                                                        }} style={{ background: '#fee2e2', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '6px 8px', borderRadius: '8px', transition: 'all 0.2s' }}>
                                                            <i className="fas fa-times"></i>
                                                        </button>
                                                    </div>
                                                ))}
                                                
                                                <button className="fb-add-option-btn" onClick={() => {
                                                    const updated = [...feedbackForm.questions];
                                                    updated[qIndex].options.push('');
                                                    setFeedbackForm({...feedbackForm, questions: updated});
                                                }}>
                                                    <i className="fas fa-plus"></i> Add Option
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))}

                                <button className="fb-add-question-btn" onClick={() => setFeedbackForm({
                                    ...feedbackForm, 
                                    questions: [...feedbackForm.questions, { id: Date.now(), type: 'mcq', text: '', options: ['', ''] }]
                                })}>
                                    <i className="fas fa-plus-circle"></i> Add Another Question
                                </button>

                                {/* ✅ UPDATED SUBMIT BUTTON (Handles both Save and Edit) */}
                                <button 
                                    className="btn-primary" 
                                    style={{ width: '100%', padding: '16px', fontSize: '16px', borderRadius: '14px', background: 'linear-gradient(135deg, #2563eb, #1d4ed8)', boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)' }}
                                    onClick={async () => {
                                        if(!feedbackForm.title) return toast.error("Title is required!");
                                        const actionText = editingFormId ? "Updating" : "Publishing";
                                        const endpoint = editingFormId ? "updateFeedbackForm" : "createFeedbackForm";
                                        const toastId = toast.loading(`${actionText} Feedback Form...`);
                                        
                                        try {
                                            const payload = {
                                                instituteId: hodInfo.instituteId,
                                                department: hodInfo.department,
                                                targetYear: feedbackForm.targetYear,
                                                division: feedbackForm.division,
                                                title: feedbackForm.title,
                                                questions: feedbackForm.questions,
                                                academicYear: currentAcademicYear
                                            };
                                            if (editingFormId) payload.formId = editingFormId;

                                            await fetch(`${BACKEND_URL}/${endpoint}`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(payload)
                                            });
                                            
                                            toast.success(`Form ${editingFormId ? 'Updated' : 'Published'} successfully!`, { id: toastId });
                                            setFeedbackForm({ title: '', targetYear: 'All', division: 'All', questions: [{ id: Date.now(), type: 'mcq', text: '', options: ['', ''] }] });
                                            setEditingFormId(null);
                                            setFbTab('view'); 
                                        } catch (error) {
                                            toast.error(`Failed to ${editingFormId ? 'update' : 'publish'} form.`, { id: toastId });
                                        }
                                    }}
                                >
                                    <i className={`fas ${editingFormId ? 'fa-save' : 'fa-paper-plane'}`} style={{ marginRight: '8px' }}></i> 
                                    {editingFormId ? 'Save Changes' : 'Publish Form to Students'}
                                </button>
                            </div>
                        )}

                        {/* --- VIEW RESPONSES TAB --- */}
                        {fbTab === 'view' && !selectedFormToView && (
                            <div className="cards-grid fade-in-up">
                                {hodCreatedForms.length > 0 ? hodCreatedForms.map(form => (
                                    <div key={form.id} className="fb-response-form-card" onClick={() => handleViewFormResponses(form)}>
                                        <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#eff6ff', color: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px' }}>
                                            <i className="fas fa-poll"></i>
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>{form.title}</h3>
                                            <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', display: 'flex', gap: '10px' }}>
                                                <span><i className="fas fa-users"></i> {form.targetYear} {form.division !== 'All' ? `(Div ${form.division})` : ''}</span>
                                                <span><i className="fas fa-calendar"></i> {form.academicYear}</span>
                                            </div>
                                        </div>
                                        
                                        {/* ✅ EDIT & DELETE BUTTONS ON THE CARD */}
                                        <div style={{ display: 'flex', gap: '8px', zIndex: 10 }}>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleEditFeedbackForm(form); }} 
                                                style={{ background: '#f8fafc', color: '#3b82f6', border: '1px solid #e2e8f0', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                                            >
                                                <i className="fas fa-pen"></i>
                                            </button>
                                            <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteFeedbackForm(form.id); }} 
                                                style={{ background: '#fee2e2', color: '#ef4444', border: '1px solid #fecaca', padding: '8px 12px', borderRadius: '8px', cursor: 'pointer', transition: '0.2s' }}
                                            >
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="empty-state-modern" style={{ gridColumn: '1 / -1' }}>
                                        <i className="fas fa-clipboard-list" style={{ fontSize: '40px', color: '#94a3b8', opacity: 0.5 }}></i>
                                        <p>No feedback forms created yet.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* --- INSIDE A SPECIFIC FORM --- */}
                        {fbTab === 'view' && selectedFormToView && (
                            <div className="fade-in-up" style={{ background: 'white', borderRadius: '20px', padding: '30px', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.05)' }}>
                                <button 
                                    onClick={() => setSelectedFormToView(null)}
                                    style={{ background: 'transparent', border: 'none', color: '#64748b', fontWeight: '700', cursor: 'pointer', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}
                                >
                                    <i className="fas fa-arrow-left"></i> Back to Forms
                                </button>
                                
                                <div style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                                    <div>
                                        <h2 style={{ margin: 0, color: '#1e293b', fontSize: '22px' }}>{selectedFormToView.title}</h2>
                                        {!isResponsesLoading && (
                                            <p style={{ margin: '5px 0 0', color: '#64748b' }}>Total Submissions: <strong>{formResponses.length}</strong></p>
                                        )}
                                    </div>
                                    
                                    {/* 📥 GOOGLE FORMS STYLE EXPORT BUTTONS */}
                                    {!isResponsesLoading && formResponses.length > 0 && (
                                        <div style={{ display: 'flex', gap: '10px' }}>
                                            <button 
                                                onClick={() => {
                                                    // 📊 EXCEL EXPORT LOGIC
                                                    const rows = formResponses.map(r => {
                                                        const teacherInfo = deptUsers.find(u => u.id === r.teacherId);
                                                        const teacherName = teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : 'Unknown Teacher';
                                                        
                                                        let rowData = {
                                                            "Date Submitted": r.submittedAt?._seconds ? new Date(r.submittedAt._seconds * 1000).toLocaleString() : new Date().toLocaleString(),
                                                            "Teacher Name": teacherName,
                                                            "Subject": r.subject
                                                        };
                                                        
                                                        // Add all questions as columns
                                                        selectedFormToView.questions.forEach(q => {
                                                            const ans = r.answers.find(a => a.questionText === q.text);
                                                            rowData[q.text] = ans ? ans.answer : 'No Answer';
                                                        });
                                                        return rowData;
                                                    });

                                                    const worksheet = XLSX.utils.json_to_sheet(rows);
                                                    const workbook = XLSX.utils.book_new();
                                                    XLSX.utils.book_append_sheet(workbook, worksheet, "Responses");
                                                    XLSX.writeFile(workbook, `${selectedFormToView.title}_Report.xlsx`);
                                                }}
                                                style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                                                onMouseOver={e => e.currentTarget.style.background = '#d1fae5'}
                                                onMouseOut={e => e.currentTarget.style.background = '#ecfdf5'}
                                            >
                                                <i className="fas fa-file-excel"></i> Download Excel
                                            </button>

                                            <button 
                                                onClick={() => {
                                                    // 📄 PDF EXPORT LOGIC
                                                    const doc = new jsPDF();
                                                    
                                                    // Header (College Name & Details)
                                                    doc.setFontSize(18);
                                                    doc.setTextColor(30, 41, 59);
                                                    doc.text(hodInfo.instituteName || "Institute Feedback Report", 14, 20);
                                                    
                                                    doc.setFontSize(11);
                                                    doc.setTextColor(100, 116, 139);
                                                    doc.text(`Department: ${hodInfo.department}`, 14, 28);
                                                    doc.text(`Form Title: ${selectedFormToView.title}`, 14, 34);
                                                    doc.text(`Target Audience: ${selectedFormToView.targetYear} ${selectedFormToView.division !== 'All' ? `(Div ${selectedFormToView.division})` : ''}`, 14, 40);
                                                    doc.text(`Total Submissions: ${formResponses.length}`, 14, 46);

                                                    let startY = 55;

                                                    // Group responses by Teacher/Subject
                                                    const grouped = formResponses.reduce((acc, curr) => {
                                                        const key = `${curr.teacherId}_${curr.subject}`;
                                                        if(!acc[key]) acc[key] = { teacherId: curr.teacherId, subject: curr.subject, responses: [] };
                                                        acc[key].responses.push(curr);
                                                        return acc;
                                                    }, {});

                                                    Object.values(grouped).forEach((group, index) => {
                                                        const teacherInfo = deptUsers.find(u => u.id === group.teacherId);
                                                        const teacherName = teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : 'Unknown Teacher';

                                                        // Section Title
                                                        doc.setFontSize(13);
                                                        doc.setTextColor(37, 99, 235);
                                                        doc.text(`Teacher: ${teacherName} | Subject: ${group.subject}`, 14, startY);
                                                        startY += 6;

                                                        // Table Data
                                                        const tableColumn = selectedFormToView.questions.map(q => q.text);
                                                        const tableRows = group.responses.map(r => {
                                                            return selectedFormToView.questions.map(q => {
                                                                const ans = r.answers.find(a => a.questionText === q.text);
                                                                return ans ? ans.answer : '-';
                                                            });
                                                        });

                                                        // ✅ THE FIX: Call autoTable directly and pass 'doc' as the first argument
                                                        autoTable(doc, {
                                                            startY: startY,
                                                            head: [tableColumn],
                                                            body: tableRows,
                                                            theme: 'grid',
                                                            styles: { fontSize: 8, cellPadding: 3 },
                                                            headStyles: { fillColor: [59, 130, 246], textColor: 255 },
                                                            margin: { top: 15 }
                                                        });

                                                        startY = doc.lastAutoTable.finalY + 15;

                                                        // Add page break if running out of space
                                                        if (startY > 270) {
                                                            doc.addPage();
                                                            startY = 20;
                                                        }
                                                    });

                                                    doc.save(`${selectedFormToView.title}_Report.pdf`);
                                                }}
                                                style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '10px 16px', borderRadius: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                                                onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                                                onMouseOut={e => e.currentTarget.style.background = '#eff6ff'}
                                            >
                                                <i className="fas fa-file-pdf"></i> Download PDF
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* ✅ THE 2-4 SEC LOADER UI */}
                                {isResponsesLoading ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '250px', animation: 'fadeIn 0.3s' }}>
                                        <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px', position: 'relative' }}>
                                            <div style={{ position: 'absolute', width: '100%', height: '100%', border: '3px solid transparent', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                                            <i className="fas fa-chart-pie" style={{ color: '#3b82f6', fontSize: '24px' }}></i>
                                        </div>
                                        <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px' }}>Analyzing Data...</h3>
                                        <p style={{ margin: '5px 0 0', color: '#64748b', fontSize: '13px' }}>Compiling anonymous feedback</p>
                                    </div>
                                ) : formResponses.length === 0 ? (
                                    <p style={{ color: '#94a3b8', textAlign: 'center', padding: '40px 0', fontStyle: 'italic' }}>No students have submitted feedback yet.</p>
                                ) : (
                                    <div>
                                        {/* Group responses by Teacher & Subject logic */}
                                        {Object.entries(
                                            formResponses.reduce((acc, curr) => {
                                                const key = `${curr.teacherId}_${curr.subject}`;
                                                if(!acc[key]) acc[key] = { teacherId: curr.teacherId, subject: curr.subject, responses: [] };
                                                acc[key].responses.push(curr);
                                                return acc;
                                            }, {})
                                        ).map(([key, group]) => {
                                            const teacherInfo = deptUsers.find(u => u.id === group.teacherId);
                                            const teacherName = teacherInfo ? `${teacherInfo.firstName} ${teacherInfo.lastName}` : 'Unknown Teacher';

                                            return (
                                                <div key={key} className="fb-teacher-group">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px' }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: '#dbeafe', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                            {teacherName.charAt(0)}
                                                        </div>
                                                        <div>
                                                            <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>{teacherName}</h3>
                                                            <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', background: 'white', padding: '2px 8px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>{group.subject}</span>
                                                        </div>
                                                        <div style={{ marginLeft: 'auto', fontSize: '12px', color: '#94a3b8', fontWeight: 'bold' }}>
                                                            {group.responses.length} Submissions
                                                        </div>
                                                    </div>

                                                    {/* Display Answers Aggregated */}
                                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px' }}>
                                                        {selectedFormToView.questions.map((q, i) => {
                                                            const answers = group.responses.map(r => {
                                                                const ansObj = r.answers.find(a => a.questionText === q.text);
                                                                return ansObj ? ansObj.answer : 'No Answer';
                                                            });

                                                            return (
                                                                <div key={q.id} style={{ background: 'white', padding: '15px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                                                                    <p style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: '700', color: '#334155' }}>Q{i+1}: {q.text}</p>
                                                                    
                                                                    {q.type === 'mcq' ? (
                                                                        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '12px', color: '#64748b' }}>
                                                                            {q.options.map(opt => {
                                                                                const count = answers.filter(a => a === opt).length;
                                                                                return count > 0 ? <li key={opt}><strong>{opt}:</strong> {count} votes</li> : null;
                                                                            })}
                                                                        </ul>
                                                                    ) : (
                                                                        <div style={{ maxHeight: '100px', overflowY: 'auto', fontSize: '12px', color: '#64748b', background: '#f8fafc', padding: '8px', borderRadius: '6px' }}>
                                                                            {answers.map((ans, idx) => (
                                                                                <div key={idx} style={{ borderBottom: '1px solid #e2e8f0', paddingBottom: '4px', marginBottom: '4px' }}>"{ans}"</div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* ✅ UPDATED ANALYTICS TAB */}
                {activeTab === 'analytics' && (
                    <div className="content-section">
                        {/* Header: Title & Year/Division Selector */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '15px', marginTop: '15px' }}>
                            <div>
                                <h2 className="content-title" style={{ margin: 0 }}>Attendance Analytics</h2>
                                <p style={{ margin: '5px 0 0', fontSize: '13px', color: '#64748b' }}>
                                    {isFE
                                        ? `Viewing FE Data ${analyticsDivision !== 'All' ? `- Division ${analyticsDivision}` : ''}`
                                        : `Managing criteria for ${analyticsYear}`
                                    }
                                    {' '}(Current: {analyticsData.threshold}%)
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>

                                {/* Criteria Changer */}
                                <div style={{ background: 'white', padding: '5px 10px', borderRadius: '10px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}>Min %:</span>
                                    <input
                                        type="number"
                                        value={criteria[analyticsYear]}
                                        onChange={(e) => setCriteria({ ...criteria, [analyticsYear]: Number(e.target.value) })}
                                        style={{ width: '50px', padding: '4px', border: '1px solid #cbd5e1', borderRadius: '6px', fontWeight: 'bold', textAlign: 'center' }}
                                    />
                                </div>

                                {/* ✅ NEW: Report Type Toggle (Theory / Practical) */}
                                <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '12px', display: 'flex', gap: '5px' }}>
                                    {['Overall', 'Theory', 'Practical'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => setAnalyticsFilter(type)}
                                            style={{
                                                padding: '8px 16px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                                                fontSize: '13px', fontWeight: '700',
                                                background: analyticsFilter === type ? '#ffffff' : 'transparent',
                                                color: analyticsFilter === type ? '#2563eb' : '#64748b',
                                                boxShadow: analyticsFilter === type ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                                transition: 'all 0.2s ease'
                                            }}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>

                                {/* Division/Year Selector */}
                                {isFE ? (
                                    <div style={{ minWidth: '100px', zIndex: 50 }}>
                                        <CustomMobileSelect
                                            label="Filter by Division"
                                            value={analyticsDivision}
                                            onChange={setAnalyticsDivision}
                                            options={[
                                                { value: 'All', label: 'All Divisions' },
                                                { value: 'A', label: 'Division A' },
                                                { value: 'B', label: 'Division B' },
                                                { value: 'C', label: 'Division C' },
                                                { value: 'D', label: 'Division D' },
                                                { value: 'E', label: 'Division E' },
                                                { value: 'F', label: 'Division F' },
                                                { value: 'G', label: 'Division G' },
                                                { value: 'H', label: 'Division H' },
                                                { value: 'I', label: 'Division I' },
                                                { value: 'J', label: 'Division J' },
                                                { value: 'K', label: 'Division K' },
                                                { value: 'L', label: 'Division L' }
                                            ]}
                                        />
                                    </div>
                                ) : (
                                    <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '12px', display: 'flex', gap: '5px' }}>
                                        {['SE', 'TE', 'BE'].map(year => (
                                            <button
                                                key={year}
                                                onClick={() => setAnalyticsYear(year)}
                                                style={{
                                                    padding: '8px 16px', border: 'none', borderRadius: '10px', cursor: 'pointer',
                                                    fontSize: '13px', fontWeight: '700',
                                                    background: analyticsYear === year ? '#ffffff' : 'transparent',
                                                    color: analyticsYear === year ? '#2563eb' : '#64748b',
                                                    boxShadow: analyticsYear === year ? '0 4px 12px rgba(0,0,0,0.05)' : 'none',
                                                    transition: 'all 0.2s ease'
                                                }}
                                            >
                                                {year}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Summary Cards */}
                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '25px', gap: '15px' }}>
                            <div className="card" style={{ padding: '20px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>
                                            {isFE ? `Total Students` : `Total ${analyticsYear}`}
                                        </span>
                                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#1e293b', marginTop: '5px' }}>{analyticsData.total}</div>
                                    </div>
                                    <div style={{ background: '#f1f5f9', padding: '10px', borderRadius: '12px', color: '#64748b' }}><i className="fas fa-users"></i></div>
                                </div>
                            </div>
                            <div className="card" style={{ padding: '20px', background: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <span style={{ fontSize: '11px', color: '#047857', fontWeight: '700', textTransform: 'uppercase' }}>Safe ({'>'}{analyticsData.threshold}%)</span>
                                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#065f46', marginTop: '5px' }}>{analyticsData.safe.length}</div>
                                    </div>
                                    <div style={{ background: '#d1fae5', padding: '10px', borderRadius: '12px', color: '#059669' }}><i className="fas fa-check-circle"></i></div>
                                </div>
                            </div>
                            <div className="card" style={{ padding: '20px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '16px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <span style={{ fontSize: '11px', color: '#b91c1c', fontWeight: '700', textTransform: 'uppercase' }}>Defaulters ({'<'}{analyticsData.threshold}%)</span>
                                        <div style={{ fontSize: '28px', fontWeight: '800', color: '#b91c1c', marginTop: '5px' }}>{analyticsData.defaulters.length}</div>
                                    </div>
                                    <div style={{ background: '#fee2e2', padding: '10px', borderRadius: '12px', color: '#dc2626' }}><i className="fas fa-exclamation-triangle"></i></div>
                                </div>
                            </div>
                        </div>

                        {/* Search Bar */}
                        <div className="search-box-wrapper" style={{ maxWidth: '100%', marginBottom: '20px' }}>
                            <i className="fas fa-search search-icon"></i>
                            <input
                                type="text"
                                placeholder={`Search ${isFE ? 'FE' : analyticsYear} defaulters...`}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="search-input-modern"
                            />
                        </div>

                        {/* Charts & List Grid */}
                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '25px', alignItems: 'start' }}>

                            {/* Card 1: Pie Chart */}
                            <div className="card" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '25px', position: 'relative' }}>
                                <h3 style={{ alignSelf: 'flex-start', marginBottom: '15px', fontSize: '16px', color: '#334155', fontWeight: '700' }}>
                                    {analyticsFilter} Status ({isFE ? (analyticsDivision === 'All' ? 'FE Total' : `Div ${analyticsDivision}`) : analyticsYear})
                                </h3>

                                <div style={{ width: '100%', height: '300px', position: 'relative' }}>
                                    {/* Center Count */}
                                    <div style={{
                                        position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -60%)',
                                        textAlign: 'center', pointerEvents: 'none', zIndex: 10
                                    }}>
                                        <div style={{ fontSize: '36px', fontWeight: '800', color: '#ef4444', lineHeight: '1' }}>
                                            {analyticsData.defaulters.length}
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', marginTop: '5px' }}>
                                            Defaulters
                                        </div>
                                    </div>

                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={pieData}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={85}
                                                outerRadius={115}
                                                paddingAngle={5}
                                                dataKey="value"
                                                stroke="none"
                                            >
                                                {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                                            </Pie>
                                            <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }} />
                                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {/* Card 2: Defaulters List */}
                            <div className="card" style={{ borderTop: '4px solid #ef4444', height: '420px', display: 'flex', flexDirection: 'column', padding: '0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 15px', borderBottom: '1px solid #f1f5f9' }}>
                                    <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                                        ⚠️ Critical List
                                    </h3>
                                    <span className="nav-badge" style={{ background: '#fee2e2', color: '#ef4444', fontSize: '12px', padding: '4px 10px' }}>
                                        {analyticsData.defaulters.length}
                                    </span>
                                </div>

                                <div className="table-wrapper custom-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', border: 'none', padding: '0' }}>
                                    {analyticsData.defaulters.length > 0 ? (
                                        <table className="attendance-table" style={{ width: '100%', minWidth: '340px' }}>
                                            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ background: 'white', fontSize: '11px', color: '#64748b', paddingLeft: '20px' }}>Student</th>
                                                    <th style={{ background: 'white', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>{analyticsFilter} %</th>
                                                    <th style={{ background: 'white', fontSize: '11px', color: '#64748b', textAlign: 'right', paddingRight: '20px' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analyticsData.defaulters.map(s => (
                                                    <tr key={s.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                                                        <td style={{ padding: '12px 20px' }}>
                                                            <div style={{ fontWeight: '700', color: '#1e293b', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' }}>
                                                                {s.firstName} {s.lastName}
                                                            </div>
                                                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                                                                {s.rollNo} {isFE && s.division && <span style={{ color: '#3b82f6' }}>({s.division})</span>}
                                                            </div>
                                                        </td>
                                                        <td style={{ textAlign: 'center', padding: '12px' }}>
                                                            <span className="status-badge-pill" style={{ background: '#fef2f2', color: '#dc2626', fontSize: '11px', padding: '4px 10px' }}>
                                                                {s.percentage.toFixed(0)}%
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right', padding: '12px 20px' }}>
                                                            <button
                                                                onClick={() => handleSendNotice(s)}
                                                                className="btn-action"
                                                                style={{
                                                                    background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe',
                                                                    borderRadius: '8px', fontSize: '11px', padding: '6px 12px', fontWeight: '700',
                                                                    cursor: 'pointer', whiteSpace: 'nowrap'
                                                                }}
                                                            >
                                                                Send
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', padding: '40px' }}>
                                            <i className="fas fa-check-circle" style={{ fontSize: '40px', marginBottom: '15px', color: '#10b981', opacity: 0.5 }}></i>
                                            <p style={{ fontSize: '14px', fontWeight: '600' }}>All Clear!</p>
                                            <p style={{ fontSize: '12px' }}>No defaulters below {analyticsData.threshold}%</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
                {activeTab === 'profile' && (
                    <div className="content-section">
                        <h2 className="content-title">My Profile</h2>

                        {/* Container to stack Profile and Security cards */}
                        <div className="cards-grid" style={{ gridTemplateColumns: '1fr' }}>

                            {/* 1. EXISTING PROFILE CARD */}
                            <div className="card" style={{ padding: 0, overflow: 'hidden', maxWidth: '800px', margin: '0 auto' }}>

                                {/* Cover Photo & Avatar Area */}
                                <div className="profile-cover">
                                    <div className="profile-avatar-wrapper">
                                        <div className="profile-avatar-img">
                                            {hodInfo?.firstName?.charAt(0)}
                                        </div>
                                    </div>
                                    {/* Edit Button positioned on Cover */}
                                    <div style={{ position: 'absolute', bottom: '-50px', right: '20px' }}>
                                        <button className="edit-btn-floating" onClick={() => setIsEditingProfile(!isEditingProfile)}>
                                            {isEditingProfile ? 'Cancel Editing' : <><i className="fas fa-pen"></i> Edit Profile</>}
                                        </button>
                                    </div>
                                </div>

                                {/* Header Info */}
                                <div className="profile-header-content">
                                    <div style={{ marginTop: '10px' }}>
                                        <h2 style={{ margin: 0, fontSize: '24px', color: '#1e293b' }}>
                                            {hodInfo?.firstName} {hodInfo?.lastName}
                                        </h2>
                                        <p style={{ margin: '4px 0 0', color: '#64748b', fontSize: '14px' }}>
                                            Head of Department • {hodInfo?.department}
                                        </p>
                                    </div>
                                </div>

                                {/* Details Grid (View Mode) */}
                                {!isEditingProfile ? (
                                    <div className="profile-grid">
                                        <div className="profile-field">
                                            <label>Institute</label>
                                            <div><i className="fas fa-university" style={{ color: '#6366f1' }}></i> {hodInfo?.instituteName}</div>
                                        </div>
                                        <div className="profile-field">
                                            <label>Email Address</label>
                                            <div><i className="fas fa-envelope" style={{ color: '#ef4444' }}></i> {hodInfo?.email}</div>
                                        </div>
                                        <div className="profile-field">
                                            <label>Qualification</label>
                                            <div><i className="fas fa-graduation-cap" style={{ color: '#f59e0b' }}></i> {hodInfo?.qualification || 'Not Added'}</div>
                                        </div>
                                        <div className="profile-field">
                                            <label>Phone Number</label>
                                            <div><i className="fas fa-phone" style={{ color: '#10b981' }}></i> {hodInfo?.phone || 'Not Added'}</div>
                                        </div>
                                    </div>
                                ) : (
                                    // Edit Form
                                    <form onSubmit={handleUpdateProfile} style={{ padding: '20px' }}>
                                        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                            <div className="input-group" style={{ flex: 1 }}>
                                                <label>First Name</label>
                                                <input type="text" value={profileForm.firstName} onChange={e => setProfileForm({ ...profileForm, firstName: e.target.value })} className="modern-input" />
                                            </div>
                                            <div className="input-group" style={{ flex: 1 }}>
                                                <label>Last Name</label>
                                                <input type="text" value={profileForm.lastName} onChange={e => setProfileForm({ ...profileForm, lastName: e.target.value })} className="modern-input" />
                                            </div>
                                        </div>

                                        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px' }}>
                                            <div className="input-group" style={{ flex: 1 }}>
                                                <label>Qualification</label>
                                                <input type="text" value={profileForm.qualification} onChange={e => setProfileForm({ ...profileForm, qualification: e.target.value })} className="modern-input" placeholder="e.g. PhD" />
                                            </div>
                                            <div className="input-group" style={{ flex: 1 }}>
                                                <label>Phone</label>
                                                <input type="text" value={profileForm.phone} onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })} className="modern-input" placeholder="+91..." />
                                            </div>
                                        </div>

                                        <button className="btn-primary" disabled={loading} style={{ width: '100%' }}>
                                            {loading ? 'Saving Changes...' : 'Save Updates'}
                                        </button>
                                    </form>
                                )}
                            </div>

                            {/* 2. ✅ NEW 2FA SECTION FOR HOD */}
                            <div className="card" style={{ borderLeft: '4px solid #10b981', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #f1f5f9' }}>
                                    <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px' }}>
                                        <i className="fas fa-shield-alt"></i>
                                    </div>
                                    <div>
                                        <h3 style={{ margin: 0, fontSize: '18px', color: '#1e293b' }}>Two-Factor Authentication</h3>
                                        <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Protect your Department Head account.</p>
                                    </div>
                                </div>

                                {/* 2FA Component */}
                                <TwoFactorSetup user={hodInfo} />
                            </div>
                            {/* ✅ Security: Change Password */}
                            <div className="card" style={{ maxWidth: '800px', margin: '20px auto', width: '100%', borderLeft: '4px solid #f59e0b' }}>
                                <h3><i className="fas fa-lock"></i> Change Password</h3>
                                {/* ✅ FIX: Vertical stacking for Mobile */}
                                <form onSubmit={handleChangePassword} style={{
                                    marginTop: '15px',
                                    display: 'flex',
                                    flexDirection: 'column', // Force one below other
                                    gap: '20px'
                                }}>
                                    <div className="input-group">
                                        <label>New Password</label>
                                        <input type="password" value={passwordForm.newPassword} onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} required minLength={6} placeholder="Min 6 chars" />
                                    </div>
                                    <div className="input-group">
                                        <label>Confirm Password</label>
                                        <input type="password" value={passwordForm.confirmPassword} onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} required placeholder="Repeat password" />
                                    </div>
                                    <button className="btn-secondary" style={{ width: '100%', height: '48px' }}>Update Password</button>
                                </form>
                            </div>

                        </div>
                    </div>
                )}
                {activeTab === 'announcements' && (
                    <div className="content-section">
                        {/* --- 1. MODERN HEADER & TOGGLE --- */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginBottom: '30px', marginTop: '15px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                <div style={{ width: '50px', height: '50px', borderRadius: '12px', background: 'linear-gradient(135deg, #2563eb, #1e40af)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px', boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)' }}>
                                    <i className="fas fa-bullhorn"></i>
                                </div>
                                <div>
                                    <h2 className="content-title" style={{ fontSize: '24px', margin: 0, color: '#1e293b' }}>
                                        Announcements
                                    </h2>
                                    <p style={{ color: '#64748b', margin: '4px 0 0', fontSize: '14px' }}>Manage department circulars & updates.</p>
                                </div>
                            </div>

                            {/* TOGGLE BUTTONS */}
                            <div style={{ background: 'white', padding: '6px', borderRadius: '12px', display: 'flex', gap: '8px', boxShadow: '0 2px 10px rgba(0,0,0,0.03)', width: 'fit-content', border: '1px solid #f1f5f9' }}>
                                <button
                                    onClick={() => setAnnoTab('create')}
                                    style={{
                                        padding: '10px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                                        background: annoTab === 'create' ? '#eff6ff' : 'transparent',
                                        color: annoTab === 'create' ? '#2563eb' : '#64748b',
                                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    <i className="fas fa-pen-nib"></i> Compose
                                </button>
                                <button
                                    onClick={() => setAnnoTab('history')}
                                    style={{
                                        padding: '10px 24px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '700',
                                        background: annoTab === 'history' ? '#eff6ff' : 'transparent',
                                        color: annoTab === 'history' ? '#2563eb' : '#64748b',
                                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '8px'
                                    }}
                                >
                                    <i className="fas fa-history"></i> History
                                </button>
                            </div>
                        </div>

                        {/* --- 2. COMPOSE VIEW --- */}
                        {annoTab === 'create' && (
                            <div className="card" style={{ maxWidth: '750px', border: 'none', boxShadow: '0 20px 40px -10px rgba(0,0,0,0.08)', overflow: 'hidden', padding: '0', borderRadius: '20px' }}>
                                <div style={{ background: 'white', padding: '30px 40px', borderBottom: '1px solid #f1f5f9' }}>
                                    <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '12px', color: '#1e293b' }}>
                                        <span style={{ background: '#dbeafe', color: '#2563eb', padding: '8px', borderRadius: '8px' }}><i className="fas fa-layer-group"></i></span>
                                        Draft Notice
                                    </h3>
                                </div>

                                <form onSubmit={handlePostAnnouncement} style={{ padding: '30px 40px' }}>
                                    {/* Target Audience */}
                                    <div style={{ marginBottom: '25px' }}>
                                        <label style={{ display: 'block', fontWeight: '700', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', marginBottom: '10px' }}>Target Audience</label>
                                        <CustomDropdown
                                            value={announcementForm.targetYear}
                                            // ✅ FIXED: Use 'val' directly instead of e.target.value
                                            onChange={(val) => setAnnouncementForm({ ...announcementForm, targetYear: val })}
                                            options={
                                                isFE ? [
                                                    // ✅ FE OPTIONS: All FE, Specific Divisions, Faculty
                                                    { value: 'All', label: <span><i className="fas fa-users" style={{ marginRight: '10px', color: '#3b82f6' }}></i> All FE Students</span> },
                                                    ...DIVISIONS.map(div => ({
                                                        value: `Division ${div}`,
                                                        label: <span><i className="fas fa-layer-group" style={{ marginRight: '10px', color: '#8b5cf6' }}></i> Division {div}</span>
                                                    })),
                                                    { value: 'Teachers', label: <span><i className="fas fa-chalkboard-teacher" style={{ marginRight: '10px', color: '#ef4444' }}></i> Faculty</span> }
                                                ] : [
                                                    // STANDARD OPTIONS: Years, Faculty
                                                    { value: 'All', label: <span><i className="fas fa-users" style={{ marginRight: '10px', color: '#3b82f6' }}></i> All Students</span> },
                                                    { value: 'SE', label: <span><i className="fas fa-graduation-cap" style={{ marginRight: '10px', color: '#ec4899' }}></i> Second Year (SE)</span> },
                                                    { value: 'TE', label: <span><i className="fas fa-graduation-cap" style={{ marginRight: '10px', color: '#f59e0b' }}></i> Third Year (TE)</span> },
                                                    { value: 'BE', label: <span><i className="fas fa-graduation-cap" style={{ marginRight: '10px', color: '#10b981' }}></i> Final Year (BE)</span> },
                                                    { value: 'Teachers', label: <span><i className="fas fa-chalkboard-teacher" style={{ marginRight: '10px', color: '#ef4444' }}></i> Faculty</span> }
                                                ]
                                            }
                                        />
                                    </div>

                                    {/* Title */}
                                    <div style={{ marginBottom: '25px' }}>
                                        <label style={{ display: 'block', fontWeight: '700', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Subject Line</label>
                                        <div style={{ position: 'relative' }}>
                                            <i className="fas fa-heading" style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}></i>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. Schedule for Upcoming Exams"
                                                value={announcementForm.title}
                                                onChange={e => setAnnouncementForm({ ...announcementForm, title: e.target.value })}
                                                style={{ width: '100%', padding: '14px 14px 14px 45px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', outline: 'none', transition: 'all 0.2s', fontWeight: '500', color: '#334155' }}
                                                onFocus={(e) => { e.target.style.background = 'white'; e.target.style.borderColor = '#3b82f6'; }}
                                                onBlur={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; }}
                                            />
                                        </div>
                                    </div>

                                    {/* Message */}
                                    <div style={{ marginBottom: '25px' }}>
                                        <label style={{ display: 'block', fontWeight: '700', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Message Body</label>
                                        <textarea
                                            rows="6"
                                            required
                                            placeholder="Write the full details of the announcement here..."
                                            value={announcementForm.message}
                                            onChange={e => setAnnouncementForm({ ...announcementForm, message: e.target.value })}
                                            style={{ width: '100%', padding: '16px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: '14px', resize: 'vertical', outline: 'none', fontFamily: 'inherit', transition: 'all 0.2s', lineHeight: '1.6', color: '#334155' }}
                                            onFocus={(e) => { e.target.style.background = 'white'; e.target.style.borderColor = '#3b82f6'; }}
                                            onBlur={(e) => { e.target.style.background = '#f8fafc'; e.target.style.borderColor = '#e2e8f0'; }}
                                        />
                                    </div>

                                    {/* File Upload */}
                                    <div style={{ marginBottom: '30px' }}>
                                        <label style={{ display: 'block', fontWeight: '700', color: '#64748b', fontSize: '12px', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>Attachment</label>
                                        <input
                                            type="file"
                                            id="anno-file"
                                            onChange={e => setAnnoFile(e.target.files[0])}
                                            style={{ display: 'none' }}
                                        />
                                        <label htmlFor="anno-file" style={{
                                            display: 'flex', alignItems: 'center', gap: '15px',
                                            padding: '15px 20px', border: '2px dashed #cbd5e1', borderRadius: '12px',
                                            background: 'white', cursor: 'pointer', transition: 'all 0.2s', color: '#64748b'
                                        }}
                                            onMouseOver={(e) => { e.currentTarget.style.borderColor = '#3b82f6'; e.currentTarget.style.background = '#eff6ff'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.borderColor = '#cbd5e1'; e.currentTarget.style.background = 'white'; }}
                                        >
                                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7', fontSize: '18px' }}>
                                                <i className={`fas ${annoFile ? 'fa-check' : 'fa-paperclip'}`}></i>
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                <span style={{ fontSize: '14px', fontWeight: '600', color: '#1e293b' }}>
                                                    {annoFile ? annoFile.name : "Attach Document"}
                                                </span>
                                                <span style={{ fontSize: '12px', color: '#94a3b8' }}>PDF, JPG, PNG (Max 5MB)</span>
                                            </div>
                                        </label>
                                    </div>

                                    {/* Submit Button */}
                                    <button className="btn-primary" style={{ width: '100%', padding: '16px', borderRadius: '12px', fontSize: '16px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', boxShadow: '0 10px 20px -5px rgba(37, 99, 235, 0.4)', background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', border: 'none' }}>
                                        <span>Publish Announcement</span> <i className="fas fa-paper-plane"></i>
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* --- 3. HISTORY VIEW --- */}
                        {annoTab === 'history' && (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
                                {announcements.length === 0 ? (
                                    <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 20px', color: '#94a3b8', background: 'white', borderRadius: '20px', border: '1px dashed #e2e8f0' }}>
                                        <div style={{ width: '80px', height: '80px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px auto' }}>
                                            <i className="fas fa-inbox" style={{ fontSize: '32px', opacity: 0.3 }}></i>
                                        </div>
                                        <p style={{ fontWeight: '600', fontSize: '16px', margin: 0 }}>No announcements history.</p>
                                    </div>
                                ) : (
                                    announcements.map(a => (
                                        <div key={a.id} style={{
                                            background: 'white', borderRadius: '16px', padding: '24px',
                                            border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.02)',
                                            position: 'relative', display: 'flex', flexDirection: 'column',
                                            transition: 'transform 0.2s', cursor: 'default'
                                        }}
                                            onMouseOver={(e) => e.currentTarget.style.transform = 'translateY(-3px)'}
                                            onMouseOut={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                                        >
                                            {/* Header */}
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '15px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <span style={{
                                                        width: '32px', height: '32px', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px',
                                                        background: a.targetYear === 'Teachers' ? '#fff7ed' : '#eff6ff',
                                                        color: a.targetYear === 'Teachers' ? '#c2410c' : '#2563eb'
                                                    }}>
                                                        <i className={`fas ${a.targetYear === 'Teachers' ? 'fa-chalkboard-teacher' : 'fa-user-graduate'}`}></i>
                                                    </span>

                                                    {/* ✅ UPDATED LABEL LOGIC */}
                                                    <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b' }}>
                                                        {a.targetYear === 'All'
                                                            ? 'Everyone'
                                                            : (a.division && a.division !== 'All')
                                                                ? `${a.targetYear} (Div ${a.division})`
                                                                : a.targetYear
                                                        }
                                                    </span>
                                                </div>
                                                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '600', background: '#f8fafc', padding: '4px 8px', borderRadius: '6px' }}>
                                                    {a.createdAt?.toDate().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                                                </span>
                                            </div>

                                            {/* Content */}
                                            <h4 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#1e293b', lineHeight: '1.4', fontWeight: '700' }}>{a.title}</h4>
                                            <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 20px 0', lineHeight: '1.6', flex: 1 }}>{a.message}</p>

                                            {/* Footer */}
                                            <div className="anno-history-footer">
                                                {a.attachmentUrl ? (
                                                    <a href={a.attachmentUrl} target="_blank" rel="noreferrer" className="anno-attachment-link">
                                                        <i className="fas fa-file-alt"></i> Open File
                                                    </a>
                                                ) : (
                                                    <span style={{ fontSize: '12px', color: '#cbd5e1', fontStyle: 'italic', fontWeight: '500' }}>No attachment</span>
                                                )}

                                                <button
                                                    onClick={() => handleDeleteAnnouncement(a.id)}
                                                    className="anno-delete-btn"
                                                    title="Delete Notice"
                                                >
                                                    <i className="fas fa-trash-alt"></i>
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}

                        {/* ✅ UNIQUE CSS FOR PERFECT ALIGNMENT */}
                        <style>{`
                            .anno-history-footer {
                                margin-top: auto;
                                padding-top: 15px;
                                border-top: 1px solid #f8fafc;
                                display: flex;
                                justify-content: space-between;
                                align-items: center; /* 🔑 This forces vertical center alignment */
                                height: 40px; /* Fixed height container */
                            }

                            .anno-attachment-link {
                                font-size: 12px;
                                font-weight: 600;
                                color: #2563eb;
                                text-decoration: none;
                                display: flex;
                                align-items: center;
                                gap: 8px;
                                background: #f0f9ff;
                                padding: 8px 14px;
                                borderRadius: 8px;
                                transition: all 0.2s;
                                height: 36px; /* Matches delete button height */
                            }
                            .anno-attachment-link:hover {
                                background: #dbeafe;
                            }

                            .anno-delete-btn {
                                background: #fee2e2;
                                color: #ef4444;
                                border: none;
                                width: 36px; /* Fixed square size */
                                height: 36px; 
                                border-radius: 10px;
                                display: flex;
                                align-items: center;
                                justify-content: center;
                                cursor: pointer;
                                transition: all 0.2s;
                                font-size: 14px;
                            }
                            .anno-delete-btn:hover {
                                background: #fecaca;
                                transform: scale(1.05);
                            }
                        `}</style>
                    </div>
                )}

                {activeTab === 'leaves' && (
                    <div className="content-section">
                        <div className="section-header">
                            <h2 className="gradient-text">Student Leave Requests</h2>
                            <p className="subtitle">Review and manage student leave applications.</p>
                        </div>

                        <div className="leaves-grid">
                            {/* ✅ FIXED: Changed 'leaveRequests' to 'leaves' */}
                            {leaves.length > 0 ? (
                                leaves.map(leave => (
                                    <div key={leave.id} className="leave-card-modern">
                                        <div className="leave-card-header">
                                            <div className="student-profile-icon">
                                                {/* Fallback if name is missing */}
                                                {leave.studentName ? leave.studentName.charAt(0) : 'S'}
                                            </div>
                                            <div>
                                                {/* Use studentName from your data structure */}
                                                <h4>{leave.studentName}</h4>
                                                <span className="roll-badge">Roll No: {leave.rollNo}</span>
                                            </div>
                                            <span className={`status-pill ${leave.status}`}>
                                                {leave.status}
                                            </span>
                                        </div>

                                        <div className="leave-body">
                                            <div className="leave-dates">
                                                <div className="date-box">
                                                    <span className="label">From</span>
                                                    <span className="date">{new Date(leave.fromDate).toLocaleDateString()}</span>
                                                </div>
                                                <div className="arrow">➝</div>
                                                <div className="date-box">
                                                    <span className="label">To</span>
                                                    <span className="date">{new Date(leave.toDate).toLocaleDateString()}</span>
                                                </div>
                                            </div>

                                            <div className="reason-box">
                                                <p><strong>Reason:</strong> {leave.reason}</p>
                                            </div>

                                            {leave.documentUrl && (
                                                <a href={leave.documentUrl} target="_blank" rel="noreferrer" className="attachment-link">
                                                    <i className="fas fa-paperclip"></i> View Attachment
                                                </a>
                                            )}
                                        </div>

                                        {leave.status === 'pending' && (
                                            <div className="leave-actions-modern">
                                                <button
                                                    className="action-btn approve"
                                                    onClick={() => handleLeaveAction(leave.id, 'approved')}
                                                >
                                                    <i className="fas fa-check"></i> Approve
                                                </button>
                                                <button
                                                    className="action-btn reject"
                                                    onClick={() => handleLeaveAction(leave.id, 'rejected')}
                                                >
                                                    <i className="fas fa-times"></i> Reject
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                // --- EMPTY STATE ---
                                <div className="empty-state-modern">
                                    <div className="empty-icon-circle">
                                        <i className="fas fa-calendar-check"></i>
                                    </div>
                                    <h3>All Caught Up!</h3>
                                    <p>There are no pending leave requests at the moment.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* --- STUDENT APPLICATIONS TAB (Redesigned) --- */}
                {activeTab === 'requests' && (
                    <div className="content-section">
                        <div className="section-header">
                            <div>
                                <h2 className="gradient-text">Student Applications</h2>
                                <p className="subtitle">Review and manage new registrations.</p>
                            </div>

                            {/* Bulk Action Button (Visible only when items selected) */}
                            {selectedRequestIds.length > 0 && (
                                <button
                                    onClick={() => confirmAction('Approve Selected?', `Approve ${selectedRequestIds.length} students?`, executeBulkApprove)}
                                    className="btn-primary"
                                    style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px', width: 'auto' }}
                                >
                                    <i className="fas fa-check-double"></i>
                                    Approve ({selectedRequestIds.length})
                                </button>
                            )}
                        </div>

                        {/* Selection Bar (Visible only if requests exist) */}
                        {studentRequests.length > 0 && (
                            <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', background: 'white', padding: '10px 15px', borderRadius: '12px', width: 'fit-content', border: '1px solid #e2e8f0' }}>
                                <input
                                    type="checkbox"
                                    id="selectAll"
                                    className="custom-checkbox"
                                    checked={selectedRequestIds.length === studentRequests.length}
                                    onChange={toggleSelectRequestAll}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                <label htmlFor="selectAll" style={{ fontSize: '14px', fontWeight: '700', color: '#475569', cursor: 'pointer' }}>
                                    Select All Applications
                                </label>
                            </div>
                        )}

                        <div className="requests-grid">
                            {studentRequests.length > 0 ? (
                                studentRequests.map(req => (
                                    <div
                                        key={req.id}
                                        className={`request-card ${selectedRequestIds.includes(req.id) ? 'selected' : ''}`}
                                        onClick={() => toggleSelectRequestOne(req.id)}
                                    >
                                        {/* Selection Checkbox */}
                                        <div className="req-selection">
                                            <input
                                                type="checkbox"
                                                checked={selectedRequestIds.includes(req.id)}
                                                onChange={() => toggleSelectRequestOne(req.id)}
                                                className="custom-checkbox"
                                                onClick={(e) => e.stopPropagation()} // Prevent card click conflict
                                            />
                                        </div>

                                        {/* Card Header */}
                                        <div className="req-header">
                                            <div className="student-avatar-small">
                                                {req.firstName ? req.firstName.charAt(0) : 'S'}
                                            </div>
                                            <div>
                                                <h4 className="req-name">{req.firstName} {req.lastName}</h4>
                                                <span className="req-email">{req.email}</span>
                                            </div>
                                        </div>

                                        {/* Info Grid */}
                                        <div className="req-details">
                                            <div className="req-detail-item">
                                                <span className="label">Roll No</span>
                                                <span className="value">{req.rollNo || '-'}</span>
                                            </div>
                                            <div className="req-detail-item">
                                                <span className="label">Year</span>
                                                <span className="value">{req.year || '-'}</span>
                                            </div>
                                            <div className="req-detail-item">
                                                <span className="label">College ID</span>
                                                <span className="value">{req.collegeId || '-'}</span>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="req-actions">
                                            <button
                                                className="action-btn approve"
                                                onClick={(e) => { e.stopPropagation(); confirmAction('Approve?', `Approve ${req.firstName}?`, () => executeSingleApprove(req)); }}
                                            >
                                                <i className="fas fa-check"></i> Approve
                                            </button>
                                            <button
                                                className="action-btn reject"
                                                onClick={(e) => { e.stopPropagation(); confirmAction('Reject?', `Reject?`, () => executeReject(req.id), 'danger'); }}
                                            >
                                                <i className="fas fa-times"></i> Reject
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                /* --- REUSING MODERN EMPTY STATE --- */
                                <div className="empty-state-modern">
                                    <div className="empty-icon-circle">
                                        <i className="fas fa-user-check"></i>
                                    </div>
                                    <h3>No Pending Applications</h3>
                                    <p>Great job! All student registrations have been processed.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
                {/* ✅ DEPT USERS TAB */}
                {activeTab === 'manage' && (
                    <div className="content-section fade-in-up">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 className="content-title" style={{ margin: 0 }}>Department Users</h2>
                        </div>

                        {/* --- 1. TEACHERS LIST --- */}
                        <div className="card card-full-width" style={{ marginBottom: '30px' }}>
                            {/* Flex header for Title + Download Button */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px', borderBottom: '2px solid #f1f5f9', paddingBottom: '10px' }}>
                                <h3 style={{ margin: 0, color: '#1e293b' }}>
                                    <i className="fas fa-chalkboard-teacher" style={{ color: '#3b82f6', marginRight: '8px' }}></i> 
                                    Faculty ({teachersList.length})
                                </h3>
                                <button 
                                    onClick={downloadTeacherEmails}
                                    style={{ background: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                                    onMouseOver={e => e.currentTarget.style.background = '#dbeafe'}
                                    onMouseOut={e => e.currentTarget.style.background = '#eff6ff'}
                                >
                                    <i className="fas fa-file-pdf"></i> Download Directory
                                </button>
                            </div>

                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}></th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Assigned Classes</th>
                                            <th style={{ textAlign: 'center' }}>Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachersList.map(t => (
                                            <tr key={t.id}>
                                                <td>
                                                    <input type="checkbox" checked={selectedUserIds.includes(t.id)} onChange={() => toggleSelectUser(t.id)} className="custom-checkbox" />
                                                </td>
                                                <td>
                                                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{t.firstName} {t.lastName}</div>
                                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{t.phone || 'No Phone'}</div>
                                                </td>
                                                <td style={{ color: '#475569', fontSize: '13px' }}>{t.email}</td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {t.assignedClasses && t.assignedClasses.length > 0 ?
                                                            t.assignedClasses.map((cls, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <span className="status-badge-pill" style={{ fontSize: '10px', padding: '2px 6px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                                                                        {cls.year} (Sem {cls.semester})
                                                                    </span>
                                                                    {cls.divisions && (
                                                                        <span style={{ fontSize: '10px', fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                                                                            Div {cls.divisions}
                                                                        </span>
                                                                    )}
                                                                    <span style={{ fontSize: '12px', color: '#1e293b', fontWeight: '600' }}>
                                                                        {cls.subject}
                                                                    </span>
                                                                </div>
                                                            ))
                                                            : (
                                                                <span style={{ color: '#94a3b8', fontSize: '12px', fontStyle: 'italic' }}>No classes assigned</span>
                                                            )
                                                        }
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <button
                                                        onClick={() => {
                                                            setEditTeacherData(JSON.parse(JSON.stringify(t)));
                                                            setIsEditTeacherModalOpen(true);
                                                        }}
                                                        style={{ background: '#eff6ff', color: '#3b82f6', border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}
                                                        title="Edit Assignments"
                                                    >
                                                        <i className="fas fa-edit"></i>
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* --- 2. STUDENTS LIST (Grouped) --- */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', margin: '0 0 15px 0' }}>
                            <h3 style={{ margin: 0, color: '#1e293b' }}>
                                <i className="fas fa-user-graduate" style={{ color: '#10b981', marginRight: '8px' }}></i> 
                                Enrolled Students ({studentsList.length})
                            </h3>
                            <button 
                                onClick={downloadStudentEmails}
                                style={{ background: '#ecfdf5', color: '#059669', border: '1px solid #a7f3d0', padding: '8px 14px', borderRadius: '10px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }}
                                onMouseOver={e => e.currentTarget.style.background = '#d1fae5'}
                                onMouseOut={e => e.currentTarget.style.background = '#ecfdf5'}
                            >
                                <i className="fas fa-file-pdf"></i> Download Directory
                            </button>
                        </div>

                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                            {(isFE ? DIVISIONS : ['SE', 'TE', 'BE']).map(label => {
                                const groupStudents = studentsList.filter(s =>
                                    isFE ? s.division === label : s.year === label
                                );

                                return (
                                    <div key={label} className="card" style={{ display: 'flex', flexDirection: 'column', height: '350px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '10px' }}>
                                            <h3 style={{ margin: 0, color: '#2563eb' }}>
                                                {isFE ? `Division ${label}` : `${label} Class`}
                                            </h3>
                                            <span className="nav-badge" style={{ background: '#eff6ff', color: '#2563eb', fontSize: '12px' }}>
                                                {groupStudents.length}
                                            </span>
                                        </div>

                                        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto' }}>
                                            {groupStudents.length > 0 ? (
                                                <table className="attendance-table" style={{ fontSize: '13px' }}>
                                                    <thead>
                                                        <tr>
                                                            <th>Roll</th>
                                                            <th>Name</th>
                                                            <th style={{ textAlign: 'right' }}>Edit</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {groupStudents.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo, undefined, { numeric: true })).map(s => (
                                                            <tr key={s.id}>
                                                                <td style={{ fontWeight: 'bold', color: '#475569' }}>{s.rollNo}</td>
                                                                <td>
                                                                    <div style={{ lineHeight: '1.2', color: '#1e293b', fontWeight: '600' }}>
                                                                        {s.firstName} {s.lastName}
                                                                    </div>
                                                                    <div style={{ fontSize: '10px', color: '#64748b' }}>{s.email}</div>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    <button
                                                                        onClick={() => {
                                                                            setEditStudentData({ ...s });
                                                                            setIsEditStudentModalOpen(true);
                                                                        }}
                                                                        style={{
                                                                            background: '#f1f5f9', color: '#64748b', border: 'none',
                                                                            borderRadius: '6px', padding: '6px', cursor: 'pointer', fontSize: '12px'
                                                                        }}
                                                                        onMouseOver={e => e.currentTarget.style.color = '#3b82f6'}
                                                                        onMouseOut={e => e.currentTarget.style.color = '#64748b'}
                                                                    >
                                                                        <i className="fas fa-edit"></i>
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px', fontStyle: 'italic' }}>No students found.</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* --- 3. BULK DELETE BUTTON --- */}
                        {selectedUserIds.length > 0 && (
                            <button className="floating-delete-btn" onClick={handleDeleteUsers}>
                                <i className="fas fa-trash-alt"></i> Delete Selected ({selectedUserIds.length})
                            </button>
                        )}
                    </div>
                )}

                {activeTab === 'timetable' && <ManageTimetable hodInfo={hodInfo} />}
                {/* --- 2. THE UPDATED BEAUTIFUL TAB UI --- */}
                {activeTab === 'addTeacher' && (
                    <div className="content-section">
                        <h2 className="content-title">Add New Teacher</h2>
                        <div className="card fade-in-up" style={{ padding: '25px', border: 'none' }}>
                            <form onSubmit={handleAddTeacher}>

                                {/* Personal Info Grid */}
                                <div className="teacher-form-grid">
                                    <div className="input-group">
                                        <label>First Name</label>
                                        <input type="text" required placeholder="e.g. Rohini" value={teacherForm.firstName} onChange={e => setTeacherForm({ ...teacherForm, firstName: e.target.value })} />
                                    </div>
                                    <div className="input-group">
                                        <label>Last Name</label>
                                        <input type="text" required placeholder="e.g. Sharma" value={teacherForm.lastName} onChange={e => setTeacherForm({ ...teacherForm, lastName: e.target.value })} />
                                    </div>

                                    {/* ✅ NEW PHONE FIELD */}
                                    <div className="input-group">
                                        <label>Phone Number</label>
                                        <input type="tel" required placeholder="+91 9876543210" value={teacherForm.phone} onChange={e => setTeacherForm({ ...teacherForm, phone: e.target.value })} />
                                    </div>

                                    <div className="input-group">
                                        <label>Department</label>
                                        <input type="text" value={hodInfo?.department || ''} disabled style={{ background: '#f1f5f9', color: '#94a3b8' }} />
                                    </div>

                                    {/* Academic Year Select */}
                                    <div style={{ position: 'relative', zIndex: 20 }}>
                                        <CustomMobileSelect
                                            label="Academic Year"
                                            value={teacherForm.academicYear}
                                            onChange={(val) => setTeacherForm({ ...teacherForm, academicYear: val })}
                                            options={[
                                                { value: '2024-2025', label: '2024-2025' },
                                                { value: '2025-2026', label: '2025-2026' },
                                                { value: '2026-2027', label: '2026-2027' },
                                                { value: '2027-2028', label: '2027-2028' },
                                                { value: '2028-2029', label: '2028-2029' }
                                            ]}
                                        />
                                    </div>
                                </div>

                                {/* ✨ BEAUTIFUL ASSIGNMENT SECTION */}
                                <div className="class-assignment-container">
                                    <label style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '15px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        <i className="fas fa-book-open" style={{ marginRight: '8px' }}></i>
                                        Assign Classes & Subjects
                                    </label>

                                    {teacherForm.assignedClasses.map((cls, index) => {
                                        const isFE = hodInfo?.department === 'FE' || hodInfo?.department === 'First Year';
                                        const yearOptions = isFE ? [{ value: 'FE', label: 'First Year' }] : [{ value: 'SE', label: 'SE' }, { value: 'TE', label: 'TE' }, { value: 'BE', label: 'BE' }];

                                        let semOptions = [];
                                        if (cls.year === 'FE') semOptions = [{ value: 1, label: 'Sem 1' }, { value: 2, label: 'Sem 2' }];
                                        if (cls.year === 'SE') semOptions = [{ value: 3, label: 'Sem 3' }, { value: 4, label: 'Sem 4' }];
                                        if (cls.year === 'TE') semOptions = [{ value: 5, label: 'Sem 5' }, { value: 6, label: 'Sem 6' }];
                                        if (cls.year === 'BE') semOptions = [{ value: 7, label: 'Sem 7' }, { value: 8, label: 'Sem 8' }];

                                        return (
                                            <div key={index} className="subject-card" style={{ zIndex: 10 - index }}>

                                                {/* 🔴 NEW BEAUTIFUL DELETE BUTTON */}
                                                <button type="button" className="delete-subject-btn" onClick={() => {
                                                    const updated = teacherForm.assignedClasses.filter((_, i) => i !== index);
                                                    setTeacherForm({ ...teacherForm, assignedClasses: updated });
                                                }}>
                                                    <i className="fas fa-trash"></i>
                                                </button>

                                                <div style={{ flex: '1 1 120px' }}>
                                                    <CustomMobileSelect label="Class" value={cls.year} onChange={(val) => {
                                                        const updated = [...teacherForm.assignedClasses];
                                                        updated[index] = { ...updated[index], year: val, semester: val === 'FE' ? 1 : 3 };
                                                        setTeacherForm({ ...teacherForm, assignedClasses: updated });
                                                    }} options={yearOptions} />
                                                </div>

                                                <div style={{ flex: '1 1 100px' }}>
                                                    <CustomMobileSelect label="Semester" value={cls.semester} onChange={(val) => {
                                                        const updated = [...teacherForm.assignedClasses];
                                                        updated[index] = { ...updated[index], semester: Number(val) };
                                                        setTeacherForm({ ...teacherForm, assignedClasses: updated });
                                                    }} options={semOptions} />
                                                </div>

                                                {isFE && (
                                                    <div style={{ flex: '0 1 80px' }}>
                                                        <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block' }}>DIV</label>
                                                        <input type="text" placeholder="A" value={cls.divisions || ''} onChange={(e) => {
                                                            const updated = [...teacherForm.assignedClasses];
                                                            updated[index] = { ...updated[index], divisions: e.target.value };
                                                            setTeacherForm({ ...teacherForm, assignedClasses: updated });
                                                        }} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold' }} />
                                                    </div>
                                                )}

                                                <div style={{ flex: '2 1 180px' }}>
                                                    <label style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block' }}>SUBJECT NAME</label>
                                                    <input type="text" placeholder="e.g. Object Oriented Prog." value={cls.subject} onChange={(e) => {
                                                        const updated = [...teacherForm.assignedClasses];
                                                        updated[index] = { ...updated[index], subject: e.target.value };
                                                        setTeacherForm({ ...teacherForm, assignedClasses: updated });
                                                    }} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: '600' }} required />
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <button type="button" className="add-subject-btn" onClick={() => {
                                        const isFE = hodInfo?.department === 'FE' || hodInfo?.department === 'First Year';
                                        setTeacherForm({
                                            ...teacherForm,
                                            assignedClasses: [...teacherForm.assignedClasses, { year: isFE ? 'FE' : 'SE', semester: isFE ? 1 : 3, divisions: '', subject: '' }]
                                        });
                                    }}>
                                        <i className="fas fa-plus"></i> Add Another Subject
                                    </button>
                                </div>

                                {/* Credentials */}
                                <div className="teacher-form-grid">
                                    <div className="input-group">
                                        <label>Email Address</label>
                                        <input type="email" required value={teacherForm.email} onChange={e => setTeacherForm({ ...teacherForm, email: e.target.value })} placeholder="teacher@institute.com" />
                                    </div>
                                    <div className="input-group">
                                        <label>Password</label>
                                        <input type="password" required value={teacherForm.password} onChange={e => setTeacherForm({ ...teacherForm, password: e.target.value })} placeholder="******" />
                                    </div>
                                </div>

                                <button className="submit-teacher-btn" disabled={loading}>
                                    {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                                    {loading ? ' Creating & Sending Email...' : ' Create Account & Send Email'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>

            {/* Mobile Footer Bar */}
            <MobileFooter />
            {/* ✅ EDIT TEACHER MODAL (With Email Edit) */}
            {isEditTeacherModalOpen && editTeacherData && ReactDOM.createPortal(
                <div className="hod-modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 99999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="card" style={{
                        width: '95%', maxWidth: '600px', maxHeight: '90vh',
                        overflowY: 'auto', padding: '0',
                        position: 'relative', background: 'white',
                        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex', flexDirection: 'column'
                    }}>

                        {/* Header */}
                        <div style={{ padding: '25px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 10 }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '20px', fontWeight: '800' }}>Edit Teacher</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Update credentials & assignments</p>
                            </div>
                            <button
                                onClick={() => setIsEditTeacherModalOpen(false)}
                                style={{
                                    background: '#e2e8f0', border: 'none', width: '36px', height: '36px', borderRadius: '50%',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: '18px'
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div style={{ padding: '25px', overflowY: 'auto' }}>

                            {/* Personal Info */}
                            <div className="teacher-form-grid" style={{ marginBottom: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="input-group">
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>FIRST NAME</label>
                                    <input
                                        type="text"
                                        value={editTeacherData.firstName}
                                        onChange={(e) => setEditTeacherData({ ...editTeacherData, firstName: e.target.value })}
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: '600', color: '#1e293b' }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>LAST NAME</label>
                                    <input
                                        type="text"
                                        value={editTeacherData.lastName}
                                        onChange={(e) => setEditTeacherData({ ...editTeacherData, lastName: e.target.value })}
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: '600', color: '#1e293b' }}
                                    />
                                </div>
                            </div>

                            {/* Email & Phone */}
                            <div className="teacher-form-grid" style={{ marginBottom: '25px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                <div className="input-group">
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>LOGIN EMAIL</label>
                                    <input
                                        type="email"
                                        value={editTeacherData.email}
                                        onChange={(e) => setEditTeacherData({ ...editTeacherData, email: e.target.value })}
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: '600', color: '#1e293b' }}
                                    />
                                </div>
                                <div className="input-group">
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>PHONE</label>
                                    <input
                                        type="text"
                                        value={editTeacherData.phone || ''}
                                        onChange={(e) => setEditTeacherData({ ...editTeacherData, phone: e.target.value })}
                                        placeholder="+91..."
                                        style={{ width: '100%', padding: '12px', borderRadius: '12px', border: '2px solid #e2e8f0', fontWeight: '600', color: '#1e293b' }}
                                    />
                                </div>
                            </div>

                            <p style={{ fontSize: '11px', color: '#10b981', background: '#ecfdf5', padding: '10px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', marginTop: '-15px', marginBottom: '25px' }}>
                                <i className="fas fa-info-circle"></i>
                                Changing the email here will immediately update their login credentials.
                            </p>

                            {/* 🎓 ASSIGNMENTS EDITOR (Standard UI) */}
                            <div className="class-assignment-container">
                                <label style={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginBottom: '15px', display: 'block', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    <i className="fas fa-edit" style={{ marginRight: '8px', color: '#3b82f6' }}></i>
                                    Modify Assignments
                                </label>

                                {editTeacherData.assignedClasses.map((cls, index) => {
                                    const isFE = hodInfo?.department === 'FE' || hodInfo?.department === 'First Year';
                                    const yearOptions = isFE ? [{ value: 'FE', label: 'First Year' }] : [{ value: 'SE', label: 'SE' }, { value: 'TE', label: 'TE' }, { value: 'BE', label: 'BE' }];

                                    let semOptions = [];
                                    if (cls.year === 'FE') semOptions = [{ value: 1, label: 'Sem 1' }, { value: 2, label: 'Sem 2' }];
                                    if (cls.year === 'SE') semOptions = [{ value: 3, label: 'Sem 3' }, { value: 4, label: 'Sem 4' }];
                                    if (cls.year === 'TE') semOptions = [{ value: 5, label: 'Sem 5' }, { value: 6, label: 'Sem 6' }];
                                    if (cls.year === 'BE') semOptions = [{ value: 7, label: 'Sem 7' }, { value: 8, label: 'Sem 8' }];

                                    return (
                                        <div key={index} className="subject-card" style={{ zIndex: 50 - index }}>
                                            <button type="button" className="delete-subject-btn" onClick={() => {
                                                const updated = editTeacherData.assignedClasses.filter((_, i) => i !== index);
                                                setEditTeacherData({ ...editTeacherData, assignedClasses: updated });
                                            }}>
                                                <i className="fas fa-trash"></i>
                                            </button>

                                            <div style={{ flex: '1 1 100px' }}>
                                                <CustomMobileSelect label="Class" value={cls.year} onChange={(val) => {
                                                    const updated = [...editTeacherData.assignedClasses];
                                                    updated[index] = { ...updated[index], year: val, semester: val === 'FE' ? 1 : 3 };
                                                    setEditTeacherData({ ...editTeacherData, assignedClasses: updated });
                                                }} options={yearOptions} />
                                            </div>

                                            <div style={{ flex: '1 1 80px' }}>
                                                <CustomMobileSelect label="Sem" value={cls.semester} onChange={(val) => {
                                                    const updated = [...editTeacherData.assignedClasses];
                                                    updated[index] = { ...updated[index], semester: Number(val) };
                                                    setEditTeacherData({ ...editTeacherData, assignedClasses: updated });
                                                }} options={semOptions} />
                                            </div>

                                            {isFE && (
                                                <div style={{ flex: '0 1 70px' }}>
                                                    <label style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block' }}>DIV</label>
                                                    <input type="text" value={cls.divisions || ''} onChange={(e) => {
                                                        const updated = [...editTeacherData.assignedClasses];
                                                        updated[index] = { ...updated[index], divisions: e.target.value };
                                                        setEditTeacherData({ ...editTeacherData, assignedClasses: updated });
                                                    }} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', textAlign: 'center', fontWeight: 'bold' }} />
                                                </div>
                                            )}

                                            <div style={{ flex: '2 1 150px' }}>
                                                <label style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', marginBottom: '8px', display: 'block' }}>SUBJECT</label>
                                                <input type="text" value={cls.subject} onChange={(e) => {
                                                    const updated = [...editTeacherData.assignedClasses];
                                                    updated[index] = { ...updated[index], subject: e.target.value };
                                                    setEditTeacherData({ ...editTeacherData, assignedClasses: updated });
                                                }} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #e2e8f0', fontWeight: '600' }} />
                                            </div>
                                        </div>
                                    );
                                })}

                                <button type="button" className="add-subject-btn" onClick={() => {
                                    const isFE = hodInfo?.department === 'FE' || hodInfo?.department === 'First Year';
                                    setEditTeacherData({
                                        ...editTeacherData,
                                        assignedClasses: [...editTeacherData.assignedClasses, { year: isFE ? 'FE' : 'SE', semester: isFE ? 1 : 3, divisions: '', subject: '' }]
                                    });
                                }}>
                                    <i className="fas fa-plus"></i> Add New Assignment
                                </button>
                            </div>
                        </div>

                        {/* Footer Buttons */}
                        <div style={{
                            padding: '20px 25px', borderTop: '1px solid #e2e8f0', background: 'white',
                            display: 'flex', gap: '15px', position: 'sticky', bottom: 0, zIndex: 10, borderRadius: '0 0 24px 24px'
                        }}>
                            <button
                                onClick={() => setIsEditTeacherModalOpen(false)}
                                style={{
                                    flex: 1, padding: '14px', borderRadius: '12px', border: 'none',
                                    background: '#f1f5f9', color: '#475569', fontWeight: '700', fontSize: '15px', cursor: 'pointer', transition: 'background 0.2s'
                                }}
                                onMouseOver={e => e.currentTarget.style.background = '#e2e8f0'}
                                onMouseOut={e => e.currentTarget.style.background = '#f1f5f9'}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveTeacherUpdates}
                                disabled={loading}
                                style={{
                                    flex: 2, padding: '14px', borderRadius: '12px', border: 'none',
                                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    color: 'white', fontWeight: '700', fontSize: '15px', cursor: 'pointer',
                                    boxShadow: '0 4px 12px rgba(37, 99, 235, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                                {loading ? 'Saving...' : 'Save Updates'}
                            </button>
                        </div>

                    </div>
                </div>,
                document.body
            )}

            {/* ✅ EDIT STUDENT MODAL */}
            {isEditStudentModalOpen && editStudentData && ReactDOM.createPortal(
                <div className="hod-modal-overlay" style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(15, 23, 42, 0.75)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 99999,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    <div className="card" style={{
                        width: '95%', maxWidth: '500px', maxHeight: '90vh',
                        overflowY: 'auto', padding: '0',
                        position: 'relative', background: 'white',
                        borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                        display: 'flex', flexDirection: 'column'
                    }}>

                        {/* Header */}
                        <div style={{ padding: '25px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                                <h3 style={{ margin: 0, color: '#1e293b', fontSize: '18px', fontWeight: '800' }}>Edit Student</h3>
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#64748b' }}>Correct details for {editStudentData.firstName}</p>
                            </div>
                            <button
                                onClick={() => setIsEditStudentModalOpen(false)}
                                style={{ background: '#e2e8f0', border: 'none', width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#64748b', fontSize: '16px' }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Form Fields */}
                        <div style={{ padding: '25px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>FIRST NAME</label>
                                    <input
                                        type="text"
                                        value={editStudentData.firstName}
                                        onChange={e => setEditStudentData({ ...editStudentData, firstName: e.target.value })}
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: '600' }}
                                    />
                                </div>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>LAST NAME</label>
                                    <input
                                        type="text"
                                        value={editStudentData.lastName}
                                        onChange={e => setEditStudentData({ ...editStudentData, lastName: e.target.value })}
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: '600' }}
                                    />
                                </div>
                            </div>

                            <div className="input-group">
                                <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>EMAIL ADDRESS</label>
                                <input
                                    type="email"
                                    value={editStudentData.email}
                                    onChange={e => setEditStudentData({ ...editStudentData, email: e.target.value })}
                                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: '600' }}
                                />
                                <p style={{ fontSize: '11px', color: '#10b981', marginTop: '5px' }}>
                                    <i className="fas fa-check-circle"></i> This will update their login email immediately.
                                </p>
                            </div>

                            <div style={{ display: 'flex', gap: '15px' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>ROLL NO</label>
                                    <input
                                        type="text"
                                        value={editStudentData.rollNo}
                                        onChange={e => setEditStudentData({ ...editStudentData, rollNo: e.target.value })}
                                        style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: '600' }}
                                    />
                                </div>

                                {/* Only Show Division for FE */}
                                {(hodInfo?.department === 'FE' || hodInfo?.department === 'First Year') && (
                                    <div className="input-group" style={{ flex: 1 }}>
                                        <label style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', marginBottom: '8px', display: 'block' }}>DIVISION</label>
                                        <input
                                            type="text"
                                            value={editStudentData.division || ''}
                                            onChange={e => setEditStudentData({ ...editStudentData, division: e.target.value })}
                                            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontWeight: '600' }}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div style={{ padding: '20px 25px', borderTop: '1px solid #e2e8f0', background: 'white', display: 'flex', gap: '15px', borderRadius: '0 0 24px 24px' }}>
                            <button
                                onClick={() => setIsEditStudentModalOpen(false)}
                                style={{ flex: 1, padding: '14px', borderRadius: '12px', border: 'none', background: '#f1f5f9', color: '#475569', fontWeight: '700', cursor: 'pointer' }}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveStudentUpdates}
                                disabled={loading}
                                style={{
                                    flex: 2, padding: '14px', borderRadius: '12px', border: 'none',
                                    background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                                    color: 'white', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                                }}
                            >
                                {loading ? 'Saving...' : 'Save Updates'}
                            </button>
                        </div>

                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}