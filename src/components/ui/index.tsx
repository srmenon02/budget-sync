import React from 'react'
import { Sparkles, X } from 'lucide-react'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-2xl border border-ink-border/80 bg-ink-card/80 p-6 ${className}`}
      style={{
        boxShadow: '0 10px 30px rgba(84, 66, 35, 0.1), inset 0 1px 0 rgba(255,255,255,0.8)',
        backgroundImage:
          'linear-gradient(140deg, rgba(255,255,255,0.65), rgba(255,255,255,0.1) 30%), linear-gradient(180deg, rgba(31,122,76,0.03), rgba(123,90,31,0.04))',
      }}
    >
      {children}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center items-center py-16">
      <div className="w-5 h-5 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )
}

export function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode
  variant?: 'default' | 'success' | 'warning' | 'error'
}) {
  const base = 'inline-flex items-center px-2.5 py-1 rounded-md font-mono text-[10px] tracking-wide uppercase leading-none'
  const variants = {
    default: 'bg-ink-raised text-parchment-muted border border-ink-border',
    success: 'bg-jade/10 text-jade border border-jade/20',
    warning: 'bg-gold-faint text-gold border border-gold/30',
    error: 'bg-coral/10 text-coral border border-coral/20',
  }
  return <span className={`${base} ${variants[variant]}`}>{children}</span>
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 border border-dashed border-ink-border/80 rounded-2xl bg-ink-card/35">
      <Sparkles className="mx-auto mb-3 h-7 w-7 text-gold" aria-hidden="true" />
      <p className="text-sm font-mono text-parchment-muted">{message}</p>
    </div>
  )
}

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-6"
      style={{ background: 'rgba(40, 31, 16, 0.24)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-ink-border/80 p-5 md:p-6 animate-fade-up max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(160deg, #ffffff 0%, #edf3ef 100%)',
          boxShadow: '0 20px 48px rgba(73, 59, 33, 0.18), inset 0 1px 0 rgba(255,255,255,0.9)',
        }}
      >
        <div className="flex items-center justify-between mb-4 md:mb-5">
          <h2
            className="font-display text-xl text-parchment"
            style={{ fontVariationSettings: '"opsz" 30, "wght" 500', fontStyle: 'italic' }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            className="text-parchment-dim hover:text-parchment transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

