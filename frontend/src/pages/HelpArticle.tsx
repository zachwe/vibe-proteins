/**
 * Dynamic help article page for reference binder documentation
 */

import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import { useHelpArticle } from "../lib/hooks";

// Custom markdown components for help articles
function createMarkdownComponents(): Components {
  return {
    a: ({ href, children }) => {
      // External links open in new tab
      const isExternal = href?.startsWith("http");
      return (
        <a
          href={href}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="text-blue-400 hover:text-blue-300 underline"
        >
          {children}
        </a>
      );
    },
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-white mt-6 mb-3">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-medium text-slate-200 mt-4 mb-2">{children}</h3>
    ),
    p: ({ children }) => (
      <p className="text-slate-300 mb-4 leading-relaxed">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-slate-300 mb-4 space-y-1">{children}</ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-slate-300 mb-4 space-y-1">{children}</ol>
    ),
    li: ({ children }) => (
      <li className="text-slate-300">{children}</li>
    ),
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => (
      <em className="italic text-slate-200">{children}</em>
    ),
    code: ({ children }) => (
      <code className="bg-slate-700 text-emerald-400 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 my-4 italic text-slate-400">
        {children}
      </blockquote>
    ),
  };
}

const CATEGORY_LABELS: Record<string, string> = {
  "reference-binder": "Reference Binder",
  concept: "Concept",
  tutorial: "Tutorial",
};

const CATEGORY_COLORS: Record<string, string> = {
  "reference-binder": "bg-amber-500/20 text-amber-300 border-amber-500/30",
  concept: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  tutorial: "bg-green-500/20 text-green-300 border-green-500/30",
};

export default function HelpArticle() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, error } = useHelpArticle(slug || "");

  const markdownComponents = createMarkdownComponents();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-slate-700 rounded w-32" />
          <div className="h-8 bg-slate-700 rounded w-3/4" />
          <div className="space-y-3 mt-8">
            <div className="h-4 bg-slate-700 rounded" />
            <div className="h-4 bg-slate-700 rounded w-5/6" />
            <div className="h-4 bg-slate-700 rounded w-4/6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Helmet>
          <title>Article Not Found | ProteinDojo</title>
        </Helmet>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📄</div>
          <h1 className="text-2xl font-bold text-white mb-2">Article Not Found</h1>
          <p className="text-slate-400 mb-6">
            The help article you're looking for doesn't exist or has been moved.
          </p>
          <Link
            to="/help"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <span>←</span>
            <span>Back to Help</span>
          </Link>
        </div>
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[article.category] || article.category;
  const categoryColor = CATEGORY_COLORS[article.category] || CATEGORY_COLORS.concept;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Helmet>
        <title>{article.title} | ProteinDojo Help</title>
        <meta
          name="description"
          content={`Learn about ${article.title} - ${categoryLabel} documentation for ProteinDojo protein design platform.`}
        />
      </Helmet>

      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-slate-400">
          <li>
            <Link to="/help" className="hover:text-slate-300">
              Help
            </Link>
          </li>
          <li>
            <span className="text-slate-600">/</span>
          </li>
          <li>
            <span className={`px-2 py-0.5 rounded text-xs border ${categoryColor}`}>
              {categoryLabel}
            </span>
          </li>
        </ol>
      </nav>

      {/* Article Header */}
      <header className="mb-8 pb-6 border-b border-slate-700">
        <h1 className="text-3xl font-bold text-white mb-3">{article.title}</h1>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>
            Last updated:{" "}
            {new Date(article.updatedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </header>

      {/* Article Content */}
      <article className="prose prose-invert max-w-none">
        <Markdown components={markdownComponents}>{article.content}</Markdown>
      </article>

      {/* Back Link */}
      <footer className="mt-12 pt-6 border-t border-slate-700">
        <Link
          to="/help"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
        >
          <span>←</span>
          <span>Back to Help</span>
        </Link>
      </footer>
    </div>
  );
}
