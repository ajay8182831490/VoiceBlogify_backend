import fs from "fs";
import FormData from "form-data";
import fetch from "node-fetch";

const speechToText = async (audioPath, retries = 3) => {
    console.log("Transcribing audio file at:", audioPath);

    try {
        // Check if the audio file exists
        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found at path: ${audioPath}`);
        }

        const formData = new FormData();
        formData.append('model', 'whisper-1');
        formData.append('file', fs.createReadStream(audioPath), {
            filename: 'audio.mp3',
            contentType: 'audio/mpeg',
        });

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${process.env.openAi}`,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        // Log the response status and body
        console.log("API Response Status:", response.status);
        console.log("API Response:", await response.json());

        if (!response.ok) {
            const error = await response.json();
            if (error.error.code === 'insufficient_quota') {
                throw new Error("Quota exceeded. Please check your OpenAI plan.");
            }
            throw new Error(error.error.message);
        }

        const result = await response.json();
        console.log("Transcription Text:", result.text);
        return result.text;
    } catch (error) {
        console.error("Error during transcription:", error.message);
        // Optionally handle retries for transient errors
        if (retries > 0 && error.message !== "Quota exceeded. Please check your OpenAI plan.") {
            console.log(`Retrying transcription... (${3 - retries + 1})`);
            return await speechToText(audioPath, retries - 1);
        }
        throw new Error("Failed to transcribe audio file.");
    }
};

export default speechToText;
