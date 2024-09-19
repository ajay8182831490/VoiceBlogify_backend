import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../../utils/logger.js';
const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const downloadAudio = async (url, outputFilePath) => {
    const command = `yt-dlp -f bestaudio -o "${outputFilePath}" ${url}`;
    try {
        await execPromise(command);
    } catch (error) {
        logError(error, path.basename(__filename), downloadAudio);
        throw new Error('Failed to download audio');
    }
};

export const urlTranscription = async (req, res) => {
    const { userId } = req;
    const { url } = req.body;

    logInfo(`Going to fetch the URL transcription for user ${userId}`, path.basename(__filename), urlTranscription);

    if (!url) {
        return res.status(400).json({ message: "URL is required" });
    }

    try {

        const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}(\?[^\s]*)?$/;
        if (!youtubePattern.test(url)) {
            return res.status(400).json({ message: "Invalid YouTube URL" });
        }


        const tempAudioPath = path.join(__dirname, 'temp_audio.mp4'); // Use .mp4 to avoid processing


        await downloadAudio(url, tempAudioPath);

        res.status(200).json({ message: 'Audio downloaded successfully', path: tempAudioPath });
    } catch (error) {
        logError(error, path.basename(__filename), urlTranscription); // Log the error
        res.status(500).json({ message: "Internal server error" }); // Send a generic error message to the user
    }
};



export const recordTranscription = async (req, res) => {
    const { userId } = req
    logInfo(`Going to audio file transcripte to the text for the user ${userId}`, path.basename(__filename), recordTranscription);
    try {

        const audioFile = req.file;
        if (!audioFile) {
            return res.status(400).json({ message: "no file upload" });
        }

        const audioBuffer = audioFile.buffer;
        console.log(audioBuffer)
        const audioBytes = audioBuffer.toString('base64');


        res.status(200).json({ message: "audio file uploaded successfully" });

    } catch (error) {
        logError(error, path.basename(__filename))
        res.status(500).json({ messagge: "internal server error" })
    }
} 