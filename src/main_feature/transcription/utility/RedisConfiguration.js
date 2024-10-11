import Bull from 'bull';
import Redis from 'ioredis';
import dotenv from 'dotenv';
dotenv.config();
import { convertToWav, transcribeAudio } from '../controller/transcriptionController.js';
import transcribeAudioAPI from '../../voice_to_text/spechTranscription.js';
import { generateBlogFromText } from '../../voice_to_text/blogGeneration.js';
import sendBlogReadyEmail from './email.js';
import { sendFailureEmail } from './email.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { logInfo, logError } from '../../../utils/logger.js';
import { promises as fs } from 'fs';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient()

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
    const tempFileName = `output-${job.data.userId}-${Date.now()}.wav`;
    const wavOutputPath = path.join(__dirname, tempFileName);

    console.log(job.data.userPlan)




    logInfo(`going to process backround for user ${job.data.userId}`, path.basename(__filename))

    try {



        const buffer = await fs.readFile(job.data.audioPath);


        await convertToWav(buffer, wavOutputPath);

        const chunkDuration = 150;
        const chunks = Math.ceil(job.data.audioDuration / chunkDuration);

        console.log("chunks", chunks);
        let combinedTranscription = `Main aaj ek anokhi kahani sunana chahta hoon. Is kahani ka naam hai 'Dosti ki Shakti'. Ek baar ek chhote se gaon mein do doston ka naam tha Ravi aur Sameer. Dono bachpan se saath the aur har mushkil waqt mein ek dusre ka saath dete the.

Ek din, unhone socha ki wo ek naya vyavsay shuru karenge.Unhone mil kar ek choti si bakery kholi, jahan unhone apne haath se banaye hue pastriyaan aur mithaiyan bechne lage.Doston ki dosti aur mehnat se unka vyavsay safal hua.

Is kahani se humein yeh sikhne ko milta hai ki dosti aur mehnat se koi bhi sapna sach ho sakta hai.Doston ki saath hona zindagi ka sabse bada dhan hai.`;

        const userSelectedLanguage = job.data.language || 'en-US';
        /*for (let i = 0; i < chunks; i++) {
            const start = i * chunkDuration;
            const end = (i + 1) * chunkDuration > job.data.audioDuration ? job.data.audioDuration : (i + 1) * chunkDuration;


            const audioChunk = buffer.slice(start * 44100 * 2, end * 44100 * 2);
            const chunkTranscription = await transcribeAudioAPI(audioChunk, userSelectedLanguage);

            combinedTranscription += chunkTranscription + " ";
        }*/        console.log("Transcription completed. Generating blog...");
        const { title, content, tag } = await generateBlogFromText(combinedTranscription);


        let retry = 2;
        let errorOccurred = false;

        if (title === 'Error') {
            while (retry-- > 0) {
                console.log("Retrying blog generation...");
                const result = await generateBlogFromText(combinedTranscription);
                const { title: retryTitle, content: retryContent, tag: retryTag } = result;

                if (retryTitle !== 'Error') {

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
            logError("Failed to generate blog after multiple attempts.", path.basename(__filename))
            await sendFailureEmail(job.data.userPlan.user.email, job.data.userPlan.user.name);
            return ('Failed to generate blog after multiple attempts.');
        } else {
            console.log("Blog generated successfully. Updating database...");

            const userId = job.data.userId;


            await prisma.post.create({
                data: {
                    userId: userId,
                    title: title,
                    tags: tag,
                    content: content
                }
            });


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
                    throw retryError;
                }
            }
        }
        await sendBlogReadyEmail(job.data.userPlan.user.email, job.data.userPlan.user.name, title);



        console.log("Job completed successfully.");
        //return { success: true, userId: job.data.userId, title, content };*/
        return {}



    } catch (error) {
        logError(error, path.basename(__filename));
        throw error;
    } finally {

        try {
            await fs.unlink(wavOutputPath);
            await fs.unlink(job.data.audioPath);
            console.log("Temporary files deleted successfully.");
        } catch (cleanupError) {
            logError("Error deleting temporary files:" + cleanupError, path.basename(__filename));
        }
    }
});

export default transcriptionQueue;
