import type { Table } from './table'

const has = (t: Table, ...h: string[]) => h.every((x) => t.headers.includes(x))

export function aiTips(t: Table): string[] {
  const tips = ['Ask Gemini in Sheets (or paste into ChatGPT or any AI assistant) about this table, for example:']
  if (has(t, 'profit_pct')) tips.push('"Which markets have the highest profit_pct?"', '"Which bookmaker pairs appear most often?"')
  else if (has(t, 'expected_value_pct')) tips.push('"Which leagues have the most rows above 5% expected_value_pct?"', '"Chart bookmaker_odds against fair_odds."')
  else if (has(t, 'drop_since_opening_pct')) tips.push('"Which matches dropped most since opening?"', '"Do bigger drops happen closer to kickoff?"')
  else if (has(t, 'best_odds')) tips.push('"Which bookmaker has the best price most often?"', '"Where is best_odds furthest above fair_odds?"')
  else if (has(t, 'bookmaker', 'odds')) tips.push('"Which bookmaker has the highest odds for each selection?"', '"What is the margin per bookmaker on the main line?"')
  else tips.push('"Summarise this table in five bullet points."', '"Build a pivot table that answers my question."')
  return tips
}
