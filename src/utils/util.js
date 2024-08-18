const date = require('date-and-time');
const crypto = require('crypto');
const nodemailer = require('nodemailer');


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
    service: 'gmail',
    port: 465,
    secure: true,
    logger: true,
    debug: true,


    auth: {
        user: 'ajay8182831490@gmail.com',
        pass: 'twgy htmx zxkp lgec',
        method: 'login'
    },
    tls: {
        rejectUnauthorized: false
    }
});
const sendEmail = (email, token) => {
    const mailOptions = {
        from: 'ajay8182831490@gmail.com',
        to: email,
        subject: 'reset password',
        html: `<p>Click on the link for reset password <a href="http://localhost:3000/resetPassword?token=${token}">Reset Password</a>
>here</a></p>`
    };



    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};
const sendEmailforOtp = (email, otp) => {
    const mailOptions = {
        from: 'ajay8182831490@gmail.com',
        to: email,
        subject: 'verify account',
        html: `<p>your one time password (otp) is ${otp}
  </p>`,
    };

    transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
            console.log(error);
        } else {
            console.log('Email sent: ' + info.response);
        }
    });
};
function generateOTP() {
    const otpLength = 6;
    const min = Math.pow(10, otpLength - 1);
    const max = Math.pow(10, otpLength) - 1;
    return Math.floor(Math.random() * (max - min + 1)) + min;
}






module.exports = {
    getDate,
    addMinuteToCurrentDate,
    getToken,
    sendEmail,
    generateOTP, sendEmailforOtp


}

