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
    host: process.env.redies,
    port: 18961,
    password: process.env.redies_password,
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

    let { fileName, fileDuration: audioDuration, userId, userPlan } = job.data;

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
}, [10000]);



export default transcriptionQueue;
