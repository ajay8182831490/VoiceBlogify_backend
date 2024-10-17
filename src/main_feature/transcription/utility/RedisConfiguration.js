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






transcriptionQueue.process(async (job) => {
    console.log('Received job:', JSON.stringify(job, null, 2));

    // Job data validation
    let { fileName, fileDuration: audioDuration, userId, userPlan } = job.data;
    audioDuration = parseInt(audioDuration, 10);

    if (!fileName || typeof fileName !== 'string') {
        console.error('Invalid fileName:', fileName);
        throw new Error('Invalid fileName');
    }

    if (!audioDuration || typeof audioDuration !== 'number') {
        console.error('Invalid audioDuration:', audioDuration);
        throw new Error('Invalid audioDuration');
    }

    if (!userId || typeof userId !== 'string') {
        console.error('Invalid userId:', userId);
        throw new Error('Invalid userId');
    }

    if (!userPlan || typeof userPlan !== 'object') {
        console.error('Invalid userPlan:', userPlan);
        throw new Error('Invalid userPlan');
    }

    logInfo(`Processing background task for user ${userId}`, path.basename(__filename));

    try {
        // Download audio buffer
        const buffer = await downloadBlob(userId, fileName);
        if (!buffer) {
            throw new Error('Audio buffer download failed');
        }

        const combinedTranscription = [];
        let failedChunks = 0;
        audioDuration = parseFloat(audioDuration, 10);

        const chunkDuration = 200; // 300 seconds
        const chunks = Math.ceil(audioDuration / chunkDuration);
        const bytesPerChunk = Math.floor(buffer.length / audioDuration * chunkDuration);
        console.log(`Bytes per chunk: ${bytesPerChunk}`);

        const promises = [];

        // Process each chunk
        for (let i = 0; i < chunks; i++) {
            const startByte = i * bytesPerChunk;
            const endByte = Math.min((i + 1) * bytesPerChunk, buffer.length);

            console.log(`Chunk ${i}: Start Byte: ${startByte}, End Byte: ${endByte}`);

            if (startByte >= buffer.length || endByte > buffer.length) {
                console.log(`Chunk ${i} is out of buffer bounds.`);
                break;
            }

            const audioChunk = buffer.slice(startByte, endByte);
            const chunkWavOutputPath = path.join(__dirname, `chunk-${userId}-${i}-${Date.now()}.wav`);
            console.log(`Chunk ${i} size: ${audioChunk.length} bytes`);

            const promise = (async () => {
                try {
                    // Convert audio to WAV first
                    await fs.writeFile(chunkWavOutputPath, audioChunk);

                    // Ensure that transcription happens after WAV conversion
                    const chunkTranscription = await fromFile(chunkWavOutputPath);

                    if (!chunkTranscription) {
                        logError(`Transcription failed for chunk ${i}`, path.basename(__filename));
                        failedChunks++;
                    } else {
                        combinedTranscription.push(chunkTranscription);
                    }
                } catch (err) {
                    logError(`Error processing chunk ${i}: ${err.message}`, path.basename(__filename));
                    failedChunks++;
                } finally {
                    // Always delete the chunk file after processing is fully done
                    try {
                        await fs.unlink(chunkWavOutputPath);
                        console.log(`Deleted chunk file: ${chunkWavOutputPath}`);
                    } catch (err) {
                        logError(`Error deleting chunk file: ${chunkWavOutputPath}. Error: ${err.message}`, path.basename(__filename));
                    }
                }
            })();

            promises.push(promise);
        }

        // Wait for all chunks to process
        await Promise.all(promises);

        if (failedChunks > 0) {
            logError(`${failedChunks} chunks failed during transcription`, path.basename(__filename));
        }

        const combinedText = combinedTranscription.join(' ');
        if (!combinedText) {
            logError('Combined transcription text is empty. Skipping blog generation.', path.basename(__filename));
            return 'Combined transcription text is empty. Skipping blog generation.';
        }

        // Generate blog post
        let { title, content, tag } = await generateBlogFromText(combinedText);
        let retry = 2;
        while (title === 'Error' && retry-- > 0) {
            console.log('Retrying blog generation...');
            const result = await generateBlogFromText(combinedText);
            title = result.title;
            content = result.content;
            tag = result.tag;
        }

        if (title === 'Error') {
            logError('Failed to generate blog after multiple attempts.', path.basename(__filename));
            return 'Failed to generate blog after multiple attempts.';
        }

        // Create blog post in database
        await prisma.post.create({
            data: {
                userId,
                title,
                tags: tag,
                content,
            },
        });

        // Update user and subscription in a transaction
        await prisma.$transaction([
            prisma.user.update({
                where: { id: userId },
                data: { blogCount: { increment: 1 } },
            }),
            prisma.subscription.update({
                where: { userId },
                data: { remainingPosts: { decrement: 1 } },
            }),
        ]);

        // Send email notification
        await sendBlogReadyEmail(userPlan.user.email, userPlan.user.name, title);

        return {}; // Return an empty object as successful job result

    } catch (error) {
        logError(error.message, path.basename(__filename), 'inside redis configuration');
        throw error; // Propagate the error
    }
});













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

    await flushCache()

setInterval(() => {
    getQueueStats();
    getFailedJobs()

}, [1000000]);



export default transcriptionQueue;
