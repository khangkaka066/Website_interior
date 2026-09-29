import { formatDateTime } from '../../utils/format'

// Generic vertical step timeline. `steps` is an ordered list of
// { key, label }; `events` is the actual history (status + createdAt, plus
// optional location/note) as returned by the API. A step is "completed" if
// an event for it (or any step after it) exists, "current" if it's the
// latest reached step, and untouched otherwise.
export default function StatusTimeline({ steps, events, failed = false }) {
  const reachedKeys = new Set(events.map((e) => e.status))
  let lastReachedIdx = -1
  steps.forEach((s, i) => {
    if (reachedKeys.has(s.key)) lastReachedIdx = i
  })
  const isFinished = lastReachedIdx === steps.length - 1

  return (
    <div className="step-timeline">
      {steps.map((step, i) => {
        const event = events.find((e) => e.status === step.key)
        const completed = i < lastReachedIdx || (i === lastReachedIdx && isFinished)
        const current = i === lastReachedIdx && !isFinished
        const isFailedStep = failed && i === lastReachedIdx
        return (
          <div
            key={step.key}
            className={`step-timeline-item ${completed ? 'completed' : ''} ${current ? 'current' : ''} ${isFailedStep ? 'failed' : ''}`}
          >
            <div className="step-timeline-dot" />
            <div className="step-timeline-line" />
            <div className="step-timeline-content">
              <div className="step-timeline-label">{step.label}</div>
              {event && (
                <>
                  <div className="step-timeline-time">{formatDateTime(event.createdAt)}</div>
                  {event.location && <div className="step-timeline-location">📍 {event.location}</div>}
                  {event.note && <div className="step-timeline-note">{event.note}</div>}
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
