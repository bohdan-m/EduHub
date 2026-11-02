// login and register bring their own minimal header, so no site header or footer here
export default function AuthGroupLayout({ children }: { children: React.ReactNode }) {
  return <main className="flex flex-1 flex-col">{children}</main>;
}
