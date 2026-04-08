const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

const uploadTest = async () => {
    try {
        const filePath = path.join(__dirname, 'uploads', '33e8531c-5fa6-40bb-a446-109ac525b206.mp4');
        if (!fs.existsSync(filePath)) {
            console.error("Test file does not exist:", filePath);
            return;
        }

        const formData = new FormData();
        formData.append('video', fs.createReadStream(filePath));
        formData.append('sourceLanguage', 'auto');
        formData.append('targetLanguage', 'en');
        formData.append('whisperModel', 'tiny');

        console.log("Sending POST request to /api/upload...");
        const response = await axios.post('http://localhost:5000/api/upload', formData, {
            headers: formData.getHeaders()
        });

        console.log("Upload Success! ->", response.data);

        // Keep polling for status
        const fileId = response.data.fileId;
        console.log(`Polling status for ${fileId}...`);
        const timer = setInterval(async () => {
            try {
                const statusRes = await axios.get(`http://localhost:5000/api/upload/${fileId}/status`);
                console.log(`[Status] ${statusRes.data.status} | Process: ${statusRes.data.progress || 'unknown'}`);
                if (statusRes.data.status === 'completed' || statusRes.data.status === 'failed') {
                    console.log("Final Details:", JSON.stringify(statusRes.data, null, 2));
                    clearInterval(timer);
                }
            } catch (err) {
                console.error("Status check failed:", err.message);
                clearInterval(timer);
            }
        }, 3000);

    } catch (err) {
        console.error("Upload failed:", err.response ? err.response.data : err.message);
    }
};

uploadTest();
