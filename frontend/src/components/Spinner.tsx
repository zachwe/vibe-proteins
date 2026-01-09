/**
 * Spinner Component
 *
 * Pulsing dots loading indicator.
 */

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  color?: "blue" | "white" | "purple";
  className?: string;
}

const sizeClasses = {
  sm: "h-1.5 w-1.5",
  md: "h-2 w-2",
  lg: "h-3 w-3",
};

const gapClasses = {
  sm: "gap-1",
  md: "gap-1.5",
  lg: "gap-2",
};

const colorClasses = {
  blue: "bg-blue-500",
  white: "bg-white",
  purple: "bg-purple-500",
};

export default function Spinner({ size = "md", color = "blue", className = "" }: SpinnerProps) {
  const dotSize = sizeClasses[size];
  const gap = gapClasses[size];
  const dotColor = colorClasses[color];

  return (
    <div className={`flex items-center ${gap} ${className}`} role="status" aria-label="Loading">
      <div
        className={`${dotSize} rounded-full ${dotColor} animate-pulse-dot`}
        style={{ animationDelay: "0ms" }}
      />
      <div
        className={`${dotSize} rounded-full ${dotColor} animate-pulse-dot`}
        style={{ animationDelay: "150ms" }}
      />
      <div
        className={`${dotSize} rounded-full ${dotColor} animate-pulse-dot`}
        style={{ animationDelay: "300ms" }}
      />
    </div>
  );
}
