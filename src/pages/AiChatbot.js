import React, { useState, useRef, useEffect } from 'react';
import './AiChatbot.css';

const BASE_URL = "https://acadex-backend-n2wh.onrender.com"; 

export default function AiChatbot({ user, isOpenProp, onClose }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Core State
    const [activeTopic, setActiveTopic] = useState(null);

    // Quiz State
    const [quizMode, setQuizMode] = useState(false);
    const [activeQuiz, setActiveQuiz] = useState(null); 
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedOption, setSelectedOption] = useState(null);
    const [showExplanation, setShowExplanation] = useState(false);
    const [score, setScore] = useState(0);
    const [quizFinished, setQuizFinished] = useState(false);

    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (isOpenProp) setIsOpen(true);
        // ✅ FIX: Safety check for user.firstName
        const userName = user?.firstName || 'Student';
        if (messages.length === 0) {
            setMessages([{ 
                sender: 'bot', 
                text: `Hey ${userName}! 👋\nI'm your AcadeX Coach.\n\nType a topic (e.g. "Photosynthesis") to start!` 
            }]);
        }
    }, [isOpenProp, user]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, quizMode, loading]);

    const handleSend = async () => {
        if (!input.trim()) return;
        const textToSend = input;
        setInput('');
        addMessage('user', textToSend);

        if (!activeTopic) await handleSetTopic(textToSend);
        else await processChat(textToSend);
    };

    const addMessage = (sender, text) => setMessages(prev => [...prev, { sender, text }]);

    // ✅ FIX: Robust Topic Setting
    const handleSetTopic = async (topic) => {
        setLoading(true);
        try {
            const userId = user?.uid;
            if (!userId) throw new Error("User ID missing. Please re-login.");

            const res = await fetch(`${BASE_URL}/storeTopic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, topic })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Failed to save topic");
            }

            setActiveTopic(topic);
            addMessage('bot', `✅ **Topic Set: ${topic}**\nUse the buttons above for Quiz or Notes!`);
        } catch (err) {
            console.error(err);
            addMessage('bot', `⚠️ Issue: ${err.message}. Try again.`);
        } finally {
            setLoading(false);
        }
    };

    // ✅ FIX: Robust Action Handling (Notes/Quiz)
    const handleActionClick = async (type) => {
        if (!activeTopic) {
            addMessage('bot', "⚠️ **Please enter a topic first** below.");
            return;
        }
        setLoading(true);
        try {
            const userId = user?.uid;
            if (!userId) throw new Error("User ID missing.");

            const endpoint = type === 'notes' ? '/notes' : '/quiz';
            const res = await fetch(`${BASE_URL}${endpoint}?userId=${userId}`);
            const data = await res.json();

            // Check for backend error
            if (!res.ok) throw new Error(data.error || "Failed to generate content");

            if (type === 'notes') {
                if (data.note?.content) addMessage('bot', data.note.content);
                else throw new Error("Notes content is empty.");
            } else { 
                if (data.quiz) {
                    setActiveQuiz(data.quiz); 
                    startQuizMode(data.quiz); 
                } else throw new Error("Quiz data is empty.");
            }
        } catch (err) {
            console.error(err);
            addMessage('bot', `⚠️ Error: ${err.message}. \nTip: Try setting the topic again.`);
        } finally {
            setLoading(false);
        }
    };

    const processChat = async (text) => {
        setLoading(true);
        try {
            const res = await fetch(`${BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, userContext: user })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.reply || "Chat error");
            addMessage('bot', data.reply);
        } catch (error) {
            addMessage('bot', "⚠️ Error connecting to AI.");
        } finally {
            setLoading(false);
        }
    };

    // Quiz Functions
    const startQuizMode = () => {
        setQuizMode(true); setQuizFinished(false); setCurrentQuestionIndex(0);
        setScore(0); setSelectedOption(null); setShowExplanation(false);
    };
    const handleOptionSelect = (idx, correct) => {
        if (selectedOption !== null) return;
        setSelectedOption(idx); setShowExplanation(true);
        if (idx === correct) setScore(s => s + 1);
    };
    const nextQuestion = () => {
        if (currentQuestionIndex < activeQuiz.questions.length - 1) {
            setCurrentQuestionIndex(p => p + 1); setSelectedOption(null); setShowExplanation(false);
        } else setQuizFinished(true);
    };
    const exitQuiz = () => { setQuizMode(false); setActiveQuiz(null); addMessage('bot', `Quiz Done! Score: ${score}`); };

    const toggleChat = () => {
        setIsOpen(!isOpen);
        if (isOpen && onClose) onClose();
    };

    const renderMessage = (text) => {
        if (!text) return null;
        return text.replace(/^"|"$/g, '').split('\n').map((line, i) => (
            <div key={i} style={{marginBottom:'4px'}}>
                {line.split(/(\*\*.*?\*\*)/g).map((part, index) => 
                    part.startsWith('**') && part.endsWith('**') ? 
                    <strong key={index}>{part.slice(2, -2)}</strong> : part
                )}
            </div>
        ));
    };

    return (
        <>
            {/* Floating Launcher Button */}
            {!isOpen && (
                <div className="ai-fab" onClick={toggleChat}>
                    <i className="fas fa-robot"></i>
                </div>
            )}

            {/* Main Chat Window */}
            {isOpen && (
                <div className="ai-chat-window">
                    
                    {/* 1. HEADER */}
                    <div className="ai-header">
                        <div className="header-info">
                            <div className="bot-avatar"><i className="fas fa-brain"></i></div>
                            <div className="bot-details">
                                <h3>AcadeX AI</h3>
                                <span className="bot-status">Online</span>
                            </div>
                        </div>
                        {/* New Exit Button */}
                        <button className="close-chat-btn" onClick={toggleChat}>
                            <i className="fas fa-times"></i>
                        </button>
                    </div>

                    {/* 2. FLOATING ACTION BUTTONS (Quiz/Notes) */}
                    {!quizMode && (
                        <div className="floating-options">
                            <button className="float-pill quiz-btn" onClick={() => handleActionClick('quiz')}>
                                <i className="fas fa-pencil-alt"></i> Quiz
                            </button>
                            <button className="float-pill notes-btn" onClick={() => handleActionClick('notes')}>
                                <i className="fas fa-book-open"></i> Notes
                            </button>
                        </div>
                    )}

                    {/* 3. MESSAGES AREA */}
                    <div className="ai-body">
                        {!quizMode ? (
                            <div className="messages-list">
                                {messages.map((msg, idx) => (
                                    <div key={idx} className={`message-row ${msg.sender}`}>
                                        <div className="message-bubble">
                                            {renderMessage(msg.text)}
                                        </div>
                                    </div>
                                ))}
                                {loading && (
                                    <div className="message-row bot">
                                        <div className="message-bubble">
                                            <i className="fas fa-circle-notch fa-spin"></i> Thinking...
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>
                        ) : (
                            <div className="quiz-ui">
                                <div className="quiz-header">
                                    <span>Question {currentQuestionIndex + 1}/{activeQuiz.questions.length}</span>
                                    <button onClick={exitQuiz} className="quiz-exit-btn">Exit</button>
                                </div>
                                {!quizFinished ? (
                                    <>
                                        <div className="quiz-question">
                                            {activeQuiz.questions[currentQuestionIndex].question}
                                        </div>
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
                                                    <button key={i} className={`quiz-opt ${isSelected ? 'selected' : ''}`} 
                                                        style={style}
                                                        onClick={() => handleOptionSelect(i, correctIndex)}
                                                        disabled={selectedOption !== null}>
                                                        {opt}
                                                    </button>
                                                )
                                            })}
                                        </div>
                                        {showExplanation && (
                                            <button className="quiz-footer-btn" onClick={nextQuestion}>
                                                Next Question <i className="fas fa-arrow-right"></i>
                                            </button>
                                        )}
                                    </>
                                ) : (
                                    <div style={{textAlign:'center', marginTop: 'auto', marginBottom: 'auto'}}>
                                        <h3>🎉 Quiz Completed!</h3>
                                        <div style={{fontSize: '40px', margin: '20px 0'}}>🏆</div>
                                        <p style={{fontSize: '18px', color: '#64748b'}}>Your Score: <strong>{score} / {activeQuiz.questions.length}</strong></p>
                                        <button className="quiz-footer-btn" onClick={exitQuiz}>Back to Chat</button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 4. INPUT AREA */}
                    {!quizMode && (
                        <div className="ai-input-area">
                            <div className="input-box">
                                <input 
                                    type="text" 
                                    placeholder="Type a topic..." 
                                    value={input} 
                                    onChange={e => setInput(e.target.value)}
                                    onKeyPress={e => e.key === 'Enter' && handleSend()}
                                />
                            </div>
                            <button 
                                className={`send-btn ${input.trim() ? 'active' : ''}`} 
                                onClick={handleSend} 
                                disabled={!input.trim()}
                            >
                                <i className="fas fa-paper-plane"></i>
                            </button>
                        </div>
                    )}
                </div>
            )}
        </>
    );
}