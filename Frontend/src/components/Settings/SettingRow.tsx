/** The one layout every setting uses: what it is, its current state on one line, one control on the right.
 *  `children` is whatever opens underneath it, such as a form. */
function SettingRow({ title, detail, leading, control, children }: {
  title: React.ReactNode;
  detail?: React.ReactNode;
  leading?: React.ReactNode;
  control?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <div className="flex min-h-10 items-center gap-4">
        {leading}
        <div className="min-w-0 flex-1">
          <h3 className="m-0 text-[15px] font-medium [overflow-wrap:anywhere]">{title}</h3>
          {detail && <div className="mt-0.5 text-sm text-muted [overflow-wrap:anywhere]">{detail}</div>}
        </div>
        {control && <div className="shrink-0">{control}</div>}
      </div>
      {children}
    </div>
  );
}

export default SettingRow;
