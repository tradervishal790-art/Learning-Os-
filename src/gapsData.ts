// src/gapsData.ts
//
// Big Five growth gaps by score BUCKET (from Growth_Gaps_Score_Buckets.pdf).
// 5 traits x 5 buckets. Each gap = [what goes wrong, why, what to try, signal].
//   signal = the test behaviour that must be present before the gap is shown
//            ("trait predicts, behaviour confirms"). 'later' = needs data the app
//            does not collect yet (revision skips, planned-vs-actual time...), so it
//            is never shown today but stays here so the full table lives in one place.
// Bucket 1 = 0-20, 2 = 21-40, 3 = 41-60, 4 = 61-80, 5 = 81-100.
import type { Trait } from './personalityQuestions';

export type SignalKey =
  | 'blank' | 'lateBlank' | 'fatigue' | 'careless' | 'lowAccuracy' | 'overAttempt'
  | 'repeatedMiss' | 'sticky' | 'declining' | 'plateau' | 'weakTopics' | 'scoreDrop'
  | 'later';

export type GapRow = [title: string, cause: string, action: string, signal: SignalKey];

export const BUCKET_GAPS: Record<Trait, Record<1 | 2 | 3 | 4 | 5, GapRow[]>> = {
  openness: {
    1: [
      ['Skips anything not directly useful', 'You value practical use, so links between topics get missed.', 'Read the one-line "why this matters" before each topic.', 'later'],
      ['Copying examples without the idea', 'Following a fixed routine feels safe.', 'After each worked example, try the same idea in a new situation.', 'sticky'],
      ['Freezing on new question formats', 'New feels uncertain, so it feels risky.', 'Try new formats in small, low-stakes steps.', 'blank'],
      ['Keeping the old method after it stops working', 'Familiar feels safe; switching feels costly.', 'Compare old vs new method side by side (time, accuracy).', 'plateau'],
      ['Calling theory useless', 'The use is hard to see until a problem needs it.', 'Read one real case where this theory solved a problem.', 'weakTopics'],
    ],
    2: [
      ['Skipping side links that look "not useful"', 'You prefer practical value, mildly.', 'Read the one-line "why this matters" before each topic.', 'later'],
      ['Preferring the familiar method', 'A slight comfort with proven routines.', 'Add one new format at a time, with an easy first try.', 'later'],
      ['Struggling when a question is twisted', 'You learned the pattern more than the idea.', 'Practise "same concept, new situation" questions.', 'lowAccuracy'],
    ],
    3: [
      ['No clear default way of learning', 'You are comfortable with both new and familiar methods.', 'Try an "explore" and a "step-by-step" version; keep whichever you finish.', 'later'],
      ['Style depends on the topic', 'Exploratory on interesting topics, rigid on boring ones.', 'Match the study style to the topic using your recent results.', 'weakTopics'],
    ],
    4: [
      ['Starting a new topic before finishing one', 'The pull of novelty shows on dull stretches.', 'Finish the current topic first.', 'later'],
      ['Revision feels dull at times', 'Repeated material gives less reward.', 'Revise with a small twist instead of re-reading.', 'repeatedMiss'],
      ['Favourite topics feel "known"', 'Enjoying a topic can stand in for recalling it.', 'Take a short recall quiz after your favourite topics.', 'lowAccuracy'],
    ],
    5: [
      ['Starting new topics before finishing old ones', 'A half-known topic stops giving the novelty reward.', 'Finish one topic before opening the next.', 'later'],
      ['Enjoying an idea feels like knowing it', 'Understanding feels good, but nothing forces recall.', 'Take a quick recall quiz right after every new idea.', 'lowAccuracy'],
      ['Revision gets skipped', 'Repeated material feels dead, so it is avoided and forgotten.', 'Make revision a new twist or challenge, not a repeat.', 'repeatedMiss'],
      ['Falling into rabbit holes', 'Curiosity has no built-in stop signal.', 'Put a timer on side-topics and save them for later.', 'later'],
      ['Weak at the boring basics', 'Formulas and drills can feel beneath you.', 'Do short basics drills as puzzles and see the marks they cost.', 'lowAccuracy'],
    ],
  },
  conscientiousness: {
    1: [
      ['Last-minute crunch', 'Only a close deadline creates action.', 'Use small daily deadlines (a mini-quiz) instead of one big one.', 'later'],
      ['Strong start, weak middle', 'Novelty fades and there is no routine to carry you.', 'Add small rewards in the middle weeks.', 'declining'],
      ['Underestimating the time', 'Optimistic planning: 1 hour becomes 4.', 'Compare planned vs actual time and adjust the plan.', 'lateBlank'],
      ['Hard to begin', 'Setup feels bigger than the task.', 'Start with a 5-minute starter task.', 'later'],
      ['Shame spiral after a missed day', 'Guilt makes you avoid the app, causing more misses.', 'Come back with one tiny task, no guilt.', 'later'],
      ['No review system', 'You learn a topic once and rarely return to it.', 'Put topics on spaced reviews so they come back by themselves.', 'repeatedMiss'],
    ],
    2: [
      ['Pushing work toward the deadline', 'Pressure motivates, but not enough for big tasks.', 'Set mid-way mini-deadlines.', 'later'],
      ['Plans take longer than expected', 'Time estimates are optimistic.', 'Compare planned vs actual time.', 'lateBlank'],
      ['A missed day feels heavy', 'Mild guilt after a gap.', 'Come back with one small task.', 'later'],
      ['Irregular reviews', 'You learn once and revisit when reminded.', 'Do a short daily review card.', 'repeatedMiss'],
    ],
    3: [
      ['Plan works some weeks, collapses in others', 'Discipline is strong when interested, weak when bored.', 'Keep a light weekly plan with one fixed anchor session.', 'declining'],
      ['Inconsistent revision', 'You revise when reminded, skip otherwise.', 'Do a short daily review card.', 'repeatedMiss'],
      ['Drift goes unnoticed', 'Slipping is quiet when you neither over- nor under-plan.', 'Check a weekly planned-vs-done snapshot.', 'scoreDrop'],
    ],
    4: [
      ['Plans well, tests too little', 'Planning feels like progress on busy weeks.', 'Look at recall accuracy next to hours studied.', 'plateau'],
      ['Waiting for "perfect" before moving on', 'A mild perfectionism.', 'Move on once accuracy passes 80%.', 'lateBlank'],
      ['Rest gets skipped when behind', 'Guilt about breaks under pressure.', 'Take a rest after a long streak.', 'later'],
    ],
    5: [
      ['A perfect plan feels like progress', 'A neat timetable gives control without testing learning.', 'Track recall and accuracy, not hours or ticks.', 'plateau'],
      ['Will not move on until 100%', 'Perfectionism; fear of leaving gaps.', 'Use an "80% = move on" rule; weak topics come back later.', 'lateBlank'],
      ['One missed day breaks the whole plan', 'All-or-nothing thinking about the schedule.', 'Use a recovery day; no broken-streak shame.', 'later'],
      ['Preferring neat notes over messy mock tests', 'Mistakes feel uncomfortable; neatness feels safe.', 'Treat mocks as "find my errors".', 'later'],
      ['Skipping rest and burning out quietly', 'Rest feels like guilt.', 'Build rest days into the plan.', 'later'],
    ],
  },
  extraversion: {
    1: [
      ['A wrong idea stays hidden', 'With no outside feedback, a misunderstanding keeps repeating.', 'Explain it to the AI privately and get corrected.', 'sticky'],
      ['Knowing it but not saying it', 'You rarely speak ideas aloud.', 'Write "explain simply" first, then try a short voice task.', 'later'],
      ['Doubts stay unasked', 'Asking feels uncomfortable, so you stay stuck for hours.', 'Use the private doubt box; no one sees it.', 'repeatedMiss'],
      ['Re-reading instead of practising', 'Rereading feels safe and productive.', 'Cover the page and recall; do problem sets by default.', 'plateau'],
      ['Effort goes unseen', 'No encouragement from others, so motivation fades.', 'Check your progress summary.', 'later'],
    ],
    2: [
      ['Doubts stay unasked a bit too long', 'Asking feels like extra effort.', 'Use the private doubt box.', 'repeatedMiss'],
      ['Re-reading more than self-testing', 'Quiet reading feels productive.', 'Cover and recall.', 'plateau'],
      ['Rarely explaining aloud', 'A solo study habit.', 'Write "explain simply" first; voice is optional.', 'later'],
    ],
    3: [
      ['Picking the wrong mode for the task', 'You switch between social and solo without a rule.', 'Solo for recall practice, social for explaining.', 'later'],
      ['Neither solo nor group is fully trained', 'No strong preference, so both stay half-used.', 'One explain-aloud task and one solo quiz per topic.', 'later'],
    ],
    4: [
      ['Talking feels like learning on easy topics', 'Discussion gives a sense of clarity.', 'Take a solo written quiz after group sessions.', 'lowAccuracy'],
      ['Focus dips when alone for long', 'You prefer company.', 'Short solo blocks, then a buddy check-in.', 'later'],
      ['Group time turns into chat', 'Social energy beats task energy.', 'Do an end-of-session goal check.', 'later'],
    ],
    5: [
      ['Discussion feels like understanding', 'Talking gives clarity without checking recall.', 'Take a solo written quiz after every voice or group task.', 'repeatedMiss'],
      ['Focus drops when alone', 'You need outside stimulation.', 'Use study rooms and buddy timers; grow solo blocks slowly.', 'later'],
      ['Progress stops if the partner is away', 'Momentum depends on people.', 'Use the always-available AI study partner.', 'later'],
      ['Group sessions turn into chatting', 'Social energy beats task energy.', 'End each session with a goal check.', 'later'],
      ['Weaker in silent, solo exams', 'It is the condition you practise least.', 'Do silent timed practice sessions.', 'lowAccuracy'],
    ],
  },
  agreeableness: {
    1: [
      ["Missing others' good ideas", 'You trust your own view first.', 'Try "find the flaw in this answer" tasks.', 'later'],
      ['Rejecting correction', 'Correction feels like an attack.', 'Read errors as patterns in your data, not criticism.', 'sticky'],
      ['Chasing rank over understanding', 'Competition is your main motivator.', 'Use "beat your last score" next to the leaderboard.', 'later'],
      ['Avoiding teamwork', 'Group work feels slow.', 'Try short team tasks with clear roles.', 'later'],
      ['Effort drops when someone else leads', 'You need to be ahead.', 'Compare with your own past self.', 'later'],
    ],
    2: [
      ["Preferring your own method over others' explanations", 'You trust your own approach first.', 'Try "find the flaw" tasks and compare alternatives by result.', 'later'],
      ['Correction can feel like criticism', 'Correction feels like pressure.', 'Read error patterns as data.', 'sticky'],
      ['Caring a lot about rank', 'Competition motivates you.', 'Try the optional "beat your last score" mode.', 'later'],
    ],
    3: [
      ['Agreeing or arguing depending on the day', 'No fixed habit with others\' ideas.', 'Check answers against data before deciding who is right.', 'later'],
      ['Own study squeezed in busy weeks', 'You help when asked, but not always.', 'Do a weekly load check.', 'weakTopics'],
      ['Reaction to feedback varies', 'Some feedback lands well, some personally.', 'Read feedback as a pattern.', 'scoreDrop'],
    ],
    4: [
      ['Own practice slips when helping', 'Helping takes time.', 'Protect a block for your own practice.', 'weakTopics'],
      ['Going along with a confident peer', 'You avoid friction.', 'Try "challenge this answer" tasks.', 'later'],
      ['Low scores sting', 'Feedback feels personal.', 'A score is a learning point, not a verdict.', 'scoreDrop'],
    ],
    5: [
      ['Your own weak areas stay untouched', 'Helping others feels productive, so your own practice slips.', 'Do your own practice block before any group task.', 'weakTopics'],
      ['Accepting wrong answers to avoid conflict', 'Disagreement feels uncomfortable.', 'Try "challenge this answer" tasks.', 'later'],
      ['Study time eaten by favours', 'Saying no is hard.', 'Do a weekly load check.', 'later'],
      ['Avoiding debate and challenge', 'Disagreement feels like conflict.', 'Practise safe debate against the AI.', 'later'],
      ['Hurt by low scores', 'Feedback feels personal.', 'A score is a learning point; see the trend, not one score.', 'scoreDrop'],
    ],
  },
  neuroticism: {
    1: [
      ['Overconfidence', 'Calm feels like readiness.', 'Compare your confidence with your accuracy.', 'overAttempt'],
      ['No urgency', 'No stress signal, so work is delayed.', 'Try small timed challenges.', 'later'],
      ['Falling scores do not alarm you', 'A drop does not feel urgent, so it goes unchecked.', 'Check the trend after 3 drops in a row.', 'declining'],
      ['Careless mistakes', 'Feeling sure, so the final check gets skipped.', 'Add a 2-minute check step before submitting.', 'careless'],
      ['Stopping at "good enough"', 'Comfortable at 70%.', 'Try a next-level challenge toward 90%.', 'plateau'],
    ],
    2: [
      ['Slightly overconfident', 'Calm feels like readiness.', 'Compare confidence with accuracy.', 'overAttempt'],
      ['Skipping the final check', 'You feel sure.', 'Add a quick check step before submitting.', 'careless'],
      ['Little urgency early on', 'No stress signal.', 'Try small timed challenges.', 'later'],
    ],
    3: [
      ['Stress shows up only in big moments', 'Calm normally; exams and deadlines raise worry.', 'Do timed practice before big tests.', 'blank'],
      ['Good days and anxious days', 'Study quality follows mood.', 'Do a lighter task on anxious days; trust your data.', 'scoreDrop'],
      ["Confidence doesn't match results", 'Sometimes overconfident, sometimes over-worried.', 'Compare confidence with accuracy.', 'overAttempt'],
    ],
    4: [
      ['Hard topics get delayed', 'Difficulty raises stress.', 'Split hard topics into small steps.', 'weakTopics'],
      ['Scores feel personal', 'A score is read as identity.', 'Treat it as a learning point; look at the trend.', 'scoreDrop'],
      ['Comparing with others', 'Ranks make you feel behind.', 'Compare with your own past.', 'later'],
      ['Over-preparing to feel ready', 'Studying calms worry with no stop point.', 'Trust the "you are ready" signal from accuracy.', 'later'],
    ],
    5: [
      ['Overthinking before starting', '"What if I fail?" blocks the first step.', 'Take a tiny first step in a no-score practice mode.', 'later'],
      ['Blanking under pressure', 'Anxiety uses up working memory, so known answers slip away.', 'Do timed low-stakes practice and a short calm pause before tests.', 'blank'],
      ['One bad score feels like proof', 'A score is read as identity, not feedback.', 'See the trend, not a single score.', 'scoreDrop'],
      ['Comparison stress', "Others' progress makes you feel behind.", 'Compare with your own past.', 'later'],
      ['Over-preparing but never feeling ready', 'Studying calms worry, but there is no stop point.', 'Trust the "you are ready" signal from real accuracy.', 'later'],
      ['Hard chapters get delayed', 'Difficulty triggers stress, so the topic is pushed back.', 'Split hard topics into small steps and do them early in the week.', 'weakTopics'],
    ],
  },
};
