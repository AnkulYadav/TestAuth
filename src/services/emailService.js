import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});


export const sendEmail = async (to, subject, html) => {
    await transporter.sendMail({
        from: `"MyApp Support" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        html,
    });
};
