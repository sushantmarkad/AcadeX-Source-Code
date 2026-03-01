import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import toast from 'react-hot-toast';
import './AssignmentMarksManager.css';

const AssignmentMarksManager = ({ teacherInfo, selectedYear, selectedDiv, selectedSubject }) => {
  const [view, setView] = useState('list');
  const [assignments, setAssignments] = useState([]);
  const [currentAssignment, setCurrentAssignment] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditingTest, setIsEditingTest] = useState(false);

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [assignmentToDelete, setAssignmentToDelete] = useState(null);

  const [editForm, setEditForm] = useState({ maxMarks: 0, passingMarks: 0 });
  const [testForm, setTestForm] = useState({ name: '', maxMarks: 20, passingMarks: 8, date: new Date().toISOString().split('T')[0] });

  const getClassDetails = () => {
    if (!teacherInfo?.assignedClasses) return { semester: 'N/A', subject: selectedSubject || teacherInfo?.subject || 'Subject' };
    const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
    return {
      semester: cls ? `Semester ${cls.semester}` : 'Semester --',
      subject: selectedSubject || (cls ? cls.subject : teacherInfo.subject)
    };
  };

  useEffect(() => {
    if (!teacherInfo?.instituteId) return;
    const q = query(
      collection(db, 'assignment_marks'),
      where('teacherId', '==', auth.currentUser.uid),
      where('year', '==', selectedYear),
      where('department', '==', teacherInfo.department)
    );
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const filtered = selectedYear === 'FE' && selectedDiv && selectedDiv !== 'All'
        ? data.filter(d => d.division === selectedDiv)
        : data;
      filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
      setAssignments(filtered);
    });
    return () => unsub();
  }, [teacherInfo, selectedYear, selectedDiv]);

  const fetchStudentsForGrading = async (testData) => {
    setLoading(true);
    try {
      const qStudents = query(
        collection(db, 'users'),
        where('instituteId', '==', teacherInfo.instituteId),
        where('role', '==', 'student'),
        where('year', '==', selectedYear),
        where('department', '==', teacherInfo.department)
      );
      const snap = await getDocs(qStudents);
      let studentList = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        rollNo: parseInt(doc.data().rollNo) || 9999,
        obtainedMarks: '',
        status: '-'
      }));

      if (selectedYear === 'FE' && selectedDiv && selectedDiv !== 'All') {
        studentList = studentList.filter(s => s.division === selectedDiv);
      }
      studentList.sort((a, b) => a.rollNo - b.rollNo);

      if (testData && testData.scores) {
        studentList = studentList.map(s => {
          const savedScore = testData.scores[s.id];
          return savedScore ? { ...s, obtainedMarks: savedScore.marks, status: savedScore.status } : s;
        });
      }
      setStudents(studentList);
    } catch (err) { toast.error("Failed to load student list"); }
    finally { setLoading(false); }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { subject } = getClassDetails();
      const newAssignment = {
        testName: testForm.name,
        maxMarks: Number(testForm.maxMarks),
        passingMarks: Number(testForm.passingMarks),
        date: testForm.date,
        teacherId: auth.currentUser.uid,
        teacherName: `${teacherInfo.firstName} ${teacherInfo.lastName}`,
        subject: subject,
        department: teacherInfo.department,
        year: selectedYear,
        division: selectedYear === 'FE' ? selectedDiv : null,
        instituteId: teacherInfo.instituteId,
        createdAt: serverTimestamp(),
        scores: {}
      };
      const docRef = await addDoc(collection(db, 'assignment_marks'), newAssignment);
      setCurrentAssignment({ id: docRef.id, ...newAssignment });
      await fetchStudentsForGrading({ scores: {} });
      setView('grading');
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const promptDelete = (e, assign) => {
    e.stopPropagation();
    setAssignmentToDelete(assign);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!assignmentToDelete) return;
    try {
      await deleteDoc(doc(db, 'assignment_marks', assignmentToDelete.id));
      toast.success("Assignment deleted");
      setDeleteModalOpen(false);
      setAssignmentToDelete(null);
    } catch (err) { toast.error("Error deleting: " + err.message); }
  };

  const handleUpdateDetails = async () => {
    if (!currentAssignment) return;
    try {
      await updateDoc(doc(db, 'assignment_marks', currentAssignment.id), {
        maxMarks: Number(editForm.maxMarks),
        passingMarks: Number(editForm.passingMarks)
      });
      setCurrentAssignment(prev => ({ ...prev, maxMarks: Number(editForm.maxMarks), passingMarks: Number(editForm.passingMarks) }));
      setIsEditingTest(false);
      toast.success("Criteria updated");
    } catch (err) { toast.error("Update failed"); }
  };

  const handleMarkChange = (studentId, value) => {
    const val = value === '' ? '' : Number(value);
    if (val > currentAssignment.maxMarks) return toast.error(`Max marks is ${currentAssignment.maxMarks}`);
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        const status = val === '' ? '-' : (val >= currentAssignment.passingMarks ? 'Pass' : 'Fail');
        return { ...s, obtainedMarks: val, status };
      }
      return s;
    }));
  };

  const saveMarks = async () => {
    setLoading(true);
    const toastId = toast.loading("Saving...");
    try {
      const scoresMap = {};
      students.forEach(s => {
        if (s.obtainedMarks !== '') {
          scoresMap[s.id] = { rollNo: s.rollNo, name: `${s.firstName} ${s.lastName}`, marks: Number(s.obtainedMarks), status: s.status };
        }
      });
      await updateDoc(doc(db, 'assignment_marks', currentAssignment.id), { scores: scoresMap, updatedAt: serverTimestamp() });
      toast.success("Saved!", { id: toastId });
      setView('list');
    } catch (err) { toast.error("Failed", { id: toastId }); } finally { setLoading(false); }
  };

  return (
    <div className="content-section">
      <div className="trackee-assign-header-flex">
        <div>
          <h2 className="gradient-text">Assignment Marks</h2>
          <p className="content-subtitle">Manage assignment grading for your class.</p>
        </div>
        {view === 'list' && (
          <button onClick={() => { setTestForm({ name: '', maxMarks: 10, passingMarks: 4, date: new Date().toISOString().split('T')[0] }); setView('create'); }} className="trackee-assign-btn-new">
            <i className="fas fa-plus"></i> New Assignment
          </button>
        )}
      </div>

      {view === 'list' && (
        <div className="trackee-assign-grid">
          {assignments.length > 0 ? assignments.map(assign => (
            <div key={assign.id} className="trackee-assign-card" onClick={() => { setCurrentAssignment(assign); fetchStudentsForGrading(assign); setView('grading'); }}>
              <div className="trackee-assign-card-top">
                <span className="trackee-assign-tag">{assign.subject}</span>
                <button className="trackee-assign-btn-delete" onClick={(e) => promptDelete(e, assign)}><i className="fas fa-trash-alt"></i></button>
              </div>
              <h4 className="trackee-assign-card-title">{assign.testName}</h4>
              <div className="trackee-assign-card-info">
                <span><i className="far fa-calendar"></i> {assign.date}</span>
                <span><i className="fas fa-star"></i> {assign.maxMarks} M</span>
              </div>
            </div>
          )) : (
            <div className="trackee-assign-empty"><i className="fas fa-clipboard-list"></i><p>No assignments found.</p></div>
          )}
        </div>
      )}

      {deleteModalOpen && assignmentToDelete && createPortal(
        <div className="trackee-assign-modal-overlay">
          <div className="trackee-assign-modal-box fade-in">
            <div className="trackee-assign-modal-icon"><i className="fas fa-exclamation-triangle"></i></div>
            <h3>Delete Assignment?</h3>
            <p>Are you sure you want to delete <b>{assignmentToDelete.testName}</b>?</p>
            <div className="trackee-assign-modal-actions">
              <button className="trackee-assign-btn-ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
              <button className="trackee-assign-btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {view === 'create' && (
        <div className="trackee-assign-form-box fade-in">
          <h3>Create Assignment</h3>
          <form onSubmit={handleCreateAssignment} className="trackee-assign-form">
            <div className="trackee-assign-input-group full"><label>Assignment Name</label><input required value={testForm.name} onChange={e => setTestForm({ ...testForm, name: e.target.value })} placeholder="e.g. Assignment 1" /></div>
            <div className="trackee-assign-row">
              <div className="trackee-assign-input-group"><label>Date</label><input type="date" required value={testForm.date} onChange={e => setTestForm({ ...testForm, date: e.target.value })} /></div>
              <div className="trackee-assign-input-group"><label>Max Marks</label><input type="number" required value={testForm.maxMarks} onChange={e => setTestForm({ ...testForm, maxMarks: e.target.value })} /></div>
              <div className="trackee-assign-input-group"><label>Passing</label><input type="number" required value={testForm.passingMarks} onChange={e => setTestForm({ ...testForm, passingMarks: e.target.value })} /></div>
            </div>
            <div className="trackee-assign-actions">
              <button type="button" onClick={() => setView('list')} className="trackee-assign-btn-ghost">Cancel</button>
              <button type="submit" className="trackee-assign-btn-new">Create Assignment</button>
            </div>
          </form>
        </div>
      )}

      {view === 'grading' && currentAssignment && (
        <div className="trackee-assign-grading-box fade-in">
          <div className="trackee-assign-grading-header">
            <div className="trackee-assign-gh-left">
              <button onClick={() => setView('list')} className="trackee-assign-btn-back"><i className="fas fa-arrow-left"></i></button>
              <div className="trackee-assign-gh-titles">
                <h3>{currentAssignment.testName}</h3>
                <div className="trackee-assign-gh-meta">
                  <span>Max: {currentAssignment.maxMarks}</span><span>•</span><span>Pass: {currentAssignment.passingMarks}</span>
                  <button className="trackee-assign-btn-edit-pill" onClick={() => { setEditForm({ maxMarks: currentAssignment.maxMarks, passingMarks: currentAssignment.passingMarks }); setIsEditingTest(true); }}><i className="fas fa-pencil-alt"></i> Edit</button>
                </div>
              </div>
            </div>
            <div className="trackee-assign-gh-right">
              <button onClick={saveMarks} className="trackee-assign-btn-save"><i className="fas fa-save"></i> Save Marks</button>
            </div>
          </div>

          {isEditingTest && (
            <div className="trackee-assign-edit-overlay">
              <div className="trackee-assign-edit-inputs">
                <div><label>New Max</label><input type="number" value={editForm.maxMarks} onChange={e => setEditForm({ ...editForm, maxMarks: e.target.value })} /></div>
                <div><label>New Pass</label><input type="number" value={editForm.passingMarks} onChange={e => setEditForm({ ...editForm, passingMarks: e.target.value })} /></div>
              </div>
              <div className="trackee-assign-edit-btns">
                <button onClick={handleUpdateDetails} className="trackee-assign-btn-check"><i className="fas fa-check"></i></button>
                <button onClick={() => setIsEditingTest(false)} className="trackee-assign-btn-close"><i className="fas fa-times"></i></button>
              </div>
            </div>
          )}

          <div className="trackee-assign-table-wrap">
            <table className="trackee-assign-table">
              <thead><tr><th style={{ width: '60px' }}>Roll</th><th>Name</th><th style={{ width: '90px', textAlign: 'center' }}>Marks</th><th style={{ width: '80px', textAlign: 'center' }}>Status</th></tr></thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td className="trackee-assign-roll">{s.rollNo}</td><td className="trackee-assign-name">{s.firstName} {s.lastName}</td>
                    <td style={{ textAlign: 'center' }}><input type="number" className="trackee-assign-input-mark" value={s.obtainedMarks} onChange={(e) => handleMarkChange(s.id, e.target.value)} placeholder="-" /></td>
                    <td style={{ textAlign: 'center' }}><span className={`trackee-assign-status ${s.status.toLowerCase()}`}>{s.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
export default AssignmentMarksManager;