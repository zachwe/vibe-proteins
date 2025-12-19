import { Link } from "react-router-dom";

// Placeholder challenge data
const challenges = [
  {
    id: "spike-rbd",
    name: "SARS-CoV-2 Spike RBD",
    level: 1,
    difficulty: 1,
    taskType: "binder",
    description: "Design a binder for the Spike receptor-binding domain",
  },
  {
    id: "il-6",
    name: "IL-6 (Interleukin-6)",
    level: 1,
    difficulty: 2,
    taskType: "binder",
    description: "Design a binder for this small, stable cytokine",
  },
  {
    id: "vegf-a",
    name: "VEGF-A",
    level: 1,
    difficulty: 2,
    taskType: "binder",
    description: "Design a binder for this symmetric dimer growth factor",
  },
];

const levelColors: Record<number, string> = {
  1: "bg-green-600",
  2: "bg-yellow-600",
  3: "bg-orange-600",
  4: "bg-red-600",
};

export default function Challenges() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <Link to="/" className="text-blue-400 hover:text-blue-300">
            &larr; Back to Home
          </Link>
        </div>

        <h1 className="text-3xl font-bold text-white mb-8">
          Protein Design Challenges
        </h1>

        <div className="grid gap-4">
          {challenges.map((challenge) => (
            <Link
              key={challenge.id}
              to={`/challenges/${challenge.id}`}
              className="bg-slate-800 rounded-lg p-6 hover:bg-slate-750 transition-colors block"
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className={`${levelColors[challenge.level]} text-white text-xs font-semibold px-2 py-1 rounded`}
                    >
                      Level {challenge.level}
                    </span>
                    <span className="text-slate-500 text-sm">
                      {challenge.taskType}
                    </span>
                  </div>
                  <h2 className="text-xl font-semibold text-white mb-2">
                    {challenge.name}
                  </h2>
                  <p className="text-slate-400">{challenge.description}</p>
                </div>
                <div className="text-slate-500">
                  {"★".repeat(challenge.difficulty)}
                  {"☆".repeat(5 - challenge.difficulty)}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
