interface CircularTimerProps {
  timeRemaining: number;
  totalTime: number;
  size?: number;
  strokeWidth?: number;
  isLastFiveSeconds?: boolean;
}

export default function CircularTimer({
  timeRemaining,
  totalTime,
  size = 280,
  strokeWidth = 8,
  isLastFiveSeconds = false,
}: CircularTimerProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = totalTime > 0 ? timeRemaining / totalTime : 1;
  const strokeDashoffset = circumference * (1 - progress);
  
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg) scaleY(-1)' }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e5e5e5"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#10b981"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-linear"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-6xl font-bold tracking-wider text-gray-900">
          {formatTime(timeRemaining)}
        </span>
      </div>
    </div>
  );
}
