export type StageKey = "maybe" | "got" | "working";

export const STAGES: {
  key: StageKey;
  title: string;
  hint: string;
  tasks: { key: string; label: string }[];
}[] = [
  {
    key: "maybe",
    title: "Возможно получит оффер",
    hint: "первичный контакт",
    tasks: [{ key: "news", label: "Узнать новости" }],
  },
  {
    key: "got",
    title: "Получил оффер",
    hint: "оформление",
    tasks: [
      { key: "request_offer", label: "Запросить оффер" },
      { key: "crm", label: "Внести информацию в CRM" },
      { key: "start_date", label: "Узнать дату выхода" },
    ],
  },
  {
    key: "working",
    title: "Вышел на работу",
    hint: "сопровождение",
    tasks: [
      { key: "first_day", label: "Узнать как прошёл первый рабочий день" },
      { key: "review", label: "Запросить отзыв" },
      { key: "schedule", label: "Составить график оплат" },
      { key: "schedule_bot", label: "Внести график в бот" },
    ],
  },
];

export const STAGE_ORDER: StageKey[] = ["maybe", "got", "working"];

export function stageByKey(key: string) {
  return STAGES.find((s) => s.key === key) ?? STAGES[0];
}
