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
    text: 'Koi bilkul nayi skill sikhni hai — pehle aap naturally kya karte hain?',
    dimensions: ['theoryVsPractical', 'structureNeed'],
    options: [
      { key: 'A', text: 'Best video ya resource dhundta/dhundti hoon — visual explanation se seedha samajh aata hai' },
      { key: 'B', text: 'Seedha ek chota kaam try karta/karti hoon — karte karte cheezein clear hoti hain' },
      { key: 'C', text: 'Poora structure samajhta/samajhti hoon pehle — systematically move karna better lagta hai' },
      { key: 'D', text: 'Kisi experienced insaan se baat karta/karti hoon — real experience se jo seekha woh books mein nahi milta' },
    ],
  },
  {
    id: 'q2',
    text: 'Bahut mehnat ke baad bhi result expected nahi aaya — aap kya karte hain?',
    dimensions: ['depth', 'pace'],
    options: [
      { key: 'A', text: 'Deeply analyze karta/karti hoon — exact point dhundta/dhundti hoon jahan cheez miss hui' },
      { key: 'B', text: 'Thoda space leta/leti hoon — clear mind se wapas aana zyada effective hota hai' },
      { key: 'C', text: 'Immediately different approach try karta/karti hoon — momentum banana zaroori hai' },
      { key: 'D', text: 'Trusted insaan se baat karta/karti hoon — outside perspective helpful hota hai' },
    ],
  },
  {
    id: 'q3',
    text: 'Koi topic padhte waqt ek aisi cheez mili jo seedha kaam nahi aayegi — aap kya karte hain?',
    dimensions: ['depth', 'structureNeed', 'pace'],
    options: [
      { key: 'A', text: 'Ruk ke samajhta/samajhti hoon — adhoori samajh ke saath aage badhna suit nahi karta' },
      { key: 'B', text: 'Note karta/karti hoon — relevant time pe wapas aaunga/aaungi' },
      { key: 'C', text: 'Us cheez ko deeper explore karna shuru karta/karti hoon — curiosity mujhe le jaati hai' },
      { key: 'D', text: 'Focus goal pe rakhta/rakhti hoon — jo seedha kaam aaye woh pehle' },
    ],
  },
  {
    id: 'q4',
    text: 'Important decision lena ho aur information incomplete ho — aap?',
    dimensions: ['pace', 'depth', 'priorKnowledgeComfort'],
    options: [
      { key: 'A', text: 'Pehle aur data gather karta/karti hoon — informed decision better hota hai' },
      { key: 'B', text: 'Past patterns dekhta/dekhti hoon — similar situations ne kya suggest kiya' },
      { key: 'C', text: 'Best available information se decide karta/karti hoon — perfect timing kabhi nahi aata' },
      { key: 'D', text: 'Kisi trusted insaan ka perspective leta/leti hoon — blind spots cover hote hain' },
    ],
  },
  {
    id: 'q5',
    text: 'Koi complex concept samajh nahi aa raha — kaunsa approach aapke liye kaam karta hai?',
    dimensions: ['storytelling', 'structureNeed', 'theoryVsPractical', 'repetitionNeed'],
    options: [
      { key: 'A', text: 'Real life se connect karta/karti hoon — "yeh bilkul aise hai jaise..." se cheezein click karti hain' },
      { key: 'B', text: 'Visual flow bana leta/leti hoon — diagram mein dekha toh clear ho jaata hai' },
      { key: 'C', text: 'Khud experiment karta/karti hoon — hands-on hone ke baad theory settle hoti hai' },
      { key: 'D', text: 'Multiple baar padhta/padhti hoon — repetition se deep clarity aati hai' },
    ],
  },
  {
    id: 'q6',
    text: '2 ghante ka deep topic padh rahe hain — 45 minute baad naturally kya hota hai?',
    dimensions: ['pace', 'depth'],
    options: [
      { key: 'A', text: 'Flow mein hoon — focused rehna mujhe aata hai, time pata nahi chalta' },
      { key: 'B', text: 'Short mental break leta/leti hoon — recharge karke wapas aata/aati hoon, productivity better rehti hai' },
      { key: 'C', text: 'Topic switch karta/karti hoon — variety se energy maintain rehti hai meri' },
      { key: 'D', text: 'Kaafi progress kar chuka/chuki hoon — efficient pace mein kaam karta/karti hoon' },
    ],
  },
  {
    id: 'q7',
    text: 'Koi nayi cheez seekhne ke liye ideal format kaunsa hai aapke liye?',
    dimensions: ['pace', 'depth', 'theoryVsPractical'],
    options: [
      { key: 'A', text: 'Focused short videos — concise, to the point, time ki respect' },
      { key: 'B', text: 'Detailed comprehensive video — ek jagah poora picture milna better lagta hai' },
      { key: 'C', text: 'Written content — apni pace pe padhna zyada effective hai mere liye' },
      { key: 'D', text: 'Project-based learning — seedha banate hue sikhna natural lagta hai' },
    ],
  },
  {
    id: 'q8',
    text: 'Koi teacher video mein technical jargon use kar raha hai bina explain kiye — aap kya karte hain?',
    dimensions: ['languageComplexity', 'structureNeed', 'pace'],
    options: [
      { key: 'A', text: 'Turant ruk ke word ka matlab search karta/karti hoon — bina samjhe aage badhna sahi nahi lagta' },
      { key: 'B', text: 'Context se hi matlab nikal leta/leti hoon aur aage badhta/badhti rehta/rehti hoon — jargon se problem nahi hoti' },
      { key: 'C', text: 'Simpler resource dhoondh leta/leti hoon jahan easy language mein samjhaya ho' },
      { key: 'D', text: 'Un words ko note kar leta/leti hoon, baad mein ek saath sabko clarify karta/karti hoon' },
    ],
  },
  {
    id: 'q9',
    text: 'Kisi ne ek naya concept aapko real-life story ya analogy ke through samjhaya — aapko kaisa lagta hai?',
    dimensions: ['storytelling'],
    crossChecks: 'q5',
    options: [
      { key: 'A', text: 'Bahut helpful — story se concept hamesha ke liye yaad reh jaata hai' },
      { key: 'B', text: 'Thoda helpful hai, lekin main directly technical/clear definition prefer karta/karti hoon' },
      { key: 'C', text: 'Depends — agar story genuinely relevant hai tabhi kaam aati hai, warna time waste lagta hai' },
      { key: 'D', text: 'Story yaad reh jaati hai lekin actual concept nahi — isliye main aisi cheezein avoid karta/karti hoon' },
    ],
  },
  {
    id: 'q10',
    text: 'Ek mushkil concept seekhne ke ek hafte baad, aap usse naturally kitni baar revise karte hain?',
    dimensions: ['repetitionNeed'],
    crossChecks: 'q5',
    options: [
      { key: 'A', text: 'Ek baar acche se samajh liya toh dobara zaroorat nahi padti' },
      { key: 'B', text: '2-3 baar zaroor revise karta/karti hoon, tabhi confidence aata hai' },
      { key: 'C', text: 'Sirf jab actually use karna ho tab revise karta/karti hoon, warna nahi' },
      { key: 'D', text: 'Notes bana leta/leti hoon aur beech-beech mein glance maarta/maarti rehta/rehti hoon' },
    ],
  },
  {
    id: 'q11',
    text: 'Naya topic start karte waqt, agar wo kisi purani cheez se related hai jo aap already jaante hain — aap kya karte hain?',
    dimensions: ['priorKnowledgeComfort'],
    crossChecks: 'q4',
    options: [
      { key: 'A', text: 'Turant connect karta/karti hoon — "yeh toh us jaisa hi hai" — naya seekhna aasaan ho jaata hai' },
      { key: 'B', text: 'Purani knowledge ko side rakh ke bilkul fresh start karta/karti hoon, confusion se bachne ke liye' },
      { key: 'C', text: 'Thoda connect karta/karti hoon lekin zyada dependent nahi hota — case by case' },
      { key: 'D', text: 'Mujhe purana concept pehle revise karna padta hai, warna naya samajh nahi aata' },
    ],
  },
];