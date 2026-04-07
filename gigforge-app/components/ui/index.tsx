'use client'
import React from 'react'

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'20px 24px', ...style }}>{children}</div>
}

export function StatCard({ label, value, sub, accent = 'var(--brand)' }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:12, padding:'18px 20px', borderTop:`3px solid ${accent}` }}>
      <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:8 }}>{label}</div>
      <div className="tabular" style={{ fontSize:24, fontWeight:700, color:'var(--text)', letterSpacing:'-0.5px' }}>{value}</div>
      {sub && <div style={{ fontSize:12, color:'var(--text-2)', marginTop:3 }}>{sub}</div>}
    </div>
  )
}

export function PageHeader({ title, sub, children }: { title: string; sub?: string; children?: React.ReactNode }) {
  return (
    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, gap:16 }}>
      <div>
        <h1 style={{ fontSize:21, fontWeight:700, color:'var(--text)', letterSpacing:'-0.4px', margin:0 }}>{title}</h1>
        {sub && <p style={{ fontSize:13, color:'var(--text-2)', margin:'4px 0 0' }}>{sub}</p>}
      </div>
      {children && <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>{children}</div>}
    </div>
  )
}

export function Btn({ children, onClick, variant = 'primary', size = 'md', disabled, style }: {
  children: React.ReactNode; onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg'; disabled?: boolean; style?: React.CSSProperties;
}) {
  const sizes = { sm:'6px 11px', md:'9px 16px', lg:'12px 24px' }
  const fSizes = { sm:12, md:13, lg:14 }
  const variants: Record<string, React.CSSProperties> = {
    primary:   { background:'var(--brand)', color:'#fff', border:'none' },
    secondary: { background:'var(--surface-2)', color:'var(--text)', border:'1px solid var(--border)' },
    danger:    { background:'var(--red-bg)', color:'var(--red)', border:'1px solid rgba(220,38,38,0.2)' },
    ghost:     { background:'transparent', color:'var(--text-2)', border:'1px solid var(--border)' },
    success:   { background:'var(--green-bg)', color:'var(--green)', border:'1px solid rgba(22,163,74,0.2)' },
  }
  return (
    <button
      onClick={onClick} disabled={disabled}
      style={{ padding:sizes[size], fontSize:fSizes[size], fontWeight:600, fontFamily:'inherit', borderRadius:8, cursor:disabled?'not-allowed':'pointer', opacity:disabled?0.5:1, display:'inline-flex', alignItems:'center', gap:6, transition:'opacity 0.12s', whiteSpace:'nowrap', ...variants[variant], ...style }}
    >{children}</button>
  )
}

export function Badge({ children, color = 'default' }: { children: React.ReactNode; color?: 'default'|'green'|'red'|'amber'|'blue'|'brand'|'purple' }) {
  const map: Record<string, React.CSSProperties> = {
    default: { background:'var(--surface-2)', color:'var(--text-2)', border:'1px solid var(--border)' },
    green:   { background:'var(--green-bg)',  color:'var(--green)' },
    red:     { background:'var(--red-bg)',    color:'var(--red)' },
    amber:   { background:'var(--amber-bg)',  color:'var(--amber)' },
    blue:    { background:'var(--blue-bg)',   color:'var(--blue)' },
    brand:   { background:'var(--brand-dim)', color:'var(--brand)' },
    purple:  { background:'var(--purple-bg)', color:'var(--purple)' },
  }
  return <span style={{ ...map[color], padding:'3px 9px', borderRadius:20, fontSize:11, fontWeight:600, letterSpacing:'0.2px', display:'inline-block' }}>{children}</span>
}

export function Table({ headers, rows, empty = 'No data yet.' }: { headers: string[]; rows: React.ReactNode[][]; empty?: string }) {
  return (
    <div style={{ overflowX:'auto' }}>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
        <thead>
          <tr>{headers.map((h, i) => <th key={i} style={{ padding:'9px 14px', textAlign:'left', fontSize:11, fontWeight:600, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.5px', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={headers.length} style={{ padding:'36px 14px', textAlign:'center', color:'var(--text-3)', fontSize:13 }}>{empty}</td></tr>
            : rows.map((row, i) => (
              <tr key={i} style={{ borderBottom:'1px solid var(--border)', transition:'background 0.1s' }} onMouseEnter={e => (e.currentTarget.style.background='var(--surface-2)')} onMouseLeave={e => (e.currentTarget.style.background='')}>
                {row.map((cell, j) => <td key={j} style={{ padding:'11px 14px', color:'var(--text)', verticalAlign:'middle' }}>{cell}</td>)}
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="animate-in" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:24 }} onClick={onClose}>
      <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:'28px', width:'100%', maxWidth:500, maxHeight:'90vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ fontSize:17, fontWeight:700, color:'var(--text)', letterSpacing:'-0.3px', margin:0 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)', fontSize:22, lineHeight:1, padding:'2px 6px', borderRadius:6 }}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:'block', fontSize:11, fontWeight:600, color:'var(--text-2)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle: React.CSSProperties = { width:'100%', padding:'9px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:8, fontSize:13, color:'var(--text)', outline:'none', fontFamily:'inherit', transition:'border-color 0.12s' }

export function Input({ value, onChange, placeholder, type = 'text', style }: { value: string; onChange: (v: string) => void; placeholder?: string; type?: string; style?: React.CSSProperties }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{ ...inputStyle, ...style }} />
}

export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle }}>{options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select>
}

export function ScoreBar({ value, color }: { value: number; color?: string }) {
  const c = color || (value >= 80 ? 'var(--green)' : value >= 50 ? 'var(--amber)' : 'var(--red)')
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
      <div style={{ flex:1, height:6, background:'var(--surface-2)', borderRadius:3, overflow:'hidden' }}>
        <div style={{ width:`${Math.min(100, value)}%`, height:'100%', background:c, borderRadius:3, transition:'width 0.5s ease' }} />
      </div>
      <span className="tabular" style={{ fontSize:13, fontWeight:700, color:c, minWidth:28, textAlign:'right' }}>{value}</span>
    </div>
  )
}

export function Textarea({ value, onChange, placeholder, rows = 3 }: { value: string; onChange: (v: string) => void; placeholder?: string; rows?: number }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{ ...inputStyle, resize:'vertical' }} />
}
