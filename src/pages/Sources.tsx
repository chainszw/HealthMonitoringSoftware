import { PageHeader, Panel } from '../components/ui';
import { content, contentMeta, contentSources } from '../data/content';

// Owner B: "Sources and credits" (linked from the footer). Every source in content.json with the
// indicators that use it, plus credits for the 3D anatomy models, the ZOĒ concept device and
// third-party software. Links open when online; the list itself works offline.

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

export function Sources() {
  return (
    <div className="flex flex-col gap-3.5 xl:min-h-0 xl:flex-1">
      <PageHeader
        title="Sources and credits"
        meta={[
          { label: 'Content version', value: contentMeta.version },
          { label: 'Updated', value: contentMeta.lastUpdated },
          { label: 'Sources', value: String(contentSources.length) },
        ]}
      />
      <div className="chc-fit-cols flex flex-col gap-3.5 xl:min-h-0 xl:flex-1 xl:flex-row">
        <Panel
          title="Health guidance sources"
          aside={`${contentSources.length} cited`}
          className="chc-scroll min-w-0 xl:flex-1"
        >
          <ol className="m-0 flex list-none flex-col gap-2.5 p-0">
            {contentSources.map((s, i) => (
              <li key={s.id} className="flex gap-3 border-b border-line pb-2.5 last:border-0">
                <span className="w-6 shrink-0 text-right font-mono text-[13px] text-muted">
                  {i + 1}.
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  {s.url ? (
                    <a
                      href={s.url}
                      {...ext}
                      className="text-[15px] font-medium text-accent no-underline hover:underline"
                    >
                      {s.title}
                    </a>
                  ) : (
                    <span className="text-[15px] font-medium">{s.title}</span>
                  )}
                  <span className="text-[13px] text-muted">
                    {s.org ?? 'Source'}
                    {s.usedBy.length ? ` · used for ${s.usedBy.join(', ')}` : ' · background'}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </Panel>

        <div className="chc-scroll flex min-w-0 flex-col gap-3.5 xl:w-[clamp(320px,32vw,520px)] xl:shrink-0">
          <Panel title="3D anatomy models">
            <p className="m-0 text-[14px] leading-5 text-text">
              Human Reference Atlas (HRA), HuBMAP, united male and female reference object sets
              v1.5. Medical illustration by Kristen Browne, Heidi Schlehlein and contributing HRA
              teams, based on the National Library of Medicine Visible Human data; Allen brain
              structures keep Allen Institute provenance. Licensed{' '}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                {...ext}
                className="text-accent"
              >
                CC BY 4.0
              </a>
              . Adapted: organ groups combined, polygon counts reduced, navy palette applied. No
              agency endorsement is implied.
            </p>
            <p className="m-0 text-[13px] text-muted">
              Educational interface, not a diagnostic device. Colours and highlights are
              illustrative, not measured tissue health.{' '}
              <a
                href={`${import.meta.env.BASE_URL}models/ATTRIBUTION.md`}
                {...ext}
                className="text-accent"
              >
                Full attribution
              </a>
              {' · '}
              <a href="https://humanatlas.io/3d-reference-library" {...ext} className="text-accent">
                HRA 3D library
              </a>
            </p>
          </Panel>

          <Panel title="ZOĒ device">
            <p className="m-0 text-[14px] leading-5 text-text">
              ZOĒ is a concept wearable designed by the team. Its finger scans, immune index and
              hazard levels are simulated for the demo, not measurements. Hazard names follow NASA’s
              five hazards of human spaceflight; the levels are the team’s estimate.
            </p>
          </Panel>

          <Panel title="Software">
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-[14px] text-text">
              <li>three.js (MIT) for the 3D views</li>
              <li>React, React Router, Vite, Tailwind CSS (MIT)</li>
              <li>Hono and Node.js SQLite for the optional sync server</li>
            </ul>
          </Panel>

          <Panel title="About this app">
            <p className="m-0 text-[13px] leading-[19px] text-muted">{content.disclaimer}</p>
          </Panel>
        </div>
      </div>
    </div>
  );
}
