// src/blueprintQuestions.ts
//
// Static question bank for the AI Blueprint Interview.
// Design goals (per product decision):
// 1. Every question maps to 2-3 of the 8 LearningProfile dimensions at once
//    (dense signal per question, so we don't need 15+ questions).
// 2. Key dimensions get a SECOND, independently-worded question later in
//    the set (see `crossChecks`) so contradictory answers can be caught —
//    this feeds the reliabilityScore / selfReportedHonesty fields Gemini
//    returns, instead of trusting every answer at face value.
// 3. All 12 questions are answered locally in the browser with ZERO
//    Gemini calls — only ONE Gemini call happens at the very end, with
//    all 12 Q&A pairs bundled into a single prompt. This is the main
//    token-saving change vs the old "ask Gemini live, one call per
//    question" version.

export interface BlueprintOption {
  key: 'A' | 'B' | 'C' | 'D';
  text: string;
}

export interface BlueprintQuestion {
  id: string;
  text: string;
  options: BlueprintOption[];
  /** Which dimensions this question primarily signals — for our own docs/debugging, not sent to Gemini. */
  dimensions: string[];
  /** id of an earlier question this one cross-validates, if any. */
  crossChecks?: string;
}

export const BLUEPRINT_QUESTIONS: BlueprintQuestion[] = [
  {
    id: 'q1',
    text: "You need to learn a brand-new skill — what do you naturally do first?",
    dimensions: ['theoryVsPractical', 'structureNeed'],
    options: [
      { key: 'A', text: "I look for the best video or resource — a visual explanation helps it click right away" },
      { key: 'B', text: "I jump straight into trying a small task — things get clear as I do them" },
      { key: 'C', text: "I try to understand the whole structure first — moving through it systematically works better" },
      { key: 'D', text: "I talk to someone experienced — real experience teaches things books can't" },
    ],
  },
  {
    id: 'q2',
    text: "Despite a lot of effort, the result wasn't what you expected — what do you do?",
    dimensions: ['depth', 'pace'],
    options: [
      { key: 'A', text: "I analyze it deeply — I look for the exact point where things went wrong" },
      { key: 'B', text: "I take some space — coming back with a clear mind works better" },
      { key: 'C', text: "I immediately try a different approach — keeping momentum matters" },
      { key: 'D', text: "I talk to someone I trust — an outside perspective helps" },
    ],
  },
  {
    id: 'q3',
    text: "While studying a topic, you come across something that won't be directly useful — what do you do?",
    dimensions: ['depth', 'structureNeed', 'pace'],
    options: [
      { key: 'A', text: "I stop and understand it — moving ahead with incomplete understanding doesn't suit me" },
      { key: 'B', text: "I make a note — I'll come back to it when it's relevant" },
      { key: 'C', text: "I start exploring it further anyway — curiosity takes me there" },
      { key: 'D', text: "I stay focused on the goal — whatever's directly useful comes first" },
    ],
  },
  {
    id: 'q4',
    text: "You have to make an important decision and the information is incomplete — you?",
    dimensions: ['pace', 'depth', 'priorKnowledgeComfort'],
    options: [
      { key: 'A', text: "Gather more data first — an informed decision is better" },
      { key: 'B', text: "Look at past patterns — what similar situations suggested" },
      { key: 'C', text: "Decide with the best information available — the perfect moment never comes" },
      { key: 'D', text: "Get a trusted person's perspective — it covers your blind spots" },
    ],
  },
  {
    id: 'q5',
    text: "You can't quite understand a complex concept — which approach works for you?",
    dimensions: ['storytelling', 'structureNeed', 'theoryVsPractical', 'repetitionNeed'],
    options: [
      { key: 'A', text: "I connect it to real life — \"this is just like...\" makes it click" },
      { key: 'B', text: "I sketch out a visual flow — seeing it in a diagram makes it clear" },
      { key: 'C', text: "I experiment myself — the theory settles in after hands-on practice" },
      { key: 'D', text: "I go over it multiple times — repetition brings deep clarity" },
    ],
  },
  {
    id: 'q6',
    text: "You're studying a 2-hour deep topic — what naturally happens after 45 minutes?",
    dimensions: ['pace', 'depth'],
    options: [
      { key: 'A', text: "I'm in flow — staying focused comes naturally, I lose track of time" },
      { key: 'B', text: "I take a short mental break — I come back recharged and it keeps my productivity up" },
      { key: 'C', text: "I switch topics — variety keeps my energy up" },
      { key: 'D', text: "I've already made good progress — I work at an efficient pace" },
    ],
  },
  {
    id: 'q7',
    text: "What's the ideal format for you to learn something new?",
    dimensions: ['pace', 'depth', 'theoryVsPractical'],
    options: [
      { key: 'A', text: "Focused, short videos — concise, to the point, respects my time" },
      { key: 'B', text: "Detailed, comprehensive videos — getting the full picture in one place works better for me" },
      { key: 'C', text: "Written content — reading at my own pace is more effective for me" },
      { key: 'D', text: "Project-based learning — building something while I learn feels natural" },
    ],
  },
  {
    id: 'q8',
    text: "A teacher uses technical jargon in a video without explaining it — what do you do?",
    dimensions: ['languageComplexity', 'structureNeed', 'pace'],
    options: [
      { key: 'A', text: "I stop right away and look up what the word means — moving on without understanding doesn't feel right" },
      { key: 'B', text: "I figure out the meaning from context and keep going — jargon doesn't bother me" },
      { key: 'C', text: "I find a simpler resource that explains it in easier language" },
      { key: 'D', text: "I note those words down and clarify all of them together later" },
    ],
  },
  {
    id: 'q9',
    text: "Someone explained a new concept to you through a real-life story or analogy — how does that feel to you?",
    dimensions: ['storytelling'],
    crossChecks: 'q5',
    options: [
      { key: 'A', text: "Really helpful — a story makes the concept stick for good" },
      { key: 'B', text: "Somewhat helpful, but I prefer a direct, technical/clear definition" },
      { key: 'C', text: "Depends — it only helps if the story is genuinely relevant, otherwise it feels like a waste of time" },
      { key: 'D', text: "I remember the story but not the actual concept — so I tend to avoid this kind of thing" },
    ],
  },
  {
    id: 'q10',
    text: "A week after learning a difficult concept, how often do you naturally revise it?",
    dimensions: ['repetitionNeed'],
    crossChecks: 'q5',
    options: [
      { key: 'A', text: "Once I've understood it well, I don't need to revisit it" },
      { key: 'B', text: "I make sure to revise it 2-3 times — that's when the confidence kicks in" },
      { key: 'C', text: "I only revise it when I actually need to use it, otherwise not" },
      { key: 'D', text: "I make notes and glance back at them every now and then" },
    ],
  },
  {
    id: 'q11',
    text: "You're starting a new topic that's related to something you already know — what do you do?",
    dimensions: ['priorKnowledgeComfort'],
    crossChecks: 'q4',
    options: [
      { key: 'A', text: "I connect it right away — \"oh, this is just like that\" — makes learning the new thing easier" },
      { key: 'B', text: "I set the old knowledge aside and start completely fresh, to avoid confusion" },
      { key: 'C', text: "I connect it a little but don't lean on it too much — it's case by case" },
      { key: 'D', text: "I need to revise the old concept first, otherwise the new one doesn't make sense" },
    ],
  },
];
