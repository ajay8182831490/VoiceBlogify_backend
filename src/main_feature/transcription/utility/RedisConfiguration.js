import Bull from 'bull';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
import { convertToWav, transcribeAudio, } from '../controller/transcriptionController.js';
import transcribeAudioAPI from '../../voice_to_text/spechTranscription.js';

import { generateBlogFromText } from '../../voice_to_text/blogGeneration.js';
import sendBlogReadyEmail from './email.js';
import { sendFailureEmail } from './email.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../../utils/logger.js';
import { unlink } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import fs from 'fs'

const redisOptions = {
    host: 'redis-18961.c330.asia-south1-1.gce.redns.redis-cloud.com',
    port: 18961,
    password: 'wQvTFCqRgGYH4TVCx0AgB7GiOo44iFvi',
    //tls: { rejectUnauthorized: false },
    connectTimeout: 10000, // Increase timeout (in milliseconds)
    retryStrategy: (times) => Math.min(times * 50, 2000) // Backoff strategy
};



const redis = new Redis(redisOptions)



const transcriptionQueue = new Bull('transcriptionQueue', {
    redis: redisOptions,
});





transcriptionQueue.process(async (job) => {


    const tempFileName = `output-${job.data.userId}-${Date.now()}.wav`;
    const wavOutputPath = path.join(__dirname, tempFileName);

    try {





        console.log(job.data.audioPath)

        const buffer = await fs.readFile(job.data.audioPath);
        console.log(buffer);
        await convertToWav(buffer, wavOutputPath);

        /* const chunkDuration = 150;
         const chunks = Math.ceil(job.data.audioDuration / chunkDuration);
         let combinedTranscription = "";
 
         const userSelectedLanguage = job.data.language || 'en-US';
 
         for (let i = 0; i < chunks; i++) {
             const start = i * chunkDuration;
             const end = (i + 1) * chunkDuration > job.data.audioDuration ? job.data.audioDuration : (i + 1) * chunkDuration;
 
             // Adjust the buffer slicing logic according to your audio format
             const audioChunk = fs.readFileSync(wavOutputPath).slice(start * 44100 * 2, end * 44100 * 2);
 
             const chunkTranscription = await transcribeAudioAPI(audioChunk, userSelectedLanguage);
             combinedTranscription += chunkTranscription + " ";
         }
 
         console.log("Transcription completed. Generating blog...");
         const { title, content, tag } = await generateBlogFromText(combinedTranscription);
 
         let retry = 2;
         let errorOccurred = false;
 
         if (title === 'Error') {
             while (retry-- > 0) {
                 console.log("Retrying blog generation...");
                 const result = await generateBlogFromText(combinedTranscription);
                 const { title: retryTitle, content: retryContent, tag: retryTag } = result;
 
                 if (retryTitle !== 'Error') {
                     // If the retry is successful, update values
                     title = retryTitle;
                     content = retryContent;
                     tag = retryTag;
                     errorOccurred = false;
                     break;
                 }
 
                 errorOccurred = true;
             }
         }
 
         if (errorOccurred) {
             console.error("Failed to generate blog after multiple attempts.");
             await sendFailureEmail(job.data.userEmail, job.data.userName);
             return ('Failed to generate blog after multiple attempts.');
         } else {
             console.log("Blog generated successfully. Updating database...");
 
             const userId = job.data.userId;
 
             // Create the post in the database
             await prisma.post.create({
                 data: {
                     userId: userId,
                     title: title,
                     tags: tag,
                     content: content
                 }
             });
 
             // Update blog count and decrement remaining posts
             const blogCountIncrement = 1;
             try {
                 await prisma.$transaction([
                     prisma.user.update({
                         where: { id: userId },
                         data: { blogCount: { increment: blogCountIncrement } }
                     }),
                     prisma.subscription.update({
                         where: { userId: userId },
                         data: { remainingPosts: { decrement: 1 } }
                     })
                 ]);
             } catch (transactionError) {
                 console.error("Error during database transaction:", transactionError);
 
                 // Retry the transaction logic once
                 try {
                     await prisma.$transaction([
                         prisma.user.update({
                             where: { id: userId },
                             data: { blogCount: { increment: blogCountIncrement } }
                         }),
                         prisma.subscription.update({
                             where: { userId: userId },
                             data: { remainingPosts: { decrement: 1 } }
                         })
                     ]);
                 } catch (retryError) {
                     console.error("Failed to update database after retry:", retryError);
                     throw retryError; // Rethrow the error to mark job as failed
                 }
             }
         }
 
         console.log("Job completed successfully.");*/
        //return { success: true, userId: job.data.userId, title, content }; // Return success result 
        return {};

    } catch (error) {
        console.error("Error processing job:", error);
        throw error; // Mark job as failed
    } finally {
        // Always clean up temporary files
        try {
            await fs.unlink(wavOutputPath);
            await fs.unlink(job.data.audioPath);
            console.log("Temporary files deleted successfully.");
        } catch (cleanupError) {
            console.error("Error deleting temporary files:", cleanupError);
        }
    }
});








export default transcriptionQueue;
