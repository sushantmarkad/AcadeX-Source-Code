import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { Capacitor } from '@capacitor/core';
import toast from 'react-hot-toast';

export const useFileDownloader = () => {
    
    // Helper: Convert Blob to Base64
    const blobToBase64 = (blob) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onerror = reject;
            reader.onload = () => {
                resolve(reader.result.split(',')[1]);
            };
            reader.readAsDataURL(blob);
        });
    };

    const downloadFile = async (fileUrl, fileName) => {
        const toastId = toast.loading("Downloading...", { position: 'bottom-center' });

        try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();

            if (Capacitor.isNativePlatform()) {
                // --- ANDROID/iOS LOGIC ---
                const base64Data = await blobToBase64(blob);
                
                let savedFile;
                try {
                    // 1. Try saving to External Storage (Android/data/com.acadex.app/files/)
                    // This works on Android 11+ without extra permissions
                    savedFile = await Filesystem.writeFile({
                        path: fileName,
                        data: base64Data,
                        directory: Directory.External, 
                        recursive: true
                    });
                } catch (writeError) {
                    console.warn("External write failed, trying Cache...", writeError);
                    // 2. Fallback to Cache if External fails
                    savedFile = await Filesystem.writeFile({
                        path: fileName,
                        data: base64Data,
                        directory: Directory.Cache,
                        recursive: true
                    });
                }

                toast.success("File Downloaded!", { id: toastId });

                // Open the file immediately
                await FileOpener.open({
                    filePath: savedFile.uri,
                    contentType: blob.type
                });

            } else {
                // --- WEB LOGIC ---
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                a.remove();
                toast.success("Download Started", { id: toastId });
            }
        } catch (error) {
            console.error("Download error:", error);
            // Show the actual error message for debugging
            toast.error(`Error: ${error.message}`, { id: toastId });
        }
    };

    return { downloadFile };
};