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

                PushNotifications.addListener('pushNotificationReceived', (notification) => {
                    toast.success(notification.title + ": " + notification.body);
                });

            } catch (error) {
                console.warn("Push Notification Setup Failed:", error);
            }
        };

        registerNotifications();
    }, []);
};