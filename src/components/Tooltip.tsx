import { AnimatePresence, motion } from 'framer-motion';
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';

const SHOW_DELAY_MS = 420;
const GAP           = 8;
const VIEWPORT_PAD  = 8;

interface Props {
  content ?  : string | null;
  children   : ReactNode;
  className? : string;
  block   ?  : boolean;
}

type AnchorProps = {
  className   ?: string;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  onMouseLeave?: React.MouseEventHandler<HTMLElement>;
  onFocus     ?: React.FocusEventHandler<HTMLElement>;
  onBlur      ?: React.FocusEventHandler<HTMLElement>;
  ref         ?: Ref<HTMLElement>;
};

export function Tooltip({ content, children, className, block = false }: Props) {
  const text = content?.trim();
  if (!text) return <>{children}</>;

  return (
    <TooltipActive content = {text} className = {className} block = {block}>
      {children}
    </TooltipActive>
  );
}

function mergeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (value: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(value);
      else ref.current = value;
    }
  };
}

function chainHandler<T extends (...args: never[]) => void>(handler: T, next?: T) {
  return (...args: Parameters<T>) => {
    handler(...args);
    next?.(...args);
  };
}

function TooltipActive({ content, children, className, block }: Required<Pick<Props, 'content' | 'children'>> & Pick<Props, 'className' | 'block'>) {
  const [open, setOpen]           = useState(false);
  const [ready, setReady]         = useState(false);
  const [openAbove, setOpenAbove] = useState(true);
  const [style, setStyle]         = useState<CSSProperties>({ visibility: 'hidden', opacity: 0 });
  const anchorRef                 = useRef<HTMLElement | null>(null);
  const tipRef                    = useRef<HTMLDivElement>(null);
  const showTimer                 = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearShowTimer = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current);
      showTimer.current = null;
    }
  };

  const show = () => {
    clearShowTimer();
    showTimer.current = setTimeout(() => setOpen(true), SHOW_DELAY_MS);
  };

  const hide = () => {
    clearShowTimer();
    setOpen(false);
    setReady(false);
  };

  const updatePosition = useCallback(() => {
    const anchor = anchorRef.current;
    const tip    = tipRef.current;
    if (!anchor || !tip) return false;

    const rect      = anchor.getBoundingClientRect();
    const tipWidth  = tip.offsetWidth;
    const tipHeight = tip.offsetHeight;
    if (tipWidth === 0 || tipHeight === 0 || rect.width === 0) return false;

    const spaceAbove = rect.top - GAP;
    const spaceBelow = window.innerHeight - rect.bottom - GAP;
    const above      = spaceAbove >= tipHeight || spaceAbove > spaceBelow;

    const centerX = rect.left + rect.width / 2;
    const left    = Math.min(Math.max(VIEWPORT_PAD, centerX - tipWidth / 2), window.innerWidth - tipWidth - VIEWPORT_PAD);
    const top     = above ? rect.top - tipHeight - GAP : rect.bottom + GAP;

    setOpenAbove(above);
    setStyle({
      position: 'fixed',
      top,
      left,
      zIndex    : 60,
      visibility: 'visible',
      opacity   : 1,
    });
    setReady(true);
    return true;
  }, []);

  useEffect(() => clearShowTimer, []);

  useLayoutEffect(() => {
    if (!open) return;

    let frame = 0;
    let raf   = 0;

    const measure = () => {
      updatePosition();
      if (frame < 2) {
        frame += 1;
        raf    = requestAnimationFrame(measure);
      }
    };

    measure();

    return () => cancelAnimationFrame(raf);
  }, [open, content, updatePosition]);

  useEffect(() => {
    if (!open) return;

    const reposition = () => {
      updatePosition();
    };

    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, updatePosition]);

  const anchorClassName = [block ? 'app-tooltip-anchor-block' : 'app-tooltip-anchor-inline', className].filter(Boolean).join(' ');

  const bindAnchor = (node: HTMLElement | null) => {
    anchorRef.current = node;
  };

  const anchorHandlers = {
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus     : show,
    onBlur      : hide,
  };

  let anchor: ReactNode;
  const child = Children.only(children);

  if (isValidElement<AnchorProps>(child)) {
    const childClassName = [child.props.className, anchorClassName].filter(Boolean).join(' ');
          anchor         = cloneElement(child as ReactElement<AnchorProps>, {
      ...anchorHandlers,
      onMouseEnter: chainHandler(show, child.props.onMouseEnter),
      onMouseLeave: chainHandler(hide, child.props.onMouseLeave),
      onFocus     : chainHandler(show, child.props.onFocus),
      onBlur      : chainHandler(hide, child.props.onBlur),
      className   : childClassName || undefined,
      ref         : mergeRefs(bindAnchor, child.props.ref),
    });
  } else {
    anchor = (
      <span
        ref          = {bindAnchor}
        className    = {anchorClassName}
        onMouseEnter = {show}
        onMouseLeave = {hide}
        onFocus      = {show}
        onBlur       = {hide}
      >
        {children}
      </span>
    );
  }

  return (
    <>
      {anchor}
      {createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              ref            = {tipRef}
              className      = "app-tooltip"
              role           = "tooltip"
              style          = {style}
              initial        = {{ opacity: 0 }}
              animate        = {{ opacity: ready ? 1 : 0 }}
              exit           = {{ opacity: 0 }}
              transition     = {{ duration: 0.12, ease: 'easeOut' }}
              data-placement = {openAbove ? 'top' : 'bottom'}
            >
              {content}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </>
  );
}