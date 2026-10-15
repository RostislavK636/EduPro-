import {
  readdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
const root = "prisma/migrations";
const journalFile = "drizzle/meta/_journal.json";
const journal = JSON.parse(readFileSync(journalFile, "utf8"));
const folders = readdirSync(root, { withFileTypes: true })
  .filter((x) => x.isDirectory())
  .map((x) => x.name)
  .sort();
mkdirSync("drizzle/meta", { recursive: true });
folders.forEach((folder, index) => {
  const sql = readFileSync(`${root}/${folder}/migration.sql`, "utf8");
  let entry = journal.entries[index];
  if (!entry) {
    entry = {
      idx: index,
      version: "6",
      when: Date.now() + index,
      tag: String(index).padStart(4, "0") + "_" + folder.replace(/^\d+_/, ""),
      breakpoints: true,
    };
    journal.entries.push(entry);
  }
  const target = `drizzle/${entry.tag}.sql`;
  if (existsSync(target)) {
    if (
      readFileSync(target, "utf8").replaceAll("\r\n", "\n").trim() !==
      sql.replaceAll("\r\n", "\n").trim()
    )
      throw new Error(
        `Existing migration differs: ${target}. Applied SQL is immutable.`,
      );
  } else writeFileSync(target, sql);
});
writeFileSync(journalFile, JSON.stringify(journal, null, 2) + "\n");
console.log(`Проверено и синхронизировано миграций: ${folders.length}`);
