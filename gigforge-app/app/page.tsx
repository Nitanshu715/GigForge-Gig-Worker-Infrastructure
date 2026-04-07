'use client'
import { useEffect, useState } from 'react'
import { getSession } from '@/lib/store'
import type { Session } from '@/lib/store'
import AuthScreen from '@/components/AuthScreen'
import WorkerShell from '@/components/worker/WorkerShell'
import AdminShell from '@/components/admin/AdminShell'

export default function Page() {
  const [session, setSession] = useState<Session | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setSession(getSession())
    setReady(true)
  }, [])

  if (!ready) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ width:22, height:22, border:'2.5px solid var(--brand)', borderTopColor:'transparent', borderRadius:'50%' }} className="animate-spin" />
    </div>
  )

  if (!session) return <AuthScreen onAuth={setSession} />
  if (session.role === 'admin') return <AdminShell session={session} onLogout={() => setSession(null)} />
  return <WorkerShell session={session} onLogout={() => setSession(null)} />
}
