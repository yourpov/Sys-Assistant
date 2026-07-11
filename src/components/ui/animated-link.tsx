import * as React from 'react';

import { cn } from '@/lib/utils';

type AnimatedLinkVariant = 'left' | 'right' | 'center';

const underlineVariants: Record<AnimatedLinkVariant, string> = {
  left: 'before:origin-right before:scale-x-0 hover:before:origin-left hover:before:scale-x-100',
  right: 'before:origin-left before:scale-x-0 hover:before:origin-right hover:before:scale-x-100',
  center: 'before:origin-center before:scale-x-0 hover:before:scale-x-100',
};

const linkSurfaceClass =
  'group relative inline-flex w-fit items-center border-none bg-transparent p-0 font-inherit cursor-pointer text-[var(--color-accent-light)] hover:text-[var(--color-primary-bright)] before:pointer-events-none before:absolute before:left-0 before:top-[1.5em] before:h-[0.05em] before:w-full before:bg-current before:content-[""] before:transition-transform before:duration-300 before:ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:before:transition-none';

type AnimatedLinkBaseProps = {
  variant?: AnimatedLinkVariant;
  showArrow?: boolean;
  className?: string;
  children?: React.ReactNode;
};

export type AnimatedLinkProps = AnimatedLinkBaseProps &
  (
    | (Omit<React.ComponentPropsWithoutRef<'a'>, keyof AnimatedLinkBaseProps> & { href: string })
    | (Omit<React.ComponentPropsWithoutRef<'button'>, keyof AnimatedLinkBaseProps> & { href?: undefined })
  );

function AnimatedLinkArrow() {
  return (
    <svg
      className="ml-[0.3em] size-[0.55em] transition-none"
      fill="none"
      viewBox="0 0 10 10"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M1.004 9.166 9.337.833m0 0v8.333m0-8.333H1.004"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="[stroke-dasharray:32] [stroke-dashoffset:32] transition-[stroke-dashoffset] duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] group-hover:[stroke-dashoffset:0] motion-reduce:transition-none"
      />
    </svg>
  );
}

const AnimatedLink = ({
  variant = 'left',
  showArrow = true,
  className,
  children,
  ...props
}: AnimatedLinkProps) => {
  const classes = cn(linkSurfaceClass, underlineVariants[variant], className);

  if ('href' in props && props.href) {
    const { href, ...anchorProps } = props;
    return (
      <a className={classes} href={href} {...anchorProps}>
        {children}
        {showArrow ? <AnimatedLinkArrow /> : null}
      </a>
    );
  }

  const { type = 'button', ...buttonProps } = props as Omit<React.ComponentPropsWithoutRef<'button'>, keyof AnimatedLinkBaseProps>;

  return (
    <button type={type} className={classes} {...buttonProps}>
      {children}
      {showArrow ? <AnimatedLinkArrow /> : null}
    </button>
  );
};

export { AnimatedLink };
export default AnimatedLink;