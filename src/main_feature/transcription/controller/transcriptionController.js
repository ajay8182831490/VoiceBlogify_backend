import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../../utils/logger.js';
const execPromise = util.promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

import { PrismaClient } from "@prisma/client";
import speechToText from '../../voice_to_text/spechTranscription.js'
import { Console } from 'console';
import fs from 'fs'


const prisma = new PrismaClient();
const audioSizeLimits = {
    FREE: 10,
    BASIC: 20,
    PREMIUM: 60,
    BUSINESS: 90,
};


const cookiesFilePath = path.join(__dirname, '../../cookies.txt');

const downloadAudio = async (url, outputFilePath) => {

    const command = `yt-dlp --cookies "${cookiesFilePath}" -f bestaudio -o "${outputFilePath}" ${url}`;
    try {
        await execPromise(command);
    } catch (error) {
        logError(error, path.basename(__filename), downloadAudio);
        throw new Error('Failed to download audio');
    }
};

const audioSize = async (audiofile) => {
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
};

export const urlTranscription = async (req, res) => {
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



