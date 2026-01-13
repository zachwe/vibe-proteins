/**
 * Blog Index Page
 *
 * Lists all blog posts with titles, descriptions, and dates.
 */

import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { getAllBlogPosts } from "../data/blogPosts";

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

export default function Blog() {
  const posts = getAllBlogPosts();

  return (
    <div className="min-h-screen bg-slate-900">
      <Helmet>
        <title>Blog | ProteinDojo</title>
        <meta
          name="description"
          content="ProteinDojo blog - updates, tutorials, and insights on computational protein design."
        />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <h1 className="text-3xl font-bold text-white mb-2">Blog</h1>
        <p className="text-slate-400 mb-8">
          Updates, tutorials, and insights on computational protein design.
        </p>

        <div className="space-y-6">
          {posts.map((post) => (
            <Link
              key={post.slug}
              to={`/blog/${post.slug}`}
              className="block bg-slate-800 rounded-lg p-6 hover:bg-slate-750 border border-slate-700 hover:border-slate-600 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <span
                  className={`px-2 py-0.5 rounded text-xs border ${
                    CATEGORY_COLORS[post.category] || CATEGORY_COLORS.technical
                  }`}
                >
                  {CATEGORY_LABELS[post.category] || post.category}
                </span>
                <span className="text-slate-500 text-sm">
                  {new Date(post.publishedAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <h2 className="text-xl font-semibold text-white mb-2">
                {post.title}
              </h2>
              <p className="text-slate-400 text-sm">{post.description}</p>
              <div className="mt-4 text-blue-400 text-sm font-medium">
                Read more &rarr;
              </div>
            </Link>
          ))}
        </div>

        {posts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-4">📝</div>
            <p className="text-slate-400">No blog posts yet. Check back soon!</p>
          </div>
        )}
      </div>
    </div>
  );
}
