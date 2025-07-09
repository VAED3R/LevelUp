"use client";

const SkeletonLoader = ({ type = "card", className = "" }) => {
  const baseClass = "skeleton-loader";
  const typeClass = `skeleton-${type}`;
  
  return (
    <div className={`${baseClass} ${typeClass} ${className}`}>
      <style jsx>{`
        .skeleton-loader {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          animation: skeletonPulse 1.5s ease-in-out infinite;
        }
        
        .skeleton-card {
          height: 120px;
          width: 100%;
        }
        
        .skeleton-text {
          height: 20px;
          width: 80%;
          margin-bottom: 10px;
        }
        
        .skeleton-avatar {
          width: 60px;
          height: 60px;
          border-radius: 50%;
        }
        
        @keyframes skeletonPulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
};

export default SkeletonLoader;