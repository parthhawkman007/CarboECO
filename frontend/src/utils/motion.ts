export const springTokens = {
  micro: { type: "spring", stiffness: 400, damping: 25 },
  medium: { type: "spring", stiffness: 220, damping: 22 },
  cinematic: { type: "spring", stiffness: 90, damping: 16 }
};

export const easeTokens = {
  apple: [0.16, 1, 0.3, 1], // Apple-style fluid deceleration
  stripe: [0.25, 0.46, 0.45, 0.94],
  linear: [0.4, 0, 0.2, 1]
};

export const microVariants = {
  hover: { scale: 1.02, transition: springTokens.micro },
  tap: { scale: 0.97, transition: springTokens.micro }
};

export const cardVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { 
    opacity: 1, 
    y: 0, 
    transition: { 
      ease: easeTokens.apple, 
      duration: 0.5 
    } 
  }
};

export const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08
    }
  }
};

export const cinematicVariants = {
  hidden: { opacity: 0, scale: 0.95, y: 30 },
  visible: { 
    opacity: 1, 
    scale: 1, 
    y: 0, 
    transition: { 
      ease: easeTokens.apple, 
      duration: 0.8 
    } 
  }
};
