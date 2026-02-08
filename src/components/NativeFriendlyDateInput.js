import React from 'react';
import { Capacitor } from '@capacitor/core';
import { DatePicker } from '@capacitor-community/date-picker';

const pad = (value) => String(value).padStart(2, '0');

const normalizeToYMD = (value) => {
    if (!value) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';

    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
};

const formatForDisplay = (value) => {
    const normalized = normalizeToYMD(value);
    if (!normalized) return 'Select date';

    const [year, month, day] = normalized.split('-').map(Number);
    const localDate = new Date(year, month - 1, day);
    return localDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function NativeFriendlyDateInput({ value, onChange, required = false, min, max, className, style }) {
    const now = new Date();
    const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const selectedDate = normalizeToYMD(value) || today;

    const openNativeDatePicker = async () => {
        try {
            const { value: pickedValue } = await DatePicker.present({
                mode: 'date',
                locale: 'en_GB',
                format: 'yyyy-MM-dd',
                date: selectedDate,
                theme: 'light',
                android: {
                    calendar: true,
                    is24Hour: false
                }
            });

            const normalized = normalizeToYMD(pickedValue);
            if (normalized) onChange(normalized);
        } catch (error) {
            console.log('Native date picker was dismissed or unavailable.', error);
        }
    };

    const commonStyle = {
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        background: 'white',
        border: '1px solid #cbd5e1',
        borderRadius: '12px',
        height: '48px',
        padding: '0 12px',
        color: '#334155',
        fontWeight: 600,
        cursor: 'pointer',
        overflow: 'hidden',
        ...style
    };

    return (
        <div
            className={className}
            style={commonStyle}
            onClick={Capacitor.isNativePlatform() ? openNativeDatePicker : undefined}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
                if (Capacitor.isNativePlatform() && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault();
                    openNativeDatePicker();
                }
            }}
        >
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {formatForDisplay(selectedDate)}
            </span>
            <i className="fas fa-calendar-alt" style={{ color: '#64748b', flexShrink: 0 }}></i>

            {!Capacitor.isNativePlatform() && (
                <input
                    type="date"
                    required={required}
                    value={selectedDate}
                    min={min}
                    max={max}
                    onChange={(e) => onChange(e.target.value)}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        opacity: 0,
                        cursor: 'pointer'
                    }}
                />
            )}
        </div>
    );
}