import React, { useState, useRef, useEffect } from 'react';
import { 
    collection, addDoc, query, orderBy, onSnapshot, 
    serverTimestamp, doc, updateDoc, getDoc 
} from 'firebase/firestore';
import { db } from '../firebase'; 
import './AiChatbot.css';

const BASE_URL = "https://acadex-backend-n2wh.onrender.com"; 

export default function AiChatbot({ user, isOpenProp, onClose }) {
    // --- UI State ---
    const [isOpen, setIsOpen] = useState(false);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [showHistory, setShowHistory] = useState(false);

    // --- Data State ---
    const [messages, setMessages] = useState([]);
    const [sessions, setSessions] = useState([]); 
    const [currentSessionId, setCurrentSessionId] = useState(null);
    const [activeTopic, setActiveTopic] = useState(null);

    // --- Quiz State ---
    const [quizMode, setQuizMode] = useState(false);
    const [activeQuiz, setActiveQuiz] = useState(null); 
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    const messagesEndRef = useRef(null);

    // 1. Initialize & Load History
    useEffect(() => {
        if (isOpenProp) setIsOpen(true);
        if (!user) return;

        const q = query(
            collection(db, 'users', user.uid, 'chats'), 
            orderBy('updatedAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setSessions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });

        return () => unsubscribe();
    }, [isOpenProp, user]);

    // 2. Load Messages when Session Changes
    useEffect(() => {
        if (!user || !currentSessionId) {
            setMessages([]);
            setActiveTopic(null);
            
            const userName = user?.firstName || 'Student';
            if (!showHistory) {
                setMessages([{ 
                    sender: 'bot', 
                    text: `Hey ${userName}! 👋\nI'm your AcadeX Coach.\n\nType a topic (e.g. "Photosynthesis") to start!` 
                }]);
            }
            return;
        }

        getDoc(doc(db, 'users', user.uid, 'chats', currentSessionId)).then(docSnap => {
            if (docSnap.exists() && docSnap.data().topic) setActiveTopic(docSnap.data().topic);
        });

        const q = query(
            collection(db, 'users', user.uid, 'chats', currentSessionId, 'messages'), 
            orderBy('createdAt', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setMessages(snapshot.docs.map(doc => doc.data()));
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        });

        return () => unsubscribe();
    }, [user, currentSessionId, showHistory]);

    // Helper: Create/Get Session ID
    const ensureSession = async (txt) => {
        if (currentSessionId) return currentSessionId;
        const ref = await addDoc(collection(db, 'users', user.uid, 'chats'), {
            title: txt.slice(0, 25) + "...", createdAt: serverTimestamp(), updatedAt: serverTimestamp()
        });
        setCurrentSessionId(ref.id);
        return ref.id;
    };

    const startNewChat = () => {
        setCurrentSessionId(null);
        setActiveTopic(null);
        setShowHistory(false);
        setQuizMode(false);
    };

    const handleSend = async () => {
        if (!input.trim()) return;
        const txt = input; 
        setInput('');

        if (!user?.uid) {
            setMessages(prev => [...prev, { sender: 'user', text: txt }]);
            return;
        }

        const sid = await ensureSession(txt);

        await addDoc(collection(db, 'users', user.uid, 'chats', sid, 'messages'), {
            text: txt, sender: 'user', createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, 'users', user.uid, 'chats', sid), { updatedAt: serverTimestamp() });

        if (!activeTopic) await handleSetTopic(txt, sid);
        else await processChat(txt, sid);
    };

    const handleSetTopic = async (topic, sid) => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/storeTopic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: user.uid, topic })
            });
            if (!res.ok) throw new Error("Failed");
            
            setActiveTopic(topic);
            await updateDoc(doc(db, 'users', user.uid, 'chats', sid), { topic });
            
            await addDoc(collection(db, 'users', user.uid, 'chats', sid, 'messages'), {
                text: `✅ **Topic Set: ${topic}**\nI'm ready to help! Click Quiz or Notes above.`, 
                sender: 'bot', 
                createdAt: serverTimestamp()
            });
        } catch (e) { 
            console.error(e);
            await addDoc(collection(db, 'users', user.uid, 'chats', sid, 'messages'), {
                text: "⚠️ Failed to set topic.", sender: 'bot', createdAt: serverTimestamp()
            });
        } finally { setLoading(false); }
    };

    const processChat = async (text, sid) => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, userContext: user })
            });
            const data = await res.json();
            
            await addDoc(collection(db, 'users', user.uid, 'chats', sid, 'messages'), {
                text: data.reply, sender: 'bot', createdAt: serverTimestamp()
            });
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };

    const handleActionClick = async (type) => {
        if (!activeTopic) {
            if(currentSessionId) {
                await addDoc(collection(db, 'users', user.uid, 'chats', currentSessionId, 'messages'), {
                    text: "⚠️ **Please enter a topic first!**", sender: 'bot', createdAt: serverTimestamp()
                });
            } else {
                 alert("Please enter a topic first!");
            }
            return;
        }
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/${type === 'notes' ? 'notes' : 'quiz'}?userId=${user.uid}`);
            const data = await res.json();

            if (type === 'notes' && data.note) {
                 await addDoc(collection(db, 'users', user.uid, 'chats', currentSessionId, 'messages'), {
                    text: data.note.content, sender: 'bot', createdAt: serverTimestamp()
                });
            } else if (data.quiz) {
                setActiveQuiz(data.quiz); setQuizMode(true); setScore(0); setCurrentQuestionIndex(0);
            }
        } catch(e) { console.error(e); }
        finally { setLoading(false); }
    };

    // Quiz Functions
    const nextQuestion = () => {
        if (currentQuestionIndex < activeQuiz.questions.length - 1) {
            setCurrentQuestionIndex(p => p + 1); setSelectedOption(null); setShowExplanation(false);
        } else setQuizFinished(true);
    };
    const handleOptionSelect = (idx, correct) => {
        if (selectedOption !== null) return;
        setSelectedOption(idx); setShowExplanation(true);
        if (idx === correct) setScore(s => s + 1);
    };
    const exitQuiz = () => { 
        setQuizMode(false); 
        if (currentSessionId) {
             addDoc(collection(db, 'users', user.uid, 'chats', currentSessionId, 'messages'), {
                text: `🏆 **Quiz Completed!** Score: ${score}`, sender: 'bot', createdAt: serverTimestamp()
            });
        }
        setActiveQuiz(null); 
    };

    const toggleChat = () => { setIsOpen(!isOpen); if (isOpen && onClose) onClose(); };

  const renderMessage = (text) => {
        if (!text) return null;
        // Clean and split text into paragraphs
        return text.replace(/^"|"$/g, '').split('\n').map((line, i) => (
            <div key={i} style={{ 
                marginBottom: '4px', 
                wordBreak: 'break-word', // ✅ Prevents text pushing bubbles off-screen
                overflowWrap: 'anywhere'
            }}>
                {line.split(/(\*\*.*?\*\*)/g).map((part, index) => 
                    part.startsWith('**') && part.endsWith('**') ? 
                    <strong key={index}>{part.slice(2, -2)}</strong> : part
                )}
            </div>
        ));
    };

    return (
        <>
            {!isOpen && (
                <div className="ai-fab" onClick={toggleChat}>
                    <i className="fas fa-robot"></i>
                </div>
            )}

            {isOpen && (
                <div className="ai-chat-window">
                    
                    {/* 1. HEADER */}
                    <div className="ai-header">
                        <div className="header-info" onClick={() => setShowHistory(!showHistory)} style={{cursor:'pointer'}}>
                            <div className="bot-avatar"><i className="fas fa-brain"></i></div>
                            <div className="bot-details">
                                <h3>AcadeX AI {showHistory && "(History)"}</h3>
                                <span className="bot-status">{activeTopic || "Online"}</span>
                            </div>
                        </div>
                        <div style={{display:'flex', gap:'8px'}}>
                            {/* Previous Chat Button */}
                            <button className="close-chat-btn" onClick={() => setShowHistory(!showHistory)} title="History">
                                <i className="fas fa-history"></i>
                            </button>
                            <button className="close-chat-btn" onClick={toggleChat}>
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                    </div>

                    {/* ✅ 1.5 QUICK ACTIONS (Moved Upward) */}
                    {!showHistory && !quizMode && (
                        <div style={{
                            padding: '10px 15px', 
                            background: '#f8fafc', 
                            borderBottom: '1px solid #e2e8f0', 
                            display: 'flex', 
                            gap: '10px',
                            alignItems: 'center'
                        }}>
                             <button onClick={() => handleActionClick('quiz')} style={{
                                flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', 
                                borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#475569',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                <i className="fas fa-pencil-alt" style={{color:'#f59e0b'}}></i> Quiz
                            </button>
                             <button onClick={() => handleActionClick('notes')} style={{
                                flex: 1, padding: '8px', background: 'white', border: '1px solid #cbd5e1', 
                                borderRadius: '8px', cursor: 'pointer', fontSize: '14px', fontWeight: '600', color: '#475569',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                            }}>
                                <i className="fas fa-book-open" style={{color:'#3b82f6'}}></i> Notes
                            </button>
                        </div>
                    )}

                    {/* 2. BODY */}
                    <div className="ai-body">
                        {showHistory ? (
                            /* HISTORY UI */
                            <div style={{padding:'15px', height:'100%', overflowY:'auto', background:'#f8fafc'}}>
                                <button onClick={startNewChat} style={{width:'100%', padding:'12px', background:'#3b82f6', color:'white', border:'none', borderRadius:'10px', fontWeight:'bold', marginBottom:'15px', cursor:'pointer', boxShadow:'0 2px 5px rgba(0,0,0,0.1)'}}>
                                    + Start New Chat
                                </button>
                                {sessions.length === 0 && <p style={{textAlign:'center', color:'#94a3b8'}}>No history yet.</p>}
                                {sessions.map(s => (
                                    <div key={s.id} onClick={() => { setCurrentSessionId(s.id); setShowHistory(false); }}
                                         style={{padding:'12px', background:'white', borderRadius:'10px', marginBottom:'10px', cursor:'pointer', border:'1px solid #e2e8f0', display:'flex', justifyContent:'space-between', alignItems:'center'}}>
                                        <div>
                                            <div style={{fontWeight:'600', color:'#1e293b', fontSize:'14px'}}>{s.title || "Untitled Chat"}</div>
                                            <div style={{fontSize:'11px', color:'#94a3b8'}}>{s.updatedAt?.toDate().toLocaleDateString()}</div>
                                        </div>
                                        <i className="fas fa-chevron-right" style={{color:'#cbd5e1', fontSize:'12px'}}></i>
                                    </div>
                                ))}
                            </div>
                        ) : quizMode ? (
                            /* QUIZ UI */
                            <div className="quiz-ui">
                                <div className="quiz-header">
                                    <span>Question {currentQuestionIndex + 1}/{activeQuiz.questions.length}</span>
                                    <button onClick={exitQuiz} className="quiz-exit-btn">Exit</button>
                                </div>
                                {!quizFinished ? (
                                    <>
                                        <div className="quiz-question">{activeQuiz.questions[currentQuestionIndex].question}</div>
                                        <div className="quiz-options">
                                            {activeQuiz.questions[currentQuestionIndex].options.map((opt, i) => {
                                                const isSelected = selectedOption === i;
                                                const correctIndex = activeQuiz.questions[currentQuestionIndex].correctIndex;
                                                let style = {};
                                                if (selectedOption !== null) {
                                                    if (i === correctIndex) style = { background: '#dcfce7', borderColor: '#22c55e', color: '#14532d' };
                                                    else if (isSelected) style = { background: '#fee2e2', borderColor: '#ef4444', color: '#7f1d1d' };
                                                }
                                                return (
                                                    <button key={i} className={`quiz-opt ${isSelected ? 'selected' : ''}`} style={style}
                                                        onClick={() => handleOptionSelect(i, correctIndex)} disabled={selectedOption !== null}>
                                                        {opt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {showExplanation && (
                                            <button className="quiz-footer-btn" onClick={nextQuestion}>Next Question <i className="fas fa-arrow-right"></i></button>
                                        )}
                                    </>
                                ) : (
                                    <div style={{textAlign:'center', margin:'auto'}}>
                                        <h3>🎉 Quiz Completed!</h3>
                                        <div style={{fontSize: '40px', margin: '20px 0'}}>🏆</div>
                                        <p>Score: <strong>{score} / {activeQuiz.questions.length}</strong></p>
                                        <button className="quiz-footer-btn" onClick={exitQuiz}>Back to Chat</button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* CHAT UI */
                            <div className="messages-list">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`message-row ${msg.sender}`}>
                                        <div className="message-bubble">{renderMessage(msg.text)}</div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="message-row bot">
                                        <div className="message-bubble"><i className="fas fa-circle-notch fa-spin"></i> Thinking...</div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* 3. FOOTER */}
                    {!showHistory && !quizMode && (
                        <div className="ai-input-area">
                            <div className="input-box">
                                <input type="text" placeholder="Type a topic..." value={input} 
                                    onChange={e => setInput(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSend()} />
                            </div>
                            <button className={`send-btn ${input.trim() ? 'active' : ''}`} onClick={handleSend} disabled={!input.trim()}>
                                <i className="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}