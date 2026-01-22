import { useState, useMemo } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useChallenges, useCreateCustomSubmission, useCurrentUser } from "../lib/hooks";
import { useSession } from "../lib/auth";
import Spinner from "../components/Spinner";

// Valid amino acid characters
const VALID_AA = /^[ACDEFGHIKLMNPQRSTVWY]+$/i;

interface ValidationResult {
  valid: boolean;
  error?: string;
  cleaned: string;
  length: number;
}

function validateSequence(sequence: string): ValidationResult {
  // Remove whitespace and convert to uppercase
  const cleaned = sequence.toUpperCase().replace(/\s/g, "");
  const length = cleaned.length;

  if (!cleaned) {
    return { valid: false, error: "Sequence is required", cleaned, length };
  }

  if (length < 20) {
    return {
      valid: false,
      error: "Sequence too short (minimum 20 residues)",
      cleaned,
      length,
    };
  }

  if (length > 500) {
    return {
      valid: false,
      error: "Sequence too long (maximum 500 residues)",
      cleaned,
      length,
    };
  }

  if (!VALID_AA.test(cleaned)) {
    // Find invalid characters
    const invalid = cleaned
      .split("")
      .filter((c) => !/[ACDEFGHIKLMNPQRSTVWY]/.test(c))
      .filter((c, i, arr) => arr.indexOf(c) === i)
      .join(", ");
    return {
      valid: false,
      error: `Invalid characters: ${invalid}. Use only standard amino acids.`,
      cleaned,
      length,
    };
  }

  return { valid: true, cleaned, length };
}

export default function Submit() {
  const [searchParams] = useSearchParams();
  const preselectedChallengeId = searchParams.get("challengeId");

  const navigate = useNavigate();
  const { data: session, isPending: sessionLoading } = useSession();
  const { data: user } = useCurrentUser();
  const { data: challenges, isLoading: challengesLoading } = useChallenges();
  const createSubmission = useCreateCustomSubmission();

  const [selectedChallengeId, setSelectedChallengeId] = useState(
    preselectedChallengeId || ""
  );
  const [sequence, setSequence] = useState("");

  // Validate sequence on every change
  const validation = useMemo(() => validateSequence(sequence), [sequence]);

  // Get selected challenge
  const selectedChallenge = challenges?.find((c) => c.id === selectedChallengeId);

  // Check if user has sufficient balance
  const hasBalance = (user?.effectiveBalance?.balanceUsdCents ?? 0) >= 10;

  // Can submit
  const canSubmit =
    validation.valid &&
    selectedChallengeId &&
    hasBalance &&
    !createSubmission.isPending;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    try {
      await createSubmission.mutateAsync({
        challengeId: selectedChallengeId,
        designSequence: validation.cleaned,
      });

      // Navigate to submissions page to track progress
      navigate("/submissions");
    } catch (error) {
      // Error is handled by mutation state
      console.error("Submission failed:", error);
    }
  };

  if (sessionLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size="lg" />
        <span className="ml-3 text-slate-400">Loading...</span>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="container mx-auto px-4 py-10 max-w-2xl">
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 text-center">
          <h1 className="text-xl font-semibold text-white mb-2">
            Submit Your Design
          </h1>
          <p className="text-slate-400 mb-4">
            Sign in to submit your custom protein designs for scoring.
          </p>
          <Link
            to="/login"
            className="inline-flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 max-w-2xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-white">Submit Your Design</h1>
        <p className="text-slate-400 text-sm mt-1">
          Submit a protein sequence you designed with your own tools for
          structure prediction and scoring.
        </p>
      </div>

      <div className="space-y-6">
        {/* Challenge Selection */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Select Challenge
          </label>
          <select
            value={selectedChallengeId}
            onChange={(e) => setSelectedChallengeId(e.target.value)}
            disabled={challengesLoading}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">
              {challengesLoading ? "Loading challenges..." : "Choose a challenge"}
            </option>
            {challenges?.map((challenge) => (
              <option key={challenge.id} value={challenge.id}>
                {challenge.name} (Level {challenge.level})
              </option>
            ))}
          </select>
          {selectedChallenge && (
            <p className="text-xs text-slate-400 mt-2">
              {selectedChallenge.description?.slice(0, 150)}
              {(selectedChallenge.description?.length ?? 0) > 150 ? "..." : ""}
            </p>
          )}
        </div>

        {/* Sequence Input */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <label className="block text-sm font-medium text-slate-200 mb-2">
            Binder Sequence
          </label>
          <textarea
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            placeholder="Paste your amino acid sequence here (e.g., MKTAYIAKQRQISFVKSHFSRQLEERLGLIEVQAPILSRVGDGTQDNLSGAEKLVEEMV...)"
            rows={6}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-slate-500"
          />

          {/* Validation feedback */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2">
              {sequence && (
                <>
                  {validation.valid ? (
                    <span className="flex items-center gap-1 text-green-400 text-sm">
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                      Valid sequence
                    </span>
                  ) : (
                    <span className="text-red-400 text-sm">{validation.error}</span>
                  )}
                </>
              )}
            </div>
            <span className="text-xs text-slate-500">
              {validation.length} residues (20-500)
            </span>
          </div>
        </div>

        {/* Cost and Info */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
          <h3 className="text-sm font-medium text-slate-200 mb-3">What happens next</h3>
          <ol className="text-sm text-slate-400 space-y-2 list-decimal list-inside">
            <li>
              Your sequence will be folded with the target using{" "}
              <span className="text-slate-300">Boltz-2</span>
            </li>
            <li>
              The predicted complex will be scored for binding quality
            </li>
            <li>
              Results will appear on the{" "}
              <Link to="/submissions" className="text-blue-400 hover:underline">
                submissions page
              </Link>
            </li>
          </ol>

          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
            <span className="text-sm text-slate-400">Estimated cost</span>
            <span className="text-sm font-medium text-slate-200">~$0.05</span>
          </div>

          {!hasBalance && (
            <div className="mt-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
              <p className="text-sm text-yellow-400">
                Insufficient balance. Please{" "}
                <Link to="/billing" className="underline hover:text-yellow-300">
                  add funds
                </Link>{" "}
                to submit.
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-between">
          <Link
            to="/challenges"
            className="text-sm text-slate-400 hover:text-slate-300"
          >
            Use design tools instead
          </Link>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white font-medium px-6 py-2.5 rounded-lg transition-colors flex items-center gap-2"
          >
            {createSubmission.isPending ? (
              <>
                <Spinner size="sm" color="white" />
                Submitting...
              </>
            ) : (
              "Submit for Scoring"
            )}
          </button>
        </div>

        {/* Error display */}
        {createSubmission.isError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
            <p className="text-sm text-red-400">
              {(createSubmission.error as Error)?.message ||
                "Failed to submit. Please try again."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
