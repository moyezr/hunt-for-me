export function contactIdentityKey(input: {
  name: string;
  title: string;
  company: string;
}) {
  return [input.name, input.title, input.company]
    .map((part) => part.trim().toLowerCase())
    .join("|");
}
