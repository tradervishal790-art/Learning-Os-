import type { MCQQuestion, SubjectiveQuestion, TestPaper, TestQuestion } from './types';

// ============================================================
// officialTests.ts
// Curated tests authored by the app owner. Users can TAKE these but
// never edit them — they live in code, not in localStorage/Firestore.
// To add or change a test: edit this file and redeploy.
// No cap on the number of questions per test.
// Source: British English Grammar — Nouns: Number & Kind (Exercises 1–6).
// ============================================================

// Marking for this paper — edit here to change.
const MARKS = 1;
const NEGATIVE_MARKS = 0;
const DURATION_MINUTES = 60;

// Answer position is spread evenly (by question number) so the correct
// option is not predictable; options are authored in any order.
const mcq = (id: string, question: string, options: string[], answer: string, explanation: string): MCQQuestion => {
  const opts = [...options];
  const target = Number(id.replace(/\D/g, '')) % opts.length;
  const cur = opts.indexOf(answer);
  [opts[cur], opts[target]] = [opts[target], opts[cur]];
  return { id, type: 'mcq', question, options: opts, correctIndex: target, explanation, marks: MARKS, negativeMarks: NEGATIVE_MARKS };
};

const sub = (id: string, question: string, modelAnswer: string, explanation: string, acceptedAnswers?: string[]): SubjectiveQuestion => ({
  id,
  type: 'subjective',
  question,
  modelAnswer,
  explanation,
  marks: MARKS,
  acceptedAnswers: acceptedAnswers ?? [], // official tests auto-grade subjective answers
});

const plural = (n: number, noun: string, answer: string, explanation: string, alt?: string[]) =>
  sub(`n_plural_${n}`, `Write the plural of: ${noun}`, answer, explanation, alt);

const fix = (n: number, wrong: string, right: string, explanation: string) =>
  sub(`n_fix_${n}`, `Correct the error of number in this sentence:\n${wrong}`, right, explanation);

const m = (n: number, q: string, options: string[], answer: string, explanation: string) => mcq(`n_mcq_${n}`, q, options, answer, explanation);

