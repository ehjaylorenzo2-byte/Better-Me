import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/features/auth/AuthContext'
import { PageHeader } from '@/components/ui/PageHeader'
import { Input } from '@/components/ui/Input'
import { BottomSheet, ConfirmDialog } from '@/components/ui/Sheet'
import { LoadingState, ErrorState, EmptyState } from '@/components/ui/States'
import { useToast } from '@/components/ui/Toast'
import {
  listPrograms,
  listRoutines,
  createProgram,
  createRoutine,
  deleteProgram,
  deleteRoutine,
} from '@/services/programs'
import type { Program, Routine } from '@/types/models'
import './gym.css'

/**
 * Programs and routines.
 *
 * Everything on this screen already existed in the database and in
 * services/programs.ts — create, rename, archive, delete, reorder — with no
 * way to reach any of it. Routines could only appear by being seeded, which is
 * why the workout screen kept offering the same two forever.
 *
 * The shape is deliberately shallow. A program is a folder with a name; the
 * work happens one level down in the routine editor. Anything deeper than
 * "program > routine > exercise" is a project manager, not a gym app.
 *
 * Routines can also live outside a program, because plenty of people train one
 * fixed day and never build a split. Those are listed on their own at the
 * bottom rather than forced into a container they did not ask for.
 */
export function ProgramsPage() {
  const { userId } = useAuth()
  const { show } = useToast()
  const navigate = useNavigate()

  const [programs, setPrograms] = useState<Program[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [programSheet, setProgramSheet] = useState(false)
  const [programName, setProgramName] = useState('')
  const [routineSheetFor, setRoutineSheetFor] = useState<string | null | undefined>(undefined)
  const [routineName, setRoutineName] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState<
    { kind: 'program' | 'routine'; id: string; name: string } | null
  >(null)

  const load = async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    try {
      const [p, r] = await Promise.all([listPrograms(userId), listRoutines(userId)])
      setPrograms(p)
      setRoutines(r)
    } catch {
      setError('Could not load your programs.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const onCreateProgram = async () => {
    if (!userId || saving) return
    setSaving(true)
    try {
      await createProgram(userId, programName)
      show('Program created.', 'success')
      setProgramSheet(false)
      setProgramName('')
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not create that program.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onCreateRoutine = async () => {
    if (!userId || saving || routineSheetFor === undefined) return
    setSaving(true)
    try {
      const created = await createRoutine(userId, { programId: routineSheetFor, name: routineName })
      show('Routine created.', 'success')
      setRoutineSheetFor(undefined)
      setRoutineName('')
      // Straight into the editor: a routine with no exercises does nothing, and
      // the next thing you want is always to put exercises in it.
      navigate(`/gym/routines/${created.id}`)
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not create that routine.', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!confirm) return
    try {
      if (confirm.kind === 'program') await deleteProgram(confirm.id)
      else await deleteRoutine(confirm.id)
      show(`${confirm.name} deleted.`, 'success')
      setConfirm(null)
      load()
    } catch (err) {
      show(err instanceof Error ? err.message : 'Could not delete that.', 'error')
    }
  }

  if (loading) return <LoadingState label="Loading your programs..." />
  if (error) return <ErrorState message={error} onRetry={load} />

  const loose = routines.filter((r) => r.programId === null)

  return (
    <div className="bm-programs-page">
      <PageHeader title="Programs" />

      {programs.length === 0 && loose.length === 0 ? (
        <EmptyState
          message="No programs yet. A program is a split — Push Pull Legs, Upper Lower — holding the routines you train."
          action={
            <button className="bm-btn bm-btn-primary" onClick={() => setProgramSheet(true)}>
              Create a program
            </button>
          }
        />
      ) : null}

      {programs.map((program) => {
        const inProgram = routines.filter((r) => r.programId === program.id)
        return (
          <section key={program.id} className="bm-card bm-program">
            <div className="bm-program-head">
              <h2 className="bm-program-name">{program.name}</h2>
              <button
                type="button"
                className="bm-btn bm-btn-ghost bm-btn-tight"
                onClick={() => setConfirm({ kind: 'program', id: program.id, name: program.name })}
              >
                Delete
              </button>
            </div>
            {program.notes ? <p className="bm-program-notes">{program.notes}</p> : null}

            {inProgram.length === 0 ? (
              <p className="bm-gym-quiet">No routines in this program yet.</p>
            ) : (
              <ul className="bm-routine-list">
                {inProgram.map((routine) => (
                  <li key={routine.id}>
                    <Link to={`/gym/routines/${routine.id}`} className="bm-card-row bm-routine-row bm-press">
                      <span className="bm-routine-name">{routine.name}</span>
                      <span className="bm-routine-go" aria-hidden="true">
                        ›
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}

            <button
              type="button"
              className="bm-btn bm-btn-secondary bm-btn-full"
              onClick={() => setRoutineSheetFor(program.id)}
            >
              Add a routine
            </button>
          </section>
        )
      })}

      {loose.length > 0 ? (
        <section className="bm-card bm-program">
          <div className="bm-program-head">
            <h2 className="bm-program-name">Standalone routines</h2>
          </div>
          <p className="bm-program-notes">Not part of any program.</p>
          <ul className="bm-routine-list">
            {loose.map((routine) => (
              <li key={routine.id}>
                <Link to={`/gym/routines/${routine.id}`} className="bm-card-row bm-routine-row bm-press">
                  <span className="bm-routine-name">{routine.name}</span>
                  <span className="bm-routine-go" aria-hidden="true">
                    ›
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="bm-programs-actions">
        <button className="bm-btn bm-btn-primary bm-btn-full" onClick={() => setProgramSheet(true)}>
          New program
        </button>
        <button className="bm-btn bm-btn-secondary bm-btn-full" onClick={() => setRoutineSheetFor(null)}>
          New standalone routine
        </button>
      </div>

      <BottomSheet open={programSheet} onClose={() => setProgramSheet(false)} title="New program">
        <Input
          label="Program name"
          placeholder="e.g. Push Pull Legs"
          value={programName}
          onChange={(e) => setProgramName(e.target.value)}
        />
        <button
          className="bm-btn bm-btn-primary bm-btn-full"
          onClick={onCreateProgram}
          disabled={saving || !programName.trim()}
        >
          {saving ? 'Creating...' : 'Create program'}
        </button>
      </BottomSheet>

      <BottomSheet
        open={routineSheetFor !== undefined}
        onClose={() => setRoutineSheetFor(undefined)}
        title="New routine"
      >
        <Input
          label="Routine name"
          placeholder="e.g. Push Day"
          value={routineName}
          onChange={(e) => setRoutineName(e.target.value)}
        />
        <button
          className="bm-btn bm-btn-primary bm-btn-full"
          onClick={onCreateRoutine}
          disabled={saving || !routineName.trim()}
        >
          {saving ? 'Creating...' : 'Create routine'}
        </button>
      </BottomSheet>

      <ConfirmDialog
        open={confirm !== null}
        title={confirm?.kind === 'program' ? 'Delete this program?' : 'Delete this routine?'}
        message={
          confirm?.kind === 'program'
            ? 'Its routines and their exercises go too. Workouts you have already logged are kept.'
            : 'Its exercises go too. Workouts you have already logged are kept.'
        }
        confirmLabel="Delete"
        danger
        onConfirm={onDelete}
        onCancel={() => setConfirm(null)}
      />
    </div>
  )
}
