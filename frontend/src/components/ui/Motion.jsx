/**
 * 动画封装组件
 * 提供统一的入场动画和交错动画效果
 */
import { useEffect, useState, useRef } from 'react';

/**
 * 交叉观察器 Hook - 用于检测元素是否进入视口
 */
export function useInView(options = {}) {
  const ref = useRef(null);
  const [isInView, setIsInView] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || hasTriggered.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasTriggered.current) {
          hasTriggered.current = true;
          setIsInView(true);
          // 一旦进入视口，停止观察
          observer.unobserve(element);
        }
      },
      {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px',
      }
    );

    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, []);

  return [ref, isInView];
}

/**
 * 入场动画容器组件
 * @param {string} animation - 动画类型: 'fade-in-up' | 'fade-in-down' | 'fade-in' | 'scale-in' | 'slide-in-left' | 'slide-in-right'
 * @param {number} delay - 延迟时间(ms)
 * @param {number} duration - 动画时长(ms)
 * @param {boolean} triggerOnce - 是否只触发一次
 * @param {string} className - 额外的类名
 */
export function Motion({
  children,
  animation = 'fade-in-up',
  delay = 0,
  duration = 400,
  triggerOnce = true,
  className = '',
  as: Component = 'div',
  ...props
}) {
  const [ref, isInView] = useInView();
  const [hasAnimated, setHasAnimated] = useState(false);

  // 获取动画对应的 CSS 类
  const getAnimationClass = () => {
    const animationMap = {
      'fade-in-up': 'animate-fade-in-up',
      'fade-in-down': 'animate-fade-in-down',
      'fade-in': 'animate-fade-in',
      'scale-in': 'animate-scale-in',
      'slide-in-left': 'animate-slide-in-left',
      'slide-in-right': 'animate-slide-in-right',
    };
    return animationMap[animation] || 'animate-fade-in-up';
  };

  // 是否应该显示动画
  const shouldAnimate = isInView || (!triggerOnce && hasAnimated);

  useEffect(() => {
    if (isInView && triggerOnce) {
      setHasAnimated(true);
    }
  }, [isInView, triggerOnce]);

  const style = {
    animationDelay: `${delay}ms`,
    animationDuration: `${duration}ms`,
    animationFillMode: 'forwards',
  };

  return (
    <Component
      ref={ref}
      className={`${shouldAnimate ? getAnimationClass() : 'opacity-0'} ${className}`}
      style={style}
      {...props}
    >
      {children}
    </Component>
  );
}

/**
 * 交错动画组 - 用于列表项依次动画
 * @param {number} staggerDelay - 每项之间的延迟(ms)，默认 80ms
 */
export function MotionStagger({
  children,
  staggerDelay = 80,
  animation = 'fade-in-up',
  duration = 400,
  className = '',
  ...props
}) {
  const [ref, isInView] = useInView();

  return (
    <div ref={ref} className={className} {...props}>
      {Array.isArray(children)
        ? children.map((child, index) => (
            <Motion
              key={index}
              animation={animation}
              delay={index * staggerDelay}
              duration={duration}
            >
              {child}
            </Motion>
          ))
        : children}
    </div>
  );
}

/**
 * 数字递增动画组件
 */
export function CountUp({
  value,
  duration = 900,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) {
  const [count, setCount] = useState(0);
  const [ref, isInView] = useInView();

  useEffect(() => {
    if (!isInView) return;

    const end = Number(value) || 0;
    if (end === 0) {
      setCount(0);
      return;
    }

    const startTime = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setCount(end * eased);

      if (progress >= 1) {
        clearInterval(timer);
        setCount(end);
      }
    }, 16);

    return () => clearInterval(timer);
  }, [value, duration, isInView]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {prefix}{count.toFixed(decimals)}{suffix}
    </span>
  );
}

/**
 * 打字机效果组件
 */
export function TypeWriter({
  text,
  speed = 50,
  delay = 0,
  className = '',
  onComplete,
}) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let timeoutId;
    let intervalId;

    const startTyping = () => {
      setIsTyping(true);
      let index = 0;
      intervalId = setInterval(() => {
        if (index < text.length) {
          setDisplayedText(text.slice(0, index + 1));
          index++;
        } else {
          clearInterval(intervalId);
          setIsTyping(false);
          onComplete?.();
        }
      }, speed);
    };

    timeoutId = setTimeout(startTyping, delay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, speed, delay, onComplete]);

  return (
    <span className={className}>
      {displayedText}
      {isTyping && <span className="animate-pulse">|</span>}
    </span>
  );
}

/**
 * 悬停卡片效果组件
 */
export function HoverCard({
  children,
  className = '',
  glowEffect = true,
  liftEffect = true,
  ...props
}) {
  const baseClass = 'transition-all duration-250 ease-smooth';
  const hoverClass = liftEffect ? 'hover:-translate-y-1' : '';
  const glowClass = glowEffect ? 'hover:shadow-card-hover' : '';

  return (
    <div
      className={`${baseClass} ${hoverClass} ${glowClass} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export default Motion;