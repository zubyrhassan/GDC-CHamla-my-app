import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Facebook,
  GraduationCap,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";

import campusHero from "@/assets/campus-hero.jpg";
import { Button } from "@/components/ui/button";
import { SiteImage } from "@/components/site/SiteImage";
import { useSiteImage } from "@/lib/site";
import {
  formatDeadline,
  useAnnouncements,
  useBanners,
  useFaculty,
  useGallery,
  useSiteSettings,
  whatsappLink,
} from "@/lib/site";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GDC Chamla — Government Degree College, Buner" },
      {
        name: "description",
        content:
          "Government Degree College Chamla, District Buner: admissions, campus life, faculty and announcements for Pre-Medical, Pre-Engineering, ICS and Arts programmes.",
      },
      { property: "og:title", content: "GDC Chamla — Government Degree College, Buner" },
      {
        property: "og:description",
        content:
          "Admissions, campus gallery, faculty and news from Government Degree College Chamla, District Buner.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { data: settings } = useSiteSettings();
  const { data: banners = [] } = useBanners(true);
  const { data: announcements = [] } = useAnnouncements(true);
  const { data: gallery = [] } = useGallery(true);
  const { data: faculty = [] } = useFaculty(true);
  const { data: logoUrl } = useSiteImage(settings?.logo_url);

  const collegeName = settings?.college_name || "Government Degree College Chamla";
  const wa = whatsappLink(settings);
  const fb = settings?.facebook_page_url || "https://www.facebook.com/gdcchamlabuner";

  return (
    <div className="min-h-screen bg-[oklch(0.99_0.006_92)] text-foreground">
      <SiteHeader collegeName={collegeName} logoUrl={logoUrl ?? null} />

      <main>
        <Hero banners={banners} collegeName={collegeName} />

        {announcements.length ? <Admissions items={announcements} /> : null}

        <Streams />

        {gallery.length ? <Gallery photos={gallery} /> : null}

        {faculty.length ? <Faculty members={faculty} /> : null}

        <FacebookSection pageUrl={fb} />
      </main>

      <SiteFooter collegeName={collegeName} facebookUrl={fb} />

      {wa ? (
        <a
          href={wa}
          target="_blank"
          rel="noreferrer noopener"
          aria-label="Chat with us on WhatsApp"
          className="fixed right-5 bottom-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-success text-success-foreground shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          <MessageCircle className="h-7 w-7" />
        </a>
      ) : null}
    </div>
  );
}

function SiteHeader({ collegeName, logoUrl }: { collegeName: string; logoUrl: string | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-card/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-primary/5">
          {logoUrl ? (
            <img src={logoUrl} alt={`${collegeName} logo`} className="h-full w-full object-cover" />
          ) : (
            <GraduationCap className="h-6 w-6 text-primary" />
          )}
        </span>
        <div className="min-w-0">
          <p className="truncate font-serif text-base leading-tight font-semibold sm:text-lg">
            {collegeName}
          </p>
          <p className="truncate text-[11px] tracking-wide text-muted-foreground uppercase">
            District Buner, Khyber Pakhtunkhwa
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button asChild size="sm">
            <Link to="/portal-login">Student / Parent login</Link>
          </Button>
          <Button asChild size="sm" variant="outline" className="hidden sm:inline-flex">
            <Link to="/auth">Staff login</Link>
          </Button>
        </div>

      </div>
    </header>
  );
}

type BannerItem = {
  id: string;
  image_url: string;
  title: string | null;
  subtitle: string | null;
};

