import React, { useState, useEffect, useRef } from 'react';
import ReactDOM from 'react-dom';
import toast, { Toaster } from 'react-hot-toast';

// ✅ CONFIRM YOUR BACKEND URL
const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com";

const FALLBACK_TEXTS = [
    // Programming & Technology (10)
    "The art of debugging is figuring out what you really told your program to do rather than what you thought you told it to do.",
    "Technology is best when it brings people together. It is the driving force of the future.",
    "First, solve the problem. Then, write the code. Programming is not about typing, it is about thinking.",
    "Artificial Intelligence is not a substitute for human intelligence; it is a tool to amplify human creativity and ingenuity.",
    "React makes it painless to create interactive UIs. Design simple views for each state in your application and React will efficiently update and render the right components.",
    "Simplicity is the soul of efficiency. Good code is its own best documentation.",
    "Code is like humor. When you have to explain it, it's bad.",
    "Java is to JavaScript what car is to Carpet.",
    "The best error message is the one that never shows up. Good developers anticipate problems before they occur.",
    "Any fool can write code that a computer can understand. Good programmers write code that humans can understand.",
    
    // Inspirational & Wisdom (10)
    "The only way to do great work is to love what you do. If you haven't found it yet, keep looking. Don't settle.",
    "Success is not final, failure is not fatal. It is the courage to continue that counts in this ever-changing world.",
    "Innovation distinguishes between a leader and a follower. Always strive to be the one who creates new paths.",
    "The future belongs to those who believe in the beauty of their dreams and work tirelessly to achieve them.",
    "Don't watch the clock; do what it does. Keep going and never give up on your aspirations.",
    "Believe you can and you're halfway there. Confidence is the first step towards achieving any goal.",
    "The only impossible journey is the one you never start. Take that first step today.",
    "Your time is limited, so don't waste it living someone else's life. Be authentic and true to yourself.",
    "Quality is not an act, it is a habit. Excellence comes from consistent effort and dedication.",
    "The way to get started is to quit talking and begin doing. Action is the foundational key to all success.",
    
    // Science & Learning (10)
    "Science is not only a disciple of reason but also one of romance and passion. It reveals the beauty hidden in nature.",
    "The important thing is not to stop questioning. Curiosity has its own reason for existing and drives all discovery.",
    "Education is the most powerful weapon which you can use to change the world and shape the future.",
    "Learning never exhausts the mind. Every new piece of knowledge opens doors to endless possibilities.",
    "The beautiful thing about learning is that no one can take it away from you. It's a lifelong treasure.",
    "In the middle of difficulty lies opportunity. Challenges are simply invitations to grow stronger and wiser.",
    "The greatest enemy of knowledge is not ignorance, it is the illusion of knowledge. Stay humble and keep learning.",
    "Research is what I'm doing when I don't know what I'm doing. Exploration leads to unexpected discoveries.",
    "The more you learn, the more you realize how much you don't know. Knowledge expands infinitely.",
    "Logic will get you from A to B. Imagination will take you everywhere beyond your wildest dreams.",
    
    // Business & Productivity (10)
    "The way to get started is to quit talking and begin doing. Procrastination is the enemy of progress.",
    "Don't be afraid to give up the good to go for the great. Settle for nothing less than excellence.",
    "I find that the harder I work, the more luck I seem to have. Success is preparation meeting opportunity.",
    "Success usually comes to those who are too busy to be looking for it. Focus on the work, not the reward.",
    "Opportunities don't happen. You create them through persistence, hard work, and determination.",
    "The only place where success comes before work is in the dictionary. There are no shortcuts to greatness.",
    "If you really look closely, most overnight successes took a long time. Patience and persistence pay off.",
    "The road to success and the road to failure are almost exactly the same. The difference is in the execution.",
    "The secret of change is to focus all of your energy not on fighting the old, but on building the new.",
    "Don't let yesterday take up too much of today. Learn from the past but live in the present moment.",
    
    // Literature & Philosophy (10)
    "To be yourself in a world that is constantly trying to make you something else is the greatest accomplishment.",
    "It is our choices that show what we truly are, far more than our abilities ever could reveal.",
    "The only true wisdom is in knowing you know nothing. Humility is the foundation of all learning.",
    "We are what we repeatedly do. Excellence, then, is not an act but a habit that we cultivate daily.",
    "Life is what happens when you're busy making other plans. Embrace the unexpected and stay flexible.",
    "The unexamined life is not worth living. Reflection and self-awareness lead to personal growth.",
    "Happiness is not something ready made. It comes from your own actions and the choices you make.",
    "In three words I can sum up everything I've learned about life: it goes on, no matter what happens.",
    "The journey of a thousand miles begins with a single step. Start where you are with what you have.",
    "Twenty years from now you will be more disappointed by the things you didn't do than by the ones you did.",
    
    // Modern Tech & Digital Age (10)
    "Data is the new oil. It's valuable, but if unrefined it cannot really be used for anything meaningful.",
    "Cloud computing is not just a technology trend, it's fundamentally changing how we build and deploy software.",
    "Machine learning is the science of getting computers to learn without being explicitly programmed for every task.",
    "Cybersecurity is much more than a matter of IT. It's about protecting the very fabric of our digital society.",
    "The Internet of Things is about creating an intelligent, invisible network of connected devices everywhere.",
    "Blockchain technology has the potential to revolutionize how we think about trust and transparency online.",
    "Open source software has become the backbone of modern innovation, powering everything from phones to servers.",
    "User experience design is not just about making things look pretty, it's about solving real human problems.",
    "Version control systems like Git have transformed how teams collaborate on code across the globe.",
    "The mobile-first approach recognizes that smartphones have become the primary computing device for billions of people.",
    
    // Creative & Arts (5)
    "Creativity is intelligence having fun. Let your imagination run wild and explore new possibilities.",
    "Every artist was first an amateur. The key is to start creating and never stop improving your craft.",
    "Art is not what you see, but what you make others see through your unique creative vision.",
    "The purpose of art is washing the dust of daily life off our souls and revealing deeper truths.",
    "Creativity takes courage. Don't be afraid to express yourself and share your unique perspective with the world.",
    
    // Environmental & Future (5)
    "The greatest threat to our planet is the belief that someone else will save it. We must all take action.",
    "We do not inherit the earth from our ancestors; we borrow it from our children and must protect it.",
    "Climate change is no longer some far-off problem; it is happening here, it is happening now.",
    "Renewable energy is not just good for the environment, it's becoming the smartest economic choice.",
    "Sustainability is not a trend, it's a necessity for the survival and prosperity of future generations."
];

