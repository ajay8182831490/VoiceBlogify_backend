
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../../utils/logger.js';
import ffprobe from 'ffprobe';
import ffprobeStatic from 'ffprobe-static';
import { PrismaClient } from "@prisma/client";

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import { PassThrough } from 'stream';

import { generateBlogFromText } from '../../voice_to_text/blogGeneration.js';
import sendBlogReadyEmail, { sendFailureEmail } from '../utility/email.js';
import { sendFailureEmail1 } from '../utility/email.js';
import transcriptionQueue from '../utility/RedisConfiguration.js';
import { v4 as uuidv4 } from 'uuid';

import { uploadBuffer, deleteBlob } from '../utility/Storage.js';
import internal from 'stream';


const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { extractAudioFromVideo, checkUserPlan, getAudioDuration } from '../utility/TranscriptionUtility.js';



function sanitizeFileName(fileName) {
    return fileName.replace(/[^a-zA-Z0-9_\.]/g, '');
}
const addJobToQueue = async (userId, fileName, fileDuration, userPlan, blogType, blogTone) => {
    if (!userId || !fileName || !fileDuration || !userPlan) {
        console.error('Invalid input data:', { userId, fileName, fileDuration, userPlan });
        return;
    }

    try {
        const job = await transcriptionQueue.add(
            { userId, fileName, fileDuration, userPlan, blogType, blogTone },
            { attempts: 1, delay: 1000, removeOnComplete: true } // Retry with backoff
        );
        console.log('Job added to queue successfully:', job.id);
    } catch (error) {
        console.error('Error adding job to queue:', error.message);
        throw new Error('Failed to add job to queue');
    }
};
export const convertToWav = async (buffer, userId) => {
    const tempFilePath = path.join(__dirname, `temp-audio-${userId}-${Date.now()}.mp3`);
    const outputFilePath = path.join(__dirname, `output-audio-${userId}-${Date.now()}.wav`); // Define output file path

    try {
        // Write the input audio buffer to a temporary file
        await fs.writeFile(tempFilePath, buffer);

        return new Promise((resolve, reject) => {
            ffmpeg(tempFilePath)
                .toFormat('wav') // Set the desired output format
                .on('end', async () => {
                    console.log("WAV conversion completed");

                    // Read the output file and resolve the buffer
                    const outputBuffer = await fs.readFile(outputFilePath);


                    await fs.unlink(tempFilePath);
                    await fs.unlink(outputFilePath);

                    resolve(outputBuffer); // Resolve with the WAV buffer
                })
                .on('error', async (err) => {
                    console.error("Error during conversion:", err);

                    // Clean up temporary files in case of error
                    await fs.unlink(tempFilePath).catch(unlinkError => {
                        console.error("Failed to delete temporary file during error:", unlinkError);
                    });
                    await fs.unlink(outputFilePath).catch(unlinkError => {
                        console.error("Failed to delete output file during error:", unlinkError);
                    });

                    reject(new Error('WAV conversion failed: ' + err.message));
                })
                .save(outputFilePath); // Save to the defined output file
        });
    } catch (error) {


        // Clean up temporary files if an error occurs
        await fs.unlink(tempFilePath).catch(unlinkError => {
            console.error("Failed to delete temporary file during error:", unlinkError);
        });
        throw new Error('WAV conversion failed: ' + error.message);
    }
};
export const recordTranscription = async (req, res) => {
    const { userId } = req;
    logInfo(`Starting audio transcription process for user ${userId}`, path.basename(__filename), recordTranscription);

    let fileName
    let tempFileName = `output-${userId}-${Date.now()}.wav`;
    try {

        const { blogType,
            blogTone } = req.body;

        if (!blogType || !blogTone) {
            return res.status(400).json({ message: "missing field required" });
        }



        const file = req.file;


        if (!file) {
            return res.status(400).json({ message: "No file uploaded" });
        }

        const fileType = file.mimetype;
        if (!fileType.startsWith('audio/') && !fileType.startsWith('video/')) {
            return res.status(400).json({ message: "Unsupported file type" });
        }


        tempFileName = sanitizeFileName(tempFileName);
        fileName = encodeURIComponent(tempFileName);



        res.status(200).json({
            message: "Processing started, you'll be notified via email once it's done.",
        });

        processFileAfterResponse(file, fileType, fileName, userId, blogType, blogTone);





    } catch (error) {
        logError(error, path.basename(__filename), 'Error in transcription process');
        return res.status(500).json({ message: "Internal server error" });
    }
}



