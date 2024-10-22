

import crypto from 'crypto';
import nodemailer from 'nodemailer'

function getDate() {
    let now = new Date();
    let createdAtDate = date.format(now, "YYYY-MM-DD HH:mm:ss");
    return createdAtDate;
}

function generateRandomString(length) {
    return crypto.randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length);
}


function addMinuteToCurrentDate(min) {
    const currentDate = new Date();
    // Add 5 minutes to the current date and time
    const newDate = date.addMinutes(currentDate, min);
    return date.format(newDate, "YYYY-MM-DD HH:mm:ss");
}

function getToken() {
    const staticString = "POST";
    const currentTimeSeconds = new Date().toISOString().replace(/[^\d]/g, "");
    const token =
        staticString +
        currentTimeSeconds +
        generateRandomString(32);
    return token;
}
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: 'voiceblogify@gmail.com',
        pass: process.env.voiceblogify_email_password,
    },



});
const sendEmail = (email, subject, content) => {
    const mailOptions = {
        from: process.env.email,
        to: email,
        subject: subject,
        html: content
    };

    return new Promise((resolve, reject) => {
        transporter.sendMail(mailOptions, (error, info) => {
            if (error) {
                console.log(error);
                reject(error); // Reject the promise on error
            } else {
                console.log('Email sent: ' + info.response);
                resolve(info.response); // Resolve the promise on success
            }
        });
    });
};

const sendEmailforOtp = async (email, otp) => {
    const mailOptions = {
        from: process.env.email,
        to: email,
        subject: 'Verify Account',
        html: `<p>Your one-time password (OTP) is ${otp}</p>`,
    };

    try {
        await transporter.sendMail(mailOptions);
        console.log('Email sent: ' + info.response);
    } catch (error) {
        console.log(error);
    }
};


const sendPaymentSuccessEmail = async (userEmail, userName, planName, paymentAmount) => {

    const subject = 'Payment Successful - Thank You!';
    const text = `Hello ${userName},\n\nThank you for your payment of ${paymentAmount} for the ${planName} plan!\n\nWe appreciate your promptness, and we're thrilled to have you with us. Your subscription will continue without interruption, and you can enjoy all the features our service offers.\n\nIf you have any questions or need assistance, feel free to reach out to our support team.\n\nBest regards,\nThe VoiceBlogify Team`;

    await sendEmail(userEmail, subject, text);
};
const generateOTP = () => {
    const otpLength = 4;
    const min = Math.pow(10, otpLength - 1);
    const max = Math.pow(10, otpLength) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}






export {
    getDate,
    addMinuteToCurrentDate,
    getToken,
    sendEmail,
    generateOTP,
    sendEmailforOtp,
    sendPaymentSuccessEmail


}

