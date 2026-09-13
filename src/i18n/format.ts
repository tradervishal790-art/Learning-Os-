/**
 * Simple positional placeholder substitution for translation strings.
 * translations.ts uses `{0}`, `{1}`, etc. as placeholders (e.g. "{0} due").
 * Usage: format(t.dashboard.home.statsCards.dueSuffix, count)
 */
export function format(template: string, ...args: (string | number)[]): string {
  return args.reduce<string>(
    (acc, arg, i) => acc.split(`{${i}}`).join(String(arg)),
    template
  );
}