const uploadWithRetry = async (userId, waveBuffer, fileName, MAX_RETRIES) => {
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            await uploadBuffer(userId, waveBuffer, fileName);
            return; // Exit the function if the upload is successful
        } catch (uploadError) {
            logError(uploadError, path.basename(__filename), 'Error uploading buffer');
            if (attempt === MAX_RETRIES) {
                throw new Error("Failed to upload audio buffer after retrying");
            }
        }
    }
};
async function processFileAfterResponse(file, fileType, fileName, userId, blogType, blogTone) {
    let errorCause = null;  // Variable to store the cause of failure

    try {
        let Buffer;



        // Extract audio if it's a video file
        if (fileType.startsWith('audio/')) {
            Buffer = file.buffer;  // Direct audio
        } else if (fileType.startsWith('video/')) {
            const videoBuffer = file.buffer;
            Buffer = await extractAudioFromVideo(videoBuffer, userId);  // Extract audio from video
            if (!Buffer) {
                errorCause = "Audio extraction from video failed";
                logError(errorCause, path.basename(__filename), 'processFileAfterResponse');
                //await sendFailureEmail1(userPlan?.user?.email, errorCause);  // Send failure email
                return;
            }
        }

        // Convert the audio to WAV format
        const waveBuffer = await convertToWav(Buffer, userId);

        // Get the duration of the audio file
        const fileDuration = await getAudioDuration(waveBuffer);

        // Check user's subscription plan
        const userPlan = await checkUserPlan(userId);
        if (!userPlan) {
            errorCause = `No active subscription plan for user ${userId}`;
            logError(errorCause, path.basename(__filename), 'processFileAfterResponse');
            await sendFailureEmail1(userPlan?.user?.email, errorCause);  // Send failure email
            return;
        }

        // Check if the duration exceeds the user's plan limit
        const maxAllowedDuration = getMaxAllowedDuration(userPlan.plan);
        if (fileDuration > maxAllowedDuration) {
            errorCause = `Audio duration exceeds allowed limit for user plan`;
            logError(errorCause, path.basename(__filename), 'processFileAfterResponse');
            await sendFailureEmail1(userPlan?.user?.email, errorCause);  // Send failure email
            return;
        }

        if (fileDuration < 60) {
            errorCause = `Audio duration too short for processing`;
            logError(errorCause, path.basename(__filename), 'processFileAfterResponse');
            await sendFailureEmail1(userPlan?.user?.email, errorCause);  // Send failure email
            return;
        }

        // Try uploading the file with retries
        const MAX_RETRIES = 1;
        let uploadSuccess = false;
        for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
            try {
                await uploadWithRetry(userId, waveBuffer, fileName, MAX_RETRIES);
                uploadSuccess = true;
                break;  // Exit loop if successful
            } catch (uploadError) {
                logError(`Upload attempt ${attempt} failed for user ${userId}: ${uploadError.message}`, path.basename(__filename), 'processFileAfterResponse');
                if (attempt === MAX_RETRIES + 1) {
                    errorCause = `Upload failed after ${attempt} attempts for user ${userId}: ${uploadError.message}`;
                }
            }
        }

        // If upload failed after retries, log and notify
        if (!uploadSuccess) {
            logError(errorCause, path.basename(__filename), 'processFileAfterResponse');
            await sendFailureEmail1(userPlan?.user?.email, errorCause);  // Send failure email
            return;
        }

        // Finally, add the job to the queue if everything was successful
        await addJobToQueue(userId, fileName, fileDuration, userPlan, blogType, blogTone);
        logInfo(`Job successfully added to queue for user ${userId}`, path.basename(__filename), 'processFileAfterResponse');

    } catch (error) {
        errorCause = `Error in background processing: ${error.message}`;
        logError(errorCause, path.basename(__filename), 'processFileAfterResponse');
        await sendFailureEmail1(userPlan?.user?.email, errorCause);  // Send failure email
    }
}


// async function sendFailureEmail(userId, errorCause) {
//     // Implement your email logic here
//     console.log(`Sending failure email to user ${userId} with cause: ${errorCause}`);
// }





const getMaxAllowedDuration = (plan) => {
    switch (plan) {
        case "FREE":
            return 10 * 60; // 10 minutes
        case "BASIC":
            return 20 * 60; // 20 minutes
        case "PREMIUM":
            return 60 * 60; // 60 minutes
        case "BUSINESS":
            return 90 * 60; // 90 minutes
        default:
            throw new Error("Invalid user plan");
    }
};






transcriptionQueue.on('completed', async (job) => {
    try {

        console.log("job completed")
        await deleteBlob(job.data.userId, job.data.fileName)


    } catch (error) {
        console.log(error)
    }
});

























import { exec } from 'child_process';
import util from 'util'

const execPromise = util.promisify(exec);




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


        const tempAudioPath = path.join(__dirname, 'temp_audio.mp3');


        await downloadAudio(url, tempAudioPath);

        await fs.unlink(tempAudioPath);


        res.status(200).json({ message: 'Audio downloaded successfully', path: tempAudioPath });
    } catch (error) {
        logError(error, path.basename(__filename), urlTranscription);
        res.status(500).json({ message: "Internal server error" });
    }
};




