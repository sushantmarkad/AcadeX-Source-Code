import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // ✅ Covers the sidebar
import {
  collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';
import './MarksManager.css';
// import './MarksManager.css'; // UNCOMMENT THIS IF YOU PUT THE CSS IN A SEPARATE FILE

const MarksManager = ({ teacherInfo, selectedYear, selectedDiv, selectedSubject }) => {
  const [view, setView] = useState('list');
  const [tests, setTests] = useState([]);
  const [currentTest, setCurrentTest] = useState(null);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditingTest, setIsEditingTest] = useState(false);

  // --- DELETE MODAL STATE ---
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [testToDelete, setTestToDelete] = useState(null);

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

  // Fetch Tests
  useEffect(() => {
    if (!teacherInfo?.instituteId) return;
    const q = query(
      collection(db, 'exam_marks'),
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
      setTests(filtered);
    });
    return () => unsub();
  }, [teacherInfo, selectedYear, selectedDiv]);

  // Fetch Students
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

  // --- ACTIONS ---
  const handleCreateTest = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { subject } = getClassDetails();
      const newTest = {
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
      const docRef = await addDoc(collection(db, 'exam_marks'), newTest);
      setCurrentTest({ id: docRef.id, ...newTest });
      await fetchStudentsForGrading({ scores: {} });
      setView('grading');
    } catch (err) { toast.error(err.message); } finally { setLoading(false); }
  };

  const promptDelete = (e, test) => {
    e.stopPropagation();
    setTestToDelete(test);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!testToDelete) return;
    try {
      await deleteDoc(doc(db, 'exam_marks', testToDelete.id));
      toast.success("Test deleted successfully");
      setDeleteModalOpen(false);
      setTestToDelete(null);
    } catch (err) {
      console.error(err);
      toast.error("Error deleting test: " + err.message);
    }
  };

  const handleUpdateTestDetails = async () => {
    if (!currentTest) return;
    try {
      await updateDoc(doc(db, 'exam_marks', currentTest.id), {
        maxMarks: Number(editForm.maxMarks),
        passingMarks: Number(editForm.passingMarks)
      });
      setCurrentTest(prev => ({ ...prev, maxMarks: Number(editForm.maxMarks), passingMarks: Number(editForm.passingMarks) }));
      setIsEditingTest(false);
      toast.success("Criteria updated");
    } catch (err) { toast.error("Update failed"); }
  };

  const handleMarkChange = (studentId, value) => {
    const val = value === '' ? '' : Number(value);
    if (val > currentTest.maxMarks) return toast.error(`Max marks is ${currentTest.maxMarks}`);
    setStudents(prev => prev.map(s => {
      if (s.id === studentId) {
        const status = val === '' ? '-' : (val >= currentTest.passingMarks ? 'Pass' : 'Fail');
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
          scoresMap[s.id] = {
            rollNo: s.rollNo,
            name: `${s.firstName} ${s.lastName}`,
            marks: Number(s.obtainedMarks),
            status: s.status
          };
        }
      });
      await updateDoc(doc(db, 'exam_marks', currentTest.id), { scores: scoresMap, updatedAt: serverTimestamp() });
      toast.success("Saved!", { id: toastId });
      setView('list');
    } catch (err) { toast.error("Failed", { id: toastId }); } finally { setLoading(false); }
  };

  // --- PDF GENERATOR (With Teacher Signature) ---
  const generatePDF = () => {
    const doc = new jsPDF();
    const { semester, subject } = getClassDetails();
    const pageWidth = doc.internal.pageSize.width;

    // Compact Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, pageWidth, 30, 'F');

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text((teacherInfo.instituteName || "INSTITUTE NAME").toUpperCase(), pageWidth / 2, 10, { align: 'center' });

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Academic Year: ${teacherInfo.academicYear || '25-26'}   |   Test: ${currentTest.testName}   |   Subject: ${subject}`, pageWidth / 2, 16, { align: 'center' });
    doc.text(`Class: ${selectedYear} ${selectedDiv ? `(Div ${selectedDiv})` : ''}   |   Date: ${currentTest.date}   |   Max: ${currentTest.maxMarks} (Pass: ${currentTest.passingMarks})`, pageWidth / 2, 21, { align: 'center' });

    doc.setLineWidth(0.1);
    doc.line(10, 24, pageWidth - 10, 24);

    const tableColumn = ["Roll No", "Student Name", "Marks", "Status"];
    const tableRows = students.map(s => [
      s.rollNo,
      `${s.firstName} ${s.lastName}`.toUpperCase(),
      s.obtainedMarks !== '' ? s.obtainedMarks : '-',
      s.status.toUpperCase()
    ]);

    autoTable(doc, {
      startY: 28,
      head: [tableColumn],
      body: tableRows,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 1.5, valign: 'middle', textColor: [0, 0, 0], lineWidth: 0.1, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [245, 245, 245], textColor: 0, fontStyle: 'bold', halign: 'center', lineWidth: 0.1, lineColor: [100, 100, 100] },
      columnStyles: { 0: { cellWidth: 25, halign: 'center' }, 2: { cellWidth: 25, halign: 'center' }, 3: { cellWidth: 30, halign: 'center', fontStyle: 'bold' } },
      margin: { top: 10, bottom: 30, left: 14, right: 14 },
      didParseCell: function (data) {
        if (data.section === 'body' && data.column.index === 3) {
          if (data.cell.raw === 'FAIL') data.cell.styles.textColor = [200, 0, 0];
          if (data.cell.raw === 'PASS') data.cell.styles.textColor = [0, 128, 0];
        }
      }
    });

    // ✅ ADD TEACHER SIGNATURE
    const finalY = doc.lastAutoTable.finalY;
    let signY = finalY + 30;

    if (signY > doc.internal.pageSize.height - 20) {
      doc.addPage();
      signY = 40;
    }

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text(`Subject Teacher: ${currentTest.teacherName || ''}`, 14, signY);

    doc.save(`${currentTest.testName}_Report.pdf`);
  };

  return (
    <div className="content-section">
      <div className="trackee-marks-header-flex">
        <div>
          <h2 className="gradient-text">Marks & Results</h2>
          <p className="content-subtitle">Manage assessments and grading.</p>
        </div>
        {view === 'list' && (
          <button onClick={() => {
            setTestForm({ name: '', maxMarks: 20, passingMarks: 8, date: new Date().toISOString().split('T')[0] });
            setView('create');
          }} className="trackee-marks-btn-new">
            <i className="fas fa-plus"></i> New Test
          </button>
        )}
      </div>

      {/* --- LIST VIEW --- */}
      {view === 'list' && (
        <div className="trackee-marks-grid">
          {tests.length > 0 ? tests.map(test => (
            <div key={test.id} className="trackee-marks-card" onClick={() => { setCurrentTest(test); fetchStudentsForGrading(test); setView('grading'); }}>
              <div className="trackee-marks-card-top">
                <span className="trackee-marks-tag">{test.subject}</span>
                <button className="trackee-marks-btn-delete" onClick={(e) => promptDelete(e, test)}>
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
              <h4 className="trackee-marks-card-title">{test.testName}</h4>
              <div className="trackee-marks-card-info">
                <span><i className="far fa-calendar"></i> {test.date}</span>
                <span><i className="fas fa-star"></i> {test.maxMarks} M</span>
              </div>
            </div>
          )) : (
            <div className="trackee-marks-empty">
              <i className="fas fa-clipboard-list"></i>
              <p>No tests found.</p>
            </div>
          )}
        </div>
      )}

      {/* --- DELETE MODAL (COVERS SIDEBAR) --- */}
      {deleteModalOpen && testToDelete && createPortal(
        <div className="trackee-marks-modal-overlay">
          <div className="trackee-marks-modal-box fade-in">
            <div className="trackee-marks-modal-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Delete Assessment?</h3>
            <p>Are you sure you want to delete <b>{testToDelete.testName}</b>?</p>
            <div className="trackee-marks-modal-actions">
              <button className="trackee-marks-btn-ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
              <button className="trackee-marks-btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>,
        document.body 
      )}

      {/* --- CREATE VIEW --- */}
      {view === 'create' && (
        <div className="trackee-marks-form-box fade-in">
          <h3>Create Assessment</h3>
          <form onSubmit={handleCreateTest} className="trackee-marks-form">
            <div className="trackee-marks-input-group full">
              <label>Test Name</label>
              <input required value={testForm.name} onChange={e => setTestForm({ ...testForm, name: e.target.value })} placeholder="e.g. Unit Test 1" />
            </div>
            <div className="trackee-marks-row">
              <div className="trackee-marks-input-group">
                <label>Date</label>
                <input type="date" required value={testForm.date} onChange={e => setTestForm({ ...testForm, date: e.target.value })} />
              </div>
              <div className="trackee-marks-input-group">
                <label>Max Marks</label>
                <input type="number" required value={testForm.maxMarks} onChange={e => setTestForm({ ...testForm, maxMarks: e.target.value })} />
              </div>
              <div className="trackee-marks-input-group">
                <label>Passing</label>
                <input type="number" required value={testForm.passingMarks} onChange={e => setTestForm({ ...testForm, passingMarks: e.target.value })} />
              </div>
            </div>
            <div className="trackee-marks-actions">
              <button type="button" onClick={() => setView('list')} className="trackee-marks-btn-ghost">Cancel</button>
              <button type="submit" className="trackee-marks-btn-new">Create Test</button>
            </div>
          </form>
        </div>
      )}

      {/* --- GRADING VIEW --- */}
      {view === 'grading' && currentTest && (
        <div className="trackee-marks-grading-box fade-in">
          <div className="trackee-marks-grading-header">
            <div className="trackee-marks-gh-left">
              <button onClick={() => setView('list')} className="trackee-marks-btn-back">
                <i className="fas fa-arrow-left"></i>
              </button>
              <div className="trackee-marks-gh-titles">
                <h3>{currentTest.testName}</h3>
                <div className="trackee-marks-gh-meta">
                  <span>Max: {currentTest.maxMarks}</span>
                  <span>•</span>
                  <span>Pass: {currentTest.passingMarks}</span>
                  <button className="trackee-marks-btn-edit-pill" onClick={() => {
                    setEditForm({ maxMarks: currentTest.maxMarks, passingMarks: currentTest.passingMarks });
                    setIsEditingTest(true);
                  }}>
                    <i className="fas fa-pencil-alt"></i> Edit Criteria
                  </button>
                </div>
              </div>
            </div>
            <div className="trackee-marks-gh-right">
              <button onClick={generatePDF} className="trackee-marks-btn-report">
                <i className="fas fa-file-pdf"></i> Report
              </button>
              <button onClick={saveMarks} className="trackee-marks-btn-save">
                <i className="fas fa-save"></i> Save Marks
              </button>
            </div>
          </div>

          {isEditingTest && (
            <div className="trackee-marks-edit-overlay">
              <div className="trackee-marks-edit-inputs">
                <div><label>New Max</label><input type="number" value={editForm.maxMarks} onChange={e => setEditForm({ ...editForm, maxMarks: e.target.value })} /></div>
                <div><label>New Pass</label><input type="number" value={editForm.passingMarks} onChange={e => setEditForm({ ...editForm, passingMarks: e.target.value })} /></div>
              </div>
              <div className="trackee-marks-edit-btns">
                <button onClick={handleUpdateTestDetails} className="trackee-marks-btn-check"><i className="fas fa-check"></i></button>
                <button onClick={() => setIsEditingTest(false)} className="trackee-marks-btn-close"><i className="fas fa-times"></i></button>
              </div>
            </div>
          )}

          <div className="trackee-marks-table-wrap">
            <table className="trackee-marks-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>Roll</th>
                  <th>Name</th>
                  <th style={{ width: '90px', textAlign: 'center' }}>Marks</th>
                  <th style={{ width: '80px', textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {students.map(s => (
                  <tr key={s.id}>
                    <td className="trackee-marks-roll">{s.rollNo}</td>
                    <td className="trackee-marks-name">{s.firstName} {s.lastName}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="trackee-marks-input-mark" value={s.obtainedMarks} onChange={(e) => handleMarkChange(s.id, e.target.value)} placeholder="-" />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`trackee-marks-status ${s.status.toLowerCase()}`}>{s.status}</span>
                    </td>
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

export default MarksManager;