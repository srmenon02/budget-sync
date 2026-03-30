import React from 'react'

export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-4 ${className}`}>
      {children}
    </div>
  )
}

export function Spinner() {
  return (
    <div className="flex justify-center items-center py-12">
      <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
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
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium'
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    success: 'bg-brand-100 text-brand-700',
    warning: 'bg-yellow-100 text-yellow-700',
    error: 'bg-red-100 text-red-700',
  }
  return <span className={`${base} ${variants[variant]}`}>{children}</span>
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-gray-400">
      <p className="text-sm">{message}</p>
    </div>
  )
}
