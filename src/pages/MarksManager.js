import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; // ✅ This makes the popup cover the sidebar
import {
  collection, query, where, onSnapshot, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import toast from 'react-hot-toast';

const MarksManager = ({ teacherInfo, selectedYear, selectedDiv }) => {
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

  // Helper: Get Class Details
  const getClassDetails = () => {
    if (!teacherInfo?.assignedClasses) return { semester: 'N/A', subject: teacherInfo?.subject || 'Subject' };
    const cls = teacherInfo.assignedClasses.find(c => c.year === selectedYear);
    return {
      semester: cls ? `Semester ${cls.semester}` : 'Semester --',
      subject: cls ? cls.subject : teacherInfo.subject
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
    let signY = finalY + 30; // Gap for signature

    // If signature falls off page, add new page
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
      <div className="mm-header-flex">
        <div>
          <h2 className="gradient-text">Marks & Results</h2>
          <p className="content-subtitle">Manage assessments and grading.</p>
        </div>
        {view === 'list' && (
          <button onClick={() => {
            setTestForm({ name: '', maxMarks: 20, passingMarks: 8, date: new Date().toISOString().split('T')[0] });
            setView('create');
          }} className="mm-btn-new">
            <i className="fas fa-plus"></i> New Test
          </button>
        )}
      </div>

      {/* --- LIST VIEW --- */}
      {view === 'list' && (
        <div className="mm-grid">
          {tests.length > 0 ? tests.map(test => (
            <div key={test.id} className="mm-card" onClick={() => { setCurrentTest(test); fetchStudentsForGrading(test); setView('grading'); }}>
              <div className="mm-card-top">
                <span className="mm-tag">{test.subject}</span>
                {/* DELETE BUTTON TRIGGERS MODAL */}
                <button className="mm-btn-delete" onClick={(e) => promptDelete(e, test)}>
                  <i className="fas fa-trash-alt"></i>
                </button>
              </div>
              <h4 className="mm-card-title">{test.testName}</h4>
              <div className="mm-card-info">
                <span><i className="far fa-calendar"></i> {test.date}</span>
                <span><i className="fas fa-star"></i> {test.maxMarks} M</span>
              </div>
            </div>
          )) : (
            <div className="mm-empty">
              <i className="fas fa-clipboard-list"></i>
              <p>No tests found.</p>
            </div>
          )}
        </div>
      )}

      {/* --- DELETE MODAL (COVERS SIDEBAR) --- */}
      {deleteModalOpen && testToDelete && createPortal(
        <div className="mm-modal-overlay">
          <div className="mm-modal-box fade-in">
            <div className="mm-modal-icon">
              <i className="fas fa-exclamation-triangle"></i>
            </div>
            <h3>Delete Assessment?</h3>
            <p>Are you sure you want to delete <b>{testToDelete.testName}</b>?</p>
            <div className="mm-modal-actions">
              <button className="mm-btn-ghost" onClick={() => setDeleteModalOpen(false)}>Cancel</button>
              <button className="mm-btn-danger" onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>,
        document.body // ✅ Mounts on body to cover sidebar
      )}

      {/* --- CREATE VIEW --- */}
      {view === 'create' && (
        <div className="mm-form-box fade-in">
          <h3>Create Assessment</h3>
          <form onSubmit={handleCreateTest} className="mm-form">
            <div className="mm-input-group full">
              <label>Test Name</label>
              <input required value={testForm.name} onChange={e => setTestForm({ ...testForm, name: e.target.value })} placeholder="e.g. Unit Test 1" />
            </div>
            <div className="mm-row">
              <div className="mm-input-group">
                <label>Date</label>
                <input type="date" required value={testForm.date} onChange={e => setTestForm({ ...testForm, date: e.target.value })} />
              </div>
              <div className="mm-input-group">
                <label>Max Marks</label>
                <input type="number" required value={testForm.maxMarks} onChange={e => setTestForm({ ...testForm, maxMarks: e.target.value })} />
              </div>
              <div className="mm-input-group">
                <label>Passing</label>
                <input type="number" required value={testForm.passingMarks} onChange={e => setTestForm({ ...testForm, passingMarks: e.target.value })} />
              </div>
            </div>
            <div className="mm-actions">
              <button type="button" onClick={() => setView('list')} className="mm-btn-ghost">Cancel</button>
              <button type="submit" className="mm-btn-new">Create Test</button>
            </div>
          </form>
        </div>
      )}

      {/* --- GRADING VIEW --- */}
      {view === 'grading' && currentTest && (
        <div className="mm-grading-box fade-in">
          <div className="mm-grading-header">
            <div className="mm-gh-left">
              <button onClick={() => setView('list')} className="mm-btn-back">
                <i className="fas fa-arrow-left"></i>
              </button>
              <div className="mm-gh-titles">
                <h3>{currentTest.testName}</h3>
                <div className="mm-gh-meta">
                  <span>Max: {currentTest.maxMarks}</span>
                  <span>•</span>
                  <span>Pass: {currentTest.passingMarks}</span>
                  <button className="mm-btn-edit-pill" onClick={() => {
                    setEditForm({ maxMarks: currentTest.maxMarks, passingMarks: currentTest.passingMarks });
                    setIsEditingTest(true);
                  }}>
                    <i className="fas fa-pencil-alt"></i> Edit Criteria
                  </button>
                </div>
              </div>
            </div>
            <div className="mm-gh-right">
              <button onClick={generatePDF} className="mm-btn-report">
                <i className="fas fa-file-pdf"></i> Report
              </button>
              <button onClick={saveMarks} className="mm-btn-save">
                <i className="fas fa-save"></i> Save Marks
              </button>
            </div>
          </div>

          {isEditingTest && (
            <div className="mm-edit-overlay">
              <div className="mm-edit-inputs">
                <div><label>New Max</label><input type="number" value={editForm.maxMarks} onChange={e => setEditForm({ ...editForm, maxMarks: e.target.value })} /></div>
                <div><label>New Pass</label><input type="number" value={editForm.passingMarks} onChange={e => setEditForm({ ...editForm, passingMarks: e.target.value })} /></div>
              </div>
              <div className="mm-edit-btns">
                <button onClick={handleUpdateTestDetails} className="mm-btn-check"><i className="fas fa-check"></i></button>
                <button onClick={() => setIsEditingTest(false)} className="mm-btn-close"><i className="fas fa-times"></i></button>
              </div>
            </div>
          )}

          <div className="mm-table-wrap">
            <table className="mm-table">
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
                    <td className="mm-roll">{s.rollNo}</td>
                    <td className="mm-name">{s.firstName} {s.lastName}</td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="number" className="mm-input-mark" value={s.obtainedMarks} onChange={(e) => handleMarkChange(s.id, e.target.value)} placeholder="-" />
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`mm-status ${s.status.toLowerCase()}`}>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <style>{`
                .mm-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
                .mm-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 15px; }
                
                /* Buttons */
                .mm-btn-new { background: #2563eb; color: white; border: none; padding: 0 18px; height: 40px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 4px 6px rgba(37, 99, 235, 0.2); }
                .mm-btn-save { background: #16a34a; color: white; border: none; padding: 0 18px; height: 40px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }
                .mm-btn-report { background: white; color: #ef4444; border: 1px solid #fee2e2; padding: 0 18px; height: 40px; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px; }
                .mm-btn-report:hover { background: #fef2f2; }
                .mm-btn-ghost { background: transparent; color: #64748b; border: 1px solid #cbd5e1; padding: 0 18px; height: 40px; border-radius: 8px; font-weight: 600; cursor: pointer; }
                .mm-btn-danger { background: #ef4444; color: white; border: none; padding: 0 18px; height: 40px; border-radius: 8px; font-weight: 600; cursor: pointer; }
                
                /* Cards */
                .mm-card { background: white; border: 1px solid #e2e8f0; padding: 18px; border-radius: 12px; cursor: pointer; transition: transform 0.2s; }
                .mm-card:hover { transform: translateY(-3px); border-color: #2563eb; }
                .mm-card-top { display: flex; justify-content: space-between; margin-bottom: 10px; }
                .mm-tag { background: #eff6ff; color: #2563eb; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 4px; }
                .mm-btn-delete { background: none; border: none; color: #cbd5e1; cursor: pointer; font-size: 14px; }
                .mm-btn-delete:hover { color: #ef4444; transform: scale(1.2); transition: all 0.2s; }
                .mm-card-title { margin: 0 0 5px 0; font-size: 16px; color: #1e293b; }
                .mm-card-info { font-size: 12px; color: #64748b; display: flex; gap: 10px; }

                /* Grading Header */
                .mm-grading-box { background: white; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; }
                .mm-grading-header { display: flex; justify-content: space-between; align-items: center; padding: 15px; border-bottom: 1px solid #f1f5f9; background: white; }
                .mm-gh-left { display: flex; align-items: center; gap: 12px; }
                .mm-btn-back { width: 36px; height: 36px; border-radius: 50%; background: #f1f5f9; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #64748b; }
                .mm-gh-titles h3 { margin: 0; font-size: 16px; color: #0f172a; }
                .mm-gh-meta { font-size: 12px; color: #64748b; display: flex; align-items: center; gap: 8px; }
                .mm-gh-right { display: flex; gap: 10px; align-items: center; }
                .mm-btn-edit-pill { background: #f0f9ff; color: #0284c7; border: 1px solid #bae6fd; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 4px; margin-left: 5px; }

                /* PORTAL MODAL Styles (High Z-Index) */
                .mm-modal-overlay { 
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
                    background: rgba(0,0,0,0.6); z-index: 99999; /* Highest Priority */
                    display: flex; align-items: center; justify-content: center; 
                    backdrop-filter: blur(2px);
                }
                .mm-modal-box { 
                    background: white; padding: 30px; border-radius: 16px; 
                    width: 90%; max-width: 400px; text-align: center; 
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1); 
                }
                .mm-modal-icon { width: 50px; height: 50px; background: #fee2e2; color: #ef4444; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; margin: 0 auto 15px; }
                .mm-modal-box h3 { margin: 0 0 10px 0; color: #1e293b; font-size: 18px; }
                .mm-modal-box p { color: #64748b; font-size: 14px; margin-bottom: 25px; }
                .mm-modal-actions { display: flex; gap: 10px; justify-content: center; }
                .mm-modal-actions button { width: 100px; justify-content: center; }

                /* Edit Overlay */
                .mm-edit-overlay { background: #fffbeb; padding: 10px 15px; display: flex; align-items: flex-end; gap: 10px; border-bottom: 1px solid #fcd34d; }
                .mm-edit-inputs { display: flex; gap: 10px; }
                .mm-edit-inputs label { display: block; font-size: 10px; color: #b45309; font-weight: 700; }
                .mm-edit-inputs input { width: 60px; padding: 4px; border: 1px solid #fbbf24; border-radius: 4px; }
                .mm-edit-btns { display: flex; gap: 5px; }
                .mm-btn-check { background: #16a34a; color: white; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; }
                .mm-btn-close { background: #ef4444; color: white; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer; }

                /* Table */
                .mm-table-wrap { overflow-x: auto; }
                .mm-table { width: 100%; border-collapse: collapse; }
                .mm-table th { text-align: left; padding: 10px 15px; font-size: 12px; color: #64748b; border-bottom: 2px solid #f1f5f9; background: #f8fafc; }
                .mm-table td { padding: 8px 15px; border-bottom: 1px solid #f1f5f9; font-size: 14px; vertical-align: middle; }
                .mm-roll { font-weight: 700; color: #475569; }
                .mm-input-mark { width: 50px; text-align: center; padding: 6px; border: 1px solid #cbd5e1; border-radius: 6px; font-weight: 600; outline: none; }
                .mm-input-mark:focus { border-color: #2563eb; background: #eff6ff; }
                .mm-status { padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
                .mm-status.pass { background: #dcfce7; color: #166534; }
                .mm-status.fail { background: #fee2e2; color: #991b1b; }
                .mm-status.- { background: #f1f5f9; color: #cbd5e1; }

                /* Form */
                .mm-form-box { background: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; max-width: 500px; margin: 0 auto; }
                .mm-form-box h3 { margin: 0 0 15px 0; color: #1e293b; }
                .mm-form { display: flex; flex-direction: column; gap: 15px; }
                .mm-row { display: flex; gap: 15px; }
                .mm-input-group { flex: 1; }
                .mm-input-group label { display: block; font-size: 12px; font-weight: 600; color: #64748b; margin-bottom: 5px; }
                .mm-input-group input { width: 100%; padding: 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 14px; outline: none; box-sizing: border-box; }
                .mm-actions { display: flex; gap: 10px; margin-top: 5px; }
                .mm-actions button { flex: 1; }

                @media (max-width: 600px) {
                    .mm-grading-header { flex-direction: column; gap: 15px; align-items: flex-start; }
                    .mm-gh-right { width: 100%; justify-content: space-between; }
                    .mm-gh-right button { flex: 1; justify-content: center; }
                }
            `}</style>
    </div>
  );
};

export default MarksManager;