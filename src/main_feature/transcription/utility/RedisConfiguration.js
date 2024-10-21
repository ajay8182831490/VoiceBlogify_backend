import Bull from 'bull';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
import { convertToWav } from '../controller/transcriptionController.js';

import { generateBlogFromText } from '../../voice_to_text/blogGeneration.js';
import sendBlogReadyEmail from './email.js';
import { sendFailureEmail } from './email.js';
import path from 'path';
import { fileURLToPath } from 'url';

import { logInfo, logError } from '../../../utils/logger.js';
import { promises as fs } from 'fs';
import { fromFile } from '../../voice_to_text/spechTranscription.js';
import { PrismaClient } from '@prisma/client';

import { downloadBlob, deleteBlob } from './Storage.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const redisOptions = {
    host: "redis-15579.c124.us-central1-1.gce.redns.redis-cloud.com",
    port: 15579,
    password: "ElG68qE7bH4fujWQcgoOX5xygWVu4vBI",
    connectTimeout: 10000,
    retryStrategy: (times) => Math.min(times * 50, 2000),
};

const redis = new Redis(redisOptions);
const checkConnection = async () => {
    try {
        const response = await redis.ping(); // Ping the Redis server
        console.log('Redis ping response:', response);
    } catch (error) {
        console.error('Error checking Redis connection:', error);
    }
};
redis.on('connect', () => {
    console.log('Redis connected');
});

redis.on('error', (err) => {
    console.error('Redis error:', err);
});
checkConnection()



const transcriptionQueue = new Bull('transcriptionQueue', {
    redis: redisOptions,

});
const flushCache = async () => {
    try {
        await redis.flushall(); // Use flushall() if you want to clear all databases
        console.log('Redis cache flushed successfully.');
    } catch (error) {
        console.error('Error flushing Redis cache:', error);
    }
};


//await flushCache()
const createWAVHeader = (chunkSize, sampleRate = 44100, numChannels = 2, bitDepth = 16) => {
    const header = Buffer.alloc(44);

    // RIFF Chunk Descriptor
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + chunkSize, 4);
    header.write('WAVE', 8);

    // "fmt " SubChunk
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE((sampleRate * numChannels * bitDepth) / 8, 28);
    header.writeUInt16LE((numChannels * bitDepth) / 8, 32);
    header.writeUInt16LE(bitDepth, 34);

    // "data" SubChunk
    header.write('data', 36);
    header.writeUInt32LE(chunkSize, 40);

    return header;
};



transcriptionQueue.process(async (job) => {
    const startTime = Date.now();
    console.log(`Starting job ${job.id} at ${new Date().toISOString()}`);
      const { fileName, fileDuration, userId, userPlan,blogType,blogTone } = validateJobData(job.data);
    try {
        // Destructure and validate job data
        
        console.log("inside process",blogType,blogTone );

        // Log job start with key details
        logInfo(`Starting transcription for user ${userId}, file: ${fileName}`, path.basename(__filename));

        // Process the transcription job with progress tracking
        const result = await processTranscriptionJob({
            fileName,
            audioDuration: fileDuration,
            userId,
            userPlan,
            job,blogType,blogTone
        });

        const processingTime = (Date.now() - startTime) / 1000;
        logInfo(`Job ${job.id} completed successfully in ${processingTime}s`, path.basename(__filename));
       console.log(result);
        return result;

    } catch (error) {
        logError(`Job ${job.id} failed: ${error.message}`, path.basename(__filename));
        sendFailureEmail(userPlan.user.email, userPlan.user.name)
        throw error;
    }
});
function validateJobData(data) {
    const { fileName, fileDuration, userId, userPlan,blogType,blogTone } = data;

    const validationRules = [
        {
            condition: !fileName || typeof fileName !== 'string',
            message: 'Invalid fileName'
        },
        {
            condition: !fileDuration || isNaN(parseFloat(fileDuration)),
            message: 'Invalid fileDuration'
        },
        {
            condition: !userId || typeof userId !== 'string',
            message: 'Invalid userId'
        },
        {
            condition: !userPlan || typeof userPlan !== 'object',
            message: 'Invalid userPlan'
        }
    ];

    const error = validationRules.find(rule => rule.condition);
    if (error) {
        throw new Error(error.message);
    }

    return {
        fileName,
        fileDuration: parseFloat(fileDuration),
        userId,
        userPlan,blogType,blogTone
    };
}
async function processTranscriptionJob({ fileName, audioDuration, userId, userPlan, job ,blogType,blogTone}) {
    try {
        // Download and validate audio file
        const buffer = await downloadAudioFile(fileName, userId);

        // Transcribe audio with progress tracking
        const transcription = await transcribeWithProgress(buffer, audioDuration, userId, job);

        // Generate blog content with retries
        const blogContent = await generateBlogContent({transcription,blogType,blogTone});

        // Save results to database
        await saveResults(blogContent, userId, userPlan);

        return { success: true };

    } catch (error) {
        logError(`Processing failed: ${error.message}`, path.basename(__filename));
        throw error;
    }
}

// Audio file download and validation
async function downloadAudioFile(fileName, userId) {
    const buffer = await downloadBlob(userId, fileName);
    if (!buffer) {
        throw new Error('Audio buffer download failed');
    }

    // Save temporary file for debugging if needed
    //await fs.writeFile("debug_audio.wav", buffer);

    return buffer;
}
async function saveResults({ title, content, tag }, userId, userPlan) {
    try {
        await prisma.$transaction(async (prisma) => {
            // Create blog post
            await prisma.post.create({
                data: {
                    userId,
                    title,
                    tags: tag,
                    content,
                }
            });

            // Update user metrics
            await prisma.user.update({
                where: { id: userId },
                data: { blogCount: { increment: 1 } }
            });

            // Update subscription
            await prisma.subscription.update({
                where: { userId },
                data: { remainingPosts: { decrement: 1 } }
            });
        });

        // Send notification email
        await sendBlogReadyEmail(userPlan.user.email, userPlan.user.name, title);

    } catch (error) {
        logError(`Database operation failed: ${error.message}`, path.basename(__filename));
        throw error;
    }
}

