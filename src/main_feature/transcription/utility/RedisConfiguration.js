import Bull from 'bull';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
import { convertToWav } from '../controller/transcriptionController.js';
import transcribeAudioAPI from '../../voice_to_text/spechTranscription.js';
import { generateBlogFromText } from '../../voice_to_text/blogGeneration.js';
import sendBlogReadyEmail from './email.js';
import { sendFailureEmail } from './email.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../../utils/logger.js';
import { promises as fs } from 'fs';
import { fromFile } from '../../voice_to_text/spechTranscription.js';
import { PrismaClient } from '@prisma/client';
import { cleanupAudioFile } from '../controller/transcriptionController.js';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

const redisOptions = {
    host: 'redis-18961.c330.asia-south1-1.gce.redns.redis-cloud.com',
    port: 18961,
    password: 'wQvTFCqRgGYH4TVCx0AgB7GiOo44iFvi',
    connectTimeout: 10000,
    retryStrategy: (times) => Math.min(times * 50, 2000),
};

const redis = new Redis(redisOptions);


const transcriptionQueue = new Bull('transcriptionQueue', {
    redis: redisOptions,
    limiter: {
        max: 10, // Max number of jobs to process in parallel
        duration: 1000, // Duration in milliseconds
    },
});

transcriptionQueue.process(async (job) => {
    logInfo(`Processing background task for user ${job.data.userId}`, path.basename(__filename));

    /*if (job.attemptsMade >= job.opts.attempts) {
        await cleanupAudioFile(job.data.audioPath);
    }*/

    const combinedTranscription = [];
    let failedChunks = 0;

    try {
        const audioPath = path.resolve(__dirname, job.data.audioPath);
        console.log(audioPath);


        try {
            await fs.access(audioPath)
        } catch (error) {
            console.log("path not accesssile")
        }


        const buffer = await fs.readFile(audioPath);
        console.log(buffer)
        //const userSelectedLanguage = job.data.language || 'en-US';




        const chunkDuration = 150;
        const chunks = Math.ceil(job.data.audioDuration / chunkDuration);

        const totalDurationInSeconds = job.data.audioDuration;
        const bytesPerChunk = Math.floor(buffer.length / totalDurationInSeconds * chunkDuration);


        console.log(`Bytes per chunk: ${bytesPerChunk}`);
        const promises = [];


        for (let i = 0; i < chunks; i++) {
            const startByte = i * bytesPerChunk;
            const endByte = Math.min((i + 1) * bytesPerChunk, buffer.length);

            console.log(`Chunk ${i}: Start Byte: ${startByte}, End Byte: ${endByte}`);

            if (startByte >= buffer.length || endByte > buffer.length) {
                console.log(`Chunk ${i} is out of buffer bounds.`);
                break;
            }

            const audioChunk = buffer.slice(startByte, endByte);
            const chunkWavOutputPath = path.join(__dirname, `chunk-${job.data.userId}-${i}-${Date.now()}.wav`);
            console.log(`Chunk ${i} size: ${audioChunk.length} bytes`);

            const promise = (async () => {
                await convertToWav(audioChunk, job.data.userId, chunkWavOutputPath);
                const chunkTranscription = await fromFile(chunkWavOutputPath);

                if (!chunkTranscription) {
                    logError(`Transcription failed for chunk ${i}`, path.basename(__filename));
                    failedChunks++;
                } else {
                    combinedTranscription.push(chunkTranscription);
                }

                // Always delete the chunk file, regardless of the transcription success or failure
                try {
                    await fs.unlink(chunkWavOutputPath);
                    console.log(`Deleted chunk file: ${chunkWavOutputPath}`);
                } catch (err) {
                    logError(`Error deleting chunk file: ${chunkWavOutputPath}. Error: ${err.message}`, path.basename(__filename));
                }
            })();

            promises.push(promise);
        }

        // Await all promises to ensure all chunks are processed
        await Promise.all(promises);
        const combinedText = combinedTranscription.join(" ");


        let { title, content, tag } = await generateBlogFromText(combinedText);

        let retry = 2;
        while (title === 'Error' && retry-- > 0) {
            console.log("Retrying blog generation...");
            const result = await generateBlogFromText(combinedText);
            title = result.title;
            content = result.content;
            tag = result.tag;
        }

        if (title === 'Error') {
            logError("Failed to generate blog after multiple attempts.", path.basename(__filename));
            return 'Failed to generate blog after multiple attempts.';
        }

        const userId = job.data.userId;

        // Create a new post in the database
        await prisma.post.create({
            data: {
                userId: userId,
                title: title,
                tags: tag,
                content: content,
            },
        });

        const blogCountIncrement = 1;
        try {
            await prisma.$transaction([
                prisma.user.update({
                    where: { id: userId },
                    data: { blogCount: { increment: blogCountIncrement } },
                }),
                prisma.subscription.update({
                    where: { userId: userId },
                    data: { remainingPosts: { decrement: 1 } },
                }),
            ]);
        } catch (transactionError) {
            logError(`Failed to update database after transaction: ${transactionError.message}`, path.basename(__filename));
            throw transactionError; // Ensure to throw the error to handle it later
        }

        await sendBlogReadyEmail(job.data.userPlan.user.email, job.data.userPlan.user.name, title);

    } catch (error) {
        logError(error.message, path.basename(__filename), "inside redis configuration");
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
        console.log(`Error Reason:`, job.failedReason);
        await cleanupAudioFile(job.data.audioPath)

        await job.remove()// Log the reason for failure   });

    })

}



setInterval(() => {
    getQueueStats();
    getFailedJobs()

}, 5000)
export default transcriptionQueue;
