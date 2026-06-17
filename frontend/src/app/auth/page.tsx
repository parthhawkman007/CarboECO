"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useEcoStore } from "@/store/useEcoStore";
import { ShieldCheck, Mail, Lock, ArrowRight, Sparkles, AlertCircle, Fingerprint, RefreshCw } from "lucide-react";
import { easeTokens, microVariants } from "@/utils/motion";
import { getApiUrl } from "@/utils/api";

export default function AuthPage() {
  const [view, setView] = useState<"login" | "register" | "forgot" | "mfa">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState({ score: 0, text: "Too Short", color: "bg-red-500/30 text-red-500" });

  const router = useRouter();
  const loginStore = useEcoStore((state) => state.login);
  const verifyMfaStore = useEcoStore((state) => state.verifyMfa);

  const handleGoogleSignIn = () => {
    setError("");
    setLoading(true);
    setTimeout(() => {
      loginStore("google.user@gmail.com");
      setLoading(false);
      setView("mfa");
    }, 1000);
  };


  const handlePasswordChange = (val: string) => {
    setPassword(val);
    if (val.length < 8) {
      setStrength({ score: 1, text: "Weak (Min 8 chars)", color: "bg-red-500/20 text-red-500 border-red-500/30" });
    } else if (!/\d/.test(val)) {
      setStrength({ score: 2, text: "Medium (Add Numbers)", color: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30" });
    } else if (!/[!@#$%^&*]/.test(val)) {
      setStrength({ score: 3, text: "Strong (Add Symbols)", color: "bg-brand-sky/20 text-brand-sky border-brand-sky/30" });
    } else {
      setStrength({ score: 4, text: "Supreme Protection", color: "bg-brand-emerald/20 text-brand-emerald border-brand-emerald/30" });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim() || !password.trim()) {
      setError("Please complete all credentials fields.");
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append("username", email);
      params.append("password", password);

      const res = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Invalid email or password.");
      }

      const data = await res.json();
      localStorage.setItem("carboeco_access_token", data.access_token);
      loginStore(email);
      setView("mfa");
    } catch (err: any) {
      setError(err.message || "An authentication error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must satisfy minimum requirements.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.detail || "Failed to create account.");
      }

      // Automatically log in after registration
      const params = new URLSearchParams();
      params.append("username", email);
      params.append("password", password);

      const loginRes = await fetch(`${getApiUrl()}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: params
      });

      if (!loginRes.ok) {
        throw new Error("Account created but failed to sign in automatically.");
      }

      const data = await loginRes.json();
      localStorage.setItem("carboeco_access_token", data.access_token);
      loginStore(email);
      setView("mfa");
    } catch (err: any) {
      setError(err.message || "An error occurred during registration.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (mfaCode.length !== 6) {
      setError("Please enter a valid 6-digit verification pin.");
      return;
    }
    setLoading(true);
    setTimeout(() => {
      verifyMfaStore();
      setLoading(false);
      router.push("/dashboard");
    }, 1000);
  };

  const formVariants = {
    enter: { opacity: 0, x: 50 },
    center: { opacity: 1, x: 0, transition: { ease: easeTokens.apple, duration: 0.4 } },
    exit: { opacity: 0, x: -50, transition: { ease: easeTokens.apple, duration: 0.3 } }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center py-12 relative overflow-hidden">
      {/* Background visual meshes */}
      <div className="absolute inset-0 bg-gradient-to-r from-brand-emerald/5 to-brand-sky/5 rounded-3xl blur-3xl -z-10" />
      <div className="absolute top-1/4 left-1/4 h-80 w-80 rounded-full bg-brand-emerald/10 blur-[130px] -z-10" />
      <div className="absolute bottom-1/4 right-1/4 h-80 w-80 rounded-full bg-brand-sky/8 blur-[130px] -z-10" />

      <div className="w-full max-w-md glass-card rounded-3xl p-8 border border-white/20 dark:border-brand-borderDark/50 shadow-2xl relative">
        <AnimatePresence mode="wait">
          {view === "login" && (
            <motion.div key="login" variants={formVariants} initial="enter" animate="center" exit="exit" className="flex flex-col gap-6">
              <div className="text-center flex flex-col gap-2">
                <div className="mx-auto p-3 bg-brand-emerald/10 text-brand-emerald rounded-2xl w-fit">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white mt-2">Welcome to CarboECO</h1>
                <p className="text-xs text-gray-400">Access your climate-tech sustainability operating system</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email-login" className="text-[10px] uppercase font-bold text-gray-400">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      id="email-login"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-brand-cardDark/40 border border-gray-200 dark:border-brand-borderDark rounded-xl py-3 pl-10 pr-4 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center">
                    <label htmlFor="password-login" className="text-[10px] uppercase font-bold text-gray-400">Password</label>
                    <button type="button" onClick={() => setView("forgot")} className="text-[10px] text-brand-emerald hover:underline">Forgot password?</button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4 w-4 text-gray-400" />
                    <input
                      id="password-login"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-gray-100 dark:bg-brand-cardDark/40 border border-gray-200 dark:border-brand-borderDark rounded-xl py-3 pl-10 pr-4 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                      required
                    />
                  </div>
                </div>

                <motion.button
                  variants={microVariants}
                  whileHover="hover"
                  whileTap="tap"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-emerald hover:bg-brand-forest text-white py-3 rounded-xl shadow-lg shadow-brand-emerald/10 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors mt-2 disabled:opacity-60"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <span>Secure Login</span>
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </motion.button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-brand-borderDark/30"></div>
                <span className="flex-shrink mx-4 text-[9px] text-gray-400 uppercase font-bold">Or continue with</span>
                <div className="flex-grow border-t border-gray-200 dark:border-brand-borderDark/30"></div>
              </div>

              <motion.button
                variants={microVariants}
                whileHover="hover"
                whileTap="tap"
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-white dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark hover:bg-gray-50 dark:hover:bg-brand-cardDark/80 text-gray-700 dark:text-gray-200 py-3 rounded-xl shadow-md font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61a5.66 5.66 0 0 1-2.45 3.72v3.08h3.95c2.31-2.13 3.63-5.26 3.63-8.65z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.95-3.08c-1.1.74-2.5 1.18-3.98 1.18-3.07 0-5.67-2.08-6.6-4.88H1.38v3.18A11.996 11.996 0 0 0 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.4 14.31A7.16 7.16 0 0 1 5 12c0-.8.14-1.58.4-2.31V6.51H1.38A11.996 11.996 0 0 0 0 12c0 2.24.62 4.33 1.69 6.13l3.71-2.82z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.38 6.51l4.02 3.18c.93-2.8 3.53-4.94 6.6-4.94z"
                  />
                </svg>
                <span>Google Account</span>
              </motion.button>

              <div className="text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-brand-borderDark/40 pt-4">
                Don't have an account?{" "}
                <button type="button" onClick={() => setView("register")} className="text-brand-emerald font-bold hover:underline">Create Account</button>
              </div>
            </motion.div>
          )}

          {view === "register" && (
            <motion.div key="register" variants={formVariants} initial="enter" animate="center" exit="exit" className="flex flex-col gap-6">
              <div className="text-center flex flex-col gap-2">
                <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white">Create Carbon Account</h1>
                <p className="text-xs text-gray-400">Join the global movement for a carbon-neutral planet</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email-reg" className="text-[10px] uppercase font-bold text-gray-400">Email Address</label>
                  <input
                    id="email-reg"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-brand-cardDark/40 border border-gray-200 dark:border-brand-borderDark rounded-xl py-3 px-4 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="password-reg" className="text-[10px] uppercase font-bold text-gray-400">Password</label>
                  <input
                    id="password-reg"
                    type="password"
                    placeholder="Min 8 characters"
                    value={password}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-brand-cardDark/40 border border-gray-200 dark:border-brand-borderDark rounded-xl py-3 px-4 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                    required
                  />
                  {password.length > 0 && (
                    <div className={`p-2 rounded-lg border text-[10px] font-semibold mt-1 text-center border-white/10 ${strength.color}`}>
                      {strength.text}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="confirm-pass-reg" className="text-[10px] uppercase font-bold text-gray-400">Confirm Password</label>
                  <input
                    id="confirm-pass-reg"
                    type="password"
                    placeholder="••••••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full bg-gray-100 dark:bg-brand-cardDark/40 border border-gray-200 dark:border-brand-borderDark rounded-xl py-3 px-4 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                    required
                  />
                </div>

                <motion.button
                  variants={microVariants}
                  whileHover="hover"
                  whileTap="tap"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-emerald hover:bg-brand-forest text-white py-3 rounded-xl shadow-lg shadow-brand-emerald/10 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors mt-2 disabled:opacity-60"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Register Account</span>
                  )}
                </motion.button>
              </form>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-gray-200 dark:border-brand-borderDark/30"></div>
                <span className="flex-shrink mx-4 text-[9px] text-gray-400 uppercase font-bold">Or continue with</span>
                <div className="flex-grow border-t border-gray-200 dark:border-brand-borderDark/30"></div>
              </div>

              <motion.button
                variants={microVariants}
                whileHover="hover"
                whileTap="tap"
                type="button"
                onClick={handleGoogleSignIn}
                className="w-full bg-white dark:bg-brand-cardDark border border-gray-200 dark:border-brand-borderDark hover:bg-gray-50 dark:hover:bg-brand-cardDark/80 text-gray-700 dark:text-gray-200 py-3 rounded-xl shadow-md font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v3.92h6.61a5.66 5.66 0 0 1-2.45 3.72v3.08h3.95c2.31-2.13 3.63-5.26 3.63-8.65z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.95-3.08c-1.1.74-2.5 1.18-3.98 1.18-3.07 0-5.67-2.08-6.6-4.88H1.38v3.18A11.996 11.996 0 0 0 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.4 14.31A7.16 7.16 0 0 1 5 12c0-.8.14-1.58.4-2.31V6.51H1.38A11.996 11.996 0 0 0 0 12c0 2.24.62 4.33 1.69 6.13l3.71-2.82z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.69 1.38 6.51l4.02 3.18c.93-2.8 3.53-4.94 6.6-4.94z"
                  />
                </svg>
                <span>Google Account</span>
              </motion.button>

              <div className="text-center text-xs text-gray-500 dark:text-gray-400 border-t border-gray-100 dark:border-brand-borderDark/40 pt-4">
                Already have an account?{" "}
                <button type="button" onClick={() => setView("login")} className="text-brand-emerald font-bold hover:underline">Log in</button>
              </div>
            </motion.div>
          )}

          {view === "forgot" && (
            <motion.div key="forgot" variants={formVariants} initial="enter" animate="center" exit="exit" className="flex flex-col gap-6">
              <div className="text-center flex flex-col gap-2">
                <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white">Recover Password</h1>
                <p className="text-xs text-gray-400">Enter email and we will send recovery instructions</p>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); setView("login"); }} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="email-recover" className="text-[10px] uppercase font-bold text-gray-400">Email Address</label>
                  <input
                    id="email-recover"
                    type="email"
                    placeholder="name@company.com"
                    className="w-full bg-gray-100 dark:bg-brand-cardDark/40 border border-gray-200 dark:border-brand-borderDark rounded-xl py-3 px-4 text-xs focus:border-brand-emerald text-gray-800 dark:text-white"
                    required
                  />
                </div>

                <motion.button
                  variants={microVariants}
                  whileHover="hover"
                  whileTap="tap"
                  type="submit"
                  className="w-full bg-brand-emerald hover:bg-brand-forest text-white py-3 rounded-xl font-semibold text-xs transition-colors mt-2"
                >
                  Send Recovery Email
                </motion.button>
              </form>

              <div className="text-center text-xs text-gray-500 dark:text-gray-400">
                Back to{" "}
                <button type="button" onClick={() => setView("login")} className="text-brand-emerald font-bold hover:underline">Secure login</button>
              </div>
            </motion.div>
          )}

          {view === "mfa" && (
            <motion.div key="mfa" variants={formVariants} initial="enter" animate="center" exit="exit" className="flex flex-col gap-6">
              <div className="text-center flex flex-col gap-2">
                <div className="mx-auto p-3 bg-brand-sky/10 text-brand-sky rounded-2xl w-fit animate-bounce">
                  <Fingerprint className="h-6 w-6" />
                </div>
                <h1 className="font-heading text-2xl font-bold text-gray-900 dark:text-white mt-2">MFA Authentication</h1>
                <p className="text-xs text-gray-400">Enter the 6-digit code from your authenticator app</p>
              </div>

              {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleVerifyMfa} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 items-center">
                  <label htmlFor="mfa-input" className="text-[10px] uppercase font-bold text-gray-400 mb-2">Authenticator Verification Pin</label>
                  <input
                    id="mfa-input"
                    type="text"
                    maxLength={6}
                    placeholder="123456"
                    value={mfaCode}
                    onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ""))}
                    className="w-40 text-center tracking-[0.5em] text-lg font-mono bg-gray-100 dark:bg-brand-cardDark/40 border border-gray-200 dark:border-brand-borderDark rounded-xl py-3 px-4 focus:border-brand-emerald text-gray-800 dark:text-white"
                    required
                  />
                </div>

                <div className="p-3 bg-gray-50/50 dark:bg-brand-cardDark/30 border border-gray-100 dark:border-brand-borderDark/20 rounded-2xl text-[10px] text-gray-400 text-center flex items-center gap-1.5 justify-center mt-2">
                  <Sparkles className="h-3.5 w-3.5 text-brand-sky" />
                  <span>Enter <b>123456</b> or any 6 digits to verify the session.</span>
                </div>

                <motion.button
                  variants={microVariants}
                  whileHover="hover"
                  whileTap="tap"
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-emerald hover:bg-brand-forest text-white py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors mt-2"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <span>Verify & Continue</span>
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