async function generateBlogContent({transcription,blogType,blogTone}) {
    const MAX_RETRIES = 2;
    let retries = MAX_RETRIES;
    let blogContent;

    while (retries >= 0) {
        try {
            blogContent = await generateBlogFromText(transcription,blogType,blogTone);

            if (blogContent.title === 'Error') {
                if (retries === 0) {
                    throw new Error('Failed to generate blog after all retries');
                }
                logInfo(`Blog generation attempt failed, ${retries} retries remaining`, path.basename(__filename));
                retries--;
                continue;
            }

            return blogContent;

        } catch (error) {
            if (retries === 0) throw error;
            retries--;
            logError(`Blog generation error, retrying... ${retries} attempts remaining`, path.basename(__filename));
        }
    }
}

async function processChunksInParallel(audioChunks, maxConcurrent = 3) {
    console.log(`Starting parallel processing of ${audioChunks.length} chunks`);
    const results = new Array(audioChunks.length);
    const inProgress = new Set();
    const queue = [...audioChunks];
    let errors = 0;
    let completed = 0;

    async function processNext() {
        if (queue.length === 0) return;

        const { path: chunkPath, index } = queue.shift();
        inProgress.add(index);

        try {
            const transcription = await fromFile(chunkPath, index);
            results[index] = transcription;
            completed++;
            console.log(`✓ Chunk ${index} succeeded (${completed}/${audioChunks.length})`);
        } catch (error) {
            console.error(`✗ Chunk ${index} failed:`, error);
            errors++;
            results[index] = null;
        } finally {
            inProgress.delete(index);
            // Clean up chunk file
            try {
                await fs.unlink(chunkPath);
            } catch (unlinkErr) {
                console.error(`Cleanup error for chunk ${index}:`, unlinkErr);
            }
        }

        // Log progress
        console.log(`Progress: ${completed}/${audioChunks.length} complete, ${errors} errors`);
    }

    // Process chunks with concurrency control
    while (queue.length > 0 || inProgress.size > 0) {
        while (inProgress.size < maxConcurrent && queue.length > 0) {
            processNext();
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return results;
}
async function transcribeAudio(buffer, audioDuration, userId) {
    const chunkDuration = 200; // 200 seconds per chunk
    const chunks = Math.ceil(audioDuration / chunkDuration);

    // Calculate chunk size in bytes
    const bytesPerSecond = buffer.length / audioDuration;
    const bytesPerChunk = Math.floor(bytesPerSecond * chunkDuration);
    const blockAlign = 4; // 2 channels * 16 bits per sample / 8 bits per byte
    const alignedBytesPerChunk = Math.floor(bytesPerChunk / blockAlign) * blockAlign;

    console.log(`Processing ${chunks} chunks of ${chunkDuration} seconds each`);

    const chunkConfigs = [];

    // Prepare chunks
    for (let i = 0; i < chunks; i++) {
        const startByte = i * alignedBytesPerChunk;
        const endByte = Math.min((i + 1) * alignedBytesPerChunk, buffer.length);

        const audioChunk = buffer.slice(startByte, endByte);
        const chunkPath = path.join(__dirname, `chunk-${userId}-${i}-${Date.now()}.wav`);

        const wavHeader = createWAVHeader(audioChunk.length);
        const wavChunk = Buffer.concat([wavHeader, audioChunk]);

        await fs.writeFile(chunkPath, wavChunk);

        chunkConfigs.push({
            path: chunkPath,
            index: i
        });
    }

    // Process all chunks
    const results = await processChunksInParallel(chunkConfigs, 3); // Process 3 chunks at a time

    // Combine results in order, filtering out failed chunks
    const transcription = results
        .filter(result => result !== null)
        .join(' ');

    return transcription;
}
async function transcribeWithProgress(buffer, audioDuration, userId, job) {
    try {
        // Update job progress
        job.progress(0);

        const transcription = await transcribeAudio(
            buffer,
            audioDuration,
            userId,
            (progress) => {
                job.progress(Math.floor(progress * 50)); // First 50% of total progress
            }
        );

        if (!transcription) {
            throw new Error('Transcription failed to produce results');
        }

        return transcription;

    } catch (error) {
        logError(`Transcription error: ${error.message}`, path.basename(__filename));
        throw error;
    }
}














async function getQueueStats() {
    const waiting = await transcriptionQueue.getWaitingCount();
    const active = await transcriptionQueue.getActiveCount();
    const completed = await transcriptionQueue.getCompletedCount();
    const failed = await transcriptionQueue.getFailedCount();

    console.log(`Queue Stats - Waiting: ${waiting}, Active: ${active}, Completed: ${completed}, Failed: ${failed}`);
}
async function getFailedJobs() {
    const failedJobs = await transcriptionQueue.getFailed();
    console.log(`Total Failed Jobs: ${failedJobs.length}`);

    failedJobs.forEach(async (job) => {

        console.log(`Failed Job ID: ${job.id}`);
        console.log(`Job Data:`, job.data); // Log job data
        console.log(`Error Reason:`, job);

        await deleteBlob(job.data.userId, job.data.fileName)
        await job.remove()// Log the reason for failure   });

    })

}



setInterval(() => {
    getQueueStats();
    getFailedJobs()
}, [300000]);



export default transcriptionQueue;
