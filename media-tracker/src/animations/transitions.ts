/**
 * Animation Vocabulary
 *
 * A consistent set of animation presets that define the motion language
 * of the entire application. Every animation should feel intentional,
 * smooth, and delightful.
 */

import { Transition, Variants } from 'framer-motion';

// ============================================================================
// EASING CURVES
// ============================================================================

/**
 * Apple's signature easing curve - smooth and natural
 * Perfect for most UI interactions
 */
export const easeOut = [0.4, 0.0, 0.2, 1];

/**
 * Snappy easing for quick interactions
 */
export const easeInOut = [0.4, 0.0, 0.6, 1];

/**
 * Bouncy, playful easing
 */
export const easeOutBack = [0.34, 1.56, 0.64, 1];

// ============================================================================
// TRANSITIONS
// ============================================================================

/**
 * Spring physics - for natural, bouncy movements
 */
export const spring: Transition = {
  type: 'spring',
  damping: 20,
  stiffness: 300,
};

/**
 * Smooth transition for most UI elements
 */
export const smooth: Transition = {
  duration: 0.3,
  ease: easeOut,
};

/**
 * Quick snap for immediate feedback
 */
export const snap: Transition = {
  duration: 0.15,
  ease: easeInOut,
};

/**
 * Slow, dramatic for important moments
 */
export const dramatic: Transition = {
  duration: 0.6,
  ease: easeOut,
};

// ============================================================================
// VARIANTS
// ============================================================================

/**
 * Fade in from transparent to visible
 */
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

/**
 * Slide up from below with fade
 */
export const slideUp: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/**
 * Slide down from above with fade
 */
export const slideDown: Variants = {
  hidden: { y: -20, opacity: 0 },
  visible: { y: 0, opacity: 1 },
};

/**
 * Slide in from right
 */
export const slideInFromRight: Variants = {
  hidden: { x: 100, opacity: 0 },
  visible: { x: 0, opacity: 1 },
};

/**
 * Slide in from left
 */
export const slideInFromLeft: Variants = {
  hidden: { x: -100, opacity: 0 },
  visible: { x: 0, opacity: 1 },
};

/**
 * Scale up from small with fade
 */
export const scaleUp: Variants = {
  hidden: { scale: 0.9, opacity: 0 },
  visible: { scale: 1, opacity: 1 },
};

/**
 * Scale down and fade out
 */
export const scaleDown: Variants = {
  visible: { scale: 1, opacity: 1 },
  hidden: { scale: 0.9, opacity: 0 },
};

/**
 * Stagger children animations
 */
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

/**
 * Individual stagger item
 */
export const staggerItem: Variants = {
  hidden: { y: 20, opacity: 0 },
  visible: {
    y: 0,
    opacity: 1,
    transition: smooth,
  },
};

// ============================================================================
// HOVER & INTERACTION STATES
// ============================================================================

/**
 * Subtle hover lift for cards
 */
export const cardHover = {
  scale: 1.02,
  y: -4,
  transition: spring,
};

/**
 * Dramatic hover for hero cards
 */
export const heroCardHover = {
  scale: 1.05,
  y: -8,
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)',
  transition: spring,
};

/**
 * Button press animation
 */
export const buttonTap = {
  scale: 0.95,
  transition: snap,
};

/**
 * Button hover glow
 */
export const buttonHover = {
  boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)',
  transition: smooth,
};

// ============================================================================
// PAGE TRANSITIONS
// ============================================================================

/**
 * Page transition variants
 */
export const pageTransition: Variants = {
  initial: { opacity: 0, x: -20 },
  enter: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: 20 },
};

/**
 * Modal/overlay transitions
 */
export const modalTransition: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: spring,
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: smooth,
  },
};

/**
 * Backdrop overlay
 */
export const backdropTransition: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
  exit: { opacity: 0 },
};

// ============================================================================
// SPECIAL EFFECTS
// ============================================================================

/**
 * Success checkmark animation
 */
export const checkmark: Variants = {
  hidden: { pathLength: 0, opacity: 0 },
  visible: {
    pathLength: 1,
    opacity: 1,
    transition: {
      pathLength: { duration: 0.5, ease: easeOut },
      opacity: { duration: 0.01 },
    },
  },
};

/**
 * Shimmer loading effect
 */
export const shimmer: Variants = {
  shimmer: {
    x: ['0%', '100%'],
    transition: {
      repeat: Infinity,
      duration: 1.5,
      ease: 'linear',
    },
  },
};

/**
 * Confetti burst (scale + rotate)
 */
export const confettiBurst: Variants = {
  initial: { scale: 0, rotate: 0 },
  burst: {
    scale: [0, 1.2, 0.9, 1],
    rotate: [0, 180, 360],
    transition: {
      duration: 0.6,
      ease: easeOutBack,
    },
  },
};

// ============================================================================
// SWIPE GESTURES
// ============================================================================

/**
 * Swipe to dismiss configuration
 */
export const swipeToDismiss = {
  drag: 'x' as const,
  dragConstraints: { left: 0, right: 0 },
  dragElastic: 0.7,
  onDragEnd: (event: any, info: any) => {
    const threshold = 100;
    if (Math.abs(info.offset.x) > threshold) {
      return info.offset.x > 0 ? 'right' : 'left';
    }
    return null;
  },
};

// ============================================================================
// NUMBER ANIMATIONS
// ============================================================================

/**
 * Animate number changes smoothly
 */
export const numberTransition: Transition = {
  duration: 0.5,
  ease: easeOut,
};
