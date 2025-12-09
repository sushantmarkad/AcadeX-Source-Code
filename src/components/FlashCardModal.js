import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { doc, updateDoc, increment } from 'firebase/firestore';
import { db, auth } from '../firebase';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

export default function FlashCardModal({ isOpen, onClose, user, onComplete }) {
    const [cards, setCards] = useState([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isFlipped, setIsFlipped] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (isOpen && user) {
            fetchFlashcards();
        }
    }, [isOpen, user]);

    const fetchFlashcards = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${BACKEND_URL}/startInteractiveTask`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    taskType: 'FlashCard', 
                    userInterest: user.careerGoal || user.domain || 'Technology' 
                })
            });
            const data = await res.json();
            if (data.cards) setCards(data.cards);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleNext = () => {
        setIsFlipped(false);
        setTimeout(() => {
            if (currentIndex < cards.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                onComplete(30); // Award 30 XP on completion
            }
        }, 200);
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="custom-modal-overlay">
            <div className="custom-modal-box" style={{ maxWidth: '500px', height: '600px', display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                    <h3>📚 Rapid Revision</h3>
                    <button onClick={onClose} style={{ border: 'none', background: 'none', fontSize: '20px' }}>×</button>
                </div>

                {loading ? (
                    <div style={{ margin: 'auto' }}>
                        <div className="spinner"></div>
                        <p>Generating Cards...</p>
                    </div>
                ) : (
                    <div style={{ flex: 1, perspective: '1000px', cursor: 'pointer' }} onClick={() => setIsFlipped(!isFlipped)}>
                        <motion.div
                            initial={false}
                            animate={{ rotateY: isFlipped ? 180 : 0 }}
                            transition={{ duration: 0.6, animationDirection: 'normal' }}
                            style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
                        >
                            {/* FRONT */}
                            <div className="card" style={{
                                position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)', color: 'white',
                                borderRadius: '20px', padding: '30px', textAlign: 'center', fontSize: '24px', fontWeight: 'bold'
                            }}>
                                {cards[currentIndex]?.front}
                                <div style={{ position: 'absolute', bottom: 20, fontSize: '12px', opacity: 0.8 }}>Tap to Flip</div>
                            </div>

                            {/* BACK */}
                            <div className="card" style={{
                                position: 'absolute', width: '100%', height: '100%', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                background: '#fff', border: '2px solid #e2e8f0',
                                borderRadius: '20px', padding: '30px', textAlign: 'center', fontSize: '18px', color: '#1e293b'
                            }}>
                                {cards[currentIndex]?.back}
                            </div>
                        </motion.div>
                    </div>
                )}

                <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Card {currentIndex + 1} / {cards.length}</span>
                    <button className="btn-primary" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                        {currentIndex === cards.length - 1 ? 'Finish' : 'Next Card'} <i className="fas fa-arrow-right"></i>
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}