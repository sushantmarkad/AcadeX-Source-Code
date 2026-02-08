import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import toast from 'react-hot-toast';
import { Capacitor } from '@capacitor/core';

export const usePushNotifications = () => {
    useEffect(() => {
        const registerNotifications = async () => {
            // ✅ SAFETY CHECK: Inside the effect, so it's safe for Web
            if (!Capacitor.isNativePlatform()) {
                console.log("🔔 Push Notifications disabled on Web");
                return;
            }

            try {
                let permStatus = await PushNotifications.checkPermissions();
                if (permStatus.receive === 'prompt') {
                    permStatus = await PushNotifications.requestPermissions();
                }
                if (permStatus.receive !== 'granted') return;

                await PushNotifications.register();

                PushNotifications.addListener('registration', async (token) => {
                    if (auth.currentUser) {
                        await updateDoc(doc(db, "users", auth.currentUser.uid), {
                            fcmToken: token.value
                        });
                    }
                });

                // ✅ UPDATED: Professional Notification Layout
                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    const { title, body, data } = notification;
                    const postedBy = data?.postedBy || 'AcadeX Admin'; // Captures sender name

                    toast.custom((t) => (
                        <div
                            className={`${
                                t.visible ? 'animate-enter' : 'animate-leave'
                            }`}
                            style={{
                                maxWidth: '380px',
                                width: '100%',
                                background: '#ffffff',
                                borderRadius: '12px',
                                boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
                                border: '1px solid #e2e8f0',
                                borderLeft: '5px solid #2563eb', // Professional Blue Accent
                                overflow: 'hidden',
                                fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
                                pointerEvents: 'auto',
                                cursor: 'pointer'
                            }}
                            onClick={() => toast.dismiss(t.id)} // Click entire card to dismiss
                        >
                            {/* --- HEADER --- */}
                            <div style={{
                                padding: '12px 16px',
                                background: '#f8fafc',
                                borderBottom: '1px solid #f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between'
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ fontSize: '16px' }}>📢</span>
                                    <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '14px', letterSpacing: '0.3px' }}>
                                        {title || 'New Notice'}
                                    </span>
                                </div>
                                <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600', textTransform: 'uppercase' }}>NOW</span>
                            </div>

                            {/* --- BODY --- */}
                            <div style={{
                                padding: '16px',
                                color: '#334155',
                                fontSize: '13px',
                                lineHeight: '1.5',
                                background: 'white'
                            }}>
                                {body}
                            </div>

                            {/* --- FOOTER (Context) --- */}
                            <div style={{
                                padding: '8px 16px',
                                background: '#f8fafc',
                                borderTop: '1px solid #f1f5f9',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                            }}>
                                <span style={{ fontSize: '11px', color: '#64748b' }}>
                                    <i className="fas fa-user-circle" style={{ marginRight: '5px', color: '#2563eb' }}></i>
                                    {postedBy}
                                </span>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: '#2563eb' }}>Tap to Close</span>
                            </div>
                        </div>
                    ), {
                        duration: 6000, // Show for 6 seconds
                        position: 'top-center', // Easier to see on mobile
                    });
                });

            } catch (error) {
                console.warn("Push Notification Setup Failed:", error);
            }
        };

        registerNotifications();
    }, []);
};