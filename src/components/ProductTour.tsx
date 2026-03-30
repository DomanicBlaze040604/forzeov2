import React, { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { X, ChevronRight, ChevronLeft, Sparkles, ArrowRight, Home, MessageSquare, Layers, Globe, BarChart3, FileText, Eye, Lightbulb } from 'lucide-react';

interface TourStep {
  id: string;
  target?: string;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  icon?: React.ReactNode;
}

interface ProductTourProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'welcome',
    title: "Welcome to Forzeo!",
    description: "You're all set up. Let's take a quick 60-second tour so you know exactly where everything lives.",
    position: 'center',
    icon: <Sparkles className="h-5 w-5 text-white" />,
  },
  {
    id: 'sidebar',
    target: 'tour-sidebar',
    title: 'Your Navigation Hub',
    description: 'Everything you need is in this sidebar — switch sections, manage brands, access settings, and more.',
    position: 'right',
    icon: <Eye className="h-5 w-5 text-white" />,
  },
  {
    id: 'brand-switcher',
    target: 'tour-brand-switcher',
    title: 'Switch Between Brands',
    description: 'Managing multiple brands? Switch between them here. Each brand has its own prompts, audit history, and analytics.',
    position: 'right',
    icon: <Eye className="h-5 w-5 text-white" />,
  },
  {
    id: 'nav-overview',
    target: 'tour-nav-overview',
    title: 'Overview Tab',
    description: 'Your AI visibility at a glance — Share of Voice trends, top-performing prompts, and how you stack up against competitors.',
    position: 'right',
    icon: <Home className="h-5 w-5 text-white" />,
  },
  {
    id: 'nav-prompts',
    target: 'tour-nav-prompts',
    title: 'Prompts',
    description: 'Manage the questions AI engines answer about your industry. The more prompts you track, the richer your visibility data.',
    position: 'right',
    icon: <MessageSquare className="h-5 w-5 text-white" />,
  },
  {
    id: 'nav-topics',
    target: 'tour-nav-topics',
    title: 'Topics',
    description: "Group prompts by theme — like 'Pricing', 'Features', or 'Comparisons' — and track AI visibility by category.",
    position: 'right',
    icon: <Layers className="h-5 w-5 text-white" />,
  },
  {
    id: 'nav-insights',
    target: 'tour-nav-insights',
    title: 'AI Insights',
    description: 'Get AI-generated strategic recommendations based on your visibility data. Understand where you win and where you need to improve.',
    position: 'right',
    icon: <Lightbulb className="h-5 w-5 text-white" />,
  },
  {
    id: 'nav-citations',
    target: 'tour-nav-sources',
    title: 'Citations',
    description: 'See exactly which websites AI engines cite when discussing your brand. Identify citation gaps and build your authority strategy.',
    position: 'right',
    icon: <Globe className="h-5 w-5 text-white" />,
  },
  {
    id: 'nav-traffic',
    target: 'tour-nav-traffic',
    title: 'AI Traffic Analytics',
    description: 'Connect Google Analytics 4 to measure how much real traffic AI search engines are sending to your site.',
    position: 'right',
    icon: <BarChart3 className="h-5 w-5 text-white" />,
  },
  {
    id: 'nav-content',
    target: 'tour-nav-content',
    title: 'Content Generator',
    description: 'Generate AI-optimized content — articles, FAQs, landing pages — designed to improve your brand mentions in AI responses.',
    position: 'right',
    icon: <FileText className="h-5 w-5 text-white" />,
  },
  {
    id: 'finish',
    title: "You're all set!",
    description: "Head to the Overview tab to explore your brand's AI visibility data. Run your first audit from the Prompts tab whenever you're ready.",
    position: 'center',
    icon: <ArrowRight className="h-5 w-5 text-white" />,
  },
];

const SPOTLIGHT_PADDING = 10;
const CARD_WIDTH = 340;
const CARD_MARGIN = 20;

