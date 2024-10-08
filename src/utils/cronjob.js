
import cron from 'node-cron';
import nodemailer from 'nodemailer'
import { PrismaClient } from '@prisma/client';
import { logError } from './logger';
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
        logError('Error nullifying expired OTPs:', error);
    }
});


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
        logError('Error removing token keys:', error);
    }
});

// 3. Send Subscription Reminder Email When 2 Days Remain
cron.schedule('0 9 * * *', async () => { // Every day at 9 AM
    try {
        const currentTime = new Date();
        const expirationTime = new Date();
        expirationTime.setDate(expirationTime.getDate() + 2); // 2 days from now

        const users = await prisma.subscription.findMany({
            where: {
                expiryDate: {
                    gte: currentTime,
                    lt: expirationTime,
                },
                isActive: true,
            },
            include: {
                user: true, // Assuming you have a relation to user
            },
        });

        const transporter = nodemailer.createTransport({
            // Configure your email settings here
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: {
                user: 'your_email@example.com',
                pass: 'your_password',
            },
        });

        for (const user of users) {
            await transporter.sendMail({
                from: 'your_email@example.com',
                to: user.user.email,
                subject: 'Subscription Reminder',
                text: `Hello ${user.user.name}, your subscription is about to expire in 2 days. Please renew it to continue enjoying our services.`,
            });
        }

        console.log('Subscription reminder emails have been sent.');
    } catch (error) {
        logError('Error sending subscription reminder emails:', error);
    }
});

// 4. Update User Status After Subscription Ends
cron.schedule('0 0 * * *', async () => { // Every day at midnight
    try {
        const currentTime = new Date();

        await prisma.subscription.updateMany({
            where: {
                expiryDate: { lt: currentTime },
                isActive: true,
            },
            data: {
                remainingPosts: 0,
                isActive: false,
            },
        });

        console.log('User subscriptions have been updated after expiry.');
    } catch (error) {
        logError('Error updating user subscriptions:', error);
    }
});

module.exports = cron; // Export the cron module
