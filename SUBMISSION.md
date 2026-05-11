# Submission

Four artifacts. Send them as a single email to the recruiter you've been talking to. Subject line: `Challenge submission — <your full name>`.

---

## 1. Link to your fork

A GitHub URL to your public fork of this repository. Your work should be on `main` or on a clearly named branch (`my-name/challenge` or similar). Include a brief commit history — small commits with descriptive messages help us trace your reasoning.

If your fork is private, share it with the GitHub user named in the recruiter's email.

---

## 2. `decision_log.md`

Place this file at the root of your fork. **One page maximum.** Cover:

- **Which bugs you fixed**, and one sentence each on why those fixes were the right shape (vs. simpler patches that you considered and rejected).
- **Which feature you chose**, and why this one and not the other two.
- **Anything you noticed but did NOT fix**, and why (scope, time budget, "this needs a larger conversation").
- **Anything in the existing docs or code you intentionally left alone**, even if it looked off — and why.
- **What you would do next** if you had another 6 hours.

Specificity matters. "I refactored the data access" is weaker than "I moved the metrics queries to go through `ordersDal` because the existing pattern was a coupling smell, but I left the DAL itself unchanged to minimize risk."

---

## 3. `prompt_history.md`

Place this file at the root of your fork. **Raw history** of your conversations with whatever AI tool(s) you used during the challenge. No editing, no curation. We expect to see false starts, refinements, and rejected outputs — that's the signal.

If you used multiple tools (e.g. Claude Code for one part, ChatGPT for another), separate them with headings.

If you used AI for **less than half** of the work, that's fine — just say so at the top of the file and include what you did use it for.

If you did not use AI **at all**, the file should contain a single line: `Did not use AI for this challenge.` We will ask about this in the interview.

---

## 4. `written_answers.md`

Place this file at the root of your fork. Three questions, ~200 words each. **Use real past-tense stories from systems you have actually worked on.** Hypothetical answers ("I would…") score much lower than concrete past-tense ones ("Last year on X, I…").

### Question 1
> Describe a system you owned where you had to add production correctness validation — alarms, contract tests, golden datasets, something that caught a class of bugs before users did. What did you do, what worked, what didn't, and what would you do differently?

### Question 2
> Describe a system you've worked on where scaling — traffic, data volume, team size, or geography — forced a structural change to the code or architecture. What changed, who pushed back, and how did you decide?

### Question 3
> Describe a time you needed another team to change their API, contract, or shared resource for your work to ship. How did you propose it, how did the other side respond, and how did the change actually land?

If you don't have a real story for one of these questions, write a short paragraph saying so honestly and use the space to describe the closest related experience. We prefer honesty over fabrication.

---

## Anti-patterns we see often

- Submitting a beautifully-formatted decision log that just repeats what's in the README.
- Submitting prompt history with the obvious "let me make this look thoughtful" edits.
- Answering Q1–Q3 with abstract opinions instead of concrete stories.
- A fork with one giant commit and a generic message ("implement challenge"). We can't see your thinking from one commit.

---

## Privacy and retention

We retain submissions for the duration of the hiring decision plus 90 days, then delete them. We do not share submissions outside the hiring committee. By submitting, you consent to this.
