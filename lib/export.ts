import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  ImageRun,
} from "docx";
import PptxGenJS from "pptxgenjs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { documentSchema, ToolType, Section } from "./domain";
import { getRuntime } from "./runtime";
import { slidePalette } from "./slide-theme";
import { db } from "./database";
import { storage } from "./storage";

async function getImage(section: Section, ownerId: string) {
  if (!section.imageId) return null;
  const record = await (
    await db()
  ).fileAttachment.findFirst({ where: { id: section.imageId, ownerId } });
  if (!record || !["image/png", "image/jpeg"].includes(record.mimeType))
    return null;
  const bytes = await storage().get(record.storageKey);
  return bytes
    ? {
        bytes,
        mime: record.mimeType,
        type:
          record.mimeType === "image/png" ? ("png" as const) : ("jpg" as const),
      }
    : null;
}

function answerLines(section: Section) {
  if (answerOptions(section).length)
    return ["Ответ: ______________________________________________"];

  const text = `${section.title}\n${section.body}`.toLocaleLowerCase("ru-RU");
  const longAnswer =
    /определени|объясн|обосну|сравн|проанализ|опишите|расскажите|почему|приведите пример|развернут|развёрнут|эссе|сочинени/.test(
      text,
    );
  const shortAnswer =
    /назовите|укажите|впишите|вставьте|вычисл|решите|сколько|кто|когда|где|дата|формул|одним словом|термин/.test(
      text,
    );
  const count = longAnswer ? 4 : shortAnswer ? 1 : 2;
  return [
    "Ответ: ______________________________________________",
    ...Array.from({ length: count - 1 }, () => "______________________________________________________"),
  ];
}

function answerOptions(section: Section) {
  return (section.options || []).filter((option) => option.trim());
}

function isQuestionMaterial(type: ToolType) {
  return type === "test" || type === "worksheet";
}

function questionLines(section: Section) {
  return section.body
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(
      (line) =>
        line.trim() &&
        !/^место для ответа\s*:/i.test(line.trim()) &&
        !/^ответ\s*:/i.test(line.trim()),
    );
}

function testQuestionText(section: Section, index: number) {
  return [
    `${index}. ${section.title}`,
    ...questionLines(section),
    ...(answerOptions(section).length
      ? answerOptions(section).map(
          (option, optionIndex) => `${optionIndex + 1}) ${option}`,
        )
      : []),
  ];
}

