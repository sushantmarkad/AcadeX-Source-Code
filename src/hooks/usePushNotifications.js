import { useEffect } from 'react';
import { PushNotifications } from '@capacitor/push-notifications';
import { Device } from '@capacitor/device';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, auth } from '../firebase';
import toast from 'react-hot-toast';

const BACKEND_URL = "https://acadex-backend-n2wh.onrender.com"; 

export const usePushNotifications = () => {
    useEffect(() => {
        const registerNotifications = async () => {
            // Only run on mobile
            const info = await Device.getInfo();
            if (info.platform === 'web') return;

            // 1. Request Permission
            let permStatus = await PushNotifications.checkPermissions();
            if (permStatus.receive === 'prompt') {
                permStatus = await PushNotifications.requestPermissions();
            }

            if (permStatus.receive !== 'granted') {
                return; // User denied
            }

            // 2. Register
            await PushNotifications.register();

            // 3. Listen for Token
            PushNotifications.addListener('registration', async (token) => {
                // Save Token to User Profile in Backend/Firestore
                if (auth.currentUser) {
                    await updateDoc(doc(db, "users", auth.currentUser.uid), {
                        fcmToken: token.value
                    });
                    
                    // Also send to backend if you prefer server-side saving
                    // fetch(`${BACKEND_URL}/save-token`, { ... })
                }
            });

            // 4. Listen for Notification Received (Foreground)
            PushNotifications.addListener('pushNotificationReceived', (notification) => {
                toast.success(notification.title + ": " + notification.body, {
                    duration: 4000,
                    icon: '🔔'
                });
            });

            // 5. Listen for Notification Tapped (Background)
            PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
                // You can navigate to specific pages here
                console.log('Notification tapped', notification);
            });
        };

        registerNotifications();
    }, []);
};