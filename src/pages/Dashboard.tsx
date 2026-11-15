import { Link, useSearchParams } from 'react-router';
import { IconPlus } from '../components/icons';
import { ActNowBanner } from '../components/today/ActNowBanner';
import { AttentionPanel } from '../components/today/AttentionPanel';
import { ReadinessSummary } from '../components/today/ReadinessSummary';
import { VitalCard } from '../components/today/VitalCard';
import { btn } from '../components/tone';
import { PageHeader } from '../components/ui';
import { attention, dashboardVitals, DUE_TODAY, readiness, SHIP } from './designMock';

// Owner B: "Today" dashboard. KPI vitals first (left, largest), then what to do (right).
// At ≥1280×600 the app locks to the viewport (`.chc-fit` rule in index.css): no page scroll;
// only the attention list scrolls inside its panel. Smaller screens fall back to normal flow.
// LAYOUT TEST: shows design mock data. Add ?alert to the URL for the Act-now state.

export function Dashboard() {
  const [params] = useSearchParams();
  const alert = params.has('alert');
  const ready = readiness(alert);
  const vitals = dashboardVitals(alert);

  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Today"
        meta={[
          { label: 'Mission day', value: SHIP.day },
          { label: 'Date', value: SHIP.date },
          { label: 'Ship time', value: SHIP.time },
        ]}
      >
        <Link to="/log" className={btn('primary', 'h-11 pr-5 pl-4 text-base no-underline')}>
          <IconPlus size={20} strokeWidth={2.2} />
          Log vitals
        </Link>
      </PageHeader>

      {alert && <ActNowBanner />}

      <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        <section
          aria-labelledby="vit-h"
          className="flex min-w-0 animate-chc-in flex-col gap-2 [animation-delay:60ms] xl:min-h-0 xl:flex-1"
        >
          <h2 id="vit-h" className="sr-only">
            Today’s vitals
          </h2>
          <div
            aria-live="polite"
            className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:min-h-0 xl:flex-1 xl:grid-cols-3 xl:grid-rows-2"
          >
            {vitals.map((t) => (
              <VitalCard key={t.label} t={t} />
            ))}
          </div>
        </section>

        <div className="flex min-w-0 animate-chc-in flex-col gap-3.5 [animation-delay:120ms] xl:min-h-0 xl:w-[clamp(340px,26vw,440px)] xl:shrink-0">
          <ReadinessSummary ready={ready} />
          <AttentionPanel items={attention(alert)} due={DUE_TODAY} logged={3} total={7} />
        </div>
      </div>
    </div>
  );
}
