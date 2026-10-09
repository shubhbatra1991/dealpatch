type WorkspacePlaceholderProps = {
  title: string;
  description: string;
};

export function WorkspacePlaceholder({ title, description }: WorkspacePlaceholderProps) {
  return (
    <section aria-labelledby="page-title">
      <div className="border-b border-border pb-4">
        <h1 id="page-title" className="text-lg font-semibold tracking-tight">{title}</h1>
        <p className="mt-1 text-sm text-text-muted">{description}</p>
      </div>
      <p className="py-6 text-sm text-text-muted">This workspace is ready for its first feature. No data has been added yet.</p>
    </section>
  );
}
