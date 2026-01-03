import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useSession } from "../lib/auth";

export default function Verified() {
  const navigate = useNavigate();
  const { data: session, isPending } = useSession();

  // Auto-redirect if already logged in
  useEffect(() => {
    if (!isPending && session) {
      const timer = setTimeout(() => {
        navigate("/challenges");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [session, isPending, navigate]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <Helmet>
        <title>Email Verified | ProteinDojo</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="bg-slate-800 rounded-xl p-8 w-full max-w-md text-center">
        <div className="text-5xl mb-4">&#10003;</div>
        <h1 className="text-2xl font-bold text-white mb-4">
          Email Verified!
        </h1>
        <p className="text-slate-300 mb-6">
          Your email has been verified successfully. You can now access all features of ProteinDojo.
        </p>
        {session ? (
          <p className="text-slate-400 text-sm mb-6">
            Redirecting you to challenges...
          </p>
        ) : (
          <Link
            to="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        )}
      </div>
    </div>
  );
}