export function ProductTour({ onComplete, onSkip }: ProductTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [visible, setVisible] = useState(false);
  const [cardVisible, setCardVisible] = useState(false);
  const animFrameRef = useRef<number | null>(null);

  const step = TOUR_STEPS[currentStep];

  // Mount animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const measureTarget = useCallback(() => {
    if (!step.target) {
      setTargetRect(null);
      return;
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`);
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      // Measure after scroll settles
      const t = setTimeout(() => {
        setTargetRect(el.getBoundingClientRect());
      }, 350);
      return () => clearTimeout(t);
    } else {
      setTargetRect(null);
    }
  }, [step.target]);

  // Animate card out → update step → animate in
  const changeStep = useCallback((newStep: number) => {
    setCardVisible(false);
    const t = setTimeout(() => {
      setCurrentStep(newStep);
    }, 200);
    return () => clearTimeout(t);
  }, []);

  // When step changes, re-measure target and animate card in
  useEffect(() => {
    setTargetRect(null);
    const cleanup = measureTarget();
    const t = setTimeout(() => setCardVisible(true), 280);
    return () => {
      if (cleanup) cleanup();
      clearTimeout(t);
    };
  }, [currentStep, measureTarget]);

  // Keep target rect up to date on scroll/resize
  useEffect(() => {
    const update = () => {
      if (!step.target) return;
      const el = document.querySelector(`[data-tour="${step.target}"]`);
      if (el) setTargetRect(el.getBoundingClientRect());
    };
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [step.target]);

  const goNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      changeStep(currentStep + 1);
    } else {
      setVisible(false);
      setTimeout(onComplete, 300);
    }
  };

  const goPrev = () => {
    if (currentStep > 0) {
      changeStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    setVisible(false);
    setTimeout(onSkip, 300);
  };

  // Spotlight geometry
  const spotlight = targetRect
    ? {
        x: Math.round(targetRect.left - SPOTLIGHT_PADDING),
        y: Math.round(targetRect.top - SPOTLIGHT_PADDING),
        w: Math.round(targetRect.width + SPOTLIGHT_PADDING * 2),
        h: Math.round(targetRect.height + SPOTLIGHT_PADDING * 2),
      }
    : null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;

  // Card position
  const getCardStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'fixed',
      width: CARD_WIDTH,
      zIndex: 10002,
      transition: 'opacity 200ms ease, transform 200ms ease',
      opacity: cardVisible ? 1 : 0,
      transform: cardVisible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(8px)',
    };

    if (!spotlight || step.position === 'center') {
      return {
        ...base,
        top: '50%',
        left: '50%',
        width: Math.min(CARD_WIDTH, vw - 32),
        transform: cardVisible
          ? 'translate(-50%, -50%) scale(1)'
          : 'translate(-50%, -50%) scale(0.96)',
      };
    }

    let top = spotlight.y + spotlight.h / 2 - 120;
    let left = spotlight.x + spotlight.w + CARD_MARGIN;

    // If card goes off right edge, flip to left
    if (left + CARD_WIDTH > vw - CARD_MARGIN) {
      left = spotlight.x - CARD_WIDTH - CARD_MARGIN;
    }

    // Clamp vertically
    top = Math.max(CARD_MARGIN, Math.min(top, vh - 280 - CARD_MARGIN));
    // Clamp horizontally
    left = Math.max(CARD_MARGIN, Math.min(left, vw - CARD_WIDTH - CARD_MARGIN));

    return { ...base, top, left };
  };

  const progress = ((currentStep + 1) / TOUR_STEPS.length) * 100;

  return (
    <div
      className="fixed inset-0 z-[10000]"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 300ms ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      {/* Overlay panels */}
      {spotlight ? (
        <>
          {/* Top */}
          <div
            className="absolute bg-black/65"
            style={{ inset: 0, bottom: 'auto', height: Math.max(0, spotlight.y) }}
          />
          {/* Bottom */}
          <div
            className="absolute bg-black/65"
            style={{ inset: 0, top: spotlight.y + spotlight.h }}
          />
          {/* Left */}
          <div
            className="absolute bg-black/65"
            style={{
              top: spotlight.y,
              left: 0,
              width: Math.max(0, spotlight.x),
              height: spotlight.h,
            }}
          />
          {/* Right */}
          <div
            className="absolute bg-black/65"
            style={{
              top: spotlight.y,
              left: spotlight.x + spotlight.w,
              right: 0,
              height: spotlight.h,
            }}
          />
          {/* Spotlight ring */}
          <div
            className="absolute pointer-events-none"
            style={{
              top: spotlight.y,
              left: spotlight.x,
              width: spotlight.w,
              height: spotlight.h,
              borderRadius: 10,
              boxShadow: '0 0 0 3px rgba(3,114,255,0.9), 0 0 0 7px rgba(3,114,255,0.2)',
              transition: 'all 300ms cubic-bezier(0.4,0,0.2,1)',
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/65" />
      )}

      {/* Tour Card */}
      <div style={getCardStyle()}>
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Top gradient bar */}
          <div
            className="h-1.5"
            style={{
              background: 'linear-gradient(90deg, #0372ff, #30d1ff)',
              width: `${progress}%`,
              transition: 'width 400ms cubic-bezier(0.4,0,0.2,1)',
            }}
          />
          <div
            className="h-1.5 -mt-1.5 bg-gray-100"
            style={{ zIndex: -1, position: 'relative' }}
          />

          <div className="p-5">
            {/* Header row */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div
                  className="h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #0372ff, #30d1ff)' }}
                >
                  {step.icon ?? <Sparkles className="h-4 w-4 text-white" />}
                </div>
                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Step {currentStep + 1} of {TOUR_STEPS.length}
                </span>
              </div>
              <button
                onClick={handleSkip}
                className="text-gray-300 hover:text-gray-500 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
                aria-label="Skip tour"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content */}
            <h3 className="text-base font-bold text-gray-900 mb-1.5 leading-snug">
              {step.title}
            </h3>
            <p className="text-sm text-gray-500 leading-relaxed mb-5">
              {step.description}
            </p>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <button
                onClick={goPrev}
                disabled={currentStep === 0}
                className={cn(
                  'flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  currentStep === 0
                    ? 'opacity-0 pointer-events-none'
                    : 'text-gray-400 hover:text-gray-700 hover:bg-gray-100'
                )}
              >
                <ChevronLeft className="h-4 w-4" />
                Back
              </button>

              {/* Dot indicators */}
              <div className="flex items-center gap-1">
                {TOUR_STEPS.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => changeStep(i)}
                    className={cn(
                      'rounded-full transition-all duration-300',
                      i === currentStep
                        ? 'w-5 h-2 bg-blue-500'
                        : i < currentStep
                        ? 'w-2 h-2 bg-blue-200'
                        : 'w-2 h-2 bg-gray-200'
                    )}
                    aria-label={`Go to step ${i + 1}`}
                  />
                ))}
              </div>

              <button
                onClick={goNext}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white transition-all hover:opacity-90 active:scale-95"
                style={{
                  background:
                    currentStep === TOUR_STEPS.length - 1
                      ? 'linear-gradient(135deg, #10b981, #059669)'
                      : 'linear-gradient(135deg, #0372ff, #1a85ff)',
                  boxShadow:
                    currentStep === TOUR_STEPS.length - 1
                      ? '0 2px 10px rgba(16,185,129,0.35)'
                      : '0 2px 10px rgba(3,114,255,0.35)',
                }}
              >
                {currentStep === TOUR_STEPS.length - 1 ? (
                  <>
                    Get Started
                    <ArrowRight className="h-3.5 w-3.5" />
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-3.5 w-3.5" />
                  </>
                )}
              </button>
            </div>

            {/* Skip link */}
            {currentStep < TOUR_STEPS.length - 1 && (
              <button
                onClick={handleSkip}
                className="w-full text-center text-xs text-gray-300 hover:text-gray-500 mt-3 py-1 transition-colors"
              >
                Skip tour
              </button>
            )}
          </div>
        </div>

        {/* Arrow pointer toward spotlight (right side) */}
        {spotlight && step.position === 'right' && (
          <div
            className="absolute top-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              left: -8,
              width: 0,
              height: 0,
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: '8px solid white',
              filter: 'drop-shadow(-2px 0 2px rgba(0,0,0,0.08))',
            }}
          />
        )}
      </div>
    </div>
  );
}
