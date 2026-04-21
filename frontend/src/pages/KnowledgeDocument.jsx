import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { getDocumentPreview } from '../api/knowledgeApi';
import { getAnchorProps } from '../utils/links';
import { normalizeMarkdownContent } from '../utils/markdown';
import { useThemeStore } from '../store/themeStore';

const stripFrontmatter = (content = '') => content.replace(/^---[\s\S]*?---\s*/, '');

function KnowledgeDocument() {
  const { docId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { theme } = useThemeStore();
  const isDark = theme === 'dark';
  const [documentData, setDocumentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadDocument = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await getDocumentPreview(docId);
        if (!mounted) return;
        setDocumentData(data);
      } catch (err) {
        if (!mounted) return;
        setError(err.response?.data?.detail || '加载知识详情失败');
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    if (docId) {
      loadDocument();
    }

    return () => {
      mounted = false;
    };
  }, [docId]);

  useEffect(() => {
    if (!documentData) return;
    const section = (searchParams.get('section') || '').trim();
    if (!section) return;

    const timer = window.setTimeout(() => {
      const headings = Array.from(document.querySelectorAll('[data-knowledge-content] h1, [data-knowledge-content] h2, [data-knowledge-content] h3, [data-knowledge-content] h4'));
      const target = headings.find((node) => {
        const text = (node.textContent || '').trim();
        return text === section || text.includes(section);
      });
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);

    return () => window.clearTimeout(timer);
  }, [documentData, searchParams]);

  const renderedContent = useMemo(
    () => normalizeMarkdownContent(stripFrontmatter(documentData?.content || '')),
    [documentData]
  );

  return (
    <div className={`min-h-screen px-4 py-6 sm:px-6 lg:px-8 ${isDark ? 'bg-[#05060a] text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="mx-auto max-w-5xl">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className={`mb-4 inline-flex items-center rounded-md px-3 py-2 text-sm transition-colors ${
            isDark ? 'bg-slate-900 text-slate-200 hover:bg-slate-800' : 'bg-white text-slate-700 hover:bg-slate-100 border border-gray-200'
          }`}
        >
          返回上一页
        </button>

        <div className={`rounded-2xl border p-5 sm:p-6 ${isDark ? 'border-slate-800 bg-slate-950/75' : 'border-gray-200 bg-white shadow-sm'}`}>
          {loading ? (
            <div className={isDark ? 'text-slate-300' : 'text-slate-600'}>正在加载知识详情...</div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          ) : (
            <>
              <div className="mb-6">
                <div className={`text-xs uppercase tracking-[0.2em] ${isDark ? 'text-amber-300/80' : 'text-amber-700'}`}>
                  Knowledge
                </div>
                <h1 className="mt-2 text-2xl font-semibold sm:text-3xl">{documentData?.title || '知识详情'}</h1>
                <div className={`mt-3 flex flex-wrap gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-600'}`}>
                  {documentData?.grade_level ? <span className="rounded-full bg-amber-500/10 px-3 py-1">{documentData.grade_level}</span> : null}
                  {documentData?.subject ? <span className="rounded-full bg-blue-500/10 px-3 py-1">{documentData.subject}</span> : null}
                  {documentData?.topic ? <span className="rounded-full bg-emerald-500/10 px-3 py-1">{documentData.topic}</span> : null}
                  {documentData?.source ? <span className="rounded-full bg-slate-500/10 px-3 py-1">来源：{documentData.source}</span> : null}
                </div>
              </div>

              <div
                data-knowledge-content
                className={`prose prose-sm max-w-none sm:prose-base ${isDark ? 'prose-invert text-slate-100' : 'text-gray-800'}`}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={{
                    a: ({ node, ...props }) => (
                      <a
                        {...props}
                        {...getAnchorProps(props.href)}
                        className={`underline ${isDark ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-800'}`}
                      />
                    ),
                    p: ({ children }) => <p className="mb-3 leading-7">{children}</p>,
                    li: ({ children }) => <li className="leading-7">{children}</li>,
                    code: ({ children }) => (
                      <code className={`rounded px-1.5 py-0.5 ${isDark ? 'bg-slate-800 text-slate-100' : 'bg-amber-100 text-amber-950'}`}>
                        {children}
                      </code>
                    ),
                  }}
                >
                  {renderedContent}
                </ReactMarkdown>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default KnowledgeDocument;
