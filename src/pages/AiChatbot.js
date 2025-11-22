import React, { useState, useRef, useEffect } from 'react';
import './AiChatbot.css';

const API_URL = "https://acadex-backend-n2wh.onrender.com/chat"; 

// ✅ Added isOpenProp and onClose to props
export default function AiChatbot({ user, isOpenProp, onClose }) {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { sender: 'bot', text: `Hey ${user.firstName}! Free period? I can generate a quick task list for ${user.department}. Say "Go"` }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    // ✅ Effect: Open chat when "Ask AI" button is clicked in Dashboard
    useEffect(() => {
        if (isOpenProp) {
            setIsOpen(true);
        }
    }, [isOpenProp]);

    const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    useEffect(scrollToBottom, [messages]);

    const handleSend = async () => {
        if (!input.trim()) return;

        const userMessage = { sender: 'user', text: input };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    message: input,
                    userContext: {
                        firstName: user.firstName,
                        role: user.role,
                        department: user.department
                    }
                })
            });

            if (!response.ok) throw new Error(`Server error: ${response.status}`);

            const data = await response.json();
            setMessages(prev => [...prev, { sender: 'bot', text: data.reply }]);

        } catch (error) {
            console.error("Chat Error:", error);
            setMessages(prev => [...prev, { sender: 'bot', text: "My brain is buffering... (Check API Key on Render)" }]);
        } finally {
            setLoading(false);
        }
    };

    // ✅ Handle closing properly (updates parent state too)
    const toggleChat = () => {
        const newState = !isOpen;
        setIsOpen(newState);
        if (!newState && onClose) {
            onClose(); // Tell dashboard we closed it
        }
    };

    return (
        <>
            {/* Floating Button with Toggle */}
            <div className={`ai-fab ${isOpen ? 'open' : ''}`} onClick={toggleChat}>
                {isOpen ? <i className="fas fa-times"></i> : <i className="fas fa-robot"></i>}
            </div>

            {isOpen && (
                <div className="ai-chat-window">
                    <div className="ai-header">
                        <div style={{display:'flex', alignItems:'center', gap:'10px'}}>
                            <div style={{background:'rgba(255,255,255,0.2)', padding:'5px', borderRadius:'50%'}}>
                                <i className="fas fa-brain"></i>
                            </div>
                            <div>
                                <h3 style={{margin:0, fontSize:'16px'}}>AcadeX Mentor</h3>
                                <span style={{fontSize:'10px', opacity:0.8}}>Powered by AI</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="ai-messages">
                        {messages.map((msg, idx) => (
                            <div key={idx} className={`message-bubble ${msg.sender}`}>
                                {msg.text.split('\n').map((line, i) => <div key={i}>{line}</div>)}
                            </div>
                        ))}
                        {loading && (
                            <div className="message-bubble bot">
                                <span className="typing-dot"></span>
                                <span className="typing-dot"></span>
                                <span className="typing-dot"></span>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    <div className="ai-input-area">
                        <input 
                            type="text" 
                            placeholder="Type a message..." 
                            value={input} 
                            onChange={(e) => setInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                            disabled={loading}
                        />
                        <button onClick={handleSend} disabled={loading}>
                            <i className="fas fa-paper-plane"></i>
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}