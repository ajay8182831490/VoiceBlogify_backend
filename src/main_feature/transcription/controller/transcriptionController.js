
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../../utils/logger.js';
import ffprobe from 'ffprobe';
import ffprobeStatic from 'ffprobe-static';
import { PrismaClient } from "@prisma/client";

import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs/promises';



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
const extractAudioFromVideo = async (videoBuffer, userId) => {
    const videoPath = path.join(__dirname, `${userId}tempVideo.mp4`);
    const audioPath = path.join(__dirname, `${userId}tempAudio.mp3`);

    try {

        await fs.writeFile(videoPath, videoBuffer);


        await new Promise((resolve, reject) => {
            ffmpeg(videoPath)
                .output(audioPath)
                .on('end', () => {
                    console.log('Audio extraction completed');
                    resolve();
                })
                .on('error', (err) => {
                    console.error('Error during audio extraction:', err);
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



const transcribeAudio = async (audioChunk) => {
    try {

        const transcription = await transcribeAudioAPI(audioChunk);
        return transcription.text || "";
    } catch (error) {
        console.error("Error transcribing audio:", error);
        return "";
    }
}

const generateBlogFromText = async (transcribedText) => {
    try {
        const blogResponse = await generateBlogAPI(transcribedText);
        return blogResponse.content || ""; // Assuming blog generation API returns a content property
    } catch (error) {
        console.error("Error generating blog:", error);
        return "";
    }
};
const checkUserPlan = async (userId) => {
    const userPlan = await prisma.subscription.findFirst({
        where: {
            userId: userId,
            remainingPosts: {
                gte: 0
            },
            status: 'ACTIVE'
        },
        select: {
            plan: true
        }
    });

    if (!userPlan) return null;

    return userPlan;
};
const convertToWav = async (buffer, outputPath) => {
    let tempFilePath = null;
    try {
        tempFilePath = path.join(__dirname, `temp-audio-${Date.now()}.mp3`);




        await fs.writeFile(tempFilePath, buffer);


        return new Promise((resolve, reject) => {
            ffmpeg(tempFilePath)
                .toFormat('wav')
                .on('end', async () => {
                    await fs.unlink(tempFilePath);
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



export const recordTranscription = async (req, res) => {
    const { userId } = req;
    logInfo(`Starting audio transcription process for user ${userId}`, path.basename(__filename), recordTranscription);
    const tempFileName = `output-${userId}-${Date.now()}.wav`;
    const wavOutputPath = path.join(__dirname, tempFileName);
    try {
        const file = req.file;


        const fileType = file.mimetype;
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







        await convertToWav(Buffer, wavOutputPath);

        await fs.access(wavOutputPath);
        const wavBuffer = await fs.readFile(wavOutputPath);




        const userPlan = await checkUserPlan(userId);

        if (!userPlan) {
            return res.status(403).json({ message: "No active subscription plan" });
        }


        let maxAllowedDuration;
        switch (userPlan.plan) {
            case "FREE":
                maxAllowedDuration = 10 * 60;
                break;
            case "BASIC":
                maxAllowedDuration = 20 * 60;
                break;
            case "PREMIUM":
                maxAllowedDuration = 60 * 60;

                break;
            case "BUISNESS":
                maxAllowedDuration = 90 * 60;
                break;
            default:
                return res.status(400).json({ message: "Invalid user plan" });
        }




        const audioDuration = await getAudioDuration(wavBuffer, userId);


        if (!audioDuration) {
            return res.status(400).json({ message: "Unable to determine audio duration" });
        }


        if (audioDuration > maxAllowedDuration) {

            return res.status(400).json({ message: `Your plan allows a maximum of ${maxAllowedDuration / 60} minutes of audio` });
        }


        const chunkDuration = 150;
        const chunks = Math.ceil(audioDuration / chunkDuration);
        let combinedTranscription = "";
        console.log(chunks)


        /*for (let i = 0; i < chunks; i++) {
            const start = i * chunkDuration;
            const end = (i + 1) * chunkDuration > audioDuration ? audioDuration : (i + 1) * chunkDuration;
 
 
            const audioChunk = Buffer.slice(start * 44100 * 2, end * 44100 * 2); // Adjust sample rate as needed
            //const chunkTranscription = await transcribeAudio(audioChunk);
 
            //combinedTranscription += chunkTranscription + " ";
        }
 
        // Step 7: Generate a blog from the combined transcription text
        //const blogContent = await generateBlogFromText(combinedTranscription);*/

        res.status(200).json({ message: "Audio file transcribed successfully" });

    } catch (error) {
        logError(error, path.basename(__filename));
        res.status(500).json({ message: "Internal server error" });
    }
    finally {
        if (wavOutputPath) {
            try {
                await deleteFileWithRetry(wavOutputPath); // Attempt to delete the file with retries
            } catch (err) {
                console.error(`Failed to delete file after retries: ${wavOutputPath}, Error: ${err.message}`);
            }
        }
    }
};






























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

        // Clean up the temporary audio file
        fs.unlink(tempAudioPath, (err) => {
            if (err) {
                logError(err, path.basename(__filename), urlTranscription);
            } else {
                logInfo(`Successfully deleted audio file for user ${userId}`, path.basename(__filename), urlTranscription);
            }
        });

        res.status(200).json({ message: 'Audio downloaded successfully', path: tempAudioPath });
    } catch (error) {
        // Ensure the temporary audio file is deleted on error
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





