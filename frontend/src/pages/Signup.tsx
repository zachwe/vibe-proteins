import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { signUp } from "../lib/auth";

const isProduction = import.meta.env.PROD;

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect") || "/challenges";
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signUp.email({
        name,
        email,
        password,
        username: username || undefined, // Only include if provided
      });

      if (result.error) {
        setError(result.error.message || "Failed to sign up");
      } else if (isProduction) {
        // In production, show email verification message
        setEmailSent(true);
      } else {
        // In development, no email verification required
        navigate(redirectTo);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Show email verification sent message
  if (emailSent) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Helmet>
          <title>Check Your Email | ProteinDojo</title>
          <meta name="robots" content="noindex" />
        </Helmet>
        <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md text-center">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-white mb-4">
            Check Your Email
          </h1>
          <p className="text-slate-300 mb-6">
            We sent a verification link to <span className="text-white font-semibold">{email}</span>.
            Click the link to verify your email and complete your registration.
          </p>
          <p className="text-slate-400 text-sm mb-6">
            Didn't receive the email? Check your spam folder or try signing up again.
          </p>
          <Link
            to={`/login${redirectTo !== "/challenges" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Helmet>
        <title>Sign Up | ProteinDojo</title>
        <meta name="description" content="Create a free ProteinDojo account to start designing proteins." />
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-white mb-6 text-center">
          Create Your Account
        </h1>

        {error && (
          <div className="bg-red-500/10 border border-red-500 text-red-500 rounded-lg p-3 mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Your name"
              required
            />
          </div>
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-300 mb-1"
            >
              Username
              <span className="text-slate-500 font-normal ml-1">(shown on leaderboards)</span>
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="protein_designer"
              pattern="[a-z0-9_-]+"
              minLength={3}
              maxLength={20}
              required
            />
            <p className="text-xs text-slate-500 mt-1">Lowercase letters, numbers, underscores, dashes only</p>
          </div>
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
              minLength={8}
              required
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            {loading ? "Creating account..." : "Sign Up"}
          </button>
        </form>

        <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
          <p className="text-slate-400 text-sm text-center">
            Pay only for what you use - <span className="text-white font-semibold">per-second GPU billing</span>
          </p>
        </div>

        <div className="mt-6 text-center">
          <p className="text-slate-400">
            Already have an account?{" "}
            <Link
              to={`/login${redirectTo !== "/challenges" ? `?redirect=${encodeURIComponent(redirectTo)}` : ""}`}
              className="text-blue-400 hover:text-blue-300"
            >
              Sign in
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
