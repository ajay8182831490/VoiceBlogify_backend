import cron from 'node-cron';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Configure Nodemailer
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'voiceblogify@gmail.com',
        pass: process.env.voiceblogify_email_password,
    },
});

// Function to send emails
const sendEmail = async (to, subject, text) => {
    try {
        await transporter.sendMail({
            from: 'voiceblogify@gmail.com',
            to,
            subject,
            text,
        });
    } catch (error) {
        console.error('Error sending email:', error);
    }
};

// Schedule tasks
const startCronJobs = () => {
    // 1. Nullify Expired OTPs
    cron.schedule('0 * * * *', async () => {
        try {
            const currentTime = new Date();
            await prisma.user.updateMany({
                where: {
                    otp: { not: null },
                    expiryTime: { lte: currentTime },
                },
                data: {
                    otp: null,
                    expiryTime: null,
                },
            });
            console.log('Expired OTPs have been nullified.');
        } catch (error) {
            console.error('Error nullifying expired OTPs:', error);
        }
    });

    // 2. Remove Token Keys for Inactive Users

    cron.schedule('0 0 * * *', async () => {
        try {
            const currentTime = new Date();
            const expirationTime = new Date();
            expirationTime.setDate(expirationTime.getDate() - 7);
            console.log(expirationTime)

            await prisma.user.updateMany({
                where: {
                    lastActiveDay: { lte: expirationTime },
                    userAccessToken: { not: null },
                },
                data: {
                    userAccessToken: null,
                    RefreshToken: null,
                },
            });

            // Then, delete tokens from the Token table for those inactive users
            await prisma.token.deleteMany({
                where: {
                    user: {
                        lastActiveDay: { lte: expirationTime },
                        //userAccessToken: { not: null },
                    },
                },
            });
            console.log('Token keys of inactive users have been removed.');
        } catch (error) {
            console.error('Error removing token keys:', error);
        }
    });

    // 3. Send Subscription Reminder Email When 2 Days Remain
    cron.schedule('0 9 * * *', async () => {
        try {
            const currentTime = new Date();
            const expirationTime = new Date();
            expirationTime.setDate(expirationTime.getDate() + 2);

            const users = await prisma.subscription.findMany({
                where: {
                    nextDueDate: {
                        gte: currentTime,
                        lt: expirationTime,
                    },
                    status: 'ACTIVE',
                },
                include: {
                    user: true,
                },
            });

            for (const user of users) {
                await sendEmail(
                    user.user.email,
                    'Subscription Reminder',
                    `Hello ${user.user.name}, your subscription is about to expire in 2 days. Please renew it to continue enjoying our services.`
                );
            }

            console.log('Subscription reminder emails have been sent.');
        } catch (error) {
            console.error('Error sending subscription reminder emails:', error);
        }
    });

    // 4. Update User Status and Send Expiry Email After Subscription Ends
    cron.schedule('0 0 * * *', async () => {
        try {
            const currentTime = new Date();

            // First, update subscriptions that meet the condition
            await prisma.subscription.updateMany({
                where: {
                    nextDueDate: { lt: currentTime },
                    status: 'ACTIVE',
                },
                data: {
                    remainingPosts: 0,
                    status: 'DISABLED',
                },
            });

            // Fetch the updated subscriptions to send emails
            const expiredSubscriptions = await prisma.subscription.findMany({
                where: {
                    nextDueDate: { lt: currentTime },
                    status: 'DISABLED',
                },
            });

            for (const subscription of expiredSubscriptions) {
                const user = await prisma.user.findUnique({ where: { id: subscription.userId } });
                if (user) {
                    await sendEmail(
                        user.email,
                        'Subscription Expired',
                        `Hello ${user.name}, your subscription has expired. Please renew to regain full access to our services.`
                    );
                }
            }

            console.log('User subscriptions have been updated after expiry, and emails have been sent.');
        } catch (error) {
            console.error('Error updating user subscriptions and sending expiry emails:', error);
        }
    });

};

export default { start: startCronJobs };
