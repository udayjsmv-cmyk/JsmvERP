import React, { useEffect } from "react";
import { AppRoutes } from "./routes/AppRoutes";
import FloatingCubes from "./components/FloatingCubes";
import { Toaster } from 'react-hot-toast';

const App = () => {
  return (
    <>
      {/* Gradient animated background */}
      <div
        className="fixed inset-0 pointer-events-none blur-[60px] opacity-30"
        style={{
          background:
            "linear-gradient(-45deg, #7F00FF, #00DBDE, #FC00FF, #00C9FF)", // purple, turquoise, pink, blue
          backgroundSize: "400% 400%",
          animation: "gradientShift 15s ease infinite",
          transformStyle: "preserve-3d",
          perspective: "1000px",
          zIndex: 0,
        }}
      />
      <Toaster />
      {/* Floating cubes */}
      <FloatingCubes />

      {/* Your Routes */}
      <div className="relative z-10">
        <AppRoutes />
      </div>

      {/* Keyframes for animations */}
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes floatRotate {
          0% {
            transform: translate3d(0, 0, 0) rotateX(0deg) rotateY(0deg);
          }
          50% {
            transform: translate3d(0, 10px, 20px) rotateX(180deg) rotateY(180deg);
          }
          100% {
            transform: translate3d(0, 0, 0) rotateX(360deg) rotateY(360deg);
          }
        }
      `}</style>
    </>
  );
};

export default App;
