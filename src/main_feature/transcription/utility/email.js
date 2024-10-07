import nodemailer from 'nodemailer'


const transporter = nodemailer.createTransport({
    host: 'gmail',
    port: 465,
    secure: true,
    auth: {
        user: 'your-email@example.com',
        pass: 'your-email-password',
    },
});


const sendBlogReadyEmail = (userEmail, userName, blogTitle) => {
    const mailOptions = {
        from: '"VoiceBlogify" <your-email@example.com>', // Sender address
        to: userEmail,
        subject: `Your Blog "${blogTitle}" is Ready!`, // Subject line
        text: `Hi ${userName},\n\nYour blog titled "${blogTitle}" is now live! You can start sharing your thoughts and insights with the world.\n\nHappy Blogging!\n\nBest Regards,\nThe VoiceBlogify Team`, // Plain text body
        html: `<p>Hi ${userName},</p><p>Your blog titled <strong>"${blogTitle}"</strong> is now live! You can start sharing your thoughts and insights with the world.</p><p>Happy Blogging!</p><p>Best Regards,<br>The VoiceBlogify Team</p>`,
    };


    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            return console.log('Error sending email: ', error);
        }

    });
};
export const sendFailureEmail = async (userEmail, userName) => {
    const mailOptions = {
        from: '"VoiceBlogify" <your-email@example.com>', // Sender address
        to: userEmail,
        subject: `Blog Generation Failed`, // Subject line
        text: `Hi ${userName},\n\nWe encountered an issue while generating your blog. Please try again later.\n\nBest Regards,\nThe VoiceBlogify Team`, // Plain text body
        html: `<p>Hi ${userName},</p><p>We encountered an issue while generating your blog. Please try again later.</p><p>Best Regards,<br>The VoiceBlogify Team</p>`,
    };

    try {
        await transporter.sendMail(mailOptions); // Send email
        console.log('Failure notification email sent successfully.'); // Log success
    } catch (error) {
        console.log('Error sending failure notification email: ', error); // Log error
    }
};
export default sendBlogReadyEmail

