import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom'; // ✅ Import ReactDOM for Portal
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';

// ✅ CONFIRM YOUR BACKEND URL
const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function FreePeriodQuiz({ user, isFree }) { 
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [questions, setQuestions] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [selectedOption, setSelectedOption] = useState(null);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    // AUTO-CLOSE IF PERIOD ENDS
    useEffect(() => {
        if (isFree === false && isOpen) {
            setIsOpen(false);
            toast("Free period ended. Quiz closed!", { icon: '⏰' });
        }
    }, [isFree, isOpen]);

    const startQuiz = async () => {
        setIsOpen(true);
        setLoading(true);
        setQuizFinished(false);
        setScore(0);
        setCurrentIndex(0);
        setQuestions([]);
        setSelectedOption(null);
        setIsFlipped(false);

        try {
            const res = await fetch(`${BACKEND_URL}/generateQuiz`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    department: user.department || 'General',
                    semester: user.semester || '1',
                    careerGoal: user.careerGoal || 'Engineering'
                })
            });
            const data = await res.json();
            if (data.questions) setQuestions(data.questions);
            else throw new Error("No questions");
        } catch (err) {
            toast.error("Failed to load quiz.");
            setIsOpen(false);
        } finally {
            setLoading(false);
        }
    };

    const handleOptionClick = (option) => {
        if (selectedOption) return;
        setSelectedOption(option);
        setIsFlipped(true);
        if (option === questions[currentIndex].answer) {
            setScore(prev => prev + 1);
            toast.success("Correct! 🎯", { position: 'bottom-center' });
        } else {
            toast.error("Incorrect", { position: 'bottom-center' });
        }
    };

    const nextQuestion = () => {
        if (currentIndex + 1 < questions.length) {
            setIsFlipped(false);
            setSelectedOption(null);
            setTimeout(() => setCurrentIndex(prev => prev + 1), 300);
        } else {
            finishQuiz();
        }
    };

    const finishQuiz = async () => {
        setQuizFinished(true);
        const xpEarned = score * 10;
        if (auth.currentUser) {
            const userRef = doc(db, 'users', auth.currentUser.uid);
            await updateDoc(userRef, { xp: increment(xpEarned) });
        }
        toast.success(`Quiz Done! +${xpEarned} XP`, { icon: '🏆' });
    };

    // ✅ Render Modal using Portal (This fixes the "Sidebar overlap" issue)
    const renderModal = () => {
        return ReactDOM.createPortal(
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{
                            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
                            zIndex: 2147483647, // ✅ MAX Z-INDEX to be on TOP of everything (sidebar/header)
                            background: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(12px)',
                            display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '15px'
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                            style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width:'40px', height:'40px', borderRadius:'50%', cursor: 'pointer', fontSize:'20px', zIndex: 100000 }}
                        >
                            <i className="fas fa-times"></i>
                        </button>

                        <div style={{ width: '100%', maxWidth: '500px' }} onClick={e => e.stopPropagation()}>
                            {loading && (
                                <div style={{ textAlign: 'center', color: 'white' }}>
                                    <div className="spinner" style={{ borderTopColor: '#a78bfa', width:'50px', height:'50px', margin:'0 auto 20px' }}></div>
                                    <h3>Generating Challenge...</h3>
                                </div>
                            )}

                            {!loading && !quizFinished && questions.length > 0 && (
                                <div style={{ perspective: '1000px' }}>
                                    <div style={{display:'flex', justifyContent:'space-between', color:'white', marginBottom:'15px'}}>
                                        <div>Q{currentIndex + 1} / 10</div>
                                        <div>XP: {score * 10}</div>
                                    </div>

                                    <motion.div
                                        key={currentIndex}
                                        initial={{ x: 50, opacity: 0 }} animate={{ x: 0, opacity: 1, rotateY: isFlipped ? 180 : 0 }}
                                        transition={{ duration: 0.6 }}
                                        style={{ position: 'relative', width: '100%', height: '60vh', maxHeight: '500px', transformStyle: 'preserve-3d' }}
                                    >
                                        {/* FRONT */}
                                        <div className="card" style={{ 
                                            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                                            background:'white', borderRadius:'20px', padding:'25px', 
                                            display: 'flex', flexDirection: 'column', overflowY: 'auto'
                                        }}>
                                            <h3 style={{ fontSize: '18px', color: '#1e293b', marginBottom: '20px', fontWeight:'700' }}>
                                                {questions[currentIndex].question}
                                            </h3>
                                            <div style={{ display: 'grid', gap: '10px' }}>
                                                {questions[currentIndex].options.map((opt, i) => (
                                                    <motion.button 
                                                        key={i} whileTap={{ scale: 0.98 }}
                                                        onClick={(e) => { e.stopPropagation(); handleOptionClick(opt); }}
                                                        style={{ textAlign: 'left', padding: '14px', background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:'10px', color:'#475569', cursor:'pointer' }}
                                                    >
                                                        {opt}
                                                    </motion.button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* BACK */}
                                        <div className="card" style={{ 
                                            position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                                            background: selectedOption === questions[currentIndex].answer ? '#ecfdf5' : '#fff1f2',
                                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                                            borderRadius:'20px', padding:'25px', overflowY: 'auto'
                                        }}>
                                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>{selectedOption === questions[currentIndex].answer ? '🎉' : '❌'}</div>
                                            <h3 style={{ color: selectedOption === questions[currentIndex].answer ? '#059669' : '#dc2626', marginBottom:'10px' }}>
                                                {selectedOption === questions[currentIndex].answer ? 'Correct!' : 'Incorrect'}
                                            </h3>
                                            <p style={{ color: '#334155', marginBottom: '20px' }}>{questions[currentIndex].explanation}</p>
                                            <button onClick={(e) => { e.stopPropagation(); nextQuestion(); }} style={{background:'#1e293b', color:'white', border:'none', padding:'12px 30px', borderRadius:'30px', cursor:'pointer'}}>Next Question</button>
                                        </div>
                                    </motion.div>
                                </div>
                            )}

                            {quizFinished && (
                                <div className="card" style={{ textAlign: 'center', padding: '40px 20px', borderRadius:'24px', background:'white' }}>
                                    <div style={{ fontSize: '60px', marginBottom: '10px' }}>🏆</div>
                                    <h2 style={{ fontSize: '28px' }}>Quiz Complete!</h2>
                                    <div style={{ fontSize: '50px', fontWeight: '800', color: '#7c3aed', margin:'15px 0' }}>{score}/10</div>
                                    <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} style={{background:'#7c3aed', color:'white', border:'none', width:'100%', padding:'15px', borderRadius:'15px'}}>Back to Dashboard</button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>,
            document.body // ✅ Appends to <body>
        );
    };

    return (
        <>
            {/* ✅ TRIGGER CARD (ON DASHBOARD) */}
            <motion.div 
                className="card"
                whileHover={{ y: -5, boxShadow: "0 20px 30px -10px rgba(124, 58, 237, 0.3)" }}
                style={{ 
                    background: 'linear-gradient(135deg, #f5f3ff 0%, #ddd6fe 100%)', 
                    border: '1px solid rgba(139, 92, 246, 0.2)',
                    display: 'flex', flexDirection: 'column',
                    position: 'relative', overflow: 'hidden', cursor: 'pointer',
                    zIndex: 0 // ✅ LOW Z-INDEX TO PREVENT OVERLAP
                }}
                onClick={startQuiz}
            >
                <div style={{ position: 'absolute', top: '-50px', right: '-50px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(167, 139, 250, 0.4) 0%, rgba(255,255,255,0) 70%)', borderRadius: '50%', zIndex: 0 }} />
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '15px', zIndex: 1 }}>
                    <div className="icon-box-modern" style={{ background: '#fff', color: '#7c3aed' }}><i className="fas fa-brain"></i></div>
                    <div>
                        <h3 style={{ margin: 0, color: '#5b21b6', fontWeight: '800', fontSize: '16px' }}>KNOWLEDGE BLITZ</h3>
                        <span style={{ fontSize: '10px', color: '#7c3aed', fontWeight: '600' }}>FOCUS MODE</span>
                    </div>
                </div>

                <p style={{ fontSize: '13px', color: '#4c1d95', marginBottom: '15px', lineHeight: '1.6', flex: 1, zIndex: 1 }}>
                    Free period detected! Master <strong>{user.careerGoal || "Engineering"}</strong> concepts now.
                </p>

                <button style={{ background: '#7c3aed', color: 'white', border: 'none', width: '100%', padding: '10px', borderRadius: '10px', fontWeight: '700', fontSize: '13px', zIndex: 1 }}>
                    <i className="fas fa-play"></i> Start Quiz
                </button>
            </motion.div>

            {/* ✅ FULL SCREEN MODAL */}
            {renderModal()}
        </>
    );
}