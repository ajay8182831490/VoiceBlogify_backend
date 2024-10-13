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
    console.log(job.data)





    logInfo(`going to process backround for user ${job.data.userId}`, path.basename(__filename))

    try {



        const buffer = await fs.readFile(job.data.audioPath);


        await convertToWav(buffer, wavOutputPath);
        const userSelectedLanguage = job.data.language || 'en-US';



        //console.log("chunks", chunks);
        let combinedTranscription = `Main aaj ek anokhi kahani sunana chahta hoon. Is kahani ka naam hai 'Dosti ki Shakti'. Ek baar ek chhote se gaon mein do doston ka naam tha Ravi aur Sameer. Dono bachpan se saath the aur har mushkil waqt mein ek dusre ka saath dete the.

Ek din, unhone socha ki wo ek naya vyavsay shuru karenge.Unhone mil kar ek choti si bakery kholi, jahan unhone apne haath se banaye hue pastriyaan aur mithaiyan bechne lage.Doston ki dosti aur mehnat se unka vyavsay safal hua.

Is kahani se humein yeh sikhne ko milta hai ki dosti aur mehnat se koi bhi sapna sach ho sakta hai.Doston ki saath hona zindagi ka sabse bada dhan hai.`;





        const chunkDuration = 150;
        const chunks = Math.ceil(job.data.audioDuration / chunkDuration);

        const totalDurationInSeconds = job.data.audioDuration;
        const bytesPerChunk = Math.floor(buffer.length / totalDurationInSeconds * chunkDuration);


        console.log(`Bytes per chunk: ${bytesPerChunk}`);


        for (let i = 0; i < chunks; i++) {
            const startByte = i * bytesPerChunk;
            const endByte = Math.min((i + 1) * bytesPerChunk, buffer.length);

            console.log(`Chunk ${i}: Start Byte: ${startByte}, End Byte: ${endByte}`);

            if (startByte >= buffer.length || endByte > buffer.length) {
                console.log(`Chunk ${i} is out of buffer bounds.`);
                break;
            }

            const audioChunk = buffer.slice(startByte, endByte);
            console.log(`Chunk ${i} size: ${audioChunk.length} bytes`);
            const chunkTranscription = await transcribeAudioAPI(audioChunk, userSelectedLanguage);

            //combinedTranscription += chunkTranscription + " ";

        }

        // Process the audioChunk...




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

                    logError("Failed to update database after retry", path.basename(__filename));
                    throw retryError;
                }
            }
        }
        await sendBlogReadyEmail(job.data.userPlan.user.email, job.data.userPlan.user.name, title);




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
// transcriptionQueue.on('completed', (job) => {
//     console.log(`Job completed with result ${job.returnvalue}`);
// });



// transcriptionQueue.on('progress', (job, progress) => {
//     console.log(`Job ${job.id} progress: ${progress}%`);
// });
transcriptionQueue.on('failed', (job, err) => {
    console.error(`Job ${job.id} failed:`, err);

    sendFailureEmail(job.data.userPlan.user.email, job.data.userPlan.user.name,);
})


export default transcriptionQueue;
