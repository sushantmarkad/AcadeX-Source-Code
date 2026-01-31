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
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
            >
                {/* Header */}
                <div className="fc-header">
                    <div className="fc-header-title">
                        <i className="fas fa-bolt"></i> <span>FlashCards</span>
                    </div>
                    <button onClick={onClose} className="fc-close-btn"><i className="fas fa-times"></i></button>
                </div>

                {/* Body */}
                <div className="fc-body">
                    <AnimatePresence mode='wait'>
                        {step === 'input' && (
                            <motion.div key="input" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fc-input-screen">
                                <h2>What do you want to master?</h2>
                                <p>Enter a topic below to generate smart cards.</p>
                                <input 
                                    type="text" 
                                    placeholder="e.g. Organic Chemistry, Java Loops..." 
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
                                <p>Crafting cards for <b>{topic}</b>...</p>
                            </motion.div>
                        )}

                        {step === 'playing' && (
                            <motion.div key="playing" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} className="fc-game-screen">
                                <div className="fc-card-container" onClick={() => setIsFlipped(!isFlipped)}>
                                    <motion.div 
                                        className="fc-card-inner"
                                        animate={{ rotateY: isFlipped ? 180 : 0 }}
                                        transition={{ duration: 0.5 }}
                                    >
                                        {/* Front */}
                                        <div className="fc-card-face fc-front">
                                            <span className="fc-label">QUESTION</span>
                                            <p>{cards[currentIndex]?.front}</p>
                                            <span className="fc-hint">Tap to Flip <i className="fas fa-hand-pointer"></i></span>
                                        </div>

                                        {/* Back */}
                                        <div className="fc-card-face fc-back">
                                            <span className="fc-label">ANSWER</span>
                                            <p>{cards[currentIndex]?.back}</p>
                                        </div>
                                    </motion.div>
                                </div>

                                <div className="fc-controls">
                                    <span>{currentIndex + 1} / {cards.length}</span>
                                    <button className="fc-next-btn" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                                        {currentIndex === cards.length - 1 ? 'Finish' : 'Next'} <i className="fas fa-arrow-right"></i>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            <style>{`
                .fc-overlay {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(8px);
                    z-index: 10000; display: flex; align-items: center; justify-content: center;
                }
                .fc-modal {
                    width: 90%; max-width: 500px; height: 70vh; max-height: 700px;
                    background: #1e293b; border-radius: 24px;
                    display: flex; flex-direction: column; overflow: hidden;
                    box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);
                    border: 1px solid #334155;
                }
                .fc-header {
                    padding: 15px 20px; background: #0f172a; display: flex; justify-content: space-between; align-items: center;
                    border-bottom: 1px solid #334155;
                }
                .fc-header-title { color: white; font-weight: 700; display: flex; align-items: center; gap: 8px; font-size: 16px; }
                .fc-header-title i { color: #facc15; }
                .fc-close-btn { background: #334155; border: none; color: white; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; }
                
                .fc-body { flex: 1; padding: 20px; display: flex; flex-direction: column; position: relative; }

                /* Input Screen */
                .fc-input-screen { text-align: center; color: white; padding-top: 40px; }
                .fc-input-screen h2 { font-size: 24px; margin-bottom: 10px; }
                .fc-input-screen p { color: #94a3b8; margin-bottom: 30px; }
                .fc-topic-input { 
                    width: 100%; padding: 16px; border-radius: 12px; border: 2px solid #475569; 
                    background: #0f172a; color: white; font-size: 16px; margin-bottom: 20px; outline: none; box-sizing: border-box;
                }
                .fc-topic-input:focus { border-color: #8b5cf6; }
                .fc-action-btn { 
                    width: 100%; padding: 16px; background: linear-gradient(135deg, #8b5cf6 0%, #d946ef 100%); 
                    border: none; border-radius: 12px; color: white; font-weight: 700; font-size: 16px; cursor: pointer; 
                }

                /* Loading */
                .fc-loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #cbd5e1; }
                .fc-spinner { 
                    width: 50px; height: 50px; border: 4px solid rgba(255,255,255,0.1); 
                    border-top-color: #d946ef; border-radius: 50%; animation: fc-spin 1s linear infinite; margin-bottom: 20px;
                }
                @keyframes fc-spin { 100% { transform: rotate(360deg); } }

                /* Game Screen */
                .fc-game-screen { flex: 1; display: flex; flex-direction: column; height: 100%; }
                .fc-card-container { flex: 1; perspective: 1000px; cursor: pointer; position: relative; margin-bottom: 20px; }
                .fc-card-inner { width: 100%; height: 100%; position: relative; transform-style: preserve-3d; }
                
                .fc-card-face { 
                    position: absolute; width: 100%; height: 100%; backface-visibility: hidden; 
                    border-radius: 20px; padding: 30px; display: flex; flex-direction: column; 
                    align-items: center; justify-content: center; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                }
                .fc-front { background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%); color: white; }
                .fc-back { background: white; color: #1e293b; transform: rotateY(180deg); }
                .fc-card-face p { font-size: 22px; font-weight: 600; line-height: 1.5; }
                .fc-label { position: absolute; top: 20px; font-size: 11px; letter-spacing: 2px; opacity: 0.7; font-weight: bold; }
                .fc-hint { position: absolute; bottom: 20px; font-size: 13px; opacity: 0.8; animation: fc-bounce 2s infinite; }
                @keyframes fc-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

                .fc-controls { display: flex; justify-content: space-between; align-items: center; color: #94a3b8; }
                .fc-next-btn { 
                    padding: 10px 24px; background: white; color: #1e293b; border: none; 
                    border-radius: 30px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;
                }

                @media (max-width: 600px) {
                    .fc-modal { width: 100%; height: 100%; border-radius: 0; max-height: none; }
                    .fc-header { padding-top: 40px; /* Safe area */ }
                }
            `}</style>
        </div>,
        document.body
    );
}