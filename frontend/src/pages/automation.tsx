import { useCallback, useMemo, useState } from 'react'
import PowerChart from '@/components/PowerChart'
import { formatRM } from '@/context/DashboardContext'

type RoomState = 'occupied' | 'idle' | 'uncertain'
type RuleState = 'active' | 'paused'
type EventLevel = 'safe' | 'warning' | 'critical'

interface RoomAutomation {
  id: number
  room: string
  state: RoomState
  confidencePct: number
  lastSeenMinsAgo: number
  trackedDevices: string[]
  autoAction: string
  hourlySaveRm: number
}

interface AutomationRule {
  id: number
  title: string
  scope: string
  trigger: string
  action: string
  state: RuleState
}

interface TimelineEvent {
  id: number
  time: string
  room: string
  message: string
  level: EventLevel
}

interface AutomationToast {
  id: number
  title: string
  detail: string
  tone: 'on' | 'off'
}

const roomAutomations: RoomAutomation[] = [
  {
    id: 1,
    room: 'Living Room',
    state: 'idle',
    confidencePct: 96,
    lastSeenMinsAgo: 12,
    trackedDevices: ['Ceiling Fan', 'Smart TV'],
    autoAction: 'Fan turned off after 10 min inactivity',
    hourlySaveRm: 0.05,
  },
  {
    id: 2,
    room: 'Kitchen',
    state: 'occupied',
    confidencePct: 93,
    lastSeenMinsAgo: 1,
    trackedDevices: ['Refrigerator', 'Dishwasher', 'Oven'],
    autoAction: 'No action, occupancy detected',
    hourlySaveRm: 0,
  },
  {
    id: 3,
    room: 'Master Bedroom',
    state: 'uncertain',
    confidencePct: 74,
    lastSeenMinsAgo: 5,
    trackedDevices: ['Air Conditioner', 'Smart TV'],
    autoAction: 'Pending: wait 3 min before shutdown',
    hourlySaveRm: 0.03,
  },
  {
    id: 4,
    room: 'Study',
    state: 'idle',
    confidencePct: 91,
    lastSeenMinsAgo: 18,
    trackedDevices: ['Gaming Console', 'Desk Lamp'],
    autoAction: 'Console switched to eco standby',
    hourlySaveRm: 0.04,
  },
]

const automationRules: AutomationRule[] = [
  {
    id: 1,
    title: 'Idle room shutdown',
    scope: 'All comfort devices',
    trigger: 'No presence for 10 minutes',
    action: 'Turn off fans and lights',
    state: 'active',
  },
  {
    id: 2,
    title: 'Sleep mode policy',
    scope: 'Entertainment devices',
    trigger: 'No presence for 15 minutes',
    action: 'Switch to low-power standby',
    state: 'active',
  },
  {
    id: 3,
    title: 'Critical override lock',
    scope: 'Heating and cooling',
    trigger: 'Manual override is active',
    action: 'Suspend all auto-off actions',
    state: 'paused',
  },
]

const timelineEvents: TimelineEvent[] = [
  {
    id: 1,
    time: '08:42',
    room: 'Living Room',
    message: 'No human detected for 12 min, fan turned off',
    level: 'safe',
  },
  {
    id: 2,
    time: '08:39',
    room: 'Study',
    message: 'Console switched to eco standby after inactivity',
    level: 'safe',
  },
  {
    id: 3,
    time: '08:31',
    room: 'Master Bedroom',
    message: 'Low confidence reading, waiting for second confirmation',
    level: 'warning',
  },
  {
    id: 4,
    time: '08:19',
    room: 'Bathroom',
    message: 'Manual override engaged: water heater remains on',
    level: 'critical',
  },
]

interface CheckResult {
  roomsScanned: number
  automationsExecuted: number
  estimatedSave: number
  confidence: number
  timestamp: string
}

interface CheckStep {
  id: string
  label: string
  description: string
  completed: boolean
}

