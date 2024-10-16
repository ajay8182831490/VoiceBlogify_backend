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
    host: 'redis-18961.c330.asia-south1-1.gce.redns.redis-cloud.com',
    port: 18961,
    password: 'wQvTFCqRgGYH4TVCx0AgB7GiOo44iFvi',
    connectTimeout: 10000,
    retryStrategy: (times) => Math.min(times * 50, 2000),
};

const redis = new Redis(redisOptions);


const transcriptionQueue = new Bull('transcriptionQueue', {
    redis: redisOptions,

});

transcriptionQueue.process(async (job) => {
    console.log('Received job:', JSON.stringify(job, null, 2));

    if (!job) {
        console.error('Job object is undefined');
        throw new Error('Job object is undefined');
    }

    if (typeof job !== 'object') {
        console.error('Job is not an object:', typeof job);
        throw new Error('Job is not an object');
    }

    if (!job.data) {
        console.error('Job data is undefined');
        throw new Error('Job data is undefined');
    }

    if (typeof job.data !== 'object') {
        console.error('Job data is not an object:', typeof job.data);
        throw new Error('Job data is not an object');
    }

    const { fileName, fileDuration: audioDuration, userId, userPlan } = job.data;

    console.log('Extracted job data:', { fileName, audioDuration, userId, userPlan });

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

    logInfo(`Processing transcription for user ${userId}`, path.basename(__filename));

    logInfo(`Processing background task for user ${job?.data?.userId}`, path.basename(__filename));

    try {




        if (job && job.data) {// sometime here error occured
            fileName = job?.data?.fileName;
            audioDuration = job?.data?.fileDuration;
            userId = job?.data?.userId;
            userPlan = job?.data?.userPlan;
        } else {
            console.error('Job data is missing');
            return; // or handle error
        }
        console.log(fileName, audioDuration, userId, userPlan)
        // now we will  download the blob

        const buffer = await downloadBlob(userId, fileName)
        console.log(buffer);



        const combinedTranscription = [];
        let failedChunks = 0;







        const userSelectedLanguage = 'en-US';




        const chunkDuration = 150;
        const chunks = Math.ceil(audioDuration / chunkDuration);


        const bytesPerChunk = Math.floor(buffer.length / audioDuration * chunkDuration);


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
            const chunkWavOutputPath = path.join(__dirname, `chunk-${userId}-${i}-${Date.now()}.wav`);
            console.log(`Chunk ${i} size: ${audioChunk.length} bytes`);

            const promise = (async () => {
                await convertToWav(audioChunk, userId, chunkWavOutputPath);
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
        return {}


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
        console.log(`Error Reason:`, job);

        // await deleteBlob(job.data.userId, job.data.fileName)
        await job.remove()// Log the reason for failure   });

    })

}



setInterval(() => {
    getQueueStats();
    getFailedJobs()

}, 10000)
export default transcriptionQueue;
