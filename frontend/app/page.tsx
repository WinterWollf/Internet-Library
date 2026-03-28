import Link from "next/link";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold">Internet Library</h1>
      <p className="mt-4 text-gray-600">Your online book catalog and loan management system.</p>
      <div className="mt-8 flex gap-4">
        <Link href="/catalog" className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          Browse Catalog
        </Link>
        <Link href="/login" className="rounded-md border px-4 py-2 hover:bg-gray-50">
          Sign In
        </Link>
      </div>
    </main>
  );
}
