"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useInView } from "react-intersection-observer";
import { Alert, Button, EmptyState, Spinner } from "@heroui/react";
import { IconAlertCircle, IconSearch } from "@tabler/icons-react";
import { catalogueUrl, coursesApi } from "@/api/courses.api";
import CourseCard from "@/components/Courses/CourseCard";
import { CATEGORIES, LEVELS } from "@/utils/courseMeta";
import type { CourseCategory, CourseLevel, CourseListItem, CourseQuery } from "@/utils/types/courses";

const SORTS = { newest: "Newest", popular: "Most learners", rating: "Highest rated" } as const;
const selectClass = "h-10 rounded-xl border border-border bg-field px-3 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

/** One scrolling grid for one query; the parent remounts it (key) when the filters change, so pages never mix. */
function CoursesFeed({ firstPage, isFiltered }: { firstPage: string; isFiltered: boolean }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [courses, setCourses] = useState<CourseListItem[]>([]);
  const [count, setCount] = useState(0);
  const [next, setNext] = useState<string | null>(null);

  // the API returns absolute next-page URLs; apiClient already has the /api base
  const nextPath = next ? next.slice(next.indexOf("/courses/")) : null;

  const fetchCourses = (url: string = firstPage) =>
    coursesApi.courses(url)
      .then((data) => {
        setNext(data.next);
        setCount(data.count);
        setCourses((prev) => (url === firstPage ? data.results : [...prev, ...data.results]));
      })
      .catch(() => setHasError(true))
      .finally(() => {
        setIsLoading(false);
        setIsFetchingMore(false);
      });

  // once per mount: the parent remounts this feed whenever the query changes
  useEffect(() => {
    fetchCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = () => {
    if (!nextPath) return;
    setHasError(false);
    setIsFetchingMore(true);
    fetchCourses(nextPath);
  };

  // The sentinel only exists while idle, so each page mounts a fresh one; hasError removes it, so a failed page isn't retried in a loop
  const { ref } = useInView({ rootMargin: "200px", onChange: (inView) => inView && loadMore() });

  const retry = () => {
    if (courses.length && nextPath) return loadMore();
    setHasError(false);
    setIsLoading(true);
    fetchCourses();
  };

  const errorNote = (
    <Alert status="danger" className="mt-8 items-center">
      <Alert.Indicator><IconAlertCircle size={20} /></Alert.Indicator>
      <Alert.Content>
        <Alert.Title>Couldn&rsquo;t load courses</Alert.Title>
        <Alert.Description>Check your connection and try again.</Alert.Description>
      </Alert.Content>
      <Button size="sm" variant="danger-soft" onPress={retry}>Try again</Button>
    </Alert>
  );

  if (isLoading) {
    return (
      <div className="mt-8 flex items-center justify-center gap-3 py-12 text-muted" role="status">
        <Spinner size="sm" />
        Loading courses…
      </div>
    );
  }
  if (courses.length === 0) {
    return hasError ? errorNote : (
      <EmptyState className="mt-8 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border-tertiary px-6 py-12 text-center text-base">
        <p className="m-0 text-lg font-semibold text-foreground">{isFiltered ? "No courses match" : "No courses yet"}</p>
        <p className="m-0 text-muted">{isFiltered ? "Try other words or clear the filters." : "New courses will appear here."}</p>
      </EmptyState>
    );
  }
  return (
    <>
      <p className="m-0 mt-6 text-sm text-muted" role="status">{count === 1 ? "1 course" : `${count} courses`}</p>
      <ul className="m-0 mt-3 grid list-none gap-5 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => <li key={course.id}><CourseCard course={course} /></li>)}
      </ul>
      {hasError ? errorNote : next && (
        <div ref={isFetchingMore ? undefined : ref} key={next} className="mt-6 flex min-h-5 items-center justify-center gap-2 text-sm text-muted">
          {isFetchingMore && <><Spinner size="sm" /> Loading more courses…</>}
        </div>
      )}
    </>
  );
}

function readQuery(params: URLSearchParams): CourseQuery {
  const category = params.get("category") ?? "";
  const level = params.get("level") ?? "";
  const sort = params.get("sort") ?? "newest";
  return {
    q: params.get("q") ?? "",
    category: category in CATEGORIES ? (category as CourseCategory) : "",
    level: level in LEVELS ? (level as CourseLevel) : "",
    sort: sort in SORTS ? (sort as CourseQuery["sort"]) : "newest",
  };
}

/** The catalogue: published courses, searchable and filterable; the filters live in the URL so a search can be shared. */
function CoursesList() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = readQuery(new URLSearchParams(params.toString()));
  const [search, setSearch] = useState(query.q ?? "");

  const setQuery = (patch: Partial<CourseQuery>) => {
    const nextQuery = { ...query, ...patch };
    const url = new URLSearchParams();
    for (const [name, value] of Object.entries(nextQuery)) {
      if (value && !(name === "sort" && value === "newest")) url.set(name, String(value));
    }
    router.replace(url.size ? `${pathname}?${url}` : pathname, { scroll: false });
  };

  // search as the visitor types, a moment after they stop
  useEffect(() => {
    if (search === (query.q ?? "")) return;
    const timer = setTimeout(() => setQuery({ q: search.trim() }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const firstPage = catalogueUrl(query);
  const isFiltered = Boolean(query.q || query.category || query.level);

  return (
    <div className="mt-4 pb-6">
      <section className="flex flex-col gap-2 border-b border-separator pb-8">
        <h1 className="m-0 text-[clamp(28px,4vw,40px)] font-semibold leading-tight tracking-tight">Browse courses</h1>
        <p className="m-0 max-w-[60ch] text-muted">Courses written by people in the EduHub community. Every lesson is free to take.</p>
      </section>

      <form className="mt-6 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto]" role="search" onSubmit={(event) => { event.preventDefault(); setQuery({ q: search.trim() }); }}>
        <label className="relative block">
          <span className="sr-only">Search courses</span>
          <IconSearch size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted" aria-hidden />
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by title or topic" maxLength={100}
            className="h-10 w-full rounded-xl border border-border bg-field pr-3 pl-10 text-sm outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30" />
        </label>
        <label className="flex flex-col">
          <span className="sr-only">Category</span>
          <select className={selectClass} value={query.category} onChange={(event) => setQuery({ category: event.target.value as CourseCategory | "" })}>
            <option value="">All categories</option>
            {Object.entries(CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="sr-only">Level</span>
          <select className={selectClass} value={query.level} onChange={(event) => setQuery({ level: event.target.value as CourseLevel | "" })}>
            <option value="">Any level</option>
            {Object.entries(LEVELS).filter(([key]) => key !== "all").map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
        <label className="flex flex-col">
          <span className="sr-only">Sort by</span>
          <select className={selectClass} value={query.sort} onChange={(event) => setQuery({ sort: event.target.value as CourseQuery["sort"] })}>
            {Object.entries(SORTS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
          </select>
        </label>
      </form>
      {isFiltered && (
        <Button size="sm" variant="ghost" className="mt-2" onPress={() => { setSearch(""); router.replace(pathname, { scroll: false }); }}>
          Clear filters
        </Button>
      )}

      <CoursesFeed key={firstPage} firstPage={firstPage} isFiltered={isFiltered} />
    </div>
  );
}

export default CoursesList;
