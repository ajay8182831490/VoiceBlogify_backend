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
                    otpExpiry: { lte: currentTime },
                },
                data: {
                    otp: null,
                    otpExpiry: null,
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

            await prisma.user.updateMany({
                where: {
                    lastActive: { lte: expirationTime },
                    tokenKey: { not: null },
                },
                data: {
                    tokenKey: null,
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
                    expiryDate: {
                        gte: currentTime,
                        lt: expirationTime,
                    },
                    isActive: true,
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

            const expiredSubscriptions = await prisma.subscription.updateMany({
                where: {
                    expiryDate: { lt: currentTime },
                    isActive: true,
                },
                data: {
                    remainingPosts: 0,
                    isActive: false,
                },
                returning: true, // Get the updated subscriptions for further processing
            });

            for (const subscription of expiredSubscriptions) {
                const user = await prisma.user.findUnique({ where: { id: subscription.userId } });
                await sendEmail(
                    user.email,
                    'Subscription Expired',
                    `Hello ${user.name}, your subscription has expired. Please renew to regain full access to our services.`
                );
            }

            console.log('User subscriptions have been updated after expiry, and emails have been sent.');
        } catch (error) {
            console.error('Error updating user subscriptions and sending expiry emails:', error);
        }
    });
};
// cron.schedule('* * * * *', () => {
//     console.log('This message prints every minute');
// });

// Export the start function
export default { start: startCronJobs };
