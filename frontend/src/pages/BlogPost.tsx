/**
 * Individual Blog Post Page
 *
 * Renders a single blog post with markdown content.
 */

import { useParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { getBlogPost } from "../data/blogPosts";

// Custom markdown components for blog posts
function createMarkdownComponents(): Components {
  return {
    a: ({ href, children }) => {
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
      <h1 className="text-2xl font-bold text-white mt-8 mb-4 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-semibold text-white mt-8 mb-3">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-medium text-slate-200 mt-6 mb-2">
        {children}
      </h3>
    ),
    p: ({ children }) => (
      <p className="text-slate-300 mb-4 leading-relaxed">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-slate-300 mb-4 space-y-1 ml-2">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-slate-300 mb-4 space-y-1 ml-2">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="text-slate-300">{children}</li>,
    strong: ({ children }) => (
      <strong className="font-semibold text-white">{children}</strong>
    ),
    em: ({ children }) => <em className="italic text-slate-200">{children}</em>,
    code: ({ children }) => (
      <code className="bg-slate-700 text-emerald-400 px-1.5 py-0.5 rounded text-sm font-mono">
        {children}
      </code>
    ),
    pre: ({ children }) => (
      <pre className="bg-slate-800 border border-slate-700 rounded-lg p-4 overflow-x-auto my-4">
        {children}
      </pre>
    ),
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-blue-500 pl-4 my-4 italic text-slate-400">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="border-slate-700 my-8" />,
    table: ({ children }) => (
      <div className="overflow-x-auto my-6">
        <table className="min-w-full border border-slate-600 rounded-lg overflow-hidden">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-slate-700">{children}</thead>
    ),
    tbody: ({ children }) => (
      <tbody className="divide-y divide-slate-700">{children}</tbody>
    ),
    tr: ({ children }) => (
      <tr className="hover:bg-slate-800/50">{children}</tr>
    ),
    th: ({ children }) => (
      <th className="px-4 py-2 text-left text-sm font-semibold text-slate-200">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-2 text-sm text-slate-300">{children}</td>
    ),
  };
}

const CATEGORY_COLORS: Record<string, string> = {
  announcement: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  technical: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
  industry: "bg-amber-500/20 text-amber-300 border-amber-500/30",
};

const CATEGORY_LABELS: Record<string, string> = {
  announcement: "Announcement",
  technical: "Technical",
  industry: "Industry",
};

export default function BlogPost() {
  const { slug } = useParams<{ slug: string }>();
  const post = getBlogPost(slug || "");

  const markdownComponents = createMarkdownComponents();

  if (!post) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <Helmet>
          <title>Post Not Found | ProteinDojo Blog</title>
        </Helmet>
        <div className="text-center py-12">
          <div className="text-4xl mb-4">📝</div>
          <h1 className="text-2xl font-bold text-white mb-2">Post Not Found</h1>
          <p className="text-slate-400 mb-6">
            The blog post you're looking for doesn't exist or has been moved.
          </p>
          <Link
            to="/blog"
            className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
          >
            <span>&larr;</span>
            <span>Back to Blog</span>
          </Link>
        </div>
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[post.category] || post.category;
  const categoryColor =
    CATEGORY_COLORS[post.category] || CATEGORY_COLORS.technical;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <Helmet>
        <title>{post.title} | ProteinDojo Blog</title>
        <meta name="description" content={post.description} />
        <meta property="og:title" content={post.title} />
        <meta property="og:description" content={post.description} />
        <meta property="og:type" content="article" />
        <meta property="article:published_time" content={post.publishedAt} />
        <meta property="article:author" content={post.author} />
      </Helmet>

      {/* Breadcrumb */}
      <nav className="mb-6">
        <ol className="flex items-center gap-2 text-sm text-slate-400">
          <li>
            <Link to="/blog" className="hover:text-slate-300">
              Blog
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
        <h1 className="text-3xl font-bold text-white mb-4">{post.title}</h1>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span>{post.author}</span>
          <span>&middot;</span>
          <span>
            {new Date(post.publishedAt).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
      </header>

      {/* Article Content */}
      <article className="prose prose-invert max-w-none">
        <Markdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
          {post.content}
        </Markdown>
      </article>

      {/* Back Link */}
      <footer className="mt-12 pt-6 border-t border-slate-700">
        <Link
          to="/blog"
          className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300"
        >
          <span>&larr;</span>
          <span>Back to Blog</span>
        </Link>
      </footer>
    </div>
  );
}
