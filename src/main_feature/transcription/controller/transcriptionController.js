
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
const addJobToQueue = async (userId, fileName, fileDuration, userPlan) => {
    if (!userId || !fileName || !fileDuration || !userPlan) {
        console.error('Invalid input data:', { userId, fileName, fileDuration, userPlan });
        return;
    }

    try {
        const job = await transcriptionQueue.add(
            { userId, fileName, fileDuration, userPlan },
            { attempts: 1, delay: 5000, removeOnComplete: true } // Retry with backoff
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

    let fileName, fileDuration;
    let tempFileName = `output-${userId}-${Date.now()}.wav`;


    // Validate file presence
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






    let Buffer;

    if (fileType.startsWith('audio/')) {

        Buffer = file.buffer;

    } else if (fileType.startsWith('video/')) {

        const videoBuffer = file.buffer;



        Buffer = await extractAudioFromVideo(videoBuffer, userId);


        if (!Buffer) return res.status(500).json({ message: "Audio extraction from video failed" });



    } else {
        return res.status(400).json({ message: "Unsupported file type" });
    }




    try {


        const waveBuffer = await convertToWav(Buffer, userId);

        fileDuration = await getAudioDuration(waveBuffer)

        const userPlan = await checkUserPlan(userId);
        if (!userPlan) {
            return res.status(403).json({ message: "No active subscription plan" });
        }

        // Define maximum allowed duration based on the plan
        const maxAllowedDuration = getMaxAllowedDuration(userPlan.plan);
        if (fileDuration > maxAllowedDuration) {
            return res.status(400).json({
                message: `Your plan allows a maximum of ${maxAllowedDuration / 60} minutes of audio/video.`,
            });
        }

        if (fileDuration < 60) {
            return res.status(400).json({ message: "Audio duration should be at least1 minutes" })
        }
        try {
            await uploadBuffer(userId, waveBuffer, fileName);
        } catch (uploadError) {
            logError(uploadError, path.basename(__filename), 'Error uploading buffer');
            return res.status(500).json({ message: "Failed to upload audio buffer" });
        }

        try {
            await addJobToQueue(userId, fileName, fileDuration, userPlan);
        } catch (queueError) {
            logError(queueError, path.basename(__filename), 'Error adding job to queue');
            return res.status(500).json({ message: "Failed to add transcription job to queue" });
        }


        res.status(200).json({
            message: "Processing started, you'll be notified via email once it's done.",
        })

    } catch (error) {
        logError(error, path.basename(__filename), 'Error in transcription process');
        return res.status(500).json({ message: "Internal server error" });
    }

};







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


































// const execPromise = (command) => {
//     return new Promise((resolve, reject) => {
//         exec(command, (error, stdout, stderr) => {
//             if (error) {
//                 reject(new Error(`Command failed: ${stderr}`));
//             }
//             resolve({ stdout, stderr });
//         });
//     });
// };



/*const downloadAudio = async (url, outputFilePath) => {
    console.log('Attempting to download audio from URL:', url); // Log the URL

    const ytDlpCommand = [
        'yt-dlp',
        '--cookies', cookiesFilePath,
        '--user-agent',
        '"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/74.0.3729.169 Safari/537.3"',
        '-f', 'bestaudio',
        '-o', outputFilePath,
        '--restrict-filenames',
        '--no-mtime',
        '-v', // Verbose output for debugging
        url // URL should be the last argument
    ];

    // Construct the full command string
    const commandString = ytDlpCommand.join(' ');

    try {
        console.log('Executing command:', commandString); // Log the command being executed
        const { stdout, stderr } = await execPromise(commandString); // Pass the command string directly

        // Log stdout and stderr for debugging
        console.log('yt-dlp stdout:', stdout);
        if (stderr) {
            console.error('yt-dlp stderr:', stderr); // Log stderr for debugging
            throw new Error(`yt-dlp stderr output indicates a problem: ${stderr}`);
        }

        return stdout; // Return the standard output
    } catch (error) {
        // Improved error handling
        console.error('Error in downloadAudio:', error.message); // Log error details
        console.error('Full command executed:', commandString); // Log the full command for debugging
        throw new Error('Failed to download audio'); // Rethrow a simplified error message
    }
};
*/

/*const audioSize = async (audiofile) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audiofile, (err, metadata) => {
            if (err) {
                logError(err, path.basename(__filename), audioSize);
                return reject(new Error("Error retrieving audio duration"));
            }
            const durationInSeconds = metadata.format.duration;
            const durationInMinutes = durationInSeconds / 60;
            resolve(durationInMinutes);
        });
    });
};*/

/*export const urlTranscription = async (req, res) => {
    const { userId } = req;
    const { url } = req.body;

    logInfo(`Going to fetch the URL transcription for user ${userId}`, path.basename(__filename), urlTranscription);

    if (!url) {
        return res.status(400).json({ message: "URL is required" });
    }
    let tempAudioPath;

    try {
        const youtubePattern = /^(https?:\/\/)?(www\.)?(youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}(\?[^\s]*)?$/;
        if (!youtubePattern.test(url)) {
            return res.status(400).json({ message: "Invalid YouTube URL" });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: {
                subscriptions: {
                    where: { status: "ACTIVE" },
                    select: {
                        plan: true,
                        remainingPosts: true,
                        startDate: true,
                        endDate: true,
                        billingCycle: true,
                        trialEndDate: true,
                    }
                }
            }
        });

        // Check if the user has an active subscription
        if (!user || user.subscriptions.length === 0) {
            return res.status(403).json({ message: "No active subscription found." });
        }

        const activeSubscription = user.subscriptions[0];

        // Check the remaining post creation limit
        if (activeSubscription.remainingPosts <= 0) {
            return res.status(403).json({ message: "No remaining posts available for this subscription." });
        }

        tempAudioPath = path.join(__dirname, `${userId}_temp_audio.mp3`);

        await downloadAudio(url, tempAudioPath); // Call the download function

        const durationInMinutes = await audioSize(tempAudioPath);
        const allowedDuration = audioSizeLimits[activeSubscription.plan];

        if (durationInMinutes > allowedDuration) {
            return res.status(400).json({ message: `Audio exceeds allowed duration of ${allowedDuration} minutes for your plan.` });
        }

        const text = await speechToText(tempAudioPath);
        console.log(text);


        fs.unlink(tempAudioPath, (err) => {
            if (err) {
                logError(err, path.basename(__filename), urlTranscription);
            } else {
                logInfo(`Successfully deleted audio file for user ${userId}`, path.basename(__filename), urlTranscription);
            }
        });

        res.status(200).json({ message: 'Audio downloaded successfully', path: tempAudioPath });
    } catch (error) {

        fs.unlink(tempAudioPath, (err) => {
            if (err) {
                logError(err, path.basename(__filename), urlTranscription);
            } else {
                logInfo(`Successfully deleted audio file for user ${userId}`, path.basename(__filename), urlTranscription);
            }
        });
        logError(error, path.basename(__filename), urlTranscription); // Log the error
        res.status(500).json({ message: "Internal server error" }); // Send a generic error message to the user
    }
};*/





