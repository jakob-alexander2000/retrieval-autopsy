export type PreparedQuestion = {
  id: string;
  text: string;
  note: string;
};

export const QUESTIONS: PreparedQuestion[] = [
  {
    id: "leave",
    text: "How many days of annual leave do employees get?",
    note: "The passage states a limit. Compare an answer that keeps it with one that drops it.",
  },
  {
    id: "doctor",
    text: "When do I need a doctor's note if I am off sick?",
    note: "The handbook uses different words for the same thing.",
  },
  {
    id: "home",
    text: "May I work from home for 2 days a week?",
    note: "There is an unless in the passage.",
  },
  {
    id: "learning",
    text: "What is the learning budget?",
    note: "Keyword search can latch onto a different fund.",
  },
  {
    id: "contractors",
    text: "Do contractors receive sick pay?",
    note: "One sentence takes the benefit away.",
  },
  {
    id: "scope",
    text: "Does every worker get these benefits?",
    note: "The opening says who the handbook is for.",
  },
  {
    id: "overtime",
    text: "What extra pay is due for overtime?",
    note: "There is a number, and a condition on approval.",
  },
  {
    id: "notice",
    text: "How much notice must I give to resign?",
    note: "Other paragraphs also use the word notice.",
  },
];