export async function exportMaterial(
  material: any,
  format: string,
  teacher: boolean,
) {
  const data = documentSchema.parse(material.contentJson),
    sections = data.sections,
    title = material.title;
  if (format === "docx") {
    const children: any[] = [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      new Paragraph(`Класс: ${material.grade}`),
      new Paragraph(`Предмет: ${material.subject}`),
    ];
    if (isQuestionMaterial(material.type as ToolType)) {
      sections.forEach((section, index) => {
        children.push(
          new Paragraph({
            text: `${index + 1}. ${section.title}`,
            heading: HeadingLevel.HEADING_1,
          }),
          ...questionLines(section).map(
            (line) => new Paragraph({ children: [new TextRun(line)] }),
          ),
          ...(answerOptions(section).length
            ? answerOptions(section).map(
                (option, optionIndex) =>
                  new Paragraph(`${optionIndex + 1}) ${option}`),
              )
            : []),
          ...answerLines(section).map(
            (line) => new Paragraph({ text: line }),
          ),
        );
        if (teacher && section.answer)
          children.push(new Paragraph(`Ответ / критерии: ${section.answer}`));
      });
    }
    if (data.demo && !isQuestionMaterial(material.type as ToolType))
      children.push(new Paragraph("Редактируемый демонстрационный шаблон"));
    if (material.type === "lesson")
      children.push(
        new Table({
          rows: [
            new TableRow({
              children: ["Этап", "Минут", "Деятельность"].map(
                (text) => new TableCell({ children: [new Paragraph(text)] }),
              ),
            }),
            ...sections
              .filter((x) => x.duration !== undefined)
              .map(
                (s) =>
                  new TableRow({
                    children: [s.title, String(s.duration), s.body].map(
                      (text) =>
                        new TableCell({ children: [new Paragraph(text)] }),
                    ),
                  }),
              ),
          ],
        }),
      );
    for (const s of isQuestionMaterial(material.type as ToolType)
      ? []
      : sections) {
      children.push(
        new Paragraph({ text: s.title, heading: HeadingLevel.HEADING_1 }),
        ...s.body
          .split("\n")
          .map((line) => new Paragraph({ children: [new TextRun(line)] })),
      );
      if (answerOptions(s).length)
        children.push(
          ...answerOptions(s).map((o, i) => new Paragraph(i + 1 + ") " + o)),
        );
      const img = await getImage(s, material.userId);
      if (img)
        children.push(
          new Paragraph({
            children: [
              new ImageRun({
                data: img.bytes,
                type: img.type,
                transformation: { width: 500, height: 280 },
              }),
            ],
          }),
        );
      if (s.points !== undefined)
        children.push(new Paragraph("Максимальный балл: " + s.points));
      if (teacher && s.answer)
        children.push(new Paragraph("Ответ / критерии: " + s.answer));
    }
    const doc = new Document({
      styles: { default: { document: { run: { font: "Arial", size: 22 } } } },
      sections: [
        {
          properties: {
            page: {
              size: { width: 11906, height: 16838 },
              margin: { top: 900, right: 900, bottom: 900, left: 900 },
            },
          },
          children,
        },
      ],
    });
    return {
      bytes: new Uint8Array(await Packer.toBuffer(doc)),
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
  }
  if (format === "pptx") {
    const deck = new PptxGenJS();
    deck.layout = "LAYOUT_WIDE";
    deck.author = "EduPilot";
    deck.subject = material.subject;
    deck.title = title;
    for (const s of sections) {
      const slide = deck.addSlide(),
        palette = slidePalette(s.background);
      slide.background = { color: (s.background || "#080D1C").slice(1) };
      slide.addText(s.title, {
        x: 0.7,
        y: 0.7,
        w: 12,
        h: 1.1,
        fontSize: 30,
        bold: true,
        color: palette.accent.slice(1),
        fontFace: "Arial",
        fit: "shrink",
      });
      const img = await getImage(s, material.userId);
      slide.addText(s.body, {
        x: 0.75,
        y: 2,
        w: img ? 7.2 : 11.8,
        h: 4.5,
        fontSize: 22,
        color: palette.text.slice(1),
        fontFace: "Arial",
        fit: "shrink",
        valign: "top",
      });
      if (img) {
        const image = 'data:' + img.mime + ';base64,' + Buffer.from(img.bytes).toString('base64');
        slide.addImage({data:image,x:8.4,y:2.2,w:4.1,h:3.1,sizing:{type:'contain',w:4.1,h:3.1}});
      }
      slide.addNotes(s.body);
      slide.addText(
        material.subject + " · " + material.grade + " класс · EduPilot",
        {
          x: 0.75,
          y: 7,
          w: 11.7,
          h: 0.2,
          fontSize: 10,
          color: palette.muted.slice(1),
        },
      );
    }
    const buffer = await deck.write({ outputType: "arraybuffer" });
    return {
      bytes: new Uint8Array(buffer as ArrayBuffer),
      mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    };
  }
  if (format === "pdf") {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    let fontBytes: Uint8Array;
    if (getRuntime()?.ASSETS) {
      const r = await getRuntime()!.ASSETS!.fetch(
        new Request("https://assets/fonts/NotoSans-Regular.ttf"),
      );
      if (!r.ok) throw Error("PDF font missing");
      fontBytes = new Uint8Array(await r.arrayBuffer());
    } else {
      const fs = await import("node:fs/promises");
      fontBytes = new Uint8Array(
        await fs.readFile("public/fonts/NotoSans-Regular.ttf"),
      );
    }
    const font = await pdf.embedFont(fontBytes, { subset: true });
    let page = pdf.addPage([595.28, 841.89]),
      y = 790;
    const line = (text: string, size: number) => {
      if (y < 55) {
        page = pdf.addPage([595.28, 841.89]);
        y = 790;
      }
      page.drawText(text, {
        x: 50,
        y,
        size,
        font,
        color: rgb(0.08, 0.1, 0.15),
      });
      y -= size * 1.6;
    };
    const draw = (text: string, size = 11) => {
      for (const raw of text
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
        .split("\n")) {
        let current = "";
        for (const char of raw) {
          if (font.widthOfTextAtSize(current + char, size) > 490) {
            const at = current.lastIndexOf(" ");
            if (at > 0) {
              line(current.slice(0, at), size);
              current = current.slice(at + 1);
            } else {
              line(current, size);
              current = "";
            }
          }
          current += char;
        }
        line(current, size);
      }
    };
    draw(title, 21);
    draw("Класс: " + material.grade);
    draw("Предмет: " + material.subject);
    if (data.demo && !isQuestionMaterial(material.type as ToolType))
      draw("Редактируемый демонстрационный шаблон", 9);
    if (isQuestionMaterial(material.type as ToolType)) {
      sections.forEach((section, index) => {
        y -= 12;
        testQuestionText(section, index + 1).forEach((text, lineIndex) =>
          draw(text, lineIndex === 0 ? 14 : 11),
        );
        answerLines(section).forEach((line) => draw(line));
        if (teacher && section.answer)
          draw("Ответ / критерии: " + section.answer, 9);
      });
    }
    for (const s of isQuestionMaterial(material.type as ToolType)
      ? []
      : sections) {
      y -= 12;
      draw(
        s.title +
          (s.duration !== undefined
            ? " (" +
              s.duration +
              " " +
              (material.type === "video" ? "с" : "мин") +
              ")"
            : ""),
        14,
      );
      draw(s.body);
      if (answerOptions(s).length)
        answerOptions(s).forEach((o, i) => draw(i + 1 + ") " + o));
      const img = await getImage(s, material.userId);
      if (img) {
        const embedded =
          img.type === "png"
            ? await pdf.embedPng(img.bytes)
            : await pdf.embedJpg(img.bytes);
        const ratio = Math.min(490 / embedded.width, 230 / embedded.height);
        const h = embedded.height * ratio;
        if (y - h < 55) {
          page = pdf.addPage([595.28, 841.89]);
          y = 790;
        }
        page.drawImage(embedded, {
          x: 50,
          y: y - h,
          width: embedded.width * ratio,
          height: h,
        });
        y -= h + 15;
      }
      if (s.points !== undefined) draw("Максимальный балл: " + s.points, 9);
      if (teacher && s.answer) draw("Ответ / критерии: " + s.answer);
    }
    return { bytes: await pdf.save(), mime: "application/pdf" };
  }
  throw Error("Unsupported export");
}