const nounsQuestions: TestQuestion[] = [
  // ---------- Part A: fill in the blank (MCQ) — 60 ----------
  m(1, 'We find beautiful ____ in this poem.', ['imageries', 'imagery', 'imagerys', 'an imageries'], 'imagery', 'Uncountable abstract noun — no plural form.'),
  m(2, 'All the ____ should be finished today.', ['works', 'workes', 'work', 'a work'], 'work', "Uncountable in the sense of 'tasks/labour'."),
  m(3, 'Most of the ____ is to be issued soon.', ['newses', 'new', 'news', 'a news'], 'news', 'Always singular in form and use, though it ends in -s.'),
  m(4, 'A ____ is to be issued soon.', ['summon', 'summonses', 'summons', 'summonss'], 'summons', "Legal term; 'a summons' is singular."),
  m(5, 'She is going to buy some ____.', ['furnitures', 'furniture', 'a furniture', 'furnitureses'], 'furniture', 'Uncountable — no plural form.'),
  m(6, 'We live in an age of ____.', ['machineries', 'machinerys', 'a machinery', 'machinery'], 'machinery', 'Uncountable noun.'),
  m(7, 'Your ____ may be stolen.', ['baggage', 'baggages', 'a baggage', 'baggagees'], 'baggage', 'Uncountable noun.'),
  m(8, 'I am in need of some ____.', ['moneys', 'monies', 'money', 'a money'], 'money', 'Uncountable noun.'),
  m(9, 'She has not made any remarkable ____.', ['progresses', 'progress', 'progressess', 'a progress'], 'progress', 'Uncountable noun.'),
  m(10, 'The ____ should be replaced.', ['cutleries', 'cutlerys', 'cutlery', 'a cutlery'], 'cutlery', 'Uncountable collective noun (knives, forks, spoons).'),
  m(11, 'I enjoy the ____ of Keats.', ['poetries', 'poetry', 'poetrys', 'a poetry'], 'poetry', 'Uncountable noun (a body of literary work).'),
  m(12, 'Very few people wear diamond ____.', ['jewelleries', 'jewellerys', 'a jewellery', 'jewellery'], 'jewellery', 'Uncountable collective noun.'),
  m(13, 'He has sold his ____ to educate his children.', ['land', 'lands', 'landes', 'a land'], 'lands', 'Plural used for parcels/holdings of landed property.'),
  m(14, 'Would you like ____?', ['meat', 'meates', 'a meat', 'meatses'], 'meat', 'Uncountable noun (food in general).'),
  m(15, 'The government should try to eradicate ____.', ['poverties', 'povertys', 'poverty', 'a poverty'], 'poverty', 'Abstract/uncountable noun.'),
  m(16, 'I do not wear ____.', ['trouser', 'trousers', 'a trouser', 'trouserses'], 'trousers', 'Plural-only noun (a pair of trousers).'),
  m(17, 'Her ____ suit the occasion.', ['cloths', 'clothes', 'clothe', 'clothses'], 'clothes', "Plural-only noun meaning 'garments'."),
  m(18, 'This miser does not give ____ to beggars.', ['alm', 'alms', 'almes', 'an alm'], 'alms', 'Plural-only noun (charity money).'),
  m(19, 'He did all this under the ____ of the Chief Minister.', ['auspice', 'auspicess', 'auspices', 'an auspice'], 'auspices', "Plural-only noun — 'under the auspices of'."),
  m(20, 'My ____ have been stolen from the waiting room.', ['belonging', 'belongings', 'belongs', 'belongingses'], 'belongings', 'Plural-only noun.'),
  m(21, 'The ____ should be paid on time.', ['due', 'dues', 'duees', 'a due'], 'dues', 'Plural-only noun (fees/what is owed).'),
  m(22, 'She is going to the ____.', ['picture', 'pictures', 'a picture', 'picturess'], 'pictures', "Idiom: 'go to the pictures' = go to the cinema."),
  m(23, 'Keep your ____ in the locker.', ['valuable', 'a valuable', 'valuables', 'valuablees'], 'valuables', 'Plural-only noun (valuable items).'),
  m(24, 'Convey my ____ to your parents.', ['regard', 'regards', 'regardes', 'a regard'], 'regards', 'Plural-only noun (good wishes).'),
  m(25, 'His ____ should be paid.', ['arrear', 'arrears', 'an arrear', 'arrearses'], 'arrears', 'Plural-only noun (unpaid debts).'),
  m(26, 'Her ____ are to be performed next month.', ['nuptial', 'nuptialss', 'a nuptial', 'nuptials'], 'nuptials', 'Plural-only noun (wedding ceremony).'),
  m(27, 'The court has ordered the company to pay the ____ to the employee.', ['damage', 'damages', 'a damage', 'damagess'], 'damages', 'Plural-only noun in the legal sense = compensation money.'),
  m(28, 'This old man is fond of ____.', ['cattles', 'a cattle', 'cattle', 'cattlees'], 'cattle', "Always plural in form (no 'cattles'); takes a plural verb."),
  m(29, 'Our ____ should be provided with the latest arms.', ['polices', 'police', 'a police', 'policees'], 'police', 'Collective plural noun — never "polices".'),
  m(30, 'He wants to join the Air ____.', ['Forces', 'Forcees', 'Force', 'Forcs'], 'Force', "'Air Force' is a fixed singular organisation name."),
  m(31, 'I will write to the Human ____ Commission.', ['Right', 'Rights', 'Rightes', 'Righted'], 'Rights', "Fixed compound term: 'Human Rights Commission'."),
  m(32, 'The ____ should not be humiliated.', ['poors', 'poor', 'a poor', 'poores'], 'poor', "'The + adjective' already means 'poor people'; never add -s."),
  m(33, 'The ____ cannot hear.', ['deafs', 'deaf', 'a deaf', 'deafes'], 'deaf', "'The + adjective' means 'deaf people'; never add -s."),
  m(34, 'I have seen a lot of ____ in this zoo.', ['deers', 'deeres', 'deer', 'a deer'], 'deer', 'Same form in singular and plural.'),
  m(35, 'He sold all his ____ and left this village for ever.', ['sheeps', 'sheep', 'sheepes', 'a sheep'], 'sheep', 'Same form in singular and plural.'),
  m(36, 'A ____ of events has taken place in this village.', ['serie', 'seriess', 'a serie', 'series'], 'series', 'Same form in singular and plural (Latin origin).'),
  m(37, 'All his ____ are courteous as well as studious.', ['offsprings', 'offspring', 'offspringes', 'an offspring'], 'offspring', 'Invariable noun — same form in singular and plural.'),
  m(38, 'There is a police ____ opposite my house.', ['barrack', 'barrackes', 'barracks', 'barrackss'], 'barracks', 'Usually plural in form even for a single building.'),
  m(39, 'One must drive carefully as this ____ is dangerous.', ['crossroad', 'crossroads', 'crossroades', 'a crossroad'], 'crossroads', 'Takes a singular verb though it ends in -s (one junction).'),
  m(40, 'A student of English Literature must read all the ____ of Shakespeare.', ['work', 'workes', 'works', 'a work'], 'works', "Countable plural — 'works' = his plays and writings."),
  m(41, 'Everybody should work for the ____ of the country.', ['goods', 'good', 'gooddes', 'a goods'], 'good', "Uncountable abstract noun meaning 'benefit'."),
  m(42, 'We cannot imagine life without ____.', ['waters', 'waterses', 'water', 'a water'], 'water', 'Uncountable noun.'),
  m(43, 'Without taking ____ one cannot progress in life.', ['pain', 'pains', 'painss', 'a pain'], 'pains', "Idiomatic plural — 'take pains' = make an effort."),
  m(44, 'The ____ should not look down on the poor.', ['riches', 'rich', 'richs', 'a rich'], 'rich', "'The + adjective' (the rich) means 'rich people'; never add -s."),
  m(45, 'She does not know even the ____ of English.', ['alphabets', 'alphabet', 'alphabetes', 'alphabetss'], 'alphabet', 'Singular — the whole set of letters of a language.'),
  m(46, 'He can speak five ____.', ['alphabet', 'alphabets', 'alphabetes', 'an alphabet'], 'alphabets', 'Countable plural — five different scripts.'),
  m(47, 'The students of ____ should be given proper facilities.', ['humanity', 'a humanity', 'humanitys', 'humanities'], 'humanities', 'Name of an academic subject — used in the plural form.'),
  m(48, 'Poetry is the proper study of ____.', ['mankinds', 'mankind', 'mankindes', 'a mankind'], 'mankind', 'Uncountable collective noun for the human race.'),
  m(49, 'Her figure is one of her ____.', ['beauty', 'beautyes', 'beauties', 'beautys'], 'beauties', "Countable plural — 'one of her beauties' = one of her attractive features."),
  m(50, 'Your beloved is a real ____.', ['beauty', 'beauties', 'beautyes', 'beautys'], 'beauty', "Singular countable noun — 'a real beauty'."),
  m(51, 'Your ____ needs cutting.', ['hairs', 'hair', 'haires', 'a hairs'], 'hair', 'Uncountable mass noun (hair on the head, collectively).'),
  m(52, 'I take ____ regularly.', ['fruits', 'fruites', 'fruit', 'a fruits'], 'fruit', 'Uncountable, used in the generic sense.'),
  m(53, 'The ____ of hard work are always sweet.', ['fruit', 'fruits', 'fruites', 'a fruit'], 'fruits', "Idiomatic countable plural — 'the fruits of hard work'."),
  m(54, 'Why have you lost your ____?', ['look', 'a look', 'looks', 'lookes'], 'looks', 'Plural-only noun (good looks/appearance).'),
  m(55, 'A teacher likes a student who has good ____.', ['manner', 'manners', 'mannerss', 'a manner'], 'manners', 'Plural-only noun (behaviour/etiquette).'),
  m(56, 'Two ____ eggs are to be bought.', ['dozens', 'dozenes', 'dozen', 'a dozens'], 'dozen', "'Dozen' stays unchanged after a number."),
  m(57, '____ of people are jobless in our country.', ['Million', 'Millions', 'A million', 'Millionss'], 'Millions', "Plural for an indefinite large number followed by 'of'."),
  m(58, 'Two ____ of these books have been sold today.', ['hundreds', 'hundredes', 'a hundreds', 'hundred'], 'hundred', "Stays unchanged after a definite number ('two hundred')."),
  m(59, 'The government has constituted a two-____ committee.', ['men', 'mans', 'man', 'menes'], 'man', "Compound adjective stays singular ('a two-man committee')."),
  m(60, 'This is a five-____ programme.', ['days', 'dayes', 'daies', 'day'], 'day', "Compound adjective stays singular ('a five-day programme')."),

  // ---------- Part B: write the plural (subjective) — 21 ----------
  plural(1, 'church', 'churches', 'Ends in soft -ch → add -es.'),
  plural(2, 'stomach', 'stomachs', '-ch pronounced /k/ → add -s only.'),
  plural(3, 'hero', 'heroes', 'Consonant + o → -es.'),
  plural(4, 'photo', 'photos', 'Clipped word → add -s.'),
  plural(5, 'shelf', 'shelves', '-f → change to -ves.'),
  plural(6, 'roof', 'roofs', '-f → +s (exception).'),
  plural(7, 'cliff', 'cliffs', '-ff → add -s only.'),
  plural(8, 'criterion', 'criteria', 'Greek origin: -on → -a.'),
  plural(9, 'datum', 'data', 'Latin origin: -um → -a.'),
  plural(10, 'bacterium', 'bacteria', 'Latin origin: -um → -a.'),
  plural(11, 'thesis', 'theses', 'Greek origin: -is → -es.'),
  plural(12, 'cupful', 'cupfuls', 'Compound: pluralise the end (-fuls).'),
  plural(13, 'son-in-law', 'sons-in-law', 'Compound noun: pluralise the main noun.'),
  plural(14, 'Commander-in-Chief', 'Commanders-in-Chief', 'Compound noun: pluralise the main noun.'),
  plural(15, 'man driver', 'men drivers', 'Gender word describes the person: both parts change.'),
  plural(16, 'woman engineer', 'women engineers', 'Gender word describes the person: both parts change.'),
  plural(17, 'maid servant', 'maid servants', "'maid' already shows gender; only 'servant' changes."),
  plural(18, 'man lover', 'man lovers', "'man' is the object (like man-eater); only the outer word changes."),
  plural(19, 'mouse', 'mice', 'Irregular plural.'),
  plural(20, 'petroleum', 'petroleum', 'Uncountable — no plural form.'),
  plural(21, 'basis', 'bases', 'Greek origin: -is → -es.'),

  // ---------- Part C: correct the sentence (subjective) — 19 ----------
  fix(1, 'All the informations that you gave me yesterday turned out to be false.', 'All the information that you gave me yesterday turned out to be false.', "'Information' is uncountable and has no plural form."),
  fix(2, "Wordsworth's poetries are remarkable for the beautiful images drawn from Nature.", "Wordsworth's poetry is remarkable for the beautiful images drawn from Nature.", "'Poetry' (a body of work) is uncountable; use the singular verb 'is'."),
  fix(3, 'She wants to finish all the work as soon as possible because she wants to go on a two-months journey.', 'She wants to finish all the work as soon as possible because she wants to go on a two-month journey.', "A number used as a compound adjective before a noun stays singular ('a two-month journey')."),
  fix(4, 'One of my firmest belief was that Miss Rima had made a mistake which could not be overlooked.', 'One of my firmest beliefs was that Miss Rima had made a mistake which could not be overlooked.', "'One of the + plural noun' always requires a plural noun."),
  fix(5, 'We must fix some criterias for selecting suitable candidates for the post of supervisor.', 'We must fix some criteria for selecting suitable candidates for the post of supervisor.', "'Criteria' is already the plural of 'criterion'; 'criterias' is a double plural."),
  fix(6, 'I have decided to buy all the furnitures that I have seen in the exhibition held at the hotel Satkar.', 'I have decided to buy all the furniture that I have seen in the exhibition held at the hotel Satkar.', "'Furniture' is uncountable and has no plural form."),
  fix(7, 'The old woman said that all her daughters-in-laws treated her roughly.', 'The old woman said that all her daughters-in-law treated her roughly.', "In a compound like 'daughter-in-law', only the main noun is pluralised."),
  fix(8, 'It is noticed that the woman teachers are more sincere than the men teachers.', 'It is noticed that the women teachers are more sincere than the men teachers.', 'In such compounds both parts change in the plural: woman → women, man → men.'),
  fix(9, 'The P.M. said that his government would take some suitable steps to restore laws and orders in the country.', 'The P.M. said that his government would take some suitable steps to restore law and order in the country.', "'Law and order' is a fixed uncountable phrase and is never used in the plural."),
  fix(10, 'The police have arrested the thieves but they have failed to get any information about the valuable stolen.', 'The police have arrested the thieves but they have failed to get any information about the valuables stolen.', "'Valuable' used as a noun (= valuable items) must be plural: 'valuables'."),
  fix(11, 'The hotel, with all its belonging, has been bought by a famous doctor of this town.', 'The hotel, with all its belongings, has been bought by a famous doctor of this town.', "'Belongings' is a plural-only noun."),
  fix(12, 'It is a common belief that the poors are generally honest and innocent.', 'It is a common belief that the poor are generally honest and innocent.', "'The + adjective' (the poor) already means 'poor people' and never takes -s."),
  fix(13, 'I have learnt from a reliable source that Dr. Sinha does not allow any stranger to see his issues.', 'I have learnt from a reliable source that Dr. Sinha does not allow any stranger to see his issue.', "'Issue' meaning offspring is a collective noun with no plural form."),
  fix(14, 'She has deposited fifty thousands rupees in the bank today, which shows that her savings are good.', 'She has deposited fifty thousand rupees in the bank today, which shows that her savings are good.', 'Hundred/thousand/million stay singular after a definite number.'),
  fix(15, 'As soon as the S.P. arrived, all the police men came out of the barrack.', 'As soon as the S.P. arrived, all the policemen came out of the barracks.', "'Policemen' is one word; 'barracks' is normally plural in form."),
  fix(16, "Everybody gets the fruit of his doings, don't they?", "Everybody gets the fruits of his doings, doesn't he?", "'Everybody' is singular, so the tag is 'doesn't he'; and 'the fruits of' is the idiom."),
  fix(17, 'I had done most of the works when you called on me yesterday.', 'I had done most of the work when you called on me yesterday.', "'Work' (task/labour) is uncountable."),
  fix(18, 'The earthquake is a natural phenomena and it is beyond human control.', 'The earthquake is a natural phenomenon and it is beyond human control.', "'Phenomenon' is singular; 'phenomena' is its plural, so it cannot follow 'a'."),
  fix(19, 'I do not know the reason why the brethrens of this community fight among themselves.', 'I do not know the reason why the brethren of this community fight among themselves.', "'Brethren' is already a plural; 'brethrens' is a double plural."),
];

const PUBLISHED_AT = '2026-09-24T00:00:00.000Z';

/** Read-only for users — they can take these but never edit or delete them. */
export const OFFICIAL_TESTS: TestPaper[] = [
  {
    id: 'official_grammar_nouns_number',
    title: 'Nouns: Number & Kind',
    topic: 'English Grammar',
    durationMinutes: DURATION_MINUTES,
    questions: nounsQuestions,
    createdAt: PUBLISHED_AT,
    updatedAt: PUBLISHED_AT,
  },
];
