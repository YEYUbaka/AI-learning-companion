export default function AcademyCard({ as: Tag = 'section', className = '', children }) {
  return (
    <Tag className={`academy-card border rounded-[24px] ${className}`}>
      {children}
    </Tag>
  );
}
