export function PageHeader({ title, lede }: { title: string; lede: string }) {
  return (
    <>
      <h1 className="page-title">{title}</h1>
      <p className="lede">{lede}</p>
    </>
  );
}
