export default function AcademyPageShell({ isDark, children }) {
  return (
    <div
      data-testid="academy-shell"
      className={`academy-shell min-h-screen ${isDark ? 'academy-shell-dark' : 'academy-shell-light'}`}
    >
      <div className="academy-page-frame mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
