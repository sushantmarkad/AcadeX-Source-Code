import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import './ActivityModals.css'; 

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function FlashCardModal({ isOpen, onClose, user, onComplete }) {
    const [step, setStep] = useState('input'); // 'input', 'loading', 'playing', 'finished'
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
                body: JSON.stringify({ 
                    taskType: 'FlashCard', 
                    userInterest: topic.trim() 
                })
            });
            const data = await res.json();
            if (data.cards && data.cards.length > 0) {
                setCards(data.cards);
                setStep('playing');
            } else {
                alert("Could not generate cards. Try a different topic.");
                setStep('input');
            }
        } catch (e) {
            console.error(e);
            alert("Error connecting to AI.");
            setStep('input');
        }
    };

    const handleNext = () => {
        setIsFlipped(false);
        setTimeout(() => {
            if (currentIndex < cards.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                onComplete(30); 
                onClose();
            }
        }, 200);
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="activity-modal-overlay">
            <motion.div 
                className="activity-modal-card flashcard-modal-size"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
            >
                <div className="modal-header">
                    <h3>📚 Rapid Revision</h3>
                    <button onClick={onClose} className="close-btn">×</button>
                </div>

                <div className="flashcard-body">
                    {step === 'input' && (
                        <div className="topic-input-container">
                            <h4>What do you want to revise?</h4>
                            <p>Enter a topic, and AI will generate flashcards instantly.</p>
                            <input 
                                type="text" 
                                placeholder="e.g. React Hooks, Thermodynamics, History of India..." 
                                value={topic}
                                onChange={(e) => setTopic(e.target.value)}
                                className="topic-input"
                                autoFocus
                            />
                            <button 
                                className="btn-submit" 
                                onClick={handleGenerate}
                                disabled={!topic.trim()}
                            >
                                Generate Cards
                            </button>
                        </div>
                    )}

                    {step === 'loading' && (
                        <div className="loading-container">
                            <div className="spinner"></div>
                            <p>Generating smart flashcards for <b>"{topic}"</b>...</p>
                        </div>
                    )}

                    {step === 'playing' && (
                        <div className="flashcard-game-container">
                            <div className="card-perspective" onClick={() => setIsFlipped(!isFlipped)}>
                                <motion.div
                                    className="flashcard-inner"
                                    initial={false}
                                    animate={{ rotateY: isFlipped ? 180 : 0 }}
                                    transition={{ duration: 0.6, type: "spring", stiffness: 260, damping: 20 }}
                                >
                                    {/* FRONT */}
                                    <div className="flashcard-face flashcard-front">
                                        <span className="card-label">QUESTION</span>
                                        <p>{cards[currentIndex]?.front}</p>
                                        <div className="tap-hint">Tap to Flip 👆</div>
                                    </div>

                                    {/* BACK */}
                                    <div className="flashcard-face flashcard-back">
                                        <span className="card-label">ANSWER</span>
                                        <p>{cards[currentIndex]?.back}</p>
                                    </div>
                                </motion.div>
                            </div>

                            <div className="flashcard-controls">
                                <span className="progress-text">Card {currentIndex + 1} / {cards.length}</span>
                                <button className="btn-submit" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                                    {currentIndex === cards.length - 1 ? 'Finish Set' : 'Next Card'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </motion.div>
        </div>,
        document.body
    );
}