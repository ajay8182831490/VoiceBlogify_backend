
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../../utils/logger.js';
import ffprobe from 'ffprobe';
import ffprobeStatic from 'ffprobe-static';
import { PrismaClient } from "@prisma/client";

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';
import transcribeAudioAPI from '../../voice_to_text/spechTranscription.js';
import { generateBlogFromText } from '../../voice_to_text/blogGeneration.js';
import sendBlogReadyEmail, { sendFailureEmail } from '../utility/email.js';
import transcriptionQueue from '../utility/RedisConfiguration.js';
import { v4 as uuidv4 } from 'uuid';


const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const getAudioDuration = async (audioBuffer) => {

    const tempFilePath = path.join(__dirname, `temp-audio-${Date.now()}.mp3`);

    try {

        await fs.writeFile(tempFilePath, audioBuffer);

        const metadata = await ffprobe(tempFilePath, { path: ffprobeStatic.path });


        return metadata.streams[0].duration;

    } catch (error) {

        return null;

    } finally {

        await fs.unlink(tempFilePath);
    }
};






const checkUserPlan = async (userId) => {
    const userPlan = await prisma.subscription.findFirst({
        where: {
            userId: userId,
            remainingPosts: {
                gt: 0
            },
            status: 'ACTIVE'
        },
        select: {
            plan: true,
            user: {
                select: {
                    email: true,
                    name: true
                }
            }
        }

    });

    if (!userPlan) return null;

    return userPlan;
};
export const convertToWav = async (buffer, userId, outputPath) => {
    let tempFilePath = null;
    try {
        tempFilePath = path.join(__dirname, `temp-audio-${userId}-${Date.now()}.mp3`);




        await fs.writeFile(tempFilePath, buffer);


        return new Promise((resolve, reject) => {
            ffmpeg(tempFilePath)
                .toFormat('wav')
                .on('end', async () => {
                    await fs.unlink(tempFilePath);
                    console.log("wav converted")
                    resolve({ outputPath, tempFilePath });
                })
                .on('error', async (err) => {

                    if (tempFilePath) {
                        await fs.unlink(tempFilePath).catch(unlinkError => {
                            console.error("Failed to delete temporary file during error:", unlinkError);
                        });
                    }
                    reject(new Error('WAV conversion failed.'));
                })
                .save(outputPath);

        });
    } catch (error) {

        await fs.unlink(tempFilePath);
        throw new Error('WAV conversion failed.');
    }
};

const deleteFileWithRetry = (filePath, retries = 3, delay = 1000) => {
    return new Promise((resolve, reject) => {
        const attemptDelete = (attempt) => {
            fs.unlink(filePath, (err) => {
                if (err) {
                    if (attempt < retries) {
                        console.error(`Failed to delete file: ${filePath}, Attempt ${attempt + 1} of ${retries}, Error: ${err.message}. Retrying in ${delay} ms...`);
                        setTimeout(() => attemptDelete(attempt + 1), delay); // Retry after delay
                    } else {
                        console.error(`Failed to delete file after ${retries} attempts: ${filePath}`);
                        reject(err); // Give up after the maximum number of retries
                    }
                } else {
                    console.log(`Deleted temporary file: ${filePath}`);
                    resolve(); // Successfully deleted
                }
            });
        };
        attemptDelete(0); // Start the first attempt
    });
};

const extractAudioFromVideo = async (videoBuffer, userId) => {
    const videoPath = path.join(__dirname, `${userId}tempVideo.mp4`);
    const audioPath = path.join(__dirname, `${userId}tempAudio.mp3`);

    try {

        await fs.writeFile(videoPath, videoBuffer);


        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .output(audioPath)
                .on('end', () => {
                    console.log("audio extract")
                    resolve();
                })
                .on('error', (err) => {
                    //console.error('Error during audio extraction:', err);
                    reject(err);
                })
                .run();
        });


        const audioBuffer = await fs.readFile(audioPath);


        await fs.unlink(videoPath);
        await fs.unlink(audioPath);

        return audioBuffer;
    } catch (error) {

        throw error;
    }
};


