// src/personalityQuestions.ts
//
// 20-question Big Five screen (4 per trait, shuffled order) in 3 age versions:
//   A = up to 15 (simpler words, "think of the last time" questions)
//   B = 16-20, C = 21-30.
// Options keep the same meaning and the same score in every version, so ONE
// scoring rule works for all (see personalityScoring.ts).
// Score 1-4 per option; 4 = nearer the "high" end of the trait. No reverse
// scoring needed. English only for now (the app is locked to English).

export type Trait = 'openness' | 'conscientiousness' | 'extraversion' | 'agreeableness' | 'neuroticism';
export type AgeVersion = 'A' | 'B' | 'C';
export type OptionKey = 'A' | 'B' | 'C' | 'D';

export interface PersonalityOption {
  key: OptionKey;
  score: 1 | 2 | 3 | 4;
  text: Record<AgeVersion, string>;
}
export interface PersonalityQuestion {
  id: string;
  trait: Trait;
  stems: Record<AgeVersion, string>;
  options: PersonalityOption[];
}

export const TRAITS: Trait[] = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism'];

/** One pair per trait asks the same thing from a different angle (consistency check). */
export const CONSISTENCY_PAIRS: Record<Trait, [string, string]> = {"openness": ["p4", "p20"], "conscientiousness": ["p3", "p11"], "extraversion": ["p2", "p6"], "agreeableness": ["p9", "p19"], "neuroticism": ["p7", "p17"]};