function Hero({ banners, collegeName }: { banners: BannerItem[]; collegeName: string }) {
  const [index, setIndex] = useState(0);
  const count = banners.length;

  useEffect(() => {
    if (count < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(t);
  }, [count]);

  useEffect(() => {
    if (index >= count && count > 0) setIndex(0);
  }, [count, index]);

  const active = banners[index];

  return (
    <section className="relative isolate">
      <div className="relative h-[62vh] min-h-[380px] w-full overflow-hidden">
        {count ? (
          banners.map((b, i) => (
            <div
              key={b.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                i === index ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={i === index ? undefined : true}
            >
              <SiteImage
                path={b.image_url}
                alt={b.title ?? `${collegeName} banner`}
                className="h-full w-full"
              />
            </div>
          ))
        ) : (
          <img src={campusHero} alt={collegeName} className="h-full w-full object-cover" />
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-primary/85 via-primary/45 to-primary/10" />

        <div className="absolute inset-x-0 bottom-0">
          <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
            <h1 className="max-w-3xl font-serif text-3xl leading-tight font-semibold text-primary-foreground sm:text-5xl">
              {active?.title ?? collegeName}
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-primary-foreground/85 sm:text-base">
              {active?.subtitle ??
                "Quality public education in Chamla, District Buner — intermediate streams and 80+ degree subjects."}
            </p>
            <Button asChild size="lg" className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">
              <a href="#admissions">
                Admissions <ArrowRight className="ml-1.5 h-4 w-4" />
              </a>
            </Button>
          </div>
        </div>

        {count > 1 ? (
          <>
            <button
              type="button"
              aria-label="Previous banner"
              onClick={() => setIndex((i) => (i - 1 + count) % count)}
              className="absolute top-1/2 left-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/70 text-foreground hover:bg-card"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              aria-label="Next banner"
              onClick={() => setIndex((i) => (i + 1) % count)}
              className="absolute top-1/2 right-3 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-card/70 text-foreground hover:bg-card"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <div className="absolute inset-x-0 bottom-3 flex justify-center gap-2">
              {banners.map((b, i) => (
                <button
                  key={b.id}
                  type="button"
                  aria-label={`Show banner ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? "w-6 bg-accent" : "w-2 bg-card/70"
                  }`}
                />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, text }: { eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mb-8 max-w-2xl">
      <p className="text-xs font-semibold tracking-[0.18em] text-accent uppercase">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-2xl font-semibold sm:text-3xl">{title}</h2>
      <div className="crest-rule mt-3 w-20" />
      {text ? <p className="mt-3 text-sm text-muted-foreground sm:text-base">{text}</p> : null}
    </div>
  );
}

function Admissions({
  items,
}: {
  items: { id: string; title: string; description: string | null; application_deadline: string | null }[];
}) {
  return (
    <section id="admissions" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading
        eyebrow="Admissions"
        title="Open announcements"
        text="Current admission notices and application deadlines."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((a) => (
          <article key={a.id} className="rounded-xl border bg-card p-5 shadow-panel">
            <h3 className="font-serif text-lg font-semibold">{a.title}</h3>
            {a.description ? (
              <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{a.description}</p>
            ) : null}
            {a.application_deadline ? (
              <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1.5 text-sm font-medium text-accent-foreground">
                <CalendarClock className="h-4 w-4" />
                Apply before {formatDeadline(a.application_deadline)}
              </p>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}

const STREAMS = [
  { title: "Pre-Medical", text: "Biology, Chemistry and Physics with well-equipped laboratories." },
  { title: "Pre-Engineering", text: "Mathematics, Physics and Chemistry with ECAT-oriented coaching." },
  { title: "ICS", text: "Computer Science with Mathematics or Statistics in a modern computer lab." },
  { title: "Arts & Humanities", text: "Languages, social sciences and religious studies for FA and BA." },
];

function Streams() {
  return (
    <section id="programmes" className="border-y bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading
          eyebrow="Programmes"
          title="What we teach"
          text="Intermediate streams plus 80+ degree subjects taught by qualified government faculty."
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STREAMS.map((s) => (
            <div key={s.title} className="rounded-xl border bg-card p-5 shadow-panel">
              <h3 className="font-serif text-base font-semibold">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Gallery({ photos }: { photos: { id: string; image_url: string; caption: string | null }[] }) {
  return (
    <section id="campus" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading eyebrow="Campus" title="Life at GDC Chamla" text="A look around our campus." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {photos.map((p) => (
          <figure key={p.id} className="overflow-hidden rounded-xl border bg-card shadow-panel">
            <SiteImage
              path={p.image_url}
              alt={p.caption ?? "Campus photograph"}
              className="aspect-[4/3] w-full"
              imgClassName="transition-transform duration-500 hover:scale-105"
            />
            {p.caption ? (
              <figcaption className="px-4 py-3 text-sm text-muted-foreground">{p.caption}</figcaption>
            ) : null}
          </figure>
        ))}
      </div>
    </section>
  );
}

function Faculty({
  members,
}: {
  members: { id: string; name: string; designation: string | null; department: string | null; photo_url: string | null }[];
}) {
  return (
    <section id="faculty" className="border-y bg-card/60">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <SectionHeading eyebrow="Faculty" title="Our teachers" text="The people behind the classrooms." />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {members.map((m) => (
            <article key={m.id} className="overflow-hidden rounded-xl border bg-card text-center shadow-panel">
              <SiteImage path={m.photo_url} alt={m.name} className="aspect-[4/5] w-full" />
              <div className="p-4">
                <h3 className="font-serif text-base font-semibold">{m.name}</h3>
                {m.designation ? <p className="text-sm text-muted-foreground">{m.designation}</p> : null}
                {m.department ? (
                  <p className="mt-1 text-xs tracking-wide text-accent uppercase">{m.department}</p>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function FacebookSection({ pageUrl }: { pageUrl: string }) {
  const src = `https://www.facebook.com/plugins/page.php?href=${encodeURIComponent(
    pageUrl,
  )}&tabs=timeline&width=500&height=600&small_header=false&adapt_container_width=true&hide_cover=false&show_facepile=true`;

  return (
    <section id="news" className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <SectionHeading
        eyebrow="News"
        title="Latest from our Facebook page"
        text="Events, notices and updates as we post them."
      />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-hidden rounded-xl border bg-card p-2 shadow-panel">
          <iframe
            title="GDC Chamla Facebook page"
            src={src}
            className="h-[600px] w-full rounded-lg"
            style={{ border: "none", overflow: "hidden" }}
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          />
        </div>
        <div className="rounded-xl border bg-card p-5 shadow-panel">
          <h3 className="font-serif text-lg font-semibold">Stay connected</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Follow the college page for admission dates, results and campus events.
          </p>
          <Button asChild className="mt-4 w-full">
            <a href={pageUrl} target="_blank" rel="noreferrer noopener">
              <Facebook className="mr-1.5 h-4 w-4" /> Follow us on Facebook
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}

function SiteFooter({ collegeName, facebookUrl }: { collegeName: string; facebookUrl: string }) {
  return (
    <footer className="bg-primary text-primary-foreground">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <p className="font-serif text-lg font-semibold">{collegeName}</p>
          <p className="mt-2 text-sm text-primary-foreground/75">
            A government college serving the students of Chamla valley and District Buner.
          </p>
        </div>
        <div className="space-y-2 text-sm text-primary-foreground/85">
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0" /> Chamla, District Buner, Khyber Pakhtunkhwa
          </p>
          <p className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0" /> Contact the college office
          </p>
          <p className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0" /> info@gdcchamla.edu.pk
          </p>
        </div>
        <div className="flex flex-col items-start gap-3">
          <a
            href={facebookUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
          >
            <Facebook className="h-4 w-4" /> Facebook page
          </a>
          <Link to="/portal-login" className="text-sm underline-offset-4 hover:underline">
            Student / Parent login
          </Link>
          <Link to="/auth" className="text-sm underline-offset-4 hover:underline">
            Staff login
          </Link>
        </div>

      </div>
      <div className="border-t border-primary-foreground/15 py-4 text-center text-xs text-primary-foreground/60">
        © {new Date().getFullYear()} {collegeName}
      </div>
    </footer>
  );
}
