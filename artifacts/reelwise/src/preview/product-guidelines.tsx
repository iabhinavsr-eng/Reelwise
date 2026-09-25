import { Guidelines } from './parts';

export function ContentGuidelinesPage() {
  return (
    <div className="space-y-6 rounded-xl border bg-card p-6 text-card-foreground">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
          Voice
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Helpful, clear, and human
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The onboarding reference explains what happens next, keeps prompts
          conversational, and reassures people that they remain in control.
          Carry that tone into script setup and recording guidance.
        </p>
      </section>
      <section className="space-y-3 border-t pt-5">
        <h3 className="font-semibold">Writing guidance</h3>
        <Guidelines
          items={[
            { kind: 'do', text: 'Use short, direct prompts that sound natural when read aloud.' },
            { kind: 'do', text: 'Explain what a setting changes before asking someone to choose it.' },
            { kind: 'do', text: 'Use supportive language that helps creators feel prepared, not judged.' },
            { kind: 'dont', text: 'Use unexplained recording or editing jargon in first-run setup.' },
            { kind: 'dont', text: 'Promise that a script or recording will perform well on social media.' },
          ]}
        />
      </section>
      <section className="rounded-lg bg-accent p-4 text-accent-foreground">
        <p className="text-xs font-semibold uppercase tracking-wide">Example</p>
        <p className="mt-2 font-medium">“Add a script. We’ll keep your place while you record.”</p>
      </section>
    </div>
  );
}

export function MotionGuidelinesPage() {
  return (
    <div className="space-y-6 rounded-xl border bg-card p-6 text-card-foreground">
      <section className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-secondary">
          Motion
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          Movement should keep the creator oriented
        </h2>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          The reference uses a brief progress transition and a clear spinner
          during analysis. Motion is small, functional, and tied to an explicit
          wait or state change.
        </p>
      </section>
      <section className="space-y-3 border-t pt-5">
        <h3 className="font-semibold">Motion guidance</h3>
        <Guidelines
          items={[
            { kind: 'do', text: 'Animate progress changes briefly so each setup step feels connected.' },
            { kind: 'do', text: 'Pair a loading indicator with plain-language status and visible progress.' },
            { kind: 'do', text: 'Keep recording controls still and predictable while a creator is speaking.' },
            { kind: 'dont', text: 'Use looping or attention-grabbing motion near the active script.' },
          ]}
        />
      </section>
      <div className="rounded-xl bg-muted p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="font-medium">Your setup</span>
          <span className="text-muted-foreground">Step 3 of 5</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-border">
          <div className="h-full w-3/5 rounded-full bg-secondary transition-[width] duration-300" />
        </div>
      </div>
    </div>
  );
}