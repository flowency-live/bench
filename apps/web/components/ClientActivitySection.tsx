import type { ClientActivity } from '@bench/types';

interface Props {
  activity: readonly ClientActivity[];
}

/**
 * Section showing recent client activity (profile views, exports).
 */
export function ClientActivitySection({ activity }: Props) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white">Recent Activity</h2>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
        What this client has viewed and exported
      </p>

      {activity.length === 0 ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center">
          <p className="text-[var(--color-text-secondary)]">No activity yet.</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
            Activity will appear here once contacts start using the portal.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-white/10 bg-white/[0.02]">
              <tr>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">
                  Action
                </th>
                <th className="hidden px-4 py-3 font-semibold text-[var(--color-text-secondary)] sm:table-cell">
                  Contact
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">
                  Profile
                </th>
                <th className="px-4 py-3 font-semibold text-[var(--color-text-secondary)]">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {activity.map((event) => (
                <tr key={event.id} className="transition hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <span
                      className={
                        event.eventType === 'view'
                          ? 'rounded-full bg-blue-500/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-blue-400'
                          : 'rounded-full bg-[var(--color-accent)]/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-[var(--color-accent)]'
                      }
                    >
                      {event.eventType === 'view' ? 'Viewed' : 'Exported'}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 text-[var(--color-text-secondary)] sm:table-cell">
                    {event.contactEmail}
                  </td>
                  <td className="px-4 py-3 text-white">
                    <span className="font-mono text-xs">{event.profileId.slice(0, 8)}...</span>
                  </td>
                  <td className="px-4 py-3 text-[var(--color-text-secondary)]">
                    {new Date(event.createdAt).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
