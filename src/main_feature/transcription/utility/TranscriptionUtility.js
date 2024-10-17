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
const getAudioDuration = async (audioBuffer, mediaType, mimeType) => {
    // Map MIME types to extensions
    const extensionMap = {
        'audio/mpeg': 'mp3',
        'audio/webm': 'webm',
        'audio/wav': 'wav',
        'audio/ogg': 'ogg',
        'audio/mp4': 'mp4',
        'audio/x-aiff': 'aiff',
        'video/mp4': 'mp4',
        'video/x-msvideo': 'avi',
        'video/x-m4v': 'm4v',
        'video/ogg': 'ogg',
        'video/webm': 'webm'
    };

    // Determine the correct extension based on mimeType
    const extension = extensionMap[mimeType] || (mediaType === 'video' ? 'mp4' : 'mp3');
    const tempFilePath = path.join(__dirname, `temp-media-${Date.now()}.${extension}`);

    console.log(`Processing file with MIME type: ${mimeType} as ${extension}`);

    try {
        // Write the buffer to a temporary file
        await fs.writeFile(tempFilePath, audioBuffer);

        // Get metadata for the file to determine the duration
        const metadata = await ffprobe(tempFilePath, { path: ffprobeStatic.path });

        // Find the audio stream in the metadata
        const audioStream = metadata.streams.find(stream => stream.codec_type === 'audio');
        const duration = audioStream ? audioStream.duration : null;

        if (!duration) {
            console.error("No audio stream found in the file.");
            return null;
        }

        return duration;

    } catch (error) {
        console.error("Error extracting media duration:", error);
        return null;

    } finally {
        // Ensure to delete the temporary file
        await fs.unlink(tempFilePath).catch(err => {
            console.error("Error deleting temp file:", err);
        });
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

export { extractAudioFromVideo, getAudioDuration, checkUserPlan, }