import React from 'react'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl border border-ink-border bg-ink-card p-6 ${className}`}
      style={{ boxShadow: '0 4px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)' }}
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
    warning: 'bg-gold/10 text-gold border border-gold/20',
    error: 'bg-coral/10 text-coral border border-coral/20',
  }
  return <span className={`${base} ${variants[variant]}`}>{children}</span>
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 border border-dashed border-ink-border rounded-xl bg-ink-card/40">
      <div className="text-3xl mb-2 opacity-20">◈</div>
      <p className="text-sm font-mono text-parchment-dim">{message}</p>
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
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-ink-border p-5 md:p-6 animate-fade-up max-h-[90vh] overflow-y-auto"
        style={{
          background: 'linear-gradient(160deg, #1e1e28 0%, #141418 100%)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)',
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
            className="text-parchment-dim hover:text-parchment transition-colors text-xl leading-none font-mono"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

