# How we evaluate this challenge

Read this before you start. It tells you what we look for and — just as importantly — what we don't.

---

## The premise

Modern engineering is shifting. AI tools have made writing code dramatically cheaper. What's becoming scarcer is the ability to **decide what to build, identify what's wrong, communicate decisions clearly, and own outcomes past the merge button.**

That shift is what this challenge tries to measure. It does not measure typing speed, framework familiarity, or how many fixes you can push in an hour. It measures judgment.

---

## What we look at, ordered by what matters most

### 1. How you reason about boundaries

Software has seams — between modules, between services, between teams, between humans and AI. Strong engineers spot the seams, name them, and design across them deliberately. Weak engineers ignore them.

In this challenge: when you address an issue or add a feature, do you notice when your change crosses a seam? Do you name the seam? Do you propose a clean shape for it, or do you patch the symptom?

### 2. How you direct AI

We expect you to use AI tools. We want to see the prompt history.

A good engineer with AI looks like: clear specifications, constraints stated upfront, edge cases considered before the first prompt, critical review of the output, and refinement based on root-cause diagnosis when something is wrong.

A weak engineer with AI looks like: short prompts, blind acceptance of output, frustrated re-prompts when something fails, and a final result the engineer cannot fully explain.

We score the prompt history independently from the code.

### 3. How you own the outcome

Did you stop when the test passed, or when the behavior in the browser was actually right? Did you run the dashboard yourself and click through it? Did you update the docs you changed? When you found one issue, did you ask whether the same class of problem exists elsewhere?

### 4. How you communicate decisions in writing

Your decision log and your written answers are weighted equally with the code. A candidate who submits brilliant code but a thin decision log gives us less signal than a candidate who submits competent code and clear writing about why.

We read for: specificity, honesty about tradeoffs, and the ability to argue a point without overclaiming.

### 5. How you handle ambiguity

We deliberately under-specify some things. We don't tell you what to improve or exactly what shape the feature should take. We want to see what you do with that.

Strong engineers make a call, write down what they chose and why, and move forward. Weak engineers freeze or ask the recruiter for clarification we will not provide.

A note on scope: we are not asking you to "find the bugs the team planted." We are asking you to evaluate this codebase as a senior engineer would, surface what's wrong or weak, and decide what's worth your time. The issues range from concrete defects (something is computed wrong) to architectural smells (something works today but won't tomorrow) to gaps (something is missing that ought to be there). Every category counts.

---

## What we do NOT evaluate

- **Whether you know our codebase or our methodology.** You don't. We've never met. We will not penalize you for not using our preferred vocabulary.
- **Whether your tech stack matches ours.** This challenge uses Node + TypeScript + SQLite because those are universally known. Use whatever idioms you're comfortable with for the feature.
- **Whether you finished everything.** Two thoughtful improvements with a clear decision log beat five sloppy ones with no writing. Quality > quantity.
- **Whether you used AI.** We expect you to. The signal is *how*, not *whether*.
- **How fast you ship.** ~6 hours is a guideline. Working longer doesn't help; working faster doesn't hurt.

---

## What disqualifies a candidate

These are not gut-check disqualifiers; they're things that consistently produce no-hire decisions when we discuss them in committee.

- **Empty or fabricated prompt history.** If you tell us you used AI, give us the real prompts. If you didn't use AI at all, say so.
- **A decision log that just describes what the code does.** We can read the code. We want to know *why*.
- **Fixes that paper over the symptom without naming the cause.** If you wrap a query in a try/catch to silence an error, tell us in the decision log that you knew you were doing that and what the real fix would be.
- **Submitting work you can't explain.** The follow-up technical interview will walk through specific lines of your code, specific prompts in your history, and specific choices in your decision log. If you can't narrate them, the gap will be visible.

---

## After you submit

If your submission moves forward, we'll set up a **60-minute technical conversation**. It is not a coding interview. It is a discussion about the choices you made: which issue you tackled first and why, how you used AI for which parts, what you'd do differently with more time, and one or two past-tense behavioral questions about production systems you've owned.

You'll know within a week of submitting whether you're moving on.
