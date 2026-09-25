import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BatteryFull,
  Check,
  Eye,
  Pause,
  Play,
  RotateCcw,
  Sparkles,
  Wifi,
} from "lucide-react";
import { Badge } from "@workspace/reelwise/components/ui/badge";
import { Button } from "@workspace/reelwise/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/reelwise/components/ui/card";
import { Input } from "@workspace/reelwise/components/ui/input";
import { Label } from "@workspace/reelwise/components/ui/label";
import { Progress } from "@workspace/reelwise/components/ui/progress";
import { Slider } from "@workspace/reelwise/components/ui/slider";
import { Switch } from "@workspace/reelwise/components/ui/switch";
import { Textarea } from "@workspace/reelwise/components/ui/textarea";

const sampleScript =
  "Here’s one small change that made filming feel a lot more natural for me.\n\nInstead of memorizing every word, I keep my thoughts close to the camera and speak one idea at a time.\n\nIt feels more like a conversation—and that’s when the best takes happen.";

const steps = ["Welcome", "Your setup", "Your first script", "Practice"];

export function Onboarding() {
  const [step, setStep] = useState(0);
  const [creatorName, setCreatorName] = useState("");
  const [cameraPosition, setCameraPosition] = useState("Top of screen");
  const [wordsPerMinute, setWordsPerMinute] = useState(145);
  const [textSize, setTextSize] = useState("Comfortable");
  const [mirrorText, setMirrorText] = useState(false);
  const [script, setScript] = useState(sampleScript);
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const scriptLines = script
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const duration = Math.max(scriptLines.length * 8, 8);
  const progress = Math.min((elapsed / duration) * 100, 100);
  const activeLine = Math.min(
    Math.floor(elapsed / (duration / scriptLines.length)),
    scriptLines.length - 1,
  );

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setElapsed((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  useEffect(() => {
    if (elapsed >= duration) setIsPlaying(false);
  }, [duration, elapsed]);

  const goBack = () => {
    if (step > 0) {
      setStep((current) => current - 1);
      setIsPlaying(false);
    }
  };

  const continueFlow = () => {
    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      setIsPlaying(false);
    }
  };

  const startOver = () => {
    setElapsed(0);
    setIsPlaying(false);
  };

  const togglePractice = () => {
    if (elapsed >= duration) {
      setElapsed(0);
      setIsPlaying(true);
      return;
    }
    setIsPlaying((playing) => !playing);
  };

  const textSizeClass =
    textSize === "Large"
      ? "text-xl leading-8"
      : textSize === "Compact"
        ? "text-sm leading-6"
        : "text-base leading-7";

  return (
    <main className="flex min-h-dvh w-full justify-center bg-background text-foreground">
      <div className="flex min-h-dvh w-full max-w-sm flex-col bg-background">
        <div className="flex items-center justify-between px-6 pb-2 pt-3 text-xs font-medium text-muted-foreground">
          <span>9:41</span>
          <div className="flex items-center gap-1.5" aria-label="Phone status">
            <span className="sr-only">Connected</span>
            <Wifi className="h-3.5 w-3.5" aria-hidden="true" />
            <BatteryFull className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>

        <header className="px-5">
          <div className="flex h-12 items-center justify-between">
            {step > 0 && step < steps.length - 1 ? (
              <Button
                aria-label="Go back"
                className="w-9"
                onClick={goBack}
                size="icon"
                variant="ghost"
              >
                <ArrowLeft aria-hidden="true" />
              </Button>
            ) : (
              <div className="w-9" aria-hidden="true" />
            )}
            <div className="text-lg font-semibold tracking-tight">
              reel<span className="text-secondary">wise</span>
            </div>
            <div className="w-9" aria-hidden="true" />
          </div>
          {step < steps.length - 1 && (
            <div className="pb-2">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">
                  STEP {step + 1} OF {steps.length - 1}
                </p>
                <p className="text-xs font-medium text-muted-foreground">
                  {steps[step]}
                </p>
              </div>
              <Progress
                aria-label={`Onboarding progress: ${step + 1} of ${steps.length - 1}`}
                value={((step + 1) / (steps.length - 1)) * 100}
              />
            </div>
          )}
        </header>

        <section className="flex-1 overflow-y-auto px-6 pb-5 pt-5">
          {step === 0 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Badge variant="secondary">A calmer way to record</Badge>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight">
                  Feel ready before you press record.
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Keep your words beside the lens, find your rhythm, and sound
                  like yourself on camera.
                </p>
              </div>

              <Card>
                <CardContent className="space-y-4 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Eye
                        className="h-4 w-4 text-secondary"
                        aria-hidden="true"
                      />
                      Your script, close to the camera
                    </div>
                    <Badge variant="outline">A quick look</Badge>
                  </div>
                  <div className="space-y-2 rounded-lg bg-muted p-3">
                    <div className="h-2 w-3/4 rounded-full bg-foreground/20" />
                    <div className="h-2 w-full rounded-full bg-foreground/20" />
                    <div className="h-2 w-5/6 rounded-full bg-secondary" />
                    <div className="h-2 w-2/3 rounded-full bg-foreground/20" />
                  </div>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Just a few thoughtful settings, then a no-pressure practice
                    take.
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="creator-name">What should we call you?</Label>
                <Input
                  autoComplete="given-name"
                  id="creator-name"
                  onChange={(event) => setCreatorName(event.target.value)}
                  placeholder="Your first name"
                  value={creatorName}
                />
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  YOUR SETUP
                </p>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight">
                  Make the words feel easy to follow.
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Choose a comfortable pace and keep your gaze near the lens.
                  You can change everything later.
                </p>
              </div>

              <Card>
                <CardHeader className="p-4 pb-3">
                  <CardTitle className="text-sm">Reading pace</CardTitle>
                  <p className="text-xs leading-5 text-muted-foreground">
                    A slower pace gives you room to breathe between thoughts.
                  </p>
                </CardHeader>
                <CardContent className="space-y-3 px-4 pb-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm text-muted-foreground">
                      Unhurried
                    </span>
                    <span className="text-sm font-semibold">
                      {wordsPerMinute}{" "}
                      <span className="font-normal text-muted-foreground">
                        words / min
                      </span>
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Brisk
                    </span>
                  </div>
                  <Slider
                    aria-label="Reading pace in words per minute"
                    max={220}
                    min={90}
                    onValueChange={(value) =>
                      setWordsPerMinute(value[0] ?? 145)
                    }
                    step={5}
                    value={[wordsPerMinute]}
                  />
                </CardContent>
              </Card>

              <div className="space-y-3">
                <Label>Where will your camera sit?</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["Top of screen", "Below screen"].map((position) => (
                    <Button
                      key={position}
                      className="h-auto min-h-10 whitespace-normal px-3 py-3 text-sm"
                      onClick={() => setCameraPosition(position)}
                      variant={
                        cameraPosition === position ? "secondary" : "outline"
                      }
                    >
                      {cameraPosition === position && (
                        <Check className="h-4 w-4" aria-hidden="true" />
                      )}
                      {position}
                    </Button>
                  ))}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  We’ll keep the script close to your {cameraPosition.toLowerCase()}.
                </p>
              </div>

              <div className="space-y-3">
                <Label>Script size</Label>
                <div className="grid grid-cols-3 gap-2">
                  {["Compact", "Comfortable", "Large"].map((size) => (
                    <Button
                      key={size}
                      className="px-2 text-xs"
                      onClick={() => setTextSize(size)}
                      variant={textSize === size ? "secondary" : "outline"}
                    >
                      {size}
                    </Button>
                  ))}
                </div>
              </div>

              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Mirror the script</p>
                    <p className="text-xs leading-5 text-muted-foreground">
                      Useful with a reflection-style teleprompter.
                    </p>
                  </div>
                  <Switch
                    aria-label="Mirror the script"
                    checked={mirrorText}
                    onCheckedChange={setMirrorText}
                  />
                </CardContent>
              </Card>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  YOUR FIRST SCRIPT
                </p>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight">
                  Start with something simple.
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  {creatorName.trim()
                    ? `A quick warm-up for you, ${creatorName.trim()}.`
                    : "A quick warm-up to help you settle in."}{" "}
                  Edit the words until they sound like you.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="first-script">Practice script</Label>
                <Textarea
                  className="min-h-52 resize-none"
                  id="first-script"
                  onChange={(event) => setScript(event.target.value)}
                  value={script}
                />
                <p className="text-xs leading-5 text-muted-foreground">
                  A few short thoughts are easier to read naturally than one
                  long paragraph.
                </p>
              </div>

              <Card>
                <CardContent className="flex gap-3 p-4">
                  <Sparkles
                    className="mt-0.5 h-4 w-4 shrink-0 text-secondary"
                    aria-hidden="true"
                  />
                  <p className="text-xs leading-5 text-muted-foreground">
                    Tip: look at the lens at the end of each thought. Reelwise
                    keeps your place while you find your own rhythm.
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-secondary">
                  YOUR FIRST PRACTICE
                </p>
                <h1 className="text-3xl font-semibold leading-tight tracking-tight">
                  {creatorName.trim()
                    ? `You’ve got this, ${creatorName.trim()}.`
                    : "No pressure. Just a practice."}
                </h1>
                <p className="text-sm leading-6 text-muted-foreground">
                  Your camera isn’t recording. Try a line, pause, and start
                  again whenever you like.
                </p>
              </div>

              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-3">
                  <div className="space-y-1">
                    <CardTitle className="text-sm">Practice take</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {isPlaying
                        ? "Follow the highlighted line"
                        : elapsed >= duration
                          ? "That’s a lovely first take."
                          : "Your script is ready when you are"}
                    </p>
                  </div>
                  <Badge variant="secondary">
                    <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-secondary-foreground" />
                    Practice
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4 px-4 pb-4">
                  <div
                    className={`space-y-4 rounded-lg bg-muted p-4 ${mirrorText ? "-scale-x-100" : ""}`}
                    aria-live="polite"
                  >
                    {scriptLines.map((line, index) => (
                      <p
                        className={`${textSizeClass} ${
                          index === activeLine
                            ? "font-medium text-foreground"
                            : "text-muted-foreground"
                        }`}
                        key={line}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <Progress
                      aria-label="Practice script progress"
                      value={progress}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>
                        {`0:${String(elapsed).padStart(2, "0")}`}
                      </span>
                      <span>0:{duration}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                      {wordsPerMinute} words / min
                    </p>
                    <Button
                      aria-label="Start over"
                      onClick={startOver}
                      size="icon"
                      variant="ghost"
                    >
                      <RotateCcw aria-hidden="true" />
                    </Button>
                  </div>
                  <Button
                    className="w-full"
                    onClick={togglePractice}
                    variant="default"
                  >
                    {isPlaying ? (
                      <>
                        <Pause aria-hidden="true" />
                        Pause practice
                      </>
                    ) : (
                      <>
                        <Play aria-hidden="true" />
                        {elapsed >= duration ? "Practice again" : "Start practice"}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              <div className="flex items-start gap-2 rounded-lg bg-accent p-3 text-accent-foreground">
                <Eye className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <p className="text-xs leading-5">
                  Keep your eyes near the camera. A small pause between lines
                  sounds like you—not a script.
                </p>
              </div>
            </div>
          )}
        </section>

        {step < steps.length - 1 && (
          <footer className="border-t bg-background px-6 pb-6 pt-4">
            <Button className="w-full" onClick={continueFlow} size="lg">
              {step === 0
                ? "Set up my prompter"
                : step === 1
                  ? "Looks comfortable"
                  : "Try my first practice"}
              <ArrowRight aria-hidden="true" />
            </Button>
            {step === 0 && (
              <p className="mt-3 text-center text-xs text-muted-foreground">
                No account needed for this quick setup.
              </p>
            )}
          </footer>
        )}
      </div>
    </main>
  );
}