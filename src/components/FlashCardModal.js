import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function FlashCardModal({ isOpen, onClose, onComplete }) {
    const [step, setStep] = useState('input'); // input | loading | playing
    const [topic, setTopic] = useState('');
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setStep('input');
            setTopic('');
            setCards([]);
            setCurrentIndex(0);
            setIsFlipped(false);
        }
    }, [isOpen]);

    const handleGenerate = async () => {
        if (!topic.trim()) return;
        setStep('loading');
        try {
            const res = await fetch(`${BACKEND_URL}/startInteractiveTask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskType: 'FlashCard', userInterest: topic.trim() })
            });
            const data = await res.json();
            if (data.cards && data.cards.length > 0) {
                setCards(data.cards);
                setStep('playing');
            } else {
                alert("Try a different topic.");
                setStep('input');
            }
        } catch (e) {
            console.error(e);
            setStep('input');
        }
    };

    const handleNext = () => {
        setIsFlipped(false);
        setTimeout(() => {
            if (currentIndex < cards.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                onComplete && onComplete(30);
                onClose();
            }
        }, 300);
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="fc-overlay">
            <motion.div 
                className="fc-modal"
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
            >
                {/* Header (Fixed at Top) */}
                <div className="fc-header">
                    <div className="fc-header-title">
                        <div className="fc-icon-bg"><i className="fas fa-bolt"></i></div>
                        <span>FlashCards</span>
                    </div>
                    <button onClick={onClose} className="fc-close-btn">
                        <i className="fas fa-times"></i>
                    </button>
                </div>

                {/* Body (Flexible Middle) */}
                <div className="fc-body">
                    <AnimatePresence mode='wait'>
                        {step === 'input' && (
                            <motion.div key="input" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fc-input-screen">
                                <div className="fc-hero-icon"><i className="fas fa-brain"></i></div>
                                <h2>Master a Topic</h2>
                                <p>Type a subject below, and AI will generate study cards for you.</p>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Python Lists, History of Rome..." 
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    autoFocus
                                    className="fc-topic-input"
                                />
                                <button className="fc-action-btn" onClick={handleGenerate} disabled={!topic.trim()}>
                                    Generate Cards <i className="fas fa-magic"></i>
                                </button>
                            </motion.div>
                        )}

                        {step === 'loading' && (
                            <motion.div key="loading" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fc-loading-screen">
                                <div className="fc-spinner"></div>
                                <p>Brewing knowledge for <b>{topic}</b>...</p>
                            </motion.div>
                        )}

                        {step === 'playing' && (
                            <motion.div key="playing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fc-game-screen">
                                
                                {/* Progress Bar */}
                                <div className="fc-progress-bar">
                                    <div 
                                        className="fc-progress-fill" 
                                        style={{ width: `${((currentIndex + 1) / cards.length) * 100}%` }}
                                    ></div>
                                </div>

                                {/* Card Area (Shrinks if needed) */}
                                <div className="fc-card-container" onClick={() => setIsFlipped(!isFlipped)}>
                                    <motion.div 
                                        className="fc-card-inner"
                                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                                        transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                                    >
                                        {/* Front (Purple Gradient - White Text) */}
                                        <div className="fc-card-face fc-front">
                                            <span className="fc-label">QUESTION {currentIndex + 1}</span>
                                            <div className="fc-text-scroll">
                                                <p>{cards[currentIndex]?.front}</p>
                                            </div>
                                            <span className="fc-hint">Tap to Flip <i className="fas fa-sync-alt"></i></span>
                                        </div>

                                        {/* Back (White - Dark Text) */}
                                        <div className="fc-card-face fc-back">
                                            <span className="fc-label">ANSWER</span>
                                            <div className="fc-text-scroll">
                                                <p>{cards[currentIndex]?.back}</p>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Footer Controls (Fixed at Bottom) */}
                                <div className="fc-controls">
                                    <span className="fc-counter">{currentIndex + 1} / {cards.length}</span>
                                    <button className="fc-next-btn" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                                        {currentIndex === cards.length - 1 ? 'Finish' : 'Next Card'} 
                                        <i className={`fas ${currentIndex === cards.length - 1 ? 'fa-flag-checkered' : 'fa-arrow-right'}`}></i>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style>{`
                /* --- OVERLAY & MODAL --- */
                .fc-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(10px);
                    z-index: 100000; display: flex; align-items: center; justify-content: center;
                    padding: 20px;
                }
                
                /* Responsive Modal Sizing */
                .fc-modal {
                    width: 100%; max-width: 480px; 
                    height: 650px; max-height: 90vh; /* Desktop: 90% height */
                    background: #1e293b; border-radius: 24px;
                    display: flex; flex-direction: column; 
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.6);
                    border: 1px solid #334155;
                    overflow: hidden;
                }

                /* --- HEADER (Fixed Height) --- */
                .fc-header {
                    padding: 16px 20px; background: #0f172a; 
                    display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 1px solid #334155; 
                    flex-shrink: 0; /* Never shrink */
                    height: 70px;
                }
                .fc-header-title { color: white; font-weight: 700; display: flex; align-items: center; gap: 10px; font-size: 16px; }
                .fc-icon-bg {
                    width: 32px; height: 32px; background: linear-gradient(135deg, #f59e0b, #d97706);
                    border-radius: 8px; display: flex; align-items: center; justify-content: center; color: white; font-size: 14px;
                }
                .fc-close-btn { 
                    background: rgba(255,255,255,0.1); border: none; color: #94a3b8; 
                    width: 32px; height: 32px; border-radius: 50%; cursor: pointer; transition: 0.2s;
                }
                .fc-close-btn:hover { background: #ef4444; color: white; }
                
                /* --- BODY (Fills remaining space) --- */
                .fc-body { 
                    flex: 1; 
                    padding: 20px; 
                    display: flex; 
                    flex-direction: column; 
                    position: relative; 
                    overflow: hidden; 
                    min-height: 0; /* Allows children to shrink */
                }

                /* --- INPUT SCREEN --- */
                .fc-input-screen { 
                    text-align: center; color: white; height: 100%;
                    display: flex; flex-direction: column; justify-content: center;
                }
                .fc-hero-icon {
                    font-size: 40px; color: #8b5cf6; margin-bottom: 20px;
                    background: rgba(139, 92, 246, 0.1); width: 80px; height: 80px;
                    border-radius: 50%; display: flex; align-items: center; justify-content: center;
                    margin: 0 auto 20px auto;
                }
                .fc-input-screen h2 { font-size: 22px; margin: 0 0 10px 0; color: white; }
                .fc-input-screen p { color: #94a3b8; margin: 0 0 30px 0; font-size: 14px; line-height: 1.5; }
                
                .fc-topic-input { 
                    width: 100%; padding: 16px; border-radius: 14px; border: 2px solid #334155; 
                    background: #0f172a; color: white; font-size: 16px; margin-bottom: 15px; 
                    outline: none; transition: 0.2s; text-align: center;
                }
                .fc-topic-input:focus { border-color: #8b5cf6; background: #1e293b; }
                
                .fc-action-btn { 
                    width: 100%; padding: 16px; background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); 
                    border: none; border-radius: 14px; color: white; font-weight: 700; font-size: 16px; 
                    cursor: pointer; box-shadow: 0 4px 15px rgba(139, 92, 246, 0.4); transition: transform 0.1s;
                }
                .fc-action-btn:active { transform: scale(0.98); }
                .fc-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }

                /* --- LOADING --- */
                .fc-loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #cbd5e1; }
                .fc-spinner { 
                    width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.1); 
                    border-top-color: #d946ef; border-radius: 50%; animation: fc-spin 1s linear infinite; margin-bottom: 20px;
                }
                @keyframes fc-spin { 100% { transform: rotate(360deg); } }

                /* --- GAME SCREEN --- */
                .fc-game-screen { 
                    flex: 1; 
                    display: flex; 
                    flex-direction: column; 
                    height: 100%; 
                    min-height: 0; /* Crucial for shrinking */
                }
                
                .fc-progress-bar {
                    height: 6px; background: #334155; border-radius: 3px; margin-bottom: 15px; overflow: hidden; flex-shrink: 0;
                }
                .fc-progress-fill { height: 100%; background: #34d399; transition: width 0.3s; }

                /* CARD CONTAINER */
                .fc-card-container { 
                    flex: 1; /* Grow to fill space */
                    min-height: 0; /* Shrink if needed */
                    perspective: 1000px; 
                    cursor: pointer; 
                    position: relative; 
                    margin-bottom: 15px; 
                }
                
                .fc-card-inner { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; }
                
                .fc-card-face { 
                    position: absolute; width: 100%; height: 100%; backface-visibility: hidden; 
                    border-radius: 20px; padding: 25px; display: flex; flex-direction: column; 
                    align-items: center; justify-content: center; text-align: center; 
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
                }
                
                /* Front Card: Purple Gradient + WHITE TEXT */
                .fc-front { 
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); 
                    color: #ffffff !important; /* Forces White Text */
                }
                
                /* Back Card: White BG + Dark Text */
                .fc-back { 
                    background: #ffffff; 
                    color: #1e293b; 
                    transform: rotateY(180deg); 
                }
                
                /* Scrollable Text Area */
                .fc-text-scroll {
                    overflow-y: auto; 
                    max-height: 80%; 
                    width: 100%;
                    display: flex; align-items: center; justify-content: center;
                    -webkit-overflow-scrolling: touch;
                }
                
                /* Typography */
                .fc-card-face p { 
                    font-size: 20px; font-weight: 600; line-height: 1.5; margin: 0; 
                    color: inherit; /* Inherits white from parent */
                }
                
                /* Labels */
                .fc-label { 
                    position: absolute; top: 20px; font-size: 11px; letter-spacing: 1.5px; 
                    opacity: 0.8; font-weight: 800; text-transform: uppercase;
                    color: inherit;
                }
                
                .fc-hint { 
                    position: absolute; bottom: 20px; font-size: 12px; opacity: 0.8; 
                    animation: fc-bounce 2s infinite; font-weight: 500;
                    color: inherit;
                }
                @keyframes fc-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

                /* CONTROLS (Fixed Height Footer) */
                .fc-controls { 
                    display: flex; justify-content: space-between; align-items: center; 
                    flex-shrink: 0; /* Prevent collapsing */
                    height: 50px;
                }
                .fc-counter { color: #94a3b8; font-weight: 600; font-size: 14px; }
                
                .fc-next-btn { 
                    padding: 12px 24px; background: white; color: #1e293b; border: none; 
                    border-radius: 30px; font-weight: 700; cursor: pointer; 
                    display: flex; align-items: center; gap: 8px; font-size: 14px;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.3);
                    transition: transform 0.1s;
                }
                .fc-next-btn:active { transform: scale(0.95); }

                /* --- MOBILE SPECIFIC FIXES --- */
                @media (max-width: 600px) {
                    .fc-overlay { 
                        padding: 0; 
                        background: #1e293b;
                        align-items: flex-start; /* Stick to top */
                    }
                    .fc-modal { 
                        width: 100%; 
                        height: 100dvh; /* Exact viewport height */
                        max-height: none; 
                        border-radius: 0; 
                        border: none;
                        box-shadow: none;
                    }
                    .fc-header {
                        padding-top: max(15px, env(safe-area-inset-top)); /* Notch Support */
                        height: auto; min-height: 70px;
                    }
                    .fc-body {
                        padding-bottom: max(20px, env(safe-area-inset-bottom)); /* Home Bar Support */
                    }
                    .fc-card-face p { font-size: 18px; }
                    .fc-next-btn { width: auto; padding: 12px 20px; }
                }
            `}</style>
        </div>,
        document.body
    );
}