const checkingSteps: Omit<CheckStep, 'completed'>[] = [
  { id: 'scan', label: 'Scanning occupancy', description: 'Reading camera & sensor data from all rooms' },
  { id: 'validate', label: 'Validating data', description: 'Cross-checking sensor readings for integrity' },
  { id: 'rules', label: 'Checking automation rules', description: 'Evaluating active rules against room states' },
  { id: 'impact', label: 'Computing impact', description: 'Calculating energy savings and device actions' },
  { id: 'simulate', label: 'Simulating actions', description: 'Testing control sequences before execution' },
]

export default function AutomationPage() {
  const [automationToasts, setAutomationToasts] = useState<AutomationToast[]>([])
  const [roomControlMode, setRoomControlMode] = useState<Record<number, 'auto' | 'on' | 'off'>>(() =>
    Object.fromEntries(roomAutomations.map((room) => [room.id, 'auto'])) as Record<number, 'auto' | 'on' | 'off'>,
  )
  const [ruleStates, setRuleStates] = useState<Record<number, RuleState>>(() =>
    Object.fromEntries(automationRules.map((rule) => [rule.id, rule.state])) as Record<number, RuleState>,
  )
  const [hvacLockEnabled, setHvacLockEnabled] = useState(false)
  const [graceExtensionEnabled, setGraceExtensionEnabled] = useState(false)
  const [fallbackModeEnabled, setFallbackModeEnabled] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [checkResults, setCheckResults] = useState<CheckResult | null>(null)
  const [checkingStepProgress, setCheckingStepProgress] = useState<CheckStep[]>([])

  // Video modal state
  const [videoModalOpen, setVideoModalOpen] = useState(false)
  const [videoModalRoom, setVideoModalRoom] = useState<string | null>(null)

  const pushToast = useCallback((title: string, detail: string, tone: 'on' | 'off' = 'on') => {
    const id = Date.now() + Math.floor(Math.random() * 1000)
    setAutomationToasts((current) => [...current, { id, title, detail, tone }])
    window.setTimeout(() => {
      setAutomationToasts((current) => current.filter((toast) => toast.id !== id))
    }, 2800)
  }, [])

  const handleRunAutomationCheck = useCallback(() => {
    setIsChecking(true)
    setCheckResults(null)
    setCheckingStepProgress(checkingSteps.map((step) => ({ ...step, completed: false })))

    let currentStep = 0

    const runNextStep = () => {
      if (currentStep < checkingSteps.length) {
        setCheckingStepProgress((prev) =>
          prev.map((step, idx) => ({
            ...step,
            completed: idx < currentStep,
          })),
        )
        currentStep++
        window.setTimeout(runNextStep, 1000)
      } else {
        // All steps complete, show results
        const now = new Date()
        const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        setCheckResults({
          roomsScanned: roomAutomations.length,
          automationsExecuted: Math.floor(roomAutomations.length * 0.75),
          estimatedSave: 0.24,
          confidence: 94,
          timestamp: timeStr,
        })

        setIsChecking(false)

        pushToast('Automation check complete', `${roomAutomations.length} rooms scanned, ${Math.floor(roomAutomations.length * 0.75)} automations executed.`, 'on')
      }
    }

    window.setTimeout(runNextStep, 1000)
  }, [pushToast])

  const handleRoomModeChange = useCallback((room: RoomAutomation, mode: 'auto' | 'on' | 'off') => {
    setRoomControlMode((current) => ({ ...current, [room.id]: mode }))

    if (mode === 'auto') {
      pushToast(`${room.room} set to Auto`, 'Presence AI controls this room again.', 'on')
      return
    }

    if (mode === 'on') {
      pushToast(`${room.room} forced ON`, 'Automation shutoff is paused for this room.', 'off')
      return
    }

    pushToast(`${room.room} forced OFF`, 'Manual power-saving override applied.', 'on')
  }, [pushToast])

  const handleRuleToggle = useCallback((rule: AutomationRule) => {
    setRuleStates((current) => {
      const nextState = (current[rule.id] ?? rule.state) === 'active' ? 'paused' : 'active'
      pushToast(
        `${rule.title} ${nextState === 'active' ? 'activated' : 'paused'}`,
        nextState === 'active' ? 'Automation decisions resumed.' : 'Rule decisions are temporarily paused.',
        nextState === 'active' ? 'on' : 'off',
      )

      return {
        ...current,
        [rule.id]: nextState,
      }
    })
  }, [pushToast])

  const handleOpenVideoModal = useCallback((roomName: string) => {
    setVideoModalRoom(roomName)
    setVideoModalOpen(true)
  }, [])

  const handleCloseVideoModal = useCallback(() => {
    setVideoModalOpen(false)
    setVideoModalRoom(null)
  }, [])

  const occupiedRooms = useMemo(() => roomAutomations.filter((room) => room.state === 'occupied').length, [])
  const idleRooms = useMemo(() => roomAutomations.filter((room) => room.state === 'idle').length, [])
  const uncertainRooms = useMemo(() => roomAutomations.filter((room) => room.state === 'uncertain').length, [])

  const hourlySavings = useMemo(() => {
    return roomAutomations.reduce((sum, room) => {
      const mode = roomControlMode[room.id] ?? 'auto'
      if (mode === 'on') return sum
      return sum + room.hourlySaveRm
    }, 0)
  }, [roomControlMode])

  const dailySavings = hourlySavings * 24
  const weeklySavings = dailySavings * 7

  const activeRules = useMemo(() => Object.values(ruleStates).filter((state) => state === 'active').length, [ruleStates])
  const manualOverrideCount = useMemo(
    () => Object.values(roomControlMode).filter((mode) => mode !== 'auto').length,
    [roomControlMode],
  )

  const getRoomActionText = (room: RoomAutomation) => {
    const mode = roomControlMode[room.id] ?? 'auto'
    if (mode === 'on') return 'Manual override: keep devices on'
    if (mode === 'off') return 'Manual override: force turn off selected devices'
    return room.autoAction
  }

  const getRoomSave = (room: RoomAutomation) => {
    const mode = roomControlMode[room.id] ?? 'auto'
    if (mode === 'on') return 0
    return room.hourlySaveRm
  }

  return (
    <div className="page-shell">
      {/* Video Modal */}
      {videoModalOpen && (
        <div className="video-modal-overlay" onClick={handleCloseVideoModal}>
          <div className="video-modal" onClick={(e) => e.stopPropagation()}>
            <div className="video-modal-header">
              <h3>{videoModalRoom} – Live Feed</h3>
              <button
                type="button"
                className="video-modal-close"
                onClick={handleCloseVideoModal}
                aria-label="Close video"
              >
                ✕
              </button>
            </div>
            <video
              className="video-modal-player"
              src="/Smart Energy Automation Switch.mp4"
              controls
              autoPlay
            />
          </div>
        </div>
      )}

      <div className="toast-container">
        {automationToasts.map((toast) => (
          <div key={toast.id} className={`toast ${toast.tone === 'on' ? 'toast-on' : 'toast-off'}`}>
            <span className="toast-device">{toast.title}</span>
            <span className="toast-status">{toast.detail}</span>
          </div>
        ))}
      </div>

      <main className="dashboard">
        <section className="automation-hero panel">
          <div className="automation-hero-main">
            <div className="eyebrow">Energy Automation</div>
            <h1 className="hero-title">Computer vision presence-based auto-saving</h1>
            <p className="hero-copy">
              Detects room occupancy and automatically turns off unused appliances to reduce energy waste while preserving comfort.
            </p>

            <div className="automation-status-row">
              <span className="pill pill-green">AI presence engine online</span>
              <span className="pill pill-amber">{uncertainRooms} uncertain room signals</span>
              <span className="pill pill-red">{manualOverrideCount} manual overrides active</span>
            </div>
          </div>

          <div className="automation-hero-side">
            {!checkResults && (
              <button
                className={`button ${isChecking ? 'button-loading' : 'button-primary'}`}
                onClick={handleRunAutomationCheck}
                disabled={isChecking}
              >
                {isChecking ? (
                  <>
                    <span className="spinner"></span>
                    Checking...
                  </>
                ) : (
                  'Run automation check now'
                )}
              </button>
            )}

            {isChecking && (
              <div className="automation-checking-progress">
                {checkingStepProgress.map((step) => (
                  <div key={step.id} className={`checking-step ${step.completed ? 'completed' : ''}`}>
                    <div className="checking-step-icon">
                      {step.completed ? <span className="step-checkmark">✓</span> : <span className="step-spinner"></span>}
                    </div>
                    <div className="checking-step-content">
                      <div className="checking-step-label">{step.label}</div>
                      <div className="checking-step-description">{step.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {checkResults && (
              <div className="automation-check-results">
                <div className="check-results-header">
                  <div className="check-results-title">Check results</div>
                  <div className="check-results-time">{checkResults.timestamp}</div>
                </div>
                <div className="check-results-row">
                  <div className="check-results-item">
                    <span className="check-results-label">Rooms scanned</span>
                    <span className="check-results-value">{checkResults.roomsScanned}</span>
                  </div>
                  <div className="check-results-item">
                    <span className="check-results-label">Automations executed</span>
                    <span className="check-results-value">{checkResults.automationsExecuted}</span>
                  </div>
                  <div className="check-results-item">
                    <span className="check-results-label">Estimated save</span>
                    <span className="check-results-value">{formatRM(checkResults.estimatedSave)}</span>
                  </div>
                  <div className="check-results-item">
                    <span className="check-results-label">Confidence</span>
                    <span className="check-results-value">{checkResults.confidence}%</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="button button-primary"
                  onClick={() => {
                    setCheckResults(null)
                    setCheckingStepProgress([])
                  }}
                  style={{ width: '100%', marginTop: 12 }}
                >
                  Run again
                </button>
              </div>
            )}

            <div className="automation-safe-note">
              <div className="signal-label">Safe-state messaging</div>
              <p>
                {manualOverrideCount > 0
                  ? 'Manual override is active. Auto-shutdown decisions are partially paused until restored to Auto mode.'
                  : 'No human detected for 12 min in Living Room. Ceiling Fan was turned off automatically.'}
              </p>
            </div>
          </div>
        </section>

        <section className="automation-overview-grid">
          <article className="automation-overview-card automation-overview-card-green">
            <span className="automation-overview-label">Occupied rooms</span>
            <strong>{occupiedRooms}</strong>
            <span>Live CV detection with high confidence</span>
          </article>
          <article className="automation-overview-card automation-overview-card-blue">
            <span className="automation-overview-label">Idle rooms</span>
            <strong>{idleRooms}</strong>
            <span>Eligible for auto-saving actions</span>
          </article>
          <article className="automation-overview-card automation-overview-card-amber">
            <span className="automation-overview-label">Active automations</span>
            <strong>{activeRules}</strong>
            <span>Rules currently making control decisions</span>
          </article>
          <article className="automation-overview-card automation-overview-card-teal">
            <span className="automation-overview-label">Estimated hourly savings</span>
            <strong>{formatRM(hourlySavings)}</strong>
            <span>Projected from current occupancy pattern</span>
          </article>
        </section>

        <section className="automation-main-grid">
          <div className="automation-room-panel panel">
            <div className="panel-heading-row">
              <div>
                <h2 className="panel-title">Room occupancy control grid</h2>
                <p className="panel-copy">Confidence-scored occupancy states and automatic device decisions per room.</p>
              </div>
            </div>

            <div className="automation-room-grid">
              {roomAutomations.map((room) => (
                <article className="automation-room-card" key={room.id}>
                  <div className="automation-room-head">
                    <h3>{room.room}</h3>
                    <div className="automation-room-status-row">
                      <button
                        type="button"
                        className="video-play-btn"
                        onClick={() => handleOpenVideoModal(room.room)}
                        aria-label={`Play video for ${room.room}`}
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      </button>
                      <span
                        className={`pill ${
                          room.state === 'occupied'
                            ? 'pill-green'
                            : room.state === 'idle'
                            ? 'pill-amber'
                            : 'pill-red'
                        }`}
                      >
                        {room.state}
                      </span>
                    </div>
                  </div>

                  <div className="automation-room-meta">
                    <span>Confidence: {room.confidencePct}%</span>
                    <span>Last seen: {room.lastSeenMinsAgo} min ago</span>
                  </div>

                  <div className="automation-room-devices">{room.trackedDevices.join(' · ')}</div>

                  <div className="automation-room-controls">
                    <span className="automation-room-controls-label">Control mode</span>
                    <div className="automation-room-toggle-group">
                      <button
                        type="button"
                        className={`automation-toggle-btn ${roomControlMode[room.id] === 'auto' ? 'active' : ''}`}
                        onClick={() => handleRoomModeChange(room, 'auto')}
                      >
                        Auto
                      </button>
                      <button
                        type="button"
                        className={`automation-toggle-btn ${roomControlMode[room.id] === 'on' ? 'active' : ''}`}
                        onClick={() => handleRoomModeChange(room, 'on')}
                      >
                        Turn on
                      </button>
                      <button
                        type="button"
                        className={`automation-toggle-btn ${roomControlMode[room.id] === 'off' ? 'active' : ''}`}
                        onClick={() => handleRoomModeChange(room, 'off')}
                      >
                        Turn off
                      </button>
                    </div>
                  </div>

                  <div className="automation-room-action">{getRoomActionText(room)}</div>

                  <div className="automation-room-save">Potential save: {formatRM(getRoomSave(room))} / hour</div>
                </article>
              ))}
            </div>
          </div>

          <div className="automation-side-column">
            <div className="panel">
              <div className="panel-heading-row">
                <div>
                  <h2 className="panel-title">Automation rules</h2>
                  <p className="panel-copy">Editable-looking controls for occupancy-triggered energy actions.</p>
                </div>
              </div>

              <div className="automation-rule-list">
                {automationRules.map((rule) => (
                  <article className="automation-rule-card" key={rule.id}>
                    <div className="automation-rule-top">
                      <h3>{rule.title}</h3>
                      <span className={`pill ${ruleStates[rule.id] === 'active' ? 'pill-green' : 'pill-amber'}`}>{ruleStates[rule.id] ?? rule.state}</span>
                    </div>
                    <div className="automation-rule-meta">Scope: {rule.scope}</div>
                    <div className="automation-rule-meta">Trigger: {rule.trigger}</div>
                    <div className="automation-rule-meta">Action: {rule.action}</div>
                    <button
                      type="button"
                      className="button button-secondary"
                      style={{ width: '100%', marginTop: 8 }}
                      onClick={() => handleRuleToggle(rule)}
                    >
                      {(ruleStates[rule.id] ?? rule.state) === 'active' ? 'Pause rule' : 'Activate rule'}
                    </button>
                  </article>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-heading-row">
                <div>
                  <h2 className="panel-title">Savings analytics</h2>
                  <p className="panel-copy">Mocked impact trend from automation decisions.</p>
                </div>
              </div>

              <div className="chart-signals">
                <div className="signal-chip">
                  <div className="signal-label">Hourly</div>
                  <div className="signal-value">{formatRM(hourlySavings)}</div>
                </div>
                <div className="signal-chip">
                  <div className="signal-label">Daily</div>
                  <div className="signal-value">{formatRM(dailySavings)}</div>
                </div>
                <div className="signal-chip">
                  <div className="signal-label">Weekly</div>
                  <div className="signal-value">{formatRM(weeklySavings)}</div>
                </div>
              </div>

              <PowerChart
                series={[0.08, 0.12, 0.18, 0.15, 0.21, 0.26, 0.29]}
                labels={['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']}
              />
            </div>
          </div>
        </section>

        <section className="automation-bottom-grid">
          <div className="panel">
            <div className="panel-heading-row">
              <div>
                <h2 className="panel-title">Detection timeline</h2>
                <p className="panel-copy">Recent presence events and AI-triggered actions.</p>
              </div>
            </div>

            <div className="automation-timeline">
              {timelineEvents.map((event) => (
                <article className="automation-timeline-item" key={event.id}>
                  <div className="automation-timeline-time">{event.time}</div>
                  <div>
                    <div className="automation-timeline-room">{event.room}</div>
                    <div className="automation-timeline-message">{event.message}</div>
                  </div>
                  <span className={`pill ${event.level === 'safe' ? 'pill-green' : event.level === 'warning' ? 'pill-amber' : 'pill-red'}`}>
                    {event.level}
                  </span>
                </article>
              ))}
            </div>
          </div>

          <div className="panel automation-override-panel">
            <div className="panel-heading-row">
              <div>
                <h2 className="panel-title">Manual override & fail-safe</h2>
                <p className="panel-copy">Human-first controls when occupancy detection is uncertain or critical.</p>
              </div>
            </div>

            <div className="automation-override-list">
              <div className="automation-override-item">
                <div>
                  <div className="automation-override-title">Lock HVAC automation</div>
                  <div className="automation-override-note">Prevents automatic shutoff while guests are present.</div>
                </div>
                <button
                  type="button"
                  className={`button ${hvacLockEnabled ? 'button-primary' : 'button-secondary'}`}
                  onClick={() =>
                    setHvacLockEnabled((current) => {
                      const next = !current
                      pushToast(
                        `HVAC lock ${next ? 'enabled' : 'disabled'}`,
                        next ? 'Automatic HVAC shutdown is blocked.' : 'HVAC automation restored.',
                        next ? 'off' : 'on',
                      )
                      return next
                    })
                  }
                >
                  {hvacLockEnabled ? 'Enabled' : 'Enable lock'}
                </button>
              </div>

              <div className="automation-override-item">
                <div>
                  <div className="automation-override-title">Grace period extension</div>
                  <div className="automation-override-note">Extend idle timeout from 10 to 20 minutes.</div>
                </div>
                <button
                  type="button"
                  className={`button ${graceExtensionEnabled ? 'button-primary' : 'button-secondary'}`}
                  onClick={() =>
                    setGraceExtensionEnabled((current) => {
                      const next = !current
                      pushToast(
                        `Grace period ${next ? 'extended' : 'reset'}`,
                        next ? 'Idle timeout increased to 20 minutes.' : 'Idle timeout restored to 10 minutes.',
                        'on',
                      )
                      return next
                    })
                  }
                >
                  {graceExtensionEnabled ? 'Applied' : 'Apply extension'}
                </button>
              </div>

              <div className="automation-override-item">
                <div>
                  <div className="automation-override-title">Emergency fallback</div>
                  <div className="automation-override-note">Disable all auto-actions and switch to monitor-only mode.</div>
                </div>
                <button
                  type="button"
                  className={`button ${fallbackModeEnabled ? 'button-secondary' : 'button-primary'}`}
                  onClick={() =>
                    setFallbackModeEnabled((current) => {
                      const next = !current
                      pushToast(
                        `Emergency fallback ${next ? 'activated' : 'disabled'}`,
                        next ? 'Automation switched to monitor-only mode.' : 'Normal automation control resumed.',
                        next ? 'off' : 'on',
                      )
                      return next
                    })
                  }
                >
                  {fallbackModeEnabled ? 'Fallback active' : 'Activate fallback'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}