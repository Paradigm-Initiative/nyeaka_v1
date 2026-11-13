import React from "react";

export type LegalSection = { id: string; title: string; body: string };

/** Plain legal page: a title, an intro and titled sections. Paragraphs are separated by blank lines in the catalogue. */
const LegalDocument = ({
  title, intro, updated, sections, children,
}: {
  title: string; intro: string; updated: string; sections: LegalSection[]; children?: React.ReactNode;
}) => (
  <article className="flex flex-col gap-6 mx-auto py-8 max-w-2xl section-wrapper">
    <header className="flex flex-col gap-2">
      <h1 className="text-heading-2">{title}</h1>
      <p className="text-muted-foreground text-caption">{updated}</p>
      <p className="text-body-lg text-pretty">{intro}</p>
    </header>
    {sections.map((s) => (
      <section key={s.id} className="flex flex-col gap-2">
        <h2 className="text-heading-4">{s.title}</h2>
        {s.body.split("\n\n").map((para, i) => (
          <p key={i} className="text-body-md text-pretty">{para}</p>
        ))}
      </section>
    ))}
    {children}
  </article>
);

export default LegalDocument;