export default function TypingTestModal({ isOpen, onClose, task, user, onComplete }) {
    const [targetText, setTargetText] = useState("");
    const [userInput, setUserInput] = useState("");
    const [startTime, setStartTime] = useState(null);
    
    // 📊 Stats State
    const [wpm, setWpm] = useState(0);
    const [accuracy, setAccuracy] = useState(100);
    const [elapsedTime, setElapsedTime] = useState(0);

    const [isFinished, setIsFinished] = useState(false);
    const [loading, setLoading] = useState(false);
    
    const inputRef = useRef(null);
    const timerRef = useRef(null);

    // 🔄 Initialization
    useEffect(() => {
        if (isOpen) {
            initializeTest();
        }
        return () => stopTimer();
    }, [isOpen, task]);

    // ⏱️ Timer Logic
    useEffect(() => {
        if (startTime && !isFinished) {
            timerRef.current = setInterval(() => {
                const now = Date.now();
                const diffSeconds = Math.floor((now - startTime) / 1000);
                setElapsedTime(diffSeconds);
                
                // Live WPM Calc (Prevent divide by zero)
                if (diffSeconds > 0) {
                    const wordsTyped = userInput.length / 5;
                    const currentWpm = Math.round(wordsTyped / (diffSeconds / 60));
                    setWpm(currentWpm);
                }
            }, 1000);
        }
        return () => clearInterval(timerRef.current);
    }, [startTime, isFinished, userInput]);

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
    };

    const initializeTest = () => {
        let textToType = task?.content?.targetText || task?.content?.textToType;
        if (!textToType || textToType.length < 10) {
            textToType = getRandomFallback();
        }
        resetState(textToType);
    };

    const getRandomFallback = () => {
        const randomIndex = Math.floor(Math.random() * FALLBACK_TEXTS.length);
        return FALLBACK_TEXTS[randomIndex];
    };

    const resetState = (text) => {
        setTargetText(text);
        setUserInput("");
        setStartTime(null);
        setWpm(0);
        setAccuracy(100);
        setElapsedTime(0);
        setIsFinished(false);
        setLoading(false);
        stopTimer();
        setTimeout(() => inputRef.current?.focus(), 100);
    };

    const handleRegenerate = async () => {
        setLoading(true);
        stopTimer();
        try {
            if (user?.careerGoal) {
                const res = await fetch(`${BACKEND_URL}/startInteractiveTask`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        taskType: 'Typing', 
                        userInterest: user.careerGoal 
                    })
                });
                const data = await res.json();
                if (data.textToType) {
                    resetState(data.textToType);
                    toast.success("New text generated!", { icon: '✨' });
                    return;
                }
            }
            throw new Error("No AI text");
        } catch (err) {
            const newText = getRandomFallback();
            resetState(newText);
            toast("Shuffled local quotes", { icon: '🔀' });
        } finally {
            setLoading(false);
        }
    };

    // ✅ FIXED FOR MOBILE: Use onChange instead of onKeyDown
    const handleChange = (e) => {
        if (isFinished || !isOpen || loading) return;

        const val = e.target.value;

        // Start Timer on first character
        if (!startTime && val.length === 1) {
            setStartTime(Date.now());
        }

        // Only allow typing up to the target length
        if (val.length <= targetText.length) {
            setUserInput(val);
            calculateAccuracy(val);

            // Finish Test
            if (val.length === targetText.length) {
                finishTest(val);
            }
        }
    };

    const calculateAccuracy = (inputVal) => {
        if (inputVal.length === 0) {
            setAccuracy(100);
            return;
        }
        let correctChars = 0;
        for (let i = 0; i < inputVal.length; i++) {
            if (inputVal[i] === targetText[i]) correctChars++;
        }
        const acc = Math.round((correctChars / inputVal.length) * 100);
        setAccuracy(acc);
    };

    const finishTest = (finalInput) => {
        stopTimer();
        setIsFinished(true);
        const endTime = Date.now();
        const durationInMinutes = (endTime - startTime) / 60000;

        // Final Precise Calculation
        const grossWpm = durationInMinutes > 0 ? Math.round((finalInput.length / 5) / durationInMinutes) : 0;
        setWpm(grossWpm);

        let earnedXp = 10;
        if (grossWpm > 30 && accuracy > 90) earnedXp = 50;
        else if (grossWpm > 20) earnedXp = 20;

        toast.success(`Finished! ${grossWpm} WPM`, { icon: '🚀' });
        
        if (onComplete) {
            setTimeout(() => onComplete(earnedXp), 1500);
        }
    };

    // 🎨 Render Helper: Colored Text
    const renderText = () => {
        return targetText.split('').map((char, index) => {
            let color = '#64748b'; // Default Grey
            let bg = 'transparent';
            let isCurrent = index === userInput.length;

            if (index < userInput.length) {
                if (userInput[index] === char) {
                    color = '#e2e8f0'; // White (Correct)
                } else {
                    color = '#ef4444'; // Red (Wrong)
                }
            }

            return (
                <span key={index} style={{ color, background: bg, position: 'relative' }}>
                    {isCurrent && !isFinished && !loading && (
                        <span style={{
                            position: 'absolute', left: '-1px', top: '10%', height: '80%', width: '2px', 
                            background: '#eab308', animation: 'blink 1s infinite'
                        }}></span>
                    )}
                    {char}
                </span>
            );
        });
    };

    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <>
            {/* Toast Container with High Z-Index */}
            <Toaster 
                position="top-center"
                toastOptions={{
                    style: {
                        zIndex: 100001,
                    },
                }}
                containerStyle={{
                    zIndex: 100001,
                }}
            />
            
            <div className="custom-modal-overlay" onClick={onClose} style={{backdropFilter: 'blur(8px)', background: 'rgba(15, 23, 42, 0.95)'}}>
            
            <input 
                ref={inputRef}
                type="text"
                value={userInput}
                onChange={handleChange} 
                style={{
                    opacity: 0, 
                    position: 'absolute', 
                    top: 0, 
                    left: 0, 
                    height: '100%', 
                    width: '100%',
                    fontSize: '16px' // 🚀 Prevents iOS Zoom
                }}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
            />

            <div 
                className="custom-modal-box" 
                onClick={(e) => { e.stopPropagation(); inputRef.current?.focus(); }}
                style={{
                    maxWidth: '900px', width: '90%', 
                    background: '#1e293b', border: '1px solid #334155', 
                    color: 'white', textAlign: 'center', padding: '40px',
                    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
                }}
            >
                {/* 📊 Header Stats (Live Updates) */}
                <div style={{marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                    
                    {/* Live Stats */}
                    <div style={{display:'flex', gap:'30px', opacity: startTime ? 1 : 0.5, transition:'0.3s'}}>
                        <div style={{textAlign:'left'}}>
                            <div style={{fontSize:'12px', color:'#94a3b8', fontWeight:'bold'}}>TIME</div>
                            <div style={{fontSize:'24px', color:'#eab308', fontFamily:'monospace'}}>{elapsedTime}s</div>
                        </div>
                        <div style={{textAlign:'left'}}>
                            <div style={{fontSize:'12px', color:'#94a3b8', fontWeight:'bold'}}>WPM</div>
                            <div style={{fontSize:'24px', color:'#eab308', fontFamily:'monospace'}}>{wpm}</div>
                        </div>
                    </div>

                    <div style={{display:'flex', gap:'15px'}}>
                        <button 
                            onClick={handleRegenerate} 
                            disabled={loading}
                            title="Generate New Text"
                            style={{
                                background: '#334155', border: 'none', color: 'white', 
                                width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.2s'
                            }}
                        >
                            <i className={`fas fa-sync-alt ${loading ? 'fa-spin' : ''}`}></i>
                        </button>
                        <button onClick={onClose} style={{background: 'transparent', border: 'none', color: '#64748b', fontSize: '28px', cursor: 'pointer'}}>×</button>
                    </div>
                </div>

                {/* 📝 Typing Area */}
                {!isFinished ? (
                    <div style={{
                        fontSize: '28px', lineHeight: '1.6', fontFamily: '"Fira Code", monospace', 
                        textAlign: 'justify', outline: 'none', cursor: 'text', minHeight: '150px',
                        opacity: loading ? 0.5 : 1, transition: '0.3s'
                    }}>
                        {loading ? "Generating new text..." : renderText()}
                    </div>
                ) : (
                    /* 🏆 Results Screen */
                    <div style={{animation: 'fadeIn 0.5s ease'}}>
                        <div style={{display: 'flex', justifyContent: 'center', gap: '40px', marginBottom: '30px'}}>
                            <div style={{textAlign: 'center'}}>
                                <div style={{fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px'}}>WPM</div>
                                <div style={{fontSize: '60px', fontWeight: '800', color: '#eab308'}}>{wpm}</div>
                            </div>
                            <div style={{textAlign: 'center'}}>
                                <div style={{fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px'}}>Accuracy</div>
                                <div style={{fontSize: '60px', fontWeight: '800', color: accuracy >= 90 ? '#22c55e' : '#f43f5e'}}>
                                    {accuracy}%
                                </div>
                            </div>
                            <div style={{textAlign: 'center'}}>
                                <div style={{fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px'}}>Time</div>
                                <div style={{fontSize: '60px', fontWeight: '800', color: '#3b82f6'}}>{elapsedTime}s</div>
                            </div>
                        </div>

                        <div style={{height: '1px', background: '#334155', width: '100%', marginBottom: '30px'}}></div>

                        <div style={{display: 'flex', justifyContent: 'center', gap: '15px'}}>
                            <button onClick={() => { resetState(targetText); }} style={{background: '#334155', color: 'white', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer'}}>
                                <i className="fas fa-redo"></i> Retry
                            </button>
                            <button onClick={handleRegenerate} style={{background: '#eab308', color: '#0f172a', padding: '12px 25px', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer'}}>
                                <i className="fas fa-step-forward"></i> Next Test
                            </button>
                        </div>
                    </div>
                )}

                {/* Footer Instructions */}
                {!isFinished && !loading && (
                    <div style={{marginTop: '40px', color: '#64748b', fontSize: '13px'}}>
                        <i className="fas fa-keyboard"></i> Focus is locked. Just start typing.
                    </div>
                )}

            </div>
            </div>
        </>,
        document.body
    );
}