import React, { useState, useEffect } from 'react';
import { signOut, updatePassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { auth, db, storage, sendPasswordResetEmail } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, getDoc, collection, query, where, onSnapshot, deleteDoc, addDoc, updateDoc, serverTimestamp, setDoc } from "firebase/firestore";
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
    const [annoTab, setAnnoTab] = useState('create');

    const [selectedRequestIds, setSelectedRequestIds] = useState([]);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    // ✅ NEW STATES
    const [annoFile, setAnnoFile] = useState(null); // For Announcement File
    const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' }); // For Password Update

    // Timetable States
    const [timetableYear, setTimetableYear] = useState('FE');
    const [timetableData, setTimetableData] = useState({});
    const [isSavingTimetable, setIsSavingTimetable] = useState(false);
    const [activeSemesters, setActiveSemesters] = useState({ FE: 1, SE: 3, TE: 5, BE: 7 });

    // Attendance Graph State
    const [attendanceGraph, setAttendanceGraph] = useState([]);
    const [timeRange, setTimeRange] = useState('week');

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



    // ✅ Profile Editing State
    const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', qualification: '', phone: '' });
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [analyticsYear, setAnalyticsYear] = useState('FE');
    const [criteria, setCriteria] = useState({ FE: 75, SE: 75, TE: 75, BE: 75 });

    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const [analyticsDivision, setAnalyticsDivision] = useState('All');
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

                // ✅ UPDATED: Fetch Stats & Active Semester
                const statsRef = doc(db, "department_stats", `${data.instituteId}_${data.department}`);
                const statsDoc = await getDoc(statsRef);

                if (statsDoc.exists()) {
                    setTotalClasses(statsDoc.data().totalClasses || 0);
                    // ✅ LOAD OBJECT INSTEAD OF SINGLE INTEGER
                    setActiveSemesters(statsDoc.data().activeSemesters || { FE: 1, SE: 3, TE: 5, BE: 7 });
                } else {
                    const defaultSems = { FE: 1, SE: 3, TE: 5, BE: 7 };
                    await setDoc(statsRef, { activeSemesters: defaultSems, totalClasses: 0 }, { merge: true });
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



    // --- 1. FUNCTIONAL ATTENDANCE GRAPH (UPDATED) ---
    useEffect(() => {
        if (!hodInfo || deptUsers.length === 0) return;
        const fetchAttendanceStats = async () => {
            const now = new Date();
            const startDate = new Date();
            if (timeRange === 'week') startDate.setDate(now.getDate() - 7);
            else startDate.setDate(now.getDate() - 30);

            try {
                const q = query(
                    collection(db, 'attendance'),
                    where('instituteId', '==', hodInfo.instituteId),
                    where('department', '==', hodInfo.department),
                    where('timestamp', '>=', Timestamp.fromDate(startDate))
                );

                onSnapshot(q, (snap) => {
                    // Create Map: StudentID -> Division (for FE) OR Year (for Others)
                    const studentMap = {};
                    deptUsers.forEach(u => {
                        if (u.role === 'student') {
                            // If FE, map to Division (default 'A'), else map to Year
                            studentMap[u.id] = isFE ? (u.division || 'A') : u.year;
                        }
                    });

                    const groupCounts = {}; // { 'A': 10, 'B': 5 } or { 'SE': 20, 'TE': 15 }
                    const groupSessions = {};

                    snap.docs.forEach(doc => {
                        const data = doc.data();
                        const key = studentMap[data.studentId]; // Key is Division or Year

                        if (key) {
                            if (!groupCounts[key]) { groupCounts[key] = 0; groupSessions[key] = new Set(); }
                            groupCounts[key]++;
                            groupSessions[key].add(data.sessionId);
                        }
                    });

                    // Generate Data based on HOD Type
                    const LABELS = isFE ? DIVISIONS : ['SE', 'TE', 'BE']; // Hide FE for Dept HODs

                    const graphData = LABELS.map(label => {
                        // Count students in this Group (Division or Year)
                        const totalStudents = deptUsers.filter(u =>
                            u.role === 'student' && (isFE ? u.division === label : u.year === label)
                        ).length || 1;

                        const totalSessions = groupSessions[label]?.size || 1;
                        const totalPresent = groupCounts[label] || 0;
                        const avgPct = Math.round((totalPresent / (totalSessions * totalStudents)) * 100) || 0;

                        return { name: label, attendance: avgPct };
                    });

                    setAttendanceGraph(graphData);
                });
            } catch (err) { console.error(err); }
        };
        fetchAttendanceStats();
    }, [hodInfo, deptUsers, timeRange, isFE]); // Added isFE dependency

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

    // --- ✅ UPDATED: ANALYTICS PROCESSING (Dynamic Criteria) ---
    // --- ✅ UPDATED: ANALYTICS PROCESSING ---
    const getYearAnalytics = () => {
        let targetStudents = studentsList;

        // 1. Filter Students based on Role (FE HOD vs Dept HOD)
        if (isFE) {
            // FE HOD: Only see FE students
            targetStudents = studentsList.filter(s => s.year === 'FE');

            // Apply Division Filter if selected
            if (analyticsDivision !== 'All') {
                targetStudents = targetStudents.filter(s => s.division === analyticsDivision);
            }
        } else {
            // Dept HOD: Filter by selected Year (SE, TE, BE)
            targetStudents = studentsList.filter(s => s.year === analyticsYear);
        }

        // Get Threshold
        const threshold = criteria[analyticsYear] || 75;

        // 2. Calculate Percentage
        const processed = targetStudents.map(s => {
            const attended = s.attendanceCount || 0;
            const percentage = totalClasses > 0 ? (attended / totalClasses) * 100 : (attended > 0 ? 100 : 0);
            return { ...s, percentage };
        });

        // 3. Categorize
        const safe = processed.filter(s => s.percentage >= threshold);
        const defaulters = processed.filter(s => s.percentage < threshold);

        // 4. Search Filter
        const filteredDefaulters = defaulters.filter(s =>
            (s.firstName && s.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
            (s.rollNo && s.rollNo.toLowerCase().includes(searchQuery.toLowerCase()))
        );

        return { total: processed.length, safe, defaulters, filteredDefaulters, threshold };
    };

    const analyticsData = getYearAnalytics();

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

    // --- ✅ ADD TEACHER (With Toasts & Backend Creation) ---
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
                    phone: teacherForm.phone, // ✅ ADDED: Send Phone Number to Backend
                    role: 'teacher',
                    instituteId: hodInfo.instituteId,
                    instituteName: hodInfo.instituteName || 'AcadeX Institute',
                    department: hodInfo.department,

                    // ✅ FIXED: Send in Root
                    academicYear: teacherForm.academicYear,
                    assignedClasses: teacherForm.assignedClasses,

                    // ✅ FIXED: Also send in extras (Safety Net)
                    extras: {
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

            // ✅ Reset Form (Included phone reset)
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
                <div className="logo-container"><img src={logo} alt="Logo" className="sidebar-logo" /><span className="logo-text">Acadex</span></div>
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
                    <div className="mobile-brand"><img src={logo} alt="Logo" className="mobile-logo-img" /><span className="mobile-logo-text">AcadeX</span></div>
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

                                {/* ✅ FE HOD: Show Division Dropdown | Dept HOD: Show Year Tabs */}
                                {isFE ? (
                                    <select
                                        value={analyticsDivision}
                                        onChange={(e) => setAnalyticsDivision(e.target.value)}
                                        className="modern-select"
                                        style={{
                                            padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1',
                                            cursor: 'pointer', background: 'white', fontWeight: '600', color: '#334155', outline: 'none'
                                        }}
                                    >
                                        <option value="All">All Divisions</option>
                                        {DIVISIONS.map(div => <option key={div} value={div}>Division {div}</option>)}
                                    </select>
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

                        {/* ✅ Chart & Defaulters List Grid */}
                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '25px', alignItems: 'start' }}>

                            {/* Card 1: Pie Chart with Center Count */}
                            <div className="card" style={{ minHeight: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '25px', position: 'relative' }}>
                                <h3 style={{ alignSelf: 'flex-start', marginBottom: '15px', fontSize: '16px', color: '#334155', fontWeight: '700' }}>
                                    Status Distribution ({isFE ? (analyticsDivision === 'All' ? 'FE Total' : `Div ${analyticsDivision}`) : analyticsYear})
                                </h3>

                                <div style={{ width: '100%', height: '300px', position: 'relative' }}>

                                    {/* 🔥 CENTERED COUNT FOR MOBILE VISIBILITY */}
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
                                                innerRadius={85}  // Increased inner radius for text space
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

                            {/* Card 2: Defaulters List (Fixed Layout) */}
                            <div className="card" style={{ borderTop: '4px solid #ef4444', height: '420px', display: 'flex', flexDirection: 'column', padding: '0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 15px', borderBottom: '1px solid #f1f5f9' }}>
                                    <h3 style={{ color: '#ef4444', display: 'flex', alignItems: 'center', gap: '8px', margin: 0, fontSize: '16px', fontWeight: '700' }}>
                                        ⚠️ Critical List
                                    </h3>
                                    <span className="nav-badge" style={{ background: '#fee2e2', color: '#ef4444', fontSize: '12px', padding: '4px 10px' }}>
                                        {analyticsData.filteredDefaulters.length}
                                    </span>
                                </div>

                                {/* 🔥 FIXED: Removed minWidth constraint to prevent laptop scrollbar */}
                                <div className="table-wrapper custom-scroll" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', border: 'none', padding: '0' }}>
                                    {analyticsData.filteredDefaulters.length > 0 ? (
                                        <table className="attendance-table" style={{ width: '100%', minWidth: 'auto' }}>
                                            <thead style={{ position: 'sticky', top: 0, zIndex: 1 }}>
                                                <tr>
                                                    <th style={{ background: 'white', fontSize: '11px', color: '#64748b', paddingLeft: '20px' }}>Student</th>
                                                    <th style={{ background: 'white', fontSize: '11px', color: '#64748b', textAlign: 'center' }}>Att %</th>
                                                    <th style={{ background: 'white', fontSize: '11px', color: '#64748b', textAlign: 'right', paddingRight: '20px' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {analyticsData.filteredDefaulters.map(s => (
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
                        <h2 className="content-title">Leave Requests</h2>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th>Name</th><th>Reason & Proof</th><th>Dates</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {leaves.map(l => (
                                            <tr key={l.id}>
                                                <td><div style={{ fontWeight: '600' }}>{l.studentName}</div><div style={{ fontSize: '12px', color: '#64748b' }}>{l.rollNo}</div></td>
                                                <td>
                                                    <div>{l.reason}</div>
                                                    {l.documentUrl && (<a href={l.documentUrl} target="_blank" rel="noreferrer" style={{ display: 'inline-block', marginTop: '5px', fontSize: '11px', color: '#2563eb', fontWeight: '600', textDecoration: 'none' }}><i className="fas fa-external-link-alt"></i> View Document</a>)}
                                                </td>
                                                <td>{l.fromDate} <br /><span style={{ fontSize: '12px', color: '#94a3b8' }}>to</span><br /> {l.toDate}</td>
                                                <td><div style={{ display: 'flex', gap: '8px' }}><button onClick={() => handleLeaveAction(l.id, 'approved')} className="status-badge status-approved" style={{ border: 'none', cursor: 'pointer' }}>Approve</button><button onClick={() => handleLeaveAction(l.id, 'rejected')} className="status-badge status-denied" style={{ border: 'none', cursor: 'pointer' }}>Reject</button></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'requests' && (
                    <div className="content-section">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                            <h2 className="content-title">Student Applications</h2>
                            {selectedRequestIds.length > 0 && <button onClick={() => confirmAction('Approve Selected?', `Approve ${selectedRequestIds.length} students?`, executeBulkApprove)} className="btn-primary" style={{ width: 'auto', padding: '8px 16px' }}>{loading ? 'Processing...' : `Approve (${selectedRequestIds.length})`}</button>}
                        </div>
                        <div className="card card-full-width">
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead><tr><th style={{ width: '40px' }}><input type="checkbox" className="custom-checkbox" checked={studentRequests.length > 0 && selectedRequestIds.length === studentRequests.length} onChange={toggleSelectRequestAll} /></th><th>Name</th><th>Class</th><th>College ID</th><th>Roll No</th><th>Email</th><th>Action</th></tr></thead>
                                    <tbody>
                                        {studentRequests.map(req => (
                                            <tr key={req.id} className={selectedRequestIds.includes(req.id) ? 'row-selected' : ''}>
                                                <td><input type="checkbox" className="custom-checkbox" checked={selectedRequestIds.includes(req.id)} onChange={() => toggleSelectRequestOne(req.id)} /></td>
                                                <td>{req.firstName} {req.lastName}</td>
                                                <td><span className="status-badge-pill" style={{ background: '#e0f2fe', color: '#0284c7' }}>{req.year || '-'}</span></td>
                                                <td style={{ fontWeight: 'bold' }}>{req.collegeId}</td>
                                                <td>{req.rollNo}</td>
                                                <td>{req.email}</td>
                                                <td><div style={{ display: 'flex', gap: '8px' }}><button onClick={() => confirmAction('Approve?', `Approve ${req.firstName}?`, () => executeSingleApprove(req))} className="status-badge status-approved" style={{ border: 'none', cursor: 'pointer' }}>Approve</button><button onClick={() => confirmAction('Reject?', `Reject?`, () => executeReject(req.id), 'danger')} className="status-badge status-denied" style={{ border: 'none', cursor: 'pointer' }}>Reject</button></div></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
                {/* ✅ DEPT USERS - Year-wise Scrollable Cards */}
                {activeTab === 'manage' && (
                    <div className="content-section">
                        <h2 className="content-title">Department Users</h2>

                        {/* Teachers Table */}
                        <div className="card card-full-width" style={{ marginBottom: '24px' }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>Teachers ({teachersList.length})</h3>
                            <div className="table-wrapper">
                                <table className="attendance-table">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '40px' }}></th>
                                            <th>Name</th>
                                            <th>Email</th>
                                            <th>Assigned Classes</th> {/* Renamed Header */}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {teachersList.map(t => (
                                            <tr key={t.id}>
                                                <td>
                                                    <input type="checkbox" checked={selectedUserIds.includes(t.id)} onChange={() => toggleSelectUser(t.id)} className="custom-checkbox" />
                                                </td>
                                                <td>{t.firstName} {t.lastName}</td>
                                                <td>{t.email}</td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                                        {t.assignedClasses && t.assignedClasses.length > 0 ?
                                                            t.assignedClasses.map((cls, idx) => (
                                                                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    {/* Year Badge */}
                                                                    <span className="status-badge-pill" style={{ fontSize: '11px', padding: '2px 8px', background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>
                                                                        {cls.year}
                                                                    </span>

                                                                    {/* Division Badge (Only if exists) */}
                                                                    {cls.divisions && (
                                                                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' }}>
                                                                            Div {cls.divisions}
                                                                        </span>
                                                                    )}

                                                                    {/* Subject */}
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
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Students Section - Scrollable Cards */}
                        <h3 style={{ margin: '0 0 15px 0' }}>Students ({studentsList.length})</h3>
                        <div className="cards-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>

                            {/* ✅ LOGIC: Iterate Divisions for FE, Years for Others */}
                            {(isFE ? DIVISIONS : ['SE', 'TE', 'BE']).map(label => {

                                // Filter Students
                                const groupStudents = studentsList.filter(s =>
                                    isFE ? s.division === label : s.year === label
                                );

                                // Hide empty cards for Divisions to keep it clean (Optional, currently showing all)
                                // if (groupStudents.length === 0) return null; 

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
                                                    <thead><tr><th>Roll</th><th>Name</th></tr></thead>
                                                    <tbody>
                                                        {groupStudents.sort((a, b) => (a.rollNo || "").localeCompare(b.rollNo, undefined, { numeric: true })).map(s => (
                                                            <tr key={s.id}>
                                                                <td style={{ fontWeight: 'bold' }}>{s.rollNo}</td>
                                                                <td>
                                                                    {s.firstName} {s.lastName}
                                                                    {/* Show Division Badge only if NOT in FE View (since card is already Div) */}
                                                                    {!isFE && s.year === 'FE' && s.division && (
                                                                        <span style={{ marginLeft: '5px', fontSize: '10px', background: '#e0f2fe', color: '#0284c7', padding: '2px 4px', borderRadius: '4px' }}>
                                                                            {s.division}
                                                                        </span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: '20px' }}>No students found.</p>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {selectedUserIds.length > 0 && (
                            <button className="floating-delete-btn" onClick={handleDeleteUsers}>
                                <i className="fas fa-trash-alt"></i> Delete ({selectedUserIds.length})
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
                                            options={[{ value: '2024-2025', label: '2024-2025' }, { value: '2025-2026', label: '2025-2026' }]}
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
        </div>
    );
}