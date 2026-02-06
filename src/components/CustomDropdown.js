import React, { useState, useRef, useEffect } from 'react';

const CustomDropdown = ({ options, value, onChange, placeholder = "Select...", disabled = false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown if clicked outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    const handleSelect = (optionValue) => {
        onChange(optionValue);
        setIsOpen(false);
    };

    return (
        <div 
            className="custom-dropdown-container" 
            ref={dropdownRef} 
            style={{ position: 'relative', width: '100%' }}
        >
            {/* The Box */}
            <div 
                onClick={() => !disabled && setIsOpen(!isOpen)}
                style={{
                    padding: '12px 15px',
                    background: disabled ? '#f1f5f9' : '#ffffff',
                    border: isOpen ? '2px solid #3b82f6' : '1px solid #cbd5e1',
                    borderRadius: '10px',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    transition: 'all 0.2s ease',
                    minHeight: '46px'
                }}
            >
                <span style={{ 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: selectedOption ? '#334155' : '#94a3b8',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                }}>
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <i className={`fas fa-chevron-down`} 
                   style={{ 
                       color: isOpen ? '#3b82f6' : '#94a3b8', 
                       fontSize: '12px',
                       transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                       transition: 'transform 0.2s ease'
                   }}
                ></i>
            </div>

            {/* The Menu */}
            {isOpen && (
                <div style={{
                    position: 'absolute',
                    top: '110%',
                    left: 0,
                    right: 0,
                    background: 'white',
                    borderRadius: '10px',
                    boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1), 0 0 0 1px rgba(0,0,0,0.05)',
                    zIndex: 1000,
                    maxHeight: '250px',
                    overflowY: 'auto',
                    animation: 'fadeIn 0.2s ease-out'
                }}>
                    {options.length > 0 ? (
                        options.map((opt) => (
                            <div 
                                key={opt.value}
                                onClick={() => handleSelect(opt.value)}
                                style={{
                                    padding: '12px 15px',
                                    fontSize: '14px',
                                    color: value === opt.value ? '#2563eb' : '#475569',
                                    background: value === opt.value ? '#eff6ff' : 'transparent',
                                    fontWeight: value === opt.value ? '700' : '500',
                                    cursor: 'pointer',
                                    borderBottom: '1px solid #f8fafc',
                                    transition: 'background 0.1s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = value === opt.value ? '#eff6ff' : '#f8fafc'}
                                onMouseLeave={(e) => e.target.style.background = value === opt.value ? '#eff6ff' : 'transparent'}
                            >
                                {opt.label}
                            </div>
                        ))
                    ) : (
                        <div style={{ padding: '15px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                            No options
                        </div>
                    )}
                </div>
            )}
            
            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-5px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default CustomDropdown;