export const PERSONALITY_QUESTIONS: PersonalityQuestion[] = [
  {
    "id": "p1",
    "trait": "neuroticism",
    "stems": {
      "A": "Think of your last exam or result day. How did you feel before it?",
      "B": "Before an exam, interview or result day, how do you feel?",
      "C": "Before a big deadline, review or interview, how do you feel?"
    },
    "options": [
      {
        "key": "A",
        "score": 3,
        "text": {
          "A": "Quite worried, it was hard to focus",
          "B": "Quite worried, it is hard to focus",
          "C": "Quite worried, it is hard to focus"
        }
      },
      {
        "key": "B",
        "score": 1,
        "text": {
          "A": "Calm, it did not bother me much",
          "B": "Calm, it does not bother me much",
          "C": "Calm, it does not bother me much"
        }
      },
      {
        "key": "C",
        "score": 4,
        "text": {
          "A": "Very worried, I kept thinking about it",
          "B": "Very worried, I keep thinking about it",
          "C": "Very worried, I keep thinking about it"
        }
      },
      {
        "key": "D",
        "score": 2,
        "text": {
          "A": "A little nervous, but fine",
          "B": "A little nervous, but I am fine",
          "C": "A little nervous, but I am fine"
        }
      }
    ]
  },
  {
    "id": "p2",
    "trait": "extraversion",
    "stems": {
      "A": "After a full day at school, how do you usually feel?",
      "B": "After a long day of classes or exam prep, how do you feel?",
      "C": "After a full day of work or meetings, how do you feel?"
    },
    "options": [
      {
        "key": "A",
        "score": 3,
        "text": {
          "A": "Fine, with or without friends around",
          "B": "I feel fine with or without people around",
          "C": "I feel fine with or without people around"
        }
      },
      {
        "key": "B",
        "score": 1,
        "text": {
          "A": "I want to be alone for a while",
          "B": "I need to be alone for a while to recharge",
          "C": "I need to be alone for a while to recharge"
        }
      },
      {
        "key": "C",
        "score": 2,
        "text": {
          "A": "I want some quiet first, then friends",
          "B": "I like some quiet first, then a little company",
          "C": "I like some quiet first, then a little company"
        }
      },
      {
        "key": "D",
        "score": 4,
        "text": {
          "A": "I feel full of energy when I meet friends",
          "B": "I feel energised when I meet people",
          "C": "I feel energised when I meet people"
        }
      }
    ]
  },
  {
    "id": "p3",
    "trait": "conscientiousness",
    "stems": {
      "A": "Think of last week. How did you plan your homework?",
      "B": "How do you usually plan your study week?",
      "C": "How do you usually plan your work week and goals?"
    },
    "options": [
      {
        "key": "A",
        "score": 2,
        "text": {
          "A": "I decided each day how I felt",
          "B": "I decide each day based on my energy",
          "C": "I decide each day based on my energy"
        }
      },
      {
        "key": "B",
        "score": 3,
        "text": {
          "A": "I picked the main tasks and left the rest",
          "B": "I plan the main tasks and keep the rest open",
          "C": "I plan the main tasks and keep the rest open"
        }
      },
      {
        "key": "C",
        "score": 4,
        "text": {
          "A": "I made a plan for the week and followed it",
          "B": "I plan the whole week and follow it",
          "C": "I plan the whole week and follow it"
        }
      },
      {
        "key": "D",
        "score": 1,
        "text": {
          "A": "I just did whatever was due next",
          "B": "I do whatever is due next, without a plan",
          "C": "I do whatever is due next, without a plan"
        }
      }
    ]
  },
  {
    "id": "p4",
    "trait": "openness",
    "stems": {
      "A": "Your teacher tells you something interesting that is not in the syllabus. What do you do?",
      "B": "A lecture touches an interesting topic that will not come in the exam. What do you do?",
      "C": "You find an interesting topic that has nothing to do with your job or goals. What do you do?"
    },
    "options": [
      {
        "key": "A",
        "score": 3,
        "text": {
          "A": "I read about it the same day",
          "B": "I read a little about it the same day",
          "C": "I read a little about it the same day"
        }
      },
      {
        "key": "B",
        "score": 1,
        "text": {
          "A": "I stay with my syllabus; other things can wait",
          "B": "I stay with what I need; extra topics can wait",
          "C": "I stay with what I need; extra topics can wait"
        }
      },
      {
        "key": "C",
        "score": 4,
        "text": {
          "A": "I keep reading about it until I know everything",
          "B": "I follow it until my curiosity is satisfied, even if it takes long",
          "C": "I follow it until my curiosity is satisfied, even if it takes long"
        }
      },
      {
        "key": "D",
        "score": 2,
        "text": {
          "A": "I write it down and look at it if I get free time",
          "B": "I note it down and look at it only if I have spare time",
          "C": "I note it down and look at it only if I have spare time"
        }
      }
    ]
  },
  {
    "id": "p5",
    "trait": "agreeableness",
    "stems": {
      "A": "Your teacher announces a class contest. What matters most to you?",
      "B": "Your college announces a competition. What matters most to you?",
      "C": "Your company announces a performance contest. What matters most to you?"
    },
    "options": [
      {
        "key": "A",
        "score": 3,
        "text": {
          "A": "That everyone in the group does well",
          "B": "To do well while everyone does well together",
          "C": "To do well while everyone does well together"
        }
      },
      {
        "key": "B",
        "score": 2,
        "text": {
          "A": "To win, but play fair and share tips",
          "B": "To win, but fairly and with tips shared",
          "C": "To win, but fairly and with tips shared"
        }
      },
      {
        "key": "C",
        "score": 4,
        "text": {
          "A": "That nobody feels left out, even if I do not win",
          "B": "To make sure everyone feels included, even if I do not win",
          "C": "To make sure everyone feels included, even if I do not win"
        }
      },
      {
        "key": "D",
        "score": 1,
        "text": {
          "A": "To win, even if others lose",
          "B": "To win, even if others lose out",
          "C": "To win, even if others lose out"
        }
      }
    ]
  },
  {
    "id": "p6",
    "trait": "extraversion",
    "stems": {
      "A": "Where do you study best?",
      "B": "Which way of preparing works best for you?",
      "C": "Which way of working or learning suits you best?"
    },
    "options": [
      {
        "key": "A",
        "score": 2,
        "text": {
          "A": "Mostly alone, asking friends only for doubts",
          "B": "Mostly alone, with a quick chat for doubts",
          "C": "Mostly alone, with a quick chat for doubts"
        }
      },
      {
        "key": "B",
        "score": 4,
        "text": {
          "A": "With friends, talking about it",
          "B": "With others, talking it through",
          "C": "With others, talking it through"
        }
      },
      {
        "key": "C",
        "score": 1,
        "text": {
          "A": "Alone in a quiet place",
          "B": "Alone in a quiet place",
          "C": "Alone in a quiet place"
        }
      },
      {
        "key": "D",
        "score": 3,
        "text": {
          "A": "In a small group, with some quiet time",
          "B": "In a small group, with some quiet time",
          "C": "In a small group, with some quiet time"
        }
      }
    ]
  },
  {
    "id": "p7",
    "trait": "neuroticism",
    "stems": {
      "A": "Think of the last time you got fewer marks than you expected. What went on in your mind?",
      "B": "You score much lower than you expected. What goes on in your mind?",
      "C": "You get a result at work much lower than you expected. What goes on in your mind?"
    },
    "options": [
      {
        "key": "A",
        "score": 1,
        "text": {
          "A": "I thought 'next time' and moved on",
          "B": "I think 'next time' and move on",
          "C": "I think 'next time' and move on"
        }
      },
      {
        "key": "B",
        "score": 4,
        "text": {
          "A": "I started to doubt if I am good enough",
          "B": "I start doubting if I am good enough",
          "C": "I start doubting if I am good enough"
        }
      },
      {
        "key": "C",
        "score": 2,
        "text": {
          "A": "I felt bad for a short time, then moved on",
          "B": "I feel bad for a short time, then move on",
          "C": "I feel bad for a short time, then move on"
        }
      },
      {
        "key": "D",
        "score": 3,
        "text": {
          "A": "I kept thinking about it for days",
          "B": "I keep thinking about it for days",
          "C": "I keep thinking about it for days"
        }
      }
    ]
  },
  {
    "id": "p8",
    "trait": "conscientiousness",
    "stems": {
      "A": "Homework is due in a week. When do you usually start?",
      "B": "An assignment is due in a week. When do you start?",
      "C": "A task is due in a week. When do you start?"
    },
    "options": [
      {
        "key": "A",
        "score": 2,
        "text": {
          "A": "When the last date comes close",
          "B": "When the deadline starts to feel near",
          "C": "When the deadline starts to feel near"
        }
      },
      {
        "key": "B",
        "score": 4,
        "text": {
          "A": "The same day or the next day",
          "B": "Right away, the same day or the next",
          "C": "Right away, the same day or the next"
        }
      },
      {
        "key": "C",
        "score": 1,
        "text": {
          "A": "The night before; I work better in a hurry",
          "B": "The night before; I work best under pressure",
          "C": "The night before; I work best under pressure"
        }
      },
      {
        "key": "D",
        "score": 3,
        "text": {
          "A": "Within two or three days",
          "B": "Within a day or two",
          "C": "Within a day or two"
        }
      }
    ]
  },
  {
    "id": "p9",
    "trait": "agreeableness",
    "stems": {
      "A": "A friend says something you do not agree with. What do you do?",
      "B": "In a group project, a teammate suggests something you disagree with. What do you do?",
      "C": "A colleague suggests something you disagree with. What do you do?"
    },
    "options": [
      {
        "key": "A",
        "score": 3,
        "text": {
          "A": "I leave small things and speak only about big ones",
          "B": "I let small things go and speak up on big ones",
          "C": "I let small things go and speak up on big ones"
        }
      },
      {
        "key": "B",
        "score": 1,
        "text": {
          "A": "I say it clearly and argue my point",
          "B": "I say it directly and argue my point",
          "C": "I say it directly and argue my point"
        }
      },
      {
        "key": "C",
        "score": 4,
        "text": {
          "A": "I agree to keep the peace",
          "B": "I go along with it to keep the peace",
          "C": "I go along with it to keep the peace"
        }
      },
      {
        "key": "D",
        "score": 2,
        "text": {
          "A": "I politely say I disagree and tell why",
          "B": "I politely say I disagree and explain why",
          "C": "I politely say I disagree and explain why"
        }
      }
    ]
  },
  {
    "id": "p10",
    "trait": "openness",
    "stems": {
      "A": "How do you usually do your homework or revision?",
      "B": "How do you usually approach your study routine?",
      "C": "How do you usually approach your daily work?"
    },
    "options": [
      {
        "key": "A",
        "score": 1,
        "text": {
          "A": "I use one way that works for me",
          "B": "I keep one method that works for me",
          "C": "I keep one method that works for me"
        }
      },
      {
        "key": "B",
        "score": 3,
        "text": {
          "A": "I try a new way now and then",
          "B": "I try a new method now and then",
          "C": "I try a new method now and then"
        }
      },
      {
        "key": "C",
        "score": 2,
        "text": {
          "A": "I use my way and change it a little sometimes",
          "B": "I keep my method and tweak it sometimes",
          "C": "I keep my method and tweak it sometimes"
        }
      },
      {
        "key": "D",
        "score": 4,
        "text": {
          "A": "I like to change my way often",
          "B": "I enjoy switching methods often",
          "C": "I enjoy switching methods often"
        }
      }
    ]
  },
  {
    "id": "p11",
    "trait": "conscientiousness",
    "stems": {
      "A": "A boring but important task is waiting, like a long chapter. What do you do?",
      "B": "A boring but important task is waiting. What do you do?",
      "C": "A boring but important task is waiting. What do you do?"
    },
    "options": [
      {
        "key": "A",
        "score": 4,
        "text": {
          "A": "I do it first and finish it",
          "B": "I do it first so it is out of the way",
          "C": "I do it first so it is out of the way"
        }
      },
      {
        "key": "B",
        "score": 2,
        "text": {
          "A": "I wait until I feel like doing it",
          "B": "I wait for the right mood",
          "C": "I wait for the right mood"
        }
      },
      {
        "key": "C",
        "score": 3,
        "text": {
          "A": "I do an easy task first, then this one",
          "B": "I do it after one easier task",
          "C": "I do it after one easier task"
        }
      },
      {
        "key": "D",
        "score": 1,
        "text": {
          "A": "I do it only when the last date is close",
          "B": "I do it only when the deadline is close",
          "C": "I do it only when the deadline is close"
        }
      }
    ]
  },
  {
    "id": "p12",
    "trait": "neuroticism",
    "stems": {
      "A": "Think of the last time something suddenly went wrong (a plan changed, notes were lost). What happened to you?",
      "B": "When a plan or a paper suddenly goes wrong, what happens to you?",
      "C": "When a plan suddenly goes wrong at work, what happens to you?"
    },
    "options": [
      {
        "key": "A",
        "score": 3,
        "text": {
          "A": "I got stressed and could not think well",
          "B": "I get stressed and find it hard to think",
          "C": "I get stressed and find it hard to think"
        }
      },
      {
        "key": "B",
        "score": 2,
        "text": {
          "A": "I felt upset, but I fixed it",
          "B": "I feel upset, but I sort it out",
          "C": "I feel upset, but I sort it out"
        }
      },
      {
        "key": "C",
        "score": 1,
        "text": {
          "A": "I stayed calm and looked for a fix",
          "B": "I stay calm and look for a fix",
          "C": "I stay calm and look for a fix"
        }
      },
      {
        "key": "D",
        "score": 4,
        "text": {
          "A": "I felt very scared and lost",
          "B": "I feel overwhelmed and panicky",
          "C": "I feel overwhelmed and panicky"
        }
      }
    ]
  },
  {
    "id": "p13",
    "trait": "extraversion",
    "stems": {
      "A": "In class discussions, what do you usually do?",
      "B": "In group discussions, what do you usually do?",
      "C": "In meetings or group discussions, what do you usually do?"
    },
    "options": [
      {
        "key": "A",
        "score": 4,
        "text": {
          "A": "I speak up quickly and think while talking",
          "B": "I jump in quickly and think while talking",
          "C": "I jump in quickly and think while talking"
        }
      },
      {
        "key": "B",
        "score": 1,
        "text": {
          "A": "I like to listen and speak when asked",
          "B": "I prefer to listen and speak when asked",
          "C": "I prefer to listen and speak when asked"
        }
      },
      {
        "key": "C",
        "score": 3,
        "text": {
          "A": "I share my ideas quite often",
          "B": "I share my ideas fairly often",
          "C": "I share my ideas fairly often"
        }
      },
      {
        "key": "D",
        "score": 2,
        "text": {
          "A": "I think first, then speak",
          "B": "I speak after thinking it through",
          "C": "I speak after thinking it through"
        }
      }
    ]
  },
  {
    "id": "p14",
    "trait": "agreeableness",
    "stems": {
      "A": "A friend asks for your help just before your own exam. What do you do?",
      "B": "A friend asks for help during your busiest exam week. What do you do?",
      "C": "A colleague or friend asks for help when you are very busy. What do you do?"
    },
    "options": [
      {
        "key": "A",
        "score": 2,
        "text": {
          "A": "I help for a few minutes, then go back to study",
          "B": "I help for a few minutes, then go back to my work",
          "C": "I help for a few minutes, then go back to my work"
        }
      },
      {
        "key": "B",
        "score": 4,
        "text": {
          "A": "I help as long as they need, even if I lose time",
          "B": "I help as long as they need, even if it costs me time",
          "C": "I help as long as they need, even if it costs me time"
        }
      },
      {
        "key": "C",
        "score": 1,
        "text": {
          "A": "I say sorry, I have to study",
          "B": "I say sorry, I need to focus on my work",
          "C": "I say sorry, I need to focus on my work"
        }
      },
      {
        "key": "D",
        "score": 3,
        "text": {
          "A": "I help properly, then catch up on my study",
          "B": "I help properly, then catch up",
          "C": "I help properly, then catch up"
        }
      }
    ]
  },
  {
    "id": "p15",
    "trait": "openness",
    "stems": {
      "A": "Your teacher gives a type of question you have never seen. What do you do?",
      "B": "A test or assignment has a type of problem you have never seen before. What do you do?",
      "C": "Your work needs a task you have never done before. What do you do?"
    },
    "options": [
      {
        "key": "A",
        "score": 3,
        "text": {
          "A": "I try it at once and learn from my mistakes",
          "B": "I try it at once and learn from mistakes",
          "C": "I try it at once and learn from mistakes"
        }
      },
      {
        "key": "B",
        "score": 4,
        "text": {
          "A": "I like odd questions; they are the most fun",
          "B": "I like unusual problems; they are the most interesting part",
          "C": "I like unusual problems; they are the most interesting part"
        }
      },
      {
        "key": "C",
        "score": 1,
        "text": {
          "A": "I want to see a solved example first",
          "B": "I want to see a solved example first",
          "C": "I want to see a solved example first"
        }
      },
      {
        "key": "D",
        "score": 2,
        "text": {
          "A": "I look at how it works for a minute, then try",
          "B": "I try after a quick look at how it works",
          "C": "I try after a quick look at how it works"
        }
      }
    ]
  },
  {
    "id": "p16",
    "trait": "conscientiousness",
    "stems": {
      "A": "How are your school bag, notebooks and desk usually kept?",
      "B": "How are your notes, files and study space usually kept?",
      "C": "How are your files, notes and workspace usually kept?"
    },
    "options": [
      {
        "key": "A",
        "score": 2,
        "text": {
          "A": "A bit messy, but I can find things",
          "B": "A bit messy, but I find things when I need them",
          "C": "A bit messy, but I find things when I need them"
        }
      },
      {
        "key": "B",
        "score": 3,
        "text": {
          "A": "Mostly neat, and I tidy up once a week",
          "B": "Mostly organised, and I tidy up weekly",
          "C": "Mostly organised, and I tidy up weekly"
        }
      },
      {
        "key": "C",
        "score": 1,
        "text": {
          "A": "Messy, and I often search for things",
          "B": "Messy, and I often search for things",
          "C": "Messy, and I often search for things"
        }
      },
      {
        "key": "D",
        "score": 4,
        "text": {
          "A": "Very neat, and I always know where things are",
          "B": "Everything is organised and I always know where it is",
          "C": "Everything is organised and I always know where it is"
        }
      }
    ]
  },
  {
    "id": "p17",
    "trait": "neuroticism",
    "stems": {
      "A": "Think of the last time a teacher or parent pointed out a mistake in your work. How did you feel?",
      "B": "A teacher points out a mistake in your work. How do you feel?",
      "C": "Your manager or a colleague criticises your work. How do you feel?"
    },
    "options": [
      {
        "key": "A",
        "score": 4,
        "text": {
          "A": "It felt personal and spoiled my mood for the day",
          "B": "It feels personal and affects my mood for the day",
          "C": "It feels personal and affects my mood for the day"
        }
      },
      {
        "key": "B",
        "score": 1,
        "text": {
          "A": "I took it as help to get better",
          "B": "I take it as useful information",
          "C": "I take it as useful information"
        }
      },
      {
        "key": "C",
        "score": 3,
        "text": {
          "A": "It stayed on my mind for a while",
          "B": "It stays on my mind for a while",
          "C": "It stays on my mind for a while"
        }
      },
      {
        "key": "D",
        "score": 2,
        "text": {
          "A": "I felt a small sting, then used it",
          "B": "I feel a small sting, then use it",
          "C": "I feel a small sting, then use it"
        }
      }
    ]
  },
  {
    "id": "p18",
    "trait": "extraversion",
    "stems": {
      "A": "You join a new class or group where you know nobody. What do you do?",
      "B": "You join a new class, hostel or group where you know few people. What do you do?",
      "C": "You join a new team or event where you know few people. What do you do?"
    },
    "options": [
      {
        "key": "A",
        "score": 2,
        "text": {
          "A": "I talk to one or two people",
          "B": "I talk to one or two people",
          "C": "I talk to one or two people"
        }
      },
      {
        "key": "B",
        "score": 3,
        "text": {
          "A": "I start talking to many people soon",
          "B": "I start talking to several people soon",
          "C": "I start talking to several people soon"
        }
      },
      {
        "key": "C",
        "score": 1,
        "text": {
          "A": "I stay quiet until I know people",
          "B": "I stay quiet until I know people",
          "C": "I stay quiet until I know people"
        }
      },
      {
        "key": "D",
        "score": 4,
        "text": {
          "A": "I go and say hello to everyone",
          "B": "I introduce myself to everyone",
          "C": "I introduce myself to everyone"
        }
      }
    ]
  },
  {
    "id": "p19",
    "trait": "agreeableness",
    "stems": {
      "A": "A classmate gives an answer different from yours. What do you do?",
      "B": "A classmate or teammate gives an answer different from yours. What do you do?",
      "C": "A colleague gives an answer different from yours. What do you do?"
    },
    "options": [
      {
        "key": "A",
        "score": 2,
        "text": {
          "A": "I listen, but check well before I change mine",
          "B": "I listen, but check carefully before changing mine",
          "C": "I listen, but check carefully before changing mine"
        }
      },
      {
        "key": "B",
        "score": 4,
        "text": {
          "A": "I first look for what is right in their answer",
          "B": "I look for what is right in their answer first",
          "C": "I look for what is right in their answer first"
        }
      },
      {
        "key": "C",
        "score": 1,
        "text": {
          "A": "I think mine is right until I am proved wrong",
          "B": "I assume mine is right until proven wrong",
          "C": "I assume mine is right until proven wrong"
        }
      },
      {
        "key": "D",
        "score": 3,
        "text": {
          "A": "I compare both answers with an open mind",
          "B": "I compare both with an open mind",
          "C": "I compare both with an open mind"
        }
      }
    ]
  },
  {
    "id": "p20",
    "trait": "openness",
    "stems": {
      "A": "Your teacher shows a trick to solve a sum and also explains why the trick works. How do you feel?",
      "B": "Your lecturer explains why a method works, not just the steps. How do you feel?",
      "C": "A trainer explains why a method works, not just the steps. How do you feel?"
    },
    "options": [
      {
        "key": "A",
        "score": 2,
        "text": {
          "A": "I like the 'why' only if I can see where it is used",
          "B": "I like the 'why' only when I can see where it is used",
          "C": "I like the 'why' only when I can see where it is used"
        }
      },
      {
        "key": "B",
        "score": 1,
        "text": {
          "A": "I only want the steps and practice",
          "B": "I prefer steps and practice over the reason behind them",
          "C": "I prefer steps and practice over the reason behind them"
        }
      },
      {
        "key": "C",
        "score": 3,
        "text": {
          "A": "I like a short 'why', then I want to practice",
          "B": "I like a short 'why', then I move to practice",
          "C": "I like a short 'why', then I move to practice"
        }
      },
      {
        "key": "D",
        "score": 4,
        "text": {
          "A": "I enjoy knowing why it works, even if I never use it",
          "B": "I enjoy understanding why, even with no use yet",
          "C": "I enjoy understanding why, even with no use yet"
        }
      }
    ]
  }
];
