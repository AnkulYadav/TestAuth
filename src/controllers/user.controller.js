import { asyncHanlder } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { sendEmail } from "../services/emailService.js";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId)
        const accessToken = user.generateAccessToken()
        const refreshToken = user.generateRefreshToken()
        user.refreshToken = refreshToken
        await user.save({ validateBeforeSave: false })
        return { accessToken, refreshToken }
    } catch (error) {
        throw new ApiError(500, "Something went wrong while generating refresh and access token")
    }
}

const options = {
    httpOnly: true,
    secure: true
}


const signup = asyncHanlder(async (req, res) => {
    const { name, email, password } = req.body;

    if (![name, email, password].every(field => typeof field === 'string' && field.trim() !== "")) {
        throw new ApiError(400, "All fields are required");
    }


    // Validate fullname (min 3 characters)
    if (name.trim().length < 3) {
        throw new ApiError(400, "Full name must be at least 3 characters long");
    }

    // email validation
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    if (!emailRegex.test(email)) {
        throw new ApiError(400, "Only Gmail addresses are allowed");
    }


    // Validate password (min 8 characters, 1 uppercase, 1 number, 1 special character)
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        throw new ApiError(400, "Password must be at least 8 characters long and include at least 1 uppercase letter, 1 number, and 1 special character");
    }

    // Check if user already exists
    const existedUser = await User.findOne({ email: email.toLowerCase() });

    if (existedUser) {
        throw new ApiError(409, "Email already in use");
    }

    // Create new user
    const newUser = new User({
        name,
        email: email.toLowerCase(),
        password,
    });

    await newUser.save();

    // check if user is created
    const createdUser = await User.findById(newUser._id).select("-password -refreshToken");

    if (!createdUser) {
        throw new ApiError(500, "Something went wrong while registering");
    }

    // Generate email verification token
    const verificationToken = jwt.sign({ email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "1h" });

    // Send verification email
    const verificationLink = `${process.env.APP_URL}/api/auth/verify-email/${verificationToken}`;
    await sendEmail(email, "Verify Your Email", `<a href="${verificationLink}">Click to Verify</a>`);

    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered successfully, Please Check Email to Verify you mail...!!!")
    );
});


const loginUser = asyncHanlder(async (req, res) => {
    const { email, password } = req.body

    if (!email) {
        throw new ApiError(400, "Email Is Required Field..!!")
    }
    if (!password) {
        throw new ApiError(400, "Password Is Required Field..!!")
    }
    let user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, 'User Doesn\'t Exist Or Invalid Email')
    }

    const isValidPassord = await user.isPasswordCorrect(password);

    if (!isValidPassord) {
        throw new ApiError(401, 'Invalid Password')
    }

    // Send Access & Refresh Token
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken");

    // cookies
    const options = {
        httpOnly: true,
        secure: true
    }

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(200, {
                user: loggedInUser, accessToken, refreshToken
            }, "User Logged in Successfully")
        )

});
const verifyEmail = asyncHanlder(async (req, res) => {
    const { token } = req.params;
    
    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    const user = await User.findOne({ email: decoded.email });

    if (!user) {
        throw new ApiError(400, "Invalid or expired token");
    }

    user.isVerified = true;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, { message: "Email verified successfully" })
    );
});

const forgotPassword = asyncHanlder(async (req, res) => {
    const { email } = req.body;

    if (!email) {
        throw new ApiError(400, "Email is required");
    }

    let user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, 'User Doesn\'t Exist Or Invalid Email')
    }

    const resetToken = jwt.sign({ email }, process.env.REFRESH_TOKEN_SECRET, { expiresIn: "15m" });

    user.resetToken = resetToken;
    await user.save();

    const resetLink = `${process.env.APP_URL}/reset-password/${resetToken}`;
    await sendEmail(email, "Reset Your Password", `<a href="${resetLink}">Click to Reset Password</a>`);

    return res.status(201).json(
        new ApiResponse(200, { message: "Password reset email sent" })
    );
});

const resetPassword = asyncHanlder(async (req, res) => {

    const { token, password, confirm_password } = req.body;


    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!passwordRegex.test(password)) {
        throw new ApiError(400, "Password must be at least 8 characters long and include at least 1 uppercase letter, 1 number, and 1 special character");
    }

    if (password !== confirm_password) {
        throw new ApiError(400, "Passwords do not match");
    }


    const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findOne({ email: decoded.email });

    if (!user || user.resetToken !== token) {
        throw new ApiError(400, "Invalid token");
    }

    user.password = password;
    user.resetToken = null;
    await user.save();

    return res.status(200).json(
        new ApiResponse(200, { message: "Password reset successful" })
    );
});

export { signup, loginUser, forgotPassword, resetPassword, verifyEmail };