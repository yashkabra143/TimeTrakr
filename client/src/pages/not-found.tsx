import { motion } from "framer-motion";
import { Link } from "wouter";
import { ArrowLeft, Clock } from "lucide-react";

export default function NotFound() {
  return (
    <div
      className="min-h-screen w-full flex flex-col items-center justify-center relative overflow-hidden"
      style={{ background: "hsl(220,20%,97%)" }}
    >
      {/* Ambient orbs */}
      <motion.div
        className="absolute w-80 h-80 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(38,92%,50%,0.08) 0%, transparent 70%)", top: "10%", left: "10%" }}
        animate={{ scale: [1, 1.1, 1], rotate: [0, 10, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute w-64 h-64 rounded-full pointer-events-none"
        style={{ background: "radial-gradient(circle, hsl(228,25%,50%,0.05) 0%, transparent 70%)", bottom: "15%", right: "8%" }}
        animate={{ scale: [1, 1.08, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 2 }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-6 gap-8 max-w-md">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex items-center gap-2"
        >
          <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(38,92%,50%)" }}>
            <Clock className="w-3.5 h-3.5" style={{ color: "hsl(228,25%,9%)" }} />
          </div>
          <span className="text-base font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,12%)" }}>
            TimeFlow
          </span>
        </motion.div>

        {/* 404 */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <p
            className="font-bold leading-none select-none"
            style={{
              fontFamily: "'Syne', sans-serif",
              fontSize: "clamp(100px, 20vw, 160px)",
              color: "hsl(38,92%,50%)",
              letterSpacing: "-0.04em",
              textShadow: "0 8px 40px hsl(38,92%,50%,0.2)",
            }}
          >
            404
          </p>
        </motion.div>

        {/* Text */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="space-y-2"
        >
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Syne', sans-serif", color: "hsl(228,25%,10%)" }}>
            Page not found
          </h1>
          <p className="text-sm text-muted-foreground" style={{ fontFamily: "'Manrope', sans-serif" }}>
            The page you're looking for doesn't exist or has been moved.
          </p>
        </motion.div>

        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <Link href="/dashboard">
            <motion.button
              whileHover={{ scale: 1.04, boxShadow: "0 6px 24px hsl(38,92%,50%,0.35)" }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 px-6 h-11 rounded-xl text-sm font-semibold"
              style={{
                fontFamily: "'Manrope', sans-serif",
                background: "hsl(38,92%,50%)",
                color: "hsl(228,25%,9%)",
                boxShadow: "0 4px 16px hsl(38,92%,50%,0.25)",
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </motion.button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
