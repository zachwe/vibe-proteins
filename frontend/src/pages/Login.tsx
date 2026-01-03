import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { signIn, sendVerificationEmail } from "../lib/auth";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailNotVerified, setEmailNotVerified] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setEmailNotVerified(false);
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });

      if (result.error) {
        const errorMsg = result.error.message || "Failed to sign in";
        // Check if it's an email verification error
        if (errorMsg.toLowerCase().includes("email") && errorMsg.toLowerCase().includes("verif")) {
          setEmailNotVerified(true);
        } else {
          setError(errorMsg);
        }
      } else {
        navigate("/challenges");
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    try {
      await sendVerificationEmail({
        email,
        callbackURL: "/verified",
      });
      setResendSuccess(true);
    } catch {
      setError("Failed to resend verification email");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Helmet>
        <title>Sign In | ProteinDojo</title>
        <meta name="description" content="Sign in to ProteinDojo to continue designing proteins." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Sign In to ProteinDojo
        </h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        {emailNotVerified && (
          <div className="bg-yellow-500/10 border border-yellow-500 text-yellow-400 rounded-lg p-4 mb-4">
            <p className="font-medium mb-2">Email not verified</p>
            <p className="text-sm text-yellow-300 mb-3">
              Please check your email and click the verification link to continue.
            </p>
            {resendSuccess ? (
              <p className="text-sm text-green-400">Verification email sent! Check your inbox.</p>
            ) : (
              <button
                onClick={handleResendVerification}
                disabled={resendLoading}
                className="text-sm text-yellow-200 underline hover:text-yellow-100 disabled:opacity-50"
              >
                {resendLoading ? "Sending..." : "Resend verification email"}
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Email
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="you@example.com"
              required
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Password
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="••••••••"
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-slate-400">
            Don't have an account?{" "}
            <Link to="/signup" className="text-blue-400 hover:text-blue-300">
              Sign up
            </Link>
          </p>
        </div>

        <div className="mt-4">
          <Link
            to="/"
            className="block text-center text-slate-500 hover:text-slate-400 text-sm"
          >
            &larr; Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
