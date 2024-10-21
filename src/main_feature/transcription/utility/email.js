import nodemailer from 'nodemailer'
import dotenev from 'dotenv'
dotenev.config();



const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'voiceblogify@gmail.com',
        pass: process.env.voiceblogify_email_password,
    },



});


const sendBlogReadyEmail = (userEmail, userName, blogTitle) => {


    const mailOptions = {
        from: '"VoiceBlogify" <voiceblogify@gmail.com>',
        to: userEmail,
        subject: `Your Blog "${blogTitle}" is Ready!`,
        text: `Hi ${userName},\n\nYour blog titled "${blogTitle}" is now live! You can start sharing your thoughts and insights with the world.\n\nYou can view your blog and manage your posts at: https://www.voiceblogify.in/dashboard/user-posts\n\nHappy Blogging!\n\nBest Regards,\nThe VoiceBlogify Team`,
        html: `<p>Hi ${userName},</p><p>Your blog titled <strong>"${blogTitle}"</strong> is now live! You can start sharing your thoughts and insights with the world.</p><p>You can view your blog and manage your posts at: <a href="https://www.voiceblogify.in/dashboard/user-posts">https://www.voiceblogify.in/dashboard/user-posts</a></p><p>Happy Blogging!</p><p>Best Regards,<br>The VoiceBlogify Team</p>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Error sending email: ', error);
        }

    });
};
export const sendFailureEmail = async (userEmail, userName) => {
    const mailOptions = {
        from: '"VoiceBlogify" <voiceblogify@gmail.com>',
        to: userEmail,
        subject: `Blog Generation Failed`,
        text: `Hi ${userName},\n\nWe encountered an issue while generating your blog. Please try again later.\n\nBest Regards,\nThe VoiceBlogify Team`,
        html: `<p>Hi ${userName},</p><p>We encountered an issue while generating your blog. Please try again later.</p><p>Best Regards,<br>The VoiceBlogify Team</p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Failure notification email sent successfully.');
    } catch (error) {
        console.log('Error sending failure notification email: ', error);
    }
};
export const sendFailureEmail1 = async (userEmail, cause) => {
    const mailOptions = {
        from: '"VoiceBlogify" <voiceblogify@gmail.com>',
        to: userEmail,
        subject: `Blog Generation Failed`,
        text: ` ${cause}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Failure notification email sent successfully.');
    } catch (error) {
        console.log('Error sending failure notification email: ', error);
    }
};
export default sendBlogReadyEmail

