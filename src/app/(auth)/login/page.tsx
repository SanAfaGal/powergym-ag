import { LoginForm } from "@/modules/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="flex min-h-screen flex-1 items-center justify-center p-4">
      <LoginForm inactiveAccount={error === "inactive"} />
    </div>
  );
}
