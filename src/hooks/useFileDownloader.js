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
        const toastId = toast.loading("Downloading...");

        try {
            const response = await fetch(fileUrl);
            const blob = await response.blob();

            if (Capacitor.isNativePlatform()) {
                // --- ANDROID/iOS LOGIC ---
                const base64Data = await blobToBase64(blob);
                const savedFile = await Filesystem.writeFile({
                    path: fileName,
                    data: base64Data,
                    directory: Directory.Documents,
                    recursive: true
                });

                // Open the file immediately after download
                await FileOpener.open({
                    filePath: savedFile.uri,
                    contentType: blob.type
                });

                toast.success("File Saved & Opened!", { id: toastId });
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
            toast.error("Download Failed. Check permissions.", { id: toastId });
        }
    };

    return { downloadFile };
};