export const recordTranscription = async (req, res) => {
    const { userId } = req;
    logInfo(`Starting audio transcription process for user ${userId}`, path.basename(__filename));

    const tempFileName = `output-${userId}-${Date.now()}-${uuidv4()}.mp3`;
    const audioPath = path.join(__dirname, tempFileName); // Path where audio will be saved

    let fileWritten = false;

    try {
        const file = req.file;
        const fileType = file.mimetype;
        let audioBuffer;
        let audioDuration;

        // Determine file type and handle accordingly
        if (fileType.startsWith('audio/')) {
            audioBuffer = file.buffer;
            audioDuration = await getAudioDuration(audioBuffer, req.file.mimetype, userId);
        } else if (fileType.startsWith('video/')) {
            const videoBuffer = file.buffer;
            audioBuffer = await extractAudioFromVideo(videoBuffer, userId);
            audioDuration = await getAudioDuration(audioBuffer, req.file.mimetype, userId);

            if (!audioBuffer) return res.status(500).json({ message: "Audio extraction from video failed" });
        } else {
            return res.status(400).json({ message: "Unsupported file type" });
        }

        const userPlan = await checkUserPlan(userId);
        if (!userPlan) {
            return res.status(403).json({ message: "No active subscription plan" });
        }

        // Define max allowed duration based on user plan
        let maxAllowedDuration;
        switch (userPlan.plan) {
            case "FREE":
                maxAllowedDuration = 10 * 60; // 10 minutes
                break;
            case "BASIC":
                maxAllowedDuration = 20 * 60; // 20 minutes
                break;
            case "PREMIUM":
                maxAllowedDuration = 60 * 60; // 60 minutes
                break;
            case "BUSINESS":
                maxAllowedDuration = 90 * 60; // 90 minutes
                break;
            default:
                return res.status(400).json({ message: "Invalid user plan" });
        }

        if (!audioDuration) {
            return res.status(400).json({ message: "Unable to determine audio duration" });
        }

        if (audioDuration > maxAllowedDuration) {
            return res.status(400).json({ message: `Your plan allows a maximum of ${maxAllowedDuration / 60} minutes of audio` });
        }




        await fs.writeFile(audioPath, audioBuffer);
        try {
            await fs.access(audioPath);

            console.log("file accessible")
        } catch (error) {
            return res.status(400).json({ message: "something error occured during transcription" })
        }





        const job = await transcriptionQueue.add(
            { userId, audioPath, audioDuration, userPlan },
            { attempts: 1, removeOnComplete: true, }
        );
        console.log(`Job created: ${job.id}`);
        if (!job) {
            throw new Error("Failed to add job to the transcription queue");
        }


        res.status(200).json({ message: "Processing started, you'll be notified via email once it's done." });

    } catch (error) {
        logError(error, path.basename(__filename), 'Error in transcription process');
        console.log(error)

        // Handle cleanup only if the file was written successfully
        if (fileWritten) {
            try {
                await fs.access(audioPath);

                await fs.unlink(audioPath);

            } catch (cleanupError) {
                logError(cleanupError, path.basename(__filename), 'File access error during cleanup attempt');
            }
        }

        res.status(500).json({ message: "Internal server error" });
    }
};

// Cleanup function for audio files
const cleanupAudioFile = async (audioPath) => {
    try {
        await fs.access(audioPath);
        await fs.unlink(audioPath);
        logInfo(`Cleaned up audio file: ${audioPath}`, path.basename(__filename));
    } catch (cleanupError) {
        logError(cleanupError, path.basename(__filename), 'Cleanup error');
    }
};

// Event listeners for queue job completion and failure
transcriptionQueue.on('completed', async (job) => {
    try {

        console.log("job completed")
        // Check if the file exists before attempting to clean up
        await fs.access(job.data.audioPath);
        await cleanupAudioFile(job.data.audioPath); // Clean up if the file exists
    } catch (error) {
        if (error.code === 'ENOENT') {
            // File does not exist, log this but do not throw an error
            console.log(`Audio file already deleted or does not exist: ${job.data.audioPath}`);
        } else {
            // Log other errors without stopping the transcription process
            console.error(`Error accessing audio file: ${error.message}`);
        }
    }
});


export { cleanupAudioFile }































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





