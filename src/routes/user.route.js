import { Router } from "express";
import { signup, loginUser, forgotPassword, resetPassword ,verifyEmail} from "../controllers/user.controller.js";

const router = Router();

router.route("/signup").post(signup);
router.route("/login").post(loginUser);
router.get("/verify-email/:token", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

export default router;